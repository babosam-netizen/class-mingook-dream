import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, removeAt, subscribe } from '../../lib/rtdb-helpers'
import PlaceholderField, { isFieldComplete } from './PlaceholderField'

/**
 * 정책 보고서 템플릿 — 4 카테고리 예산(합계 100억) + 일정 + 기대 효과.
 *
 * 중요:
 * - 최종 정책안 제출(status='submitted')은 장관의 MinisterPolicyDraft 에서만 수행한다.
 * - 이 템플릿은 예산 분석가의 내부 정리/초안용이며, policies 노드에는 쓰지 않는다.
 *
 * props:
 *   groupId
 */
function BudgetReportTemplate({ groupId }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const tpl = useGameStore((s) => s.config?.templates?.budget) || {
    totalCap: 100,
    categories: [],
    schedule: [],
  }

  const [policyName, setPolicyName] = useState('')
  const [budget, setBudget] = useState({}) // { catId: amount }
  const [usage, setUsage] = useState({})   // { catId: 사용처 메모 }
  const [schedule, setSchedule] = useState({}) // { stepId: 일정 }
  const [impact, setImpact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [existingBudgetIds, setExistingBudgetIds] = useState([])

  useEffect(() => {
    if (!roomCode || !groupId) return
    const u = subscribe(roomCode, 'executiveBudget', (d) => {
      const ids = Object.entries(d || {})
        .filter(([, item]) => item?.proposerGroupId === groupId)
        .map(([id]) => id)
      setExistingBudgetIds(ids)
    })
    return () => u?.()
  }, [roomCode, groupId])

  const totalCap = tpl.totalCap || 100
  const sum = useMemo(
    () => tpl.categories.reduce((acc, c) => acc + (Number(budget[c.id]) || 0), 0),
    [budget, tpl.categories],
  )
  const remaining = totalCap - sum
  const overBudget = remaining < 0

  const allBudgetFilled = tpl.categories.every(
    (c) => budget[c.id] !== undefined && budget[c.id] !== '' && Number(budget[c.id]) > 0,
  )
  const allScheduleFilled = tpl.schedule.every((s) => isFieldComplete(schedule[s.id]))
  const policyOk = isFieldComplete(policyName)
  const impactOk = isFieldComplete(impact)
  const allComplete =
    policyOk && allBudgetFilled && !overBudget && allScheduleFilled && impactOk

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!allComplete) {
      if (overBudget) setError(`예산이 ${Math.abs(remaining)}억 초과했어요.`)
      else setError('빈칸이 남아 있어요. 모두 채워 주세요.')
      return
    }
    setBusy(true)
    try {
      for (const id of existingBudgetIds) {
        await removeAt(roomCode, `executiveBudget/${id}`)
      }

      for (const cat of tpl.categories) {
        const amount = Number(budget[cat.id]) || 0
        if (amount > 0) {
          await pushUnder(roomCode, 'executiveBudget', {
            name: `${cat.label} — ${policyName}`,
            amount,
            proposerGroupId: groupId,
          })
        }
      }

      setPolicyName('')
      setBudget({})
      setUsage({})
      setSchedule({})
      setImpact('')
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-2xl border-2 border-emerald-200 shadow-sm space-y-3"
    >
      <header>
        <h3 className="font-bold text-emerald-800">💰 정책 보고서 템플릿</h3>
        <p className="text-xs text-gray-500">
          예산 4 카테고리 합계가 정확히 {totalCap}억 이내가 되어야 저장됩니다.
        </p>
      </header>

      <PlaceholderField
        label="정책명"
        placeholder="예: 일회용품 제한 종합 정책"
        value={policyName}
        onChange={setPolicyName}
        rows={1}
        maxLength={60}
      />

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-xs font-bold text-gray-700">예산 분배 (총 {totalCap}억)</p>
          <span
            className={`text-xs font-mono ${
              overBudget ? 'text-rose-700 font-bold' : 'text-gray-600'
            }`}
          >
            {sum} / {totalCap} {overBudget && `⚠ ${Math.abs(remaining)}억 초과`}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full transition-all ${
              overBudget ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, (sum / totalCap) * 100)}%` }}
          />
        </div>
        <ul className="space-y-1.5">
          {tpl.categories.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[100px_80px_1fr] gap-2 items-center"
            >
              <span className="text-sm font-semibold">{c.label}</span>
              <input
                type="number"
                value={budget[c.id] ?? ''}
                onChange={(e) =>
                  setBudget((prev) => ({ ...prev, [c.id]: e.target.value }))
                }
                placeholder="0"
                min={0}
                className="px-2 py-1.5 text-sm rounded border border-gray-300 text-right"
              />
              <input
                type="text"
                value={usage[c.id] || ''}
                onChange={(e) =>
                  setUsage((prev) => ({ ...prev, [c.id]: e.target.value }))
                }
                placeholder={c.placeholder}
                maxLength={80}
                className="px-2 py-1.5 text-sm rounded border border-gray-300"
              />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-700 mb-1">정책 일정</p>
        <ul className="space-y-1.5">
          {tpl.schedule.map((s) => (
            <li key={s.id} className="grid grid-cols-[60px_1fr] gap-2 items-start">
              <span className="text-sm font-semibold pt-2">{s.label}</span>
              <PlaceholderField
                label=""
                placeholder={s.placeholder}
                value={schedule[s.id] || ''}
                onChange={(v) =>
                  setSchedule((prev) => ({ ...prev, [s.id]: v }))
                }
                rows={1}
                maxLength={80}
              />
            </li>
          ))}
        </ul>
      </div>

      <PlaceholderField
        label="기대 효과"
        placeholder={tpl.impactPlaceholder}
        value={impact}
        onChange={setImpact}
        rows={2}
        maxLength={200}
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
          ✓ 예산 보고서 저장 완료. (최종 제출은 장관이 진행)
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !allComplete}
        className="w-full py-2 rounded-lg bg-emerald-700 text-white font-semibold disabled:opacity-50 hover:bg-emerald-800"
      >
        {busy ? '저장 중...' : allComplete ? '예산 보고서 저장' : '⚠ 빈칸 또는 예산 초과를 확인하세요'}
      </button>
    </form>
  )
}

export default BudgetReportTemplate
