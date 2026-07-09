import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, removeAt } from '../../lib/rtdb-helpers'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'

/**
 * 4단계: 교사 정리글 빠른 승인 큐 (대개편)
 * - 작성 현황 탭 추가: 전체 학생의 실시간 진행 단계 모니터링
 * - 각 단계별 완료(저장) 여부 시각화 (개요/도입/전개/마무리/최종 5버튼)
 * - 완료된 단계 클릭 시 해당 단계 내용만 팝업으로 즉시 조회하는 기능 추가 (피드백 반영)
 * - 임시 저장 및 작성 중인 초안 즉시 열람 기능 추가
 */
function TagBadge({ tag }) {
  if (!tag) return null
  const tags = tag.split(',')
  return (
    <div className="inline-flex gap-1 ml-1.5">
      {tags.includes('fact') && (
        <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-bold">사실</span>
      )}
      {tags.includes('opinion') && (
        <span className="text-[9px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-md font-bold">의견</span>
      )}
    </div>
  )
}

// ── 신규: 단계별 세부내용 조회 모달 ──
function StepDetailModal({ student, step, r, onClose }) {
  const stepNames = ['개요 작성', '도입 단락', '전개 단락', '마무리 단락', '최종본 작성']
  if (!r) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[80vh]">
        <div className="bg-pink-50 border-b border-pink-100 px-4 py-3.5 flex items-center justify-between shrink-0">
          <div>
            <h4 className="font-extrabold text-pink-900 text-sm">{student.number}번 {student.nickname} 학생</h4>
            <p className="text-[10px] text-pink-700 font-bold">{step}단계. {stepNames[step - 1]} 작성 내용</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm border shadow-sm transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-4 text-xs text-gray-700 overflow-y-auto leading-relaxed">
          {step === 1 && (
            <div className="space-y-3">
              <div className="bg-blue-50/30 border border-blue-100 p-3 rounded-xl">
                <span className="text-[10px] font-extrabold text-blue-700 block mb-1">📘 도입 개요</span>
                <p className="font-medium text-gray-800">{r.outline?.intro || '(비어 있음)'}</p>
              </div>
              <div className="bg-emerald-50/30 border border-emerald-100 p-3 rounded-xl">
                <span className="text-[10px] font-extrabold text-emerald-700 block mb-1">📗 전개 개요</span>
                <p className="font-medium text-gray-800">{r.outline?.body || '(비어 있음)'}</p>
              </div>
              <div className="bg-pink-50/30 border border-pink-100 p-3 rounded-xl">
                <span className="text-[10px] font-extrabold text-pink-700 block mb-1">📕 마무리 개요</span>
                <p className="font-medium text-gray-800">{r.outline?.conclusion || '(비어 있음)'}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="font-bold text-gray-500 text-[10px] mb-1">💡 작성 가이드 (도입 개요)</p>
                <p className="font-medium text-gray-700 italic">"{r.outline?.intro || ''}"</p>
              </div>
              <div className="space-y-2 pt-1">
                <div className="bg-white border p-3 rounded-xl shadow-sm">
                  <span className="text-[10px] font-bold text-gray-500 block mb-1">중심 문장</span>
                  <p className="font-bold text-gray-900">{r.p1?.main || '(작성 전)'}<TagBadge tag={r.p1?.mainTag} /></p>
                </div>
                {r.p1?.supportA && (
                  <div className="bg-white border p-3 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 block mb-1">뒷받침 문장 ①</span>
                    <p className="font-medium text-gray-800">{r.p1.supportA}<TagBadge tag={r.p1.supportATag}/></p>
                  </div>
                )}
                {r.p1?.supportB && (
                  <div className="bg-white border p-3 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 block mb-1">뒷받침 문장 ②</span>
                    <p className="font-medium text-gray-800">{r.p1.supportB}<TagBadge tag={r.p1.supportBTag}/></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="font-bold text-gray-500 text-[10px] mb-1">💡 작성 가이드 (전개 개요)</p>
                <p className="font-medium text-gray-700 italic">"{r.outline?.body || ''}"</p>
              </div>
              <div className="space-y-2 pt-1">
                <div className="bg-white border p-3 rounded-xl shadow-sm">
                  <span className="text-[10px] font-bold text-gray-500 block mb-1">중심 문장</span>
                  <p className="font-bold text-gray-900">{r.p2?.main || '(작성 전)'}<TagBadge tag={r.p2?.mainTag} /></p>
                </div>
                {r.p2?.supportA && (
                  <div className="bg-white border p-3 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 block mb-1">뒷받침 문장 ①</span>
                    <p className="font-medium text-gray-800">{r.p2.supportA}<TagBadge tag={r.p2.supportATag}/></p>
                  </div>
                )}
                {r.p2?.supportB && (
                  <div className="bg-white border p-3 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 block mb-1">뒷받침 문장 ②</span>
                    <p className="font-medium text-gray-800">{r.p2.supportB}<TagBadge tag={r.p2.supportBTag}/></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <p className="font-bold text-gray-500 text-[10px] mb-1">💡 작성 가이드 (마무리 개요)</p>
                <p className="font-medium text-gray-700 italic">"{r.outline?.conclusion || ''}"</p>
              </div>
              <div className="space-y-2 pt-1">
                <div className="bg-white border p-3 rounded-xl shadow-sm">
                  <span className="text-[10px] font-bold text-gray-500 block mb-1">중심 문장</span>
                  <p className="font-bold text-gray-900">{r.p3?.main || '(작성 전)'}<TagBadge tag={r.p3?.mainTag} /></p>
                </div>
                {r.p3?.supportA && (
                  <div className="bg-white border p-3 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 block mb-1">뒷받침 문장 ①</span>
                    <p className="font-medium text-gray-800">{r.p3.supportA}<TagBadge tag={r.p3.supportATag}/></p>
                  </div>
                )}
                {r.p3?.supportB && (
                  <div className="bg-white border p-3 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-gray-500 block mb-1">뒷받침 문장 ②</span>
                    <p className="font-medium text-gray-800">{r.p3.supportB}<TagBadge tag={r.p3.supportBTag}/></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div className="bg-white border p-3.5 rounded-xl shadow-sm border-pink-200">
                <span className="text-[10px] font-extrabold text-pink-700 block mb-1">📝 글 제목</span>
                <p className="font-extrabold text-gray-900 text-sm">"{r.title || '(제목 없음)'}"</p>
              </div>
              <div className="bg-pink-50/20 border border-pink-100 p-4 rounded-xl shadow-inner">
                <span className="text-[10px] font-extrabold text-pink-700 block mb-1.5">📜 최종 에세이 본문</span>
                <p className="whitespace-pre-wrap leading-relaxed font-semibold text-gray-800">{r.finalEssay || '(작성 전)'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-4 py-3 flex justify-end border-t shrink-0">
          <button onClick={onClose} className="px-5 py-2 bg-pink-600 text-white font-extrabold rounded-xl hover:bg-pink-700 transition shadow-sm">확인</button>
        </div>
      </div>
    </div>
  )
}

function DetailPanel({ r, onClose, onApprove, onReject, onDelete }) {
  const [rejectMemo, setRejectMemo] = useState(r.rejectMemo || '')
  const [canvaOpen, setCanvaOpen] = useState(false)
  const canvaUrl = r.canvaUrl ? formatCanvaEmbedUrl(r.canvaUrl) : ''

  const labels = ['개요 작성', '도입 단락', '전개 단락', '마무리 단락', '최종본 작성']

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="w-full max-w-xl bg-white shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-250">
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-extrabold text-gray-900 text-base">{r.authorNumber}번 {r.authorNickname}</h3>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {r.isPrivate && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-semibold">🔒 비공개</span>}
              {r.isModified && <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">✏️ 수정됨</span>}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                r.status === 'approved' ? 'bg-emerald-100 text-emerald-800'
                : r.status === 'rejected' ? 'bg-red-100 text-red-800'
                : r.status === 'writing' ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
              }`}>
                {r.status === 'approved' ? '✓ 승인됨' 
                  : r.status === 'rejected' ? '✗ 반려됨' 
                  : r.status === 'writing' ? `📝 작성 중 (${r.progressStep || 1}단계: ${labels[(r.progressStep || 1) - 1]})` 
                  : '⏳ 대기 중'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-xl font-bold flex items-center justify-center border transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-4 text-sm flex-1">
          {/* 캔바 카드뉴스 */}
          {canvaUrl && (
            <div className="border border-violet-200 rounded-2xl overflow-hidden shadow-sm bg-violet-50/10">
              <button onClick={() => setCanvaOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-50 transition-colors">
                <span className="flex items-center gap-1">🎨 캔바 카드뉴스 보기</span>
                <span>{canvaOpen ? '▲ 접기' : '▼ 펼치기'}</span>
              </button>
              {canvaOpen && (
                <div className="aspect-video border-t border-violet-100">
                  <iframe src={canvaUrl} className="w-full h-full" frameBorder="0" allowFullScreen title="카드뉴스" />
                </div>
              )}
            </div>
          )}

          {/* 제목 */}
          {r.title && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-500 mb-1">📝 글 제목</p>
              <p className="font-extrabold text-gray-800 text-base">"{r.title}"</p>
            </div>
          )}

          {/* 개요 */}
          {r.outline && (r.outline.intro || r.outline.body || r.outline.conclusion) && (
            <div className="bg-pink-50/20 border border-pink-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-pink-700">📋 개요 요약</p>
              {r.outline.intro      && <p className="text-xs"><span className="text-blue-600 font-bold bg-blue-50 px-1 py-0.5 rounded mr-1">도입</span> {r.outline.intro}</p>}
              {r.outline.body       && <p className="text-xs"><span className="text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded mr-1">전개</span> {r.outline.body}</p>}
              {r.outline.conclusion && <p className="text-xs"><span className="text-pink-600 font-bold bg-pink-50 px-1 py-0.5 rounded mr-1">마무리</span> {r.outline.conclusion}</p>}
            </div>
          )}

          {/* 구조적 단락 */}
          {[
            { label: '📘 도입 단락', data: r.p1 },
            { label: '📗 전개 단락', data: r.p2 },
            { label: '📕 마무리 단락', data: r.p3 },
          ].map(({ label, data }) => data?.main && (
            <div key={label} className="bg-white border rounded-2xl p-4 space-y-2 shadow-sm">
              <p className="text-xs font-bold text-gray-500 border-b pb-1">{label}</p>
              <p className="font-bold text-gray-800 text-xs">중심: {data.main}<TagBadge tag={data.mainTag} /></p>
              {data.supportA && <p className="text-gray-600 pl-2 text-xs">↳ {data.supportA}<TagBadge tag={data.supportATag} /></p>}
              {data.supportB && <p className="text-gray-600 pl-2 text-xs">↳ {data.supportB}<TagBadge tag={data.supportBTag} /></p>}
            </div>
          ))}

          {/* 기존 5박스 호환 표시 */}
          {!r.p1 && (
            <div className="space-y-2 bg-gray-50 rounded-2xl p-4 border text-xs">
              {r.participation   && <p><span className="font-bold text-gray-700">1️⃣ 참여:</span> {r.participation}</p>}
              {r.feelings        && <p><span className="font-bold text-gray-700">2️⃣ 느낌:</span> {r.feelings}</p>}
              {r.mostImpressive  && <p><span className="font-bold text-gray-700">3️⃣ 인상깊은:</span> {r.mostImpressive}</p>}
              {r.newLearnings    && <p><span className="font-bold text-gray-700">4️⃣ 새로 안 것:</span> {r.newLearnings}</p>}
              {r.pledge          && <p><span className="font-bold text-gray-700">5️⃣ 다짐:</span> {r.pledge}</p>}
            </div>
          )}

          {/* 마치며 (최종 에세이) */}
          {r.finalEssay && (
            <div className="bg-pink-50/40 border-2 border-pink-200 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-extrabold text-pink-700 mb-1.5">📜 마치며 (최종본)</p>
              <p className="whitespace-pre-wrap text-gray-800 leading-relaxed font-medium text-xs">{r.finalEssay}</p>
            </div>
          )}

          {/* 반려 메모 */}
          {r.status !== 'approved' && r.status !== 'writing' && (
            <div className="border-t pt-3">
              <label className="text-xs font-bold text-gray-600 block mb-1">반려 사유 메모 (선택 — 학생에게 표시)</label>
              <textarea value={rejectMemo} onChange={(e) => setRejectMemo(e.target.value)}
                rows={2} placeholder="어떤 부분을 수정해야 하는지 적어주세요."
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-2">
          {r.status === 'writing' ? (
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm rounded-xl bg-gray-700 text-white font-bold hover:bg-gray-800 transition">
              확인 및 닫기
            </button>
          ) : (
            <>
              {r.status !== 'approved' && (
                <button onClick={() => onApprove(r.id)}
                  className="flex-1 py-2.5 text-sm rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition">
                  ✓ 승인
                </button>
              )}
              {r.status !== 'rejected' && (
                <button onClick={() => onReject(r.id, rejectMemo)}
                  className="flex-1 py-2.5 text-sm rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition">
                  ✗ 반려
                </button>
              )}
              <button onClick={() => onDelete(r.id)}
                className="px-4 py-2.5 text-sm rounded-xl bg-red-100 text-red-700 font-bold hover:bg-red-200 transition">
                삭제
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReflectionApprovalQueue() {
  const roomCode = useGameStore((s) => s.roomCode)
  const students = useGameStore((s) => s.students)
  const [map, setMap]       = useState({})
  const [filter, setFilter] = useState('pending')
  const [detail, setDetail] = useState(null)
  const [activeStepDetail, setActiveStepDetail] = useState(null) // 단계별 상세 팝업 상태
  const [bulkLoading, setBulkLoading] = useState(false)
  const [actionToast, setActionToast] = useState('')

  const labels = ['개요 작성', '도입 단락', '전개 단락', '마무리 단락', '최종본 작성']

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'reflections', (d) => setMap(d || {}))
    return () => u?.()
  }, [roomCode])

  // 학생 목록 번호순 정렬
  const sortedStudents = useMemo(() => {
    return Object.entries(students || {})
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => (a.number || 0) - (b.number || 0))
  }, [students])

  // 특정 학생의 리플렉션 가져오기
  const getStudentReflection = (studentId) => {
    return Object.values(map).find(r => r.authorStudentId === studentId)
  }

  // 특정 리플렉션의 단계별 작성(완료) 판정
  const checkStepDone = (r, step) => {
    if (!r) return false
    if (step === 1) {
      return !!(r.outline?.intro || r.outline?.body || r.outline?.conclusion)
    }
    if (step === 2) {
      return !!(r.p1?.main || r.p1?.supportA || r.p1?.supportB)
    }
    if (step === 3) {
      return !!(r.p2?.main || r.p2?.supportA || r.p2?.supportB)
    }
    if (step === 4) {
      return !!(r.p3?.main || r.p3?.supportA || r.p3?.supportB)
    }
    if (step === 5) {
      return !!r.finalEssay
    }
    return false
  }

  const list = useMemo(() => {
    const arr = Object.entries(map)
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    
    if (filter === 'all') return arr
    return arr.filter((r) => r.status === filter)
  }, [map, filter])

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, writing: 0 }
    for (const r of Object.values(map)) {
      c[r.status] = (c[r.status] || 0) + 1
    }
    return c
  }, [map])

  const approve = (id) => updateAt(roomCode, `reflections/${id}`, {
    status: 'approved', approvedAt: Date.now(), rejectMemo: null,
  })
  const reject = (id, memo) => {
    updateAt(roomCode, `reflections/${id}`, {
      status: 'rejected', rejectMemo: memo || null,
    })
    setActionToast('✗ 반려 처리했어요 — 학생 화면에 바로 반영돼요.')
    setTimeout(() => setActionToast(''), 2000)
  }
  const del = (id) => {
    if (!confirm('이 정리 글을 영구 삭제할까요?')) return
    removeAt(roomCode, `reflections/${id}`)
    if (detail?.id === id) setDetail(null)
  }

  // 전체 일괄 승인
  const bulkApproveAll = async () => {
    const pending = Object.entries(map).filter(([, r]) => r.status === 'pending')
    if (!pending.length) return
    if (!confirm(`대기 중인 ${pending.length}개를 모두 승인할까요?`)) return
    setBulkLoading(true)
    await Promise.all(pending.map(([id]) =>
      updateAt(roomCode, `reflections/${id}`, { status: 'approved', approvedAt: Date.now() })
    ))
    setBulkLoading(false)
  }

  return (
    <div className="space-y-3">
      {/* 반려/승인 처리 확인 토스트 */}
      {actionToast && (
        <div className="fixed top-4 right-4 z-[60] bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {actionToast}
        </div>
      )}

      {/* 헤더 및 탭 */}
      <div className="space-y-2">
        <h3 className="font-extrabold text-pink-900 text-sm">📝 정리글 검토 및 모니터링</h3>
        <div className="flex gap-1 flex-wrap text-xs">
          {[
            ['writing',  `📝 작성 현황`],
            ['pending',  `⏳ 대기 ${counts.pending  || 0}`],
            ['approved', `✓ 승인 ${counts.approved || 0}`],
            ['rejected', `✗ 반려 ${counts.rejected || 0}`],
            ['all',      '전체 목록'],
          ].map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-all duration-200 ${
                filter === v ? 'bg-pink-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 일괄 승인 버튼 */}
      {counts.pending > 0 && filter === 'pending' && (
        <button onClick={bulkApproveAll} disabled={bulkLoading}
          className="w-full py-2.5 text-xs rounded-xl bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
          {bulkLoading ? '승인 중...' : `⚡ 대기 ${counts.pending}개 전체 일괄 승인`}
        </button>
      )}

      {/* 목록 / 테이블 구분 */}
      {filter === 'writing' ? (
        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white max-h-[480px] overflow-y-auto shadow-sm">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5">번호</th>
                <th className="px-4 py-2.5">이름</th>
                <th className="px-4 py-2.5">전체 상태</th>
                <th className="px-4 py-2.5">단계별 완료 상태 (클릭하여 확인)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedStudents.map((s) => {
                const r = getStudentReflection(s.id)
                let statusText = '⚪ 작성 전'
                let statusCls = 'text-gray-400 bg-gray-100'
                
                if (r) {
                  if (r.status === 'writing') {
                    const step = r.progressStep || 1
                    statusText = `📝 ${step}단계. ${labels[step - 1]} 작성 중`
                    statusCls = 'text-blue-750 bg-blue-50/50 border border-blue-200'
                  } else if (r.status === 'pending') {
                    statusText = '⏳ 검토 대기 중'
                    statusCls = 'text-yellow-750 bg-yellow-50 border border-yellow-255'
                  } else if (r.status === 'rejected') {
                    statusText = '✗ 반려됨'
                    statusCls = 'text-red-750 bg-red-50 border border-red-200'
                  } else if (r.status === 'approved') {
                    statusText = '✓ 승인 완료'
                    statusCls = 'text-emerald-750 bg-emerald-50 border border-emerald-250 font-bold'
                  }
                }

                return (
                  <tr 
                    key={s.id} 
                    className="hover:bg-pink-50/20 cursor-pointer transition-colors"
                    onClick={() => {
                      if (r) {
                        setDetail(r)
                      } else {
                        alert(`${s.number}번 ${s.nickname} 학생은 아직 정리글 작성을 시작하지 않았습니다.`)
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-gray-500 font-bold">{s.number}번</td>
                    <td className="px-4 py-3 font-black text-gray-800">{s.nickname}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusCls}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {[1, 2, 3, 4, 5].map((step) => {
                          const isDone = checkStepDone(r, step)
                          const stepLabels = ['1.개요', '2.도입', '3.전개', '4.마무리', '5.최종']
                          return (
                            <button
                              key={step}
                              type="button"
                              onClick={() => {
                                if (isDone) {
                                  setActiveStepDetail({ student: s, step, r })
                                } else {
                                  alert(`${s.nickname} 학생은 아직 ${step}단계(${stepLabels[step - 1].slice(2)})를 작성(저장)하지 않았습니다.`)
                                }
                              }}
                              className={`px-2.5 py-1 text-[10px] rounded-lg border font-black transition-all duration-150 ${
                                isDone 
                                  ? 'bg-emerald-500 text-white border-transparent hover:bg-emerald-600 shadow-sm hover:scale-105' 
                                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              }`}
                              title={`${stepLabels[step - 1]} 단계 ${isDone ? '완료 (클릭 시 확인)' : '미작성'}`}
                            >
                              {stepLabels[step - 1]} {isDone ? '✓' : '-'}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-2 max-h-[480px] overflow-y-auto">
          {list.length === 0 && (
            <li className="text-xs text-gray-400 text-center py-10 bg-gray-50 rounded-2xl border border-dashed">표시할 글이 없어요.</li>
          )}
          {list.map((r) => (
            <li key={r.id}
              onClick={() => setDetail(r)}
              className="bg-white border border-gray-200 rounded-2xl p-4 text-xs cursor-pointer hover:border-pink-300 hover:shadow-md transition duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.isPrivate  && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-semibold">🔒 비공개</span>}
                    {r.isModified && <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">✏️ 수정됨</span>}
                    {r.canvaUrl   && <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-800 rounded-full font-bold">🎨 카드뉴스</span>}
                  </div>
                  <p className="font-extrabold text-gray-800 text-sm">{r.authorNumber}번 {r.authorNickname}</p>
                  
                  {r.title && (
                    <p className="font-bold text-pink-700 text-xs truncate">"{r.title}"</p>
                  )}

                  <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed">
                    {r.finalEssay || r.p1?.main || r.participation || '(작성된 내용이 없습니다)'}
                  </p>
                  
                  {r.rejectMemo && (
                    <p className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 inline-block">
                      💬 메모: {r.rejectMemo}
                    </p>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    r.status === 'approved' ? 'bg-emerald-100 text-emerald-800'
                    : r.status === 'rejected' ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {r.status === 'approved' ? '✓ 승인' : r.status === 'rejected' ? '✗ 반려' : '⏳ 대기'}
                  </span>
                  
                  {/* 빠른 승인/반려 버튼 */}
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {r.status !== 'approved' && (
                      <button onClick={() => approve(r.id)}
                        className="px-2 py-1 text-[10px] bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-sm transition">
                        승인
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button onClick={() => reject(r.id, '')}
                        className="px-2 py-1 text-[10px] bg-amber-400 text-white rounded-lg font-bold hover:bg-amber-500 shadow-sm transition">
                        반려
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 상세 패널 (전체 내용) */}
      {detail && (
        <DetailPanel
          r={map[detail.id] ? { id: detail.id, ...map[detail.id] } : detail}
          onClose={() => setDetail(null)}
          onApprove={(id) => { approve(id) }}
          onReject={(id, memo) => { reject(id, memo) }}
          onDelete={(id) => { del(id); setDetail(null) }}
        />
      )}

      {/* 신규: 단계별 세부내용 팝업 모달 */}
      {activeStepDetail && (
        <StepDetailModal
          student={activeStepDetail.student}
          step={activeStepDetail.step}
          r={activeStepDetail.r}
          onClose={() => setActiveStepDetail(null)}
        />
      )}
    </div>
  )
}
