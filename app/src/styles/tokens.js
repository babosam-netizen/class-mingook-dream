/**
 * 디자인 토큰 — 색상·페이즈 메타·공통 클래스를 한 곳에 모은다.
 *
 * 새 색상이나 페이즈를 추가할 때 여기만 고치면 모든 화면에 반영된다.
 * Tailwind 동적 클래스 인식 때문에 객체에 미리 풀어 둔다.
 */

// ─────────────────────────────────────
// 시민단체 토픽 색상
// ─────────────────────────────────────
export const TOPIC_COLOR_OPTIONS = [
  'emerald', 'amber', 'yellow', 'rose', 'sky', 'violet', 'indigo', 'pink', 'teal',
]

// 카드 배경 + 테두리. 학생용·교사용 카드 모두에 사용.
export const TOPIC_BG = {
  emerald: 'bg-emerald-50 border-emerald-200',
  amber:   'bg-amber-50 border-amber-200',
  yellow:  'bg-yellow-50 border-yellow-200',
  rose:    'bg-rose-50 border-rose-200',
  sky:     'bg-sky-50 border-sky-200',
  violet:  'bg-violet-50 border-violet-200',
  indigo:  'bg-indigo-50 border-indigo-200',
  pink:    'bg-pink-50 border-pink-200',
  teal:    'bg-teal-50 border-teal-200',
}

// 누락된 키에 대한 기본값
export const TOPIC_BG_FALLBACK = 'bg-gray-50 border-gray-200'

export const topicBg = (color) => TOPIC_BG[color] || TOPIC_BG_FALLBACK

// ─────────────────────────────────────
// 페이즈 메타데이터
// ─────────────────────────────────────
export const PHASE_META = {
  1: {
    label: '첫 번째 여정 — 시민 광장',
    short: '시민광장',
    pageBg: 'bg-amber-50',
    titleText: 'text-amber-800',
    accent: 'amber',
  },
  2: {
    label: '두 번째 여정 — 선거',
    short: '선거',
    pageBg: 'bg-rose-50',
    titleText: 'text-rose-700',
    accent: 'rose',
  },
  3: {
    label: '세 번째 여정 — 국정 포털',
    short: '국정포털',
    pageBg: 'bg-slate-50',
    titleText: 'text-slate-700',
    accent: 'slate',
  },
  4: {
    label: '네 번째 여정 — 시사회',
    short: '시사회',
    pageBg: 'bg-pink-50',
    titleText: 'text-pink-700',
    accent: 'pink',
  },
}

// ─────────────────────────────────────
// 자주 쓰는 카드 클래스
// ─────────────────────────────────────
export const CARD = {
  base: 'bg-white rounded-2xl shadow-sm border',
  ghost: 'bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-400',
  emphasized: 'bg-white rounded-2xl shadow border-2',
}
