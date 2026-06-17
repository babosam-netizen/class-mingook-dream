/**
 * 선거 — 분배·집계 로직
 *
 * 보상권/특권 카드 기능은 현재 보류 중이다.
 * 복원 메모: v1.2.28 이전 기본값은 1위 weighted 6장, 2~3위 3장, 그 외 2장이었다.
 */

// 보류 중에는 어떤 보상권도 분배하지 않는다.
export function defaultDistribution() {
  return { super: 0, priority: 0, weighted: 0, veto: 0 }
}

// 등수 → 국가 직책 매핑 (기본값 — 학급 설정에서 override 가능)
export const RANK_ROLE = {
  1: { id: 'president', label: '대통령',     emoji: '🇰🇷' },
  2: { id: 'speaker',   label: '국회의장',   emoji: '🏛️' },
  3: { id: 'chiefJustice', label: '대법원장', emoji: '⚖️' },
}

/**
 * 등수별 직책 — 학급 설정의 `electionRoles` 배열을 우선 사용.
 * 설정이 없으면 RANK_ROLE 기본값 fallback.
 *
 * @param {number} rank
 * @param {Array<{rank, label, emoji}>} [electionRoles]  config.electionRoles
 */
export function roleForRank(rank, electionRoles = null) {
  if (Array.isArray(electionRoles) && electionRoles.length > 0) {
    const found = electionRoles.find((r) => Number(r?.rank) === Number(rank))
    if (found && (found.label || found.emoji)) {
      return { id: `rank_${rank}`, label: found.label || '', emoji: found.emoji || '' }
    }
    return null
  }
  return RANK_ROLE[rank] || null
}

/**
 * 득표 집계 + 등수 부여
 * candidates: { [groupId]: {...} }
 * votes:      { [studentId]: { candidateGroupId, ... } }
 *
 * 반환: [{ groupId, count, rank }, ...] 득표 내림차순
 */
export function calculateRanks(candidates, votes) {
  const counts = {}
  for (const gid of Object.keys(candidates || {})) counts[gid] = 0
  for (const v of Object.values(votes || {})) {
    if (v?.candidateGroupId) {
      counts[v.candidateGroupId] = (counts[v.candidateGroupId] || 0) + 1
    }
  }
  const sorted = Object.entries(counts)
    .map(([groupId, count]) => ({ groupId, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      // 동률은 groupId 알파벳 순으로 (안정 정렬)
      return a.groupId.localeCompare(b.groupId)
    })
  return sorted.map((item, idx) => ({ ...item, rank: idx + 1 }))
}
