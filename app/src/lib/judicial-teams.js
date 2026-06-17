/**
 * judicial-teams.js
 * 사법부 팀(검사/변호/증인/배심원/판사/기자) 배정 해석 헬퍼.
 *
 * 배정 방식:
 *   - judicial.{side} = [{ groupId, ... }] 로 모둠 통째 배정
 *   - judicial.members.{side} = { studentId: true } 로 개인별 배정
 *   - 두 방식은 동시에 사용할 수 있으며, 개인별 배정이 모둠 배정보다 우선한다.
 *
 * 모든 사법 화면(JudicialTab / JudicialVerdictTab / 교사 빠른제어 / 토론 세션 매핑)은
 * 이 헬퍼를 통해 학생의 팀(side)을 일관되게 판정한다.
 */

export const JUDICIAL_SIDES = ['judge', 'prosecution', 'defense', 'jury', 'witness', 'press']

export const JUDICIAL_SIDE_LABEL = {
  judge:       '⚖️ 판사',
  prosecution: '👨‍💼 검사',
  defense:     '🛡️ 변호',
  jury:        '🙋 배심원',
  witness:     '👤 증인',
  press:       '📰 기자',
}

/** 레거시 UI 호환용. 현재는 항상 혼합 배정으로 해석한다. */
export function getJudicialAssignMode(judicialConfig) {
  return judicialConfig?.assignMode === 'group' ? 'group' : 'individual'
}

/** studentId 가 속한 모둠 id 찾기 */
function findGroupId(studentId, groups) {
  if (!studentId) return null
  for (const [gid, g] of Object.entries(groups || {})) {
    if (g?.members?.[studentId]) return gid
  }
  return null
}

/**
 * 학생의 사법 팀(side) 반환. 배정 안 됐으면 null.
 * 개인 배정이 있으면 개인 배정을 우선하고, 없으면 학생이 속한 모둠의 통째 배정을 사용한다.
 */
export function getStudentJudicialSide(studentId, judicialConfig, groups) {
  if (!studentId || !judicialConfig) return null
  const members = judicialConfig.members || {}
  for (const side of JUDICIAL_SIDES) {
    if (members[side] && members[side][studentId]) return side
  }
  const gid = findGroupId(studentId, groups)
  if (!gid) return null
  for (const side of JUDICIAL_SIDES) {
    if ((judicialConfig[side] || []).some((u) => u?.groupId === gid)) return side
  }
  return null
}

/** 특정 side 에 속한 학생 id 목록 (토론 세션 매핑 등) */
export function getJudicialSideStudentIds(side, judicialConfig, groups) {
  if (!side || !judicialConfig) return []
  const ids = new Set()
  const explicitSideByStudent = {}
  for (const s of JUDICIAL_SIDES) {
    const map = judicialConfig.members?.[s] || {}
    for (const [sid, yes] of Object.entries(map)) {
      if (yes) explicitSideByStudent[sid] = s
    }
  }
  const gids = (judicialConfig[side] || []).map((u) => u?.groupId).filter(Boolean)
  for (const gid of gids) {
    for (const sid of Object.keys(groups?.[gid]?.members || {})) {
      if (!explicitSideByStudent[sid]) ids.add(sid)
    }
  }
  const map = judicialConfig.members?.[side] || {}
  for (const [sid, yes] of Object.entries(map)) {
    if (yes) ids.add(sid)
  }
  return [...ids]
}

/** 특정 side 에 배정된 인원 수 (모둠 모드는 모둠 소속 학생 합) */
export function getJudicialSideCount(side, judicialConfig, groups) {
  return getJudicialSideStudentIds(side, judicialConfig, groups).length
}

export function getJudicialAssignmentSummary(judicialConfig, groups, students, sides = JUDICIAL_SIDES) {
  const summary = {}
  for (const side of sides) {
    const groupUnits = judicialConfig?.[side] || []
    const groupIds = groupUnits.map((u) => u?.groupId).filter(Boolean)
    const memberMap = judicialConfig?.members?.[side] || {}
    const studentIds = Object.keys(memberMap).filter((sid) => memberMap[sid])
    summary[side] = {
      groups: groupIds.map((gid) => ({ id: gid, name: groups?.[gid]?.name || gid })),
      students: studentIds
        .map((sid) => {
          const s = students?.[sid]
          if (!s) return null
          return {
            id: sid,
            name: `${s.number ? `${s.number}번 ` : ''}${s.nickname || sid}`.trim(),
          }
        })
        .filter(Boolean)
        .sort((a, b) => {
          const an = Number((a.name.match(/^(\d+)번/) || [])[1] || 999)
          const bn = Number((b.name.match(/^(\d+)번/) || [])[1] || 999)
          return an - bn
        }),
    }
  }
  return summary
}
