import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt, updateAt } from '../../lib/rtdb-helpers'

const DEFAULT_PREFIXES = ['환경', '노동', '주거', '인권', '교육', '안전', '기타']

/**
 * 1차 여론조사 — 국민청원 말머리 중 ‘가장 시급한 문제’ 단일 투표.
 * Phase 1 마지막에 활성. 투표 결과로 currentPhase 1 → 2 전환 시
 * coreIssue가 자동 잠긴다(교사가 페이즈 전환할 때 적용 — 일단 수동 잠금 버튼 제공).
 */
function CoreIssuePoll() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const coreIssue = useGameStore((s) => s.roomData?.coreIssue)
  const locked = !!coreIssue

  const [votes, setVotes] = useState({})
  const [petitions, setPetitions] = useState({})
  const [busy, setBusy] = useState(false)
  const [tempSelection, setTempSelection] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const unsubVotes = subscribe(roomCode, 'polls/coreIssue/votes', (data) =>
      setVotes(data || {}),
    )
    const unsubPetitions = subscribe(roomCode, 'petitions', (data) =>
      setPetitions(data || {}),
    )
    return () => {
      unsubVotes?.()
      unsubPetitions?.()
    }
  }, [roomCode])

  const myVote = myStudentId ? votes[myStudentId] : null

  // [Antigravity] 투표 데이터 로드 시 초기 선택값 설정
  useEffect(() => {
    if (myVote && !isEditing) {
      setTempSelection(myVote.optionId || myVote.groupId)
    }
  }, [myVote, isEditing])

  // [Antigravity] 국민청원에서 사용된 말머리들 추출
  const pollOptions = useMemo(() => {
    const configPrefixes = useGameStore.getState().config?.petitionConfig?.prefixOptions || DEFAULT_PREFIXES
    const usedPrefixes = Object.values(petitions).map(p => p.prefixTag).filter(Boolean)
    
    // 실제 사용된 말머리 + 설정된 기본 말머리들 (중복 제거)
    const combined = Array.from(new Set([...usedPrefixes, ...configPrefixes]))
    return combined.map(label => ({ id: label, label }))
  }, [petitions])

  const tally = useMemo(() => {
    const counts = {}
    for (const sid of Object.keys(votes)) {
      const oid = votes[sid]?.optionId || votes[sid]?.groupId
      if (!oid) continue
      counts[oid] = (counts[oid] || 0) + 1
    }
    const arr = Object.entries(counts).map(([oid, count]) => ({
      optionId: oid,
      count,
      label: oid,
    }))
    arr.sort((a, b) => b.count - a.count)
    return arr
  }, [votes])

  const totalVotes = Object.keys(votes).length

  const onVote = async (optionId) => {
    if (!myStudentId || locked) return
    setBusy(true)
    try {
      await setAt(roomCode, `polls/coreIssue/votes/${myStudentId}`, {
        optionId,
        at: Date.now(),
      })
    } finally {
      setBusy(false)
    }
  }

  const onLock = async (targetId) => {
    const label = targetId || (tally.length > 0 ? tally[0].label : null)
    if (!label) {
      alert('선정할 주제가 없습니다.')
      return
    }
    if (
      !window.confirm(
        `주제: ${label}\n\n이 결과를 ‘코어 이슈’로 확정하시겠어요? Phase 2 이후에는 이 주제를 중심으로 활동이 진행됩니다.`,
      )
    )
      return
    await updateAt(roomCode, '', { coreIssue: label })
  }

  const onUnlock = async () => {
    if (!window.confirm('확정된 코어 이슈를 해제하시겠어요? 다시 투표 결과를 기다리거나 다른 주제를 선택할 수 있습니다.')) return
    await updateAt(roomCode, '', { coreIssue: null })
  }

  const groupList = Object.entries(groups)

  if (groupList.length === 0) {
    return (
      <div className="bg-white p-4 rounded-2xl border text-sm text-gray-500 text-center">
        모둠이 결성되면 여론조사가 활성화됩니다.
      </div>
    )
  }

  return (
    <div className="bg-white p-4 rounded-2xl border-2 border-amber-300 shadow-sm">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-amber-800">📊 1차 여론조사 (사후 여론조사 1)</h3>
          <p className="text-xs text-gray-500">
            {locked ? '최우선 과제가 확정되었습니다.' : '가장 시급한 문제는 무엇인가요? — 결과에 상관없이 선생님이 최종 확정합니다.'}
          </p>
        </div>
        <span className="text-xs text-gray-500">
          참여 {totalVotes}명{locked && ' · 🔒 잠김'}
        </span>
      </div>

      <ul className="space-y-2">
        {pollOptions.map((opt) => {
          const count = tally.find((t) => t.optionId === opt.id)?.count || 0
          const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0
          const isSelected = tempSelection === opt.id
          const isFinal = (myVote?.optionId === opt.id || myVote?.groupId === opt.id) && !isEditing
          const isCore = coreIssue === opt.id

          return (
            <li key={opt.id} className="relative">
              <button
                onClick={() => {
                  if (locked) return
                  if (role === 'student' && (isEditing || !myVote)) setTempSelection(opt.id)
                  // [Antigravity] 교사는 클릭 시 즉시 확정 시도 (혹은 시각적 선택만 하고 확정 버튼 따로 두기 - 여기선 직관성을 위해 클릭 시 확정 유도)
                  if (role === 'teacher') onLock(opt.id)
                }}
                disabled={busy || (locked && !isCore) || (role === 'student' && !isEditing && !!myVote)}
                className={`w-full text-left p-2 rounded-lg border transition relative overflow-hidden ${
                  isCore
                    ? 'border-amber-600 bg-amber-50 ring-4 ring-amber-200'
                    : isSelected
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                    : 'border-gray-200 hover:border-amber-400'
                } ${role === 'teacher' && !locked ? 'hover:bg-amber-50 cursor-pointer' : ''} ${locked && !isCore ? 'opacity-40' : ''}`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-amber-100 transition-all pointer-events-none"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{opt.label}</span>
                    {isFinal && <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded-full font-bold">내 투표</span>}
                    {isCore && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-bold animate-bounce">🎯 최우선 과제</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {role === 'teacher' && !locked && (
                      <span className="text-[10px] text-amber-600 font-bold border border-amber-200 px-1.5 py-0.5 rounded bg-white">선정하기</span>
                    )}
                    <span className="text-xs text-gray-600 tabular-nums">
                      {count}표 · {pct}%
                    </span>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {/* 제출 / 수정 버튼 (학생 전용) */}
      {role === 'student' && !locked && (
        <div className="mt-4">
          {!myVote || isEditing ? (
            <button
              onClick={() => {
                if (tempSelection) {
                  onVote(tempSelection)
                  setIsEditing(false)
                }
              }}
              disabled={busy || !tempSelection}
              className="w-full py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-50 shadow-md transition"
            >
              {busy ? '제출 중...' : '투표 제출하기'}
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2 rounded-xl border-2 border-amber-500 text-amber-700 font-bold hover:bg-amber-50 transition"
            >
              투표 수정하기
            </button>
          )}
        </div>
      )}

      {/* 교사 전용 제어부 */}
      {role === 'teacher' && (
        <div className="mt-4 space-y-2">
          {!locked ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-[11px] text-amber-800 font-bold mb-2">👩‍🏫 교사 제어판</p>
              <p className="text-[10px] text-amber-700 mb-2">학생들의 투표 현황을 참고하여 위 목록에서 <strong>[선정하기]</strong>를 클릭하면 코어 이슈가 확정됩니다.</p>
              <button
                onClick={() => onLock()}
                disabled={tally.length === 0}
                className="w-full py-2 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-sm transition disabled:opacity-50"
              >
                🥇 1위 결과({tally[0]?.label})로 바로 확정하기
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="px-3 py-2 bg-indigo-50 border-2 border-indigo-200 text-indigo-700 rounded-xl text-sm font-bold flex items-center justify-between">
                <span>🎯 최우선 과제 확정: {coreIssue}</span>
                <span className="text-[10px] bg-indigo-200 px-2 py-0.5 rounded-full">LOCK</span>
              </div>
              <button
                onClick={onUnlock}
                className="w-full py-2 rounded-lg border-2 border-rose-200 text-rose-600 font-bold text-xs hover:bg-rose-50 transition"
              >
                🔓 확정 해제 (다시 선정하기)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CoreIssuePoll
