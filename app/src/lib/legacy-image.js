/**
 * 레거시 이미지 URL 해석기.
 *
 * 과거 NAS 업로드(upload.php, v1.7.33에 폐지) 시절 저장된 이미지 주소는
 * `<배포서버>/class_democra/uploads/<해시>.jpg` 같은 절대주소다.
 * 호스팅을 Cloudflare로 옮기면서 이미지 파일을 앱의 public/uploads/ 에 함께 배포하므로,
 * 렌더링 시점에 `.../uploads/<파일>` 형태 주소를 새 위치(VITE_UPLOADS_BASE, 기본 '/uploads')로
 * 자동 치환한다. → DB는 손대지 않고 기존 이미지가 그대로 보인다.
 *
 * Canva 임베드·외부 이미지 URL 등 '/uploads/'가 없는 주소는 그대로 통과시킨다.
 */
const UPLOADS_BASE = (import.meta.env.VITE_UPLOADS_BASE || '/uploads').replace(/\/$/, '')

export function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return url
  const m = url.match(/\/uploads\/([^/?#]+)(?:[?#].*)?$/)
  if (!m) return url
  return `${UPLOADS_BASE}/${m[1]}`
}
