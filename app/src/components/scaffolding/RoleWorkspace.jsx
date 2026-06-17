import useGameStore from '../../store/gameStore'
import BillTemplate from './BillTemplate'
import BudgetReportTemplate from './BudgetReportTemplate'
import GenericRoleNotes from './GenericRoleNotes'
import { normalizeTodo, decorateRoleForContext, DEFAULT_ROLES, normalizeRoleList } from '../../lib/scaffolding-data'

const EMPTY_ROLES = []

/**
 * 역할별 작업 공간 — 학생의 현재 역할에 맞는 입력 도구를 자동 렌더.
 *
 * 라우팅 규칙:
 *  - legislative.billDrafter   → BillTemplate (법안 4조항)
 *  - executive.budgetAnalyst   → BudgetReportTemplate (100억 예산 분배)
 *  - judicial.judge            → VerdictTemplate (판결문 4단)
 *  - 그 외 모든 역할           → GenericRoleNotes (todos 기반 메모)
 *
 * @param {{groupId, sessionId, kind: 'legislative'|'executive'|'judicial'}} props
 */
function RoleWorkspace({ groupId, sessionId, kind, filterSide }) {
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const rolesForKind = useGameStore((s) => s.config?.roles?.[kind])
  // 역할 우선순위: config.roles.[kind] → config.branchConfig.[kind].roles → DEFAULT_ROLES[kind]
  // BranchConfigEditor 는 config.branchConfig.[kind].roles 에 저장하므로 두 번째 폴백이 중요
  const group = groups?.[groupId]
  const isPresidentGroup = kind === 'executive' && (config?.branchConfig?.executive?.presidentGroupId === groupId || group?.name?.includes('대통령'))

  const baseSource = isPresidentGroup
    ? DEFAULT_ROLES.executive_president
    : (rolesForKind || config?.branchConfig?.[kind]?.roles || DEFAULT_ROLES[kind] || EMPTY_ROLES)

  const allRolesBase = normalizeRoleList(
    kind,
    baseSource
  )
  // 사법부: 팀 구분(검사팀/변호팀 등)에 맞는 역할만 표시
  const allRoles = (kind === 'judicial' && filterSide)
    ? allRolesBase.filter((r) => r.side === filterSide)
    : allRolesBase



  if (role !== 'student' || !myStudentId || !groupId) return null

  const myRoleKey = group?.sessionRoles?.[sessionId]?.[myStudentId]
  const baseRole = allRoles.find((r) => r.key === myRoleKey)
  // 컨텍스트별 라벨 변환 — 행정부 장관은 부처명 적용
  const myRole = decorateRoleForContext(baseRole, group, config, kind)

  const groupName = group?.name || '모둠'

  if (!myRole) {
    // 공동 작업 모드이고 입법/행정부일 때는 역할 미배정 경고를 숨기거나 간소화 (이미 템플릿이 보이므로)
    const isCollaborative = 
      (kind === 'legislative' && config?.branchConfig?.legislative?.mode === 'collaborative') ||
      (kind === 'executive' && config?.branchConfig?.executive?.mode === 'collaborative')

    if (isCollaborative) {
      return null
    }

    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-sm text-amber-900 space-y-2">
        <div className="text-[11px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full inline-block">
          👥 우리 모둠 — {groupName}
        </div>
        <p>
          🎭 이 차시 역할이 아직 정해지지 않았어요.<br />
          모둠장이 <b>'역할 배정'</b> 메뉴에서 역할을 정하면 여기에 작업 공간이 나옵니다.
        </p>
      </div>
    )
  }

  // 특수 템플릿 — 법안/예산/판결문 (RoleCard 가 상단에 별도로 표시되므로 헤더 중복 제거)
  // 특수 템플릿 + 미션 메모 둘 다 노출 — 템플릿은 핵심 산출물, 메모는 사고 정리·근거 메모
  if (kind === 'legislative' && myRole.key === 'billDrafter') {
    // 공동 작업 모드일 때는 BillTemplate 을 부모(LegislativeTab)가 그리므로 메모만 노출
    if (config?.branchConfig?.legislative?.mode === 'collaborative') {
      return <GenericRoleNotes groupId={groupId} sessionId={sessionId} role={myRole} />
    }
    return (
      <div className="space-y-3">
        <BillTemplate groupId={groupId} />
        <GenericRoleNotes groupId={groupId} sessionId={sessionId} role={myRole} />
      </div>
    )
  }
  if (kind === 'executive' && myRole.key === 'budgetAnalyst') {
    // 공동 작업 모드일 때는 MinisterPolicyDraft 가 템플릿 역할을 겸하므로 메모만 노출
    if (config?.branchConfig?.executive?.mode === 'collaborative') {
      return <GenericRoleNotes groupId={groupId} sessionId={sessionId} role={myRole} />
    }
    return (
      <div className="space-y-3">
        <BudgetReportTemplate groupId={groupId} />
        <GenericRoleNotes groupId={groupId} sessionId={sessionId} role={myRole} />
      </div>
    )
  }
  // judicial.judge — 판결문 템플릿은 caseId/decision 컨텍스트가 필요해 JudicialTab 본문에서 직접 렌더.
  // 판사도 동일하게 메모 영역 노출.
  if (kind === 'judicial' && myRole.key === 'judge') {
    return <GenericRoleNotes groupId={groupId} sessionId={sessionId} role={myRole} />
  }

  // 일반 역할 — todos 기반 메모 폼 (자체 헤더 보유)
  return <GenericRoleNotes groupId={groupId} sessionId={sessionId} role={myRole} />
}

// (RoleHeader 는 중복으로 제거됨 — Phase3Page 의 RoleCard 가 동일 정보 노출)

export default RoleWorkspace
