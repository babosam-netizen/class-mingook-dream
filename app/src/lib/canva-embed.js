export function extractCanvaUrl(input = '') {
  const value = String(input || '').trim()
  if (!value) return ''
  if (value.includes('<iframe') || value.includes('<div')) {
    const match = value.match(/src=["']([^"']+)["']/i)
    if (match?.[1]) return match[1].trim()
  }
  return value
}

export function formatCanvaEmbedUrl(url) {
  const value = extractCanvaUrl(url)
  if (!value) return ''
  // 이미 embed 파라미터가 있으면 그대로 사용 (view?embed, watch?embed 모두 포함)
  if (value.includes('?embed')) return value
  const base = value.split('?')[0]
  if (base.includes('/design/')) {
    // /watch 또는 /view 로 끝나는 경우 — 해당 경로 그대로 ?embed 추가
    if (base.endsWith('/watch') || base.endsWith('/view')) return `${base}?embed`
    // 그 외 디자인 URL — /view?embed 추가
    return `${base}/view?embed`
  }
  return value
}
