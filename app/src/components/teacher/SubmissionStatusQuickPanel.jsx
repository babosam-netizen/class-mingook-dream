import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import SubmissionDetailModal from './SubmissionDetailModal'
import { formatBudgetAmount } from '../phase3/executiveBudgetData'
import { resolveImageUrl } from '../../lib/legacy-image'

const STEP_CONFIGS = {
  media: {
    title: '1-4 캠페인 포스터·주장글·자료 제출 확인',
    mode: 'group',
    sources: ['posters', 'essays', 'links'],
  },
  article: {
    title: '1-7 기사 작성 제출 확인',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 1) === 1,
  },
  prep: {
    title: '2-1 공약 개발용 자료수집 확인',
    mode: 'group',
    sources: ['researchPlans'],
    researchContext: 'phase2_election',
  },
  register: {
    title: '2-2 후보 등록 제출 확인',
    mode: 'group',
    sources: ['candidates'],
  },
  finalNews: {
    title: '2-8 선거 결과 기사 작성 확인',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 0) === 2 || article?.target === 'election',
  },
  'legislative-draft': {
    title: '3-2 입법 발의 제출 확인',
    mode: 'group',
    sources: ['bills'],
  },
  article1: {
    title: '3-8 입법 단계 기사 확인 (여정 / 토론후)',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 0) === 3 && article?.target === 'legislative',
    articleGroups: [
      { key: 'journey', label: '📜 입법 여정 기사', hint: '활동 중 작성', filter: (a) => Number(a?.phase || 0) === 3 && a?.target === 'legislative' && a?.contextType !== 'debate' },
      { key: 'debate', label: '📢 입법 토론후 기사', hint: '상정 토론 후 작성', filter: (a) => Number(a?.phase || 0) === 3 && a?.target === 'legislative' && a?.contextType === 'debate' },
    ],
  },
  'executive-budget': {
    title: '3-10 정책·예산안 제출 확인',
    mode: 'group',
    sources: ['policies'],
  },
  article2: {
    title: '3-17 행정(시행령) 단계 기사 확인 (여정 / 토론후)',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 0) === 3 && article?.target === 'executive',
    articleGroups: [
      { key: 'journey', label: '🏢 행정 여정 기사', hint: '활동 중 작성', filter: (a) => Number(a?.phase || 0) === 3 && a?.target === 'executive' && a?.contextType !== 'debate' },
      { key: 'debate', label: '📢 시행령 토론후 기사', hint: '국무회의 토론 후 작성', filter: (a) => Number(a?.phase || 0) === 3 && a?.target === 'executive' && a?.contextType === 'debate' },
    ],
  },
  article3: {
    title: '3-20 사법 단계 기사 확인 (여정 / 토론후)',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 0) === 3 && article?.target === 'judicial',
    articleGroups: [
      { key: 'journey', label: '⚖️ 사법 여정 기사', hint: '활동 중 작성', filter: (a) => Number(a?.phase || 0) === 3 && a?.target === 'judicial' && a?.contextType !== 'debate' },
      { key: 'debate', label: '📢 재판 토론후 기사', hint: '모의재판 후 작성', filter: (a) => Number(a?.phase || 0) === 3 && a?.target === 'judicial' && a?.contextType === 'debate' },
    ],
  },
  reflect: {
    title: '4-1 정리글 작성 제출 확인',
    mode: 'student',
    sources: ['reflections'],
  },
}

const SOURCE_PATHS = {
  posters: 'posters',
  essays: 'essays',
  links: 'links',
  articles: 'articles',
  researchPlans: 'researchPlans',
  candidates: 'candidates',
  journalistNewspapers: 'journalistNewspapers',
  bills: 'bills',
  policies: 'policies',
  reflections: 'reflections',
}

const NEWSPAPER_LAYOUT_TYPES = [
  { key: 'lead', label: '머리기사' },
  { key: 'support', label: '보조기사' },
  { key: 'analysis', label: '분석기사' },
  { key: 'interview', label: '인터뷰/의견' },
  { key: 'brief', label: '짧은 기사' },
  { key: 'unused', label: '이번 신문에는 제외' },
]

const timeOf = (item = {}) =>
  item.updatedAt || item.createdAt || item.registeredAt || item.submittedAt || item.policySubmittedAt || item.budgetSubmittedAt || item.at || 0

