import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import { isNewsBoardPollResultVisible } from '../../lib/poll-visibility'

const getText = (value) =>
  typeof value === 'string' ? value : value?.label || value?.id || ''

const normalizeOptions = (rawOptions = []) =>
  (rawOptions || []).map((option, index) => {
    if (typeof option === 'string') {
      return { id: `opt_${index}`, label: option }
    }
    if (option && typeof option === 'object') {
      return {
        id: option.id || `opt_${index}`,
        label: getText(option.label || option),
      }
    }
    return { id: `opt_${index}`, label: String(option || '') }
  })

/**
 * 학생용 — 활성 여론조사 응답 + 게시된 결과 보기
 * Phase별 화면 어디든 끼워 넣을 수 있다.
 */
function PollFeed({ filterTag, targetPollId, statusFilter, plannedOnly, newsBoardMode, previewMode = false }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const roomData = useGameStore((s) => s.roomData)
  const config = useGameStore((s) => s.config)
  const wf = useWorkflow()

  const [pollsMap, setPollsMap] = useState({})
  const [tempSelections, setTempSelections] = useState({}) // { pollId: optionId }
  const [tempReasons, setTempReasons] = useState({}) // { pollId: string }
  const [editingPolls, setEditingPolls] = useState(new Set())
  const [busyPolls, setBusyPolls] = useState(new Set())

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'polls', (d) => setPollsMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const polls = useMemo(() => {
    let arr = Object.entries(pollsMap).map(([id, p]) => ({ id, ...p }))

    if (newsBoardMode) {
      arr = arr.filter((p) => isNewsBoardPollResultVisible(p, currentPhase, roomData))
      // 선택지·질문이 없거나 총 투표수가 0인 여론조사는 게시하지 않음
      arr = arr.filter((p) => {
        const hasOptions  = (p.options || []).length > 0
        const hasQuestion = !!p.question
        const totalVotes  = Object.keys(p.votes || {}).length
        return hasOptions && hasQuestion && totalVotes > 0
      })
    } else if (role === 'teacher' && !previewMode) {
      // [Antigravity] 선생님은 여론판에서 '종료된(게시된)' 결과만 본다
      arr = arr.filter(p => p.status === 'published')
    } else {
      if (statusFilter) {
        arr = arr.filter((p) => statusFilter.includes(p.status))
      } else if (newsBoardMode) {
        arr = arr.filter((p) => (p.status === 'voting' || p.status === 'published'))
      } else {
        arr = arr.filter((p) => p.status === 'voting' || p.status === 'published')
      }
    }

    if (plannedOnly) {
      arr = arr.filter((p) => !!p.phaseStep && p.phaseStep.phase === currentPhase)
      const currentStepId = wf.currentStep?.id
      if (currentStepId) {
        arr = arr.filter((p) => p.phaseStep?.stepId === currentStepId)
      }
    }
    if (targetPollId) arr = arr.filter((p) => p.id === targetPollId)
    if (filterTag) arr = arr.filter((p) => p.tag === filterTag)
    return arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [pollsMap, filterTag, targetPollId, plannedOnly, newsBoardMode, currentPhase, roomData, wf.currentStep?.id, role, previewMode, statusFilter])

  const onVote = async (pollId, optionId, reason = '') => {
    if (!myStudentId) return
    setBusyPolls((prev) => new Set([...prev, pollId]))
    try {
      await setAt(roomCode, `polls/${pollId}/votes/${myStudentId}`, {
        optionId,
        reason: reason.trim(),
        at: Date.now(),
      })
      setEditingPolls((prev) => {
        const next = new Set(prev)
        next.delete(pollId)
        return next
      })
    } finally {
      setBusyPolls((prev) => {
        const next = new Set(prev)
        next.delete(pollId)
        return next
      })
    }
  }

  if (polls.length === 0) return null

  const compact = newsBoardMode

  return (
    <section className={compact ? 'grid grid-cols-2 gap-2' : 'space-y-4'}>
      {polls.map((poll) => {
        const normalizedOptions = normalizeOptions(poll.options || [])
        const myVoteData = poll.votes?.[myStudentId]
        const myVote = myVoteData?.optionId
        const myReason = myVoteData?.reason || ''
        const totalVotes = Object.keys(poll.votes || {}).length
        const counts = {}
        const reasonsByOption = {}

        for (const v of Object.values(poll.votes || {})) {
          if (v?.optionId) {
            counts[v.optionId] = (counts[v.optionId] || 0) + 1
            if (v.reason) {
              if (!reasonsByOption[v.optionId]) reasonsByOption[v.optionId] = []
              reasonsByOption[v.optionId].push(v.reason)
            }
          }
        }

        const showResults = poll.status === 'published' || poll.status === 'ended'
        const isEditing = editingPolls.has(poll.id)
        const sortedOptions = showResults
            ? [...normalizedOptions]
                .map((o) => ({ ...o, count: counts[o.id] || 0 }))
                .sort((a, b) => b.count - a.count)
            : normalizedOptions

        return (
          <div
            key={poll.id}
            className={`rounded-xl border-2 shadow-sm transition-all ${
              compact ? 'p-3' : 'p-5'
            } ${
              poll.status === 'voting'
                ? 'bg-white border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <header className={compact ? 'mb-2' : 'mb-4'}>
              {!compact && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                    {getText(poll.tag)}
                  </span>
                  {poll.allowReason && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                      ✍️ 이유 쓰기 포함
                    </span>
                  )}
                </div>
              )}
              <h3 className={`font-black leading-tight text-gray-900 ${compact ? 'text-xs' : 'text-lg'}`}>
                {getText(poll.question).replace(/우리 동네/g, config?.countryName || '우리 반')}
              </h3>
              {compact && (
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">총 {totalVotes}표</p>
              )}
            </header>

            <ul className={compact ? 'space-y-1' : 'space-y-2'}>
              {sortedOptions.map((o, idx) => {
                const count = counts[o.id] || 0
                const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0
                const currentTemp = tempSelections[poll.id] || myVote
                const isSelected = currentTemp === o.id
                const isFinal = myVote === o.id && !isEditing

                if (showResults) {
                  return (
                    <li key={o.id} className={compact ? '' : 'space-y-2'}>
                      <div className="relative bg-white rounded-lg border border-emerald-100 overflow-hidden shadow-sm">
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-100/50 transition-all duration-1000"
                          style={{ width: `${pct}%` }}
                        />
                        <div className={`relative flex justify-between items-center ${compact ? 'px-2 py-1.5' : 'px-4 py-3'} text-sm`}>
                          <span className={`font-bold text-gray-800 ${compact ? 'text-[11px]' : ''}`}>
                            {idx === 0 && totalVotes > 0 && '👑 '}
                            {getText(o.label).replace(/우리 동네/g, config?.countryName || '우리 반')}
                          </span>
                          <span className={`font-mono font-black text-emerald-700 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                            {compact ? `${pct}%` : `${count}표 (${pct}%)`}
                          </span>
                        </div>
                      </div>

                      {/* 이유 목록 표시 — 컴팩트 모드에서는 생략 */}
                      {!compact && poll.allowReason && reasonsByOption[o.id]?.length > 0 && (
                        <div className="pl-4 space-y-1">
                          {reasonsByOption[o.id].map((r, i) => (
                            <div key={i} className="text-[11px] text-gray-500 bg-white/50 px-3 py-1.5 rounded-lg border border-emerald-50 italic">
                              " {r} "
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                }

                return (
                  <li key={o.id}>
                    <button
                      onClick={() => (isEditing || !myVote) && setTempSelections({ ...tempSelections, [poll.id]: o.id })}
                      disabled={busyPolls.has(poll.id) || (!isEditing && !!myVote)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                        isSelected
                          ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-md translate-x-1'
                          : 'bg-white border-gray-100 text-gray-600 hover:border-amber-200'
                      } ${(!isEditing && !!myVote) ? 'opacity-80 cursor-default' : ''}`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{getText(o.label).replace(/우리 동네/g, config?.countryName || '우리 반')}</span>
                        {isFinal && <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-full font-black">내 선택</span>}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>

            {poll.status === 'voting' && (
              <div className="mt-6 space-y-3">
                {/* 이유 입력칸 — tempSelections[poll.id]으로 scope 안전하게 체크 */}
                {poll.allowReason && (!!tempSelections[poll.id] || !myVote || isEditing) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-800 ml-1">
                      선택한 이유를 적어주세요
                      {poll.requireReason
                        ? <span className="ml-1 text-rose-600 font-semibold">(필수)</span>
                        : <span className="ml-1 text-amber-500 font-normal">(생략 가능)</span>
                      }
                    </label>
                    <textarea
                      value={tempReasons[poll.id] !== undefined ? tempReasons[poll.id] : (isEditing ? myReason : '')}
                      onChange={(e) => setTempReasons({ ...tempReasons, [poll.id]: e.target.value })}
                      disabled={!!myVote && !isEditing}
                      placeholder="왜 이 항목을 선택했나요? 이유나 근거를 자유롭게 써 주세요."
                      className="w-full px-4 py-3 rounded-xl border-2 border-amber-100 text-sm focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all resize-none"
                      rows={2}
                    />
                  </div>
                )}

                {!myVote || editingPolls.has(poll.id) ? (
                  <button
                    onClick={() => onVote(poll.id, tempSelections[poll.id] || myVote, tempReasons[poll.id] !== undefined ? tempReasons[poll.id] : (isEditing ? myReason : ''))}
                    disabled={
                      busyPolls.has(poll.id) ||
                      !(tempSelections[poll.id] || myVote) ||
                      (poll.requireReason && !(tempReasons[poll.id] ?? (isEditing ? myReason : '')).trim())
                    }
                    className="w-full py-4 rounded-2xl bg-amber-600 text-white font-black hover:bg-amber-700 disabled:opacity-50 shadow-lg shadow-amber-100 transition-all active:scale-[0.98]"
                  >
                    {busyPolls.has(poll.id) ? '제출 중...' : isEditing ? '수정 내용 제출하기' : '여론조사 참여하기'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingPolls(new Set([...editingPolls, poll.id]))
                      setTempSelections({ ...tempSelections, [poll.id]: myVote })
                      setTempReasons({ ...tempReasons, [poll.id]: myReason })
                    }}
                    className="w-full py-3 rounded-2xl border-2 border-amber-200 text-amber-700 font-bold hover:bg-amber-50 transition-all text-sm"
                  >
                    내 선택 수정하기
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

export default PollFeed
