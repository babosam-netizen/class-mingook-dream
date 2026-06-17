import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { topicBg } from '../../styles/tokens'
import PosterMedia from '../phase1/PosterMedia'

/**
 * 페이즈 활동 요약 — 여론조사 단계에서 ‘이번 페이즈에 일어난 일’을 한 화면에.
 *
 * props:
 *   phase: 1 | 2 | 3
 *   tab?: 'legislative'|'executive'|'judicial'  (세 번째 여정일 때 어떤 부 활동 요약할지)
 */
function PhaseActivitySummary({ phase, tab }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)

  const [posters, setPosters] = useState({})
  const [comments, setComments] = useState({})
  const [bills, setBills] = useState({})
  const [policies, setPolicies] = useState({})
  const [verdicts, setVerdicts] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'posters', (d) => setPosters(d || {})),
      subscribe(roomCode, 'comments', (d) => setComments(d || {})),
      subscribe(roomCode, 'bills', (d) => setBills(d || {})),
      subscribe(roomCode, 'policies', (d) => setPolicies(d || {})),
      subscribe(roomCode, 'verdicts', (d) => setVerdicts(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  const groupTrust = useMemo(() => {
    const out = {}
    for (const gid of Object.keys(groups)) {
      const myPosters = Object.entries(posters)
        .filter(([, p]) => p?.groupId === gid)
        .map(([id]) => id)
      const my = Object.values(comments).filter(
        (c) => c?.targetType === 'poster' && myPosters.includes(c.targetId),
      )
      let n = 0, sum = 0
      for (const c of my) {
        if (!c?.ratings) continue
        n += 1
        sum += (Number(c.ratings.logic) || 0) +
               (Number(c.ratings.feasibility) || 0) +
               (Number(c.ratings.relevance) || 0)
      }
      out[gid] = { n, avg: n ? sum / n : 0 }
    }
    return out
  }, [groups, posters, comments])

  if (!phase) return null

  return (
    <section className="bg-white rounded-2xl border-2 border-emerald-300 shadow-sm p-4 space-y-3">
      <header className="flex items-baseline justify-between">
        <h3 className="font-bold text-emerald-800">
          📚 이번 여정에 일어난 일
        </h3>
        <span className="text-xs text-gray-500">
          여론조사 답변 전, 한 번 훑어 보세요
        </span>
      </header>

      {/* Phase 1 — 모둠별 포스터·신뢰도 */}
      {phase === 1 && (
        <ul className="grid sm:grid-cols-2 gap-2">
          {Object.entries(groups).map(([gid, g]) => {
            const t = groupTrust[gid]
            const topicMeta = config?.topics?.[g?.topic]
            const myPosters = Object.values(posters).filter((p) => p?.groupId === gid)
            return (
              <li
                key={gid}
                className={`p-3 rounded-xl border-2 ${topicBg(topicMeta?.color || g?.color)}`}
              >
                <div className="font-bold text-sm">{g.name || gid}</div>
                {g.slogan && (
                  <p className="text-xs italic text-gray-700 mt-0.5">"{g.slogan}"</p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  포스터 {myPosters.length}개 · 평가 {t?.n || 0}건 ·
                  평균 <strong>{t?.avg ? t.avg.toFixed(1) : '0'}</strong>
                </p>
                {(myPosters[0]?.imageUrl || myPosters[0]?.canvaUrl || myPosters[0]?.posterCanvaUrl) && (
                  <PosterMedia
                    poster={myPosters[0]}
                    className="mt-2 w-full aspect-[4/3] rounded-lg overflow-hidden"
                    imageClassName="w-full aspect-[4/3] object-cover rounded-lg"
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Phase 3 입법 — 가결/부결된 법안 */}
      {phase === 3 && tab === 'legislative' && (
        <ul className="space-y-2">
          {Object.entries(bills).map(([id, b]) => {
            const proposer = groups[b.proposerGroupId]
            const bg = b.status === 'passed' ? 'bg-emerald-50 border-emerald-300'
                    : b.status === 'rejected' ? 'bg-rose-50 border-rose-300'
                    : 'bg-amber-50 border-amber-300'
            return (
              <li key={id} className={`p-3 rounded-lg border-2 ${bg}`}>
                <div className="flex justify-between items-baseline gap-2 flex-wrap">
                  <strong>{b.title}</strong>
                  <span className="text-xs">
                    {b.status === 'passed' ? '✅ 가결' : b.status === 'rejected' ? '❌ 부결' : '🗳️ 의결 중'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">발의: {proposer?.name || b.proposerGroupId}</p>
                {b.voteResult && (
                  <p className="text-xs mt-1">
                    찬성 {b.voteResult.yes} ({b.voteResult.yesCount}명) · 반대 {b.voteResult.no} ({b.voteResult.noCount}명)
                  </p>
                )}
              </li>
            )
          })}
          {Object.keys(bills).length === 0 && (
            <li className="text-sm text-gray-400 text-center py-3">아직 발의된 법안이 없어요.</li>
          )}
        </ul>
      )}

      {/* Phase 3 행정 — 정책 보고서 + 예산 */}
      {phase === 3 && tab === 'executive' && (
        <ul className="space-y-2">
          {Object.entries(policies).map(([id, p]) => {
            const group = groups[p.proposerGroupId]
            const sumBudget = Object.values(p.budget || {}).reduce(
              (acc, n) => acc + (Number(n) || 0),
              0,
            )
            return (
              <li key={id} className="p-3 rounded-lg border-2 bg-emerald-50 border-emerald-200">
                <div className="flex justify-between items-baseline">
                  <strong>{p.policyName}</strong>
                  <span className="text-xs font-mono">{sumBudget}/100억</span>
                </div>
                <p className="text-xs text-gray-500">제출: {group?.name}</p>
                <p className="text-xs italic mt-1">"{p.impact}"</p>
              </li>
            )
          })}
          {Object.keys(policies).length === 0 && (
            <li className="text-sm text-gray-400 text-center py-3">아직 정책 보고서가 없어요.</li>
          )}
        </ul>
      )}

      {/* Phase 3 사법 — 판결문 */}
      {phase === 3 && tab === 'judicial' && (
        <ul className="space-y-2">
          {Object.entries(verdicts).map(([caseId, byCase]) => {
            if (typeof byCase !== 'object') return null
            return Object.entries(byCase).map(([vid, v]) => (
              <li key={caseId + vid} className="p-3 rounded-lg border-2 bg-rose-50 border-rose-200">
                <div className="flex justify-between items-baseline">
                  <strong>판결 — {caseId}</strong>
                  <span className="text-xs font-bold">
                    {v.decision === 'guilty' ? '⚖️ 유죄' : '🕊️ 무죄'}
                  </span>
                </div>
                {v.sentence && (
                  <p className="text-xs text-gray-600 mt-1">선고: {v.sentence}</p>
                )}
              </li>
            ))
          })}
        </ul>
      )}
    </section>
  )
}

export default PhaseActivitySummary
