/**
 * 빈칸 입력 빌딩 블록 — 회색 placeholder를 그대로 두면 미완료로 표시.
 *
 * 단일 textarea/input + 미완료 시 빨간 테두리 + 안내 메시지.
 *
 * props:
 *   label: 항목명 (위에 굵게)
 *   placeholder: 회색 안내 문구
 *   value: 현재 값
 *   onChange(next)
 *   rows: textarea 줄수 (1이면 input)
 *   maxLength
 *   required: 빈칸 검증에 포함 여부 (기본 true)
 *   onCompleteChange(boolean): 완료 여부가 바뀔 때 알림 (옵션)
 */
import { useEffect, useMemo } from 'react'

export function isFieldComplete(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function PlaceholderField({
  label,
  placeholder,
  value,
  onChange,
  rows = 2,
  maxLength = 300,
  required = true,
  onCompleteChange,
}) {
  const complete = useMemo(() => isFieldComplete(value), [value])

  useEffect(() => {
    onCompleteChange?.(complete)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete])

  const baseClass = `w-full px-3 py-2 text-sm rounded-lg border-2 focus:outline-none focus:ring-2 transition ${
    !complete && required
      ? 'border-rose-300 bg-rose-50/40 focus:ring-rose-300'
      : 'border-gray-300 focus:ring-indigo-400'
  }`

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-bold text-gray-700">{label}</label>
        {!complete && required && (
          <span className="text-[11px] text-rose-600">⚠ 빈칸을 채워 주세요</span>
        )}
      </div>
      {rows <= 1 ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={baseClass}
        />
      ) : (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={`${baseClass} resize-none`}
        />
      )}
    </div>
  )
}

export default PlaceholderField
