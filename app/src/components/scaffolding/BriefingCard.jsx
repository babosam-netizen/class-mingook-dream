/**
 * 브리핑 카드 — 한 장의 ‘5분 약도’를 표시.
 *
 * props:
 *   data: { id, title, intro, steps:[{label,body}], keyTitle, keyDesc, keys:[{label,body}], oneLiner }
 *   tone: 'slate'|'amber'|'rose'|'emerald'
 */
const TONE = {
  slate:   'border-slate-300 bg-slate-50',
  amber:   'border-amber-300 bg-amber-50',
  rose:    'border-rose-300 bg-rose-50',
  emerald: 'border-emerald-300 bg-emerald-50',
  indigo:  'border-indigo-300 bg-indigo-50',
}

function BriefingCard({ data, tone = 'slate' }) {
  if (!data) return null
  return (
    <article className={`rounded-2xl border-2 p-5 shadow-sm ${TONE[tone] || TONE.slate}`}>
      <h2 className="text-xl font-bold mb-3">{data.title}</h2>

      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-700">{data.intro}</h3>
        <ol className="mt-2 space-y-1.5">
          {(data.steps || []).map((s, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="font-bold w-20 shrink-0">{i + 1}. {s.label}</span>
              <span className="flex-1">{s.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-4 pt-3 border-t border-white/60">
        <h3 className="text-sm font-bold text-gray-700">{data.keyTitle}</h3>
        {data.keyDesc && (
          <p className="text-xs text-gray-600 mt-0.5">{data.keyDesc}</p>
        )}
        <ul className="mt-2 space-y-1.5">
          {(data.keys || []).map((k, i) => (
            <li key={i} className="bg-white/70 rounded-lg p-2 text-sm">
              <strong>{k.label}</strong> — {k.body}
            </li>
          ))}
        </ul>
      </section>

      {data.oneLiner && (
        <section className="pt-3 border-t border-white/60">
          <p className="text-sm font-bold italic">💡 {data.oneLiner}</p>
        </section>
      )}
    </article>
  )
}

export default BriefingCard
