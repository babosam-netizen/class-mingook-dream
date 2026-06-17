import { useEffect, useState, useMemo } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt } from '../../lib/rtdb-helpers'
import { formatBudgetAmount, roundBudgetAmount } from './executiveBudgetData'

function budgetItemTotal(items = []) {
  return roundBudgetAmount(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
}

/**
 * 행정부 6단계: 정책 및 예산안 최종 수정 전용 폼
 * 국무회의 토론 후 최종 합의된 내용을 반영할 수 있도록 기존 작성 폼과 분리된 독립 컴포넌트.
 *
 * - 집행계획 고정: 최초 설정된 정책명과 집행계획 등 핵심 내용은 상단에 고정 노출(읽기 전용).
 * - 집중 수정: 수정이 잦은 시행령 초안과 예산안(계산기 포함), 토론 반영 사항 입력칸만 노출.
 * - 대통령/장관 최종 승인 워크플로 버튼 제공.
 */
function ExecutivePolicyFinalEdit({ groupId }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)

  const [rawPolicy, setRawPolicy] = useState(null)
  const [finalDoc, setFinalDoc] = useState(null)
  const [fields, setFields] = useState({ ordinance: '', discussionReflection: '' })
  const [budgetItems, setBudgetItems] = useState([])
  const [requestedBudget, setRequestedBudget] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [activeBudgetIndex, setActiveBudgetIndex] = useState(0)

  const unitId = useMemo(
    () => (branchConfig?.executive?.units || []).find((u) => u.groupId === groupId)?.unitId || null,
    [branchConfig, groupId]
  )

  // policies/{groupId} 구독
  useEffect(() => {
    if (!roomCode || !groupId) return
    const u = subscribe(roomCode, `policies/${groupId}`, (d) => setRawPolicy(d || null))
    return () => u?.()
  }, [roomCode, groupId])

  // 초안(finalDoc) 구독 — policies가 아직 없을 때 폴백 로드용(대통령실 등)
  useEffect(() => {
    if (!roomCode || !unitId) { setFinalDoc(null); return }
    const u = subscribe(roomCode, `branchDrafts/${unitId}/finalDoc`, (d) => setFinalDoc(d || null))
    return () => u?.()
  }, [roomCode, unitId])

  // policies 우선, 없으면 발의된 초안(finalDoc) 폴백 → policies 미기록 부처도 바로 수정 가능
  const policy = useMemo(() => {
    if (rawPolicy) return rawPolicy
    const fc = finalDoc?.content
    const meaningful = fc && Object.values(fc.policyFields || {}).some((v) => typeof v === 'string' && v.trim())
    if (fc && (finalDoc.status === 'locked' || meaningful)) {
      return { ...fc, groupId, branchUnitId: unitId, status: finalDoc.status === 'locked' ? 'submitted' : 'saved' }
    }
    return null
  }, [rawPolicy, finalDoc, groupId, unitId])

  // 폼 초기화 — 편집 중이 아닐 때만(원격 덮어쓰기 방지)
  useEffect(() => {
    if (dirty || !policy) return
    const pf = policy.policyFields || {}
    setFields({ ordinance: pf.ordinance || '', discussionReflection: pf.discussionReflection || '' })
    setBudgetItems(Array.isArray(policy.budgetItems) ? policy.budgetItems : [])
    setRequestedBudget(roundBudgetAmount(policy.requestedBudget ?? policy.draftBudget))
  }, [policy, dirty])

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    return Object.entries(groups || {}).find(([, g]) => g?.members?.[myStudentId])?.[0] || null
  }, [groups, myStudentId])

  const myGroup = groups?.[myGroupId]
  const isMine = groupId === myGroupId
  const isPresident = myGroup?.name?.includes('대통령') || branchConfig?.executive?.presidentGroupId === myGroupId
  const canEdit = role === 'teacher' || isMine || isPresident

  const pf = policy?.policyFields || {}
  const ministryName = policy?.ministryName || groups?.[groupId]?.name || '부처'
  const isFinal = policy?.status === 'final'
  const isAdjusted = policy?.status === 'adjusted'

  const budgetItemsTotal = useMemo(() => {
    return budgetItemTotal(budgetItems)
  }, [budgetItems])

  const patchField = (key, val) => {
    setFields((prev) => ({ ...prev, [key]: val }))
    setDirty(true)
  }

  const setBudgetItemAmount = (idx, val) => {
    const next = [...budgetItems]
    next[idx] = { ...next[idx], amount: Number(val) || 0 }
    setBudgetItems(next)
    setDirty(true)
    const sum = budgetItemTotal(next)
    setRequestedBudget(sum)
  }

  const patchBudgetItem = (key, val) => {
    const next = [...budgetItems]
    next[activeBudgetIndex] = { ...next[activeBudgetIndex], [key]: val }
    setBudgetItems(next)
    setDirty(true)
  }

  const addBudgetItem = () => {
    const next = [...budgetItems, { id: 'item_' + Date.now(), title: '', amount: 0, note: '' }]
    setBudgetItems(next)
    setActiveBudgetIndex(next.length - 1)
    setDirty(true)
    setRequestedBudget(budgetItemTotal(next))
  }

  const removeBudgetItem = (idx) => {
    const next = budgetItems.filter((_, i) => i !== idx)
    setBudgetItems(next)
    setActiveBudgetIndex(Math.max(0, idx - 1))
    setDirty(true)
    const sum = budgetItemTotal(next)
    setRequestedBudget(sum)
  }

  const openCalculatorWindow = () => {
    alert('최종 수정 단계에서는 항목별 산출내역과 금액을 직접 수정해 주세요.\n예: 홍보물 제작비 / 500부 x 2만원 x 1회 / 0.1억')
  }

  const handleSaveAdjusted = async () => {
    if (busy) return
    setBusy(true)
    try {
      await updateAt(roomCode, `policies/${groupId}`, {
        policyFields: {
          ...pf,
          ordinance: fields.ordinance,
          discussionReflection: fields.discussionReflection,
        },
        budgetItems,
        requestedBudget,
        finalBudget: requestedBudget,
        status: 'adjusted',
        adjustedAt: Date.now(),
      })
      setDirty(false)
      alert('최종 수정안이 저장되었습니다. (대통령 모둠 승인 대기)')
    } finally {
      setBusy(false)
    }
  }

  const handlePresidentApproval = async () => {
    if (!confirm(`'${pf.title || ministryName}' 정책과 예산안을 최종 승인하시겠습니까?\n최종 발표 목록에 등록됩니다.`)) return
    if (busy) return
    setBusy(true)
    try {
      // 저장되지 않은 변경사항이 있으면 먼저 저장
      if (dirty) {
        await updateAt(roomCode, `policies/${groupId}`, {
          policyFields: {
            ...pf,
            ordinance: fields.ordinance,
            discussionReflection: fields.discussionReflection,
          },
          budgetItems,
          requestedBudget,
          finalBudget: requestedBudget,
        })
        setDirty(false)
      }
      await updateAt(roomCode, `policies/${groupId}`, {
        status: 'final',
        finalizedAt: Date.now(),
      })
      alert('대통령 최종 승인이 완료되었습니다. (발표 확정)')
    } finally {
      setBusy(false)
    }
  }

  if (!policy) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        아직 작성된 정책 초안이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-3xl border-2 border-violet-300 bg-white p-6 md:p-8 shadow-xl font-sans">
      {/* 대통령/교사 반려 안내 */}
      {policy?.rejected && !isFinal && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-black">🔴 대통령 모둠이 우리 정책을 반려했습니다. 아래 사유를 보고 고친 뒤 다시 제출하세요.</p>
          {policy.rejectReason && <p className="mt-1 whitespace-pre-wrap"><b>반려 사유:</b> {policy.rejectReason}</p>}
        </div>
      )}
      {/* 상단 헤더 */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-violet-100 pb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl font-black text-violet-950 tracking-tight">
              🏢 {ministryName}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isFinal ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              isAdjusted ? 'bg-amber-100 text-amber-800 border-amber-300' :
              'bg-violet-100 text-violet-800 border-violet-300'
            }`}>
              {isFinal ? '✅ 대통령 최종 승인 완료' : isAdjusted ? '⏳ 대통령 승인 대기중' : '✏️ 최종 수정 진행중'}
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-violet-900 mt-2">
            {pf.title || '정책명이 입력되지 않았습니다.'}
          </h3>
        </div>

        <div className="shrink-0 rounded-2xl bg-violet-50 border border-violet-200 px-6 py-4 flex flex-col items-end">
          <span className="text-xs font-bold text-violet-700 mb-1">최종 청구 예산</span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl md:text-4xl font-black text-violet-950 tabular-nums tracking-tight">
              {formatBudgetAmount(requestedBudget)}
            </span>
            <span className="text-violet-800 text-base font-bold">억원</span>
          </div>
        </div>
      </header>

      {/* 1. 집행계획 고정 영역 (읽기 전용) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-black text-slate-900 flex items-center gap-1.5">
            <span className="text-lg">📌</span>
            <span>정책 핵심 내용 (집행계획 고정)</span>
          </h4>
          <span className="text-xs text-slate-500 font-semibold">최초 작성된 정책 뼈대는 고정됩니다.</span>
        </div>

        <div className="grid md:grid-cols-2 gap-4 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-sm">
          {pf.linkedBillTitle && (
            <div className="md:col-span-2 space-y-1">
              <span className="text-xs font-black text-indigo-800">근거 법령</span>
              <p className="rounded-xl bg-white p-3 border border-slate-200 text-slate-800 font-medium whitespace-pre-wrap">
                {pf.linkedBillTitle}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <span className="text-xs font-black text-amber-800">해결하려는 문제</span>
            <p className="rounded-xl bg-white p-3 border border-slate-200 text-slate-800 whitespace-pre-wrap">
              {pf.problem || '미입력'}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-black text-sky-800">적용 대상</span>
            <p className="rounded-xl bg-white p-3 border border-slate-200 text-slate-800 whitespace-pre-wrap">
              {pf.targetCitizens || '미입력'}
            </p>
          </div>
          <div className="md:col-span-2 space-y-1">
            <span className="text-xs font-black text-violet-800">시행 절차 (집행계획)</span>
            <p className="rounded-xl bg-white p-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">
              {pf.content || '미입력'}
            </p>
          </div>
          <div className="md:col-span-2 space-y-1">
            <span className="text-xs font-black text-emerald-800">기대 효과</span>
            <p className="rounded-xl bg-white p-3 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">
              {pf.expectedEffect || '미입력'}
            </p>
          </div>
        </div>
      </section>

      {/* 2. 집중 수정 영역: 시행령 초안 및 예산안 계산기 */}
      <section className="grid lg:grid-cols-[1.3fr_0.9fr] gap-6 pt-4 border-t border-violet-100">
        {/* 왼쪽: 시행령 최종 수정 및 토의 반영 사항 */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-base font-black text-fuchsia-950 flex items-center gap-1.5">
                <span className="text-lg">📜</span>
                <span>시행령 초안 최종 수정</span>
              </label>
              {dirty && <span className="text-xs font-bold text-amber-600 animate-pulse">✏️ 수정됨 (저장 필요)</span>}
            </div>
            <p className="text-xs text-slate-500">
              국무회의 토론에서 합의된 조항이나 문구를 반영하여 시행령을 최종 확정해 주세요.
            </p>
            <textarea
              disabled={!canEdit || isFinal}
              value={fields.ordinance}
              maxLength={700}
              rows={6}
              onChange={(e) => patchField('ordinance', e.target.value)}
              placeholder="최종 시행령 조문을 자연스러운 문장으로 다듬어 적어 주세요."
              className="w-full resize-none rounded-2xl border-2 border-fuchsia-200 p-4 text-sm focus:border-fuchsia-500 focus:outline-none shadow-inner bg-fuchsia-50/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-base font-black text-amber-950 flex items-center gap-1.5">
              <span className="text-lg">💡</span>
              <span>토의 및 국무회의 토론 반영 사항</span>
            </label>
            <p className="text-xs text-slate-500">
              온라인 토의와 국무회의 토론을 거치며 예산이나 정책 내용 중 어떤 부분을 수정했는지 요약해 적어 주세요.
            </p>
            <textarea
              disabled={!canEdit || isFinal}
              value={fields.discussionReflection}
              maxLength={400}
              rows={4}
              onChange={(e) => patchField('discussionReflection', e.target.value)}
              placeholder="예: 국무회의 토론 결과, 홍보비를 2억 감액하고 바우처 발급 대상을 500명 늘리기로 합의함."
              className="w-full resize-none rounded-2xl border-2 border-amber-200 p-4 text-sm focus:border-amber-500 focus:outline-none shadow-inner bg-amber-50/30"
            />
          </div>
        </div>

        {/* 오른쪽: 예산 항목 및 계산기 */}
        <aside className="space-y-4">
          <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50/60 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
              <h4 className="font-black text-emerald-950 text-base flex items-center gap-1.5">
                <span className="text-lg">📊</span>
                <span>예산 항목 최종 수정</span>
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openCalculatorWindow}
                  className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-emerald-800 border border-emerald-300 hover:bg-emerald-100 shadow-sm transition"
                >
                  산출 예시 보기
                </button>
                {canEdit && !isFinal && (
                  <button
                    type="button"
                    onClick={addBudgetItem}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition"
                  >
                    항목 추가
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] font-semibold text-emerald-800">
              항목별로 `예산 항목 / 산출내역 / 금액`을 정리하면 합계가 자동으로 최종 청구 예산에 반영됩니다.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {budgetItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className={`rounded-2xl border p-3.5 transition ${
                    idx === activeBudgetIndex ? 'border-emerald-500 bg-white shadow-md' : 'border-emerald-200 bg-white/70 hover:bg-white'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_96px_auto] items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveBudgetIndex(idx)}
                      className="text-left text-sm font-black text-emerald-950 truncate"
                    >
                      {idx + 1}. {item.title || `예산 항목 ${idx + 1}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBudgetIndex(idx)}
                      className="truncate rounded-lg bg-emerald-50 px-2 py-1 text-left text-xs text-slate-600"
                    >
                      {item.note || '산출내역 입력'}
                    </button>
                    <label className="flex items-center gap-1">
                      <input
                        disabled={!canEdit || isFinal}
                        type="number"
                        min={0}
                        value={item.amount}
                        onChange={(e) => setBudgetItemAmount(idx, e.target.value)}
                        className="w-20 rounded-xl border border-emerald-200 px-2.5 py-1 text-right text-sm font-bold focus:border-emerald-500 focus:outline-none bg-slate-50"
                      />
                      <span className="text-xs font-bold text-emerald-800">억</span>
                    </label>
                    {canEdit && !isFinal && budgetItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBudgetItem(idx)}
                        className="rounded-lg bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-200 transition"
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  {idx === activeBudgetIndex && canEdit && !isFinal && (
                    <div className="mt-3 grid gap-2 border-t border-emerald-100 pt-2.5">
                      <input
                        value={item.title}
                        onChange={(e) => patchBudgetItem('title', e.target.value)}
                        placeholder="예산 항목 (예: 체험학습 바우처 발급비, 홍보물 제작비)"
                        className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        value={item.note}
                        onChange={(e) => patchBudgetItem('note', e.target.value)}
                        placeholder="산출내역 (예: 5,000명 x 30만원 x 1회)"
                        className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  )}
                  {!canEdit && item.note && (
                    <p className="mt-1.5 text-xs text-slate-600 border-t border-emerald-100 pt-1.5 italic">
                      {item.note}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-white p-4 border border-emerald-200 shadow-inner flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">항목 합계</span>
                <span className="text-xl font-black text-emerald-950">{formatBudgetAmount(budgetItemsTotal)} 억원</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 block">최종 청구 예산</span>
                <input
                  disabled
                  type="number"
                  min={0}
                  value={requestedBudget}
                  readOnly
                  className="w-28 rounded-xl border-2 border-emerald-300 bg-slate-100 px-3 py-1.5 text-right text-lg font-black text-violet-950"
                />
                <span className="text-xs font-bold text-violet-800 ml-1">억</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* 3. 하단 액션 / 승인 워크플로 버튼 */}
      <footer className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-3xl border border-violet-200 bg-violet-50/80 p-5 mt-6 shadow-sm">
        <div className="space-y-1 text-center md:text-left">
          <p className="text-sm font-bold text-violet-950">
            {isFinal ? '🎉 대통령 최종 승인이 완료되어 최종안이 확정되었습니다.' : '총예산에 맞게 각 부처와 대통령 모둠이 상호 조율 후 최종 승인합니다.'}
          </p>
          <p className="text-xs text-violet-700">
            부처 장관이 [최종 수정안 저장]을 누르면, 대통령 모둠이 검토 후 [대통령 최종 승인]을 누릅니다.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          {canEdit && !isFinal && (
            <button
              onClick={handleSaveAdjusted}
              disabled={busy || !dirty}
              className="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-40 shadow-md transition hover:shadow-lg"
            >
              최종 수정안 저장 (대통령 승인 대기)
            </button>
          )}

          {(role === 'teacher' || isPresident) && !isFinal && (
            <button
              onClick={handlePresidentApproval}
              disabled={busy}
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-40 shadow-md transition hover:shadow-lg animate-pulse"
            >
              👑 대통령 최종 승인 (발표 확정)
            </button>
          )}

          {isFinal && (
            <span className="rounded-2xl bg-emerald-100 border border-emerald-300 px-6 py-3 text-sm font-black text-emerald-800 shadow-sm">
              ✅ 최종 승인 완료
            </span>
          )}
        </div>
      </footer>
    </div>
  )
}

export default ExecutivePolicyFinalEdit
