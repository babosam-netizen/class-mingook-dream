import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, subscribe, updateAt } from '../../lib/rtdb-helpers'
import { DEFAULT_EXECUTIVE_BUDGET, formatBudgetAmount, roundBudgetAmount, totalFinalBudget, totalRequestedBudget } from './executiveBudgetData'

function ExecutiveCabinetPanel() {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const [policiesMap, setPoliciesMap] = useState({})
  const [draftsMap, setDraftsMap] = useState({})
  const [commentsMap, setCommentsMap] = useState({})
  const [briefingsMap, setBriefingsMap] = useState({})
  const [summary, setSummary] = useState('')
  const [questions, setQuestions] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [busy, setBusy] = useState(false)

  const totalBudget = Number(branchConfig?.executive?.totalBudget) || DEFAULT_EXECUTIVE_BUDGET

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'policies', (d) => setPoliciesMap(d || {}))
    const u2 = subscribe(roomCode, 'executivePolicyComments', (d) => setCommentsMap(d || {}))
    const u3 = subscribe(roomCode, 'executiveBriefings', (d) => setBriefingsMap(d || {}))
    const u4 = subscribe(roomCode, 'branchDrafts', (d) => setDraftsMap(d || {}))
    return () => { u1?.(); u2?.(); u3?.(); u4?.() }
  }, [roomCode])

  // 발의된 부처를 policies → 초안(finalDoc)·섹션 폴백으로 해석한다.
  // (대통령실처럼 policies에 저장 안 되고 finalDoc만 locked인 경우도 합계에 포함해 승인 보드와 일치시킴)
  const policies = useMemo(() => {
    const itemTotal = (arr) => (Array.isArray(arr) ? arr : []).reduce((s, it) => s + (Number(it?.amount) || 0), 0)
    const mergeSecBudget = (secs) => Object.values(secs || {}).flatMap((s) => Array.isArray(s?.content?.budgetItems) ? s.content.budgetItems : [])
    const COUNTED = ['submitted', 'requested', 'adjusted', 'final']
    const byGroup = {}
    // 1) policies에 발의된 부처
    for (const [gid, p] of Object.entries(policiesMap || {})) {
      if (COUNTED.includes(p?.status)) byGroup[gid] = { gid, ...p }
    }
    // 2) policies엔 없지만 초안 finalDoc이 locked(발의 완료)인 부처(예: 대통령실) 보강
    for (const unit of (branchConfig?.executive?.units || [])) {
      const gid = unit.groupId
      if (byGroup[gid]) continue
      const draft = draftsMap?.[unit.unitId] || {}
      if (draft?.finalDoc?.status !== 'locked') continue
      const fc = draft.finalDoc?.content || {}
      const budgetItems = Array.isArray(fc.budgetItems) && fc.budgetItems.length ? fc.budgetItems : mergeSecBudget(draft.sections)
      const requestedBudget = Number(fc.requestedBudget ?? fc.draftBudget) || itemTotal(budgetItems)
      byGroup[gid] = {
        gid,
        ministryName: unit.ministryName || '',
        policyFields: fc.policyFields || {},
        budgetItems,
        requestedBudget,
        draftBudget: requestedBudget,
        finalBudget: requestedBudget,
        status: 'submitted',
      }
    }
    return Object.values(byGroup)
      .sort((a, b) => (Number(b.requestedBudget ?? b.draftBudget) || 0) - (Number(a.requestedBudget ?? a.draftBudget) || 0))
  }, [policiesMap, draftsMap, branchConfig])
  const comments = useMemo(() => Object.values(commentsMap || {}), [commentsMap])
  const briefings = useMemo(() => Object.entries(briefingsMap)
    .map(([id, b]) => ({ id, ...b }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [briefingsMap])
  const requestedTotal = totalRequestedBudget(policies)
  const finalTotal = totalFinalBudget(policies)
  const diff = roundBudgetAmount(requestedTotal - totalBudget)
  const finalDiff = roundBudgetAmount(finalTotal - totalBudget)

  const statsFor = (policyId) => {
    const list = comments.filter((c) => c.policyId === policyId)
    const avg = (key) => list.length ? Math.round((list.reduce((s, c) => s + (Number(c.ratings?.[key]) || 0), 0) / list.length) * 10) / 10 : 0
    return {
      count: list.length,
      pro: list.filter((c) => c.stance === '찬성').length,
      con: list.filter((c) => c.stance === '반대').length,
      neutral: list.filter((c) => c.stance === '중립').length,
      relevance: avg('relevance'),
      feasibility: avg('feasibility'),
      publicGood: avg('publicGood'),
    }
  }

  const saveBriefing = async () => {
    if (!summary.trim() || busy) return
    setBusy(true)
    try {
      await pushUnder(roomCode, 'executiveBriefings', {
        authorType: role === 'teacher' ? 'teacher' : 'evaluator',
        summary: summary.trim(),
        cabinetQuestions: questions.split('\n').map((q) => q.trim()).filter(Boolean),
        recommendation: recommendation.trim(),
        createdAt: Date.now(),
      })
      setSummary('')
      setQuestions('')
      setRecommendation('')
    } finally {
      setBusy(false)
    }
  }

  const updateFinalBudget = async (policy, value) => {
    await updateAt(roomCode, `policies/${policy.gid}`, {
      finalBudget: Number(value) || 0,
      status: 'adjusted',
      adjustedAt: Date.now(),
    })
  }

  const finalizePolicy = async (policy) => {
    await updateAt(roomCode, `policies/${policy.gid}`, { status: 'final', finalizedAt: Date.now() })
  }

  return (
    <div className="space-y-4">
      <section className="grid md:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border-2 border-violet-200 p-4">
          <p className="text-xs font-bold text-violet-500">정부 전체 예산</p>
          <p className="text-3xl font-black text-violet-900">{formatBudgetAmount(totalBudget)}억</p>
        </div>
        <div className={`rounded-2xl bg-white border-2 p-4 ${diff > 0 ? 'border-rose-200' : diff < 0 ? 'border-sky-200' : 'border-emerald-200'}`}>
          <p className="text-xs font-bold text-slate-500">총 청구액</p>
          <p className="text-3xl font-black text-slate-900">{formatBudgetAmount(requestedTotal)}억</p>
          <p className={`text-xs font-bold ${diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-sky-600' : 'text-emerald-600'}`}>
            {diff > 0 ? `${formatBudgetAmount(diff)}억 초과: 줄일 곳을 찾아야 합니다.` : diff < 0 ? `${formatBudgetAmount(Math.abs(diff))}억 잔여: 더 배정할 곳을 찾아야 합니다.` : '정부 예산에 맞았습니다.'}
          </p>
        </div>
        <div className={`rounded-2xl bg-white border-2 p-4 ${finalDiff === 0 ? 'border-emerald-200' : 'border-amber-200'}`}>
          <p className="text-xs font-bold text-slate-500">최종 배정 합계</p>
          <p className="text-3xl font-black text-slate-900">{formatBudgetAmount(finalTotal)}억</p>
          <p className="text-xs font-bold text-amber-600">{finalDiff === 0 ? '최종 예산안 균형' : `${formatBudgetAmount(Math.abs(finalDiff))}억 ${finalDiff > 0 ? '초과' : '잔여'}`}</p>
        </div>
      </section>

      {(role === 'teacher') && (
        <section className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-4 space-y-3">
          <h3 className="font-black text-sky-900">토의 결과·예산 조정 메모 작성</h3>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={600} placeholder="온라인 정책토의 결과를 요약해 주세요. 가장 논쟁적인 정책, 높은 평가를 받은 정책, 예산 조정 쟁점을 정리합니다." className="w-full resize-none rounded-xl border border-sky-200 px-3 py-2 text-sm" />
          <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={3} maxLength={400} placeholder="국무회의 질문을 줄바꿈으로 적어 주세요." className="w-full resize-none rounded-xl border border-sky-200 px-3 py-2 text-sm" />
          <input value={recommendation} onChange={(e) => setRecommendation(e.target.value)} maxLength={200} placeholder="권고: 유지 / 증액 / 감액 / 재검토 등" className="w-full rounded-xl border border-sky-200 px-3 py-2 text-sm" />
          <button onClick={saveBriefing} disabled={busy || !summary.trim()} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">조정 메모 저장</button>
        </section>
      )}

      {briefings.length > 0 && (
        <section className="rounded-2xl border border-sky-200 bg-white p-4 space-y-2">
          <h3 className="font-black text-sky-900">최근 토의 결과·조정 메모</h3>
          {briefings.slice(0, 3).map((b) => (
            <div key={b.id} className="rounded-xl bg-sky-50 p-3 text-sm">
              <p className="whitespace-pre-wrap text-slate-700">{b.summary}</p>
              {b.cabinetQuestions?.length > 0 && <p className="mt-1 text-xs text-sky-700">질문: {b.cabinetQuestions.join(' / ')}</p>}
              {b.recommendation && <p className="mt-1 text-xs font-bold text-sky-800">권고: {b.recommendation}</p>}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        {policies.map((p) => {
          const f = p.policyFields || {}
          const s = statsFor(p.gid)
          const requested = roundBudgetAmount(Number(p.requestedBudget ?? p.draftBudget) || 0)
          const finalBudget = roundBudgetAmount(Number(p.finalBudget ?? requested) || 0)
          const budgetItems = Array.isArray(p.budgetItems) ? p.budgetItems : []
          return (
            <article key={p.gid} className="rounded-2xl border-2 border-violet-200 bg-white p-4 space-y-3">
              <header className="flex justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-black text-violet-950">{p.ministryName || p.groupName} — {f.title || '집행계획명 미입력'}</h3>
                  <p className="text-xs text-slate-500">찬성 {s.pro} · 반대 {s.con} · 중립 {s.neutral} · 평가 {s.count}개</p>
                </div>
                <div className="text-right text-xs">
                  <p>청구 <b>{formatBudgetAmount(requested)}억</b></p>
                  <p>최종 <b>{formatBudgetAmount(finalBudget)}억</b></p>
                </div>
              </header>
              <div className="grid md:grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl bg-amber-50 p-2">관련성 <b>{s.relevance}</b></div>
                <div className="rounded-xl bg-emerald-50 p-2">실행가능성 <b>{s.feasibility}</b></div>
                <div className="rounded-xl bg-sky-50 p-2">공익성 <b>{s.publicGood}</b></div>
              </div>
              {f.linkedBillTitle && <p className="rounded-xl bg-indigo-50 p-3 text-sm whitespace-pre-wrap"><b>근거 법령</b><br />{f.linkedBillTitle}</p>}
              <p className="rounded-xl bg-slate-50 p-3 text-sm whitespace-pre-wrap"><b>집행계획</b><br />{f.content || '집행계획 미입력'}</p>
              <p className="rounded-xl bg-fuchsia-50 p-3 text-sm whitespace-pre-wrap"><b>시행령 초안</b><br />{f.ordinance || '미입력'}</p>
              <p className="rounded-xl bg-emerald-50 p-3 text-sm whitespace-pre-wrap"><b>기대효과</b><br />{f.expectedEffect || '미입력'}</p>
              {budgetItems.length > 0 && (
                <div className="rounded-xl bg-lime-50 p-3 text-sm">
                  <b>예산 항목</b>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    {budgetItems.map((item, idx) => (
                      <li key={item.id || idx}>- {item.title || `항목 ${idx + 1}`}: <b>{formatBudgetAmount(item.amount)}억</b>{item.note ? ` · ${item.note}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
              {role === 'teacher' && (
                <div className="flex items-center gap-2 flex-wrap rounded-xl bg-violet-50 p-3">
                  <label className="text-xs font-bold text-violet-800">최종 배정 예산</label>
                  <input type="number" min={0} defaultValue={finalBudget} onBlur={(e) => updateFinalBudget(p, e.target.value)} className="w-28 rounded-lg border px-2 py-1 text-right text-sm" />
                  <span className="text-xs text-violet-600">억 원</span>
                  <button onClick={() => finalizePolicy(p)} className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">최종안 확정</button>
                </div>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}

export default ExecutiveCabinetPanel
