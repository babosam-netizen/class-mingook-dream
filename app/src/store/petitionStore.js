import { create } from 'zustand'

/**
 * Petition UI 상태 — 필터/정렬만 관리.
 * 데이터 자체(petitions)는 RTDB 구독을 통해 PetitionBoard에서 직접 가공하지만,
 * UI 상태는 컴포넌트 간 공유가 필요해 별도 store로 분리.
 */
const usePetitionStore = create((set) => ({
  prefixFilter: null,    // null = 전체
  hashTagFilter: null,   // null = 없음
  sortBy: 'latest',      // 'latest' | 'likes'

  setPrefixFilter: (v) => set({ prefixFilter: v || null }),
  setHashTagFilter: (v) => set({ hashTagFilter: v || null }),
  setSortBy: (v) => set({ sortBy: v === 'likes' ? 'likes' : 'latest' }),
  resetFilters: () => set({ prefixFilter: null, hashTagFilter: null }),
}))

export default usePetitionStore

/**
 * 필터 + 정렬 적용 헬퍼 (selector 외부에서 호출).
 * @param {Petition[]} list
 * @param {string|null} prefixFilter
 * @param {string|null} hashTagFilter
 * @param {'latest'|'likes'} sortBy
 */
export function applyPetitionFilters(list, prefixFilter, hashTagFilter, sortBy) {
  let arr = list
  if (prefixFilter) arr = arr.filter((p) => p.prefixTag === prefixFilter)
  if (hashTagFilter) {
    arr = arr.filter((p) => Array.isArray(p.hashTags) && p.hashTags.includes(hashTagFilter))
  }
  if (sortBy === 'likes') {
    arr = [...arr].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
  } else {
    arr = [...arr].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }
  return arr
}

/** likeCount 상위 N개 (동률은 createdAt 빠른 것 우선) */
export function topPetitions(list, n = 3) {
  return [...list]
    .filter((p) => p.status === 'approved')
    .sort((a, b) => {
      const d = (b.likeCount || 0) - (a.likeCount || 0)
      if (d !== 0) return d
      return (a.createdAt || 0) - (b.createdAt || 0)
    })
    .slice(0, n)
}

/** 해시태그 빈도 집계 (approved만). 반환: [{tag, count}] 빈도순 */
export function hashTagFrequency(list) {
  const counts = {}
  for (const p of list) {
    if (p.status !== 'approved') continue
    if (!Array.isArray(p.hashTags)) continue
    for (const t of p.hashTags) {
      if (!t) continue
      counts[t] = (counts[t] || 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

/** 말머리별 빈도 집계 (approved만). 반환: {prefixTag: count} */
export function prefixFrequency(list) {
  const counts = {}
  for (const p of list) {
    if (p.status !== 'approved') continue
    const tag = p.prefixTag || '기타'
    counts[tag] = (counts[tag] || 0) + 1
  }
  return counts
}
