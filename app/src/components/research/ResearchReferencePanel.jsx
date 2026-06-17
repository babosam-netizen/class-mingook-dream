import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'

const ACCENTS = {
  rose:  { border: 'border-rose-100', bg: 'bg-rose-50/70', text: 'text-rose-900', soft: 'text-rose-700', line: 'border-rose-200' },
  indigo:{ border: 'border-indigo-100', bg: 'bg-indigo-50/70', text: 'text-indigo-900', soft: 'text-indigo-700', line: 'border-indigo-200' },
  amber: { border: 'border-amber-100', bg: 'bg-amber-50/70', text: 'text-amber-900', soft: 'text-amber-700', line: 'border-amber-200' },
  slate: { border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-900', soft: 'text-slate-600', line: 'border-slate-200' },
}

const toList = (map = {}) => Object.entries(map || {}).map(([id, value]) => ({ id, ...value }))

function ResearchReferencePanel({
  contextKey,
  groupId,
  title = '준비 단계에서 모은 자료',
  emptyMessage = '아직 준비 단계에서 모은 자료가 없습니다.',
  accent = 'slate',
  defaultOpen = true,
  compact = false,
}) {
  const roomCode = useGameStore((s) => s.roomCode)
  const [plan, setPlan] = useState({})
  const [open, setOpen] = useState(defaultOpen)
  const theme = ACCENTS[accent] || ACCENTS.slate

  useEffect(() => {
    if (!roomCode || !contextKey || !groupId) return undefined
    return subscribe(roomCode, `researchPlans/${contextKey}/${groupId}`, (d) => setPlan(d || {}))
  }, [roomCode, contextKey, groupId])

  const targets = useMemo(() =>
    toList(plan.targets)
      .map((target) => ({ ...target, title: target.title || target.label || target.name || '자료 목록' }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
  [plan.targets])

  const items = useMemo(() =>
    toList(plan.items)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  [plan.items])

  const itemsByTarget = useMemo(() => items.reduce((acc, item) => {
    const key = item.targetId || 'uncategorized'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {}), [items])

  const hasContent = targets.length > 0 || items.length > 0

  return (
    <section className={`rounded-2xl border ${theme.border} ${theme.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs font-black ${theme.text} hover:bg-white/50 transition`}
      >
        <span>📚 {title}</span>
        <span className="shrink-0 text-[11px] font-bold">
          목록 {targets.length}개 · 자료 {items.length}개 {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className={`px-3 pb-3 ${compact ? 'max-h-72' : 'max-h-96'} overflow-y-auto space-y-2`}>
          {!hasContent ? (
            <p className={`rounded-xl border border-dashed ${theme.line} bg-white/75 p-3 text-xs ${theme.soft}`}>
              {emptyMessage}
            </p>
          ) : (
            <>
              {targets.map((target) => {
                const targetItems = itemsByTarget[target.id] || []
                return (
                  <article key={target.id} className="rounded-xl border border-white/70 bg-white p-2 text-xs shadow-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-black text-slate-800 break-words">{target.title}</p>
                      <span className={`shrink-0 text-[10px] font-bold ${theme.soft}`}>{targetItems.length}개</span>
                    </div>
                    {targetItems.length === 0 ? (
                      <p className="mt-1 text-[11px] text-slate-400">아직 이 목록에 연결된 자료가 없습니다.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {targetItems.map((item) => <ResearchItem key={item.id} item={item} theme={theme} />)}
                      </ul>
                    )}
                  </article>
                )
              })}
              {itemsByTarget.uncategorized?.length > 0 && (
                <article className="rounded-xl border border-white/70 bg-white p-2 text-xs shadow-sm">
                  <p className="font-black text-slate-800">목록 밖 자료</p>
                  <ul className="mt-2 space-y-1.5">
                    {itemsByTarget.uncategorized.map((item) => <ResearchItem key={item.id} item={item} theme={theme} />)}
                  </ul>
                </article>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function ResearchItem({ item, theme }) {
  const idea = item.idea || item.memo || item.note || ''
  const summary = item.summary || ''
  return (
    <li className={`border-l-2 ${theme.line} pl-2 py-1 rounded-r-lg bg-slate-50/70`}>
      <a href={item.url} target="_blank" rel="noreferrer" className="font-bold text-sky-700 hover:underline break-words">
        {item.title || item.url || '자료 링크'}
      </a>
      <p className="mt-0.5 text-[10px] text-slate-400">
        {item.source || '출처 미입력'} · {item.submitterLabel || '모둠원'}
        {item.sourceType ? ` · ${item.sourceType}` : ''}
        {item.stanceType ? ` · ${item.stanceType}` : ''}
      </p>
      {summary && idea && (
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-500">
          <span className="font-bold text-slate-600">기사 요약: </span>{summary}
        </p>
      )}
      {(idea || summary) && (
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">
          <span className={`font-bold ${theme.soft}`}>떠오른 아이디어: </span>{idea || summary}
        </p>
      )}
    </li>
  )
}

export default ResearchReferencePanel
