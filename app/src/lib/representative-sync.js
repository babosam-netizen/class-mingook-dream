// 행정부 '대표' 양방향 동기화 헬퍼.
//
// 같은 "대표"가 두 저장소에 따로 존재하던 문제를 단일 진입점으로 통일한다.
//  (A) config.branchConfig.executive.units[idx].representativeStudentId
//        → 학급설정·최종 조립 편집권(BranchUnitWorkspace.isRepresentative)·배너가 보는 값
//  (B) groups/{gid}/sessionRoles/executive-default/{studentId} = repKey
//        → 빠른제어·대통령 승인 보드(ExecutiveTab.isPresidentLeader)가 보는 값
//
// 어느 화면에서 대표를 지정하든 이 함수를 거치면 (A)·(B)가 항상 같은 사람을 가리킨다.
import { updateAt } from './rtdb-helpers'
import { DEFAULT_ROLES, normalizeRoleList } from './scaffolding-data'

export const EXECUTIVE_SESSION_ID = 'executive-default'

export function isPresidentUnit(unit, branchConfig, groups) {
  if (!unit) return false
  const pGid = branchConfig?.executive?.presidentGroupId
  return (
    unit.unitId === 'exe-president' ||
    (!!unit.groupId && (pGid === unit.groupId || !!groups?.[unit.groupId]?.name?.includes('대통령')))
  )
}

// 이 유닛의 '대표' 역할 키 — 대통령실은 pledge_purpose, 일반 부처는 minister(또는 커스텀 역할의 대표)
export function getExecutiveRepKey(unit, branchConfig, groups) {
  const pres = isPresidentUnit(unit, branchConfig, groups)
  const roleSet = pres
    ? DEFAULT_ROLES.executive_president
    : branchConfig?.executive?.roles || DEFAULT_ROLES.executive
  const rep = normalizeRoleList('executive', roleSet).find((r) => r.isRepresentative)
  return rep?.key || (pres ? 'pledge_purpose' : 'minister')
}

/**
 * 행정부 대표를 (A) config representativeStudentId 와 (B) sessionRoles 역할키에 동시에 기록한다.
 * studentId 가 빈 값(''·null)이면 양쪽 모두 해제한다.
 */
export async function syncExecutiveRepresentative({ roomCode, branchConfig, groups, unit, studentId }) {
  if (!roomCode || !unit?.groupId) return
  const gid = unit.groupId
  const repKey = getExecutiveRepKey(unit, branchConfig, groups)
  const units = branchConfig?.executive?.units || []
  const idx = units.findIndex((u) => (unit.unitId && u.unitId === unit.unitId) || u.groupId === gid)
  const sessionRoles = groups?.[gid]?.sessionRoles?.[EXECUTIVE_SESSION_ID] || {}
  const sid = studentId || ''

  const updates = {}
  // (A) 학급설정이 보는 값
  if (idx >= 0) updates[`config/branchConfig/executive/units/${idx}/representativeStudentId`] = sid || null
  // (B) 빠른제어·승인보드가 보는 값 — 기존 대표 역할 보유자 해제 후 재지정
  Object.entries(sessionRoles).forEach(([s, rk]) => {
    if (rk === repKey && s !== sid) updates[`groups/${gid}/sessionRoles/${EXECUTIVE_SESSION_ID}/${s}`] = null
  })
  if (sid) updates[`groups/${gid}/sessionRoles/${EXECUTIVE_SESSION_ID}/${sid}`] = repKey

  await updateAt(roomCode, '', updates)
}
