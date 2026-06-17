import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt } from '../../lib/rtdb-helpers'
import ExternalFeedBar from './ExternalFeedBar'
import { DEFAULT_ROLES, normalizeRoleList, normalizeTodo, decorateRoleForContext } from '../../lib/scaffolding-data'
import RoleSelfSelector from '../scaffolding/RoleSelfSelector'
import GroupRoleSummary from '../scaffolding/GroupRoleSummary'
import OtherGroupsRoleSummary from '../scaffolding/OtherGroupsRoleSummary'
import { formatBudgetAmount, roundBudgetAmount } from './executiveBudgetData'

/**
 * BranchUnitWorkspace — 모둠원 기여 워크플로 통합 컴포넌트
 *
 * 레이아웃 (lg 이상):
 *   [좌] 메모카드(1단계) — 역할 할 일 목록 + 메모 작성
 *   [우] 역할 배정 + 우리 모둠 현황 + 다른 모둠 접기/펼치기
 *   [전체 폭] 섹션 초안(2단계) + 총괄 검토원 최종 편집(3단계)
 *
 * 역할 중심 + 섹션 배정 시:
 *   - 2단계: 담당 섹션은 직접 작성, 나머지는 읽기 전용 + 상태 배지
 *   - 3단계: 총괄 검토원이 4개 섹션 미리보기 불러와서 편집 후 제출
 */

