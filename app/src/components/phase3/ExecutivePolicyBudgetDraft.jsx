import { useEffect, useMemo, useState, useRef } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt, updateAt, removeAt, getOnce } from '../../lib/rtdb-helpers'
import { DraftSaver } from '../../lib/draft-saver'
import ResearchReferencePanel from '../research/ResearchReferencePanel'
import {
  BIBIM_STATS,
  DEFAULT_EXECUTIVE_BUDGET,
  EXECUTIVE_ROLE_CARDS,
  emptyBudgetCalc,
  formatBudgetAmount,
  roundBudgetAmount,
} from './executiveBudgetData'

const SESSION_ID = 'executive-default'
const emptyPolicyFields = {
  title: '',
  linkedBillId: '',
  linkedBillTitle: '',
  linkedBillBody: '',
  problem: '',
  purpose: '',
  targetCitizens: '',
  content: '',
  support: '',
  exception: '',
  ordinance: '',
  evidence: '',
  publicConcern: '',
  publicResponse: '',
  expectedEffect: '',
  finalMessage: '',
  discussionReflection: '',
  finalScale: '',
}

const newBudgetItem = (overrides = {}) => ({
  id: `budget_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  title: '',
  note: '',
  calc: emptyBudgetCalc(),
  amount: 0,
  ...overrides,
})

const DEFAULT_BUDGET_SUGGESTIONS = [
  { title: '담당인력비', note: '담당 인력 수 x 인건비 x 운영 기간' },
  { title: '지원금', note: '지원 대상 수 x 1인/1곳당 지원금' },
  { title: '교육홍보비', note: '교육·홍보 대상 수 x 회당 비용 x 횟수' },
  { title: '시스템운영비', note: '신청·선정·관리 시스템 구축 및 운영비' },
  { title: '평가모니터링비', note: '점검 인력·성과 평가·현장 모니터링 운영비' },
  { title: '민원대응비', note: '상담 창구·피해 접수·보완 안내 운영비' },
]

export function normalizeBudgetItems(policy) {
  if (Array.isArray(policy?.budgetItems) && policy.budgetItems.length > 0) {
    return policy.budgetItems.map((item) => ({
      ...newBudgetItem(),
      ...item,
      calc: { ...emptyBudgetCalc(), ...(item.calc || item.budgetCalc || {}) },
      amount: roundBudgetAmount(item.amount),
    }))
  }
  const legacyBudget = policy?.budget
  if (legacyBudget && typeof legacyBudget === 'object') {
    const reasons = policy?.budgetReasons || {}
    return Object.entries(legacyBudget)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([key, amount]) => newBudgetItem({
        title: key,
        note: reasons[key] || '기존 예산 항목',
        amount: roundBudgetAmount(amount),
      }))
  }
  const singleBudget = Number(policy?.requestedBudget ?? policy?.draftBudget ?? policy?.finalBudget ?? 0)
  if (singleBudget) {
    return [newBudgetItem({
      title: '기본 집행 예산',
      calc: { ...emptyBudgetCalc(), ...(policy?.budgetCalc || {}) },
      amount: roundBudgetAmount(singleBudget),
    })]
  }
  return []
}

function normalizePolicyContent(source) {
  const policy = source?.content && !source.policyFields ? source.content : source || {}
  const srcFields = policy.policyFields || {}
  const legacyUsage = policy.usage && typeof policy.usage === 'object'
    ? Object.entries(policy.usage).map(([key, value]) => `${key}: ${value}`).join('\n')
    : policy.usage
  const legacySchedule = policy.schedule && typeof policy.schedule === 'object'
    ? Object.entries(policy.schedule).map(([key, value]) => `${key}: ${value}`).join('\n')
    : policy.schedule

  return {
    ...emptyPolicyFields,
    ...srcFields,
    title: srcFields.title || policy.title || policy.policyName || policy.ministryName || '',
    linkedBillId: srcFields.linkedBillId || policy.linkedBillId || '',
    linkedBillTitle: srcFields.linkedBillTitle || policy.linkedBillTitle || '',
    linkedBillBody: srcFields.linkedBillBody || policy.linkedBillBody || '',
    problem: srcFields.problem || policy.problem || '',
    purpose: srcFields.purpose || policy.purpose || '',
    targetCitizens: srcFields.targetCitizens || policy.targetCitizens || policy.target || '',
    content: srcFields.content || policy.content || legacyUsage || legacySchedule || '',
    support: srcFields.support || policy.support || '',
    exception: srcFields.exception || policy.exception || '',
    ordinance: srcFields.ordinance || policy.ordinance || policy.decree || '',
    evidence: srcFields.evidence || policy.evidence || '',
    publicConcern: srcFields.publicConcern || policy.publicConcern || '',
    publicResponse: srcFields.publicResponse || policy.publicResponse || '',
    expectedEffect: srcFields.expectedEffect || policy.expectedEffect || policy.impact || '',
    finalMessage: srcFields.finalMessage || policy.finalMessage || '',
    discussionReflection: srcFields.discussionReflection || policy.discussionReflection || '',
    finalScale: srcFields.finalScale || policy.finalScale || '',
  }
}

function hasMeaningfulPolicyContent(source) {
  if (!source) return false
  const fields = normalizePolicyContent(source)
  const hasFieldText = Object.values(fields).some((value) => String(value || '').trim().length > 0)
  return hasFieldText || normalizeBudgetItems(source).length > 0
}

function buildBillBodyText(bill) {
  if (!bill) return ''
  if (bill.body) return bill.body
  const data = bill.templateData || {}
  const lines = []
  if (data.purpose) lines.push(`제1조 (목적) ${data.purpose}`)
  if (data.definition) lines.push(`제2조 (정의) ${data.definition}`)
  if (data.duty) lines.push(`제3조 (의무) ${data.duty}`)
  if (data.penalty) lines.push(`제4조 (벌칙) ${data.penalty}`)
  return lines.join('\n\n')
}

function buildOrdinancePreview(fields, ministryName = '담당 부처') {
  const title = fields.linkedBillTitle || fields.title || '[근거 법률]'
  const purpose = fields.purpose || `이 시행령은 ${title}에 따라 [정책 목적]을 실제로 시행하는 데 필요한 사항을 정한다.`
  const target = fields.targetCitizens || `이 시행령의 적용 대상은 [대상 시민/기관/장소]로 한다.`
  const process = fields.content || `${ministryName}는 [언제/어디서/어떻게] 정책을 시행한다.`
  const support = fields.support || '정부는 [예산 항목]에 배정된 예산을 [지원 방식]으로 사용한다.'
  const exception = fields.exception || '[점검 방법]으로 시행 상황을 확인하며, [예외 상황]에는 별도 기준을 적용한다.'
  return [
    `제1조 (목적) ${purpose}`,
    `제2조 (대상) ${target}`,
    `제3조 (시행 절차) ${process}`,
    `제4조 (지원 및 예산) ${support}`,
    `제5조 (점검 및 예외) ${exception}`,
  ].join('\n\n')
}

export function budgetItemTotal(items = []) {
  return roundBudgetAmount(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
}

export function buildBudgetFormula(calc = {}, fallback = '') {
  if (fallback) return fallback
  const count = Number(calc.targetCount) > 0 ? Number(calc.targetCount) : 0
  const unitLabel = calc.unitLabel || '명'
  const unitCost = Number(calc.unitCost) || 0
  const times = Number(calc.times) || 1
  if (!count || !unitCost) return ''
  return `${count.toLocaleString()}${unitLabel} x ${unitCost.toLocaleString()}원 x ${times}회`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function toolWindowShell(title, body, script = '') {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 18px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
    }
    h1 { margin: 0 0 14px; font-size: 20px; font-weight: 900; }
    h2 { margin: 0 0 8px; font-size: 15px; font-weight: 900; }
    p { margin: 0; line-height: 1.5; }
    button, input, select {
      font: inherit;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      padding: 9px 10px;
    }
    button {
      cursor: pointer;
      border: 0;
      background: #059669;
      color: white;
      font-weight: 900;
    }
    label { display: grid; gap: 5px; font-size: 12px; font-weight: 800; color: #047857; }
    input, select { width: 100%; background: white; color: #0f172a; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .card {
      border: 1px solid #dbeafe;
      border-radius: 18px;
      background: rgba(255,255,255,.88);
      padding: 14px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, .08);
    }
    .muted { color: #64748b; font-size: 12px; }
    .big { font-size: 26px; font-weight: 950; letter-spacing: -0.03em; }
    .stack { display: grid; gap: 12px; }
    .role { border-color: #fde68a; }
    .role ul { margin: 8px 0 0; padding-left: 18px; color: #475569; font-size: 13px; }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
  ${script ? `<script>${script}</script>` : ''}
</body>
</html>`
}

function openStandaloneToolWindow(title, html, script = '', features = 'width=640,height=720,left=120,top=80,resizable=yes,scrollbars=yes') {
  if (typeof window === 'undefined') return
  const blob = new Blob([toolWindowShell(title, html, script)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const popup = window.open(url, `class_democra_${Date.now()}`, features)
  if (!popup) {
    URL.revokeObjectURL(url)
    alert('새창이 차단되었습니다. 브라우저의 팝업 허용을 확인해 주세요.')
    return
  }
  popup.focus()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}

const openStatsWindow = (countryName) => {
  const body = `<div class="grid">${BIBIM_STATS.map((s) => `
    <section class="card">
      <h2>${escapeHtml(s.label)}</h2>
      <p class="big">${Number(s.value).toLocaleString()}</p>
      <p class="muted">${escapeHtml(s.desc)}</p>
    </section>
  `).join('')}</div>`
  openStandaloneToolWindow(`${countryName} 통계자료`, body)
}

export function ExecutiveStatsReference({ countryName = '축소국' }) {
  return (
    <details open className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-black">📊 {countryName} 통계</p>
            <p className="text-[11px] text-emerald-700">
              예산 계산기와 정책 대상 설정에 사용할 축소국 기준 통계입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              openStatsWindow(countryName)
            }}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700"
          >
            새창으로 보기
          </button>
        </div>
      </summary>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        {BIBIM_STATS.slice(0, 12).map((stat) => (
          <div key={stat.key} className="rounded-xl border border-emerald-100 bg-white px-2.5 py-2">
            <p className="text-[10px] font-black text-emerald-700">{stat.label}</p>
            <p className="text-sm font-black text-slate-950 tabular-nums">{Number(stat.value).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

const openRoleWindow = () => {
  const body = `<div class="stack">${EXECUTIVE_ROLE_CARDS.map((card) => `
    <section class="card role">
      <h2>${escapeHtml(card.title)}</h2>
      <p>${escapeHtml(card.body)}</p>
      <ul>${card.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join('')}</ul>
    </section>
  `).join('')}</div>`
  openStandaloneToolWindow('역할·임무 카드', body)
}

function ExecutiveGuidedPolicyBuilder({
  fields,
  patchField,
  patchFields,
  groupId,
  passedBills = [],
  ministryName = '담당 부처',
  countryName = '축소국',
  titleLabel = '정책 이름',
  ordinanceLabel = '제1조~제5조 시행령 최종안',
  onSavePart,
  savingPart,
}) {
  const previewText = useMemo(() => buildOrdinancePreview(fields, ministryName), [fields, ministryName])
  const sectionSummary = {
    law: fields.linkedBillTitle || '법령 미선택',
    questions: [fields.problem, fields.purpose, fields.targetCitizens, fields.content, fields.support, fields.exception]
      .filter((v) => String(v || '').trim())
      .length,
    ordinance: String(fields.ordinance || '').trim() ? '최종안 작성됨' : '미리보기 대기',
  }

  const selectLinkedBill = (billId) => {
    const bill = passedBills.find((b) => b.id === billId)
    patchFields({
      linkedBillId: bill?.id || '',
      linkedBillTitle: bill?.title || '',
      linkedBillBody: bill ? buildBillBodyText(bill) : '',
    })
  }

  const applyPreview = () => {
    const current = String(fields.ordinance || '').trim()
    if (current && current !== previewText.trim()) {
      const ok = window.confirm('현재 시행령 입력칸에 적힌 내용을 미리보기 내용으로 바꿀까요?')
      if (!ok) return
    }
    patchField('ordinance', previewText)
  }

  return (
    <div className="space-y-3">
      <ResearchReferencePanel
        contextKey="phase3_executive"
        groupId={groupId}
        title="정책·시행령 작성 참고자료"
        emptyMessage="준비 단계에서 모은 자료가 아직 없습니다. 자료실에서 찾은 기사와 떠오른 아이디어가 여기에 보입니다."
        accent="indigo"
        compact
      />

      <details open className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
        <summary className="cursor-pointer list-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-indigo-950">1. 입법내용 확인</p>
              <p className="text-[11px] text-indigo-700">
                국회에서 가결된 법령을 고르면, 시행령 문장에 들어갈 근거 법령이 자동으로 연결됩니다.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-indigo-700 border border-indigo-100">
              {sectionSummary.law}
            </span>
          </div>
        </summary>

        <select
          value={fields.linkedBillId || ''}
          onChange={(e) => selectLinkedBill(e.target.value)}
          className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
        >
          <option value="">가결 법령을 선택하세요</option>
          {passedBills.map((bill) => (
            <option key={bill.id} value={bill.id}>
              {bill.title}
            </option>
          ))}
        </select>

        {fields.linkedBillBody ? (
          <details className="rounded-lg border border-indigo-100 bg-white px-3 py-2 text-xs text-slate-700">
            <summary className="cursor-pointer font-black text-indigo-950">선택한 법령 내용 보기</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{fields.linkedBillBody}</p>
          </details>
        ) : (
          <p className="rounded-lg border border-dashed border-indigo-200 bg-white/70 px-3 py-2 text-[11px] text-indigo-700">
            가결 법령이 없거나 아직 선택하지 않았습니다. 직접 정책 이름과 질문 답변을 작성해도 시행령 미리보기를 만들 수 있습니다.
          </p>
        )}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => onSavePart?.('law')}
            disabled={!onSavePart || savingPart}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {savingPart === 'law' ? '저장 중…' : '입법내용 확인 저장'}
          </button>
        </div>
      </details>

      <details open className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <summary className="cursor-pointer list-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-slate-900">2. 질문에 답하며 시행령 재료 만들기</p>
              <p className="text-[11px] text-slate-500">정책 이름과 핵심 질문에 답하면 3번 미리보기가 자동으로 채워집니다.</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-600 border border-slate-200">
              답변 {sectionSummary.questions}/6
            </span>
          </div>
        </summary>
        <label className="block space-y-0.5">
          <span className="text-xs font-bold text-slate-700">{titleLabel}</span>
          <input
            value={fields.title || ''}
            onChange={(e) => patchField('title', e.target.value)}
            placeholder="예: 학교 간식시간 보장 정책"
            className="w-full rounded border px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
          />
        </label>
        <div className="grid grid-cols-1 gap-2.5">
          {[
            ['problem', '이 법령으로 해결해야 할 문제는 무엇인가요?', '예: 학생들이 긴 수업 시간 동안 간식을 먹을 시간이 부족하다.', 220, 2],
            ['purpose', '정책의 목적은 무엇인가요?', '예: 학생의 건강과 학습 집중을 돕기 위해 간식시간을 보장한다.', 220, 2],
            ['targetCitizens', '누구에게 적용되나요?', '예: 전국 초등학생과 초등학교', 180, 2],
            ['content', '누가, 언제, 어디서, 어떻게 실행하나요?', '예: 교육부는 매년 학기 초 학교별 학생 수에 따라 간식시간 운영 지침을 안내한다.', 320, 3],
            ['support', '예산이나 지원은 어떻게 이루어지나요?', '예: 학생 1명당 간식 운영비를 학교에 지원한다.', 240, 2],
            ['exception', '점검 방법이나 예외 상황은 무엇인가요?', '예: 학기말 사용 내역을 점검하고, 미사용 예산은 반납한다.', 240, 2],
          ].map(([key, label, placeholder, maxLength, rows]) => (
            <label key={key} className="block space-y-0.5">
              <span className="text-xs font-bold text-slate-700">{label}</span>
              <textarea
                value={fields[key] || ''}
                maxLength={maxLength}
                rows={rows}
                onChange={(e) => patchField(key, e.target.value)}
                placeholder={placeholder}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => onSavePart?.('questions')}
            disabled={!onSavePart || savingPart}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-black text-white hover:bg-slate-900 disabled:opacity-40"
          >
            {savingPart === 'questions' ? '저장 중…' : '질문 답변 저장'}
          </button>
        </div>
      </details>

      <details open className="rounded-xl border border-fuchsia-100 bg-slate-900 p-3 text-xs text-fuchsia-100 space-y-2">
        <summary className="cursor-pointer list-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-white">3. 시행령 초안 미리보기와 최종안 다듬기</p>
              <p className="text-[11px] text-fuchsia-200/80">자동 조립된 내용을 최종안에 반영한 뒤 읽으면서 손봅니다.</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-fuchsia-200 border border-fuchsia-900">
              {sectionSummary.ordinance}
            </span>
          </div>
        </summary>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={applyPreview}
            className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-fuchsia-500"
          >
            미리보기를 최종안에 반영 ↓
          </button>
        </div>
        <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed rounded-lg border border-fuchsia-900/60 bg-slate-950 p-2.5">
          {previewText}
        </pre>

        <label className="block space-y-0.5">
          <span className="text-xs font-bold text-fuchsia-100">{ordinanceLabel}</span>
          <textarea
            value={fields.ordinance || ''}
            rows={6}
            onChange={(e) => patchField('ordinance', e.target.value)}
            placeholder="위 미리보기를 반영한 뒤, 모둠이 읽으면서 자연스럽게 고쳐 완성하세요."
            className="w-full resize-none rounded border border-fuchsia-900 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-fuchsia-400"
          />
        </label>
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => onSavePart?.('ordinance')}
            disabled={!onSavePart || savingPart}
            className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-fuchsia-500 disabled:opacity-40"
          >
            {savingPart === 'ordinance' ? '저장 중…' : '시행령 초안 저장'}
          </button>
        </div>
      </details>
    </div>
  )
}

function ExecutivePublicEyeSection({ fields, patchField, onSavePart, savingPart }) {
  return (
    <details open className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-amber-950">근거·피해·보완 정리</p>
            <p className="text-[11px] text-amber-700">
              시행령의 구체적 근거를 확인하고, 정책 때문에 불편하거나 손해볼 수 있는 시민·분야와 대응 방법을 적습니다.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-amber-700 border border-amber-200">
            초안 단계
          </span>
        </div>
      </summary>
      <label className="block space-y-0.5">
        <span className="text-xs font-bold text-slate-700">필요 근거 및 사례</span>
        <textarea
          value={fields.evidence || ''}
          rows={4}
          onChange={(e) => patchField('evidence', e.target.value)}
          placeholder="시행령을 구체적으로 뒷받침하는 통계, 기사, 사례, 전문가 의견을 적어 주세요."
          className="w-full resize-none rounded border border-amber-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-xs font-bold text-slate-700">예상되는 피해나 손해보는 시민·분야</span>
        <textarea
          value={fields.publicConcern || ''}
          rows={3}
          onChange={(e) => patchField('publicConcern', e.target.value)}
          placeholder="예: 비용 부담이 늘어나는 가정, 행정 업무가 늘어나는 학교, 준비 시간이 필요한 소상공인 등"
          className="w-full resize-none rounded border border-amber-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-xs font-bold text-slate-700">그 걱정에 대한 대응 방법</span>
        <textarea
          value={fields.publicResponse || ''}
          rows={3}
          onChange={(e) => patchField('publicResponse', e.target.value)}
          placeholder="예: 단계적 시행, 안내 기간 운영, 예산 지원, 예외 기준 마련, 피해가 큰 대상 우선 지원 등"
          className="w-full resize-none rounded border border-amber-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-xs font-bold text-slate-700">기대 효과 및 홍보에 쓸 표현</span>
        <textarea
          value={fields.expectedEffect || ''}
          rows={3}
          onChange={(e) => patchField('expectedEffect', e.target.value)}
          placeholder="이 정책으로 좋아지는 점과 국민에게 설명하거나 홍보할 핵심 표현을 적어 주세요."
          className="w-full resize-none rounded border border-amber-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
        />
      </label>
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onSavePart?.('publicEye')}
          disabled={!onSavePart || savingPart}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-amber-700 disabled:opacity-40"
        >
          {savingPart === 'publicEye' ? '저장 중…' : '근거·피해·보완 저장'}
        </button>
      </div>
    </details>
  )
}

// ────────────────────────────────────────────────────────────────────────
// 공통: 역할별 예산 항목 입력 매니저 컴포넌트
// ────────────────────────────────────────────────────────────────────────
export function ExecutiveSectionBudgetManager({
  budgetItems = [],
  setBudgetItems,
  groupId,
  editing = true,
  totalBudget = 100,
  suggestions = DEFAULT_BUDGET_SUGGESTIONS,
}) {
  const [activeBudgetIndex, setActiveBudgetIndex] = useState(0)

  // 계산기에서 반환하는 결과 수신
  useEffect(() => {
    const handleToolMessage = (event) => {
      const msg = event.data || {}
      if (msg.type !== 'executiveBudgetCalculatorApply' || msg.groupId !== groupId) return
      setBudgetItems((prev) => {
        const exists = prev.some((item) => item.id === msg.budgetItemId)
        const updatedItem = {
          title: msg.title || '',
          note: msg.note || '',
          calc: { ...emptyBudgetCalc(), ...(msg.calc || {}) },
          amount: roundBudgetAmount(msg.amount),
        }
        if (exists) {
          return prev.map((item) =>
            item.id === msg.budgetItemId ? { ...item, ...updatedItem, title: msg.title || item.title, note: msg.note || item.note } : item
          )
        } else {
          return [...prev, { ...newBudgetItem({ id: msg.budgetItemId }), ...updatedItem }]
        }
      })
    }
    window.addEventListener('message', handleToolMessage)
    return () => window.removeEventListener('message', handleToolMessage)
  }, [groupId, setBudgetItems])

  const activeBudgetItem = budgetItems[activeBudgetIndex] || budgetItems[0] || newBudgetItem()

  const setBudgetItemAmount = (idx, value) => {
    setBudgetItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, amount: Number(value) || 0 } : item))
    )
  }

  const addBudgetItem = () => {
    setBudgetItems((prev) => {
      const next = [...prev, newBudgetItem({ title: `예산 항목 ${prev.length + 1}` })]
      setActiveBudgetIndex(next.length - 1)
      return next
    })
  }

  const addSuggestedBudgetItem = (suggestion) => {
    setBudgetItems((prev) => {
      const next = [...prev, newBudgetItem({
        title: suggestion.title,
        note: suggestion.note || '',
      })]
      setActiveBudgetIndex(next.length - 1)
      return next
    })
  }

  const removeBudgetItem = (idx) => {
    if (budgetItems.length <= 1) return
    setBudgetItems((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      setActiveBudgetIndex(Math.max(0, Math.min(idx - 1, next.length - 1)))
      return next
    })
  }

  const budgetItemsTotal = useMemo(() => budgetItemTotal(budgetItems), [budgetItems])

  const openCalculatorWindow = () => {
    const item = activeBudgetItem || newBudgetItem()
    const initialCalc = { ...emptyBudgetCalc(), ...(item.calc || {}) }
    const canApply = editing
    const initUnitCostVal = Number(initialCalc.unitCost) || 0

    const fieldsHtml = `
      <div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;margin-bottom:5px;color:#374151;">수량</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="targetCount" type="number" min="0" value="${Number(initialCalc.targetCount) || 0}" ${canApply ? '' : 'disabled'} style="flex:1;min-width:0;font-size:14px;padding:6px;border:1px solid #cbd5e1;border-radius:4px;" />
          <select id="unitLabel" ${canApply ? '' : 'disabled'} style="width:76px;flex-shrink:0;">
            ${['명', '학교', '가구', '팀', '개', '회'].map((u) => `<option value="${u}" ${u === (initialCalc.unitLabel || '명') ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;margin-bottom:5px;color:#374151;">단위당 가격</div>
        <input id="unitCost" type="text" inputmode="numeric" value="${initUnitCostVal ? initUnitCostVal.toLocaleString() : '0'}" ${canApply ? '' : 'disabled'} style="text-align:right;width:100%;box-sizing:border-box;font-size:16px;padding:6px;font-weight:bold;letter-spacing:1px;border:1px solid #cbd5e1;border-radius:4px;" />
        <span id="unitCostKorean" style="font-size:11px;color:#888;margin-top:2px;display:block;min-height:1.2em;text-align:right;"></span>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;margin-bottom:5px;color:#374151;">반복 횟수 <span style="font-weight:400;color:#9ca3af;">같은 사업을 몇 번 반복하는지, 1번이면 1</span></div>
        <input id="times" type="number" min="1" value="${Number(initialCalc.times) || 1}" ${canApply ? '' : 'disabled'} />
      </div>
    `
    const body = `
      <div class="stack">
        <section class="card">
          <p class="muted">현재 예산 항목</p>
          <label>예산 항목명
            <input id="title" type="text" value="${escapeHtml(item.title || `예산 항목 ${activeBudgetIndex + 1}`)}" ${canApply ? '' : 'disabled'} />
          </label>
          <label>대상 통계
            <select id="statKey" ${canApply ? '' : 'disabled'}>
              ${BIBIM_STATS.map((s) => `<option value="${escapeHtml(s.key)}" ${s.key === initialCalc.statKey ? 'selected' : ''}>${escapeHtml(s.label)} (${Number(s.value).toLocaleString()}명/개)</option>`).join('')}
            </select>
          </label>
          <label>대상 비율(%)
            <input id="targetPercent" type="number" min="0" max="100" value="${Number(initialCalc.targetPercent) || 100}" ${canApply ? '' : 'disabled'} />
          </label>
        </section>
        <section class="card">${fieldsHtml}</section>
        <section class="card">
          <p>산출내역: <b id="formula">-</b></p>
          <p>계산 결과: <b id="totalWon" style="font-size:18px;color:#059669;">0</b>원 <span id="totalKorean" style="font-size:14px;color:#059669;font-weight:bold;"></span></p>
          <p class="muted">정부 예산 ${Number(totalBudget).toLocaleString()}억 중 <b id="budgetRate">0.00</b>%</p>
          ${canApply ? '<button id="apply" type="button" style="width:100%;margin-top:12px;">계산 결과를 현재 예산 항목에 반영</button>' : '<p class="muted" style="margin-top:12px;">읽기 상태에서는 계산 결과를 반영할 수 없습니다.</p>'}
        </section>
      </div>
    `
    const script = `
      const stats = ${JSON.stringify(BIBIM_STATS)};
      const groupId = ${JSON.stringify(groupId)};
      const budgetItemId = ${JSON.stringify(item.id)};
      const totalBudget = ${JSON.stringify(Number(totalBudget) || 0)};
      const canApply = ${JSON.stringify(canApply)};
      function num(id) { const el = document.getElementById(id); if (!el) return 0; return Number(el.value.replace(/,/g, '')) || 0; }
      function toKoreanWon(n) {
        if (!n || n === 0) return '';
        function manPart(m) {
          if (!m) return '';
          const c = Math.floor(m / 1000), rest1 = m % 1000;
          const b = Math.floor(rest1 / 100), rest2 = rest1 % 100;
          if (c > 0 && !rest1) return (c === 1 ? '천' : c + '천');
          if (!c && b > 0 && !rest2) return (b === 1 ? '백' : b + '백');
          if (c > 0 && b > 0 && !rest2) return (c === 1 ? '천' : c + '천') + (b === 1 ? '백' : b + '백');
          return m.toLocaleString();
        }
        const jo = Math.floor(n / 1000000000000);
        const eok = Math.floor((n % 1000000000000) / 100000000);
        const man = Math.floor((n % 100000000) / 10000);
        const won = n % 10000;
        const parts = [];
        if (jo > 0) parts.push(jo.toLocaleString() + '조');
        if (eok > 0) parts.push(eok.toLocaleString() + '억');
        if (man > 0) parts.push(manPart(man) + '만');
        if (won > 0 && n < 10000) parts.push(won.toLocaleString());
        return parts.join(' ') + '원';
      }
      function currentCalc() {
        return {
          statKey: document.getElementById('statKey')?.value || 'population',
          targetPercent: num('targetPercent'),
          targetCount: num('targetCount'),
          unitLabel: document.getElementById('unitLabel')?.value || '명',
          unitCost: num('unitCost'),
          times: num('times'),
          operationCost: num('operationCost'),
          promotionCost: num('promotionCost'),
          etcCost: num('etcCost')
        };
      }
      function calculate() {
        const calc = currentCalc();
        const stat = stats.find((s) => s.key === calc.statKey) || stats[0] || { value: 0 };
        const targetCountInput = Number(calc.targetCount) || 0;
        const targetCount = targetCountInput > 0 ? targetCountInput : Math.round((Number(stat.value) || 0) * (Number(calc.targetPercent) || 0) / 100);
        const times = Number(calc.times) || 1;
        const totalWon = targetCount * (Number(calc.unitCost) || 0) * times;
        const totalEok = Math.round((totalWon / 100000000) * 10) / 10;
        const formula = targetCount && calc.unitCost
          ? targetCount.toLocaleString() + calc.unitLabel + ' x ' + Number(calc.unitCost).toLocaleString() + '원 x ' + times + '번'
          : '수량과 단위당 가격을 입력하면 산출내역이 만들어집니다.';
        document.getElementById('formula').textContent = formula;
        document.getElementById('totalWon').textContent = totalWon.toLocaleString();
        const korEl = document.getElementById('totalKorean');
        if (korEl) korEl.textContent = totalWon ? '(' + toKoreanWon(totalWon) + ')' : '';
        document.getElementById('budgetRate').textContent = totalBudget ? (totalEok / totalBudget * 100).toFixed(2) : '0.00';
        return { calc, amount: totalEok, note: formula, title: document.getElementById('title')?.value || '' };
      }
      document.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', calculate));
      document.querySelectorAll('select').forEach((el) => el.addEventListener('change', calculate));
      function getUnitForStat(key) { return key === 'schools' ? '학교' : '명'; }
      function applyStatDefault() {
        const statKey = document.getElementById('statKey')?.value;
        const targetPercent = num('targetPercent');
        const stat = stats.find((s) => s.key === statKey) || stats[0];
        if (!stat) return;
        const autoCount = Math.round(Number(stat.value) * targetPercent / 100);
        const countEl = document.getElementById('targetCount');
        const unitEl = document.getElementById('unitLabel');
        if (countEl) countEl.value = autoCount;
        if (unitEl) unitEl.value = getUnitForStat(statKey);
        calculate();
      }
      document.getElementById('statKey')?.addEventListener('change', applyStatDefault);
      document.getElementById('targetPercent')?.addEventListener('input', applyStatDefault);
      if (!num('targetCount')) applyStatDefault();
      const unitCostEl = document.getElementById('unitCost');
      if (unitCostEl) {
        unitCostEl.addEventListener('input', function() {
          const raw = this.value.replace(/[^0-9]/g, '');
          const n = Number(raw) || 0;
          const cursor = this.selectionStart;
          const prevLen = this.value.length;
          this.value = n ? n.toLocaleString() : '';
          const diff = this.value.length - prevLen;
          this.setSelectionRange(cursor + diff, cursor + diff);
          const korSpan = document.getElementById('unitCostKorean');
          if (korSpan) korSpan.textContent = n ? toKoreanWon(n) : '';
        });
      }
      document.getElementById('apply')?.addEventListener('click', () => {
        if (!canApply || !window.opener) return;
        const result = calculate();
        window.opener.postMessage({
          type: 'executiveBudgetCalculatorApply',
          groupId,
          budgetItemId: result.budgetItemId || budgetItemId,
          title: result.title,
          calc: result.calc,
          note: result.note,
          amount: result.amount
        }, '*');
        window.close();
      });
      calculate();
      const initN = num('unitCost');
      const initKorSpan = document.getElementById('unitCostKorean');
      if (initKorSpan && initN) initKorSpan.textContent = toKoreanWon(initN);
    `
    openStandaloneToolWindow('예산 계산기', body, script, 'width=560,height=680,left=160,top=90,resizable=yes,scrollbars=yes')
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2 mt-3">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
          💰 관련 예산 편성
        </h5>
        {editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCalculatorWindow}
              className="rounded-lg bg-white px-2 py-1 text-[10px] font-black text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
            >
              예산 계산기
            </button>
            <button
              type="button"
              onClick={addBudgetItem}
              className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-black text-white hover:bg-emerald-700"
            >
              + 항목 추가
            </button>
          </div>
        )}
      </div>

      {editing && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.title}-${suggestion.note}`}
              type="button"
              onClick={() => addSuggestedBudgetItem(suggestion)}
              className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[10px] font-black text-emerald-800 hover:bg-emerald-100"
              title={suggestion.note}
            >
              + {suggestion.title}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {budgetItems.length === 0 ? (
          <p className="text-[11px] text-emerald-600 italic">추가된 예산 항목이 없습니다. 필요하면 추가하세요.</p>
        ) : (
          budgetItems.map((item, idx) => (
            <div
              key={item.id}
              className={`grid grid-cols-[18px_1fr_1.2fr_80px_auto] items-center gap-1.5 rounded border p-1.5 bg-white ${
                idx === activeBudgetIndex ? 'border-emerald-400' : 'border-emerald-100'
              }`}
            >
              <span className="text-[10px] font-bold text-emerald-600">{idx + 1}</span>
              {editing ? (
                <>
                  <input
                    value={item.title}
                    onFocus={() => setActiveBudgetIndex(idx)}
                    onChange={(e) => {
                      setActiveBudgetIndex(idx)
                      setBudgetItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, title: e.target.value } : it))
                      )
                    }}
                    placeholder="예: 담당인력비, 지원금, 평가모니터링비"
                    className="rounded border border-emerald-100 px-1 py-0.5 text-xs font-bold text-emerald-950 w-full"
                  />
                  <input
                    value={item.note}
                    onFocus={() => setActiveBudgetIndex(idx)}
                    onChange={(e) => {
                      setActiveBudgetIndex(idx)
                      setBudgetItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, note: e.target.value } : it))
                      )
                    }}
                    placeholder="예: 대상 수 x 단가 x 횟수"
                    className="rounded border border-emerald-100 px-1 py-0.5 text-xs text-slate-700 w-full"
                  />
                  <label className="flex items-center gap-0.5 justify-end">
                    <input
                      type="number"
                      min={0}
                      value={item.amount}
                      onFocus={() => setActiveBudgetIndex(idx)}
                      onChange={(e) => setBudgetItemAmount(idx, e.target.value)}
                      className="w-16 rounded border border-emerald-100 px-1 py-0.5 text-right text-xs font-bold"
                    />
                    <span className="text-[10px] font-bold text-emerald-800">억</span>
                  </label>
                </>
              ) : (
                <>
                  <span className="truncate text-xs font-bold text-emerald-950">{item.title || `항목 ${idx + 1}`}</span>
                  <span className="truncate text-xs text-slate-500">{item.note || buildBudgetFormula(item.calc) || '산출내역 미입력'}</span>
                  <span className="text-right text-xs font-bold text-emerald-800">{formatBudgetAmount(item.amount)}억</span>
                </>
              )}
              {editing && (
                <button
                  type="button"
                  onClick={() => removeBudgetItem(idx)}
                  className="rounded bg-rose-50 w-4 h-4 flex items-center justify-center text-[10px] font-bold text-rose-700 hover:bg-rose-100 justify-self-end"
                >
                  ✕
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-emerald-950 font-bold px-0.5">
        <span>역할 예산 소계:</span>
        <span>{formatBudgetAmount(budgetItemsTotal)}억 <span className="text-[10px] text-emerald-700 font-normal">(총 {formatBudgetAmount(totalBudget)}억)</span></span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// 2단계: 1. 정책 총괄원 에디터 (skeleton)
// ────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────
// 2단계: 개별 역할별 임무 완수 에디터 (통합형)
// ────────────────────────────────────────────────────────────────────────
export function ExecutiveSectionEditor({ roleDef, sectionKey, sec, onSave, saving, groupId, passedBills = [], myNote }) {
  const config = useGameStore((s) => s.config)
  const className = useGameStore((s) => s.className)
  const countryName = config?.branchConfig?.executive?.countryName || config?.countryName || className || '축소국'

  const [fields, setFields] = useState(() => sec?.content?.policyFields || {
    title: '', problem: '', purpose: '', targetCitizens: '',
    ordinance: '', content: '',
    evidence: '', publicConcern: '', publicResponse: '',
    expectedEffect: '', discussionReflection: ''
  })
  const [budgetItems, setBudgetItems] = useState(() => sec?.content?.budgetItems || [])

  const patchField = (key, value) => setFields(p => ({ ...p, [key]: value }))

  const handleImportMemo = () => {
    const qna = myNote?.qna || {}
    const text = myNote?.text || ''
    
    if (Object.keys(qna).length === 0 && !text) {
      alert('가져올 메모 내용이 없습니다. 1단계 메모를 먼저 작성해 주세요.')
      return
    }

    if (sectionKey === 'skeleton') {
      setFields(p => ({
        ...p,
        title: qna[0] || p.title,
        problem: qna[1] || p.problem,
        purpose: qna[1] || p.purpose,
        targetCitizens: qna[2] || p.targetCitizens,
      }))
    } else if (sectionKey === 'decree') {
      // 제3조 시행 절차 — fields.content 하나로 통합 (fields.ordinance는 최종 어셈블러 전용)
      const merged = [qna[0], qna[1]].filter(Boolean).join('\n')
      setFields(p => ({
        ...p,
        content: merged || p.content,
      }))
    } else if (sectionKey === 'evidence') {
      setFields(p => ({
        ...p,
        evidence: qna[0] || p.evidence,
        publicConcern: qna[1] || p.publicConcern,
        publicResponse: qna[2] || p.publicResponse,
      }))
    } else if (sectionKey === 'effect') {
      setFields(p => ({
        ...p,
        expectedEffect: qna[0] || p.expectedEffect,
        discussionReflection: qna[1] || p.discussionReflection,
      }))
    } else {
      if (text) {
        setFields(p => ({
          ...p,
          ordinance: text,
        }))
      }
    }
    alert('내 조사 메모의 질문 답변이 초안 필드로 자동 매핑되어 입력되었습니다. 저장 전 마저 다듬어주세요.')
  }

  const handleSave = () => {
    onSave({
      policyFields: fields,
      budgetItems,
    })
  }

  return (
    <div className="space-y-4">
      {/* 0. 통과(가결)된 법안 — 항상 펼쳐서 상단에 표시. 시행령은 이 법을 집행하기 위한 것. */}
      {passedBills.length > 0 && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-black text-indigo-900">📜 우리 부서 관련 통과 법안</span>
            <span className="text-[11px] font-bold text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">{passedBills.length}건</span>
            <span className="text-[11px] text-indigo-600">— 이 법을 집행하기 위한 시행령을 작성하세요</span>
          </div>
          <div className="space-y-2">
            {passedBills.map((bill) => (
              <div key={bill.id} className="bg-white border border-indigo-100 rounded-lg p-2.5">
                <p className="text-xs font-black text-indigo-950">⚖️ {bill.title || '제목 없음'}</p>
                <p className="mt-1 text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {buildBillBodyText(bill) || '(본문 없음)'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1. 미션 가이드 및 이전 메모 */}
      <div className="bg-white p-3 border border-indigo-100 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b pb-1">
          <h4 className="text-sm font-black text-indigo-900">🎯 내 역할 임무 가이드</h4>
          {(myNote?.text || myNote?.qna) && (
            <button
              type="button"
              onClick={handleImportMemo}
              className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition"
            >
              내 메모 가져오기
            </button>
          )}
        </div>
        {myNote?.text && (
          <div className="p-2 bg-slate-50 border rounded-lg text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto text-left">
            <span className="font-bold text-slate-900">📝 내 조사 메모:</span><br/>{myNote.text}
          </div>
        )}
        <div className="space-y-1.5">
          {roleDef?.memoGuide?.map((q, idx) => (
            <p key={idx} className="text-xs text-indigo-800 font-bold bg-indigo-50 px-2 py-1.5 rounded-lg text-left">
              {q}
            </p>
          ))}
        </div>
      </div>

      {/* 2. 할당된 정책 필드 입력 */}
      <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-3">
        <h4 className="text-sm font-black text-slate-800 border-b pb-1">📄 {roleDef?.sectionLabel || '내 담당 조항'} 초안 작성</h4>
        
        {sectionKey === 'skeleton' && (
          <div className="space-y-3">
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">제1조 목적</span>
              <input type="text" value={fields.title} onChange={e => patchField('title', e.target.value)} placeholder="예: 이 시행령은 ○○을 예방/지원/관리하기 위해 필요한 사항을 정한다." className="w-full rounded border px-2 py-1.5 text-xs bg-white" />
            </label>
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">배경 근거</span>
              <textarea value={fields.problem} onChange={e => patchField('problem', e.target.value)} placeholder="왜 이 시행령이 필요한지 통계, 기사, 사례를 포함해 정리" rows={2} className="w-full resize-none rounded border px-2 py-1 text-xs bg-white" />
            </label>
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">목적 설명</span>
              <textarea value={fields.purpose} onChange={e => patchField('purpose', e.target.value)} placeholder="시행령을 통해 달성하려는 변화" rows={2} className="w-full resize-none rounded border px-2 py-1 text-xs bg-white" />
            </label>
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">제2조 대상 및 범위</span>
              <input type="text" value={fields.targetCitizens} onChange={e => patchField('targetCitizens', e.target.value)} placeholder="수혜 대상, 규제 대상, 제외 대상 또는 우선 대상" className="w-full rounded border px-2 py-1.5 text-xs bg-white" />
            </label>
          </div>
        )}

        {sectionKey === 'decree' && (
          <div className="space-y-3">
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">제3조 시행 절차</span>
              <textarea value={fields.content} onChange={e => patchField('content', e.target.value)} placeholder={'예시:\n① 담당 기관: 환경부 생활쓰레기과\n② 신청 기간: 매년 3월 1일 ~ 3월 31일\n③ 선정 기준: 소득 4분위 이하 가정 우선\n④ 지원 진행: 선정 → 통보 → 지원 물품 배송'} rows={8} className="w-full resize-none rounded border px-2 py-1 text-xs bg-white" />
            </label>
            <p className="text-[11px] text-indigo-600 bg-indigo-50 rounded px-2 py-1">
              💡 신청 방법·담당 기관·진행 순서를 단계별(①②③...)로 쓰면 쉬워요. 필요한 인력, 장소, 시스템도 이 칸에 함께 정리하세요.
            </p>
          </div>
        )}

        {sectionKey === 'evidence' && (
          <div className="space-y-3">
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">제4조 지원 내용 및 재원 사용</span>
              <textarea value={fields.evidence} onChange={e => patchField('evidence', e.target.value)} placeholder="누구에게 무엇을 어떻게 지원하고, 재원을 어떤 방식으로 사용할지 작성" rows={4} className="w-full resize-none rounded border px-2 py-1 text-xs bg-white" />
            </label>
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">지원 규모와 산출 근거</span>
              <textarea value={fields.publicConcern} onChange={e => patchField('publicConcern', e.target.value)} placeholder="지원 대상 수, 단가, 횟수, 지원 우선순위 등" rows={2} className="w-full resize-none rounded border px-2 py-1 text-xs bg-white" />
            </label>
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">우려와 조정 기준</span>
              <textarea value={fields.publicResponse} onChange={e => patchField('publicResponse', e.target.value)} placeholder="지원이 부족하거나 과도할 때 조정할 기준과 대응 방법" rows={2} className="w-full resize-none rounded border px-2 py-1 text-xs bg-white" />
            </label>
          </div>
        )}

        {sectionKey === 'effect' && (
          <div className="space-y-3">
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">기대효과와 예상 피해</span>
              <textarea value={fields.expectedEffect} onChange={e => patchField('expectedEffect', e.target.value)} placeholder="좋아지는 점, 피해가 예상되는 분야·계층, 보완 필요성을 함께 작성" rows={4} className="w-full resize-none rounded border px-2 py-1 text-xs bg-white" />
            </label>
            <label className="block space-y-1 text-left">
              <span className="text-xs font-bold text-slate-700">제5조 점검·예외·보완</span>
              <textarea value={fields.discussionReflection} onChange={e => patchField('discussionReflection', e.target.value)} placeholder="평가 기준, 점검 주기, 예외 기준, 민원·피해 보완 방식" rows={3} className="w-full resize-none rounded border px-2 py-1 text-xs bg-white" />
            </label>
          </div>
        )}
      </div>

      {/* 3. 할당된 예산 편성 */}
      <div className="bg-white p-3 border border-emerald-200 rounded-xl space-y-3">
        <h4 className="text-sm font-black text-emerald-900 border-b border-emerald-100 pb-1 text-left">💰 실행 예산 편성</h4>
        <ExecutiveStatsReference countryName={countryName} />
        <ExecutiveSectionBudgetManager
          budgetItems={budgetItems}
          setBudgetItems={setBudgetItems}
          groupId={groupId}
          suggestions={roleDef?.budgetSuggestions}
        />
      </div>

      <div className="pt-2 text-right">
        <button type="button" onClick={handleSave} disabled={saving} className="px-5 py-2 text-xs font-black rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {saving ? '저장 중…' : '✅ 내 역할 임무 완료 및 임시저장'}
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// 2단계: 읽기 전용 뷰어
// ────────────────────────────────────────────────────────────────────────
export function ExecutiveSectionViewer({ sectionKey, sec, roleDef }) {
  const content = sec?.content
  const fields = content?.policyFields || {}
  const budgetItems = content?.budgetItems || []

  // 역할별 섹션키에 맞는 레이블 사용
  const fieldLabelMap = sectionKey === 'skeleton' ? {
    title: '제1조 목적 (정책명)', problem: '배경·근거', purpose: '목적 설명', targetCitizens: '제2조 대상·범위',
  } : sectionKey === 'decree' ? {
    content: '제3조 시행 절차',
  } : sectionKey === 'evidence' ? {
    evidence: '제4조 지원 내용·재원', publicConcern: '지원 규모 근거', publicResponse: '우려·조정 기준',
  } : sectionKey === 'effect' ? {
    expectedEffect: '기대효과·예상 피해', discussionReflection: '제5조 점검·보완',
  } : {}

  const textBlocks = []
  const orderedKeys = Object.keys(fieldLabelMap).length
    ? Object.keys(fieldLabelMap)
    : Object.keys(fields)
  for (const k of orderedKeys) {
    const val = fields[k]
    if (typeof val === 'string' && val.trim()) {
      const label = fieldLabelMap[k] || k
      textBlocks.push(`[${label}]\n${val}`)
    }
  }

  const text = textBlocks.join('\n\n')

  return (
    <div className="space-y-2">
      {text ? (
        <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed bg-white p-2 border rounded">
          {text}
        </p>
      ) : (
        <p className="text-xs text-gray-400 italic">아직 작성되지 않았습니다.</p>
      )}

      {budgetItems.length > 0 && (
        <div className="space-y-1 bg-emerald-50/50 p-2 rounded border border-emerald-100 mt-2">
          <p className="text-[10px] font-bold text-emerald-800">💰 편성 예산 항목 ({budgetItemTotal(budgetItems)}억)</p>
          <div className="space-y-1">
            {budgetItems.map((item, idx) => (
              <div key={item.id || idx} className="text-[10px] flex items-center justify-between text-slate-700 bg-white px-2 py-0.5 rounded border border-emerald-100/50">
                <span>{idx + 1}. {item.title || '(무제)'} ({item.note || '산출식 미입력'})</span>
                <span className="font-bold text-emerald-800 shrink-0">{formatBudgetAmount(item.amount)}억</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 3단계: 정책 총괄원 최종 취합 및 병합 에디터 (대표 조립기)
// ────────────────────────────────────────────────────────────────────────
export function ExecutiveFinalAssembler({
  sections,
  finalDoc,
  onSaveDraft,
  saving,
  onPublishSubmit,
  allSectionsDone,
  groupId,
  isCollaborative = true,
}) {
  const [fields, setFields] = useState(() => finalDoc?.content?.policyFields || { ...emptyPolicyFields })
  const [budgetItems, setBudgetItems] = useState(() => finalDoc?.content?.budgetItems || [])
  const [passedBills, setPassedBills] = useState([])
  const [savingPart, setSavingPart] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const roomCode = useGameStore((s) => s.roomCode)
  const config = useGameStore((s) => s.config)
  const groups = useGameStore((s) => s.groups)
  const className = useGameStore((s) => s.className)
  const countryName = config?.branchConfig?.executive?.countryName || config?.countryName || className || '축소국'

  useEffect(() => {
    if (!isEditing && finalDoc?.content) {
      setFields(finalDoc.content.policyFields || { ...emptyPolicyFields })
      setBudgetItems(finalDoc.content.budgetItems || [])
    }
  }, [finalDoc, isEditing])

  // 대표가 수정 중인 내용은 같은 부처에만 보이며, 1초 디바운스로 DB 쓰기량을 줄인다.
  useEffect(() => {
    if (!isEditing) return

    // 이전 저장 상태와 동일하다면 저장을 건너뛰어 DB 쓰기 트래픽 최적화
    const prevFields = finalDoc?.content?.policyFields || {}
    const prevBudgets = finalDoc?.content?.budgetItems || []
    
    const isFieldsEqual = JSON.stringify(prevFields) === JSON.stringify(fields)
    const isBudgetsEqual = JSON.stringify(prevBudgets) === JSON.stringify(budgetItems)
    if (isFieldsEqual && isBudgetsEqual) return

    const timer = setTimeout(() => {
      onSaveDraft({
        policyFields: fields,
        budgetItems,
        savedSections: finalDoc?.content?.savedSections || {},
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [fields, budgetItems, isEditing, finalDoc, onSaveDraft])

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'bills', (d) => {
      const list = Object.entries(d || {})
        .map(([id, b]) => ({ id, ...b }))
        .filter((b) => b.status === 'passed')
      setPassedBills(list)
    })
    return () => u?.()
  }, [roomCode])

  const patchField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }
  const patchFields = (updates) => {
    setFields((prev) => ({ ...prev, ...updates }))
  }

  const loadPreviewToEditor = () => {
    // 이미 직접 다듬은 내용이 있으면 경고 후 덮어쓴다(모둠원 저장본으로 새로 불러오기).
    const hasExisting =
      (fields && Object.values(fields).some((v) => typeof v === 'string' && v.trim())) ||
      (Array.isArray(budgetItems) && budgetItems.length > 0)
    if (hasExisting) {
      if (!window.confirm('이미 직접 다듬은 내용이 있습니다.\n그 내용을 지우고, 모둠원이 저장한 작성본으로 다시 불러올까요?\n\n(불러온 뒤 [✓ 완료]를 누르면 불러온 내용 그대로 저장됩니다.)')) return
    }
    // 기존 finalDoc을 병합하지 않고, 모둠원 저장본(sections)으로 새로 채운다.
    const allFields = { ...emptyPolicyFields }

    if (!isCollaborative) {
      {
        // ── 일반 부처/대통령실 공통: 각 역할의 조항 초안을 제1조~제5조 순서로 조립 ──
        // (대통령실도 역할이 skeleton/decree/evidence/effect로 통일되어 부처와 동일하게 처리)
        // 역할중심 섹션은 policyFields = { qna, text, links } 형태(질문 답변)로 저장되므로,
        // 원시 필드가 없으면 qna(질문별 답변)를 해당 조항 필드로 변환해 읽는다.
        // 역할중심 섹션은 qna(질문별 답변)로 저장 → 각 조항 필드로 변환해 읽는다.
        // (모든 질문이 매핑되므로 원문 text 폴백은 쓰지 않음 — 중복 방지)
        const fieldsOf = (key) => {
          const pf = sections?.[key]?.content?.policyFields || {}
          const qna = pf.qna || {}
          const Q = (i) => (typeof qna[i] === 'string' ? qna[i].trim() : '')
          if (key === 'skeleton') return { title: pf.title || Q(0), purpose: pf.purpose || Q(1), problem: pf.problem || Q(1), targetCitizens: pf.targetCitizens || Q(2) }
          if (key === 'decree')   return { content: pf.content || [Q(0), Q(1)].filter(Boolean).join('\n') }
          if (key === 'evidence') return { evidence: pf.evidence || Q(0), publicConcern: pf.publicConcern || Q(1), publicResponse: pf.publicResponse || Q(2) }
          if (key === 'effect')   return { expectedEffect: pf.expectedEffect || Q(0), discussionReflection: pf.discussionReflection || Q(1) }
          return pf
        }
        const skel = fieldsOf('skeleton')
        const dec  = fieldsOf('decree')
        const evid = fieldsOf('evidence')
        const eff  = fieldsOf('effect')

        // 정책명 (목적·대상 설계원이 작성)
        if (skel.title) allFields.title = skel.title

        // 제1조~제5조 텍스트 조립
        const articleParts = []
        // skeleton의 purpose·problem이 같은 답변(qna[1])을 가리킬 수 있으므로 중복 제거
        const purposeBody = [...new Set([skel.purpose, skel.problem].filter((v) => v && v.trim()))].join('\n')
        if (purposeBody) {
          articleParts.push(`제1조 (목적)\n${purposeBody}`)
        }
        if (skel.targetCitizens) {
          articleParts.push(`제2조 (대상·범위)\n${skel.targetCitizens}`)
        }
        if (dec.content) {
          articleParts.push(`제3조 (시행 절차)\n${dec.content}`)
        }
        if (evid.evidence) {
          articleParts.push(`제4조 (지원 내용·재원)\n${evid.evidence}`)
        }
        const effText = [eff.expectedEffect, eff.discussionReflection].filter(Boolean).join('\n')
        if (effText) {
          articleParts.push(`제5조 (점검·보완)\n${effText}`)
        }
        // 조항이 1개 이상 있으면 항상 덮어쓰기 (최신 초안 반영)
        if (articleParts.length > 0) {
          allFields.ordinance = articleParts.join('\n\n')
        }

        // 보조 필드 (비어 있을 때만 채움)
        if (skel.problem && !allFields.evidence) allFields.evidence = skel.problem
        if (evid.publicConcern && !allFields.publicConcern) allFields.publicConcern = evid.publicConcern
        if (evid.publicResponse && !allFields.publicResponse) allFields.publicResponse = evid.publicResponse
        if (eff.expectedEffect && !allFields.expectedEffect) allFields.expectedEffect = eff.expectedEffect
      }
    } else {
      // ── 공동작업 모드: 구버전 호환 — 최종 병합 문서가 없을 때만 섹션 필드를 보조로 읽는다 ──
      if (!Object.values(allFields).some((value) => typeof value === 'string' && value.trim())) {
        Object.values(sections).forEach(sec => {
          const fields = sec?.content?.policyFields
          if (fields) {
            Object.keys(fields).forEach(k => {
              if (typeof fields[k] === 'string' && fields[k].trim()) allFields[k] = fields[k]
            })
          }
        })
      }
    }

    setFields(allFields)

    // 예산 목록 — 모둠원 저장본으로 새로 불러온다(기존 finalDoc 예산은 제외).
    const allBudgets = []
    const idSet = new Set()
    allBudgets.forEach((item, idx) => idSet.add(item.id || `final-${idx}`))
    Object.values(sections).forEach((sec) => {
      const items = sec?.content?.budgetItems || []
      items.forEach((item) => {
        const itemId = item.id || `${sec?.authorRole || 'section'}-${items.indexOf(item)}`
        if (!idSet.has(itemId)) {
          idSet.add(itemId)
          allBudgets.push({ ...item, id: itemId })
        }
      })
    })

    setBudgetItems(allBudgets)
    // 불러온 내용을 바로 저장(미리보기 모드에서도 불러온 걸로 저장되게).
    onSaveDraft?.({
      policyFields: allFields,
      budgetItems: allBudgets,
      savedSections: finalDoc?.content?.savedSections || {},
    })
    alert(isCollaborative
      ? '부서원들이 작성한 모든 초안 텍스트와 예산 항목을 성공적으로 취합하여 저장했습니다.'
      : '모둠원의 시행령 조항(제1조~제5조)과 예산 항목을 불러와 저장했습니다. 흐름과 표현을 다듬어 최종 제출하세요.')
  }

  const budgetTotal = useMemo(() => budgetItemTotal(budgetItems), [budgetItems])

  const handleSaveDraft = (showMsg = true) => {
    onSaveDraft({
      policyFields: fields,
      budgetItems,
      savedSections: finalDoc?.content?.savedSections || {},
    })
    if (showMsg) alert('임시 저장되었습니다.')
  }

  const handleSavePart = (partKey) => {
    setSavingPart(partKey)
    onSaveDraft({
      policyFields: fields,
      budgetItems,
      savedSections: {
        ...(finalDoc?.content?.savedSections || {}),
        [partKey]: Date.now(),
      },
      lastSavedPart: partKey,
      lastSavedPartAt: Date.now(),
    })
    window.setTimeout(() => setSavingPart(null), 300)
    alert('해당 구역이 저장되었습니다.')
  }

  const handlePublish = () => {
    if (!fields.title.trim()) {
      alert('정책 이름을 입력하세요.')
      return
    }
    if (budgetTotal > 100) {
      if (!confirm('요청한 예산 총합이 100억을 초과합니다. 그래도 제출하시겠습니까?')) return
    }

    onPublishSubmit({
      policyFields: fields,
      budgetItems,
      draftBudget: budgetTotal,
      requestedBudget: budgetTotal,
      budgetCalc: budgetItems[0]?.calc || emptyBudgetCalc(),
      policySavedAt: Date.now(),
      budgetSavedAt: Date.now(),
    })
  }

  if (!isEditing) {
    return (
      <div className="space-y-4">
        {/* 안내 배너 및 상단 버튼 */}
        <div className="bg-slate-900 rounded-xl p-4 text-xs space-y-3 border border-slate-800 text-slate-350">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-amber-950 text-amber-400 font-bold px-2 py-0.5 rounded">검토 단계 (확정 전)</span>
              <span className="font-bold text-white">📋 부서 통합 최종안 미리보기</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadPreviewToEditor}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition"
              >
                📥 모둠원 작성본 모두 불러오기
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition"
              >
                ✏️ 최종안 직접 수정하기
              </button>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 text-left space-y-0.5">
            <p><b className="text-indigo-300">📥 모둠원 작성본 모두 불러오기</b>: 각 역할 학생이 저장한 시행령 조항(제1~5조)과 예산을 한 번에 가져와 최종안에 채웁니다. <b className="text-amber-300">이미 직접 다듬은 내용이 있으면 그 내용을 지우고 새로 불러옵니다(확인 후).</b> 불러온 뒤 [✓ 완료]를 누르면 그대로 저장됩니다.</p>
            <p><b className="text-emerald-300">✏️ 최종안 직접 수정하기</b>: 시행령, 근거·피해·보완, 예산 명세를 직접 편집하고 예산 계산기를 다시 사용합니다.</p>
            <p className="text-slate-500">※ 다른 모둠원에게는 이 화면이 읽기 전용 미리보기로 보이고, 대표만 불러오기·수정·제출할 수 있어요.</p>
          </div>
        </div>

        {/* 정책 보고서 미리보기 카드 */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 space-y-4 text-left">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-start gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-black text-white">
                📄 {fields.title || <span className="text-slate-500 italic">제목 없는 정책안 (수정이 필요합니다)</span>}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">총 청구 예산</p>
              <p className="text-lg font-black text-emerald-400">{formatBudgetAmount(budgetTotal)}억</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 정책 보고서 */}
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-400">[제1조~제5조 시행령]</h4>
                <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-900 p-2.5 rounded border border-indigo-950/50 mt-1 min-h-[60px]">
                  {fields.ordinance || <span className="text-slate-500 italic">(시행령 내용 미기입)</span>}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-indigo-400">[정책 근거 및 사례]</h4>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
                  {fields.evidence || <span className="text-slate-500 italic">(근거 내용 미기입)</span>}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-indigo-400">[근거·피해·보완]</h4>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
                  필요 근거 및 사례: {fields.evidence || <span className="text-slate-500 italic">(미기입)</span>}
                </p>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
                  예상 피해/손해: {fields.publicConcern || <span className="text-slate-500 italic">(미기입)</span>}
                </p>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
                  대응: {fields.publicResponse || <span className="text-slate-500 italic">(미기입)</span>}
                </p>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
                  기대 효과/홍보: {fields.expectedEffect || <span className="text-slate-500 italic">(미기입)</span>}
                </p>
              </div>
            </div>

            {/* 예산 내역 */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
              <h4 className="text-xs font-bold text-emerald-400">💰 예산 청구 명세서</h4>
              {budgetItems.length === 0 ? (
                <p className="text-xs text-slate-500 italic">편성된 예산이 없습니다.</p>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {budgetItems.map((item, idx) => (
                    <div key={item.id || idx} className="text-xs flex items-center justify-between bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-white truncate text-[11px]">{idx + 1}. {item.title || '(무제)'}</p>
                        <p className="text-[10px] text-slate-500 truncate">{item.note || buildBudgetFormula(item.calc) || '산출식 미기입'}</p>
                      </div>
                      <span className="font-bold text-emerald-400 text-xs shrink-0">{formatBudgetAmount(item.amount)}억</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-slate-800 pt-2 flex justify-between text-xs font-black text-white">
                <span>총 청구액 합계:</span>
                <span className="text-emerald-450">{formatBudgetAmount(budgetTotal)}억</span>
              </div>
            </div>
          </div>
        </div>

        {/* 제출 및 초안 저장 제어 영역 */}
        <div className="flex items-center gap-3 justify-end pt-2">
          {!allSectionsDone && (
            <p className="text-xs text-amber-750 bg-amber-50 rounded px-3 py-2 mr-auto text-left">
              ⚠️ 부서원 중 아직 초안 작성을 완료하지 않은 사람이 있습니다. 수동으로 병합했거나 직접 다 채웠다면 최종 제출할 수 있습니다.
            </p>
          )}
          <button
            type="button"
            onClick={() => handleSaveDraft(true)}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            {saving ? '저장 중…' : '💾 초안 임시저장'}
          </button>

          <button
            type="button"
            onClick={handlePublish}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            🚀 정책·예산안 최종 제출
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 상단 안내 바 */}
      <div className="bg-emerald-50 rounded-xl p-4 text-xs space-y-2 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3">
        <div className="text-left">
          <p className="font-bold">✏️ 최종안 직접 수정 모드</p>
          <p className="opacity-80">
            {isCollaborative
              ? '시행령, 근거, 국민 눈높이, 부처 예산을 직접 편집합니다. 완료 시 미리보기로 돌아갑니다.'
              : '모둠원이 작성한 시행령 조항과 예산 항목을 직접 다듬어 최종안을 완성합니다. [📥 모둠원 작성본 모두 불러오기]는 각 역할 저장본을 새로 가져옵니다(직접 다듬은 내용이 있으면 지우고 불러오기, 확인 후).'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPreviewToEditor}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition"
          >
            📥 모둠원 작성본 모두 불러오기
          </button>
          <button
            type="button"
            onClick={() => {
              handleSaveDraft(false)
              setIsEditing(false)
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg text-[11px] transition"
          >
            ✓ 완료 (미리보기)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 좌측: 정책 집행계획 & 시행령 */}
        <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1 text-left">📄 정책 집행 보고서 완성</h4>

          {isCollaborative ? (
            <>
              <ExecutiveGuidedPolicyBuilder
                fields={fields}
                patchField={patchField}
                patchFields={patchFields}
                groupId={groupId}
                passedBills={passedBills}
                countryName={countryName}
                onSavePart={handleSavePart}
                savingPart={savingPart}
                titleLabel="정책 이름"
                ordinanceLabel="제1조~제5조 시행령 최종본"
              />

              <ExecutivePublicEyeSection
                fields={fields}
                patchField={patchField}
                onSavePart={handleSavePart}
                savingPart={savingPart}
              />
            </>
          ) : (
            <div className="space-y-3 text-left">
              <p className="text-[11px] text-slate-500">
                모둠원들의 시행령 조항과 예산 항목이 자동으로 모여 있습니다. 대표가 어울리는 흐름으로 다듬어 최종 제출하세요.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">정책 이름</label>
                <input
                  type="text"
                  value={fields.title || ''}
                  onChange={(e) => patchField('title', e.target.value)}
                  placeholder="예: 일회용 플라스틱 줄이기 정책"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">제1조~제5조 시행령 최종본</label>
                <textarea
                  value={fields.ordinance || ''}
                  onChange={(e) => patchField('ordinance', e.target.value)}
                  placeholder={'예시:\n제1조(목적) ...\n제2조(대상) ...\n제3조(시행 절차) ...\n제4조(지원 내용) ...\n제5조(점검·보완) ...'}
                  rows={12}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono leading-relaxed focus:ring-2 focus:ring-emerald-300"
                />
                <p className="text-[10px] text-slate-500 mt-1">모둠원이 작성한 제1조~제5조 초안이 한꺼번에 들어옵니다. 흐름과 표현만 다듬어 주세요.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">정책 근거 및 사례 (선택)</label>
                <textarea
                  value={fields.evidence || ''}
                  onChange={(e) => patchField('evidence', e.target.value)}
                  placeholder="예: 통계, 기사, 비슷한 정책 사례 등"
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">예상 피해 시민·분야 (선택)</label>
                  <textarea
                    value={fields.publicConcern || ''}
                    onChange={(e) => patchField('publicConcern', e.target.value)}
                    placeholder="예: 일회용 컵을 많이 쓰는 카페 사장님"
                    rows={3}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">대응 방법 (선택)</label>
                  <textarea
                    value={fields.publicResponse || ''}
                    onChange={(e) => patchField('publicResponse', e.target.value)}
                    placeholder="예: 친환경 매장 보조금 지원으로 부담 완화"
                    rows={3}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">기대 효과 및 홍보 문구 (선택)</label>
                <textarea
                  value={fields.expectedEffect || ''}
                  onChange={(e) => patchField('expectedEffect', e.target.value)}
                  placeholder={'예: 1년 안에 일회용품 30% 감소.\n홍보 문구 — "한 잔의 다회용 컵이 나무 한 그루를 살립니다."'}
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>

        {/* 우측: 병합된 예산 최종 조율 */}
        <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1 text-left">💰 부서 통합 예산안 최종 조율</h4>
          <ExecutiveStatsReference countryName={countryName} />
          
          <ExecutiveSectionBudgetManager
            budgetItems={budgetItems}
            setBudgetItems={setBudgetItems}
            groupId={groupId}
          />

          <div className="bg-slate-50 border p-2.5 rounded-lg text-xs space-y-1 text-left">
            <h5 className="font-bold text-slate-800">💡 예산 제출 가이드</h5>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[11px]">
              <li>모둠 전체 예산 한도는 100억입니다.</li>
              <li>각 역할의 실행 사업에 필요한 예산 명세를 확인하고 미비한 점을 보완하세요.</li>
              <li>공통 운영 예산 항목이 누락되었다면 추가해 주십시오.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={() => handleSaveDraft(true)}
          disabled={saving}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          {saving ? '저장 중…' : '💾 초안 임시저장'}
        </button>

        <button
          type="button"
          onClick={() => {
            handleSaveDraft(false)
            setIsEditing(false)
          }}
          className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
        >
          ✓ 완료하고 미리보기로 돌아가기
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// 3단계: 최종제출 완료 후 읽기 전용 뷰어
// ────────────────────────────────────────────────────────────────────────
export function ExecutiveFinalViewer({
  finalDoc,
  badgeLabel,
  badgeClassName,
  headingPrefix = '📄',
  emptyTitle = '제목 없는 정책안',
  repLabel = '장관',
}) {
  const content = finalDoc?.content
  const fields = content?.policyFields || { ...emptyPolicyFields }
  const budgetItems = content?.budgetItems || []
  const total = budgetItemTotal(budgetItems)
  const resolvedBadgeLabel = badgeLabel || (finalDoc?.status === 'locked' ? '제출 완료' : `${repLabel} 검토 중 (실시간 반영)`)
  const resolvedBadgeClassName = badgeClassName || (
    finalDoc?.status === 'locked'
      ? 'bg-emerald-950 text-emerald-400'
      : 'bg-amber-950 text-amber-400 animate-pulse'
  )

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-300 space-y-4">
      <div className="border-b border-slate-800 pb-3 flex justify-between items-start gap-2 flex-wrap">
        <div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${resolvedBadgeClassName}`}>{resolvedBadgeLabel}</span>
          <h3 className="text-base font-black text-white mt-1">
            {headingPrefix} {fields.title || emptyTitle}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400">총 청구 예산</p>
          <p className="text-lg font-black text-emerald-400">{formatBudgetAmount(total)}억</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 정책 보고서 */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-bold text-indigo-400">[제1조~제5조 시행령]</h4>
            <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-950 p-2.5 rounded border border-indigo-950/50 mt-1">
              {fields.ordinance || '(미입력)'}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-indigo-400">[정책 근거 및 사례]</h4>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
              {fields.evidence || '(미입력)'}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-indigo-400">[근거·피해·보완]</h4>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
              필요 근거 및 사례: {fields.evidence || '(미입력)'}
            </p>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
              예상 피해/손해: {fields.publicConcern || '(미입력)'}
            </p>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
              대응: {fields.publicResponse || '(미입력)'}
            </p>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mt-1">
              기대 효과/홍보: {fields.expectedEffect || '(미입력)'}
            </p>
          </div>
        </div>

        {/* 예산 내역 */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-bold text-emerald-400">💰 예산 청구 명세서</h4>
          {budgetItems.length === 0 ? (
            <p className="text-xs text-slate-500 italic">편성된 예산이 없습니다.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {budgetItems.map((item, idx) => (
                <div key={item.id || idx} className="text-xs flex items-center justify-between bg-slate-900 border border-slate-800/80 px-2.5 py-1.5 rounded">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-white truncate text-[11px]">{idx + 1}. {item.title || '(무제)'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{item.note || buildBudgetFormula(item.calc) || '산출식 미기입'}</p>
                  </div>
                  <span className="font-bold text-emerald-400 text-xs shrink-0">{formatBudgetAmount(item.amount)}억</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-800 pt-2 flex justify-between text-xs font-black text-white">
            <span>총 청구액 합계:</span>
            <span className="text-emerald-400">{formatBudgetAmount(total)}억</span>
          </div>
        </div>
      </div>
    </div>
  )
}



export function ExecutivePolicyBudgetDraft({ groupId }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const className = useGameStore((s) => s.className)

  const branchUnit = useMemo(() => {
    const branchConfig = config?.branchConfig
    return (branchConfig?.executive?.units || []).find((u) => u.groupId === groupId) || null
  }, [config, groupId])
  const unitId = branchUnit?.unitId || null
  const ministryName = branchUnit?.ministryName || branchUnit?.name || branchUnit?.label || '담당 부처'
  const countryName = config?.branchConfig?.executive?.countryName || config?.countryName || className || '축소국'

  const [finalDoc, setFinalDoc] = useState(null)
  const [savedPolicy, setSavedPolicy] = useState(null)
  const [passedBills, setPassedBills] = useState([])
  const [saving, setSaving] = useState(false)
  const [savingPart, setSavingPart] = useState(null)

  // finalDoc 실시간 구독
  useEffect(() => {
    if (!roomCode || !unitId) return
    const u = subscribe(roomCode, `branchDrafts/${unitId}/finalDoc`, (d) => setFinalDoc(d || null))
    return () => u?.()
  }, [roomCode, unitId])

  // 기존 반 호환: 예전 작업은 branchDrafts 없이 policies/{groupId}에만 남아 있을 수 있다.
  useEffect(() => {
    if (!roomCode || !groupId) return
    const u = subscribe(roomCode, `policies/${groupId}`, (d) => setSavedPolicy(d || null))
    return () => u?.()
  }, [roomCode, groupId])

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'bills', (d) => {
      const list = Object.entries(d || {})
        .map(([id, b]) => ({ id, ...b }))
        .filter((b) => b.status === 'passed')
      setPassedBills(list)
    })
    return () => u?.()
  }, [roomCode])

  const [fields, setFields] = useState({ ...emptyPolicyFields })
  const [budgetItems, setBudgetItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const finalDocHasContent = hasMeaningfulPolicyContent(finalDoc?.content)
  const savedPolicyHasContent = hasMeaningfulPolicyContent(savedPolicy)
  const usingSavedPolicyFallback = !finalDocHasContent && savedPolicyHasContent

  useEffect(() => {
    setFields({ ...emptyPolicyFields })
    setBudgetItems([])
    setLoaded(false)
  }, [groupId, unitId])

  // 최초 로드 시 기존 데이터 반영. 의미 있는 branchDrafts 최종본이 없으면 기존 policies 저장본을 사용한다.
  useEffect(() => {
    if (loaded) return
    const source = finalDocHasContent ? finalDoc.content : savedPolicyHasContent ? savedPolicy : null
    if (source) {
      setFields(normalizePolicyContent(source))
      setBudgetItems(normalizeBudgetItems(source))
      setLoaded(true)
    }
  }, [finalDoc, savedPolicy, loaded, finalDocHasContent, savedPolicyHasContent])

  const patchField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }
  const patchFields = (updates) => {
    setFields((prev) => ({ ...prev, ...updates }))
  }

  const buildDraftContent = (extra = {}) => {
    const budgetTotal = budgetItemTotal(budgetItems)
    return {
      policyFields: fields,
      budgetItems,
      draftBudget: budgetTotal,
      requestedBudget: budgetTotal,
      budgetCalc: budgetItems[0]?.calc || emptyBudgetCalc(),
      ...extra,
    }
  }

  const writeIntermediatePolicy = async (content, partKey) => {
    const preservedStatuses = ['submitted', 'requested', 'adjusted', 'final']
    const previousStatus = savedPolicy?.status || ''
    const nextStatus = preservedStatuses.includes(previousStatus) ? previousStatus : 'saved'
    await setAt(roomCode, `policies/${groupId}`, {
      ...(savedPolicy || {}),
      ministryName: fields.title || savedPolicy?.ministryName || ministryName || '',
      groupName: groups?.[groupId]?.name || savedPolicy?.groupName || '',
      groupId,
      authorStudentId: myStudentId || savedPolicy?.authorStudentId || 'system',
      authorName: myNickname || savedPolicy?.authorName || '',
      status: nextStatus,
      branchUnitId: unitId,
      updatedAt: Date.now(),
      savedAt: Date.now(),
      lastSavedPart: partKey,
      lastSavedPartAt: Date.now(),
      ...content,
    })
  }

  const handleSaveDraft = async () => {
    if (!roomCode || !unitId) return
    setSaving(true)
    try {
      // 이미 최종 제출된 정책은 임시저장이 제출 상태를 강등하지 못하게 막는다(공동작업 동시편집 경합 방지).
      const livePolicy = await getOnce(roomCode, `policies/${groupId}`)
      if (['submitted', 'requested', 'adjusted', 'final'].includes(livePolicy?.status)) {
        alert('이미 최종 제출된 정책입니다.\n다시 수정하려면 선생님께 [제출 취소]를 요청하세요.')
        return
      }
      const content = buildDraftContent({
        savedSections: finalDoc?.content?.savedSections || {},
      })
      await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
        ...(finalDocHasContent ? finalDoc || {} : {}),
        status: 'draft',
        content,
        updatedAt: Date.now(),
      })
      await writeIntermediatePolicy(content, 'all')
      alert('공동 초안이 임시 저장되었습니다.')
    } catch (e) {
      console.error(e)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePart = async (partKey) => {
    if (!roomCode || !unitId || savingPart) return
    setSavingPart(partKey)
    try {
      // 이미 최종 제출된 정책은 구역 저장이 제출 상태를 강등하지 못하게 막는다.
      const livePolicy = await getOnce(roomCode, `policies/${groupId}`)
      if (['submitted', 'requested', 'adjusted', 'final'].includes(livePolicy?.status)) {
        alert('이미 최종 제출된 정책입니다.\n다시 수정하려면 선생님께 [제출 취소]를 요청하세요.')
        return
      }
      const content = buildDraftContent({
        savedSections: {
          ...(finalDoc?.content?.savedSections || {}),
          [partKey]: Date.now(),
        },
        lastSavedPart: partKey,
        lastSavedPartAt: Date.now(),
      })
      await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
        ...(finalDocHasContent ? finalDoc || {} : {}),
        status: 'draft',
        content,
        updatedAt: Date.now(),
      })
      await writeIntermediatePolicy(content, partKey)
      alert('해당 구역이 저장되었습니다. 평가단이 중간 내용을 확인할 수 있습니다.')
    } catch (e) {
      console.error(e)
      alert('구역 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingPart(null)
    }
  }

  const handlePublish = async () => {
    if (!fields.title.trim()) {
      alert('정책 이름을 입력하세요.')
      return
    }
    const budgetTotal = budgetItemTotal(budgetItems)
    if (budgetTotal > 100) {
      if (!confirm('요청한 예산 총합이 100억을 초과합니다. 그래도 제출하시겠습니까?')) return
    }

    setSaving(true)
    try {
      const publishedContent = buildDraftContent({
        policySavedAt: Date.now(),
        budgetSavedAt: Date.now(),
      })

      // finalDoc 잠금
      await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
        content: publishedContent,
        status: 'locked',
        lockedAt: Date.now(),
        lockedBy: myStudentId || 'system',
      })

      // policies/{groupId}에 저장 (최상위에 풀어서)
      await setAt(roomCode, `policies/${groupId}`, {
        ministryName: fields.title || '',
        groupId,
        authorStudentId: myStudentId || 'system',
        status: 'submitted',
        branchUnitId: unitId,
        submittedAt: Date.now(),
        ...publishedContent,
      })

      alert('정책·예산안이 성공적으로 최종 제출되었습니다.')
    } catch (e) {
      console.error(e)
      alert('제출 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const isLocked = finalDoc?.status === 'locked' && finalDocHasContent

  if (isLocked) {
    return <ExecutiveFinalViewer finalDoc={finalDoc} />
  }

  return (
    <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900">
        <p className="font-bold">🤝 공동작업 모드 — 최종 템플릿 직접 작성</p>
        <p className="opacity-80">
          역할별 초안을 따로 모으지 않고, 이 최종 정책·시행령·예산 템플릿을 함께 상의하며 바로 완성합니다.
          {usingSavedPolicyFallback ? ' 기존 정책 저장본을 불러와 이어서 보여주고 있습니다.' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 좌측: 정책 집행계획 & 시행령 */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1">📄 정책 집행 보고서 작성</h4>
          
          <ExecutiveGuidedPolicyBuilder
            fields={fields}
            patchField={patchField}
            patchFields={patchFields}
            groupId={groupId}
            passedBills={passedBills}
            ministryName={ministryName}
            countryName={countryName}
            onSavePart={handleSavePart}
            savingPart={savingPart}
            titleLabel="정책 이름"
            ordinanceLabel="제1조~제5조 시행령 최종안"
          />

          <ExecutivePublicEyeSection
            fields={fields}
            patchField={patchField}
            onSavePart={handleSavePart}
            savingPart={savingPart}
          />

        </div>

        {/* 우측: 예산 조율 */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 border-b pb-1">💰 예산안 작성</h4>
          <ExecutiveStatsReference countryName={countryName} />
          
          <ExecutiveSectionBudgetManager
            budgetItems={budgetItems}
            setBudgetItems={setBudgetItems}
            groupId={groupId}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          {saving ? '저장 중…' : '💾 초안 저장'}
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={saving}
          className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
        >
          🚀 정책·예산안 최종 제출
        </button>
      </div>
    </div>
  )
}

export default ExecutivePolicyBudgetDraft
