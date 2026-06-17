import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'

/**
 * ExternalFeedBar — 모둠 작업창 상단 실시간 외부 피드
 *
 * props:
 *   unitId : 대상 부서 단위 ID (이 유닛으로 온 피드만 표시)
 *
 * RTDB: rooms/{roomCode}/externalFeed/{feedId}
 *   type        : 'citizens' | 'press'
 *   targetUnitId: unitId 또는 'all'
 *   requestText : 시민단 요청 (150자 이내)
 *   headline    : 기사단 헤드라인 (30자 이내)
 *   body        : 기사단 본문 (200자 이내)
 *   authorGroupId
 *   createdAt
 */
export default function ExternalFeedBar({ unitId }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups   = useGameStore((s) => s.groups)
  const [feedMap, setFeedMap] = useState({})
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'externalFeed', (d) => setFeedMap(d || {}))
    return () => u?.()
  }, [roomCode])

  // 이 유닛으로 온 피드 필터 + 최신순
  const items = Object.entries(feedMap)
    .map(([id, f]) => ({ id, ...f }))
    .filter((f) => f.targetUnitId === unitId || f.targetUnitId === 'all')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-amber-100 transition"
      >
        <span className="text-sm font-bold text-amber-800">
          📢 외부 의견 ({items.length}건)
        </span>
        <span className="ml-auto text-xs text-amber-600">
          {collapsed ? '펼치기 ▼' : '접기 ▲'}
        </span>
      </button>

      {!collapsed && (
        <div className="divide-y divide-amber-100 max-h-64 overflow-y-auto">
          {items.map((item) => {
            const grp     = groups?.[item.authorGroupId]
            const grpName = grp?.name || item.authorGroupId
            const isPress = item.type === 'press'
            const time    = item.createdAt
              ? new Date(item.createdAt).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })
              : ''

            return (
              <div key={item.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`font-semibold ${isPress ? 'text-slate-700' : 'text-emerald-700'}`}>
                    {isPress ? '📰 기사단' : '🏛️ 시민단체'}
                    {grpName && ` (${grpName})`}
                  </span>
                  <span className="ml-auto">{time}</span>
                </div>

                {isPress ? (
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-800">{item.headline}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{item.body}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 leading-relaxed">{item.requestText}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