const fmtTime = (ts) => {
  if (!ts) return '시간 기록 없음'
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const asArray = (map = {}) => Object.entries(map || {}).map(([id, value]) => ({ id, ...value }))
const groupIdOf = (item = {}) => item.groupId || item.authorGroupId || item.proposerGroupId
const studentIdOf = (item = {}) => item.authorStudentId || item.submittedByStudentId || item.leaderStudentId

function normalizeNewspaperLayoutItem(item = {}) {
  const slot = NEWSPAPER_LAYOUT_TYPES.some((type) => type.key === item.slot) ? item.slot : 'brief'
  if (slot === 'unused') return { ...item, slot, page: 0 }
  const page = Number(item.page || (['analysis', 'interview'].includes(slot) ? 2 : 1)) === 2 ? 2 : 1
  return { ...item, slot, page }
}

function getNewspaperLayoutGroups(layoutItems = []) {
  const groups = {
    1: Object.fromEntries(NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused').map((slot) => [slot.key, []])),
    2: Object.fromEntries(NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused').map((slot) => [slot.key, []])),
    unused: [],
  }
  ;(layoutItems || []).forEach((item) => {
    const normalized = normalizeNewspaperLayoutItem(item)
    if (normalized.slot === 'unused') groups.unused.push(normalized)
    else groups[normalized.page][normalized.slot].push(normalized)
  })
  return groups
}

function latestFirst(items = []) {
  return [...items].sort((a, b) => timeOf(b) - timeOf(a))
}

function getResearchSubmissions(researchPlans = {}, contextKey) {
  const context = researchPlans?.[contextKey] || {}
  return Object.entries(context).map(([gid, plan]) => {
    const targets = asArray(plan?.targets)
    const items = asArray(plan?.items)
    return {
      id: gid,
      groupId: gid,
      type: 'research',
      title: `자료 목록 ${targets.length}개 · 수집 자료 ${items.length}개`,
      targets,
      items,
      updatedAt: Math.max(0, ...targets.map(timeOf), ...items.map(timeOf)),
    }
  }).filter((entry) => entry.targets.length || entry.items.length)
}

function buildSubmissions(config, data) {
  if (!config) return []
  if (config.researchContext) return getResearchSubmissions(data.researchPlans, config.researchContext)

  if (config.sources.includes('posters') || config.sources.includes('essays') || config.sources.includes('links')) {
    return [
      ...latestFirst(asArray(data.posters)).map((item) => ({ ...item, type: 'poster', title: item.caption || '캠페인 포스터' })),
      ...latestFirst(asArray(data.essays)).map((item) => ({ ...item, type: 'essay', title: item.title || item.claim || '주장하는 글' })),
      ...latestFirst(asArray(data.links)).map((item) => ({ ...item, type: 'link', title: item.title || item.url || '자료 링크' })),
    ].filter((item) => groupIdOf(item))
  }

  if (config.sources.includes('articles')) {
    return asArray(data.articles)
      .filter((article) => article.status !== 'deleted')
      .filter((article) => !config.articleFilter || config.articleFilter(article))
      .map((article) => ({ ...article, type: 'article', title: article.headline || '기사' }))
  }

  if (config.sources.includes('candidates')) {
    return asArray(data.candidates)
      .filter((item) => item.status === 'submitted' || item.registeredAt)
      .map((item) => ({ ...item, type: 'candidate', title: `${item.leaderNickname || '후보'} 후보 등록` }))
  }

  if (config.sources.includes('bills')) {
    return asArray(data.bills).map((item) => ({ ...item, type: 'bill', title: item.title || '법률안' }))
  }

  if (config.sources.includes('policies')) {
    return asArray(data.policies)
      .filter((item) => item.status === 'submitted' || item.policySubmittedAt || item.budgetSubmittedAt || item.submittedAt)
      .map((item) => ({ ...item, type: 'policy', title: item.policyFields?.title || item.policyFields?.policyName || item.ministryName || '정책·예산안' }))
  }

  if (config.sources.includes('reflections')) {
    return asArray(data.reflections).map((item) => ({ ...item, type: 'reflection', title: item.finalEssay ? '정리글' : '활동 소감' }))
  }

  return []
}

function summarizeSubmitter(entity, submissions, mode, groups, students) {
  const name = mode === 'group'
    ? entity.name || entity.topic || entity.id
    : `${entity.number ? `${entity.number}번 ` : ''}${entity.nickname || entity.name || entity.id}`
  return {
    id: entity.id,
    name,
    submitted: submissions.length > 0,
    count: submissions.length,
    latestAt: Math.max(0, ...submissions.map(timeOf)),
    submissions: latestFirst(submissions),
    meta: mode === 'group'
      ? `${Object.keys(entity.members || {}).length}명`
      : groups?.[entity.groupId]?.name || '',
  }
}

function TagBadge({ tag }) {
  if (!tag) return null
  const tags = tag.split(',')
  return (
    <div className="inline-flex gap-1 ml-1.5">
      {tags.includes('fact') && (
        <span className="text-[8px] px-1 bg-blue-100 text-blue-700 rounded font-bold">사실</span>
      )}
      {tags.includes('opinion') && (
        <span className="text-[8px] px-1 bg-orange-100 text-orange-700 rounded font-bold">의견</span>
      )}
    </div>
  )
}

/* ── 신규: 단계별 세부내용 조회 모달 (4-1 reflect 퀵패널 전용) ── */
function StepDetailModal({ student, step, r, onClose }) {
  const stepNames = ['개요 작성', '도입 단락', '전개 단락', '마무리 단락', '최종본 작성']
  if (!r) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if(e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[80vh]">
        <div className="bg-pink-50 border-b border-pink-100 px-4 py-3 flex items-center justify-between shrink-0">
          <div>
            <h4 className="font-extrabold text-pink-900 text-xs">{student?.number}번 {student?.nickname} 학생</h4>
            <p className="text-[9px] text-pink-700 font-bold">{step}단계. {stepNames[step - 1]} 작성 내용</p>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-full bg-white hover:bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-xs border shadow-sm transition-colors">✕</button>
        </div>

        <div className="p-4 space-y-3.5 text-[11px] text-gray-700 overflow-y-auto leading-relaxed">
          {step === 1 && (
            <div className="space-y-2">
              <div className="bg-blue-50/40 border border-blue-100 p-2.5 rounded-xl">
                <span className="text-[9px] font-extrabold text-blue-700 block mb-1">📘 도입 개요</span>
                <p className="font-medium text-gray-800">{r.outline?.intro || '(비어 있음)'}</p>
              </div>
              <div className="bg-emerald-50/40 border border-emerald-100 p-2.5 rounded-xl">
                <span className="text-[9px] font-extrabold text-emerald-700 block mb-1">📗 전개 개요</span>
                <p className="font-medium text-gray-800">{r.outline?.body || '(비어 있음)'}</p>
              </div>
              <div className="bg-pink-50/40 border border-pink-100 p-2.5 rounded-xl">
                <span className="text-[9px] font-extrabold text-pink-700 block mb-1">📕 마무리 개요</span>
                <p className="font-medium text-gray-800">{r.outline?.conclusion || '(비어 있음)'}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2.5">
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                <p className="font-bold text-gray-500 text-[9px] mb-0.5">💡 도입 개요</p>
                <p className="font-medium text-gray-700 italic">"{r.outline?.intro || ''}"</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                  <span className="text-[9px] font-bold text-gray-500 block mb-0.5">중심 문장</span>
                  <p className="font-bold text-gray-900">{r.p1?.main || '(작성 전)'}<TagBadge tag={r.p1?.mainTag} /></p>
                </div>
                {r.p1?.supportA && (
                  <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                    <span className="text-[9px] font-bold text-gray-500 block mb-0.5">뒷받침 문장 ①</span>
                    <p className="font-medium text-gray-800">{r.p1.supportA}<TagBadge tag={r.p1.supportATag}/></p>
                  </div>
                )}
                {r.p1?.supportB && (
                  <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                    <span className="text-[9px] font-bold text-gray-500 block mb-0.5">뒷받침 문장 ②</span>
                    <p className="font-medium text-gray-800">{r.p1.supportB}<TagBadge tag={r.p1.supportBTag}/></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2.5">
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                <p className="font-bold text-gray-500 text-[9px] mb-0.5">💡 전개 개요</p>
                <p className="font-medium text-gray-700 italic">"{r.outline?.body || ''}"</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                  <span className="text-[9px] font-bold text-gray-500 block mb-0.5">중심 문장</span>
                  <p className="font-bold text-gray-900">{r.p2?.main || '(작성 전)'}<TagBadge tag={r.p2?.mainTag} /></p>
                </div>
                {r.p2?.supportA && (
                  <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                    <span className="text-[9px] font-bold text-gray-500 block mb-0.5">뒷받침 문장 ①</span>
                    <p className="font-medium text-gray-800">{r.p2.supportA}<TagBadge tag={r.p2.supportATag}/></p>
                  </div>
                )}
                {r.p2?.supportB && (
                  <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                    <span className="text-[9px] font-bold text-gray-500 block mb-0.5">뒷받침 문장 ②</span>
                    <p className="font-medium text-gray-800">{r.p2.supportB}<TagBadge tag={r.p2.supportBTag}/></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2.5">
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                <p className="font-bold text-gray-500 text-[9px] mb-0.5">💡 마무리 개요</p>
                <p className="font-medium text-gray-700 italic">"{r.outline?.conclusion || ''}"</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                  <span className="text-[9px] font-bold text-gray-500 block mb-0.5">중심 문장</span>
                  <p className="font-bold text-gray-900">{r.p3?.main || '(작성 전)'}<TagBadge tag={r.p3?.mainTag} /></p>
                </div>
                {r.p3?.supportA && (
                  <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                    <span className="text-[9px] font-bold text-gray-500 block mb-0.5">뒷받침 문장 ①</span>
                    <p className="font-medium text-gray-800">{r.p3.supportA}<TagBadge tag={r.p3.supportATag}/></p>
                  </div>
                )}
                {r.p3?.supportB && (
                  <div className="bg-white border p-2.5 rounded-xl shadow-sm">
                    <span className="text-[9px] font-bold text-gray-500 block mb-0.5">뒷받침 문장 ②</span>
                    <p className="font-medium text-gray-800">{r.p3.supportB}<TagBadge tag={r.p3.supportBTag}/></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-2.5">
              <div className="bg-white border p-3 rounded-xl shadow-sm border-pink-200">
                <span className="text-[9px] font-extrabold text-pink-700 block mb-0.5">📝 글 제목</span>
                <p className="font-extrabold text-gray-950 text-xs">"{r.title || '(제목 없음)'}"</p>
              </div>
              <div className="bg-pink-50/20 border border-pink-100 p-3 rounded-xl shadow-inner text-xs">
                <span className="text-[9px] font-extrabold text-pink-700 block mb-1">📜 최종 에세이 본문</span>
                <p className="whitespace-pre-wrap leading-relaxed font-semibold text-gray-800">{r.finalEssay || '(작성 전)'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-4 py-2.5 flex justify-end border-t shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 bg-pink-600 text-white font-extrabold rounded-lg hover:bg-pink-700 transition shadow-sm">확인</button>
        </div>
      </div>
    </div>
  )
}

/* ── 신규: 정리글 진행 체크리스트 (4-1 reflect 전용) ── */
function ReflectionChecklist({ reflectionData, student, onStepClick }) {
  const checkStepDone = (r, step) => {
    if (!r) return false
    if (step === 1) {
      return !!(r.outline?.intro || r.outline?.body || r.outline?.conclusion)
    }
    if (step === 2) {
      return !!(r.p1?.main || r.p1?.supportA || r.p1?.supportB)
    }
    if (step === 3) {
      return !!(r.p2?.main || r.p2?.supportA || r.p2?.supportB)
    }
    if (step === 4) {
      return !!(r.p3?.main || r.p3?.supportA || r.p3?.supportB)
    }
    if (step === 5) {
      return !!r.finalEssay
    }
    return false
  }

  const r = reflectionData
  const stepLabels = ['1.개요', '2.도입', '3.전개', '4.마무리', '5.최종']

  return (
    <div className="mt-2.5 flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {stepLabels.map((label, idx) => {
        const step = idx + 1
        const isDone = checkStepDone(r, step)
        return (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (isDone) {
                onStepClick(student, step, r)
              } else {
                alert(`${student.nickname} 학생은 아직 ${step}단계(${label.slice(2)})를 작성(저장)하지 않았습니다.`)
              }
            }}
            className={`text-[8.5px] px-1.5 py-0.5 rounded font-black border transition-all duration-150 ${
              isDone 
                ? 'bg-emerald-500 text-white border-transparent hover:bg-emerald-600 shadow-sm hover:scale-105' 
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
            title={`${label.slice(2)} 단계 ${isDone ? '완료 (클릭 시 확인)' : '미작성'}`}
          >
            {isDone ? '✓' : '○'} {label.slice(2)}
          </button>
        )
      })}
    </div>
  )
}

/* ── 후보 등록 상세 모달 (2-2 전용) ── */
function CandidateDetailModal({ groupName, candidateData: c, journalistData, newspaperData, onClose }) {
  const backdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  const header = (
    <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
      <div>
        <p className="text-[10px] text-gray-400 font-semibold">2-2 후보 등록 확인</p>
        <h2 className="text-lg font-black text-gray-900">{groupName}</h2>
        {c && (
          <p className="text-xs mt-0.5">
            {c.leaderNickname ? <span className="text-gray-600">{c.leaderNickname} 후보 · </span> : null}
            <span className={c.status === 'submitted' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
              {c.status === 'submitted' ? '✅ 최종제출 완료' : '⏳ 작성 중'}
            </span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 font-bold text-lg shrink-0 ml-3"
      >✕</button>
    </div>
  )

  /* 기자단 */
  if (journalistData) {
    const newspaperSteps = journalistNewspaperSteps(newspaperData)
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={backdrop}>
        <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh]">
          {header}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div className="text-center space-y-2">
              <p className="text-4xl">📰</p>
              <p className="font-black text-blue-800 text-lg">선거 기자단 등록 완료</p>
              <p className="text-xs text-blue-400">{fmtTime(journalistData.registeredAt)}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-blue-500">기자단 마무리 신문</p>
                  <h3 className="text-base font-black text-blue-950">{newspaperData?.title || '신문 이름 미정'}</h3>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${newspaperData?.status === 'submitted' ? 'bg-emerald-600 text-white' : 'bg-amber-200 text-amber-800'}`}>
                  {newspaperData?.status === 'submitted' ? '신문 제출' : newspaperData ? '작성 중' : '미시작'}
                </span>
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                {newspaperSteps.map((step) => {
                  const CLS = {
                    done: 'border-emerald-200 bg-white text-emerald-800',
                    warn: 'border-amber-200 bg-amber-50 text-amber-800',
                    empty: 'border-slate-200 bg-slate-50 text-slate-400',
                  }
                  return (
                    <div key={step.label} className={`rounded-xl border px-3 py-2 text-xs ${CLS[step.state]}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{step.label}</span>
                        <span className="font-black">{step.state === 'done' ? '완료' : step.state === 'warn' ? '작성중' : '미제출'}</span>
                      </div>
                      {step.time && <p className="mt-0.5 text-[10px] opacity-70">{fmtTime(step.time)}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
            {newspaperData?.meetingNotes && <TextBlock title="편집회의 결과" text={newspaperData.meetingNotes} />}
            {newspaperData?.layoutPlan && <TextBlock title="배치 계획" text={newspaperData.layoutPlan} />}
            {newspaperData?.layoutItems?.length > 0 && <NewspaperLayoutBlock layoutItems={newspaperData.layoutItems} totalPages={newspaperData.totalPages} />}
            {newspaperData?.selectedArticleIds?.length > 0 && <TextBlock title="배치 선택 기사" text={`${newspaperData.selectedArticleIds.length}개 기사 선택`} />}
            {newspaperData?.canvaUrl && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-black text-slate-400 mb-1">캔바 신문</p>
                <a href={newspaperData.canvaUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">캔바 신문 열기</a>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* 미시작 */
  if (!c) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={backdrop}>
        <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl">
          {header}
          <p className="text-center text-gray-400 py-10 text-sm">아직 등록을 시작하지 않았습니다.</p>
        </div>
      </div>
    )
  }

  const steps = [
    {
      num: 1, label: '후보 이름',
      state: stepState(!!(c.candidateSavedAt || c.leaderStudentId), !!c.leaderNickname),
      time: c.candidateSavedAt,
      content: c.leaderNickname ? (
        <p className="text-sm font-bold text-gray-800">
          {c.leaderNickname}
          {c.leaderNumber ? <span className="font-normal text-gray-500"> ({c.leaderNumber}번)</span> : null}
        </p>
      ) : null,
    },
    {
      num: 2, label: '소개·출마 선언',
      state: stepState(!!c.introSavedAt, !!(c.pamphlet?.trim())),
      time: c.introSavedAt,
      content: c.pamphlet ? (
        <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{c.pamphlet}</p>
      ) : null,
    },
    {
      num: 3, label: '공약',
      state: stepState(!!c.pledgesSavedAt, !!(c.pledges?.some((p) => p?.trim()))),
      time: c.pledgesSavedAt,
      content: c.pledges?.some(Boolean) ? (
        <ul className="space-y-1">
          {c.pledges.filter(Boolean).map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
              <span className="shrink-0 w-4 h-4 rounded-full bg-amber-100 text-amber-700 font-black flex items-center justify-center text-[9px]">{i + 1}</span>
              {p}
            </li>
          ))}
        </ul>
      ) : null,
    },
    {
      num: 4, label: '홍보자료',
      state: mediaState(c),
      badge: (() => {
        if (!c.mediaSavedAt) return '미제출'
        const cnt = mediaItemCount(c)
        if (cnt >= 3) return '완료 (3/3)'
        if (cnt === 0) return '내용 없음'
        return `미흡 (${cnt}/3)`
      })(),
      time: c.mediaSavedAt,
      content: c.mediaSavedAt ? (
        <div className="space-y-1">
          {c.posterCanvaUrl
            ? <a href={c.posterCanvaUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline break-all">🖼️ 선거 포스터</a>
            : <p className="text-xs text-gray-400">🖼️ 선거 포스터 — <span className="text-red-400 font-bold">미등록</span></p>}
          {c.canvaUrl
            ? <a href={c.canvaUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline break-all">📋 공약 카드뉴스</a>
            : <p className="text-xs text-gray-400">📋 공약 카드뉴스 — <span className="text-red-400 font-bold">미등록</span></p>}
          {c.videoCanvaUrl
            ? <a href={c.videoCanvaUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline break-all">🎬 홍보 영상</a>
            : <p className="text-xs text-gray-400">🎬 홍보 영상 — <span className="text-red-400 font-bold">미등록</span></p>}
        </div>
      ) : null,
    },
    {
      num: 5, label: '최종제출',
      state: stepState(c.status === 'submitted', c.status === 'submitted'),
      time: c.submittedAt,
      content: null,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={backdrop}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh]">
        {header}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {steps.map((step) => {
            const BG   = { done: 'bg-emerald-50 border-emerald-100', warn: 'bg-amber-50 border-amber-100', empty: 'bg-gray-50 border-gray-100' }
            const DOT  = { done: 'bg-emerald-500 text-white', warn: 'bg-amber-400 text-white', empty: 'bg-gray-300 text-gray-500' }
            const LBL  = { done: 'text-emerald-800', warn: 'text-amber-800', empty: 'text-gray-400' }
            const BDGE = { done: 'bg-emerald-200 text-emerald-800', warn: 'bg-amber-200 text-amber-800', empty: 'bg-gray-200 text-gray-500' }
            const ICON = { done: step.num, warn: '△', empty: step.num }
            const BTXT = { done: '완료', warn: '내용 없음', empty: '미제출' }
            return (
              <div key={step.num} className={`rounded-2xl border p-4 ${BG[step.state]}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${DOT[step.state]}`}>
                      {ICON[step.state]}
                    </span>
                    <span className={`text-sm font-black ${LBL[step.state]}`}>{step.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {step.time && <span className="text-[10px] text-gray-400">{fmtTime(step.time)}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${BDGE[step.state]}`}>
                      {step.badge ?? BTXT[step.state]}
                    </span>
                  </div>
                </div>
                <div className="pl-7">
                  {(step.state === 'done' || step.state === 'warn') && step.content
                    ? step.content
                    : step.state === 'warn'
                      ? <p className="text-xs text-amber-600 italic font-semibold">⚠️ 저장은 됐지만 내용이 비어 있습니다.</p>
                      : step.state === 'empty'
                        ? <p className="text-xs text-gray-400 italic">아직 저장하지 않았습니다.</p>
                        : null
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function stepState(saved, filled) {
  if (!saved) return 'empty'
  if (!filled) return 'warn'
  return 'done'
}

/** 홍보자료 3종 중 몇 개 올렸는지 */
function mediaItemCount(c) {
  return [c?.posterCanvaUrl, c?.canvaUrl, c?.videoCanvaUrl].filter(Boolean).length
}
/** 홍보자료 전용 상태: 3개 모두 있어야 done, 1~2개면 warn, 미저장이면 empty */
function mediaState(c) {
  if (!c?.mediaSavedAt) return 'empty'
  return mediaItemCount(c) >= 3 ? 'done' : 'warn'
}

function journalistNewspaperSteps(newspaperData) {
  return [
    { num: 1, label: '신문 이름 저장', short: '신문이름', state: stepState(!!newspaperData?.titleSavedAt, !!newspaperData?.title?.trim()), time: newspaperData?.titleSavedAt },
    { num: 2, label: '신문편집회의 저장', short: '편집회의', state: stepState(!!newspaperData?.meetingSavedAt, !!(newspaperData?.meetingNotes?.trim() || newspaperData?.layoutPlan?.trim() || newspaperData?.selectedArticleIds?.length)), time: newspaperData?.meetingSavedAt },
    { num: 3, label: '캔바 작업 저장', short: '캔바작업', state: stepState(!!newspaperData?.canvaSavedAt, !!newspaperData?.canvaUrl), time: newspaperData?.canvaSavedAt },
    { num: 4, label: '최종제출', short: '최종제출', state: stepState(newspaperData?.status === 'submitted', newspaperData?.status === 'submitted'), time: newspaperData?.submittedAt },
  ]
}

/* ── 후보 등록 체크리스트 (2-2 전용) ── */
function CandidateChecklist({ candidateData, journalistData, newspaperData }) {
  if (journalistData) {
    const steps = journalistNewspaperSteps(newspaperData)
    const CLS = {
      done: 'bg-emerald-100 text-emerald-800',
      warn: 'bg-amber-100 text-amber-700',
      empty: 'bg-slate-100 text-slate-400',
    }
    const ICON = { done: '✓', warn: '△', empty: '○' }
    return (
      <div className="mt-2 space-y-1.5">
        <span className="inline-flex text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">📰 기자단 등록 완료</span>
        <div className="flex gap-1 flex-wrap">
          {steps.map(({ label, short, state, num }) => (
            <span key={label} title={label} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${CLS[state]}`}>
              {ICON[state]} {num}. {short}
            </span>
          ))}
        </div>
      </div>
    )
  }
  if (!candidateData) {
    return (
      <div className="mt-2">
        <span className="text-[10px] text-slate-400">아직 시작하지 않음</span>
      </div>
    )
  }
  const c = candidateData
  const items = [
    { label: '후보 이름', state: stepState(!!(c.candidateSavedAt || c.leaderStudentId), !!c.leaderNickname) },
    { label: '소개·선언',  state: stepState(!!c.introSavedAt, !!(c.pamphlet?.trim())) },
    { label: '공약',       state: stepState(!!c.pledgesSavedAt, !!(c.pledges?.some((p) => p?.trim()))) },
    { label: c.mediaSavedAt ? `홍보 ${mediaItemCount(c)}/3` : '홍보자료', state: mediaState(c) },
    { label: '최종제출',   state: stepState(c.status === 'submitted', c.status === 'submitted') },
  ]
  const CLS = {
    done:  'bg-emerald-100 text-emerald-800',
    warn:  'bg-amber-100 text-amber-700',
    empty: 'bg-slate-100 text-slate-400',
  }
  const ICON = { done: '✓', warn: '△', empty: '○' }
  return (
    <div className="mt-2 flex gap-1 flex-wrap">
      {items.map(({ label, state }) => (
        <span key={label} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${CLS[state]}`}>
          {ICON[state]} {label}
        </span>
      ))}
    </div>
  )
}

// 기사 단계 — 유형(여정/토론후)별로 묶어 작성된 기사를 이름과 함께 보여준다.
const PERSPECTIVE_KO = { critical: '비판', supportive: '옹호', neutral: '중립' }

// 기사 상세 모달 (새 창처럼 전체 내용) — 같은 학생의 여러 기사를 넘겨볼 수 있음
function ArticleDetailModal({ articles, author, onClose }) {
  const [idx, setIdx] = useState(0)
  if (!articles || articles.length === 0) return null
  const i = Math.min(idx, articles.length - 1)
  const article = articles[i]
  const approved = article.status === 'approved'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b flex items-start justify-between gap-2">
          <div>
            <h4 className="font-black text-slate-900 text-base leading-snug">{article.headline || '제목 없음'}</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {author} · {approved ? '✅ 게시' : '⏳ 승인 대기'}
              {article.perspective ? ` · ${PERSPECTIVE_KO[article.perspective] || article.perspective}` : ''}
              {article.contextType === 'debate' ? ' · 📢 토론후' : ''}
            </p>
            {article.debateSessionTopic && <p className="text-[11px] text-slate-400">🎙️ {article.debateSessionTopic}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500 font-bold">✕</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{(article.body || '').trim() || '(본문 없음)'}</p>
        </div>
        {articles.length > 1 && (
          <div className="px-5 py-3 border-t flex items-center justify-between gap-2">
            <button onClick={() => setIdx((p) => Math.max(0, (p || i) - 1))} disabled={i === 0}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 disabled:opacity-40">← 이전</button>
            <span className="text-[11px] font-bold text-slate-400">이 학생의 기사 {i + 1} / {articles.length}</span>
            <button onClick={() => setIdx((p) => Math.min(articles.length - 1, (p || i) + 1))} disabled={i === articles.length - 1}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 disabled:opacity-40">다음 →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ArticleGroupBlock({ group, articles, students }) {
  const [detail, setDetail] = useState(null) // { articles, author }

  // 번호순 학생 격자
  const studentList = Object.entries(students || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
  const byStudent = {}
  articles.forEach((a) => {
    if (!a.authorStudentId) return
    ;(byStudent[a.authorStudentId] = byStudent[a.authorStudentId] || []).push(a)
  })
  const submittedCount = studentList.filter((s) => (byStudent[s.id] || []).length > 0).length

  const authorName = (st, a) => st ? `${st.number || ''}번 ${st.nickname || ''}`.trim() : (a?.authorNickname || '익명')

  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-sky-900">
          {group.label} <span className="text-xs font-bold text-sky-500">(제출 {submittedCount}/{studentList.length}명 · 기사 {articles.length}건)</span>
        </h3>
        {group.hint && <span className="text-[10px] text-slate-400 shrink-0">{group.hint}</span>}
      </div>

      {studentList.length === 0 ? (
        <p className="text-xs text-slate-300 italic py-2 text-center">학생 명단이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {studentList.map((s) => {
            const arts = byStudent[s.id] || []
            const submitted = arts.length > 0
            const a = arts[0]
            const approved = a?.status === 'approved'
            return (
              <button
                key={s.id}
                type="button"
                disabled={!submitted}
                onClick={() => submitted && setDetail({ articles: arts, author: authorName(s, a) })}
                className={`text-left rounded-lg border px-2 py-1.5 transition ${
                  submitted
                    ? 'bg-white border-sky-200 hover:bg-sky-50 hover:border-sky-400 cursor-pointer'
                    : 'bg-slate-50 border-dashed border-slate-200 opacity-70'
                }`}
                title={submitted ? a.headline : '미제출'}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-black text-slate-500 shrink-0">{s.number != null ? `${s.number}번` : ''}</span>
                  <span className={`shrink-0 w-2 h-2 rounded-full ${submitted ? (approved ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-slate-300'}`} />
                </div>
                <div className="text-[11px] font-bold text-slate-700 truncate">{s.nickname || s.name || '학생'}</div>
                <div className={`text-[10px] truncate ${submitted ? 'text-slate-500' : 'text-slate-300'}`}>
                  {submitted ? (a.headline || '제목 없음') : '미제출'}
                  {submitted && arts.length > 1 ? ` 외 ${arts.length - 1}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {detail && <ArticleDetailModal articles={detail.articles} author={detail.author} onClose={() => setDetail(null)} />}
    </div>
  )
}

export default function SubmissionStatusQuickPanel() {
  const wf = useWorkflow()
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const [data, setData] = useState({})
  const [selected, setSelected] = useState(null)
  const [journalistsMap, setJournalistsMap] = useState({})
  const [journalistNewspapersMap, setJournalistNewspapersMap] = useState({})
  const [selectedCandidateGroup, setSelectedCandidateGroup] = useState(null)
  const [activeStepDetail, setActiveStepDetail] = useState(null) // 정리글 5단계 세부 조회 모달 상태
  const [debateSessionsMap, setDebateSessionsMap] = useState({})

  const stepId = wf.currentStep?.id
  const config = STEP_CONFIGS[stepId]
  const sourcesKey = (config?.sources || []).join('|')
  const isCandidateRegister = stepId === 'register'
  const hasArticleGroups = !!config?.articleGroups

  // 기사 유형별 단계: 토론 세션을 구독해 '토론도구에서 쓴 기사'의 소속 부를 추론
  useEffect(() => {
    if (!roomCode || !hasArticleGroups) return undefined
    const u = subscribe(roomCode, 'debateSessions', (d) => setDebateSessionsMap(d || {}))
    return () => u?.()
  }, [roomCode, hasArticleGroups])

  useEffect(() => {
    if (!roomCode || !config) return undefined
    const unsubs = (config.sources || []).map((source) => {
      const path = SOURCE_PATHS[source]
      return subscribe(roomCode, path, (value) => {
        setData((prev) => ({ ...prev, [source]: value || {} }))
      })
    })
    return () => unsubs.forEach((u) => u?.())
  }, [roomCode, stepId, sourcesKey])

  // 후보 등록 단계에서 기자단 데이터도 구독
  useEffect(() => {
    if (!roomCode || !isCandidateRegister) return
    const u1 = subscribe(roomCode, 'electionJournalists', (d) => setJournalistsMap(d || {}))
    const u2 = subscribe(roomCode, 'journalistNewspapers', (d) => setJournalistNewspapersMap(d || {}))
    return () => { u1?.(); u2?.() }
  }, [roomCode, isCandidateRegister])

  useEffect(() => {
    setSelected(null)
  }, [stepId])

  const groupEntries = useMemo(
    () => Object.entries(groups || {})
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko')),
    [groups],
  )

  const studentEntries = useMemo(
    () => Object.entries(students || {})
      .map(([id, student]) => ({ id, ...student }))
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)),
    [students],
  )

  const submissions = useMemo(() => buildSubmissions(config, data), [config, data])

  const rows = useMemo(() => {
    if (!config) return []
    if (config.mode === 'group') {
      return groupEntries.map((group) => {
        const mine = submissions.filter((item) => groupIdOf(item) === group.id || item.id === group.id)
        return summarizeSubmitter(group, mine, 'group', groups, students)
      })
    }
    return studentEntries.map((student) => {
      const mine = submissions.filter((item) => studentIdOf(item) === student.id)
      return summarizeSubmitter(student, mine, 'student', groups, students)
    })
  }, [config, groupEntries, studentEntries, submissions, groups, students])

  if (!config) return null

  // 기사 단계: 여정/토론후 등 유형별로 묶어서 이름과 함께 표시
  if (config.articleGroups) {
    // 토론 세션 → 소속 부(府) 추론. 학생이 target을 'general'로 두고 토론도구에서 써도 분류되도록 보강.
    const sessionBranch = (s) => {
      if (!s) return null
      const sid = String(s.sourceStepId || '')
      if (s.type === 'trial' || s.relatedCaseId || sid.startsWith('judicial') || sid.startsWith('verdict')) return 'judicial'
      if (s.relatedExecutiveMeeting || s.type === 'multi_party' || sid.startsWith('executive')) return 'executive'
      if (s.relatedBillId || sid.startsWith('legislative')) return 'legislative'
      return null
    }
    const allArticles = asArray(data.articles)
      .filter((a) => a.status !== 'deleted')
      .map((a) => {
        // target이 비어있거나 일반인데 토론 세션이 붙어 있으면, 세션으로 부를 추론해 보강
        if ((!a.target || a.target === 'general') && a.debateSessionId) {
          const branch = sessionBranch(debateSessionsMap?.[a.debateSessionId])
          if (branch) return { ...a, target: branch, contextType: a.contextType || 'debate' }
        }
        return a
      })
    const totalShown = config.articleGroups.reduce((n, g) => n + allArticles.filter(g.filter).length, 0)
    return (
      <section className="bg-white rounded-2xl shadow-lg border-2 border-sky-100 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-black text-sky-600 uppercase tracking-wide">제출 확인 빠른보기 · 기사 유형별</p>
            <h2 className="text-base font-black text-slate-900">{config.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">번호순으로 제출 여부·제목을 한눈에. 칸을 누르면 본문이 새 창으로 열립니다. (🟢 게시 · 🟡 대기 · ⚪ 미제출)</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-sky-700 tabular-nums">{totalShown}</div>
            <div className="text-[11px] font-bold text-slate-400">작성된 기사</div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {config.articleGroups.map((g) => (
            <ArticleGroupBlock
              key={g.key}
              group={g}
              students={students}
              articles={allArticles.filter(g.filter).sort((a, b) => (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0))}
            />
          ))}
        </div>
      </section>
    )
  }

  const doneCount = isCandidateRegister
    ? rows.filter((row) => {
      const candidateData = data.candidates?.[row.id]
      const journalistData = journalistsMap?.[row.id]
      const newspaperData = journalistNewspapersMap?.[row.id]
      return candidateData?.status === 'submitted' || (journalistData && newspaperData?.status === 'submitted')
    }).length
    : stepId === 'reflect'
      ? rows.filter((row) => {
        const reflection = data.reflections?.[row.id]
        return reflection && (reflection.status === 'pending' || reflection.status === 'approved')
      }).length
      : rows.filter((row) => row.submitted).length
  const totalCount = rows.length
  const modeLabel = config.mode === 'group' ? '모둠 제출' : '개인 제출'

  return (
    <section className="bg-white rounded-2xl shadow-lg border-2 border-sky-100 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-black text-sky-600 uppercase tracking-wide">제출 확인 빠른보기</p>
          <h2 className="text-base font-black text-slate-900">{config.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{modeLabel} · 제출자 이름을 누르면 제출 내용을 확인할 수 있습니다.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-sky-700 tabular-nums">{doneCount}/{totalCount}</div>
          <div className="text-[11px] font-bold text-slate-400">제출 완료</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {rows.map((row) => {
          const candidateData  = isCandidateRegister ? (data.candidates?.[row.id] || null) : null
          const journalistData = isCandidateRegister ? (journalistsMap?.[row.id] || null) : null
          const newspaperData  = isCandidateRegister ? (journalistNewspapersMap?.[row.id] || null) : null
          const reflectionData = stepId === 'reflect' ? (data.reflections?.[row.id] || null) : null

          const cardTitle = journalistData
            ? `${row.name} 기자단-${newspaperData?.title?.trim() || '신문 이름 미정'}`
            : row.name

          const candidateStarted = !!(candidateData?.candidateSavedAt || candidateData?.leaderStudentId || journalistData || newspaperData)
          const candidateSubmitted = candidateData?.status === 'submitted'
          const journalistSubmitted = !!(journalistData && newspaperData?.status === 'submitted')

          const displayBg = isCandidateRegister
            ? ((candidateSubmitted || journalistSubmitted) ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
               : candidateStarted  ? 'bg-amber-50 border-amber-200 text-amber-900'
               : 'bg-slate-50 border-slate-200 text-slate-500')
            : stepId === 'reflect'
              ? (reflectionData
                  ? ((reflectionData.status === 'approved' || reflectionData.status === 'pending')
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : reflectionData.status === 'rejected'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900')
                  : 'bg-slate-50 border-slate-200 text-slate-500')
              : (row.submitted ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-500')

          const getReflectionBadgeLabel = () => {
            if (!reflectionData) return '미시작'
            if (reflectionData.status === 'approved') return '승인완료'
            if (reflectionData.status === 'pending') return '승인대기'
            if (reflectionData.status === 'rejected') return '반려됨'
            if (reflectionData.status === 'writing') return '작성중'
            return '미시작'
          }

          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                if (isCandidateRegister) {
                  setSelectedCandidateGroup({
                    groupId: row.id,
                    groupName: row.name,
                    candidateData: data.candidates?.[row.id] || null,
                    journalistData: journalistsMap?.[row.id] || null,
                    newspaperData: journalistNewspapersMap?.[row.id] || null,
                  })
                } else {
                  // 정리글 퀵패널 클릭 시, 내용이 작성되어 있으면 DetailModal로 띄워 줌
                  if (stepId === 'reflect') {
                    if (reflectionData) {
                      // submission 형식으로 매칭하여 SubmissionDetailModal이 읽을 수 있게 전달
                      setSelected({
                        ...row,
                        submissions: [{
                          ...reflectionData,
                          id: reflectionData.id || row.id,
                          type: 'reflection',
                          title: '정리글'
                        }]
                      })
                    } else {
                      alert(`${row.name} 학생은 아직 작성 전입니다.`)
                    }
                  } else {
                    setSelected(row)
                  }
                }
              }}
              className={`text-left rounded-xl border px-3 py-2 transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer ${displayBg}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-sm truncate">{cardTitle}</span>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-black ${
                  isCandidateRegister
                    ? ((candidateSubmitted || journalistSubmitted) ? 'bg-emerald-600 text-white'
                       : candidateStarted  ? 'bg-amber-505 text-white'
                       : 'bg-slate-200 text-slate-500')
                    : stepId === 'reflect'
                      ? (reflectionData
                          ? ((reflectionData.status === 'approved' || reflectionData.status === 'pending')
                              ? 'bg-emerald-600 text-white'
                              : reflectionData.status === 'rejected'
                                ? 'bg-red-500 text-white'
                                : 'bg-amber-500 text-white')
                          : 'bg-slate-200 text-slate-500')
                      : (row.submitted ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500')
                }`}>
                  {isCandidateRegister
                    ? (candidateSubmitted ? '후보제출' : journalistSubmitted ? '신문제출' : candidateStarted ? '작성중' : '미시작')
                    : stepId === 'reflect'
                      ? getReflectionBadgeLabel()
                      : (row.submitted ? `${row.count}건` : '미제출')}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                <span className="truncate">{row.meta}</span>
                {!isCandidateRegister && stepId !== 'reflect' && (
                  <span className="tabular-nums">{row.submitted ? fmtTime(row.latestAt) : '아직 없음'}</span>
                )}
                {stepId === 'reflect' && reflectionData && (
                  <span className="tabular-nums">{fmtTime(timeOf(reflectionData))}</span>
                )}
              </div>

              {/* 후보 등록 체크리스트 */}
              {isCandidateRegister && (
                <CandidateChecklist candidateData={candidateData} journalistData={journalistData} newspaperData={newspaperData} />
              )}

              {/* 정리글 단계별 작성 체크리스트 */}
              {stepId === 'reflect' && (
                <ReflectionChecklist 
                  reflectionData={reflectionData} 
                  student={students?.[row.id]} 
                  onStepClick={(student, step, r) => setActiveStepDetail({ student, step, r })} 
                />
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <SubmissionDetailModal
          isOpen={true}
          onClose={() => setSelected(null)}
          title={`${selected.name} 제출 내용`}
          items={selected.submissions}
          renderItem={(item) => <SubmissionDetail item={item} groups={groups} students={students} />}
        />
      )}

      {selectedCandidateGroup && (
        <CandidateDetailModal
          groupName={selectedCandidateGroup.groupName}
          candidateData={selectedCandidateGroup.candidateData}
          journalistData={selectedCandidateGroup.journalistData}
          newspaperData={selectedCandidateGroup.newspaperData}
          onClose={() => setSelectedCandidateGroup(null)}
        />
      )}

      {/* 단계별 개별 세부내용 조회 모달 */}
      {activeStepDetail && (
        <StepDetailModal
          student={activeStepDetail.student}
          step={activeStepDetail.step}
          r={activeStepDetail.r}
          onClose={() => setActiveStepDetail(null)}
        />
      )}
    </section>
  )
}

function SubmissionDetail({ item, groups, students }) {
  const group = groups?.[groupIdOf(item)]
  const student = students?.[studentIdOf(item)]
  const author = student ? `${student.number || ''}번 ${student.nickname || ''}`.trim() : item.authorNickname || item.ministerName || ''

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-slate-400 uppercase">{item.type}</p>
          <h3 className="font-black text-slate-900">{item.title || item.headline || item.policyFields?.title || '제출물'}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{group?.name || item.groupName || ''} {author && `· ${author}`} · {fmtTime(timeOf(item))}</p>
        </div>
      </div>

      {item.type === 'poster' && (
        <div className="space-y-2">
          {item.imageUrl && <img src={resolveImageUrl(item.imageUrl)} alt="포스터" className="w-full max-h-[52vh] object-contain rounded-xl border bg-slate-50" />}
          {item.canvaUrl && <a href={item.canvaUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">Canva 포스터 열기</a>}
          {item.caption && <p className="whitespace-pre-wrap">{item.caption}</p>}
        </div>
      )}

      {item.type === 'essay' && <TextBlock title="주장하는 글" text={[item.claim, item.reason, item.evidence, item.body, item.final].filter(Boolean).join('\n\n') || JSON.stringify(item, null, 2)} />}
      {item.type === 'link' && <TextBlock title={item.title || '자료 링크'} text={`${item.url || ''}\n${item.memo || item.description || ''}`} />}
      {item.type === 'article' && <TextBlock title={item.headline || '기사'} text={item.body || ''} />}
      {item.type === 'candidate' && <TextBlock title={`${item.leaderNickname || '후보'} 후보 등록`} text={[`공약: ${(item.pledges || []).join(' / ')}`, item.pamphlet, item.posterCanvaUrl && `선거 포스터: ${item.posterCanvaUrl}`, item.canvaUrl && `공약 카드뉴스: ${item.canvaUrl}`, item.videoCanvaUrl && `홍보영상: ${item.videoCanvaUrl}`].filter(Boolean).join('\n\n')} />}
      {item.type === 'bill' && <TextBlock title={item.title || '법률안'} text={item.body || ''} />}
      {item.type === 'policy' && (
        <div className="space-y-2">
          <TextBlock title="정책 내용" text={Object.entries(item.policyFields || {}).map(([k, v]) => `${k}: ${v}`).join('\n') || '정책 필드 없음'} />
          <TextBlock title={`예산안 총 ${formatBudgetAmount(item.requestedBudget || item.draftBudget || 0)}억`} text={(item.budgetItems || []).map((b, idx) => `${idx + 1}. ${b.title || '항목'} / ${b.note || ''} / ${formatBudgetAmount(b.amount)}억`).join('\n') || '예산 항목 없음'} />
        </div>
      )}
      {item.type === 'research' && (
        <div className="space-y-2">
          <TextBlock title="자료 수집 목록" text={(item.targets || []).map((t, idx) => `${idx + 1}. ${t.title || t.label || t.name}`).join('\n') || '목록 없음'} />
          <TextBlock title="수집 자료" text={(item.items || []).map((r, idx) => {
            const memo = r.idea || r.memo || r.note || r.summary || ''
            return `${idx + 1}. ${r.title || '자료'}\n${r.url || ''}${memo ? `\n떠오른 아이디어: ${memo}` : ''}`
          }).join('\n\n') || '자료 없음'} />
        </div>
      )}
      {item.type === 'reflection' && (
        <div className="space-y-2.5">
          {item.title && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] font-black text-slate-400 mb-0.5">글 제목</p>
              <p className="font-extrabold text-slate-900 text-sm">"{item.title}"</p>
            </div>
          )}
          <TextBlock title="도입 개요" text={item.outline?.intro || item.participation || ''} />
          <TextBlock title="전개 개요" text={item.outline?.body || item.mostImpressive || ''} />
          <TextBlock title="마무리 개요" text={item.outline?.conclusion || item.pledge || ''} />
          {item.p1?.main && (
            <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-1">
              <p className="text-[10px] font-bold text-gray-500">📘 도입 단락</p>
              <p className="text-xs font-bold">중심: {item.p1.main}<TagBadge tag={item.p1.mainTag}/></p>
              {item.p1.supportA && <p className="text-xs text-gray-650 pl-2">↳ 뒷받침 ①: {item.p1.supportA}<TagBadge tag={item.p1.supportATag}/></p>}
              {item.p1.supportB && <p className="text-xs text-gray-650 pl-2">↳ 뒷받침 ②: {item.p1.supportB}<TagBadge tag={item.p1.supportBTag}/></p>}
            </div>
          )}
          {item.p2?.main && (
            <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-1">
              <p className="text-[10px] font-bold text-gray-500">📗 전개 단락</p>
              <p className="text-xs font-bold">중심: {item.p2.main}<TagBadge tag={item.p2.mainTag}/></p>
              {item.p2.supportA && <p className="text-xs text-gray-650 pl-2">↳ 뒷받침 ①: {item.p2.supportA}<TagBadge tag={item.p2.supportATag}/></p>}
              {item.p2.supportB && <p className="text-xs text-gray-650 pl-2">↳ 뒷받침 ②: {item.p2.supportB}<TagBadge tag={item.p2.supportBTag}/></p>}
            </div>
          )}
          {item.p3?.main && (
            <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-1">
              <p className="text-[10px] font-bold text-gray-500">📕 마무리 단락</p>
              <p className="text-xs font-bold">중심: {item.p3.main}<TagBadge tag={item.p3.mainTag}/></p>
              {item.p3.supportA && <p className="text-xs text-gray-650 pl-2">↳ 뒷받침 ①: {item.p3.supportA}<TagBadge tag={item.p3.supportATag}/></p>}
              {item.p3.supportB && <p className="text-xs text-gray-650 pl-2">↳ 뒷받침 ②: {item.p3.supportB}<TagBadge tag={item.p3.supportBTag}/></p>}
            </div>
          )}
          <TextBlock title="최종 본문 에세이" text={item.finalEssay || ''} />
        </div>
      )}
    </div>
  )
}

function TextBlock({ title, text }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] font-black text-slate-400 mb-1">{title}</p>
      <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-slate-700">{text || '내용 없음'}</p>
    </div>
  )
}

function NewspaperLayoutBlock({ layoutItems = [], totalPages = 1 }) {
  const normalizedTotalPages = Number(totalPages) === 2 ? 2 : 1
  const groups = getNewspaperLayoutGroups(layoutItems)
  const hasPage = (page) => NEWSPAPER_LAYOUT_TYPES.some((slot) => slot.key !== 'unused' && groups[page]?.[slot.key]?.length)
  const hasUnused = groups.unused.length > 0
  if (!hasPage(1) && !hasPage(2) && !hasUnused) return null

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] font-black text-slate-400 mb-2">신문편집 배치안</p>
      <div className="space-y-2">
        {[1, 2].map((page) => (page <= normalizedTotalPages || hasPage(page)) && (
          <div key={page} className="rounded-xl border border-slate-200 bg-white p-2">
            <p className="mb-1 border-b border-slate-200 pb-1 text-[11px] font-black text-slate-900">{page}면</p>
            {hasPage(page) ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused' && groups[page]?.[slot.key]?.length).map((slot) => (
                <div key={`${page}-${slot.key}`} className={`rounded-lg border bg-slate-50 p-2 ${slot.key === 'lead' ? 'border-slate-800 sm:col-span-2' : 'border-slate-200'}`}>
                  <p className="text-[11px] font-black text-slate-800">{slot.label}</p>
                  <ul className="mt-1 space-y-1">
                    {groups[page][slot.key].map((item) => (
                      <li key={item.articleId} className="text-xs leading-relaxed text-slate-600">- {item.headline || '제목 없는 기사'}</li>
                    ))}
                  </ul>
                </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-center text-xs font-bold text-slate-400">아직 이 면에 배치된 기사가 없습니다.</p>
            )}
          </div>
        ))}
        {hasUnused && (
          <div className="rounded-lg border border-slate-200 bg-white p-2 opacity-70">
            <p className="text-[11px] font-black text-slate-800">이번 신문에는 제외</p>
            <ul className="mt-1 space-y-1">
              {groups.unused.map((item) => (
                <li key={item.articleId} className="text-xs leading-relaxed text-slate-600">- {item.headline || '제목 없는 기사'}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
