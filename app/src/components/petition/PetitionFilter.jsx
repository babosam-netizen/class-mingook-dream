import usePetitionStore from '../../store/petitionStore'

/**
 * @param {{prefixOptions: string[], tagFreq: {tag, count}[], prefixFreq: {[key: string]: number}, totalCount: number}} props
 */
function PetitionFilter({ prefixOptions, tagFreq, prefixFreq = {}, totalCount = 0 }) {
  const prefixFilter = usePetitionStore((s) => s.prefixFilter)
  const hashTagFilter = usePetitionStore((s) => s.hashTagFilter)
  const setPrefixFilter = usePetitionStore((s) => s.setPrefixFilter)
  const setHashTagFilter = usePetitionStore((s) => s.setHashTagFilter)
  const sortBy = usePetitionStore((s) => s.sortBy)
  const setSortBy = usePetitionStore((s) => s.setSortBy)

  const togglePrefix = (p) => setPrefixFilter(prefixFilter === p ? null : p)
  const toggleTag = (t) => setHashTagFilter(hashTagFilter === t ? null : t)

  return (
    <div className="space-y-3">
      {/* 정렬 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-semibold">정렬:</span>
        <button
          onClick={() => setSortBy('latest')}
          className={`text-xs px-3 py-1 rounded-full font-semibold ${
            sortBy === 'latest' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-amber-50'
          }`}
        >
          최신순
        </button>
        <button
          onClick={() => setSortBy('likes')}
          className={`text-xs px-3 py-1 rounded-full font-semibold ${
            sortBy === 'likes' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-amber-50'
          }`}
        >
          공감순
        </button>
      </div>

      {/* 말머리 탭 */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-gray-500 font-semibold mr-1">말머리:</span>
        <button
          onClick={() => setPrefixFilter(null)}
          className={`text-xs px-3 py-1 rounded-full font-semibold ${
            prefixFilter === null
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-600 border border-gray-300 hover:bg-indigo-50'
          }`}
        >
          전체
          <span className="ml-1 text-[10px] opacity-60 font-mono">{totalCount}</span>
        </button>
        {prefixOptions.map((p) => {
          const count = prefixFreq[p] || 0
          return (
            <button
              key={p}
              onClick={() => togglePrefix(p)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition ${
                prefixFilter === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-indigo-50'
              }`}
            >
              {p}
              <span className="ml-1 text-[10px] opacity-60 font-mono">{count}</span>
            </button>
          )
        })}
      </div>

      {/* 해시태그 빈도 */}
      {tagFreq.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-500 font-semibold mr-1">#태그:</span>
          {tagFreq.slice(0, 20).map(({ tag, count }) => {
            const active = hashTagFilter === tag
            // 빈도에 따라 약간 크기 차등
            const size = count >= 5 ? 'text-sm' : count >= 3 ? 'text-xs' : 'text-[11px]'
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`${size} px-2 py-0.5 rounded-full font-semibold transition ${
                  active
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                #{tag}
                <span className="ml-1 text-[9px] opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 활성 필터 표시 */}
      {(prefixFilter || hashTagFilter) && (
        <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-gray-100">
          <span className="text-[10px] text-gray-400">활성 필터:</span>
          {prefixFilter && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {prefixFilter}
              <button onClick={() => setPrefixFilter(null)} className="hover:text-indigo-900">✕</button>
            </span>
          )}
          {hashTagFilter && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              #{hashTagFilter}
              <button onClick={() => setHashTagFilter(null)} className="hover:text-amber-900">✕</button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default PetitionFilter
