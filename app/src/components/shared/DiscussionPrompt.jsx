/**
 * 페이즈별 토론 주제 가이드 박스 — 학생들에게 ‘오늘 우리가 토론할 질문’을 명시.
 *
 * props:
 *   question: string  주제 질문
 *   subline?: string  부가 설명
 *   tone?: 'amber'|'rose'|'slate'|'blue'|'pink' (페이즈 색상)
 */
const TONE = {
  amber: 'bg-amber-50 border-amber-300 text-amber-900',
  rose:  'bg-rose-50  border-rose-300  text-rose-900',
  slate: 'bg-slate-50 border-slate-300 text-slate-900',
  blue:  'bg-blue-50  border-blue-300  text-blue-900',
  pink:  'bg-pink-50  border-pink-300  text-pink-900',
}

function DiscussionPrompt({ question, subline, tone = 'amber' }) {
  return (
    <div className={`rounded-xl border-2 p-3 ${TONE[tone] || TONE.amber}`}>
      <div className="text-xs font-semibold mb-0.5">💬 오늘의 토론 주제</div>
      <p className="text-base font-bold leading-snug">{question}</p>
      {subline && <p className="text-xs mt-1 opacity-80">{subline}</p>}
    </div>
  )
}

export default DiscussionPrompt
