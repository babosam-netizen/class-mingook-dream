import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt } from '../../lib/rtdb-helpers'
import { DEFAULT_EXECUTIVE_BUDGET, formatBudgetAmount, roundBudgetAmount } from './executiveBudgetData'

/**
 * 대통령 최종 승인 보드 (대통령 모둠 + 교사 공용).
 * - 예산현황판처럼 부처별 예산(초안→최종) + 추가/감액 합계를 한눈에.
 * - 진행 단계(작성중 → 발의 → 승인대기 → 승인완료)를 표시해 "지금 뭘 해야 하는지" 보여준다.
 * - 부처별 [👑 최종 승인](final) 버튼을 상태 옆에 두어 바로 승인. 행을 누르면 시행령 등 상세 펼침.
 */
function budgetItemTotal(items = []) {
  return roundBudgetAmount((Array.isArray(items) ? items : []).reduce((s, it) => s + (Number(it?.amount) || 0), 0))
}

function mergeSectionContent(sections) {
  const pf = {}
  const budget = []
  for (const sec of Object.values(sections || {})) {
    const c = sec?.content
    const spf = c?.policyFields
    if (spf && typeof spf === 'object') {
      for (const [k, v] of Object.entries(spf)) {
        if (typeof v === 'string' && v.trim() && !pf[k]) pf[k] = v
      }
    }
    if (Array.isArray(c?.budgetItems)) budget.push(...c.budgetItems)
  }
  return { policyFields: pf, budgetItems: budget }
}

const fieldsMeaningful = (pf) => pf && typeof pf === 'object' && Object.values(pf).some((v) => typeof v === 'string' && v.trim().length > 0)

// 진행 단계: 0 작성중 → 1 발의됨 → 2 승인 대기 → 3 승인 완료
const STAGES = ['작성 중', '발의됨', '승인 대기', '승인 완료']
const stageOf = (status) =>
  status === 'final' ? 3 : status === 'adjusted' ? 2 : ['submitted', 'requested'].includes(status) ? 1 : 0

