import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { formatBudgetAmount, roundBudgetAmount } from '../phase3/executiveBudgetData'

/**
 * 다른 모둠의 핵심 산출물 — 읽기 전용 요약 (Two-Hat 운영용).
 *
 * 라운드별 노출 규칙:
 *  - legislative → 법안 (bills/{billId} 의 title + body)
 *  - executive   → 예산 정책 (policies/{id})
 *  - judicial    → 판결문 (verdicts/{caseId}/{verdictId})
 *
 * "누가 무엇을 했는가" 보다 "이 모둠의 산출물이 무엇인가" 에 초점.
 * 산출물이 없으면 '준비 중' 표시.
 *
 * @param {{myGroupId, sessionId, kind}} props
 */
function OtherGroupsRoleSummary({ myGroupId, kind }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)

  const [bills, setBills] = useState({})
  const [verdicts, setVerdicts] = useState({})
  const [policies, setPolicies] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const unsubs = []
    if (kind === 'legislative') {
      unsubs.push(subscribe(roomCode, 'bills', (d) => setBills(d || {})))
    } else if (kind === 'executive') {
      unsubs.push(subscribe(roomCode, 'policies', (d) => setPolicies(d || {})))
    } else if (kind === 'judicial') {
      unsubs.push(subscribe(roomCode, 'verdicts', (d) => setVerdicts(d || {})))
    }
    return () => unsubs.forEach((u) => u?.())
  }, [roomCode, kind])

  const otherGroups = Object.entries(groups || {}).filter(([gid]) => gid !== myGroupId)
  if (otherGroups.length === 0) return null

  const normalizeBudgetItems = (policy) => {
    if (Array.isArray(policy?.budgetItems)) {
      return policy.budgetItems.map((item) => ({
        ...item,
        amount: roundBudgetAmount(item.amount),
      }))
    }
    if (policy?.budget && typeof policy.budget === 'object') {
      return Object.entries(policy.budget)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([title, amount]) => ({ title, amount: roundBudgetAmount(amount) }))
    }
    const singleBudget = Number(policy?.requestedBudget ?? policy?.draftBudget ?? policy?.finalBudget ?? 0)
    return singleBudget ? [{ title: '청구 예산', amount: roundBudgetAmount(singleBudget) }] : []
  }

  const budgetItemTotal = (items = []) =>
    roundBudgetAmount(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))

  const executiveStatusLabel = (status) => {
    if (status === 'final') return '최종 승인'
    if (status === 'adjusted') return '최종수정'
    if (status === 'requested') return '청구 확정'
    if (status === 'submitted') return '정책안 제출'
    if (status === 'saved') return '저장됨'
    return '작성 중'
  }

  // === 라운드별 산출물 매핑 ===
  // 각 모둠 → { title, body, status?, ts } 또는 null (준비 중)
  const outputForGroup = (gid) => {
    if (kind === 'legislative') {
      const myBills = Object.entries(bills)
        .map(([id, b]) => ({ id, ...b }))
        .filter((b) => b.proposerGroupId === gid)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      const latest = myBills[0]
      if (!latest) return null
      return {
        title: latest.title || '제목 없음',
        body: latest.body || '',
        status: latest.status,
        ts: latest.createdAt,
        kindLabel: '법안',
      }
    }
    if (kind === 'executive') {
      const my = Object.entries(policies)
        .map(([id, p]) => ({ id, ...p }))
        .filter((p) => (p.groupId || p.id) === gid)
        .sort((a, b) => (b.submittedAt || b.updatedAt || b.createdAt || 0) - (a.submittedAt || a.updatedAt || a.createdAt || 0))
      const latest = my[0]
      if (!latest) return null
      const budgetItems = normalizeBudgetItems(latest)
      const total = budgetItemTotal(budgetItems)
      const fields = latest.policyFields || {}
      const summary = latest.decree
        ? latest.decree
        : fields.ordinance
        ? fields.ordinance
        : total > 0
        ? `총 ${total}억 청구안`
        : ''
      return {
        title: latest.ministryName || fields.title || latest.title || (latest.groupName ? `${latest.groupName} 정책안` : '정책안'),
        body: summary,
        status: latest.status,
        budgetTotal: total,
        budgetItems,
        ts: latest.submittedAt || latest.updatedAt || latest.createdAt,
        kindLabel: '정책안',
      }
    }
    if (kind === 'judicial') {
      // verdicts/{caseId}/{verdictId} 구조 — 모든 사건 순회
      const my = []
      for (const [caseId, byVerdict] of Object.entries(verdicts || {})) {
        for (const [vId, v] of Object.entries(byVerdict || {})) {
          if (v?.groupId === gid || v?.proposerGroupId === gid) {
            my.push({ caseId, vId, ...v })
          }
        }
      }
      my.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      const latest = my[0]
      if (!latest) return null
      return {
        title: `${latest.decision === 'guilty' ? '⚖️ 유죄' : '🕊️ 무죄'} — ${latest.caseId}`,
        body: latest.body || '',
        ts: latest.createdAt,
        kindLabel: '판결문',
      }
    }
    return null
  }

  const kindTitle = kind === 'legislative' ? '법안' : kind === 'executive' ? '정책안·예산' : '판결문'

  return (
    <details className="bg-slate-50 border border-slate-200 rounded-xl p-2 group">
      <summary className="cursor-pointer flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
        <span className="text-base">📚</span>
        <span>다른 모둠의 {kindTitle} ({otherGroups.length}개 모둠)</span>
        <span className="ml-auto text-xs text-slate-400">펼치기</span>
      </summary>

      <ul className="mt-2 space-y-2">
        {otherGroups.map(([gid, group]) => {
          const out = outputForGroup(gid)
          return (
            <li key={gid} className="bg-white border rounded-lg p-2.5">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="font-bold text-sm">🏛️ {group?.name || gid}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {out ? (
                    <>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                        ✓ {kind === 'executive' ? executiveStatusLabel(out.status) : `${out.kindLabel} 제출`}
                      </span>
                      {kind === 'executive' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-black">
                          {formatBudgetAmount(out.budgetTotal)}억 청구
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold animate-pulse">
                        ⏳ 준비 중
                      </span>
                      {kind === 'executive' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                          0억 청구
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              {out ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{out.title}</p>
                  {kind === 'executive' && out.budgetItems?.length > 0 && (
                    <p className="text-[11px] text-violet-700 font-semibold">
                      예산 항목 {out.budgetItems.length}개 · 총 {formatBudgetAmount(out.budgetTotal)}억
                    </p>
                  )}
                  {out.body && (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {out.body}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-amber-600 italic">
                  아직 {kindTitle}을 발의하지 않았어요.
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-[10px] text-slate-500 mt-2 px-1">
        💡 다른 모둠의 산출물을 참고해 우리 모둠 작업의 방향을 잡아 보세요.
      </p>
    </details>
  )
}

export default OtherGroupsRoleSummary
