/**
 * 모둠별 누적 평가 점수 — 막대그래프
 * trustScore: 0~9 (3축 합계의 평균)
 */
function TrustGauge({ score = 0, max = 9, label, compact = false }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100))

  return (
    <div className="space-y-1">
      {!compact && label && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 font-semibold">{label}</span>
          <span className="text-gray-500 tabular-nums">{Number(score).toFixed(1)} / {max}</span>
        </div>
      )}
      <div className={`bg-gray-100 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-3'}`}>
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default TrustGauge
