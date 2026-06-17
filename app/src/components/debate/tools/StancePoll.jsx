import { useMemo, useState } from 'react'
import useGameStore from '../../../store/gameStore'
import { setAt, updateAt } from '../../../lib/rtdb-helpers'

const getText = (value) =>
  typeof value === 'string' ? value : value?.label || value?.id || ''

const STANCE_COLOR = {
  '찬성': 'bg-emerald-500',
  '반대': 'bg-rose-500',
  '중립': 'bg-slate-400',
  '검사 측': 'bg-amber-500',
  '변호/피고 측': 'bg-sky-500',
  '배심원 관점': 'bg-violet-500',
  '판단 유보': 'bg-slate-400',
  'A팀': 'bg-emerald-500',
  'B팀': 'bg-blue-500',
  '판정단': 'bg-violet-500',
  '평가단': 'bg-violet-500',
  '중립/관찰': 'bg-slate-400',
  '제안측': 'bg-blue-500',
  '조율측': 'bg-indigo-500',
  '수정 제안': 'bg-amber-500',
  '합의 가능': 'bg-emerald-500',
  '보류/우려': 'bg-rose-500',
}
const STANCE_BG = {
  '찬성': 'bg-emerald-50 text-emerald-700 border-emerald-300',
  '반대': 'bg-rose-50 text-rose-700 border-rose-300',
  '중립': 'bg-slate-50 text-slate-700 border-slate-300',
  '검사 측': 'bg-amber-50 text-amber-700 border-amber-300',
  '변호/피고 측': 'bg-sky-50 text-sky-700 border-sky-300',
  '배심원 관점': 'bg-violet-50 text-violet-700 border-violet-300',
  '판단 유보': 'bg-slate-50 text-slate-700 border-slate-300',
  'A팀': 'bg-emerald-50 text-emerald-700 border-emerald-300',
  'B팀': 'bg-blue-50 text-blue-700 border-blue-300',
  '판정단': 'bg-violet-50 text-violet-700 border-violet-300',
  '평가단': 'bg-violet-50 text-violet-700 border-violet-300',
  '중립/관찰': 'bg-slate-50 text-slate-700 border-slate-300',
  '제안측': 'bg-blue-50 text-blue-700 border-blue-300',
  '조율측': 'bg-indigo-50 text-indigo-700 border-indigo-300',
  '수정 제안': 'bg-amber-50 text-amber-700 border-amber-300',
  '합의 가능': 'bg-emerald-50 text-emerald-700 border-emerald-300',
  '보류/우려': 'bg-rose-50 text-rose-700 border-rose-300',
}

/**
 * 토론 전/후 공용 입장 여론조사 (학생용).
 * - poll.type: 'pre' | 'post'
 * - 변경 불가(allowChange=false): 한 번 제출하면 수정 불가
 *
 * @param {{session, pollId: 'pre'|'post', poll}} props
 *   session: { id, topic, ... }
 *   poll:    { question, options, isOpen, type, votes }
 */
function StancePoll({ session, pollId, poll, prePoll }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const studentsCount = Object.keys(useGameStore((s) => s.students) || {}).length || 0
  const [picking, setPicking] = useState(null)
  const [preVoteReason, setPreVoteReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonSaved, setReasonSaved] = useState(false)
  const [reasonBusy, setReasonBusy] = useState(false)

  if (!session || !poll) return null

  const votes = poll.votes || {}
  const myVote = myStudentId ? votes[myStudentId]?.option || null : null
  const submittedCount = Object.keys(votes).length

  // post 폴 옵션은 항상 pre 폴과 동일하게 유지 (교사가 pre 폴 수정 시 동기화)
  const options = useMemo(() => {
    if (pollId === 'post' && Array.isArray(prePoll?.options) && prePoll.options.length) {
      return prePoll.options.map((option) => getText(option)).filter(Boolean)
    }
    const base = Array.isArray(poll.options) && poll.options.length ? poll.options : ['찬성', '반대', '중립']
    return base.map((option) => getText(option)).filter(Boolean)
  }, [poll.options, pollId, prePoll?.options])
  const isStudent = role === 'student'

  // 투표 후 저장된 이유 초기화
  const savedReason = myStudentId ? votes[myStudentId]?.reason || '' : ''
  const [reasonInitialized, setReasonInitialized] = useState(false)
  if (!reasonInitialized && savedReason) {
    setReason(savedReason)
    setReasonInitialized(true)
  }

  // 집계
  const counts = useMemo(() => {
    const m = {}
    for (const o of options) m[o] = 0
    for (const v of Object.values(votes)) {
      if (v?.option && m[v.option] !== undefined) m[v.option] += 1
      else if (v?.option) m[v.option] = (m[v.option] || 0) + 1
    }
    return m
  }, [votes, options])

  const total = Object.values(counts).reduce((a, n) => a + n, 0)

  const submit = async () => {
    if (!picking || !myStudentId || !isStudent || busy) return
    setBusy(true)
    try {
      await setAt(
        roomCode,
        `debateSessions/${session.id}/stancePoll/${pollId}/votes/${myStudentId}`,
        {
          option: picking,
          votedAt: Date.now(),
          ...(pollId === 'post' && preVoteReason.trim() ? { reason: preVoteReason.trim() } : {}),
        },
      )
      if (pollId === 'post' && preVoteReason.trim()) {
        setReason(preVoteReason.trim())
        setReasonSaved(true)
      }
    } finally {
      setBusy(false)
    }
  }

  const saveReason = async () => {
    if (!myStudentId || !session?.id || reasonBusy) return
    setReasonBusy(true)
    try {
      await updateAt(
        roomCode,
        `debateSessions/${session.id}/stancePoll/${pollId}/votes/${myStudentId}`,
        { reason: reason.trim(), reasonSavedAt: Date.now() },
      )
      setReasonSaved(true)
    } finally {
      setReasonBusy(false)
    }
  }

  // 사전 여론조사에서 내 선택
  const myPreVote = pollId === 'post' && prePoll && myStudentId
    ? prePoll.votes?.[myStudentId]?.option || null
    : null

  // 닫혀있을 때
  if (!poll.isOpen) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed p-4 text-center text-sm text-gray-400">
        선생님이 여론조사를 열면 투표할 수 있어요.
      </div>
    )
  }

  // 결과 표시 (이미 투표 or 교사)
  const showResults = !!myVote || role === 'teacher'

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm p-4 space-y-3">
      <div>
        <p className="text-[11px] font-bold text-indigo-700">
          {pollId === 'pre' ? '🗳️ 토론 전 여론조사' : '🗳️ 토론 후 여론조사'}
        </p>
        <p className="text-sm font-semibold text-gray-800">{poll.question || '이 논제에 대한 여러분의 입장은?'}</p>
      </div>

      {/* 투표 영역 (학생, 미투표) */}
      {isStudent && !myVote && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {options.map((o) => {
              const active = picking === o
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setPicking(o)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${
                    active
                      ? `${STANCE_BG[o] || 'bg-indigo-50 text-indigo-700 border-indigo-400'} ring-2 ring-offset-1 ring-indigo-400`
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {o}
                </button>
              )
            })}
          </div>

          {/* 토론 후 여론조사: 이유 입력 (입장 선택 후 표시) */}
          {pollId === 'post' && picking && (
            <div className="space-y-1.5 bg-indigo-50 rounded-xl p-3">
              <label className="text-[11px] font-bold text-indigo-700">
                ✍️ 이 입장을 선택한 이유를 적어주세요
              </label>
              <textarea
                value={preVoteReason}
                onChange={(e) => setPreVoteReason(e.target.value)}
                placeholder="토론 내용이 내 생각에 어떤 영향을 미쳤나요? 바뀌었다면 왜 바뀌었는지, 그대로라면 왜 그대로인지 적어주세요."
                rows={3}
                maxLength={300}
                className="w-full px-3 py-2 rounded-xl border-2 border-indigo-200 text-sm focus:outline-none focus:border-indigo-400 resize-none bg-white"
              />
              <p className="text-[10px] text-indigo-400 text-right">{preVoteReason.length}/300</p>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!picking || busy || (pollId === 'post' && !preVoteReason.trim())}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700"
          >
            {busy ? '제출 중...' : pollId === 'post' ? '입장 + 이유 제출 (변경 불가)' : '제출하기 (변경 불가)'}
          </button>
          {pollId === 'post' && picking && !preVoteReason.trim() && (
            <p className="text-[11px] text-amber-700 text-center">⚠️ 이유를 적어야 제출할 수 있습니다.</p>
          )}
        </div>
      )}

      {/* 결과 */}
      {showResults && (
        <div className="space-y-1.5 pt-2 border-t">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-gray-500">실시간 결과</p>
            <p className="text-[11px] text-gray-400">
              {submittedCount}/{studentsCount || '–'}명 참여
            </p>
          </div>
          {options.map((o) => {
            const c = counts[o] || 0
            const pct = total > 0 ? Math.round((c / total) * 100) : 0
            const mine = myVote === o
            return (
              <div key={o} className="space-y-0.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className={`font-semibold ${mine ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {o} {mine && <span className="text-[10px] text-indigo-600">· 내 선택</span>}
                  </span>
                  <span className="tabular-nums text-gray-500">{c}표 · {pct}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${STANCE_COLOR[o] || 'bg-indigo-400'} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {isStudent && myVote && (
            <p className="text-[10px] text-gray-400 text-center pt-1">
              한번 제출한 입장은 변경할 수 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 토론 후 전용: 전/후 비교 + 이유 */}
      {pollId === 'post' && isStudent && myVote && (
        <div className="border-t border-indigo-100 pt-3 space-y-3">
          {/* 전후 비교 */}
          <div className="bg-indigo-50 rounded-xl p-3 space-y-1">
            <p className="text-[11px] font-bold text-indigo-700">📊 내 선택 변화</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-center bg-white rounded-lg py-1.5 border border-indigo-100 font-semibold text-gray-700">
                {myPreVote ? (
                  <>
                    <span className="block text-[10px] text-gray-400 font-normal">토론 전</span>
                    {myPreVote}
                  </>
                ) : (
                  <span className="text-gray-300 text-xs">참여 안 함</span>
                )}
              </span>
              <span className="text-indigo-400 font-bold text-lg">→</span>
              <span className="flex-1 text-center bg-white rounded-lg py-1.5 border border-indigo-300 font-bold text-indigo-700">
                <span className="block text-[10px] text-indigo-400 font-normal">토론 후</span>
                {myVote}
              </span>
            </div>
            {myPreVote && myPreVote !== myVote && (
              <p className="text-[10px] text-emerald-600 text-center font-bold">
                🔄 토론을 통해 생각이 바뀌었어요!
              </p>
            )}
            {myPreVote && myPreVote === myVote && (
              <p className="text-[10px] text-gray-500 text-center">
                토론 전후 선택이 같습니다.
              </p>
            )}
          </div>

          {/* 이유 표시/수정 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-600">
              {myPreVote && myPreVote !== myVote
                ? '✍️ 생각이 바뀐 이유'
                : '✍️ 생각이 바뀌지 않은 이유'}
            </label>
            {reasonSaved && reason.trim() && (
              <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 whitespace-pre-wrap leading-relaxed">
                {reason}
              </p>
            )}
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonSaved(false) }}
              placeholder={myPreVote && myPreVote !== myVote
                ? '어떤 주장이나 근거가 마음을 바꾸게 했나요?'
                : '토론을 들어도 생각이 바뀌지 않은 이유는 무엇인가요?'}
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400 resize-none"
            />
            <button
              type="button"
              onClick={saveReason}
              disabled={reasonBusy || !reason.trim()}
              className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold disabled:opacity-40 transition"
            >
              {reasonBusy ? '저장 중...' : reasonSaved ? '✓ 이유 저장됨' : '이유 수정 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StancePoll
export { STANCE_COLOR, STANCE_BG }
