import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../../store/gameStore'
import { setAt } from '../../../lib/rtdb-helpers'

export const EVAL_AXES = ['논리성', '실현가능성', '주제관련성']

/** 단일 대상 평가 결과 집계 */
export function aggregateEval(ev) {
  const results = ev?.results || {}
  const arr = Object.values(results)
  const n = arr.length
  if (n === 0) return { n: 0, avgs: [0, 0, 0], comments: [] }
  const sums = [0, 0, 0]
  const comments = []
  for (const r of arr) {
    const s = Array.isArray(r.scores) ? r.scores : [0, 0, 0]
    for (let i = 0; i < 3; i++) sums[i] += Number(s[i]) || 0
    if (r.comment) comments.push({ comment: r.comment, submittedAt: r.submittedAt || 0 })
  }
  return {
    n,
    avgs: sums.map((s) => +(s / n).toFixed(1)),
    comments: comments.sort((a, b) => a.submittedAt - b.submittedAt),
  }
}

/** 다중 대상 평가 결과 집계 — evalItem.targets 배열이 있을 때 */
export function aggregateMultiTargetEval(ev) {
  if (!ev?.targets || ev.targets.length === 0) return null
  const results = ev?.results || {}
  const resultValues = Object.values(results)
  const totalSubmitted = resultValues.filter((r) => r?.perTarget).length

  const targets = ev.targets.map((t) => {
    const perList = resultValues
      .map((r) => r?.perTarget?.[t.id])
      .filter(Boolean)
    const n = perList.length
    const sums = [0, 0, 0]
    const comments = []
    for (const d of perList) {
      const s = Array.isArray(d.scores) ? d.scores : [0, 0, 0]
      for (let i = 0; i < 3; i++) sums[i] += Number(s[i]) || 0
      if (d.comment) comments.push(d.comment)
    }
    return {
      label: t.label,
      n,
      avgs: n > 0 ? sums.map((s) => +(s / n).toFixed(1)) : [0, 0, 0],
      comments,
    }
  })

  return { targets, totalSubmitted }
}