function ExecutiveApprovalBoard() {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const groups = useGameStore((s) => s.groups)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const totalBudget = Number(branchConfig?.executive?.totalBudget) || DEFAULT_EXECUTIVE_BUDGET
  const presidentGroupId = branchConfig?.executive?.presidentGroupId || null

  const [policiesMap, setPoliciesMap] = useState({})
  const [draftsMap, setDraftsMap] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'policies', (d) => setPoliciesMap(d || {}))
    const u2 = subscribe(roomCode, 'branchDrafts', (d) => setDraftsMap(d || {}))
    return () => { u1?.(); u2?.() }
  }, [roomCode])

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    return Object.entries(groups || {}).find(([, g]) => g?.members?.[myStudentId])?.[0] || null
  }, [groups, myStudentId])
  const isPresident = !!myGroupId && (presidentGroupId === myGroupId || Boolean(groups?.[myGroupId]?.name?.includes('대통령')))
  const canApprove = role === 'teacher' || isPresident

  // 부처별 정책 해석 (policies → finalDoc → 섹션 폴백)
  const rows = useMemo(() => (branchConfig?.executive?.units || []).map((unit) => {
    const policy = policiesMap?.[unit.groupId] || {}
    const draft = draftsMap?.[unit.unitId] || {}
    const finalContent = draft.finalDoc?.content || {}
    const merged = mergeSectionContent(draft.sections)
    const policyFields = fieldsMeaningful(policy.policyFields)
      ? policy.policyFields
      : fieldsMeaningful(finalContent.policyFields) ? finalContent.policyFields : merged.policyFields
    const policyBudget = Array.isArray(policy.budgetItems) ? policy.budgetItems : []
    const finalBudgetItems = Array.isArray(finalContent.budgetItems) ? finalContent.budgetItems : []
    const budgetItems = policyBudget.length ? policyBudget : finalBudgetItems.length ? finalBudgetItems : merged.budgetItems
    const requested = roundBudgetAmount(
      Number(policy.requestedBudget ?? policy.draftBudget) || budgetItemTotal(policyBudget) ||
      Number(finalContent.requestedBudget ?? finalContent.draftBudget) || budgetItemTotal(finalBudgetItems) ||
      budgetItemTotal(merged.budgetItems)
    )
    const draftBudget = roundBudgetAmount(Number(policy.draftBudget) || requested)
    const finalBudget = roundBudgetAmount(Number(policy.finalBudget) || requested)
    const status = policy.status || (draft.finalDoc?.status === 'locked' ? 'submitted' : draft.finalDoc?.status || '')
    const isPres = unit.groupId === presidentGroupId || Boolean(groups?.[unit.groupId]?.name?.includes('대통령'))
    const hasContent = fieldsMeaningful(policyFields) || (budgetItems && budgetItems.length > 0) || requested > 0
    return {
      gid: unit.groupId,
      ministryName: policy.ministryName || unit.ministryName || groups?.[unit.groupId]?.name || '부처',
      groupName: groups?.[unit.groupId]?.name || '',
      policyFields: policyFields || {},
      budgetItems: budgetItems || [],
      draftBudget,
      finalBudget,
      delta: roundBudgetAmount(finalBudget - draftBudget),
      status,
      stage: stageOf(status),
      isPres,
      hasContent,
      isFinal: status === 'final',
      rejected: !!policy.rejected && status !== 'final',
      rejectReason: policy.rejectReason || '',
    }
  }), [branchConfig, policiesMap, draftsMap, groups, presidentGroupId])

  const meaningfulRows = rows.filter((r) => r.hasContent)
  // 합계는 '발의된 부처'만 반영(초안 locked 포함, 작성중/saved 제외) — 현황판과 동일 기준.
  const COUNTED = ['submitted', 'requested', 'adjusted', 'final']
  const countedRows = meaningfulRows.filter((r) => COUNTED.includes(r.status))
  const pendingCount = meaningfulRows.length - countedRows.length
  const totalDraft = roundBudgetAmount(countedRows.reduce((s, r) => s + (Number(r.draftBudget) || 0), 0))
  const totalFinal = roundBudgetAmount(countedRows.reduce((s, r) => s + (Number(r.finalBudget) || 0), 0))
  const addSum = roundBudgetAmount(countedRows.reduce((s, r) => s + Math.max(0, r.delta), 0))
  const cutSum = roundBudgetAmount(countedRows.reduce((s, r) => s + Math.max(0, -r.delta), 0))
  const diff = roundBudgetAmount(totalFinal - totalBudget)
  const isExcess = diff > 0
  const pct = totalBudget > 0 ? Math.round((totalFinal / totalBudget) * 100) : 0
  const approvedCount = countedRows.filter((r) => r.isFinal).length

  const finalize = async (gid) => {
    if (busy) return
    if (!confirm('이 부처의 정책·예산을 최종 승인할까요?\n최종 발표 목록에 확정 등록됩니다.')) return
    setBusy(true)
    try { await updateAt(roomCode, `policies/${gid}`, { status: 'final', finalizedAt: Date.now(), rejected: false, rejectReason: null }) }
    finally { setBusy(false) }
  }
  const unapprove = async (gid) => {
    if (busy) return
    if (!confirm('최종 승인을 취소할까요? (다시 수정·조정 가능 상태가 됩니다)')) return
    setBusy(true)
    try { await updateAt(roomCode, `policies/${gid}`, { status: 'adjusted', finalizedAt: null }) }
    finally { setBusy(false) }
  }
  // 반려: 틀린 정책을 사유와 함께 부처로 되돌림 → 작성중(saved) 상태로 만들어 수정·재제출하게 함
  const reject = async (gid, ministryName) => {
    if (busy) return
    const reason = prompt(`'${ministryName}' 정책을 반려합니다.\n어디를 고쳐야 하는지 사유를 적어 주세요. (부처에게 표시됩니다)`, '')
    if (reason === null) return
    setBusy(true)
    try {
      await updateAt(roomCode, `policies/${gid}`, {
        status: 'saved',
        rejected: true,
        rejectReason: reason.trim(),
        rejectedAt: Date.now(),
        finalizedAt: null,
      })
    } finally { setBusy(false) }
  }

  // 진행 단계 미니 스텝퍼
  const StageSteps = ({ stage }) => (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`w-1.5 h-1.5 rounded-full ${n <= stage ? (stage === 3 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-200'}`}
        />
      ))}
    </span>
  )

  const deltaText = (r) => {
    if (r.delta > 0) return <span className="text-rose-600 font-bold">+{formatBudgetAmount(r.delta)}억 추가</span>
    if (r.delta < 0) return <span className="text-sky-600 font-bold">−{formatBudgetAmount(-r.delta)}억 감액</span>
    return <span className="text-slate-400">변동 없음</span>
  }

  return (
    <div className="space-y-3">
      {/* 요약 헤더 */}
      <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-black text-amber-300">👑 대통령 최종 승인 보드</h3>
            <p className="text-[11px] text-white/70 mt-0.5">부처를 눌러 시행령을 확인하고, 초안 대비 조정액을 보며 승인하세요.</p>
          </div>
          <div className="flex items-center gap-3 bg-black/30 px-4 py-2 rounded-xl border border-white/10 flex-wrap">
            <div className="text-center">
              <span className="text-[10px] text-white/60 block font-bold">정부 총예산</span>
              <span className="text-sm font-black text-white">{formatBudgetAmount(totalBudget)}억</span>
            </div>
            <div className="text-center border-l border-white/10 pl-3">
              <span className="text-[10px] text-white/60 block font-bold">초안 합계</span>
              <span className="text-sm font-black text-white/80">{formatBudgetAmount(totalDraft)}억</span>
            </div>
            <div className="text-center border-l border-white/10 pl-3">
              <span className="text-[10px] text-white/60 block font-bold">최종 합계</span>
              <span className="text-sm font-black text-indigo-300">{formatBudgetAmount(totalFinal)}억</span>
            </div>
            <div className="text-center border-l border-white/10 pl-3">
              <span className="text-[10px] text-white/60 block font-bold">{isExcess ? '초과액' : '잔여액'}</span>
              <span className={`text-sm font-black ${isExcess ? 'text-rose-400' : 'text-emerald-400'}`}>{formatBudgetAmount(Math.abs(diff))}억 {isExcess ? '⚠️' : '✅'}</span>
            </div>
          </div>
        </div>
        {/* 추가/감액 합계 */}
        <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
          <span className="rounded-full bg-rose-500/20 text-rose-200 px-2.5 py-1 font-bold">추가 합계 +{formatBudgetAmount(addSum)}억</span>
          <span className="rounded-full bg-sky-500/20 text-sky-200 px-2.5 py-1 font-bold">감액 합계 −{formatBudgetAmount(cutSum)}억</span>
          <span className="rounded-full bg-white/10 text-white/80 px-2.5 py-1 font-bold">순변동 {totalFinal - totalDraft >= 0 ? '+' : '−'}{formatBudgetAmount(Math.abs(totalFinal - totalDraft))}억</span>
          <span className="ml-auto rounded-full bg-emerald-500/20 text-emerald-200 px-2.5 py-1 font-bold">승인 {approvedCount}/{countedRows.length} 부처 · {pct}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full ${isExcess ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="mt-1.5 text-[10px] text-white/50">
          ※ 합계는 <b className="text-white/80">발의(제출)된 부처</b>만 반영합니다(총예산 현황판과 동일 기준).{pendingCount > 0 ? ` 아직 작성중인 ${pendingCount}개 부처는 합계에서 제외됩니다.` : ''}
        </p>
      </div>

      {!canApprove && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 font-bold text-center">
          승인은 대통령 모둠과 교사만 할 수 있습니다. (열람만 가능)
        </p>
      )}

      {/* 부처 목록 — 간략 행 + 펼침 */}
      <ul className="space-y-2">
        {meaningfulRows.length === 0 ? (
          <li className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">아직 제출된 부처 정책이 없습니다.</li>
        ) : meaningfulRows.map((r) => {
          const f = r.policyFields
          const open = expanded === r.gid
          return (
            <li key={r.gid} className={`rounded-xl border-2 bg-white overflow-hidden ${r.rejected ? 'border-rose-300' : r.isFinal ? 'border-emerald-300' : 'border-slate-200'}`}>
              {/* 간략 행 */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" onClick={() => setExpanded(open ? null : r.gid)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  <span className={`text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                  <span className="min-w-0">
                    <span className="font-black text-slate-800 text-sm block truncate">
                      {r.isPres ? '👑' : '🏢'} {r.ministryName}
                      {r.groupName && <span className="ml-1 font-medium text-slate-400 text-[10px]">({r.groupName})</span>}
                    </span>
                    {/* 진행 단계 */}
                    <span className="flex items-center gap-1.5 mt-0.5">
                      {r.rejected ? (
                        <span className="text-[10px] font-black text-rose-600">🔴 반려됨 · 수정 필요</span>
                      ) : (
                        <>
                          <StageSteps stage={r.stage} />
                          <span className={`text-[10px] font-black ${r.stage === 3 ? 'text-emerald-600' : r.stage >= 1 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {r.stage}단계 · {STAGES[r.stage]}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </button>

                {/* 예산 초안→최종 + 승인 버튼 */}
                <div className="shrink-0 flex items-center gap-2">
                  <div className="text-right leading-tight">
                    <div className="text-[10px] text-slate-400 tabular-nums">초안 {formatBudgetAmount(r.draftBudget)}억 → <b className="text-slate-700">최종 {formatBudgetAmount(r.finalBudget)}억</b></div>
                    <div className="text-[10px]">{COUNTED.includes(r.status) ? deltaText(r) : <span className="text-slate-400">작성중 · 합계 미포함</span>}</div>
                  </div>
                  {canApprove && (
                    r.isFinal ? (
                      <button onClick={() => unapprove(r.gid)} disabled={busy} className="shrink-0 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 hover:bg-white disabled:opacity-40">✅ 승인됨</button>
                    ) : (
                      <div className="shrink-0 flex flex-col gap-1">
                        <button onClick={() => finalize(r.gid)} disabled={busy} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700 disabled:opacity-40">👑 최종 승인</button>
                        <button onClick={() => reject(r.gid, r.ministryName)} disabled={busy} className="rounded-lg border border-rose-300 px-2.5 py-1 text-[10px] font-black text-rose-600 bg-white hover:bg-rose-50 disabled:opacity-40">↩️ 반려</button>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* 펼침 상세 */}
              {open && (
                <div className="border-t border-slate-100 px-3 py-3 space-y-2 bg-slate-50/60">
                  {r.rejected && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                      <b>🔴 반려 사유:</b> {r.rejectReason || '(사유 미입력) — 부처가 수정 후 다시 제출해야 합니다.'}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                      <p className="font-black text-violet-800 mb-0.5">📜 시행령(초안)</p>
                      <p className="whitespace-pre-wrap text-slate-700">{f.ordinance || '미작성'}</p>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                      <p className="font-black text-sky-800 mb-0.5">📌 집행계획</p>
                      <p className="whitespace-pre-wrap text-slate-700">{f.content || '미작성'}</p>
                    </div>
                  </div>
                  {(f.title || f.problem || f.targetCitizens) && (
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs space-y-0.5">
                      {f.title && <p><b className="text-slate-500">정책명:</b> {f.title}</p>}
                      {f.problem && <p className="whitespace-pre-wrap"><b className="text-slate-500">문제:</b> {f.problem}</p>}
                      {f.targetCitizens && <p className="whitespace-pre-wrap"><b className="text-slate-500">대상:</b> {f.targetCitizens}</p>}
                    </div>
                  )}
                  {r.budgetItems.length > 0 && (
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                      <p className="font-black text-lime-700 mb-1">📊 예산 항목 (초안 {formatBudgetAmount(r.draftBudget)}억 → 최종 {formatBudgetAmount(r.finalBudget)}억)</p>
                      <ul className="space-y-0.5">
                        {r.budgetItems.map((it, i) => (
                          <li key={it.id || i} className="flex justify-between gap-2 text-slate-700">
                            <span className="truncate">- {it.title || `항목 ${i + 1}`}{it.note ? ` · ${it.note}` : ''}</span>
                            <span className="font-bold tabular-nums shrink-0">{formatBudgetAmount(it.amount)}억</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ExecutiveApprovalBoard
