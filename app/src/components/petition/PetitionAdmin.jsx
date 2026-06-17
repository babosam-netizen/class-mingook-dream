import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, removeAt } from '../../lib/rtdb-helpers'
import { hashTagFrequency } from '../../store/petitionStore'

const DEFAULT_PREFIXES = ['환경', '노동', '주거', '인권', '교육', '안전', '기타']
const MAX_PREFIXES = 10

/**
 * 교사 대시보드용 청원 관리 패널.
 * 1) 말머리 관리
 * 2) 청원 수집 ON/OFF
 * 3) 자동 승인 토글
 * 4) 대기 청원 (pending)
 * 5) 전체 목록 (approved/rejected)
 * 6) 해시태그 통계
 */
function PetitionAdmin() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const config = useGameStore((s) => s.config)
  const updateConfig = useGameStore((s) => s.updateConfig)

  const petitionConfig = config?.petitionConfig || {}
  const prefixOptions = petitionConfig.prefixOptions?.length
    ? petitionConfig.prefixOptions
    : DEFAULT_PREFIXES
  const isOpen = petitionConfig.isOpen !== false
  const autoApprove = !!petitionConfig.autoApprove
  const maxHashTags = petitionConfig.maxHashTags || 3

  const [petitionsMap, setPetitionsMap] = useState({})
  const [newPrefix, setNewPrefix] = useState('')
  const [statusFilter, setStatusFilter] = useState('approved') // approved | rejected | all

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'petitions', (d) => setPetitionsMap(d || {}))
    return () => u?.()
  }, [roomCode])

  // (조기 반환은 모든 훅 호출 뒤에서 수행 — 훅 순서 안정 보장)

  const petitions = useMemo(() => {
    return Object.entries(petitionsMap)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [petitionsMap])

  const pending = petitions.filter((p) => p.status === 'pending')
  const approved = petitions.filter((p) => p.status === 'approved')
  const rejected = petitions.filter((p) => p.status === 'rejected')
  const counts = { pending: pending.length, approved: approved.length, rejected: rejected.length }

  const tagFreq = useMemo(() => hashTagFrequency(approved), [approved])

  const updatePetitionConfig = (partial) =>
    updateConfig({ petitionConfig: { ...petitionConfig, ...partial } })

  const setIsOpen = (v) => updatePetitionConfig({ isOpen: v })
  const setAutoApprove = (v) => updatePetitionConfig({ autoApprove: v })

  const addPrefix = () => {
    const v = newPrefix.trim()
    if (!v) return
    if (prefixOptions.includes(v)) return alert('이미 있는 말머리입니다.')
    if (prefixOptions.length >= MAX_PREFIXES) return alert(`말머리는 최대 ${MAX_PREFIXES}개까지만 추가할 수 있어요.`)
    updatePetitionConfig({ prefixOptions: [...prefixOptions, v] })
    setNewPrefix('')
  }

  const removePrefix = (p) => {
    if (!confirm(`'${p}' 말머리를 삭제할까요? 기존 청원의 말머리는 유지됩니다.`)) return
    updatePetitionConfig({ prefixOptions: prefixOptions.filter((x) => x !== p) })
  }

  const approve = (id) =>
    updateAt(roomCode, `petitions/${id}`, { status: 'approved', approvedAt: Date.now() })
  const reject = (id) => updateAt(roomCode, `petitions/${id}`, { status: 'rejected' })
  const restore = (id) => updateAt(roomCode, `petitions/${id}`, { status: 'pending' })
  const del = (id) => {
    if (!confirm('이 청원을 영구 삭제할까요?')) return
    removeAt(roomCode, `petitions/${id}`)
  }

  const statusList =
    statusFilter === 'all' ? [...approved, ...rejected].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    : statusFilter === 'approved' ? approved
    : rejected

  // 학생 화면에서는 표시하지 않음 (모든 훅 호출 뒤에 조기 반환)
  if (role !== 'teacher') return null

  return (
    <div className="space-y-5">
      {/* ① 말머리 관리 */}
      <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">
        <h3 className="font-bold text-amber-800">① 말머리 관리</h3>
        <p className="text-xs text-gray-500">
          학생이 청원 작성 시 선택할 수 있는 말머리 목록 (최대 {MAX_PREFIXES}개).
          삭제해도 기존 청원의 말머리 값은 유지되며, 필터에서만 사라집니다.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {prefixOptions.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800"
            >
              {p}
              <button onClick={() => removePrefix(p)} className="text-amber-500 hover:text-red-600">✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={newPrefix}
            onChange={(e) => setNewPrefix(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPrefix())}
            placeholder="새 말머리 (예: 교통)"
            maxLength={10}
            className="flex-1 px-3 py-1.5 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={addPrefix}
            disabled={prefixOptions.length >= MAX_PREFIXES || !newPrefix.trim()}
            className="px-3 py-1.5 text-sm rounded bg-amber-600 text-white font-semibold disabled:opacity-50 hover:bg-amber-700"
          >
            추가
          </button>
        </div>
      </section>

      {/* ② / ③ 토글 */}
      <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">
        <h3 className="font-bold text-amber-800">② 운영 옵션</h3>

        <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
          <div>
            <div className="text-sm font-semibold">청원 수집 활성화</div>
            <div className="text-xs text-gray-500">
              OFF 시 학생 폼 비활성. 게시판 읽기는 항상 가능.
            </div>
          </div>
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
            className="w-5 h-5 accent-amber-600"
          />
        </label>

        <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
          <div>
            <div className="text-sm font-semibold">자동 승인</div>
            <div className="text-xs text-gray-500">
              ON 시 학생 제출 즉시 게시. OFF 시 교사 승인 후 게시.
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="w-5 h-5 accent-amber-600"
          />
        </label>

        <label className="flex items-center justify-between gap-3 py-1.5">
          <div>
            <div className="text-sm font-semibold">최대 해시태그 수</div>
            <div className="text-xs text-gray-500">학생이 입력할 수 있는 해시태그 개수</div>
          </div>
          <input
            type="number"
            min={1}
            max={5}
            value={maxHashTags}
            onChange={(e) => updatePetitionConfig({ maxHashTags: Math.max(1, Math.min(5, Number(e.target.value) || 3)) })}
            className="w-16 px-2 py-1 text-sm rounded border border-gray-300 text-center"
          />
        </label>
      </section>

      {/* ④ 대기 청원 */}
      <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-bold text-amber-800">
            ③ 승인 대기 청원
            <span className="ml-2 text-sm font-normal text-amber-600">{counts.pending}건</span>
          </h3>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">대기 중인 청원이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">{p.prefixTag}</span>
                  {Array.isArray(p.hashTags) && p.hashTags.map((t) => (
                    <span key={t} className="text-[10px] text-amber-700">#{t}</span>
                  ))}
                  <span className="ml-auto text-[10px] text-gray-500">
                    {p.studentNumber ? `${p.studentNumber}번 ` : ''}{p.studentName}
                  </span>
                </div>
                <div className="font-bold">{p.title}</div>
                <p className="text-xs text-gray-600 mt-1"><b>주장:</b> {p.claim}</p>
                <p className="text-xs text-gray-600"><b>근거:</b> {p.evidence}</p>
                {p.mediaUrl && (
                  <a href={p.mediaUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 underline break-all">
                    {p.mediaUrl}
                  </a>
                )}
                {p.mediaSummary && <p className="text-[11px] italic text-gray-500">"{p.mediaSummary}"</p>}
                <div className="flex gap-1 mt-2 justify-end">
                  <button onClick={() => approve(p.id)} className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">승인</button>
                  <button onClick={() => reject(p.id)} className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200">반려</button>
                  <button onClick={() => del(p.id)} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">삭제</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ⑤ 전체 목록 */}
      <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h3 className="font-bold text-amber-800">④ 게시·반려 청원</h3>
          <div className="flex gap-1 text-xs">
            {[
              ['approved', `게시 ${counts.approved}`],
              ['rejected', `반려 ${counts.rejected}`],
              ['all', '전체'],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={`px-2 py-1 rounded ${
                  statusFilter === v ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {statusList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">표시할 청원이 없습니다.</p>
        ) : (
          <ul className="space-y-2 max-h-[400px] overflow-y-auto">
            {statusList.map((p) => (
              <li key={p.id} className="bg-white border rounded-lg p-2.5 text-sm">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {p.status === 'approved' ? '게시 중' : '반려됨'}
                  </span>
                  <span className="text-[10px] text-gray-500">{p.prefixTag}</span>
                  <span className="ml-auto text-[10px] text-gray-400">
                    ❤️ {p.likeCount || 0}
                  </span>
                </div>
                <div className="font-semibold text-sm">{p.title}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {p.studentNumber ? `${p.studentNumber}번 ` : ''}{p.studentName}
                  {p.groupName && ` · ${p.groupName}`}
                </div>
                <div className="flex gap-1 mt-1.5 justify-end">
                  {p.status === 'rejected' && (
                    <button onClick={() => approve(p.id)} className="px-2 py-0.5 text-[10px] bg-emerald-600 text-white rounded hover:bg-emerald-700">게시</button>
                  )}
                  {p.status === 'approved' && (
                    <button onClick={() => reject(p.id)} className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded hover:bg-amber-200">반려</button>
                  )}
                  <button onClick={() => restore(p.id)} className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200">대기로</button>
                  <button onClick={() => del(p.id)} className="px-2 py-0.5 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200">삭제</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ⑥ 해시태그 통계 */}
      {tagFreq.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">
          <h3 className="font-bold text-amber-800">⑤ 해시태그 통계</h3>
          <div className="flex flex-wrap gap-1.5">
            {tagFreq.map(({ tag, count }) => {
              const size = count >= 5 ? 'text-base' : count >= 3 ? 'text-sm' : 'text-xs'
              return (
                <span
                  key={tag}
                  className={`${size} px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200`}
                >
                  #{tag} <span className="text-[10px] text-amber-500">{count}</span>
                </span>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export default PetitionAdmin