export default function BranchUnitWorkspace({
  unitId,
  branch,
  onPublish,
  isCollaborative = false,
  renderCustomSectionEditor,
  renderCustomSectionViewer,
  renderCustomFinalEditor,
  renderCustomFinalViewer,
  renderCustomBudgetManager,
  children,
  // 행정부 역할중심 전용 분할: 'roles' = 역할 보드만 / 'draft' = 초안 편집만(역할 보드 숨김) / undefined = 전체
  executivePhase,
  // executivePhase==='roles' 일 때 역할 보드 아래에 끼워 넣을 준비 패널(브레인스토밍·할 일·시행령 찾기)
  prepSlot = null,
}) {
  const STEP_LABELS = ['📝 메모 작성', '✏️ 섹션 초안', '✅ 대표 확정']
  const COLLAB_STEP_LABELS = ['🤝 공동 작업 중', '✅ 작성 완료']

  const SECTION_META = {
    // 입법부 섹션
    background:  { label: '제1조 목적·제2조 정의·대상', placeholder: '제1조(목적): 이 법이 왜 필요한지 — 해결하려는 문제를 씁니다.\n제2조(정의·대상): 법에서 쓰는 중요한 단어와 적용 대상을 씁니다.' },
    clause:      { label: '제3조 의무·금지',            placeholder: '제3조(의무): 누가 무엇을 해야 하는지 "...하여야 한다." 형태로 씁니다.\n제3조(금지): 하면 안 되는 행동을 "...해서는 아니 된다." 형태로 씁니다.' },
    effect:      { label: '제4조 벌칙·기대 효과',        placeholder: '제4조(벌칙): 위반 시 처벌 수준을 씁니다.\n기대 효과: 이 법으로 무엇이 좋아지는지 구체적으로 씁니다.' },
    rebuttal:    { label: '제안 이유(배경·입법 취지)·반론 대응', placeholder: '제안 이유(배경): 어떤 문제 상황인지, 누가 어려움을 겪는지, 원인은 무엇인지.\n입법 취지: 이 법으로 누구에게 무엇을 해 주려는지.\n반론 대응: 예상 반론과 그럼에도 이 법이 필요한 이유.' },
    // 행정부 섹션
    skeleton:    { label: '제1조 목적·제2조 대상', placeholder: '제1조 목적과 제2조 대상·범위, 배경 근거를 정리하세요.' },
    decree:      { label: '제3조 시행 절차',        placeholder: '담당 기관, 일정, 신청·선정·집행 순서를 정리하세요.' },
    evidence:    { label: '제4조 지원 내용·재원',   placeholder: '지원 방식, 지원 규모, 재원 사용 방식과 산출 근거를 정리하세요.' },
    discussion:  { label: '토의 반영',            placeholder: '온라인 정책토의 의견 중 반영할 점과 대안을 정리하세요.' },
    risks:       { label: '부작용 관리·홍보 전략', placeholder: '예상 부작용, 민원 대응, 시민 설득 전략을 정리하세요.' },
    budget:      { label: '예산 검토',            placeholder: '각 역할이 작성한 예산 항목의 중복과 산출 근거를 검토하세요.' },
    // 사법부 섹션
    judgePrep:           { label: '판사 — 쟁점 정리',        placeholder: '재판의 핵심 쟁점 3가지를 정리하고, 각 쟁점별 판단 기준과 관련 법조항을 작성하세요.' },
    prosecutionBrief:    { label: '수석 검사 — 논고 카드',    placeholder: '공소 사실, 법률 위반 근거, 구형 이유를 논리적으로 정리하세요. 증거와 증인 진술을 연결해 주장을 뒷받침하세요.' },
    prosecutionEvidence: { label: '증거 검사 — 증거 전략',    placeholder: '제출할 증거 목록과 각 증거가 유죄를 입증하는 이유, 변호측 반박 대응을 정리하세요.' },
    questioningScript:   { label: '심문 검사 — 심문 질문',    placeholder: '증인과 피고인에게 할 심문 질문 목록을 작성하세요. 핵심 모순을 드러내는 질문을 준비하세요.' },
    prosecutionNotes:    { label: '검사 보조 — 조사 노트',    placeholder: '관련 법 조항, 유사 판례, 검사팀 발언 순서표를 정리하세요.' },
    defenseBrief:        { label: '수석 변호인 — 변론 카드',  placeholder: '무죄 또는 감형 근거, 반박 논거, 변호 전략을 정리하세요. 검사 측 증거의 허점을 지적하세요.' },
    defenseEvidence:     { label: '증거 변호인 — 증거 반박',  placeholder: '검사측 증거의 약점을 지적하고, 변호측에 유리한 증거 제출 계획을 작성하세요.' },
    defenseNotes:        { label: '변호 보조 — 조사 노트',    placeholder: '정상참작 자료, 감형 판례, 변호팀 발언 순서표를 정리하세요.' },
    juryStudy:           { label: '배심원 — 쟁점 메모',       placeholder: '양측 주장을 들으며 핵심 쟁점별로 판단 기준을 정리하세요. 평의 시 제시할 근거를 미리 메모하세요.' },
    pressFormal:         { label: '기자 — 취재·보도',         placeholder: '재판 핵심 내용을 사실 중심으로 기록하고 기사 초안 또는 사설을 준비하세요.' },
    witnessStatements:   { label: '증인 — 진술 준비',         placeholder: '증인으로서 할 진술 내용을 정리하고, 예상 반박 질문에 대한 답변을 준비하세요.' },
    defendantStatements: { label: '피고인 — 진술 준비',       placeholder: '피고인으로서 할 진술을 정리하고, 검사 심문에 대비한 답변을 준비하세요.' },
    courtRecord:         { label: '변론 기록·평가',           placeholder: '변론 공방의 핵심을 사실 중심으로 기록하고 평가하세요.' },
  }

  function isValidUrl(str) {
    try { return Boolean(new URL(str)) } catch { return false }
  }
  const getText = (value) =>
    typeof value === 'string' ? value : value?.label || value?.id || ''

  const normalizeBudgetItems = (policy) => {
    if (Array.isArray(policy?.budgetItems)) {
      return policy.budgetItems.map((item) => ({
        ...item,
        amount: roundBudgetAmount(item.amount),
      }))
    }
    const legacyBudget = policy?.budget
    if (legacyBudget && typeof legacyBudget === 'object') {
      return Object.entries(legacyBudget)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([key, amount]) => ({
          title: key,
          amount: roundBudgetAmount(amount),
        }))
    }
    const singleBudget = Number(policy?.requestedBudget ?? policy?.draftBudget ?? policy?.finalBudget ?? 0)
    if (singleBudget) {
      return [{ title: '기본 집행 예산', amount: roundBudgetAmount(singleBudget) }]
    }
    return []
  }

  const budgetItemTotal = (items = []) => {
    return roundBudgetAmount(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
  }

  const buildBudgetFormula = (calc = {}, fallback = '') => {
    if (fallback) return fallback
    const count = Number(calc.targetCount) > 0 ? Number(calc.targetCount) : 0
    const unitLabel = calc.unitLabel || '명'
    const unitCost = Number(calc.unitCost) || 0
    const times = Number(calc.times) || 1
    if (!count || !unitCost) return ''
    return `${count.toLocaleString()}${unitLabel} x ${unitCost.toLocaleString()}원 x ${times}회`
  }

  function contentReadinessScore(data) {
    if (typeof data === 'string') return data.trim().length
    if (!data || typeof data !== 'object') return 0
    const pieces = []
    if (typeof data.text === 'string') pieces.push(data.text)
    for (const value of Object.values(data.policyFields || {})) {
      if (typeof value === 'string') pieces.push(value)
    }
    for (const value of Object.values(data.decreeFields || {})) {
      if (typeof value === 'string') pieces.push(value)
    }
    if (Array.isArray(data.budgetItems)) {
      data.budgetItems.forEach((item) => {
        pieces.push(item?.title || '')
        pieces.push(item?.note || '')
        if (Number(item?.amount) > 0) pieces.push(String(item.amount))
      })
    }
    return pieces.join(' ').trim().length
  }

  const createEmptyExecutivePolicyFields = () => ({
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
  })

  const cleanDraftText = (value) => {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number') return String(value)
    return ''
  }

  const setDraftField = (target, key, value, { append = false } = {}) => {
    const text = cleanDraftText(value)
    if (!text) return
    if (append && target[key]) {
      target[key] = `${target[key]}\n${text}`
      return
    }
    if (!target[key]) target[key] = text
  }

  const hasDraftContent = (value) => {
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    if (value && typeof value === 'object') {
      return Object.values(value).some((item) => hasDraftContent(item))
    }
    return Boolean(value)
  }

  const mapExecutiveSectionToPolicyFields = (sectionKey, section) => {
    const directFields = section?.content?.policyFields || {}
    const qna = directFields.qna || {}
    const q = (idx) => cleanDraftText(qna?.[idx])
    const mapped = {}
    const knownKeys = Object.keys(createEmptyExecutivePolicyFields())

    knownKeys.forEach((key) => {
      if (hasDraftContent(directFields[key])) {
        mapped[key] = directFields[key]
      }
    })

    if (sectionKey === 'skeleton') {
      setDraftField(mapped, 'title', q(0))
      setDraftField(mapped, 'problem', q(1))
      setDraftField(mapped, 'purpose', q(1))
      setDraftField(mapped, 'targetCitizens', q(2))
    } else if (sectionKey === 'decree') {
      // 제3조 시행절차: 담당 기관(q0) + 집행 순서(q1)를 모두 content에 담는다.
      setDraftField(mapped, 'content', [q(0), q(1)].filter(Boolean).join('\n'))
    } else if (sectionKey === 'evidence') {
      setDraftField(mapped, 'evidence', q(0))
      setDraftField(mapped, 'publicConcern', q(1), { append: true })
      setDraftField(mapped, 'publicResponse', q(2), { append: true })
    } else if (sectionKey === 'effect') {
      setDraftField(mapped, 'expectedEffect', q(0), { append: true })
      setDraftField(mapped, 'discussionReflection', q(1), { append: true })
    } else if (sectionKey === 'discussion') {
      setDraftField(mapped, 'discussionReflection', q(0), { append: true })
      setDraftField(mapped, 'publicResponse', q(1), { append: true })
    } else if (sectionKey === 'risks') {
      setDraftField(mapped, 'publicConcern', q(0), { append: true })
      setDraftField(mapped, 'publicResponse', q(1), { append: true })
      setDraftField(mapped, 'finalMessage', q(2), { append: true })
    } else if (sectionKey === 'budget') {
      setDraftField(mapped, 'support', q(0), { append: true })
      setDraftField(mapped, 'finalScale', q(1), { append: true })
      setDraftField(mapped, 'discussionReflection', q(2), { append: true })
    } else if (sectionKey === 'cabinet_moderator') {
      setDraftField(mapped, 'title', q(0))
      setDraftField(mapped, 'purpose', q(0))
      setDraftField(mapped, 'problem', q(1))
      setDraftField(mapped, 'content', q(2))
    } else if (sectionKey === 'president_support') {
      setDraftField(mapped, 'content', q(0))
      setDraftField(mapped, 'ordinance', q(1))
      setDraftField(mapped, 'support', q(2))
    } else if (sectionKey === 'discussion_summary') {
      setDraftField(mapped, 'publicConcern', q(0))
      setDraftField(mapped, 'publicResponse', q(1))
      setDraftField(mapped, 'finalMessage', q(2))
    } else if (sectionKey === 'economic_feasibility') {
      setDraftField(mapped, 'evidence', q(0))
      setDraftField(mapped, 'expectedEffect', q(1))
      setDraftField(mapped, 'finalScale', q(2))
    }

    const fallbackText = cleanDraftText(directFields.text || section?.content?.text)
    if (fallbackText && !Object.values(mapped).some((value) => cleanDraftText(value) === fallbackText)) {
      if (sectionKey === 'decree') setDraftField(mapped, 'content', fallbackText)
      else if (sectionKey === 'effect') setDraftField(mapped, 'expectedEffect', fallbackText)
      else setDraftField(mapped, 'discussionReflection', fallbackText, { append: true })
    }

    return mapped
  }

  const buildExecutiveSectionMergedDoc = (sourceSections = {}, rolesForSections = []) => {
    const policyFields = createEmptyExecutivePolicyFields()
    const budgetItems = []
    const budgetIdSet = new Set()
    const contributionSummary = []
    let latestUpdatedAt = 0

    rolesForSections.forEach((roleDef) => {
      const sectionKey = roleDef.assignedSection
      if (!sectionKey) return
      const section = sourceSections?.[sectionKey]
      const mappedFields = mapExecutiveSectionToPolicyFields(sectionKey, section)
      const sectionBudgets = Array.isArray(section?.content?.budgetItems) ? section.content.budgetItems : []
      const meta = {
        ...(SECTION_META[sectionKey] || { label: sectionKey }),
        label: roleDef.sectionLabel || SECTION_META[sectionKey]?.label || sectionKey,
      }
      const hasContent = Object.values(mappedFields).some((value) => hasDraftContent(value)) || sectionBudgets.length > 0

      Object.entries(mappedFields).forEach(([key, value]) => {
        setDraftField(policyFields, key, value, {
          append: ['publicConcern', 'publicResponse', 'expectedEffect', 'discussionReflection', 'support', 'finalMessage'].includes(key),
        })
      })

      sectionBudgets.forEach((item, idx) => {
        if (!item) return
        const itemId = item.id || `${sectionKey}-${idx}`
        if (budgetIdSet.has(itemId)) return
        budgetIdSet.add(itemId)
        budgetItems.push({
          ...item,
          id: itemId,
          sourceSectionKey: item.sourceSectionKey || sectionKey,
          sourceSectionLabel: item.sourceSectionLabel || meta.label,
          sourceRoleLabel: item.sourceRoleLabel || getText(roleDef.label),
        })
      })

      if (Number(section?.updatedAt) > latestUpdatedAt) latestUpdatedAt = Number(section.updatedAt)
      contributionSummary.push({
        sectionKey,
        label: meta.label,
        roleLabel: getText(roleDef.label),
        status: section?.status || 'empty',
        hasContent,
        updatedAt: section?.updatedAt || null,
      })
    })

    return {
      status: 'sectionDraft',
      updatedAt: latestUpdatedAt || Date.now(),
      content: {
        policyFields,
        budgetItems,
        contributionSummary,
      },
    }
  }

  const roomCode    = useGameStore((s) => s.roomCode)
  const role        = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups      = useGameStore((s) => s.groups)
  const students    = useGameStore((s) => s.students)
  const config      = useGameStore((s) => s.config)

  // 이 유닛 정보
  const unitInfo = useMemo(() => {
    const bc = config?.branchConfig
    if (!bc) return null
    if (branch === 'legislative') return bc.legislative?.units?.find((u) => u.unitId === unitId) || null
    if (branch === 'executive') {
      const found = bc.executive?.units?.find((u) => u.unitId === unitId)
      if (found) return found
      if (unitId === 'exe-president' && bc.executive?.presidentGroupId) {
        return {
          unitId: 'exe-president',
          groupId: bc.executive.presidentGroupId,
          ministryName: bc.executive.presidentMinistryName || '대통령실',
          title: bc.executive.presidentMinistryName || '대통령실',
          representativeStudentId: null
        }
      }
      return null
    }
    if (branch === 'judicial') {
      const inProsecution = bc.judicial?.prosecution?.find((u) => u.unitId === unitId)
      if (inProsecution) return { ...inProsecution, _side: 'prosecution' }
      const inDefense = bc.judicial?.defense?.find((u) => u.unitId === unitId)
      if (inDefense) return { ...inDefense, _side: 'defense' }
      const inWitness = bc.judicial?.witness?.find((u) => u.unitId === unitId)
      if (inWitness) return { ...inWitness, _side: 'witness' }
      const inJury = bc.judicial?.jury?.find((u) => u.unitId === unitId)
      if (inJury) return { ...inJury, _side: 'jury' }
      const inJudge = bc.judicial?.judge?.find((u) => u.unitId === unitId)
      if (inJudge) return { ...inJudge, _side: 'judge' }
      const inPress = bc.judicial?.press?.find((u) => u.unitId === unitId)
      if (inPress) return { ...inPress, _side: 'press' }
      return null
    }
    return null
  }, [config, branch, unitId])

  // 내 모둠 ID
  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const isMyUnit        = unitInfo?.groupId === myGroupId || role === 'teacher'
  const isRepresentative = unitInfo?.representativeStudentId === myStudentId || role === 'teacher'

  const unitGroupId = unitInfo?.groupId
  const sessionId  = `${branch}-default`

  // 브랜치·팀별 최종 문서 레이블
  const docLabel =
    branch === 'legislative' ? '법안' :
    branch === 'executive'   ? '정책보고서' :
    branch === 'judicial'    ? (
      unitInfo?._side === 'prosecution' ? '논고서'   :
      unitInfo?._side === 'defense'     ? '변론서'   :
      unitInfo?._side === 'witness'     ? '진술 카드' :
      unitInfo?._side === 'jury'        ? '평의 메모' :
      unitInfo?._side === 'judge'       ? '판결문'   :
      unitInfo?._side === 'press'       ? '취재 기사' :
      '문서'
    ) : '문서'

  const branchRoles = useMemo(() => {
    // unitId가 'exe-president'이거나, presidentGroupId와 일치하거나, 모둠명에 '대통령'이 포함된 경우
    const isPresidentGroup = branch === 'executive' && (
      unitId === 'exe-president' ||
      (unitGroupId && (
        config?.branchConfig?.executive?.presidentGroupId === unitGroupId ||
        groups?.[unitGroupId]?.name?.includes('대통령')
      ))
    )

    const baseSource = isPresidentGroup
      ? DEFAULT_ROLES.executive_president
      : (config?.roles?.[branch] ||
         config?.branchConfig?.[branch]?.roles ||
         DEFAULT_ROLES[branch] || [])

    // 역할 우선순위: config.roles.[branch] → config.branchConfig.[branch].roles → DEFAULT_ROLES[branch]
    // BranchConfigEditor 는 config.branchConfig.[branch].roles 에 저장하므로 두 번째 폴백이 중요
    const baseRoles = normalizeRoleList(
      branch,
      baseSource
    )
    if (branch === 'executive' && unitGroupId) {
      const g = groups?.[unitGroupId]
      const memberCount = g?.members ? Object.keys(g.members).length : 4
      const limit = Math.max(4, memberCount)
      return baseRoles.slice(0, limit)
    }
    // 입법부 역할중심: 저장된 역할 config가 레거시/커스텀이라 섹션 배정이 전혀 없으면
    // 기본 조항형 역할(DEFAULT_ROLES.legislative)로 대체해 "역할별 섹션 초안" 워크플로가
    // 모든 반에서 일관되게 나타나도록 보장한다. (반별 config 차이 방어 — 저장 데이터는 건드리지 않음)
    if (branch === 'legislative' && !isCollaborative) {
      const hasAnySectionRole = baseRoles.some((r) => r.assignedSection)
      if (!hasAnySectionRole) {
        return normalizeRoleList('legislative', DEFAULT_ROLES.legislative)
      }
    }
    // 사법부: 팀 구분(검사팀/변호팀/증인/배심원/판사/기자)에 맞는 역할만 표시
    if (branch === 'judicial') {
      const side = unitInfo?._side
      const workMode = config?.branchConfig?.judicial?.workMode || 'role'
      // v3 공동작업 모드 — 팀별 단일 lead 역할만 노출 (배심원·판사는 제외 분기는 아래 처리)
      // 배심원은 항상 공동작업으로 강제 (workMode=role이어도 공동)
      // 판사는 단독 역할 — workMode 무관 기존 그대로
      const isJuryForcedCollab = side === 'jury'
      const isJudgeSolo = side === 'judge'
      const useCollab = (workMode === 'collaborative' || isJuryForcedCollab) && !isJudgeSolo

      if (side && !isJudgeSolo) {
        const sideRoles = baseRoles.filter((r) => r.side === side)
        if (useCollab) {
          // lead 역할(collaborativeOnly=true)만 노출
          const lead = sideRoles.filter((r) => r.collaborativeOnly)
          if (lead.length > 0) return lead
          // lead 역할이 정의 안 된 팀은 기본(역할중심) 역할로 fallback
          return sideRoles.filter((r) => !r.collaborativeOnly)
        }
        // 역할중심 모드 — collaborativeOnly가 아닌 4역할만
        return sideRoles.filter((r) => !r.collaborativeOnly)
      }
      if (side === 'judge') {
        return baseRoles.filter((r) => r.side === 'judge' && !r.collaborativeOnly)
      }
    }
    return baseRoles
  }, [config, branch, unitGroupId, groups, unitInfo, isCollaborative])

  // 섹션 배정이 있는 역할 목록
  const sectionRoles = useMemo(
    () => branchRoles.filter((r) => r.assignedSection),
    [branchRoles],
  )

  // 내 역할 키 — 역할은 groups/{unitGroupId}/sessionRoles에 저장되므로 unitGroupId 기준으로 읽음
  const myRoleKeyRaw = useMemo(() => {
    if (!myStudentId) return null
    // unitGroupId 우선: RoleSelfSelector가 unitGroupId로 저장함
    const fromUnit = unitGroupId
      ? groups?.[unitGroupId]?.sessionRoles?.[sessionId]?.[myStudentId]
      : null
    if (fromUnit) return fromUnit
    // fallback: 내 소속 모둠(myGroupId)에도 저장된 경우
    return myGroupId ? groups?.[myGroupId]?.sessionRoles?.[sessionId]?.[myStudentId] || null : null
  }, [groups, unitGroupId, myGroupId, myStudentId, sessionId])

  const myRoleKey = useMemo(() => {
    if (!myRoleKeyRaw) return null
    const exists = branchRoles.some((r) => r.key === myRoleKeyRaw)
    return exists ? myRoleKeyRaw : null
  }, [myRoleKeyRaw, branchRoles])

  // 내 역할 메타 (todo, memoGuide, assignedSection 등)
  const myRoleMeta = useMemo(() => {
    if (!myRoleKey) return null
    return branchRoles.find((r) => r.key === myRoleKey) || null
  }, [myRoleKey, branchRoles])

  const mySection = myRoleMeta?.assignedSection || null

  // 총괄 검토원 여부 (isRepresentative 플래그가 있는 역할)
  const myRoleIsRepresentative = myRoleMeta?.isRepresentative === true

  // 최종 편집 권한: isRepresentative 역할이거나 입법부의 billDrafter(총괄 검토원)
  const canEditFinal = myRoleIsRepresentative || (branch === 'legislative' && myRoleKey === 'billDrafter')

  // 내 역할 3 미션 구독 — "내 미션 불러오기" 용
  useEffect(() => {
    if (!roomCode || !unitGroupId || !myRoleKey) {
      setMyRoleNotes({ fields: {}, links: {} })
      return
    }
    const u = subscribe(roomCode, `groups/${unitGroupId}/roleNotes/${sessionId}/${myRoleKey}`,
      (d) => setMyRoleNotes(d || { fields: {}, links: {} }))
    return () => u?.()
  }, [roomCode, unitGroupId, myRoleKey, sessionId])

  // 미션 3개를 섹션 초안 텍스트로 포맷
  const buildMissionsText = () => {
    const fields = myRoleNotes?.fields || {}
    const links = myRoleNotes?.links || {}
    const todos = myRoleMeta?.todos || []
    const lines = []
    for (let i = 0; i < Math.max(3, todos.length); i++) {
      const txt = String(fields[i] || '').trim()
      const url = String(links[i] || '').trim()
      if (!txt && !url) continue
      const label = todos[i]?.label ? `[${todos[i].label}]\n` : ''
      lines.push(`${label}${txt}${url ? `\n🔗 출처: ${url}` : ''}`)
    }
    return lines.join('\n\n')
  }

  const claimedBy = useMemo(() => {
    const sessionRoleMap = groups?.[unitGroupId]?.sessionRoles?.[sessionId] || {}
    const map = {}
    for (const [sid, roleKey] of Object.entries(sessionRoleMap)) {
      if (roleKey && branchRoles.some((r) => r.key === roleKey)) {
        map[roleKey] = sid
      }
    }
    return map
  }, [groups, unitGroupId, sessionId, branchRoles])

  const decoratedBranchRoles = useMemo(() => {
    const group = groups?.[unitGroupId]
    return branchRoles.map((r) => decorateRoleForContext(r, group, config, branch))
  }, [branchRoles, groups, unitGroupId, config, branch])

  // ── RTDB 구독 ────────────────────────────────────────────────────
  const [memberNotes, setMemberNotes] = useState({})
  const [sections,    setSections]    = useState({})
  const [finalDoc,    setFinalDoc]    = useState(null)

  useEffect(() => {
    if (!roomCode || !unitId) return
    const base = `branchDrafts/${unitId}`
    const u1 = subscribe(roomCode, `${base}/memberNotes`, (d) => setMemberNotes(d || {}))
    const u2 = subscribe(roomCode, `${base}/sections`,    (d) => setSections(d || {}))
    const u3 = subscribe(roomCode, `${base}/finalDoc`,    (d) => setFinalDoc(d || null))
    return () => { u1?.(); u2?.(); u3?.() }
  }, [roomCode, unitId])

  // GenericRoleNotes(역할별 3 미션) 구독 — "내 미션 불러오기" 버튼용
  // myRoleKey는 아래(라인 411)에서 useMemo로 선언되므로 여기는 미정의 — 같은 함수 안 호이스팅으로 useEffect 시점에 참조됨
  const [myRoleNotes, setMyRoleNotes] = useState({ fields: {}, links: {} })

  // ── 메모 카드 ────────────────────────────────────────────────────
  const myNote = memberNotes[myStudentId] || { text: '', links: [] }
  const [noteText,      setNoteText]      = useState('')
  const [noteLinkInput, setNoteLinkInput] = useState('')
  const [noteSaving,    setNoteSaving]    = useState(false)
  const noteLoaded = useRef(false)
  const [noteQnas,      setNoteQnas]      = useState({})

  useEffect(() => {
    if (!noteLoaded.current && memberNotes[myStudentId]) {
      setNoteText(memberNotes[myStudentId].text || '')
      if (memberNotes[myStudentId].qna) {
        setNoteQnas(memberNotes[myStudentId].qna)
      }
      noteLoaded.current = true
    }
  }, [memberNotes, myStudentId])

  const handleNoteQnaChange = (qIdx, val) => {
    const updated = { ...noteQnas, [qIdx]: val }
    setNoteQnas(updated)
    
    if (myRoleMeta?.memoGuide) {
      const merged = myRoleMeta.memoGuide.map((q, i) => `${q}\n→ ${updated[i] || ''}`).join('\n\n')
      setNoteText(merged)
    }
  }

  const [myBudgetItems, setMyBudgetItems] = useState([])
  const mySectionBudgetLoaded = useRef(null)

  useEffect(() => {
    if (!mySection) {
      setMyBudgetItems([])
      mySectionBudgetLoaded.current = null
      return
    }
    if (mySectionBudgetLoaded.current === mySection) return
    
    const secData = sections[mySection]?.content
    if (secData?.budgetItems) {
      setMyBudgetItems(secData.budgetItems)
    } else {
      setMyBudgetItems([])
    }
    mySectionBudgetLoaded.current = mySection
  }, [sections, mySection])

  async function saveExecutiveSection() {
    if (!roomCode || !myStudentId || !mySection) return
    setNoteSaving(true)
    
    const now = Date.now()
    const formattedText = myRoleMeta.memoGuide.map((q, i) => `${q}\n→ ${noteQnas[i] || ''}`).join('\n\n')
    
    await setAt(roomCode, `branchDrafts/${unitId}/sections/${mySection}`, {
      content: {
        policyFields: {
          qna: noteQnas,
          text: formattedText,
          links: myNote.links || [],
        },
        budgetItems: myBudgetItems,
      },
      authorRole: myRoleKey || null,
      authorStudentId: myStudentId,
      status: formattedText.trim().length > 15 && (myNote.links || []).length > 0 ? 'ready' : 'draft',
      updatedAt: now,
    })
    
    await setAt(roomCode, `branchDrafts/${unitId}/memberNotes/${myStudentId}`, {
      text: formattedText,
      qna: noteQnas,
      links: myNote.links || [],
      updatedAt: now,
      submittedAt: now,
    })
    
    setNoteSaving(false)
    alert('내 역할 초안과 관련 예산 편성이 완료 및 저장되었습니다.')
  }

  const [busy, setBusy] = useState(false)

  const claimRole = async (roleKey) => {
    if (!roomCode || !unitGroupId || !myStudentId || busy || rolesLocked) return
    setBusy(true)
    try {
      await setAt(
        roomCode,
        `groups/${unitGroupId}/sessionRoles/${sessionId}/${myStudentId}`,
        roleKey,
      )
    } finally {
      setBusy(false)
    }
  }

  const cancelRole = async () => {
    if (!roomCode || !unitGroupId || !myStudentId || busy || rolesLocked) return
    setBusy(true)
    try {
      await setAt(
        roomCode,
        `groups/${unitGroupId}/sessionRoles/${sessionId}/${myStudentId}`,
        null,
      )
    } finally {
      setBusy(false)
    }
  }

  async function submitNote() {
    if (!roomCode || !myStudentId) return
    const now = Date.now()
    setNoteSaving(true)

    await setAt(roomCode, `branchDrafts/${unitId}/memberNotes/${myStudentId}`, {
      text: noteText,
      qna: noteQnas,
      links: myNote.links || [],
      updatedAt: now,
      submittedAt: myNote.submittedAt || now,
    })

    if (mySection) {
      // 메모 → 섹션 초안 자동 흐름: 섹션이 비어 있을 때만 메모 내용을 채운다.
      // (학생이 이미 다듬어 둔 섹션 내용을 메모 재제출이 덮어쓰지 않도록 보호)
      const existingContent = sections[mySection]?.content
      const existingText = typeof existingContent === 'object' ? existingContent?.text : existingContent
      if (!(existingText || '').trim()) {
        await setAt(roomCode, `branchDrafts/${unitId}/sections/${mySection}`, {
          content: noteText,
          authorRole: myRoleKey || null,
          authorStudentId: myStudentId,
          // 자동 채움은 항상 'draft' — 학생이 조항 목적에 맞게 다듬고 저장해야 'ready'가 된다
          status: 'draft',
          updatedAt: now,
        })
      }
    }

    setNoteSaving(false)
  }

  async function addLink() {
    if (!isValidUrl(noteLinkInput)) return
    const links = [...(myNote.links || []), { url: noteLinkInput, addedAt: Date.now() }]
    await setAt(roomCode, `branchDrafts/${unitId}/memberNotes/${myStudentId}`, {
      text: noteText,
      links,
      updatedAt: Date.now(),
      submittedAt: myNote.submittedAt || null,
    })
    setNoteLinkInput('')
  }

  async function removeLink(idx) {
    const links = [...(myNote.links || [])]
    links.splice(idx, 1)
    await setAt(roomCode, `branchDrafts/${unitId}/memberNotes/${myStudentId}`, {
      text: noteText,
      links,
      updatedAt: Date.now(),
      submittedAt: myNote.submittedAt || null,
    })
  }

  const noteSubmitted = Boolean(myNote.submittedAt)
  const noteHasLink  = (myNote.links || []).length > 0
  const noteHasText  = noteText.trim().length > 10
  const noteComplete = noteSubmitted && noteHasLink && noteHasText

  // ── 섹션 직접 편집 (2단계) ────────────────────────────────────────
  const [sectionTexts,  setSectionTexts]  = useState({})
  const [sectionSaving, setSectionSaving] = useState({})
  const sectionLoaded = useRef({})

  // 내 담당 섹션의 기존 내용을 로컬로 초기화 (최초 1회)
  useEffect(() => {
    if (!mySection || sectionLoaded.current[mySection]) return
    if (!sections[mySection]) return
    setSectionTexts((prev) => ({ ...prev, [mySection]: sections[mySection].content || '' }))
    sectionLoaded.current[mySection] = true
  }, [sections, mySection])

  async function saveSection(sectionKey, data) {
    if (!roomCode || !myStudentId) return
    setSectionSaving((prev) => ({ ...prev, [sectionKey]: true }))
    
    let contentVal = data
    let isReady = false
    if (typeof data === 'object' && data !== null) {
      contentVal = data
      isReady = contentReadinessScore(data) > 20
    } else {
      isReady = (data || '').trim().length > 20
    }
    
    await setAt(roomCode, `branchDrafts/${unitId}/sections/${sectionKey}`, {
      content: contentVal,
      authorRole: myRoleKey || null,
      authorStudentId: myStudentId,
      status: isReady ? 'ready' : 'draft',
      updatedAt: Date.now(),
    })
    setSectionSaving((prev) => ({ ...prev, [sectionKey]: false }))
  }

  // ── 총괄 검토원 최종 편집 (3단계) ────────────────────────────────
  const [finalText,    setFinalText]    = useState('')
  const [finalSaving,  setFinalSaving]  = useState(false)
  const [finalEditing, setFinalEditing] = useState(false)  // 수정 모드 토글 (false=미리보기)
  const finalTextLoaded = useRef(false)

  const isLocked   = finalDoc?.status === 'locked'
  const rolesLocked = Boolean(config?.branchRolesLocked?.[branch])
  const currentStep = isLocked ? 2 : noteComplete ? 1 : 0
  const hasSectionRoles = !isCollaborative && sectionRoles.length > 0

  const allSectionsDone = useMemo(() => {
    if (sectionRoles.length === 0) return true
    return sectionRoles.every((r) => sections[r.assignedSection]?.status === 'ready')
  }, [sectionRoles, sections])

  // 기존 저장된 최종본 내용을 로컬로 초기화 (최초 1회)
  useEffect(() => {
    if (finalTextLoaded.current) return
    if (!finalDoc?.content?.mergedBody) return
    setFinalText(finalDoc.content.mergedBody)
    finalTextLoaded.current = true
  }, [finalDoc])

  // 대표(총괄 검토원) 편집 내용은 같은 유닛에만 전파되며, 1초 디바운스로 DB 쓰기량을 줄인다.
  useEffect(() => {
    if (!finalTextLoaded.current) return
    if (isLocked) return
    if (!canEditFinal && role !== 'teacher') return

    // 이전 저장 상태와 동일하다면 쓰기 트래픽 최적화를 위해 건너뜀
    const prevText = finalDoc?.content?.mergedBody || ''
    if (prevText === finalText) return

    const timer = setTimeout(() => {
      saveFinalDraft()
    }, 1000)

    return () => clearTimeout(timer)
  }, [finalText, finalDoc, isLocked, canEditFinal, role])

  // 섹션 미리보기 → 최종 편집 textarea로 불러오기
  // silent=true 면 빈 섹션 경고창 생략 (수정 모드 진입 시 자동 로드용)
  // replace=true 면 기존 내용을 덮어쓰고, 아니면 덧붙인다
  function loadPreviewToEditor(silent = false, replace = false) {
    const emptySecs = sectionRoles.filter((r) => {
      const content = sections[r.assignedSection]?.content
      const text = typeof content === 'object' ? content?.text : content
      return !(text || '').trim()
    })
    if (!silent && emptySecs.length > 0) {
      const labels = emptySecs.map((r) => SECTION_META[r.assignedSection]?.label || r.assignedSection)
      if (!window.confirm(`'${labels.join(', ')}' 섹션이 비어 있습니다.\n그래도 불러오시겠습니까?`)) return
    }
    const parts = sectionRoles.map((roleDef) => {
      const key = roleDef.assignedSection
      const meta = SECTION_META[key] || { label: key }
      const content = sections[key]?.content
      const text = typeof content === 'object' ? content?.text : content
      return `[${meta.label}]\n${(text || '').trim() || '(미작성)'}`
    })
    const formatted = parts.join('\n\n')
    setFinalText((prev) => (replace ? formatted : (prev.trim() ? prev + '\n\n' + formatted : formatted)))
  }

  // 제출(잠금)된 최종본을 다시 수정 가능하게 — status를 draft로 되돌리고 편집 모드 진입
  async function unlockFinalDoc() {
    if (!roomCode) return
    if (!window.confirm(`제출한 최종 ${docLabel}을(를) 다시 수정할까요?\n수정 후 [발의하기]를 다시 눌러야 반영됩니다.`)) return
    await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
      ...(finalDoc || {}),
      status: 'draft',
    })
    // 현재 확정본 내용을 에디터에 채우고 바로 수정 모드로
    const cur = (finalDoc?.content?.mergedBody && String(finalDoc.content.mergedBody).trim())
      ? finalDoc.content.mergedBody
      : (mergedFinalDoc?.content?.mergedBody || finalText)
    setFinalText(cur || '')
    setFinalEditing(true)
  }

  // 최종본 초안 저장
  async function saveFinalDraft(customContent) {
    if (!roomCode) return
    setFinalSaving(true)
    const contentToSave = customContent || {
      mergedBody: finalText,
      ...Object.fromEntries(
        sectionRoles.map((r) => {
          const content = sections[r.assignedSection]?.content
          return [r.assignedSection, typeof content === 'object' ? content?.text || '' : content || '']
        })
      ),
    }
    await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
      ...(finalDoc || {}),
      content: contentToSave,
      updatedAt: Date.now(),
    })
    setFinalSaving(false)
  }

  // 모둠원 목록
  const unitMembers = useMemo(() => {
    const gid = unitInfo?.groupId
    if (!gid) return []
    const g = groups?.[gid]
    if (!g?.members) return []
    return Object.keys(g.members)
      .map((sid) => ({ sid, ...(students?.[sid] || {}) }))
      .sort((a, b) => (a.number || 0) - (b.number || 0))
  }, [unitInfo, groups, students])

  const statusProgressByRole = useMemo(() => {
    const sessionRoleMap = groups?.[unitGroupId]?.sessionRoles?.[sessionId] || {}
    const byRole = {}
    for (const roleDef of branchRoles) {
      const assigneeEntry = Object.entries(sessionRoleMap).find(([, roleKey]) => roleKey === roleDef.key)
      const assigneeStudentId = assigneeEntry?.[0]
      if (!assigneeStudentId) {
        byRole[roleDef.key] = 0
        continue
      }
      const note = memberNotes?.[assigneeStudentId]
      if (roleDef.assignedSection) {
        const sec = sections?.[roleDef.assignedSection]
        if (sec?.status === 'ready') byRole[roleDef.key] = 1
        else if (note?.submittedAt || (note?.text || '').trim()) byRole[roleDef.key] = 0.5
        else byRole[roleDef.key] = 0
      } else {
        if (note?.submittedAt) byRole[roleDef.key] = 1
        else if ((note?.text || '').trim()) byRole[roleDef.key] = 0.5
        else byRole[roleDef.key] = 0
      }
    }
    return byRole
  }, [branchRoles, groups, unitGroupId, sessionId, memberNotes, sections])

  const sectionMergedDraftDoc = useMemo(() => {
    if (branch !== 'executive' || isCollaborative) return null
    return buildExecutiveSectionMergedDoc(sections, sectionRoles)
  }, [branch, isCollaborative, sections, sectionRoles])

  // 대표 수정본(finalDoc)과 모둠원 실시간 초안(sections)을 병합한 실시간 문서 구성
  const mergedFinalDoc = useMemo(() => {
    const emptyPolicyFields = createEmptyExecutivePolicyFields()

    if (finalDoc?.status === 'locked') {
      return finalDoc
    }

    if (branch === 'executive' && !isCollaborative) {
      const mergedPolicyFields = sectionMergedDraftDoc?.content?.policyFields || { ...emptyPolicyFields }
      const mergedBudgetItems = sectionMergedDraftDoc?.content?.budgetItems || []

      const finalContent = finalDoc?.content
      const finalFields = finalContent?.policyFields || {}
      const finalBudgets = finalContent?.budgetItems || []

      const resultFields = { ...mergedPolicyFields }
      Object.keys(emptyPolicyFields).forEach((k) => {
        if (finalFields[k] !== undefined && finalFields[k] !== '') {
          resultFields[k] = finalFields[k]
        }
      })

      // 대표 finalDoc 예산이 '실제 항목이 있을 때만' 우선. 빈 배열([])이 모둠원 섹션 예산을 가리지 않도록 length로 판정.
      const resultBudgets = (Array.isArray(finalBudgets) && finalBudgets.length > 0) ? finalBudgets : mergedBudgetItems

      return {
        ...(finalDoc || {}),
        status: finalDoc?.status || 'draft',
        content: {
          ...(finalDoc?.content || {}),
          policyFields: resultFields,
          budgetItems: resultBudgets,
          contributionSummary: sectionMergedDraftDoc?.content?.contributionSummary || [],
        }
      }
    }

    if (!isCollaborative && sectionRoles.length > 0) {
      const parts = sectionRoles.map((roleDef) => {
        const key = roleDef.assignedSection
        const meta = SECTION_META[key] || { label: key }
        const content = sections[key]?.content
        const text = typeof content === 'object' ? content?.text : content
        return `[${meta.label}]\n${(text || '').trim() || '(미작성)'}`
      })
      const liveMergedBody = parts.join('\n\n')

      const finalContent = finalDoc?.content
      const resultMergedBody = finalContent?.mergedBody !== undefined && finalContent?.mergedBody !== ''
        ? finalContent.mergedBody
        : liveMergedBody

      return {
        ...(finalDoc || {}),
        status: finalDoc?.status || 'draft',
        content: {
          ...(finalDoc?.content || {}),
          mergedBody: resultMergedBody,
        }
      }
    }

    return finalDoc
  }, [finalDoc, sections, branch, isCollaborative, sectionRoles, sectionMergedDraftDoc])

  const renderExecutiveAssemblyDraft = (draftDoc) => {
    const fields = draftDoc?.content?.policyFields || {}
    const budgetItems = draftDoc?.content?.budgetItems || []
    // 매핑이 비더라도 해당 섹션의 원문(질문-답변 text)을 폴백으로 보여줘 빠진 부분이 없게 한다.
    const sectionTextOf = (key) => {
      const c = sections?.[key]?.content
      const pf = (c && typeof c === 'object') ? (c.policyFields || {}) : {}
      return cleanDraftText(pf.text || (c && typeof c === 'object' ? c.text : c) || '')
    }
    const sectionBudget = (keys) => budgetItems.filter((item) => keys.includes(item.sourceSectionKey || 'budget'))
    const renderText = (value, placeholder = '아직 작성되지 않았습니다.') => (
      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
        {cleanDraftText(value) || <span className="text-slate-400 italic">{placeholder}</span>}
      </p>
    )
    const renderBudget = (keys) => {
      const items = sectionBudget(keys)
      if (items.length === 0) {
        return <p className="text-[11px] text-slate-400 italic">이 부분과 연결된 예산 항목은 아직 없습니다.</p>
      }
      return (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="flex items-start justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-2.5 py-1.5 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-emerald-950 truncate">{item.title || '(예산 항목명 없음)'}</p>
                <p className="text-[10px] text-emerald-700 truncate">{item.note || buildBudgetFormula(item.calc) || '산출식 미입력'}</p>
              </div>
              <span className="shrink-0 font-black text-emerald-700">{formatBudgetAmount(item.amount)}억</span>
            </div>
          ))}
        </div>
      )
    }

    const blocks = [
      {
        no: 1,
        title: '제1조 목적·제2조 대상',
        keys: ['skeleton'],
        body: (
          <>
            <div>
              <p className="text-[11px] font-bold text-slate-500">시행령 목적과 배경 근거</p>
              {renderText(fields.problem || fields.purpose || sectionTextOf('skeleton'))}
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">대상 및 범위</p>
              {renderText(fields.targetCitizens)}
            </div>
          </>
        ),
      },
      {
        no: 2,
        title: '제3조 시행 절차',
        keys: ['decree'],
        body: (
          <>
            <div>
              <p className="text-[11px] font-bold text-slate-500">담당 기관·일정·집행 순서</p>
              {renderText(fields.content || sectionTextOf('decree'))}
            </div>
            {fields.ordinance && (
              <div>
                <p className="text-[11px] font-bold text-slate-500">현장 운영 조건</p>
                {renderText(fields.ordinance)}
              </div>
            )}
          </>
        ),
      },
      {
        no: 3,
        title: '제4조 지원 내용·재원',
        keys: ['evidence', 'discussion', 'risks'],
        body: (
          <>
            <div>
              <p className="text-[11px] font-bold text-slate-500">지원 방식과 산출 근거</p>
              {renderText(fields.evidence || fields.support || sectionTextOf('evidence'))}
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">우려와 조정 기준</p>
              {renderText(fields.publicConcern || fields.publicResponse || fields.finalMessage)}
            </div>
          </>
        ),
      },
      {
        no: 4,
        title: '제5조 점검·예외·보완',
        keys: ['effect', 'budget'],
        body: (
          <>
            <div>
              <p className="text-[11px] font-bold text-slate-500">기대효과와 피해 가능성</p>
              {renderText(fields.expectedEffect || sectionTextOf('effect'))}
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">점검 기준·예외·보완책</p>
              {renderText(fields.discussionReflection || fields.finalScale || fields.support)}
            </div>
          </>
        ),
      },
    ]

    return (
      <div className="space-y-3">
        {blocks.map((block) => (
          <div key={block.no} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h4 className="text-sm font-black text-slate-900">
                {block.no}. {block.title}
              </h4>
              <span className="text-[10px] font-bold text-slate-400">역할 초안 조립 중</span>
            </div>
            <div className="space-y-2">{block.body}</div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 space-y-1.5">
              <p className="text-[11px] font-black text-emerald-700">연결된 예산 항목</p>
              {renderBudget(block.keys)}
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between gap-3 text-xs">
          <span className="font-black text-emerald-900">전체 예산 합계</span>
          <span className="text-base font-black text-emerald-700">{formatBudgetAmount(budgetItemTotal(budgetItems))}억</span>
        </div>
      </div>
    )
  }

  // 비소속 학생은 간단한 읽기 전용 메시지
  if (!isMyUnit && role !== 'teacher') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center">
        이 유닛은 다른 모둠의 작업 공간입니다.
      </div>
    )
  }

  const isExecutiveRoleMode = branch === 'executive' && !isCollaborative

  // 대통령 모둠 여부 (branchRoles가 이미 executive_president로 설정된 경우)
  const isPresidentUnit = branch === 'executive' && (
    unitId === 'exe-president' ||
    (unitGroupId && (
      config?.branchConfig?.executive?.presidentGroupId === unitGroupId ||
      groups?.[unitGroupId]?.name?.includes('대통령')
    ))
  )
  // 대통령실 대표 호칭은 '장관'이 아니라 '비서실장'
  const repLabel = isPresidentUnit ? '비서실장' : '장관'

  if (isExecutiveRoleMode) {
    const renderExecutiveRoleBoard = () => (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm text-left">
        {rolesLocked && (
          <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 p-3 text-amber-800 font-bold text-xs">
            <span>🔒</span>
            <p>선생님이 역할을 잠갔습니다. 역할 변경이 불가능합니다.</p>
          </div>
        )}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            {isPresidentUnit ? '👑 국정 역할 배정 및 모둠 현황' : '🎭 역할 선택 및 모둠 현황'}
          </h3>
          <span className="text-[11px] text-gray-400">
            {isPresidentUnit
              ? '위의 역할을 고르고 대통령실 임무를 수행하세요.'
              : '상단에서 내 역할을 고르고, 아래에서 작성과 예산을 진행합니다.'}
          </span>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {decoratedBranchRoles.map((roleDef) => {
            const key = roleDef.key
            const isMine = myRoleKey === key
            const ownerSid = claimedBy[key]
            const ownerStudent = ownerSid ? students?.[ownerSid] : null
            const isTaken = Boolean(ownerSid) && ownerSid !== myStudentId
            const guide = roleDef.memoGuide?.[0] || ''
            const rawProgress = statusProgressByRole?.[key] || 0
            const progressPct = Math.round(rawProgress * 100)

            return (
              <div
                key={key}
                className={`rounded-xl border-2 p-3 transition duration-200 min-h-[150px] ${
                  isMine
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                    : isTaken
                    ? 'border-gray-100 bg-gray-50/80 opacity-80'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-xs'
                }`}
              >
                <div className="h-full flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-2xl shrink-0 select-none leading-none mt-0.5">{roleDef.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-slate-800 leading-snug">
                            {getText(roleDef.label)}
                          </span>
                          {roleDef.isRepresentative && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
                              대표
                            </span>
                          )}
                          {isMine && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">
                              내 역할 ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isMine ? (
                        <button
                          type="button"
                          onClick={cancelRole}
                          disabled={busy || rolesLocked}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-red-200 text-red-500 bg-white hover:bg-red-50 disabled:opacity-40 transition active:scale-95"
                        >
                          취소
                        </button>
                      ) : isTaken ? (
                        <span className="text-[10px] text-slate-400 bg-slate-100/80 px-2 py-1 rounded font-semibold border border-slate-200/50">
                          배정됨
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => claimRole(key)}
                          disabled={busy || rolesLocked || Boolean(myRoleKey)}
                          className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition active:scale-95"
                        >
                          나 맡을게요
                        </button>
                      )}
                    </div>
                  </div>

                  {guide && (
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                      {guide}
                    </p>
                  )}

                  <div className="mt-auto space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">담당자:</span>
                      {ownerStudent ? (
                        <span className={`text-[11px] font-bold ${isMine ? 'text-indigo-600' : 'text-slate-700'}`}>
                          {ownerStudent.number}번 {ownerStudent.nickname} {isMine && '(나)'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">미정</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            progressPct === 100
                              ? 'bg-emerald-500'
                              : progressPct > 0
                              ? 'bg-amber-400'
                              : 'bg-slate-200'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-black shrink-0 ${
                        progressPct === 100
                          ? 'text-emerald-600'
                          : progressPct > 0
                          ? 'text-amber-600'
                          : 'text-slate-400'
                      }`}>
                        {progressPct === 100 ? '✓ 완료' : progressPct > 0 ? `${progressPct}%` : '대기'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )

    // 행정부 역할중심 ① 단계: 역할 보드만(+ 준비 패널). 초안 편집/예산/최종은 ② 단계로 분리.
    if (executivePhase === 'roles') {
      return (
        <div className="space-y-4">
          <ExternalFeedBar unitId={unitId} />
          {isPresidentUnit && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <p className="font-black text-yellow-900 text-sm">대통령실 — 행정부 총괄 조정 업무</p>
                <p className="text-xs text-yellow-800 mt-1">아래에서 역할을 먼저 나눈 뒤, 우리 정부의 공약·국정 준비를 진행합니다.</p>
              </div>
            </div>
          )}
          {renderExecutiveRoleBoard()}
          {prepSlot}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* 외부 피드 */}
        <ExternalFeedBar unitId={unitId} />

        {/* 대통령실 전용 안내 배너 */}
        {isPresidentUnit && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <p className="font-black text-yellow-900 text-sm">대통령실 — 행정부 총괄 조정 업무</p>
              <p className="text-xs text-yellow-800 mt-1">
                대통령실은 일반 부처와 달리 시행령·예산 청구 대신 <b>국정 방향 수립, 국무회의 준비, 공약 이행 지시</b>를 담당합니다.
                아래 역할을 배정하고 각자의 임무를 수행하세요.
              </p>
            </div>
          </div>
        )}

        {/* 단계 표시 (2단계 구조) */}
        <div className="flex items-center gap-1 flex-wrap">
          {['✏️ 역할별 임무 수행', '✅ 대표 최종 확정'].map((label, i) => {
            const stepIndex = isLocked ? 1 : 0
            const isActive = stepIndex === i
            const isDone = stepIndex > i

            return (
              <div key={i} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isDone && '✓ '}{label}
                </div>
                {i < 1 && <span className="text-gray-300 text-xs">→</span>}
              </div>
            )
          })}
        </div>

        {executivePhase !== 'draft' && renderExecutiveRoleBoard()}

        {/* 좌/우 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start text-left">
          {/* 좌측 컬럼 */}
          <div className="space-y-4">
            {/* 1. 역할별 섹션 초안 (질문, 답, 출처) */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  {isPresidentUnit ? '👑 대통령실 임무 수행' : '📝 역할별 섹션 초안'}
                </h3>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  {mySection && sections[mySection]?.status === 'ready' ? '✅ 저장됨' : '⬜ 작성 중'}
                </span>
              </div>
              <div className="p-4 space-y-4">
                {!myRoleKey ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-4 text-center">
                    {isPresidentUnit
                      ? '👑 위 역할 선택에서 대통령실 역할을 먼저 배정해야 임무 수행 폼이 나타납니다.'
                      : '👉 위 역할 선택에서 내 역할을 먼저 배정해야 초안 작성 폼이 나타납니다.'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* 역할 임무 가이드 */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-950 space-y-2">
                      <p className="font-bold">🎯 {myRoleMeta.emoji} {getText(myRoleMeta.label)}의 임무 가이드</p>
                      <div className="space-y-1">
                        {myRoleMeta.todos?.map((todo, i) => {
                          const t = normalizeTodo(todo)
                          return (
                            <div key={i} className="text-[11px] text-slate-700 leading-snug">
                              • <span className="font-semibold">{t.label}</span> {t.hint && <span className="text-gray-400">({t.hint})</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* 질문과 답변들 */}
                    <div className="space-y-3 bg-slate-50 border rounded-xl p-3">
                      <p className="text-[11px] font-bold text-indigo-700">❓ 내 역할 미션 질문에 답하기</p>
                      {myRoleMeta.memoGuide?.map((q, idx) => (
                        <label key={idx} className="block space-y-1 text-left">
                          <span className="text-xs font-bold text-slate-700">{q}</span>
                          <textarea
                            rows={3}
                            className="w-full text-xs border border-gray-200 rounded p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                            placeholder="여기에 답변을 10자 이상 작성하세요..."
                            value={noteQnas[idx] || ''}
                            onChange={(e) => handleNoteQnaChange(idx, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>

                    {/* 참고 자료 출처 링크 */}
                    <div className="space-y-2 bg-slate-50 border rounded-xl p-3 text-left">
                      <p className="text-[11px] font-bold text-indigo-700">🔗 참고 자료 출처 링크 (1개 이상 필수)</p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                          placeholder="예: 기사, 법률 정보, 뉴스 등 URL"
                          value={noteLinkInput}
                          onChange={(e) => setNoteLinkInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addLink()}
                        />
                        <button
                          type="button"
                          onClick={addLink}
                          disabled={!isValidUrl(noteLinkInput)}
                          className="px-3 py-1 text-xs rounded bg-blue-500 text-white disabled:opacity-40"
                        >추가</button>
                      </div>
                      {(myNote.links || []).length === 0 && (
                        <p className="text-[10px] text-red-500">⚠️ 출처 링크를 1개 이상 추가해야 제출 가능합니다.</p>
                      )}
                      {(myNote.links || []).map((l, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs text-blue-600">
                          <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:underline">
                            🔗 {l.url}
                          </a>
                          <button type="button" onClick={() => removeLink(i)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                        </div>
                      ))}
                    </div>

                    {/* 저장 버튼 */}
                    <button
                      type="button"
                      onClick={saveExecutiveSection}
                      disabled={noteSaving || !noteText.trim() || (myNote.links || []).length === 0}
                      className="w-full py-2.5 text-sm font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                    >
                      {noteSaving ? '저장 중…' : '💾 내 역할 초안 및 예산 저장'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 우측 컬럼 */}
          <div className="space-y-4">
            {/* 1. 예산 청구 및 편성 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">💰 예산 청구 및 편성</h3>
                <span className="text-[11px] text-gray-400">초안 저장 시 함께 기록됨</span>
              </div>
              <div className="p-4">
                {!myRoleKey ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-4 text-center">
                    👉 역할을 먼저 배정해야 예산 청구가 활성화됩니다.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">내 시행령 조항을 실행하는 데 필요한 예산을 항목별로 입력하세요. 담당인력비, 지원금, 평가모니터링비처럼 실제 집행비 이름으로 정리합니다.</p>
                    {renderCustomBudgetManager ? (
                      renderCustomBudgetManager(myBudgetItems, setMyBudgetItems, unitGroupId, mySection, myRoleMeta?.budgetSuggestions || [])
                    ) : (
                      <p className="text-xs text-red-500">예산 매니저 설정을 찾을 수 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. 다른 모둠 역할 & 예산 현황 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">👥 다른 모둠 정책안·예산 현황</h3>
                <span className="text-[11px] text-gray-400">제출 여부와 청구액을 한 번에 확인</span>
              </div>
              <div className="p-3">
                <OtherGroupsRoleSummary myGroupId={unitGroupId} sessionId={sessionId} kind={branch} />
              </div>
            </div>
          </div>
        </div>

        {/* 하단 영역: 대표 최종 조립 및 확정 */}
        {isMyUnit && (
          <div className="mt-4 space-y-4">
            {/* 역할별 저장본을 정책보고서 양식으로 자동 조립한 부처 공통 미리보기 */}
            {sectionMergedDraftDoc && (
              <div className="bg-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm text-left animate-fade-in">
                <div className="bg-indigo-950 border-b border-indigo-900 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      🧩 우리 부처 통합 정책·예산안 초안 미리보기
                    </h3>
                    <p className="text-[11px] text-indigo-200 mt-0.5">
                      각 역할이 저장한 답변과 예산이 1~4번 초안 흐름에 맞춰 길게 펼쳐집니다. 최종 정리는 대표 최종 검토에서 합니다.
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950 px-2 py-1 rounded-full border border-emerald-800">
                    같은 부처 실시간 반영
                  </span>
                </div>
                <div className="p-4 space-y-4 bg-indigo-50/35">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(sectionMergedDraftDoc.content?.contributionSummary || []).map((item) => (
                      <div
                        key={item.sectionKey}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          item.hasContent
                            ? 'bg-white border-emerald-200 text-emerald-800'
                            : 'bg-white/70 border-slate-200 text-slate-500'
                        }`}
                      >
                        <p className="font-black truncate">{item.label}</p>
                        <p className="text-[10px] truncate opacity-75">{item.roleLabel}</p>
                        <p className="text-[10px] font-bold mt-1">
                          {item.hasContent ? '저장 내용 반영됨' : '아직 비어 있음'}
                        </p>
                      </div>
                    ))}
                  </div>

                  {renderExecutiveAssemblyDraft(sectionMergedDraftDoc)}
                </div>
              </div>
            )}

            {myRoleIsRepresentative || role === 'teacher' ? (
              !isLocked ? (
                renderCustomFinalEditor ? (
                  renderCustomFinalEditor(
                    sections,
                    mergedFinalDoc,
                    saveFinalDraft,
                    finalSaving,
                    async (publishedContent) => {
                      await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
                        content: publishedContent,
                        status: 'locked',
                        lockedAt: Date.now(),
                        lockedBy: myStudentId,
                      })
                      onPublish?.(publishedContent)
                    },
                    allSectionsDone
                  )
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-500">총괄 검토원 에디터 렌더링에 문제가 발생했습니다.</p>
                  </div>
                )
              ) : (
                renderCustomFinalViewer ? (
                  renderCustomFinalViewer(mergedFinalDoc, { repLabel })
                ) : (
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {mergedFinalDoc?.content?.mergedBody || '(내용 없음)'}
                  </p>
                )
              )
            ) : (
              /* 다른 역할 학생용: 검토 중 또는 최종본 미리보기 (실시간 뷰어) */
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">✅ 대표 최종 검토</h3>
                  {!isLocked && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse font-bold">
                      ✍️ {repLabel} 검토 중 (실시간)
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {!isLocked && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-850 text-xs font-semibold leading-relaxed">
                      <span>👑</span>
                      <p>{repLabel}이 모둠원들의 초안을 취합하여 최종안을 수정하고 있습니다. {repLabel}이 내용을 변경하고 저장하면 아래에 실시간으로 반영됩니다.</p>
                    </div>
                  )}
                  {renderCustomFinalViewer ? (
                    renderCustomFinalViewer(mergedFinalDoc, { repLabel })
                  ) : (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {mergedFinalDoc?.content?.mergedBody || '(내용 없음)'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // 비소속 학생은 간단한 읽기 전용 메시지
  if (!isMyUnit && role !== 'teacher') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center">
        이 유닛은 다른 모둠의 작업 공간입니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 외부 피드 */}
      <ExternalFeedBar unitId={unitId} />

      {/* 단계 표시 */}
      <div className="flex items-center gap-1 flex-wrap">
        {(isCollaborative ? COLLAB_STEP_LABELS : STEP_LABELS).map((label, i) => {
          const stepIndex = isCollaborative ? (isLocked ? 1 : 0) : i
          const isActive = isCollaborative ? (stepIndex === i) : (i === currentStep)
          const isDone = isCollaborative ? (stepIndex > i) : (i < currentStep)

          return (
            <div key={i} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {isDone && '✓ '}{label}
              </div>
              {i < (isCollaborative ? COLLAB_STEP_LABELS : STEP_LABELS).length - 1 && <span className="text-gray-300 text-xs">→</span>}
            </div>
          )
        })}
      </div>

      {/* 안내 문구 (공동 작업용) */}
      {isCollaborative && !isLocked && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-start gap-3">
          <div className="text-xl">🤝</div>
          <div className="text-sm text-violet-900">
            <p className="font-bold">공동 작업 모드 활성화됨</p>
            <p className="opacity-80 leading-relaxed">이 부서는 역할 구분 없이 모든 모둠원이 함께 내용을 채우고 수정합니다. 서로 상의하며 아래 정책 보고서를 완성해 주세요.</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          1단계 영역: [상] 역할 선택 보드 → [하] 메모 카드 / 모둠 현황
          역할 선택을 맨 위에 크게 배치해 "역할 선택 → 메모 작성" 순서를 명확히 한다.
          사법부는 1단계가 JudicialTab의 ③ 논고초안 외부에서 RoleWorkspace로 처리됨 → 여기 숨김
      ══════════════════════════════════════════ */}
      {!isCollaborative && branch !== 'judicial' && (
        <div className="space-y-4">

        {/* ── [A] 역할 선택 보드 (맨 위·전체 폭) ── */}
        {unitGroupId && role === 'student' && (
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm text-left">
            {rolesLocked && (
              <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 p-3 text-amber-800 font-bold text-xs">
                <span>🔒</span>
                <p>선생님이 역할을 잠갔습니다. 역할 변경이 불가능합니다.</p>
              </div>
            )}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between flex-wrap gap-1">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                🎭 역할 선택
                {myRoleKey
                  ? <span className="text-[11px] font-normal text-emerald-600">✓ 선택 완료</span>
                  : <span className="text-[11px] font-normal text-amber-700">내 역할을 먼저 고르세요</span>}
              </h3>
              <span className="text-[11px] text-gray-400">역할을 고르면 아래 메모 카드에 질문이 나타납니다.</span>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {decoratedBranchRoles.map((roleDef) => {
                const key = roleDef.key
                const isMine = myRoleKey === key
                const ownerSid = claimedBy[key]
                const ownerStudent = ownerSid ? students?.[ownerSid] : null
                const isTaken = Boolean(ownerSid) && ownerSid !== myStudentId
                const guide = roleDef.sectionLabel || roleDef.memoGuide?.[0] || ''
                const rawProgress = statusProgressByRole?.[key] || 0
                const progressPct = Math.round(rawProgress * 100)
                return (
                  <div
                    key={key}
                    className={`rounded-xl border-2 p-3 transition duration-200 min-h-[140px] ${
                      isMine
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                        : isTaken
                        ? 'border-gray-100 bg-gray-50/80 opacity-80'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="h-full flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-2xl shrink-0 select-none leading-none mt-0.5">{roleDef.emoji}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-slate-800 leading-snug">{getText(roleDef.label)}</span>
                              {roleDef.isRepresentative && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">대표</span>
                              )}
                              {isMine && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">내 역할 ✓</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isMine ? (
                            <button
                              type="button"
                              onClick={cancelRole}
                              disabled={busy || rolesLocked}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-red-200 text-red-500 bg-white hover:bg-red-50 disabled:opacity-40 transition active:scale-95"
                            >취소</button>
                          ) : isTaken ? (
                            <span className="text-[10px] text-slate-400 bg-slate-100/80 px-2 py-1 rounded font-semibold border border-slate-200/50">배정됨</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => claimRole(key)}
                              disabled={busy || rolesLocked || Boolean(myRoleKey)}
                              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition active:scale-95"
                            >나 맡을게요</button>
                          )}
                        </div>
                      </div>
                      {guide && (
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{guide}</p>
                      )}
                      <div className="mt-auto space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">담당자:</span>
                          {ownerStudent ? (
                            <span className={`text-[11px] font-bold ${isMine ? 'text-indigo-600' : 'text-slate-700'}`}>
                              {ownerStudent.number}번 {ownerStudent.nickname} {isMine && '(나)'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">미정</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-amber-400' : 'bg-slate-200'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-black shrink-0 ${
                            progressPct === 100 ? 'text-emerald-600' : progressPct > 0 ? 'text-amber-600' : 'text-slate-400'
                          }`}>
                            {progressPct === 100 ? '✓ 완료' : progressPct > 0 ? `${progressPct}%` : '대기'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 역할 미선택 안내 ── */}
        {role === 'student' && !myRoleKey && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 text-sm text-amber-900 flex items-center gap-2">
            <span className="text-lg">👆</span>
            <p className="font-semibold">위에서 내 역할을 먼저 선택하세요. 역할을 고르면 아래에 그 역할에 맞는 <b>메모 카드 질문</b>이 나타납니다.</p>
          </div>
        )}

        {/* ── [B] 메모 카드 + 모둠 현황 ── */}
        <div className={`grid gap-4 items-start ${unitGroupId ? 'lg:grid-cols-[3fr_2fr]' : ''}`}>

        {/* ── 좌: 메모 카드 ── */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              📝 {branch === 'legislative' ? '법안' : branch === 'executive' ? '정책' : '변론'} 작성자 메모 카드
            </h3>
            <span className="text-[11px] text-gray-400">참고 링크 1개 이상 필수</span>
          </div>

          <div className="p-4 space-y-3">
            {/* 다른 모둠원 메모 (읽기 전용) */}
            {unitMembers.filter((m) => m.sid !== myStudentId).map((m) => {
              const note = memberNotes[m.sid]
              if (!note && !isRepresentative) return null
              const memberRoleKey = groups?.[unitGroupId]?.sessionRoles?.[sessionId]?.[m.sid]
              const memberRoleMeta = memberRoleKey ? branchRoles.find((r) => r.key === memberRoleKey) : null
              return (
                <div key={m.sid} className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-600">
                      👤 {m.number}번 {m.nickname}
                    </span>
                    {memberRoleMeta && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {memberRoleMeta.emoji} {getText(memberRoleMeta.label)}
                      </span>
                    )}
                    {note?.links?.length > 0 && (
                      <span className="text-[11px] text-blue-500">🔗 {note.links.length}개</span>
                    )}
                  </div>
                  {note?.text
                    ? <p className="text-xs text-gray-700 leading-relaxed">{note.text}</p>
                    : <p className="text-xs text-gray-400 italic">아직 메모 없음</p>
                  }
                  {note?.links?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.links.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline truncate max-w-[180px]">
                          🔗 {l.url.replace(/^https?:\/\//, '').slice(0, 35)}…
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* 내 메모 편집 */}
            {role === 'student' && !isLocked && (
              <div className="border border-indigo-200 rounded-lg p-3 space-y-2.5 bg-indigo-50">
                {/* 역할 배지 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-indigo-800">✏️ 내 메모</span>
                  {myRoleMeta ? (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold">
                      {myRoleMeta.emoji} {getText(myRoleMeta.label)}
                    </span>
                  ) : myStudentId === unitInfo?.representativeStudentId ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold">👑 대표</span>
                  ) : null}
                </div>

                {/* 할 일 목록 */}
                {myRoleMeta ? (
                  <div className="bg-white border border-indigo-200 rounded-lg p-2.5 space-y-2">
                    {myRoleMeta.memoGuide?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-indigo-700">📋 메모에 담아야 할 조사 내용</p>
                        <ul className="space-y-1">
                          {myRoleMeta.memoGuide.map((item, i) => (
                            <li key={i} className="flex gap-1.5 text-[12px] text-gray-700 leading-snug">
                              <span className="text-indigo-400 shrink-0 mt-0.5">▸</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {myRoleMeta.todos?.length > 0 && (
                      <div className="space-y-1.5 border-t border-indigo-100 pt-2 mt-1">
                        <p className="text-[11px] font-semibold text-amber-700">📌 미션 할 일 목록</p>
                        <ul className="space-y-2">
                          {myRoleMeta.todos.map((todo, i) => {
                            const t = normalizeTodo(todo)
                            return (
                              <li key={i} className="flex gap-1.5 text-[12px] text-gray-700 leading-snug">
                                <span className="text-amber-500 shrink-0 mt-0.5 font-bold">{i + 1}.</span>
                                <div>
                                  <p className="font-medium">{t.label}</p>
                                  {t.hint && <p className="text-[11px] text-gray-400 mt-0.5">💡 {t.hint}</p>}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    👆 위 <b>1단계 · 역할 선택</b>에서 내 역할을 정하면 그 역할에 맞는 질문이 나타납니다.
                  </p>
                )}

                {/* 메모 텍스트 — 역할에 memoGuide가 있으면 Q&A 형식, 없으면 단일 textarea */}
                {myRoleMeta?.memoGuide?.length > 0 ? (
                  <div className="space-y-3 bg-white border border-indigo-100 rounded-lg p-3">
                    <p className="text-[11px] font-bold text-indigo-700 text-left">❓ 질문에 답하며 조사 내용 정리하기</p>
                    {myRoleMeta.memoGuide.map((q, idx) => (
                      <label key={idx} className="block space-y-1 text-left">
                        <span className="text-xs font-bold text-slate-700">{q}</span>
                        <textarea
                          rows={2}
                          className="w-full text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                          placeholder="여기에 답변을 적으세요..."
                          value={noteQnas[idx] || ''}
                          onChange={(e) => handleNoteQnaChange(idx, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    className="w-full text-sm border border-indigo-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                    placeholder={myRoleMeta
                      ? '위 조사 내용을 바탕으로 정리한 내용을 입력하세요. (10자 이상)'
                      : '역할 배정 후 조사 내용을 정리해 주세요. (10자 이상)'}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                )}

                {/* 링크 추가 */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                      placeholder="참고 자료 URL (신문·뉴스·법령 등)"
                      value={noteLinkInput}
                      onChange={(e) => setNoteLinkInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addLink()}
                    />
                    <button
                      type="button"
                      onClick={addLink}
                      disabled={!isValidUrl(noteLinkInput)}
                      className="px-3 py-1 text-xs rounded bg-blue-500 text-white disabled:opacity-40"
                    >추가</button>
                  </div>
                  {!noteHasLink && (
                    <p className="text-[11px] text-red-500">⚠️ 링크를 1개 이상 추가해야 메모가 완료됩니다.</p>
                  )}
                  {(myNote.links || []).map((l, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-blue-600">
                      <a href={l.url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 truncate hover:underline">
                        🔗 {l.url}
                      </a>
                      <button type="button" onClick={() => removeLink(i)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={submitNote}
                  disabled={noteSaving || !noteHasText || !noteHasLink}
                  className="w-full py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 text-white disabled:opacity-40"
                >
                  {noteSaving ? '저장 중…' : noteSubmitted ? '수정 저장' : '메모 제출'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── 우: 모둠 현황 패널 (역할 선택은 위 1단계 보드에서 처리) ── */}
        {unitGroupId && !isCollaborative && (
          <div className="space-y-3">
            <GroupRoleSummary
              groupId={unitGroupId}
              sessionId={sessionId}
              kind={branch}
              statusOnly
              statusProgressByRole={statusProgressByRole}
              filterSide={unitInfo?._side}
            />

            <OtherGroupsRoleSummary myGroupId={unitGroupId} sessionId={sessionId} kind={branch} />
          </div>
        )}
        </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          2단계: 역할별 섹션 초안 (전체 폭)
          - 내 담당 섹션: 직접 편집 가능
          - 다른 섹션: 읽기 전용 + 저장됨/작성중 상태 배지
      ══════════════════════════════════════════ */}
      {!isCollaborative && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700">✏️ 역할별 섹션 초안</h3>
            <span className="text-xs text-gray-400">
              {Object.values(sections).filter((s) => s?.status === 'ready').length} /&nbsp;
              {sectionRoles.filter((r) => r.assignedSection).length} 섹션 완료
            </span>
          </div>

          <div className="p-4 space-y-3">
            {sectionRoles.map((roleDef) => {
              const key      = roleDef.assignedSection
              const sec      = sections[key] || {}
              const isDone   = sec.status === 'ready'
              const isInProgress = !isDone && Boolean(sec.content)
              const smeta    = SECTION_META[key] || { label: key, placeholder: '' }
              const isMyAssigned = mySection === key && role === 'student' && !isLocked

              const assigneeEntry = Object.entries(groups?.[unitGroupId]?.sessionRoles?.[sessionId] || {})
                .find(([, assignedRoleKey]) => assignedRoleKey === roleDef.key)
              const assigneeStudentId = assigneeEntry?.[0]
              const assigneeStudent = assigneeStudentId ? students?.[assigneeStudentId] : null

              const currentText = sectionTexts[key] ?? sec.content ?? ''

              return (
                <div key={key} className={`rounded-lg border p-3 space-y-2 ${
                  isDone
                    ? 'border-emerald-200 bg-emerald-50'
                    : isMyAssigned
                    ? 'border-indigo-300 bg-indigo-50'
                    : isInProgress
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-700">{roleDef.emoji} {smeta.label}</span>
                    <span className="text-[11px] text-gray-500">
                      담당: {getText(roleDef.label)}{assigneeStudent ? ` (${assigneeStudent.number}번 ${assigneeStudent.nickname})` : ' (미배정)'}
                    </span>
                    <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : isInProgress
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isDone ? '✅ 저장됨' : isInProgress ? '📝 작성중' : '⬜ 미작성'}
                    </span>
                  </div>

                  {isMyAssigned ? (
                    /* 내 담당 섹션: 직접 편집 */
                    <div className="space-y-2">
                      {renderCustomSectionEditor ? (
                        renderCustomSectionEditor(key, sec, (data) => saveSection(key, data), sectionSaving[key], myNote, roleDef)
                      ) : (
                        <>
                          {/* 입법부 — 조항 작성 가이드 카드 */}
                          {branch === 'legislative' && roleDef.sectionLabel && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                              <p className="text-[11px] font-extrabold text-indigo-800">
                                ✏️ {roleDef.emoji} {roleDef.sectionLabel} 작성하기
                              </p>
                              {roleDef.memoGuide?.length > 0 && (
                                <ul className="space-y-0.5 pl-1">
                                  {roleDef.memoGuide.map((q, i) => (
                                    <li key={i} className="text-[11px] text-slate-600 leading-snug">
                                      <span className="text-indigo-400">▸</span> {q}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {myNote?.text?.trim()?.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const memoText = typeof myNote.text === 'string' ? myNote.text : ''
                                    const cur = typeof currentText === 'string' ? currentText : ''
                                    const next = cur.trim().length > 0
                                      ? `${cur}\n\n--- 메모에서 가져온 내용 ---\n${memoText}`
                                      : memoText
                                    setSectionTexts((prev) => ({ ...prev, [key]: next }))
                                  }}
                                  className="px-3 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                                >
                                  📥 메모 내용 불러오기
                                </button>
                              )}
                            </div>
                          )}
                          {/* 사법부 — 내 미션 불러오기 버튼 (3 미션 + 출처 → 섹션 초안에 자동 채움) */}
                          {branch === 'judicial' && myRoleKey && (
                            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                              <p className="text-[11px] text-indigo-700 font-semibold">
                                📥 작성한 3가지 미션을 섹션 초안으로 한 번에 가져올 수 있어요.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const text = buildMissionsText()
                                  if (!text) {
                                    alert('아직 작성된 미션이 없어요. 위에서 3가지 미션을 먼저 작성·저장해 주세요.')
                                    return
                                  }
                                  const cur = sectionTexts[key] ?? sec.content ?? ''
                                  const next = cur && cur.trim().length > 0
                                    ? `${cur}\n\n${text}`
                                    : text
                                  setSectionTexts((prev) => ({ ...prev, [key]: next }))
                                }}
                                className="shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                              >
                                📥 내 미션 불러오기
                              </button>
                            </div>
                          )}
                          <textarea
                            rows={5}
                            className="w-full text-sm border border-indigo-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                            placeholder={roleDef.sectionPlaceholder || smeta.placeholder}
                            value={currentText}
                            onChange={(e) => setSectionTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveSection(key, sectionTexts[key] ?? '')}
                              disabled={sectionSaving[key]}
                              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                            >
                              {sectionSaving[key] ? '저장 중…' : sec.content ? '수정 저장' : '저장'}
                            </button>
                            {isDone && <span className="text-[11px] text-emerald-600 font-semibold">✅ 저장됨</span>}
                            {isInProgress && !isDone && <span className="text-[11px] text-amber-600">20자 이상이면 완료 처리됩니다.</span>}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* 다른 역할 섹션: 읽기 전용 */
                    <div className="bg-white/70 rounded border border-gray-200 p-2 min-h-[60px]">
                      {renderCustomSectionViewer ? (
                        renderCustomSectionViewer(key, sec, roleDef)
                      ) : (
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {typeof sec.content === 'object'
                            ? sec.content?.text || <span className="italic text-gray-400">아직 작성되지 않았습니다.</span>
                            : sec.content || <span className="italic text-gray-400">아직 작성되지 않았습니다.</span>
                          }
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          3단계 A: 총괄 검토원 최종 편집
          (역할 중심 + 섹션 배정 모드에서만 표시)
      ══════════════════════════════════════════ */}
      {hasSectionRoles && isMyUnit && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700">✅ 최종 {docLabel} 미리보기</h3>
            {isLocked && <span className="text-xs font-semibold text-emerald-600">🔒 확정 완료</span>}
          </div>

          <div className="p-4 space-y-4">
            {/* 섹션 미리보기 패널 (어두운 배경) */}
            <div className="bg-gray-900 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-300">📋 섹션 초안 미리보기</p>
              </div>
              {sectionRoles.map((roleDef) => {
                const key  = roleDef.assignedSection
                const sec  = sections[key]
                const meta = SECTION_META[key] || { label: key }
                const content = sec?.content
                const text = typeof content === 'object' ? content?.text : content
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-indigo-300">[{meta.label}]</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        sec?.status === 'ready'
                          ? 'bg-emerald-900 text-emerald-300'
                          : text
                          ? 'bg-amber-900 text-amber-300'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {sec?.status === 'ready' ? '✅ 저장됨' : text ? '📝 작성중' : '⬜ 미작성'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {text || <span className="italic text-gray-500">(미작성)</span>}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* 총괄 검토원/대표: 최종 미리보기 + 수정 모드 토글 */}
            {(canEditFinal || role === 'teacher') && !isLocked && (
              <div className="space-y-2">
                {renderCustomFinalEditor ? (
                  renderCustomFinalEditor(
                    sections,
                    mergedFinalDoc,
                    saveFinalDraft,
                    finalSaving,
                    async (publishedContent) => {
                      await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
                        content: publishedContent,
                        status: 'locked',
                        lockedAt: Date.now(),
                        lockedBy: myStudentId,
                      })
                      onPublish?.(publishedContent)
                    },
                    allSectionsDone
                  )
                ) : finalEditing ? (
                  <>
                    <p className="text-xs font-bold text-gray-700">
                      ✏️ 최종 {docLabel} 수정 중
                      <span className="ml-2 text-[11px] text-gray-400 font-normal">각 역할의 섹션 내용이 자동으로 불러와졌어요. 문맥에 맞게 다듬어 완성하세요.</span>
                    </p>
                    <textarea
                      rows={10}
                      className="w-full text-sm border border-gray-300 rounded-lg p-3 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="각 역할이 작성한 섹션 내용이 자동으로 불러와집니다. 아래 '📥 섹션 내용 다시 불러오기'로 최신 내용을 다시 가져올 수도 있어요."
                      value={finalText}
                      onChange={(e) => setFinalText(e.target.value)}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={async () => { await saveFinalDraft(); setFinalEditing(false) }}
                        disabled={finalSaving || !finalText.trim()}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                      >
                        {finalSaving ? '저장 중…' : '💾 저장 + 미리보기로'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalEditing(false)}
                        disabled={finalSaving}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        ✕ 취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // 각 섹션의 최신 내용으로 에디터를 다시 채운다 (덮어쓰기)
                          if (finalText.trim() && !window.confirm('지금 다듬고 있는 내용을 각 섹션의 최신 내용으로 다시 채울까요?\n(지금까지 수정한 내용은 사라집니다.)')) return
                          loadPreviewToEditor(true, true)
                        }}
                        disabled={finalSaving}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 ml-auto"
                      >
                        📥 섹션 내용 다시 불러오기
                      </button>
                    </div>
                  </>
                ) : (
                  /* 미리보기 모드 — 읽기 전용 표시 */
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3 min-h-[120px]">
                    <p className="text-[11px] font-bold text-amber-700 mb-2">📄 통합 미리보기</p>
                    {(finalText && finalText.trim().length > 0) || (mergedFinalDoc?.content?.mergedBody && String(mergedFinalDoc.content.mergedBody).trim().length > 0) ? (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {finalText && finalText.trim().length > 0 ? finalText : mergedFinalDoc.content.mergedBody}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        아직 작성된 내용이 없어요. 아래 [✏️ 수정하기]를 누르면 각 섹션 내용이 자동으로 불러와집니다.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 다른 역할 학생: 총괄 검토원이 작성한 최종본 읽기 전용 */}
            {!canEditFinal && role === 'student' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-bold text-gray-600">✅ 최종 {docLabel}</p>
                {renderCustomFinalViewer ? (
                  renderCustomFinalViewer(mergedFinalDoc, { repLabel })
                ) : (
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                    {mergedFinalDoc?.content?.mergedBody || <span className="italic text-gray-400">아직 작성되지 않았습니다.</span>}
                  </p>
                )}
              </div>
            )}

            {/* 최종 확정 영역 — 미리보기 모드일 때만 노출 (편집 중에는 위 textarea 영역 버튼 사용) */}
            {!renderCustomFinalEditor && (canEditFinal || role === 'teacher') && !isLocked && !finalEditing && (
              <div className="space-y-2">
                {!allSectionsDone && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                    ⚠️ 아직 저장되지 않은 섹션이 있습니다. 대표가 대신 작성한 경우에는 그대로 제출할 수 있어요 (제출 시 확인창이 한 번 더 뜹니다).
                  </p>
                )}
                {!finalText.trim() && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                    ⚠️ [✏️ 수정하기]를 누르면 각 섹션 내용이 자동으로 불러와집니다. 다듬은 뒤 제출하세요.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // 에디터가 비어 있으면 각 역할 섹션 내용을 자동으로 불러와 채운다
                      if (!finalText.trim()) loadPreviewToEditor(true)
                      setFinalEditing(true)
                    }}
                    className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-white border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition"
                  >
                    ✏️ 수정하기
                  </button>
                  <button
                    type="button"
                    disabled={!finalText.trim()}
                    onClick={async () => {
                      // 모든 섹션이 저장되지 않았을 때 — 대표가 대필했는지 경고
                      if (!allSectionsDone) {
                        const repId = unitInfo?.representativeStudentId
                        const repStudent = repId ? students?.[repId] : null
                        const repName = repStudent
                          ? `${repStudent.number ? repStudent.number + '번 ' : ''}${repStudent.nickname || '대표'}`
                          : '대표'
                        if (!confirm(`⚠️ 모든 섹션이 저장되어야 제출할 수 있습니다.\n\n${repName}님이 대신 작성하셨습니까?\n\n(확인을 누르면 미완료 섹션이 있는 상태로 그대로 제출됩니다.)`)) return
                      } else {
                        if (!confirm(`최종 ${docLabel}을(를) 제출(발의)합니다. 제출 후에도 [다시 수정하기]로 고칠 수 있어요. 계속할까요?`)) return
                      }
                      const contentToPublish = {
                        mergedBody: finalText,
                        ...Object.fromEntries(
                          sectionRoles.map((r) => {
                            const content = sections[r.assignedSection]?.content
                            return [r.assignedSection, typeof content === 'object' ? content?.text || '' : content || '']
                          })
                        ),
                      }
                      await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
                        content: contentToPublish,
                        status: 'locked',
                        lockedAt: Date.now(),
                        lockedBy: myStudentId,
                      })
                      onPublish?.(contentToPublish)
                    }}
                    className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition"
                  >
                    {branch === 'legislative' ? '🏛️ 법안 발의하기' : '🔒 제출하기'}
                  </button>
                </div>
              </div>
            )}

            {isLocked && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-emerald-700">🔒 최종 확정 완료</p>
                  {(canEditFinal || role === 'teacher') && (
                    <button
                      type="button"
                      onClick={unlockFinalDoc}
                      className="shrink-0 px-3 py-1 text-[11px] font-bold rounded-lg border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 transition"
                    >
                      ✏️ 다시 수정하기
                    </button>
                  )}
                </div>
                {renderCustomFinalViewer ? (
                  renderCustomFinalViewer(mergedFinalDoc, { repLabel })
                ) : (
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {mergedFinalDoc?.content?.mergedBody || '(내용 없음)'}
                  </p>
                )}
                {(canEditFinal || role === 'teacher') && (
                  <p className="text-[11px] text-gray-400">
                    제출 후에도 [다시 수정하기]로 내용을 고치고 다시 발의할 수 있어요.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          3단계 B: 공동 작업 또는 섹션 없는 모드
          (기존 children + 최종 확정 버튼 방식)
      ══════════════════════════════════════════ */}
      {(isRepresentative || isLocked || isCollaborative) && !hasSectionRoles && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700">
              {isCollaborative ? `📝 공동 ${docLabel} 작성` : `✅ 최종 ${docLabel} 확정`}
            </h3>
            {isLocked && <span className="text-xs font-semibold text-emerald-600">🔒 확정 완료</span>}
          </div>

          <div className="p-4 space-y-4">
            {children}

            {(isRepresentative || isCollaborative) && !isLocked && (
              <div className="space-y-2">
                {(!isCollaborative && !allSectionsDone) && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                    ⚠️ 모든 섹션이 완료 상태여야 최종 확정할 수 있습니다.
                  </p>
                )}
                <button
                  type="button"
                  disabled={!isCollaborative && !allSectionsDone}
                  onClick={async () => {
                    await setAt(roomCode, `branchDrafts/${unitId}/finalDoc`, {
                      ...finalDoc,
                      status: 'locked',
                      lockedAt: Date.now(),
                      lockedBy: myStudentId,
                    })
                    onPublish?.({ ...finalDoc?.content, lockedAt: Date.now() })
                  }}
                  className="w-full py-2.5 text-sm font-bold rounded-xl bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition"
                >
                  🔒 최종 확정 — 제출하기
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
