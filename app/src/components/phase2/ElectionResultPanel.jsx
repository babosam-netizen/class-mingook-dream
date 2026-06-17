import useGameStore from '../../store/gameStore'
import { topicBg } from '../../styles/tokens'
import { roleForRank } from '../../lib/election'

const EMPTY_CANDIDATES = {}

/**
 * 선거 결과 패널 — electionStatus === 'ended' 일 때 표시.
 *
 * props:
 *   ranks: [{ groupId, count, rank }] — 득표 순
 *   totalVotes: number
 */
function ElectionResultPanel({ ranks, totalVotes }) {
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const candidatesRaw = useGameStore((s) => s.roomData?.candidates)
  const candidates = candidatesRaw || EMPTY_CANDIDATES
  const electionRoles = config?.electionRoles

  if (!ranks || ranks.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow text-center text-gray-400">
        결과가 아직 없습니다.
      </div>
    )
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-rose-800">🏆 선거 결과</h2>
        <span className="text-xs text-gray-500">총 {totalVotes}표</span>
      </header>

      <ol className="space-y-2">
        {ranks.map((r) => {
          const g = groups[r.groupId]
          const topicMeta = config?.topics?.[g?.topic]
          const color = topicMeta?.color || g?.color
          const pct = totalVotes ? Math.round((r.count / totalVotes) * 100) : 0
          const role = roleForRank(r.rank, electionRoles)
          const cand = candidates[r.groupId]
          return (
            <li
              key={r.groupId}
              className={`p-3 rounded-xl border-2 ${topicBg(color)}`}
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl font-bold text-rose-700">
                    {r.rank}위
                  </span>
                  <h3 className="font-bold">{g?.name || r.groupId}</h3>
                  {role && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-600 text-white font-semibold">
                      {role.emoji} {role.label}
                    </span>
                  )}
                </div>
                <span className="text-sm tabular-nums">
                  {r.count}표 · {pct}%
                </span>
              </div>
              {cand && role && (
                <p className="mt-1 text-xs text-rose-800">
                  → <strong>{cand.leaderNumber}번 {cand.leaderNickname}</strong> 학생이 {role.label}직을 맡습니다
                </p>
              )}
              <div className="mt-2 h-2 bg-white/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default ElectionResultPanel
