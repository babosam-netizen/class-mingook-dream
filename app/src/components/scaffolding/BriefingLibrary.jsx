import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import BriefingCard from './BriefingCard'

const TABS = [
  { kind: 'legislative', label: '입법', tone: 'slate' },
  { kind: 'executive',   label: '행정', tone: 'emerald' },
  { kind: 'judicial',    label: '사법', tone: 'rose' },
]

/**
 * 브리핑 자료실 — 3종을 탭으로 보여준다.
 *
 * 학생이 각 탭을 처음 열 때 markBriefingRead로 ‘읽음’ 기록.
 */
function BriefingLibrary({ defaultKind = 'legislative', compact = false }) {
  const briefings = useGameStore((s) => s.config?.briefings)
  const markBriefingRead = useGameStore((s) => s.markBriefingRead)
  const role = useGameStore((s) => s.role)
  const [active, setActive] = useState(defaultKind)

  if (!briefings) return null

  const onSelect = (kind) => {
    setActive(kind)
    if (role === 'student') markBriefingRead(kind)
  }

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {TABS.map((t) => (
          <button
            key={t.kind}
            onClick={() => onSelect(t.kind)}
            className={`px-3 py-1.5 text-sm rounded-t-lg ${
              active === t.kind
                ? 'bg-white border-x border-t font-bold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label} 브리핑
          </button>
        ))}
      </div>
      <BriefingCard
        data={briefings[active]}
        tone={TABS.find((t) => t.kind === active)?.tone || 'slate'}
      />
      {!compact && (
        <p className="text-xs text-gray-400 mt-2">
          이 카드는 차시 시작 5분에 큰 소리로 읽거나 화면에 띄워 두세요.
        </p>
      )}
    </div>
  )
}

export default BriefingLibrary
