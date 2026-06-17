import { useEffect, useState } from 'react'

/**
 * 야당 연합 1분 타이머 — endsAt 기준 카운트다운.
 * RTDB의 timers/oppositionAlliance: { active, endsAt }를 props로 받는다.
 *
 * props:
 *   timer: { active, endsAt } | null
 *   onExpire?: 만료 시 호출 (교사용 자동 종료에 사용 가능)
 */
function AllianceTimer({ timer, onExpire, compact = false }) {
  const endsAt = timer?.endsAt
  const active = !!timer?.active
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active || !endsAt) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active, endsAt])

  if (!active || !endsAt) return null

  const remaining = Math.max(0, endsAt - now)
  const seconds = Math.ceil(remaining / 1000)
  const expired = remaining <= 0

  useEffect(() => {
    if (expired) onExpire?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
          expired ? 'bg-gray-200 text-gray-500' : 'bg-amber-500 text-white animate-pulse'
        }`}
      >
        ⏱️ {expired ? '종료' : `${seconds}초`}
      </span>
    )
  }

  return (
    <div
      className={`px-4 py-2 rounded-xl text-center ${
        expired
          ? 'bg-gray-100 text-gray-500'
          : 'bg-amber-100 border-2 border-amber-400 text-amber-900 animate-pulse'
      }`}
    >
      <div className="text-xs">야당 연합 협상 시간</div>
      <div className="text-2xl font-bold tabular-nums">
        {expired ? '00초' : `${String(seconds).padStart(2, '0')}초`}
      </div>
    </div>
  )
}

export default AllianceTimer
