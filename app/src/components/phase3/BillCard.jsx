import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, setAt, removeAt } from '../../lib/rtdb-helpers'
import CommentList from '../phase1/CommentList'
import MultiAxisRating from '../shared/MultiAxisRating'
import { PHASE_STEPS } from '../teacher/PhaseWorkflow'
import { normalizeBillStatus } from '../../lib/bill-status'

const STATUS_BADGE = {
  discussion: { label: '💬 법안 토의 중',  cls: 'bg-amber-100 text-amber-800' },
  tabled:     { label: '🏛️ 정식 상정', cls: 'bg-indigo-100 text-indigo-800' },
  passed:     { label: '✅ 가결',       cls: 'bg-emerald-100 text-emerald-800' },
  rejected:   { label: '❌ 부결',       cls: 'bg-rose-100 text-rose-800' },
  voting:     { label: '🗳️ 의결 중', cls: 'bg-amber-100 text-amber-800' }, // 구버전 호환
}

const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }
const LEGISLATIVE_DISCUSS_STEP_INDEX =
  PHASE_STEPS[3]?.findIndex((step) => step.id === 'legislative-discuss') ?? 2

function buildBillBodyText(bill) {
  if (bill?.body) return bill.body
  const data = bill?.templateData || {}
  const lines = []
  if (data.purpose) lines.push(`제1조 (목적) ${data.purpose}`)
  if (data.definition) lines.push(`제2조 (정의) ${data.definition}`)
  if (data.duty) lines.push(`제3조 (의무) ${data.duty}`)
  if (data.penalty) lines.push(`제4조 (벌칙) ${data.penalty}`)
  if (lines.length) return lines.join('\n\n')

  const sectionLabels = {
    background: '입법 배경',
    clause: '핵심 조항',
    effect: '예상 효과',
    rebuttal: '우려 대응',
  }
  for (const [key, label] of Object.entries(sectionLabels)) {
    if (data[key]) lines.push(`[${label}]\n${data[key]}`)
  }
  return lines.join('\n\n')
}

/**
 * BillCard — 법안 카드.
 * 3 모드 분기 (status 기반):
 *  - discussion (또는 구버전 voting): 토의 단계 — 다축 평점 + 추천 + 댓글
 *  - tabled: 정식 상정 — 전광판 켜질 때만 찬/반/기권 표결
 *  - passed/rejected: 결과 표시
 *
 * @param {{bill, commentsMap?: Object, rank?: 1|2|3|null, previewMode?: boolean}} props
 *   previewMode: true 면 모든 액션(추천/투표/상정 등) 비활성. 데이터만 노출 (교사 미리보기용)
 */
