/**
 * 다축 평가 — 주제관련성·실현가능성·설득력 3축 (각 1~3점)
 *
 * 키는 호환성을 위해 그대로 유지(relevance/feasibility/logic).
 *
 * props:
 *   value: { logic, feasibility, relevance } | null
 *   onChange(next): 다음 값
 *   readOnly: 읽기 전용 (집계 점수 표시용)
 *   compact: 가로로 한 줄에 다 들어가게
 */
const AXES = [
  { key: 'relevance',   full: '🎯 주제관련성', short: '🎯 주제',  color: 'bg-rose-500' },
  { key: 'feasibility', full: '💡 실현가능성', short: '💡 실현',  color: 'bg-emerald-500' },
  { key: 'logic',       full: '🗣️ 설득력',     short: '🗣️ 설득',  color: 'bg-amber-500' },
]

function MultiAxisRating({ value, onChange, readOnly = false, compact = false, stacked = false, axes = AXES }) {
  const v = value || { logic: 0, feasibility: 0, relevance: 0 }

  // 세 축을 작게 세로 3줄로(2줄 정도 높이) — 댓글 카드 좌측에 배치하기 좋음
  if (stacked) {
    return (
      <div className="space-y-0.5 text-[10px]">
        {axes.map(({ key, short, color }) => (
          <div key={key} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-semibold w-12">{short}</span>
            <div className="inline-flex gap-0.5">
              {[1, 2, 3].map((n) => {
                const active = v[key] >= n
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange?.({ ...v, [key]: n === v[key] ? 0 : n })}
                    className={`w-2.5 h-2.5 rounded-full transition ${
                      active ? color : 'bg-gray-200'
                    } ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
                    aria-label={`${short} ${n}점`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        {axes.map(({ key, short, color }) => (
          <div key={key} className="flex items-center gap-1 whitespace-nowrap">
            <span className="font-semibold">{short}</span>
            <div className="inline-flex gap-0.5">
              {[1, 2, 3].map((n) => {
                const active = v[key] >= n
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange?.({ ...v, [key]: n === v[key] ? 0 : n })}
                    className={`w-4 h-4 rounded-full transition ${
                      active ? color : 'bg-gray-200'
                    } ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
                    aria-label={`${short} ${n}점`}
                  />
                )
              })}
            </div>
            {readOnly && (
              <span className="text-gray-500 tabular-nums">
                {Number(v[key] || 0).toFixed(1)}
              </span>
            )}
          </div>
        ))}
      </div>
    )
  }

  // full 라벨 모드(읽기/쓰기 모두 사용)
  return (
    <div className="space-y-2">
      {axes.map(({ key, full, color }) => (
        <div key={key} className="flex items-center gap-3">
          <span className="text-xs font-semibold w-24">{full}</span>
          <div className="inline-flex gap-1">
            {[1, 2, 3].map((n) => {
              const active = v[key] >= n
              return (
                <button
                  key={n}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange?.({ ...v, [key]: n === v[key] ? 0 : n })}
                  className={`w-6 h-6 rounded-full transition ${
                    active ? color : 'bg-gray-200'
                  } ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
                  aria-label={`${full} ${n}점`}
                />
              )
            })}
          </div>
          {readOnly && (
            <span className="ml-2 text-xs text-gray-500 tabular-nums">
              {Number(v[key] || 0).toFixed(1)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export default MultiAxisRating
