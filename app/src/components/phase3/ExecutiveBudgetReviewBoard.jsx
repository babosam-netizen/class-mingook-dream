import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { formatBudgetAmount, roundBudgetAmount } from './executiveBudgetData'

/**
 * 행정부 예산 초안 검토 전광판 (TV 송출용)
 * 입법부 개별표결창 스타일의 고급스럽고 몰입감 있는 UI로 부처별 정책 및 예산 청구 현황을 방송.
 *
 * props:
 *   roomCodeProp: URL 파라미터 등으로 넘겨받은 방 코드 (없으면 스토어 기본값 사용)
 */
function ExecutiveBudgetReviewBoard({ roomCodeProp }) {
  const storeRoomCode = useGameStore((s) => s.roomCode)
  const roomCode = roomCodeProp || storeRoomCode

  const [policiesMap, setPoliciesMap] = useState({})
  const [roomData, setRoomData] = useState(null)
  const [groups, setGroups] = useState({})
  const [draftsMap, setDraftsMap] = useState({})

  // 실시간 구독
  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'policies', (d) => setPoliciesMap(d || {}))
    const u2 = subscribe(roomCode, '', (d) => setRoomData(d || null))
    const u3 = subscribe(roomCode, 'groups', (d) => setGroups(d || {}))
    const u4 = subscribe(roomCode, 'branchDrafts', (d) => setDraftsMap(d || {}))
    return () => { u1?.(); u2?.(); u3?.(); u4?.() }
  }, [roomCode])

  if (!roomCode) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-white text-2xl font-bold">
        ⚠ 방 코드가 지정되지 않았습니다.
      </div>
    )
  }

  const config = roomData?.config || {}
  const branchConfig = config.branchConfig || {}
  const countryName = branchConfig.executive?.countryName || config.countryName || '비빔민국'
  const totalCap = branchConfig.executive?.totalBudget ?? 100
  const presidentGroupId = branchConfig.executive?.presidentGroupId || null
  const isPresidentPolicy = (p) =>
    (presidentGroupId && p.groupId === presidentGroupId) ||
    p.branchUnitId === 'exe-president' ||
    String(p.ministryName || '').includes('대통령')

  const fieldsMeaningful = (pf) => pf && typeof pf === 'object' && Object.values(pf).some((v) => typeof v === 'string' && v.trim().length > 0)
  const sectionBudgetItemsOf = (unitId) => {
    if (!unitId) return []
    const secs = draftsMap?.[unitId]?.sections || {}
    return Object.values(secs).flatMap((sec) => Array.isArray(sec?.content?.budgetItems) ? sec.content.budgetItems : [])
  }
  const mergeSectionFields = (unitId) => {
    const secs = draftsMap?.[unitId]?.sections || {}
    const policyFields = {}
    Object.values(secs).forEach((sec) => {
      const spf = sec?.content?.policyFields
      if (!spf || typeof spf !== 'object') return
      Object.entries(spf).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim() && !policyFields[key]) policyFields[key] = value
      })
    })
    return policyFields
  }
  const budgetItemsTotal = (items = []) => roundBudgetAmount(items.reduce((s, it) => s + (Number(it?.amount) || 0), 0))

  // 정책에 예산이 안 실렸을 때, finalDoc과 모둠원 섹션(branchDrafts) 예산을 직접 합산하는 폴백
  const unitIdOf = (p) =>
    p?.branchUnitId || (branchConfig.executive?.units || []).find((u) => u.groupId === p?.groupId)?.unitId || null
  const sectionBudgetOf = (unitId) => budgetItemsTotal(sectionBudgetItemsOf(unitId))
  const normalizedPolicyForUnit = (unit) => {
    const policy = policiesMap?.[unit.groupId] || {}
    const draft = draftsMap?.[unit.unitId] || {}
    const finalContent = draft.finalDoc?.content || {}
    const sectionFields = mergeSectionFields(unit.unitId)
    const policyFields = fieldsMeaningful(policy.policyFields)
      ? policy.policyFields
      : fieldsMeaningful(finalContent.policyFields)
        ? finalContent.policyFields
        : sectionFields
    const policyBudget = Array.isArray(policy.budgetItems) ? policy.budgetItems : []
    const finalBudget = Array.isArray(finalContent.budgetItems) ? finalContent.budgetItems : []
    const sectionBudget = sectionBudgetItemsOf(unit.unitId)
    const budgetItems = policyBudget.length > 0 ? policyBudget : finalBudget.length > 0 ? finalBudget : sectionBudget
    const requestedBudget =
      Number(policy.requestedBudget ?? policy.draftBudget) ||
      budgetItemsTotal(policyBudget) ||
      Number(finalContent.requestedBudget ?? finalContent.draftBudget) ||
      budgetItemsTotal(finalBudget) ||
      budgetItemsTotal(sectionBudget)
    const status = policy.status || (draft.finalDoc?.status === 'locked' ? 'submitted' : draft.finalDoc?.status || '')
    const hasContent = fieldsMeaningful(policyFields) || budgetItems.length > 0 || requestedBudget > 0
    if (!hasContent) return null
    return {
      ...policy,
      groupId: unit.groupId,
      branchUnitId: policy.branchUnitId || unit.unitId,
      ministryName: policy.ministryName || unit.ministryName || '',
      status: ['saved', 'submitted', 'requested', 'adjusted', 'final'].includes(status) ? status : 'saved',
      policyFields,
      budgetItems,
      requestedBudget: roundBudgetAmount(requestedBudget),
      draftBudget: roundBudgetAmount(Number(policy.draftBudget) || requestedBudget),
    }
  }
  const policyByGroup = new Map()
  Object.values(policiesMap || {})
    .filter((p) => ['saved', 'submitted', 'requested', 'adjusted', 'final'].includes(p.status))
    .forEach((p) => policyByGroup.set(p.groupId, p))
  ;(branchConfig.executive?.units || []).forEach((unit) => {
    const normalized = normalizedPolicyForUnit(unit)
    if (normalized) policyByGroup.set(unit.groupId, normalized)
  })
  const allPolicies = Array.from(policyByGroup.values())
  // 정책 예산액 — requestedBudget/draftBudget → policy.budgetItems 합계 → 섹션 예산 합계 순으로 폴백
  const budgetOf = (p) => {
    const direct = Number(p?.requestedBudget ?? p?.draftBudget) || 0
    if (direct > 0) return roundBudgetAmount(direct)
    const items = Array.isArray(p?.budgetItems) ? p.budgetItems : []
    const itemSum = items.reduce((s, it) => s + (Number(it?.amount) || 0), 0)
    if (itemSum > 0) return roundBudgetAmount(itemSum)
    return sectionBudgetOf(unitIdOf(p))
  }

  // 대통령 공약 예약분: 총예산에서 먼저 차감하고, 부처는 잔여분에서 조정한다.
  const presidentReserved = allPolicies
    .filter(isPresidentPolicy)
    .reduce((sum, p) => sum + budgetOf(p), 0)
  const ministryCap = Math.max(0, totalCap - presidentReserved)

  // 부처(대통령실 제외) 청구액 합계
  const totalRequested = allPolicies
    .filter((p) => !isPresidentPolicy(p))
    .reduce((sum, p) => sum + budgetOf(p), 0)
  const diff = roundBudgetAmount(totalRequested - ministryCap)
  const isExcess = diff > 0
  const pct = ministryCap > 0 ? Math.round((totalRequested / ministryCap) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-12 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* 상단 헤더 */}
      <header className="max-w-7xl mx-auto text-center mb-8 md:mb-12 space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-400/40 bg-amber-950/40 text-amber-300 text-sm md:text-base font-black tracking-widest shadow-inner">
          <span>🏛️ {countryName} 국무회의</span>
          <span>·</span>
          <span>예산 초안 검토 전광판</span>
        </div>
        <h1 className="text-3xl md:text-6xl font-black tracking-tight text-white drop-shadow-md">
          부처별 정책 및 예산 청구 현황
        </h1>
        <p className="text-white/70 text-base md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
          각 부처가 제출한 정책 초안과 예산 청구액을 검토하고, 정부 총예산 내에서 최적의 조율을 준비합니다.
        </p>
      </header>

      {/* 정부 총예산 요약 대시보드 */}
      <section className="max-w-7xl mx-auto mb-12 md:mb-16">
        <div className="rounded-3xl border-2 border-white/15 bg-black/40 backdrop-blur-md p-6 md:p-10 shadow-2xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 총예산 */}
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-6 flex flex-col justify-center items-center text-center shadow-lg">
              <span className="text-amber-400 font-bold text-sm md:text-base tracking-wider mb-1">정부 총예산</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl md:text-6xl font-black text-amber-300 tabular-nums tracking-tight">{formatBudgetAmount(totalCap)}</span>
                <span className="text-amber-200/80 text-lg md:text-2xl font-bold">억원</span>
              </div>
              {presidentReserved > 0 && (
                <span className="text-[11px] md:text-xs font-semibold text-amber-200/80 mt-2 leading-snug">
                  👑 대통령 공약 예약 {formatBudgetAmount(presidentReserved)}억<br />부처 가용 {formatBudgetAmount(ministryCap)}억
                </span>
              )}
            </div>

            {/* 부처 청구 합계 */}
            <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/30 p-6 flex flex-col justify-center items-center text-center shadow-lg">
              <span className="text-indigo-300 font-bold text-sm md:text-base tracking-wider mb-1">부처 청구액 합계</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl md:text-6xl font-black text-indigo-200 tabular-nums tracking-tight">{formatBudgetAmount(totalRequested)}</span>
                <span className="text-indigo-200/80 text-lg md:text-2xl font-bold">억원</span>
              </div>
            </div>

            {/* 잔여 / 초과 현황 */}
            <div className={`rounded-2xl border p-6 flex flex-col justify-center items-center text-center shadow-lg transition-all ${
              isExcess
                ? 'border-rose-500/60 bg-rose-950/40 text-rose-300 animate-pulse'
                : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
            }`}>
              <span className="font-bold text-sm md:text-base tracking-wider mb-1">
                {isExcess ? '⚠️ 예산 초과' : '✅ 예산 잔여'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl md:text-6xl font-black tabular-nums tracking-tight">
                  {formatBudgetAmount(Math.abs(diff))}
                </span>
                <span className="text-lg md:text-2xl font-bold">억원</span>
              </div>
              <span className="text-xs font-semibold opacity-80 mt-1">
                {isExcess ? '국무회의에서 예산 조정이 필요합니다' : '예산 한도 내에서 편성이 가능합니다'}
              </span>
            </div>
          </div>

          {/* 진행률 바 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs md:text-sm font-bold text-white/80 px-1">
              <span>예산 소진율</span>
              <span className={`tabular-nums font-black ${isExcess ? 'text-rose-400' : 'text-emerald-400'}`}>{pct}%</span>
            </div>
            <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isExcess ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 부처별 정책 및 예산 카드 리스트 */}
      <main className="max-w-7xl mx-auto space-y-8">
        {allPolicies.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-16 text-center text-white/50 font-bold text-xl">
            아직 저장되거나 제출된 정책 초안이 없습니다.
          </div>
        ) : (
          allPolicies.map((policy) => {
            const g = groups?.[policy.groupId]
            const ministryName = policy.ministryName || `${g?.name || '부처'}부`
            const fields = policy.policyFields || {}
            // 정책에 예산 항목이 없으면 모둠원 섹션 예산 항목을 모아서 표시
            const budgetItems = (Array.isArray(policy.budgetItems) && policy.budgetItems.length > 0)
              ? policy.budgetItems
              : Object.values(draftsMap?.[unitIdOf(policy)]?.sections || {}).flatMap((sec) => Array.isArray(sec?.content?.budgetItems) ? sec.content.budgetItems : [])

            return (
              <article
                key={policy.groupId}
                className="rounded-3xl border-2 border-white/15 bg-black/40 backdrop-blur-md p-6 md:p-10 shadow-2xl space-y-6 transition hover:border-indigo-500/50 hover:bg-black/50"
              >
                {/* 부처명 & 예산 청구액 헤더 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl md:text-3xl font-black text-amber-300 tracking-tight">
                        {isPresidentPolicy(policy) ? '👑' : '🏢'} {ministryName}
                      </span>
                      {g?.name && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/90 border border-white/20">
                          {g.name}
                        </span>
                      )}
                      {policy.ministerName && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                          장관: {policy.ministerName}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl md:text-2xl font-extrabold text-white mt-2">
                      {fields.title || '정책명이 입력되지 않았습니다.'}
                    </h3>
                  </div>

                  {/* 예산 청구액 */}
                  <div className="shrink-0 rounded-2xl border border-amber-500/40 bg-amber-950/40 px-6 py-4 flex flex-col items-end shadow-md">
                    <span className="text-xs font-bold text-amber-400/90 mb-1">예산 청구액</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl md:text-5xl font-black text-amber-300 tabular-nums tracking-tight">
                        {formatBudgetAmount(budgetOf(policy))}
                      </span>
                      <span className="text-amber-200/80 text-lg font-bold">억원</span>
                    </div>
                  </div>
                </div>

                {/* 상세 내용 2단 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 왼쪽: 시행령 및 핵심 내용 */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-indigo-400/30 bg-indigo-950/40 p-5 space-y-2 shadow-inner">
                      <div className="flex items-center justify-between border-b border-indigo-400/20 pb-2">
                        <span className="text-xs font-bold text-indigo-300 tracking-wider">📜 시행령 초안</span>
                        <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded">법적 근거</span>
                      </div>
                      <p className="text-indigo-100 text-sm md:text-base whitespace-pre-wrap leading-relaxed pt-1">
                        {fields.ordinance || '시행령 내용이 없습니다.'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2 shadow-inner">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-bold text-white/70 tracking-wider">📌 집행 계획 핵심</span>
                        <span className="text-[10px] font-semibold bg-white/10 text-white/80 px-2 py-0.5 rounded">세부 사업</span>
                      </div>
                      <p className="text-white/90 text-sm md:text-base whitespace-pre-wrap leading-relaxed pt-1">
                        {fields.content || '집행 계획 내용이 없습니다.'}
                      </p>
                    </div>

                    {(fields.evidence || fields.publicConcern || fields.publicResponse || fields.expectedEffect) && (
                      <div className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-5 space-y-2 shadow-inner">
                        <div className="flex items-center justify-between border-b border-amber-400/20 pb-2">
                          <span className="text-xs font-bold text-amber-300 tracking-wider">👥 국민 눈높이 반영</span>
                          <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded">근거·피해·대응·효과</span>
                        </div>
                        <p className="text-amber-100 text-sm whitespace-pre-wrap leading-relaxed pt-1">
                          <b>필요 근거 및 사례: </b>{fields.evidence || '미입력'}
                        </p>
                        <p className="text-amber-100 text-sm whitespace-pre-wrap leading-relaxed pt-1">
                          <b>예상 피해/손해: </b>{fields.publicConcern || '미입력'}
                        </p>
                        <p className="text-amber-100 text-sm whitespace-pre-wrap leading-relaxed">
                          <b>대응: </b>{fields.publicResponse || '미입력'}
                        </p>
                        <p className="text-amber-100 text-sm whitespace-pre-wrap leading-relaxed">
                          <b>기대 효과/홍보: </b>{fields.expectedEffect || '미입력'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 오른쪽: 예산 산출식 및 기대 효과 */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-5 space-y-3 shadow-inner">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                        <span className="text-xs font-bold text-amber-300 tracking-wider">📊 예산 산출식 내역</span>
                        <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded">산출 근거</span>
                      </div>
                      {budgetItems.length === 0 ? (
                        <p className="text-amber-200/60 text-sm pt-1">산출식 내역이 없습니다.</p>
                      ) : (
                        <div className="space-y-3 pt-1">
                          {budgetItems.map((item, idx) => (
                            <div key={idx} className="rounded-xl bg-black/30 p-3 border border-amber-400/10 space-y-1.5 text-xs md:text-sm">
                              <div className="flex justify-between gap-2 font-bold text-amber-200 border-b border-amber-400/10 pb-1">
                                <span>항목 {idx + 1}: {item.title || item.category || '사업 예산'}</span>
                                <span className="text-amber-300 shrink-0">{formatBudgetAmount(item.amount)} 억원</span>
                              </div>
                              <p className="text-amber-100/80 text-xs pt-0.5">
                                산출내역: {item.note || item.explanation || '산출내역 미입력'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </article>
            )
          })
        )}
      </main>

      {/* 하단 푸터 */}
      <footer className="max-w-7xl mx-auto mt-12 text-center border-t border-white/10 pt-6 text-white/50 text-xs space-y-1">
        <p>대한민국 국무회의 시뮬레이션 시스템 · 예산 초안 검토 전광판</p>
        <p>선생님이 창을 닫으면 원래 대시보드 화면으로 돌아갑니다.</p>
      </footer>
    </div>
  )
}

export default ExecutiveBudgetReviewBoard