function BillCard({ bill, commentsMap, rank, previewMode = false }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const billBoard = useGameStore((s) => s.roomData?.billBoard)
  const billBoardActive = billBoard?.active && billBoard?.billId === bill.id

  const [prefMap, setPrefMap] = useState({})  // 토의 단계 추천
  const [finalVotes, setFinalVotes] = useState({}) // 정식 표결
  const [editingBill, setEditingBill] = useState(false)
  const [editTitle, setEditTitle] = useState(bill.title || '')
  const [editBody, setEditBody] = useState(buildBillBodyText(bill))
  const [editingBusy, setEditingBusy] = useState(false)
  const [researchPlan, setResearchPlan] = useState({}) // 발의 모둠 연구자료

  const status = normalizeBillStatus(bill.status)

  useEffect(() => {
    if (!roomCode || !bill?.id) return
    const u1 = subscribe(roomCode, `bills/${bill.id}/preferences`, (d) => setPrefMap(d || {}))
    const u2 = subscribe(roomCode, `bills/${bill.id}/finalVotes`, (d) => setFinalVotes(d || {}))
    return () => { u1?.(); u2?.() }
  }, [roomCode, bill?.id])

  // 발의 모둠의 연구자료(뉴스 링크 등) 구독 — 토의·상정 단계에서 활용
  useEffect(() => {
    if (!roomCode || !bill?.proposerGroupId) return
    if (status !== 'discussion' && status !== 'tabled') return
    const unsub = subscribe(
      roomCode,
      `researchPlans/phase3_legislative/${bill.proposerGroupId}`,
      (d) => setResearchPlan(d || {}),
    )
    return unsub
  }, [roomCode, bill?.proposerGroupId, status])

  const proposer = bill.proposerGroupId ? groups[bill.proposerGroupId] : null
  const badge = STATUS_BADGE[status] || STATUS_BADGE.discussion
  const billBody = buildBillBodyText(bill)
  const hasTablingRequest = !!bill.tablingRequested
  const isTeacherRecommended = !!bill.teacherRecommended

  // 학생의 모둠
  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])
  const isOwnGroupBill = myGroupId && myGroupId === bill.proposerGroupId
  const canStudentManage =
    role === 'student' &&
    isOwnGroupBill &&
    status === 'discussion' &&
    !previewMode
  const canEditOrDeleteOwnBill = canStudentManage && !hasTablingRequest

  // 추천 카운트
  const prefCount = Object.values(prefMap).filter((v) => v?.liked).length
  const myPref = myStudentId ? !!prefMap[myStudentId]?.liked : false

  // 정식 표결 집계
  const finalTally = useMemo(() => {
    const c = { pro: 0, con: 0, abstain: 0 }
    for (const v of Object.values(finalVotes)) {
      if (v?.choice && c[v.choice] !== undefined) c[v.choice] += 1
    }
    const total = c.pro + c.con + c.abstain
    return { ...c, total }
  }, [finalVotes])
  const myFinalChoice = myStudentId ? finalVotes[myStudentId]?.choice : null

  // 추천 토글
  const [toggling, setToggling] = useState(false)
  const toggleRecommend = async () => {
    if (!myStudentId || isOwnGroupBill || toggling) return
    setToggling(true)
    try {
      if (myPref) {
        // 추천 취소 — remove 로 명확히 노드 삭제
        await removeAt(roomCode, `bills/${bill.id}/preferences/${myStudentId}`)
      } else {
        // 추천 — liked 단일 필드 (validate: liked = boolean)
        await setAt(roomCode, `bills/${bill.id}/preferences/${myStudentId}`, {
          liked: true,
          ts: Date.now(),
        })
      }
    } catch (err) {
      console.error('[bill recommend] 추천 토글 실패:', err)
      alert('추천 처리 중 오류가 발생했어요.\n\n' + (err?.message || ''))
    } finally {
      setToggling(false)
    }
  }

  const requestTabling = async () => {
    if (!canStudentManage || hasTablingRequest) return
    await updateAt(roomCode, `bills/${bill.id}`, {
      tablingRequested: true,
      tablingRequestedAt: Date.now(),
      tablingRequestedBy: myStudentId,
    })
  }

  const cancelTablingRequest = async () => {
    if (!canStudentManage || !hasTablingRequest) return
    await updateAt(roomCode, `bills/${bill.id}`, {
      tablingRequested: null,
      tablingRequestedAt: null,
      tablingRequestedBy: null,
    })
  }

  const toggleTeacherRecommendation = async () => {
    if (role !== 'teacher' || previewMode) return
    if (isTeacherRecommended) {
      await updateAt(roomCode, `bills/${bill.id}`, {
        teacherRecommended: null,
        teacherRecommendedAt: null,
      })
    } else {
      await updateAt(roomCode, `bills/${bill.id}`, {
        teacherRecommended: true,
        teacherRecommendedAt: Date.now(),
      })
    }
  }

  const startEditingOwnBill = () => {
    setEditTitle(bill.title || '')
    setEditBody(billBody)
    setEditingBill(true)
  }

  const saveOwnBillEdit = async () => {
    if (!canEditOrDeleteOwnBill || !editTitle.trim() || !editBody.trim()) return
    setEditingBusy(true)
    try {
      await updateAt(roomCode, `bills/${bill.id}`, {
        title: editTitle.trim(),
        body: editBody.trim(),
        manualBodyOverride: true,
        updatedAt: Date.now(),
      })
      setEditingBill(false)
    } catch (err) {
      alert('법안 수정 중 오류가 발생했어요.\n\n' + (err?.message || ''))
    } finally {
      setEditingBusy(false)
    }
  }

  // 정식 표결
  const castFinalVote = async (choice) => {
    if (!myStudentId || !billBoardActive) return
    if (myFinalChoice) {
      alert('이미 표결을 완료하셨습니다. 변경할 수 없습니다.')
      return
    }
    const choiceLabels = { pro: '찬성', con: '반대', abstain: '기권' }
    const confirmed = confirm(`정말로 ${choiceLabels[choice]}하시겠습니까?\n제출 후에는 변경할 수 없습니다.`)
    if (!confirmed) return

    await setAt(roomCode, `bills/${bill.id}/finalVotes/${myStudentId}`, {
      choice,
      ts: Date.now(),
    })
  }

  // 교사: 이 법안을 정식 상정
  const tableThisBill = async () => {
    if (!confirm(`'${bill.title}' 을 정식 상정할까요?\n다른 토의 중 법안은 토의 종료 처리됩니다.`)) return
    // 다른 모든 discussion/voting 법안은 'discussion-closed' 로
    // (한 번에 한 법안만 정식 상정)
    await updateAt(roomCode, `bills/${bill.id}`, {
      status: 'tabled',
      tabledAt: Date.now(),
      tablingRequested: null,
      tablingRequestedAt: null,
      tablingRequestedBy: null,
    })
  }

  // 교사: 표결 발표 — bill 확정 + 전광판은 결과 화면 모드로 (active 유지)
  const announceResult = async () => {
    const passed = finalTally.total > 0 && finalTally.pro / finalTally.total > 0.5
    if (!confirm(
      `'${bill.title}' 결과를 전광판에 발표합니다.\n\n` +
      `찬성 ${finalTally.pro} / 반대 ${finalTally.con} / 기권 ${finalTally.abstain} (총 ${finalTally.total}명)\n` +
      `→ ${passed ? '✅ 가결' : '❌ 부결'} (과반 기준)\n\n` +
      `전광판이 결과 화면으로 전환됩니다. 계속할까요?`
    )) return
    await updateAt(roomCode, `bills/${bill.id}`, {
      status: passed ? 'passed' : 'rejected',
      voteResult: { ...finalTally, passed },
      finalizedAt: Date.now(),
    })
    // 전광판은 active 유지, resultShown 만 켜서 결과 화면으로 전환
    await updateAt(roomCode, 'billBoard', {
      active: true,
      billId: bill.id,
      resultShown: true,
    })
  }

  // 교사: 표결 마감 — 전광판 끄기 (이미 발표된 결과는 closedBills 로 정리됨)
  const closeBoard = async () => {
    if (!confirm('전광판을 끄고 의결을 마무리합니다. 계속할까요?')) return
    await setAt(roomCode, 'billBoard', { active: false, billId: null, resultShown: false })
  }

  // 교사: 전광판 띄우기 / 끄기 (= 표결 시작/일시중지)
  const toggleBoard = async () => {
    if (billBoardActive) {
      await setAt(roomCode, 'billBoard', { active: false, billId: null })
    } else {
      await setAt(roomCode, 'billBoard', { active: true, billId: bill.id })
    }
  }

  // 교사: 정식 상정 취소 → 토의로 되돌리기
  const untableBack = async () => {
    if (!confirm('정식 상정을 취소하고 온라인 법안 토의 단계로 되돌릴까요?\n진행 중이던 표결 데이터와 전광판 상태는 초기화됩니다.')) return
    await updateAt(roomCode, `bills/${bill.id}`, {
      status: 'discussion',
      tabledAt: null,
      finalVotes: null,
      voteResult: null,
      finalizedAt: null,
    })
    await setAt(roomCode, 'billBoard', { active: false, billId: null })
    await updateAt(roomCode, 'workflow/phase3', { stepIndex: LEGISLATIVE_DISCUSS_STEP_INDEX })
  }

  const removeBill = async () => {
    const isStudentOwnDelete = canEditOrDeleteOwnBill
    if (role !== 'teacher' && !isStudentOwnDelete) return
    if (!confirm(`'${bill.title}' 법안을 영구 삭제할까요?\n관련 추천, 댓글 데이터가 모두 사라집니다.`)) return
    try {
      await removeAt(roomCode, `bills/${bill.id}`)
      if (billBoard?.billId === bill.id) {
        await setAt(roomCode, 'billBoard', { active: false, billId: null })
      }
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다: ' + err.message)
    }
  }

  // === 다축 평점 평균 계산 (commentsMap 으로부터) ===
  const billScore = useMemo(() => {
    if (!commentsMap) return null
    let sumLogic = 0, sumFeas = 0, sumRel = 0, n = 0
    for (const c of Object.values(commentsMap)) {
      if (c?.targetType !== 'bill' || c?.targetId !== bill.id) continue
      const r = c.ratings
      if (!r) continue
      sumLogic += Number(r.logic) || 0
      sumFeas  += Number(r.feasibility) || 0
      sumRel   += Number(r.relevance) || 0
      n += 1
    }
    if (n === 0) return null
    return {
      n,
      logic: sumLogic / n,
      feasibility: sumFeas / n,
      relevance: sumRel / n,
      overall: (sumLogic + sumFeas + sumRel) / (n * 3),
    }
  }, [commentsMap, bill.id])

  // === 이 법안 댓글 카운트 (헤더 표시용) — 답글(parentId)은 제외 ===
  const billComments = useMemo(() => {
    if (!commentsMap) return []
    return Object.entries(commentsMap)
      .map(([id, c]) => ({ id, ...c }))
      .filter((c) => c?.targetType === 'bill' && c?.targetId === bill.id && !c?.parentId)
  }, [commentsMap, bill.id])

  return (
    <article className={`bg-white rounded-2xl shadow-sm border p-4 space-y-2 ${
      status === 'tabled' ? 'border-2 border-indigo-400' : ''
    } ${rank === 1 ? 'ring-4 ring-amber-300' : rank === 2 ? 'ring-2 ring-slate-300' : ''}`}>
      <header className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
            {rank && <span className="text-xl">{RANK_MEDAL[rank]}</span>}
            {bill.title}
          </h3>
          {isTeacherRecommended && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold border border-sky-200">
              교사 추천
            </span>
          )}
          {hasTablingRequest && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
              상정 요청
            </span>
          )}
          {role === 'teacher' && !previewMode && (
            <button
              onClick={removeBill}
              className="text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded border border-red-100 transition-colors"
              title="법안 영구 삭제"
            >
              삭제
            </button>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </header>
      <p className="text-xs text-gray-500">
        발의: {proposer?.name || bill.proposerGroupId}
      </p>
      {editingBill ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="법안 제목"
          />
          <textarea
            rows={6}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm leading-relaxed resize-y"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            placeholder="법안 내용을 입력하세요"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditingBill(false)}
              className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-600 font-semibold"
            >
              취소
            </button>
            <button
              type="button"
              onClick={saveOwnBillEdit}
              disabled={editingBusy || !editTitle.trim() || !editBody.trim()}
              className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-40"
            >
              {editingBusy ? '저장 중...' : '수정 저장'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 제안 이유·배경 — 법안 본문 위, 구분선 포함 */}
          {status === 'discussion' && (() => {
            const td = bill.templateData || {}
            // background(역할중심), rebuttal 포함 구버전, proposalReason 등 여러 키 시도
            const background = td.background || td.proposalReason || td.reason || ''
            if (!background.trim()) return null
            return (
              <>
                <div className="bg-sky-50 rounded-lg px-3 py-2 text-xs text-sky-900 leading-relaxed">
                  <span className="font-black text-sky-700 mr-1.5">📌 제안 이유</span>
                  {background.trim()}
                </div>
                <hr className="border-slate-200" />
              </>
            )
          })()}
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{billBody}</p>
          {/* 관련 자료 링크 — 법안 본문 아래, 구분선 포함 */}
          {status === 'discussion' && (() => {
            const researchItems = Object.values(researchPlan.items || researchPlan.refs || researchPlan || {})
              .filter((item) => item && typeof item === 'object' && (item.title || item.url))
            if (!researchItems.length) return null
            return (
              <>
                <hr className="border-slate-200" />
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] font-black text-slate-400 self-center">🔗 관련 자료</span>
                  {researchItems.map((item, i) => (
                    item.url ? (
                      <a key={i} href={item.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-sky-700 hover:bg-sky-100 border border-slate-200 font-medium max-w-[200px] truncate"
                        title={item.title || item.url}
                      >
                        {item.title || item.url}
                      </a>
                    ) : (
                      <span key={i}
                        className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium max-w-[200px] truncate"
                        title={item.title}
                      >
                        {item.title}
                      </span>
                    )
                  ))}
                </div>
              </>
            )
          })()}
        </>
      )}

      {/* === 토의 단계 (discussion) === */}
      {status === 'discussion' && (
        <>
          {/* 다축 평점 평균 패널 */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-bold text-amber-800">📊 다축 평가 평균</p>
              <p className="text-[10px] text-gray-500">
                {billScore ? `${billScore.n}명 평가` : '아직 평가 없음'}
              </p>
            </div>
            {billScore ? (
              <>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <ScoreBar label="🏛️ 공익" value={billScore.relevance} color="bg-rose-500" />
                  <ScoreBar label="🛠️ 실행" value={billScore.feasibility} color="bg-emerald-500" />
                  <ScoreBar label="⚖️ 타당" value={billScore.logic} color="bg-amber-500" />
                </div>
                <div className="flex items-baseline justify-end gap-1 pt-1 border-t border-amber-200">
                  <span className="text-[10px] text-gray-500">종합</span>
                  <span className="text-base font-black text-amber-900 tabular-nums">
                    {billScore.overall.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-gray-500">/ 3.00</span>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-gray-400 italic text-center py-1">
                아래 댓글창에서 별점을 매기면 평균이 표시됩니다
              </p>
            )}
          </div>

          {/* 추천 카운트 — previewMode 면 액션 비활성, 카운트만 표시 */}
          <div className="flex items-center gap-2">
            {previewMode ? (
              <div className="flex-1 py-2 text-sm rounded-lg bg-amber-50 text-amber-800 text-center font-semibold">
                👍 추천 카운트 (학생만 클릭 가능)
              </div>
            ) : (
              <button
                onClick={toggleRecommend}
                disabled={role !== 'student' || isOwnGroupBill || toggling}
                className={`flex-1 py-2 text-sm rounded-lg font-semibold transition ${
                  myPref
                    ? 'bg-amber-500 text-white shadow'
                    : isOwnGroupBill
                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
                title={isOwnGroupBill ? '내 모둠 법안은 추천할 수 없어요' : ''}
              >
                {myPref ? '✅ 추천했어요' : '👍 이 법안 추천'}
                {isOwnGroupBill && ' (내 모둠)'}
              </button>
            )}
            <span className="text-sm font-bold text-amber-700 tabular-nums w-16 text-right">
              ★ {prefCount}
            </span>
          </div>

          {canStudentManage && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-bold text-indigo-800">
                  우리 모둠 법안 관리
                </p>
                {hasTablingRequest ? (
                  <span className="text-[11px] text-indigo-700">
                    선생님 검토 대기 중
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    수정·삭제 후 상정 요청 가능
                  </span>
                )}
              </div>
              {hasTablingRequest ? (
                <button
                  type="button"
                  onClick={cancelTablingRequest}
                  className="w-full py-2 text-xs rounded-lg bg-white border border-indigo-300 text-indigo-700 font-bold hover:bg-indigo-100"
                >
                  상정 요청 취소하고 수정/삭제하기
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={requestTabling}
                    className="py-2 text-xs rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                  >
                    상정 요청
                  </button>
                  <button
                    type="button"
                    onClick={startEditingOwnBill}
                    className="py-2 text-xs rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                  >
                    법안 수정
                  </button>
                  <button
                    type="button"
                    onClick={removeBill}
                    className="py-2 text-xs rounded-lg bg-white border border-rose-200 text-rose-700 font-bold hover:bg-rose-50"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          )}

          {role === 'teacher' && !previewMode && (
            <div className="space-y-1">
              <button
                onClick={toggleTeacherRecommendation}
                className={`w-full py-2 text-xs rounded-lg font-bold border transition ${
                  isTeacherRecommended
                    ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-white'
                    : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'
                }`}
              >
                {isTeacherRecommended ? '교사 추천 취소' : '교사 추천 표시'}
              </button>
              {rank === 1 && (
                <p className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 text-center font-semibold">
                  🥇 가장 높은 점수 — 이 법안을 정식 상정 추천!
                </p>
              )}
              <button
                onClick={tableThisBill}
                className={`w-full py-2.5 text-sm rounded-lg font-bold transition shadow ${
                  rank === 1
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-4 ring-indigo-300 animate-pulse'
                    : 'bg-indigo-500 text-white hover:bg-indigo-600'
                }`}
              >
                ✓ 이 법안을 정식 상정 → 본회의 표결 시작
              </button>
            </div>
          )}

          {/* 댓글·평가 — 직접 노출 (CommentList 내부에 자체 페이지네이션 있음) */}
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-slate-700 mb-1.5">
              💬 댓글·평가 ({billComments.length}건)
            </p>
            {/* 본인 모둠 법안이면 안내 */}
            {role === 'student' && isOwnGroupBill && !previewMode && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
                💡 내 모둠 법안에는 댓글·평가를 남길 수 없어요. 다른 모둠 친구들이 의견을 줄 거예요.
              </p>
            )}
            <CommentList
              targetType="bill"
              targetId={bill.id}
              targetGroupId={bill.proposerGroupId}
              readOnly={previewMode}
              allowReplies
            />
          </div>
        </>
      )}

      {/* === 정식 상정 (tabled) — 발표 후에도 전광판 켜져 있는 동안 유지 === */}
      {(status === 'tabled' || (bill.voteResult && billBoardActive)) && (
        <>
          {/* 학생용: 제안이유 → 관련자료 → 구분선 → 전광판 안내 */}
          {role === 'student' && !previewMode && (() => {
            const td = bill.templateData || {}
            const background = td.background || td.proposalReason || td.reason || ''
            const researchItems = Object.values(researchPlan.items || researchPlan.refs || researchPlan || {})
              .filter((item) => item && typeof item === 'object' && (item.title || item.url))
            return (
              <div className="space-y-2">
                {/* 제안 이유 */}
                {background && (
                  <div className="bg-sky-50 rounded-lg px-3 py-2 text-xs text-sky-900 leading-relaxed">
                    <span className="font-black text-sky-700 mr-1.5">📌 제안 이유</span>{background.trim()}
                  </div>
                )}
                {/* 관련 자료 */}
                {researchItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-black text-slate-400 self-center">🔗 관련 자료</span>
                    {researchItems.map((item, i) => (
                      item.url ? (
                        <a key={i} href={item.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-sky-700 hover:bg-sky-100 border border-slate-200 font-medium max-w-[200px] truncate"
                          title={item.title || item.url}
                        >
                          {item.title || item.url}
                        </a>
                      ) : (
                        <span key={i}
                          className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium max-w-[200px] truncate"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                      )
                    ))}
                  </div>
                )}
                {/* 구분선 */}
                <hr className="border-slate-200" />
                {/* 전광판 안내 / 표결 버튼 */}
                {billBoardActive ? (
                  <div className="space-y-2">
                    {myFinalChoice ? (
                      <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-black px-3 py-1.5 rounded-lg text-center animate-fade-in flex items-center justify-center gap-1.5 shadow-sm">
                        <span>✓ 표결 완료 (변경 불가)</span>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-black px-3 py-1.5 rounded-lg text-center shadow-2xs">
                        ⚠️ 표결 제출 후에는 선택을 변경할 수 없습니다. 신중히 결정해 주세요.
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        type="button"
                        onClick={() => castFinalVote('pro')}
                        disabled={!!myFinalChoice}
                        className={`py-2.5 text-sm rounded-lg font-bold transition active:scale-95 disabled:pointer-events-none ${
                          myFinalChoice === 'pro' 
                            ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-300' 
                            : myFinalChoice 
                            ? 'bg-gray-155 text-gray-400 opacity-60' 
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        ✅ 찬성
                      </button>
                      <button 
                        type="button"
                        onClick={() => castFinalVote('con')}
                        disabled={!!myFinalChoice}
                        className={`py-2.5 text-sm rounded-lg font-bold transition active:scale-95 disabled:pointer-events-none ${
                          myFinalChoice === 'con' 
                            ? 'bg-rose-600 text-white shadow ring-2 ring-rose-300' 
                            : myFinalChoice 
                            ? 'bg-gray-155 text-gray-400 opacity-60' 
                            : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        ❌ 반대
                      </button>
                      <button 
                        type="button"
                        onClick={() => castFinalVote('abstain')}
                        disabled={!!myFinalChoice}
                        className={`py-2.5 text-sm rounded-lg font-bold transition active:scale-95 disabled:pointer-events-none ${
                          myFinalChoice === 'abstain' 
                            ? 'bg-gray-600 text-white shadow ring-2 ring-gray-400' 
                            : myFinalChoice 
                            ? 'bg-gray-155 text-gray-400 opacity-60' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        ⚪ 기권
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-lg p-3 text-center text-sm text-amber-900 font-semibold">
                    🎬 선생님이 전광판을 띄우면 표결할 수 있어요
                  </div>
                )}
              </div>
            )
          })()}

          {/* 진행 게이지 (학생/교사 공용) */}
          {finalTally.total > 0 && (
            <div className="pt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700">찬성 {finalTally.pro}</span>
                <span className="text-rose-700">반대 {finalTally.con}</span>
                <span className="text-gray-600">기권 {finalTally.abstain}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500" style={{ width: `${(finalTally.pro / finalTally.total) * 100}%` }} />
                <div className="bg-rose-500"    style={{ width: `${(finalTally.con / finalTally.total) * 100}%` }} />
                <div className="bg-gray-400"    style={{ width: `${(finalTally.abstain / finalTally.total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* 교사 컨트롤 — previewMode 면 숨김 */}
          {role === 'teacher' && !previewMode && (
            <div className="space-y-2 pt-2 border-t">
              {!billBoardActive && finalTally.total === 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-center font-semibold">
                  👇 이제 전광판을 띄워 학생들이 표결할 수 있게 하세요
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
              <button
                onClick={toggleBoard}
                className={`flex-1 py-2.5 text-sm rounded-lg font-bold transition shadow ${
                  billBoardActive
                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                    : 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse ring-4 ring-amber-200'
                }`}
              >
                {billBoardActive ? '🎬 전광판 끄기 (표결 정지)' : '🎬 전광판 띄우기 (표결 시작)'}
              </button>
              {bill.voteResult ? (
                /* 발표 후 → 표결 마감(전광판 끄기) */
                <button
                  onClick={closeBoard}
                  className="flex-1 py-2 text-sm rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 ring-2 ring-emerald-300 animate-pulse shadow"
                >
                  ✓ 표결 마감 (전광판 끄기)
                </button>
              ) : (
                /* 발표 전 → 결과 발표 */
                <button
                  onClick={announceResult}
                  disabled={finalTally.total === 0}
                  className="flex-1 py-2 text-sm rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700"
                >
                  🗳️ 표결 발표 (결과 전광판에)
                </button>
              )}
              <button
                onClick={untableBack}
                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                title="토의 단계로 되돌리기"
              >
                상정 취소
              </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* === 결과 (passed/rejected) === */}
      {(status === 'passed' || status === 'rejected') && bill.voteResult && (
        <div className={`pt-2 border-t space-y-1 ${
          status === 'passed' ? 'text-emerald-800' : 'text-rose-800'
        }`}>
          <p className="text-sm font-bold">
            {status === 'passed' ? '✅ 가결' : '❌ 부결'}
          </p>
          <p className="text-xs">
            찬성 {bill.voteResult.pro} / 반대 {bill.voteResult.con} / 기권 {bill.voteResult.abstain}
            {' · '}총 {bill.voteResult.total}명 ({(bill.voteResult.pro / Math.max(1, bill.voteResult.total) * 100).toFixed(0)}% 찬성)
          </p>
        </div>
      )}

      {/* 정식상정·결과 단계에서는 댓글 펼침 토글 유지 */}
      {(status === 'tabled' || status === 'passed' || status === 'rejected') && (
        <details className="pt-2 border-t">
          <summary className="text-xs text-slate-700 hover:text-slate-900 cursor-pointer">
            💬 댓글·토론 펼치기 ▼
          </summary>
          <div className="pt-2">
            <CommentList
              targetType="bill"
              targetId={bill.id}
              targetGroupId={bill.proposerGroupId}
            />
          </div>
        </details>
      )}
    </article>
  )
}

/** 다축 평점 막대 — 0~3 범위 */
function ScoreBar({ label, value, color }) {
  const pct = Math.max(0, Math.min(100, (Number(value) || 0) / 3 * 100))
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{label}</span>
        <span className="font-mono tabular-nums text-gray-600">{(Number(value) || 0).toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-white rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default BillCard
