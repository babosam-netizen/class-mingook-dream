/**
 * 베네핏 카드 인벤토리 — 4종 슬롯 표시
 *
 * 현재 활성: weighted (가중 투표권)
 * 미활성: super, priority, veto (분배 0, 회색 표시 — 추후 활성화)
 *
 * props:
 *   inventory: { super, priority, weighted, veto } (없으면 모두 0)
 *   compact: 가로 한 줄로 작게 (RoomBar 등)
 *   title: 패널 제목
 */
const CARDS = [
  { key: 'weighted', label: '가중 투표권', emoji: '⚖️', desc: '1인 2표 효력' },
  { key: 'super',    label: '슈퍼 발언권', emoji: '🎙️', desc: '1분 추가 발언' },
  { key: 'priority', label: '우선 상정권', emoji: '⬆️', desc: '법안 1순위 상정' },
  { key: 'veto',     label: '거부권',      emoji: '🛑', desc: '가결 무효화' },
]

function BenefitCardInventory({ inventory, compact = false, title = '🎁 특권 카드 저장소' }) {
  const inv = inventory || { super: 0, priority: 0, weighted: 0, veto: 0 }

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {CARDS.map((c) => {
          const count = inv[c.key] || 0
          const active = count > 0
          return (
            <span
              key={c.key}
              title={c.label + ' — ' + c.desc}
              className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-300'
              }`}
            >
              {c.emoji} {count}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      {title && (
        <h3 className="font-bold text-indigo-800 mb-2 text-sm">{title}</h3>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {CARDS.map((c) => {
          const count = inv[c.key] || 0
          const active = count > 0
          return (
            <li
              key={c.key}
              className={`p-2 rounded-lg border-2 transition ${
                active
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-100 bg-gray-50 text-gray-300'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">
                  {c.emoji} {c.label}
                </span>
                <span className="text-base tabular-nums">×{count}</span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  active ? 'text-gray-600' : 'text-gray-300'
                }`}
              >
                {active ? c.desc : '준비 중'}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default BenefitCardInventory