/** 3축 SVG 레이더 차트 */
export function MiniRadar({ values = [0, 0, 0], max = 5, size = 180 }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 18
  const angles = [-90, 30, 150].map((d) => (d * Math.PI) / 180)
  const point = (i, v) => {
    const ratio = Math.max(0, Math.min(1, (Number(v) || 0) / max))
    const x = cx + Math.cos(angles[i]) * r * ratio
    const y = cy + Math.sin(angles[i]) * r * ratio
    return [x, y]
  }
  const axisEnd = (i) => [cx + Math.cos(angles[i]) * r, cy + Math.sin(angles[i]) * r]
  const polyPoints = [0, 1, 2].map((i) => point(i, values[i])).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {[1, 2, 3, 4, 5].map((step) => {
        const pts = [0, 1, 2]
          .map((i) => {
            const ratio = step / max
            const x = cx + Math.cos(angles[i]) * r * ratio
            const y = cy + Math.sin(angles[i]) * r * ratio
            return `${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')
        return (
          <polygon key={step} points={pts} fill="none"
            stroke={step === max ? '#cbd5e1' : '#e5e7eb'} strokeWidth="1" />
        )
      })}
      {[0, 1, 2].map((i) => {
        const [x, y] = axisEnd(i)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#cbd5e1" strokeWidth="1" />
      })}
      <polygon points={polyPoints} fill="rgba(99,102,241,0.35)" stroke="rgb(79,70,229)" strokeWidth="2" />
      {EVAL_AXES.map((label, i) => {
        const [x, y] = axisEnd(i)
        const offX = i === 0 ? 0 : i === 1 ? 6 : -6
        const offY = i === 0 ? -6 : 12
        return (
          <text key={label} x={x + offX} y={y + offY} fontSize="10" fill="#475569"
            textAnchor={i === 0 ? 'middle' : i === 1 ? 'start' : 'end'}>
            {label}
          </text>
        )
      })}
      <text x={cx} y={cy + 4} fontSize="12" fontWeight="bold" fill="#4338ca" textAnchor="middle">
        {((values[0] + values[1] + values[2]) / 3 || 0).toFixed(1)}
      </text>
    </svg>
  )
}

/** 별점 입력 (1~5) */
function StarInput({ value, onChange, label, isCompact = false }) {
  if (isCompact) {
    return (
      <div className="flex flex-col gap-0.5 py-0.5 border-b border-violet-100/30 last:border-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 truncate" title={label}>{label}</span>
          <span className="text-[9px] sm:text-[10px] font-black text-amber-600 tabular-nums">{value ? `${value}점` : '미선택'}</span>
        </div>
        <div className="flex gap-1 justify-center bg-white/60 rounded px-1 py-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`text-xs sm:text-sm leading-none p-0.5 transition-all ${
                n <= value ? 'text-amber-500 font-bold' : 'text-slate-300 hover:text-amber-300'
              }`}
              title={`${n}점`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 w-[3.3rem] shrink-0 truncate" title={label}>{label}</span>
      <div className="flex gap-0.5 justify-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`text-xs sm:text-sm leading-none p-0.5 ${n <= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'}`}
            title={`${n}점`}>★</button>
        ))}
      </div>
      <span className="text-[9px] sm:text-[10px] tabular-nums text-slate-500 w-3 text-right">{value || 0}</span>
    </div>
  )
}

/** 다중 대상용 별점 + 코멘트 카드 */
function MultiTargetInputCard({ target, scores, comment, onScoreChange, onCommentChange }) {
  return (
    <div className="border border-violet-100 rounded-xl bg-white p-1.5 sm:p-2 shadow-sm hover:shadow transition-shadow space-y-1.5">
      <div className="flex items-center justify-between gap-1 pb-0.5 border-b border-violet-50">
        <p className="text-[11px] sm:text-xs font-black text-violet-800 truncate" title={target.label}>{target.label}</p>
        <span className="text-[8px] sm:text-[9px] font-bold text-violet-400 bg-violet-50 px-1 py-0.5 rounded shrink-0">평가</span>
      </div>
      <div className="space-y-1 bg-violet-50/50 rounded-lg p-1 sm:p-1.5">
        {EVAL_AXES.map((axis, i) => (
          <StarInput
            key={axis}
            label={axis}
            value={scores[i] || 0}
            isCompact={true}
            onChange={(v) => {
              const next = [...scores]
              next[i] = v
              onScoreChange(next)
            }}
          />
        ))}
      </div>
      <div className="space-y-0.5">
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="평가 이유 (선택, 200자 이내)"
          className="w-full px-1.5 py-1 text-[9px] sm:text-[10px] rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-300 resize-none bg-slate-50 focus:bg-white transition-colors"
        />
        <div className="flex justify-between items-center text-[7px] sm:text-[8px] text-slate-400 leading-none">
          <span className="text-slate-400 font-medium">선택 입력</span>
          <span>{comment.length}/200</span>
        </div>
      </div>
    </div>
  )
}

/** 다중 대상 결과 카드 — 숫자만 (삼각형은 종합 요약에서만) */
function MultiTargetResultCard({ data }) {
  return (
    <div className="border border-violet-200 rounded-xl bg-white px-2.5 py-2 space-y-1">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[11px] sm:text-xs font-black text-violet-800 truncate" title={data.label}>{data.label}</p>
        <span className="shrink-0 text-[9px] text-gray-400 font-semibold">{data.n}명</span>
      </div>
      {data.n === 0 ? (
        <p className="text-[10px] text-gray-400 text-center py-2">아직 평가 없음</p>
      ) : (
        <>
          <div className="flex justify-around text-center py-1">
            {EVAL_AXES.map((axis, i) => (
              <div key={axis}>
                <div className="text-[8px] text-gray-400 leading-none mb-0.5">{axis.slice(0, 2)}</div>
                <div className="text-xs sm:text-sm font-black text-violet-700 tabular-nums">{data.avgs[i].toFixed(1)}</div>
              </div>
            ))}
          </div>
          {data.comments.length > 0 && (
            <details className="text-[10px]">
              <summary className="cursor-pointer text-gray-400 hover:text-gray-600 py-0.5">
                💬 의견 {data.comments.length}개
              </summary>
              <ul className="space-y-0.5 mt-0.5 max-h-20 overflow-y-auto">
                {data.comments.map((c, i) => (
                  <li key={i} className="bg-gray-50 rounded px-1.5 py-0.5 text-gray-600">"{c}"</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}

/**
 * 발언 즉시 평가 — 학생용.
 * - 평가단(isEvaluator)만 입력 가능
 * - evalItem.targets 배열이 있으면 다중 대상 모드
 */
function SpeechEval({ evalItem, session, mode = 'live', forceInput = false }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)

  const evaluators = (session?.evaluators) || {}
  const isEvaluator = !!(myStudentId && evaluators[myStudentId])
  // 평가자 호칭 — 판결중심이면 '참관 판사', 그 외 '평가단'/'배심원단' 등 세션 설정값.
  const evaluatorLabel = session?.sideLabelOverrides?.evaluator || '평가단'

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // useState 이전에 myResult 계산 (lazy initializer에서 사용)
  const myResult = (evalItem && myStudentId) ? evalItem.results?.[myStudentId] : null

  const _draftKey = (evalItem?.id && myStudentId) ? `evalDraft_${evalItem.id}_${myStudentId}` : null

  // 단일 대상 상태 — forceInput 시 기존 제출값 → localStorage 임시 저장 순으로 복원
  const [scores, setScores] = useState(() => {
    if (forceInput && Array.isArray(myResult?.scores)) return [...myResult.scores]
    if (forceInput && !myResult && _draftKey) {
      try { const s = JSON.parse(localStorage.getItem(_draftKey)); if (s?.scores) return s.scores } catch {}
    }
    return [0, 0, 0]
  })
  const [comment, setComment] = useState(() => {
    if (forceInput && myResult?.comment) return myResult.comment
    if (forceInput && !myResult && _draftKey) {
      try { const s = JSON.parse(localStorage.getItem(_draftKey)); if (typeof s?.comment === 'string') return s.comment } catch {}
    }
    return ''
  })

  // 다중 대상 상태 — {targetId: [n,n,n]}, {targetId: str}
  const [perTargetScores, setPerTargetScores] = useState(() => {
    if (forceInput && myResult?.perTarget) {
      return Object.fromEntries(
        Object.entries(myResult.perTarget).map(([id, d]) => [id, Array.isArray(d.scores) ? [...d.scores] : [0, 0, 0]])
      )
    }
    if (forceInput && !myResult && _draftKey) {
      try { const s = JSON.parse(localStorage.getItem(_draftKey)); if (s?.perTargetScores) return s.perTargetScores } catch {}
    }
    return {}
  })
  const [perTargetComments, setPerTargetComments] = useState(() => {
    if (forceInput && myResult?.perTarget) {
      return Object.fromEntries(
        Object.entries(myResult.perTarget).map(([id, d]) => [id, d.comment || ''])
      )
    }
    if (forceInput && !myResult && _draftKey) {
      try { const s = JSON.parse(localStorage.getItem(_draftKey)); if (s?.perTargetComments) return s.perTargetComments } catch {}
    }
    return {}
  })
  const [busy, setBusy] = useState(false)

  // 자동 저장 — 입력이 바뀔 때마다 500ms 디바운스 후 localStorage에 저장
  useEffect(() => {
    if (!_draftKey || !forceInput || myResult) return
    const t = setTimeout(() => {
      try { localStorage.setItem(_draftKey, JSON.stringify({ scores, comment, perTargetScores, perTargetComments })) } catch {}
    }, 500)
    return () => clearTimeout(t)
  }, [_draftKey, forceInput, myResult, scores, comment, perTargetScores, perTargetComments])

  if (!evalItem) return null

  const isMultiTarget = (evalItem.targets || []).length > 1
  const targets = evalItem.targets || []

  const targetGridClass = useMemo(() => {
    if (targets.length === 2) return 'grid-cols-1 sm:grid-cols-2'
    if (targets.length === 3) return 'grid-cols-1 sm:grid-cols-3'
    return 'grid-cols-1 sm:grid-cols-4'
  }, [targets.length])

  const isOwnGroup = evalItem.targetGroupId && myGroupId && evalItem.targetGroupId === myGroupId
  const agg = aggregateEval(evalItem)
  const multiAgg = isMultiTarget ? aggregateMultiTargetEval(evalItem) : null

  // 단일 유효성
  const singleValid = scores.every((n) => n >= 1 && n <= 5) && comment.length <= 200

  // 다중 유효성 — 코멘트는 선택
  const multiValid = isMultiTarget && targets.every((t) => {
    const s = perTargetScores[t.id] || [0, 0, 0]
    const c = perTargetComments[t.id] || ''
    return s.every((n) => n >= 1 && n <= 5) && c.length <= 200
  })

  const submitSingle = async () => {
    if (!singleValid || busy || !myStudentId) return
    setBusy(true)
    try {
      const myGroupName = (groups && myGroupId) ? groups[myGroupId]?.name || '' : ''
      await setAt(roomCode, `debateSessions/${session.id}/speechEvals/${evalItem.id}/results/${myStudentId}`, {
        groupName: myGroupName, scores, comment: comment.trim(), submittedAt: Date.now(),
      })
      if (_draftKey) try { localStorage.removeItem(_draftKey) } catch {}
    } finally { setBusy(false) }
  }

  const submitMulti = async () => {
    if (!multiValid || busy || !myStudentId) return
    setBusy(true)
    try {
      const myGroupName = (groups && myGroupId) ? groups[myGroupId]?.name || '' : ''
      const perTarget = {}
      for (const t of targets) {
        perTarget[t.id] = {
          scores: perTargetScores[t.id] || [0, 0, 0],
          comment: (perTargetComments[t.id] || '').trim(),
        }
      }
      await setAt(roomCode, `debateSessions/${session.id}/speechEvals/${evalItem.id}/results/${myStudentId}`, {
        groupName: myGroupName, perTarget, submittedAt: Date.now(),
      })
      if (_draftKey) try { localStorage.removeItem(_draftKey) } catch {}
    } finally { setBusy(false) }
  }

  // ── 결과 모드 ──
  const shouldShowInput = forceInput
    ? (isEvaluator && !isOwnGroup)
    : (evalItem.isOpen && isEvaluator && !myResult && !isOwnGroup)
  const isForcedResult = evalItem.forceShowResult && !shouldShowInput

  if (!forceInput && (mode === 'result' || !evalItem.isOpen || isForcedResult)) {
    // 다중 대상 결과
    if (isMultiTarget && multiAgg) {
      return (
        <div className="bg-white rounded-2xl border-2 border-violet-200 p-3 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">평가 결과</span>
            <span className="text-sm font-bold flex-1 truncate">{evalItem.targetLabel}</span>
            <span className="text-[10px] text-gray-500">{multiAgg.totalSubmitted}명 평가</span>
          </div>
          {multiAgg.totalSubmitted === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">아직 제출된 평가가 없습니다.</p>
          ) : (
            <div className={`grid gap-3 ${targetGridClass}`}>
              {multiAgg.targets.map((data, i) => (
                <MultiTargetResultCard key={i} data={data} />
              ))}
            </div>
          )}
        </div>
      )
    }

    // 단일 대상 결과 — 숫자만
    return (
      <div className="bg-white rounded-2xl border-2 border-violet-200 p-3 space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">평가 결과</span>
          <span className="text-sm font-bold flex-1 truncate">{evalItem.targetLabel}</span>
          <span className="text-[10px] text-gray-500">{agg.n}명 평가</span>
        </div>
        {agg.n === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">아직 제출된 평가가 없습니다.</p>
        ) : (
          <div className="flex justify-around text-center py-1">
            {EVAL_AXES.map((axis, i) => (
              <div key={axis}>
                <div className="text-[9px] text-gray-400 leading-none mb-0.5">{axis}</div>
                <div className="text-sm font-black text-violet-700 tabular-nums">{agg.avgs[i].toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}
        {agg.comments.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-semibold py-1">
              💬 익명 코멘트 보기 ({agg.comments.length})
            </summary>
            <ul className="space-y-1 mt-1 max-h-40 overflow-y-auto">
              {agg.comments.map((c, i) => (
                <li key={i} className="bg-gray-50 rounded px-2 py-1 text-gray-700">"{c.comment}"</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }

  // ── 진행 중 (교사) ──
  if (role !== 'student') {
    return <SpeechEval evalItem={evalItem} session={session} mode="result" />
  }

  // ── 진행 중 (학생) — 평가단 아님 ──
  if (!isEvaluator) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
        <p className="text-sm font-bold text-amber-800">{evalItem.targetLabel}</p>
        <p className="text-xs text-amber-600 mt-1">{evaluatorLabel}이(가) 평가 중입니다. 잠시만 기다려 주세요.</p>
      </div>
    )
  }

  // ── 진행 중 (학생) — 내 모둠 ──
  if (isOwnGroup) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
        <p className="text-sm font-bold text-rose-800">{evalItem.targetLabel}</p>
        <p className="text-xs text-rose-600 mt-1">내 모둠 발언은 평가할 수 없어요.</p>
      </div>
    )
  }

  // ── 진행 중 (학생) — 이미 제출 (forceInput이면 수정 허용) ──
  if (!forceInput && myResult) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
        <p className="text-sm font-bold text-emerald-800">✓ 평가 완료</p>
        <p className="text-xs text-emerald-600 mt-1">"{evalItem.targetLabel}"</p>
        <p className="text-[11px] text-gray-500 mt-2">선생님이 결과를 공개할 거예요</p>
      </div>
    )
  }

  // ── 진행 중 (학생) — 다중 대상 입력 ──
  if (isMultiTarget) {
    return (
      <div className="bg-white rounded-xl border border-violet-200 shadow-sm p-2.5 space-y-1.5">
        {forceInput && myResult && (
          <div className="text-[9px] font-black text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">
            ✅ 이미 제출한 평가 — 수정 가능
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-black text-violet-600">{evaluatorLabel} 평가</p>
            <p className="text-xs font-black truncate">{evalItem.targetLabel}</p>
          </div>
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-black text-violet-700 shrink-0">
            {targets.length}명
          </span>
        </div>
        <div className={`grid gap-1.5 ${targetGridClass}`}>
          {targets.map((t) => (
            <MultiTargetInputCard
              key={t.id}
              target={t}
              scores={perTargetScores[t.id] || [0, 0, 0]}
              comment={perTargetComments[t.id] || ''}
              onScoreChange={(v) => setPerTargetScores({ ...perTargetScores, [t.id]: v })}
              onCommentChange={(v) => setPerTargetComments({ ...perTargetComments, [t.id]: v })}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={submitMulti}
          disabled={!multiValid || busy}
          className="w-full py-1.5 rounded-lg bg-violet-600 text-xs text-white font-black disabled:opacity-50 hover:bg-violet-700"
        >
          {busy ? '제출 중...' : myResult ? '수정 제출' : '평가 제출'}
        </button>
      </div>
    )
  }

  // ── 진행 중 (학생) — 단일 대상 입력 (기존) ──
  return (
    <div className="bg-white rounded-xl border border-violet-200 shadow-sm p-2.5 space-y-1.5">
      {forceInput && myResult && (
        <div className="text-[9px] font-black text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">
          ✅ 이미 제출한 평가 — 수정 가능
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black text-violet-600">{evaluatorLabel} 평가</p>
          <p className="text-xs font-black truncate">{evalItem.targetLabel}</p>
        </div>
        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-black text-violet-700 shrink-0">1명</span>
      </div>
      <div className="space-y-0.5 bg-violet-50 rounded-md px-2 py-1.5">
        {EVAL_AXES.map((axis, i) => (
          <StarInput key={axis} label={axis} value={scores[i]}
            onChange={(v) => { const next = [...scores]; next[i] = v; setScores(next) }} />
        ))}
      </div>
      <div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={200} rows={1}
          placeholder="평가 이유 (선택)"
          className="w-full px-2 py-1 text-[11px] rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
        />
        <p className="text-[9px] text-slate-400 text-right leading-none mt-0.5">{comment.length}/200</p>
      </div>
      <button type="button" onClick={submitSingle} disabled={!singleValid || busy}
        className="w-full py-1.5 rounded-lg bg-violet-600 text-xs text-white font-bold disabled:opacity-50 hover:bg-violet-700">
        {busy ? '제출 중...' : myResult ? '수정 제출' : '평가 제출'}
      </button>
    </div>
  )
}

export default SpeechEval
