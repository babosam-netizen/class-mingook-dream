import useGameStore from '../../store/gameStore'
import { DEFAULT_ROLES, normalizeTodo, decorateRoleForContext, normalizeRoleList } from '../../lib/scaffolding-data'

const EMPTY_ROLES = []

/**
 * 학생 명찰 — 현재 차시의 자기 역할 + 오늘 해야 할 일 + SOS 권장 시점.
 *
 * props:
 *   sessionId
 *   kind: 'legislative'|'executive'|'judicial'
 */
function RoleCard({ sessionId, kind, compact = false }) {
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  // selector는 안정 reference만 반환해야 함 (`|| []` 는 매번 새 배열 → 무한 루프)
  const rolesForKind = useGameStore((s) => s.config?.roles?.[kind])
  const allRoles = normalizeRoleList(
    kind,
    rolesForKind || config?.branchConfig?.[kind]?.roles || DEFAULT_ROLES[kind] || EMPTY_ROLES,
  )

  if (role !== 'student' || !myStudentId) return null

  // 내 모둠 찾기
  let myGroupId = null
  for (const [gid, g] of Object.entries(groups || {})) {
    if (g?.members?.[myStudentId]) {
      myGroupId = gid
      break
    }
  }
  if (!myGroupId) return null

  const group = groups[myGroupId]
  const myRoleKey = group?.sessionRoles?.[sessionId]?.[myStudentId]
  const baseRole = allRoles.find((r) => r.key === myRoleKey)
  // 컨텍스트별 라벨 변환 — 행정부 장관은 부처명 자동 적용
  const myRole = decorateRoleForContext(baseRole, group, config, kind)

  if (!myRole) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-3 py-2 text-sm">
        🎭 아직 이 차시 역할이 정해지지 않았어요. 모둠장이 ‘4역할 배정’에서 정해 주세요.
      </div>
    )
  }

  if (compact) {
    return (
      <div className="bg-indigo-100 border-2 border-indigo-300 rounded-full px-3 py-1 text-sm font-bold inline-flex items-center gap-1">
        <span>{myRole.emoji}</span>
        <span>{myRole.label}</span>
      </div>
    )
  }

  return (
    <article className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 space-y-2">
      <header className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-lg text-indigo-900">
          {myRole.emoji} 오늘 나의 역할 — {myRole.label}
        </h3>
        <span className="text-xs text-gray-500">
          {group.name} 모둠
        </span>
      </header>
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">오늘 해야 할 일 3가지</p>
        <ol className="space-y-0.5">
          {myRole.todos.map((t, i) => {
            const td = normalizeTodo(t)
            return (
              <li key={i} className="text-sm flex gap-1.5">
                <span className="font-mono text-gray-500">{i + 1}.</span>
                <span>{td.label}</span>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="bg-white/70 rounded-lg p-2 text-xs">
        <strong>📞 막힐 때:</strong> {myRole.sosWhen} →{' '}
        <span className="font-semibold text-indigo-700">{myRole.sosLabel}</span> 호출
      </div>
    </article>
  )
}

export default RoleCard
