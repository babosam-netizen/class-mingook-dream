import useGameStore from '../../store/gameStore'
import { roleForRank } from '../../lib/election'

/**
 * 전광판 스타일 선거 결과 발표.
 *
 * 디자인 모티프: Phase1의 '최우선 과제 확정 전광판' (어두운 indigo/slate 그라데이션 + amber 강조)
 *
 * 3가지 모드:
 *  - `entryWaiting=true`  → 투표소 입장 대기 (교사가 투표 시작 누르기 전)
 *  - `waiting=true`       → 투표 진행 중 대기 (학생이 투표 완료 후 결과 공개 전)
 *  - 둘 다 false          → 공식 결과 발표
 *
 * props:
 *   ranks: [{ groupId, count, rank }] — 득표 순 (결과 모드만 사용)
 *   totalVotes: number
 *   waiting: boolean
 *   entryWaiting: boolean
 */
function ElectionResultBoard({ ranks, totalVotes, waiting = false, entryWaiting = false }) {
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const className = useGameStore((s) => s.className)
  const candidatesRaw = useGameStore((s) => s.roomData?.candidates) || {}
  // 표시명 우선순위: 학급 설정의 나라 이름 → 학급 이름 → 빈 문자열
  const displayName = ((config?.countryName || '').trim() || (className || '').trim() || '')
  const countryName = displayName  // 결과 발표 모드 헤더용 (기존 자리 유지)
  const electionRoles = config?.electionRoles

  // ── 대기 모드 (입장 대기 / 투표 진행 중 대기) — 통계·순위 일체 숨김 ───────
  if (entryWaiting || waiting) {
    const icon = entryWaiting ? '🚪' : '⏳'
    const title = entryWaiting
      ? (displayName
          ? `${displayName} 선거 투표소 입장 대기 중`
          : '선거 투표소 입장 대기 중')
      : '투표 마감 대기 중'
    return (
      <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-900 rounded-[2.5rem] p-10 sm:p-14 text-center shadow-2xl border-4 border-amber-500/50 relative overflow-hidden ring-8 ring-indigo-900/10 min-h-[320px] flex items-center justify-center">
        <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-white/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -top-32 -right-20 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <span className="text-7xl drop-shadow-[0_0_30px_rgba(255,223,0,0.4)] inline-block animate-bounce">
            {icon}
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-amber-200 tracking-tight drop-shadow-lg whitespace-pre-line">
            {title}
          </h3>
          {entryWaiting && (
            <p className="text-amber-100/70 text-sm font-semibold mt-1">
              선생님께서 열어주실 때까지 기다려주세요.
            </p>
          )}
        </div>
      </section>
    )
  }

  if (!ranks || ranks.length === 0) {
    return (
      <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-900 rounded-[2.5rem] p-12 text-center shadow-2xl border-4 border-amber-500/40 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-white/10 to-transparent blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <p className="text-5xl animate-bounce">⏳</p>
          <p className="text-amber-200 text-xl font-black">집계 대기 중...</p>
        </div>
      </section>
    )
  }

  const winner = ranks[0]
  const winnerGroup = winner ? groups?.[winner.groupId] : null
  const winnerCand = winner ? candidatesRaw[winner.groupId] : null
  const winnerRole = roleForRank(1, electionRoles)

  return (
    <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-900 rounded-[2.5rem] p-6 sm:p-8 text-center shadow-2xl border-4 border-amber-500/50 relative overflow-hidden ring-8 ring-indigo-900/10">
      {/* 광원 효과 */}
      <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-white/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -top-32 -right-20 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-64 h-64 bg-rose-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* 헤더 */}
        <header>
          <span className={`inline-block px-4 py-1 text-xs font-black rounded-full tracking-widest mb-3 animate-pulse ${
            waiting
              ? 'bg-slate-700 text-amber-200 border border-amber-400/40'
              : 'bg-amber-500 text-indigo-950'
          }`}>
            {waiting ? '결과 발표 대기 중' : '공식 발표'}
          </span>
          <h2 className="text-white text-2xl sm:text-3xl font-black tracking-tight flex items-center justify-center gap-3">
            <span className="text-amber-400">{waiting ? '⏳' : '🏆'}</span> {displayName ? `${displayName} 선거 결과` : '선거 결과'}
          </h2>
          <p className="text-amber-200/60 text-xs mt-1">총 {totalVotes}표 · {ranks.length}명 후보</p>
        </header>

        {/* 대기 모드 안내 카드 — 1위 자리에 노출 */}
        {waiting && (
          <div className="bg-white/5 border-2 border-amber-400/40 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="text-6xl drop-shadow-[0_0_30px_rgba(255,223,0,0.4)] animate-bounce">⏳</span>
              <h3 className="text-2xl sm:text-3xl font-black text-amber-200 tracking-tight drop-shadow-lg">
                투표 마감 대기 중
              </h3>
              <p className="text-amber-100 text-base font-bold">
                대기해 주세요
              </p>
              <p className="text-amber-100/80 text-sm max-w-md leading-relaxed whitespace-pre-line">
                {waitingNote || '다른 친구들이 투표를 마칠 때까지 잠시 기다려 주세요.\n선생님이 결과를 공개하면 공식 1위 후보와 직책이 발표됩니다.'}
              </p>
            </div>
          </div>
        )}

        {/* 1위 대형 발표 카드 — 공식 발표 모드에서만 노출 */}
        {!waiting && winner && (
          <div className="bg-gradient-to-br from-amber-400/20 to-amber-600/10 border-2 border-amber-400/60 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-2xl">
            <p className="text-amber-300 text-[10px] font-black uppercase tracking-[0.3em] mb-3">
              🥇 당선 (1위)
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <span className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-500 text-indigo-950 text-2xl sm:text-3xl font-black shadow-[0_0_30px_rgba(255,200,0,0.5)]">
                  {winnerCand?.candidateNumber ?? winnerCand?.leaderNumber ?? '?'}
                </span>
                <div className="text-left">
                  <p className="text-white text-3xl sm:text-4xl font-black tracking-tight drop-shadow-lg">
                    {winnerCand?.leaderNickname || '?'}
                  </p>
                  <p className="text-amber-200 text-sm font-semibold">{winnerGroup?.name || winner.groupId} 모둠</p>
                </div>
              </div>
              <div className="flex items-baseline gap-3 mt-2">
                <p className="text-amber-200 text-sm font-bold">득표</p>
                <p className="text-amber-300 text-5xl sm:text-6xl font-black tabular-nums drop-shadow-[0_0_30px_rgba(255,223,0,0.6)]">
                  {winner.count}
                </p>
                <p className="text-amber-200 text-sm font-bold">
                  표 ({totalVotes ? Math.round((winner.count / totalVotes) * 100) : 0}%)
                </p>
              </div>
              {winnerRole && (
                <span className="mt-2 inline-block px-4 py-1.5 rounded-full bg-amber-500 text-indigo-950 text-xs font-black tracking-widest shadow-lg">
                  {winnerRole.emoji} {winnerRole.label}직 수행
                </span>
              )}
            </div>
          </div>
        )}

        {/* 전체 순위 */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5 backdrop-blur-sm">
          <p className="text-amber-300 text-[10px] font-black uppercase tracking-[0.3em] mb-3 text-left">
            {waiting ? '📊 실시간 진행 현황 (참고용)' : '📊 전체 득표 현황'}
          </p>
          <ol className="space-y-2">
            {ranks.map((r) => {
              const g = groups?.[r.groupId]
              const cand = candidatesRaw[r.groupId]
              const pct = totalVotes ? Math.round((r.count / totalVotes) * 100) : 0
              const role = roleForRank(r.rank, electionRoles)
              const medal = ['🥇', '🥈', '🥉'][r.rank - 1] || `${r.rank}위`
              // 대기 중에는 1위 강조 효과 빼고 모두 동등 노출
              const isWinner = !waiting && r.rank === 1
              return (
                <li
                  key={r.groupId}
                  className={`relative rounded-2xl px-3 py-2.5 border ${
                    isWinner
                      ? 'bg-amber-400/15 border-amber-400/50'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`shrink-0 text-lg font-black ${isWinner ? 'text-amber-300' : 'text-slate-300'}`}>
                        {medal}
                      </span>
                      <span className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black ${
                        isWinner ? 'bg-amber-500 text-indigo-950' : 'bg-slate-700 text-slate-200'
                      }`}>
                        {cand?.candidateNumber ?? cand?.leaderNumber ?? '?'}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${isWinner ? 'text-amber-100' : 'text-slate-100'}`}>
                          {cand?.leaderNickname || g?.name || r.groupId}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{g?.name || ''}</p>
                      </div>
                      {/* 직책 라벨 — 공식 발표 모드에서만 노출 (대기 중에는 비공개) */}
                      {!waiting && role && (
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isWinner ? 'bg-amber-500 text-indigo-950' : 'bg-slate-700 text-slate-200'
                        }`}>
                          {role.label}
                        </span>
                      )}
                    </div>
                    <p className={`shrink-0 text-sm font-black tabular-nums ${isWinner ? 'text-amber-300' : 'text-slate-100'}`}>
                      {r.count}표 · {pct}%
                    </p>
                  </div>
                  <div className="mt-2 h-2 bg-slate-800/70 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isWinner ? 'bg-gradient-to-r from-amber-400 to-amber-300' : 'bg-slate-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {/* 안내 문구 — 모드별 분기 */}
        <p className="text-amber-200/60 text-[11px] font-semibold">
          {waiting
            ? '⏳ 선생님이 결과를 공개하기 전까지는 1위와 직책이 비공개입니다.'
            : "🎉 선출된 대통령과 함께 세 번째 여정 '국정 포털'이 곧 시작됩니다."}
        </p>
      </div>
    </section>
  )
}

export default ElectionResultBoard
