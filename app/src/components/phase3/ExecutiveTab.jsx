import ExecutivePolicyBudgetDraft, {
  ExecutiveSectionEditor,
  ExecutiveSectionViewer,
  ExecutiveFinalAssembler,
  ExecutiveFinalViewer,
  ExecutiveSectionBudgetManager,
  ExecutiveStatsReference,
} from './ExecutivePolicyBudgetDraft'
import ExecutivePolicyDiscussionList from './ExecutivePolicyDiscussionList'
import ExecutiveCabinetPanel from './ExecutiveCabinetPanel'
import ExecutivePolicyFinalEdit from './ExecutivePolicyFinalEdit'
import ExecutiveApprovalBoard from './ExecutiveApprovalBoard'
import ExecutiveBudgetReviewBoard from './ExecutiveBudgetReviewBoard'
import OtherGroupsRoleSummary from '../scaffolding/OtherGroupsRoleSummary'
import HighlightBox from '../shared/HighlightBox'
import useGameStore from '../../store/gameStore'
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { subscribe, setAt } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import { DEFAULT_ROLES } from '../../lib/scaffolding-data'
import ExecutiveProgressGuide from './ExecutiveProgressGuide'
import BranchUnitBanner from './BranchUnitBanner'
import BranchUnitWorkspace from './BranchUnitWorkspace'
import PresidentControlPanel from './PresidentControlPanel'
import ExecutivePrepPanel from './ExecutivePrepPanel'
import ExecutivePrepSummary from './ExecutivePrepSummary'
import ResearchWorkspace from '../research/ResearchWorkspace'

const SESSION_ID = 'executive-default' // Phase3Page 와 동일 키
// 기사자료수집 상단 참고 링크 (정부 부처별 정책뉴스)
const EXEC_RESEARCH_REF_LINKS = [
  { label: '🏛️ 정부 부처별 정책뉴스 (korea.kr)', url: 'https://www.korea.kr/news/ministryNewsHome.do', hint: '우리 부처가 실제로 무슨 일을 하는지 살펴보세요' },
]
// 행정부 단계 step id
const KNOWN_EXEC_STEPS = new Set([
  'executive-roles',
  'executive-budget',
  'executive-review',
  'executive-discuss',
  'executive-briefing',
  'executive-request',
  'executive-meeting',
  'executive-adjust',
  'executive-final',
  'executive-end',
])


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

function PassedLawPrepPanel({ billsMap = {} }) {
  const passedBills = useMemo(() => Object.entries(billsMap || {})
    .map(([id, bill]) => ({ id, ...bill }))
    .filter((bill) => bill.status === 'passed')
    .sort((a, b) => (b.finalizedAt || b.createdAt || 0) - (a.finalizedAt || a.createdAt || 0)), [billsMap])

  return (
    <section className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/70 p-4 space-y-3">
      <div>
        <h2 className="text-lg font-black text-indigo-900">📜 준비: 가결 법령 확인</h2>
        <p className="mt-1 text-xs text-indigo-700">
          행정부는 국회에서 가결된 법령을 실제로 실행하기 위해 정책, 시행령, 예산을 정리합니다.
          정책 초안으로 넘어가기 전에 어떤 법령을 집행할지 먼저 확인하세요.
        </p>
      </div>
      {passedBills.length === 0 ? (
        <p className="rounded-xl border border-dashed border-indigo-200 bg-white/80 p-4 text-sm text-indigo-700">
          아직 가결된 법령이 없습니다. 입법 발표 단계에서 가결 법안이 확정되면 여기에 표시됩니다.
        </p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {passedBills.map((bill) => {
            const body = buildBillBodyText(bill)
            return (
              <article key={bill.id} className="rounded-xl border border-indigo-200 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black text-indigo-950">{bill.title || '제목 없는 법령'}</h3>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                    가결
                  </span>
                </div>
                <details className="mt-2 text-xs text-slate-700">
                  <summary className="cursor-pointer font-black text-indigo-700">법령 내용 보기</summary>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2">
                    {body || '법령 본문이 없습니다.'}
                  </p>
                </details>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

/**
 * Phase 3 행정부 — 두 가지 핵심 활동:
 *   ① 예산 편성 + 시행령 작성 (MinisterPolicyDraft)
 *   ② 시행령 작성·토의 (CommentList)
 *
 * 4역할(기본): 👑 목적·대상 설계원 / 📋 시행 절차 설계원 / 🔎 지원 내용 설계원 / 📊 점검·보완 설계원
 *   확장 역할(의견 수렴원·부작용 예측원·예산 조율원)은 학급설정 역할 예시 자료에서 교사가 추가할 때만 사용.
 *
 * NPC 사건은 사법부 전용 — 이 탭에서 노출되지 않음.
 *
 * @param {{previewMode?: boolean}} props
 *   previewMode: true 면 학생 전용 영역(역할 작업·모둠 활동) 숨김. 핵심 데이터만.
 */
function ExecutiveTab({ previewMode = false }) {
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const roomCode = useGameStore((s) => s.roomCode)
  const config = useGameStore((s) => s.config)
  const className = useGameStore((s) => s.className)
  const branchConfig = config?.branchConfig
  const countryName = branchConfig?.executive?.countryName || config?.countryName || className || '축소국'
  const exeUnits = useMemo(() => {
    const units = [...(branchConfig?.executive?.units || [])]
    const pGid = branchConfig?.executive?.presidentGroupId
    if (pGid) {
      const hasPresidentUnit = units.some((u) => u.groupId === pGid)
      if (!hasPresidentUnit) {
        units.push({
          unitId: 'exe-president',
          groupId: pGid,
          ministryName: branchConfig?.executive?.presidentMinistryName || '대통령실',
          title: branchConfig?.executive?.presidentMinistryName || '대통령실',
          representativeStudentId: null
        })
      }
    }
    return units
  }, [branchConfig])
  const isCollaborativeExecutive = branchConfig?.executive?.mode === 'collaborative'
  const wf = useWorkflow()
  const stepId = wf.currentStep?.id
  const isKnown = KNOWN_EXEC_STEPS.has(stepId)
  const isStudent = role === 'student'
  const anyHL = !previewMode && isStudent && isKnown
  const isRoleStep = stepId === 'executive-roles'
  const isBudgetStep = stepId === 'executive-budget'
  const isReviewStep = stepId === 'executive-review'
  const isDiscussStep = stepId === 'executive-discuss'
  const isBriefingStep = stepId === 'executive-briefing'
  const isRequestStep = stepId === 'executive-request'
  const isMeetingStep = stepId === 'executive-meeting'
  const isAdjustStep = stepId === 'executive-adjust' || isBriefingStep || isRequestStep
  const isFinalStep = stepId === 'executive-final' || stepId === 'executive-end'

  // 섹션 ref — 항상 렌더링되는 wrapper 에 부여해 교사/학생/미리보기 모두에서 스크롤 동작
  const prepRef = useRef(null)
  const rolesRef = useRef(null)
  const budgetRef = useRef(null)
  const reviewRef = useRef(null)
  const collaborativeDraftRef = useRef(null)
  const discussRef = useRef(null)
  const briefingRef = useRef(null)
  const meetingRef = useRef(null)
  const finalRef = useRef(null)
  useEffect(() => {
    // 미리보기는 HighlightBox 의 preview-container 전용 스크롤에 위임 (window 스크롤 방지)
    if (previewMode || !isKnown) return
    let target = null
    if (isRoleStep) target = prepRef.current || rolesRef.current
    else if (isBudgetStep) {
      // 공동작업 모드: 작성 폼이 ① wrapper 안에 있으므로 폼 전용 앵커로 이동
      // 역할중심 모드: 별도 ② 섹션 — budgetRef
      target = isCollaborativeExecutive ? (collaborativeDraftRef.current || rolesRef.current) : budgetRef.current
    }
    else if (isReviewStep) target = reviewRef.current
    else if (isDiscussStep) target = discussRef.current
    else if (isMeetingStep) target = meetingRef.current
    else if (isAdjustStep) target = briefingRef.current || meetingRef.current
    else if (isFinalStep) target = finalRef.current || briefingRef.current || meetingRef.current
    if (!target) return
    const t = setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
    return () => clearTimeout(t)
  }, [stepId, previewMode, isKnown, isRoleStep, isBudgetStep, isReviewStep, isDiscussStep, isMeetingStep, isAdjustStep, isFinalStep, isCollaborativeExecutive])


  const [policiesMap, setPoliciesMap] = useState({})
  const [billsMap, setBillsMap] = useState({})
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'policies', (d) => setPoliciesMap(d || {}))
    return () => u?.()
  }, [roomCode])
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'bills', (d) => setBillsMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const passedBills = useMemo(() => Object.entries(billsMap || {})
    .map(([id, bill]) => ({ id, ...bill }))
    .filter((bill) => bill.status === 'passed')
    .sort((a, b) => (b.finalizedAt || b.createdAt || 0) - (a.finalizedAt || a.createdAt || 0)), [billsMap])

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const draftUnits = useMemo(() => {
    if (previewMode || exeUnits.length === 0) return []
    const pGid = branchConfig?.executive?.presidentGroupId
    if (role === 'teacher') {
      if (isCollaborativeExecutive && pGid) {
        return exeUnits.filter((unit) => unit.groupId !== pGid)
      }
      return exeUnits
    }
    if (role === 'student' && myGroupId) {
      if (isCollaborativeExecutive && pGid && myGroupId === pGid) {
        return []
      }
      return exeUnits.filter((unit) => unit.groupId === myGroupId)
    }
    return []
  }, [previewMode, exeUnits, role, myGroupId, isCollaborativeExecutive, branchConfig])

  const isPresidentGroup = myGroupId && (
    branchConfig?.executive?.presidentGroupId === myGroupId ||
    groups?.[myGroupId]?.name?.includes('대통령')
  )

  // 대통령실 안에서 '대통령(대표)'인지 — 대표는 승인만, 일반 모둠원은 시행령 수정만 보이게 구분
  const presidentRepKey = useMemo(
    () => (DEFAULT_ROLES.executive_president || []).find((r) => r.isRepresentative)?.key || 'pledge_purpose',
    []
  )
  const myRoleKey = groups?.[myGroupId]?.sessionRoles?.[SESSION_ID]?.[myStudentId]
  // 대표 판정은 두 출처(빠른제어 sessionRoles 역할키 / 학급설정 representativeStudentId) 중
  // 하나라도 나를 가리키면 인정한다. 양방향 동기화 도입 전 레거시 데이터도 안전하게 처리.
  const myUnitRepId = (exeUnits.find((u) => u.groupId === myGroupId) || {}).representativeStudentId || null
  const isPresidentLeader = !!isPresidentGroup && (myRoleKey === presidentRepKey || myUnitRepId === myStudentId)

  // 내 모둠(부처)의 유닛 — 준비 요약(prep)이 unitId 기준이라 필요
  const myUnit = useMemo(
    () => exeUnits.find((u) => u.groupId === myGroupId) || null,
    [exeUnits, myGroupId]
  )
  const myMinistryName = myUnit?.ministryName || groups?.[myGroupId]?.name || '우리 부처'

  const researchTargets = isPresidentGroup
    ? ['대통령 공약 및 국정과제', '부처별 정책 쟁점 및 갈등', '정부 예산 배정 현황', '시민 여론 및 소통 사례']
    : ['필요한 예산·물가 정보', '예상되는 반대 의견', '과거 정책 실패 사례', '행정 인력·시간 계산']

  const researchDescription = isPresidentGroup
    ? "대통령실로서 우리 정부의 핵심 공약을 실현하고 각 부처의 예산/정책 쟁점을 조율하기 위한 자료를 수집하세요."
    : "가결 법령을 실제로 집행하기 위해 필요한 자료 목록을 정하고, 정책·예산 근거가 될 기사 자료를 수집하세요."

  return (
    <div className="space-y-4">
      {/* 부서 배치 현황 배너 */}
      <BranchUnitBanner branch="executive" />

      <div ref={prepRef} className="scroll-mt-4">
        {/* 자료실 — 후반(작성·토의) 단계에서는 읽기 전용 요약(수집 자료·대표 정리)만. 입력은 ① 역할및준비에서. */}
        {!previewMode && role === 'student' && myGroupId && !isRoleStep && (
          <details
            open={isBudgetStep || isDiscussStep || !isKnown}
            className="rounded-2xl border border-amber-200 bg-amber-50/40"
          >
            <summary className="cursor-pointer px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-50/80 rounded-2xl">
              📚 집행계획 근거 자료실 — 수집 자료·준비 내용 보기
            </summary>
            <div className="p-3">
              <ExecutivePrepSummary
                unitId={myUnit?.unitId}
                groupId={myGroupId}
                isPresident={isPresidentGroup}
                ministryName={myMinistryName}
              />
            </div>
          </details>
        )}
      </div>



      {/* 행정부 활동 안내 (상태바가 있으므로 압축) */}
      {!previewMode && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-900">
          <p className="font-bold">🏢 행정부 — 법률 집행계획·시행령·예산안 작성과 국무회의 조정</p>
          <p className="text-[11px] text-violet-700 mt-1">
            {branchConfig?.executive?.mode === 'collaborative'
              ? '🤝 모둠원들과 함께 가결 법령을 바탕으로 집행계획, 시행령 초안, 여러 예산 항목을 작성합니다.'
              : '🎭 역할은 혼자 하는 일이 아니라 해당 영역을 놓치지 않도록 주도하는 책임입니다. 함께 집행계획과 예산을 완성하세요.'}
          </p>
        </div>
      )}

      {/* === ① 역할 배정·임무 확인 영역 — 항상 렌더링되는 wrapper(rolesRef) 안에 모드별 콘텐츠 === */}
      <div ref={rolesRef} className="scroll-mt-4 space-y-4">
        {/* 행정부 단계별 안내 (교사/모둠 미가입 학생) */}
        {!previewMode && (
          <>
            {role === 'student' && !myGroupId && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-sm text-rose-900 mb-4">
                ⚠️ 아직 행정부 모둠에 가입돼 있지 않아 작업 공간이 보이지 않아요. 선생님께 모둠 배정을 요청하세요.
              </div>
            )}
            {role === 'teacher' && (
              <HighlightBox active={!anyHL || isRoleStep} anyHighlight={anyHL} scrollBlock="start">
                <section className="bg-violet-50/40 border-2 border-violet-200 rounded-2xl p-4 mb-4">
                  <h2 className="text-lg font-bold text-violet-900 mb-2 flex items-baseline gap-2">
                    <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">①</span>
                    {branchConfig?.executive?.mode === 'collaborative' ? '행정부 운영 — 공동 작업 모드' : '행정부 운영 — 역할 중심 모드'}
                  </h2>
                  <p className="text-xs text-violet-800">
                    {branchConfig?.executive?.mode === 'collaborative'
                      ? '🤝 현재 공동 작업 모드입니다. 학생들은 역할 배정 없이도 모든 모둠원이 함께 예산과 정책을 짭니다.'
                      : '🎭 현재 역할 중심 모드입니다. 학생들은 시행령 조문 중심 4인 역할을 배정하고, 대표 역할 학생이 최종안을 정리합니다.'}
                  </p>
                </section>
              </HighlightBox>
            )}
          </>
        )}

        {/* 미리보기 모드용 ① 앵커 — 빈 공간이라도 ref 가 닿게 */}
        {previewMode && isRoleStep && (
          <div className="bg-violet-50/40 border border-violet-200 rounded-xl p-3 text-xs text-violet-700">
            ① 역할 배정·임무 확인 (학생 미리보기 — 자세한 작업창은 실제 학생 화면에서)
          </div>
        )}

      {/* 학생: 공동작업 준비 단계 안내. 작성 템플릿은 ② 단계에서 별도로 열린다. */}
      {!previewMode && role === 'student' && myGroupId && (() => {
        const isCollaborative = (branchConfig?.executive?.mode || 'role_based') === 'collaborative'
        if (!isCollaborative || !isRoleStep) return null

        return (
          <HighlightBox active={!anyHL || isRoleStep} anyHighlight={anyHL} scrollBlock="start">
            <section className="bg-violet-50/30 border-2 border-violet-300 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-lg font-bold text-violet-900 flex items-baseline gap-2">
                  <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">①</span>
                  행정부 — 공동 작업 준비
                </h2>
                <span className="text-[10px] px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold">
                  🤝 역할 배정 없음
                </span>
              </div>
              <div className="bg-white border-2 border-violet-200 rounded-xl p-4 text-sm text-violet-900 space-y-2">
                <p className="font-black">🤝 공동작업 모드는 최종 템플릿을 함께 완성합니다</p>
                <p>
                  지금은 위의 <b>집행계획 근거 자료실</b>에서 우리 부처가 찾아야 할 자료 목록을 정하고 기사 자료를 모으는 시간입니다.
                </p>
                <p className="text-xs text-violet-700">
                  선생님이 다음 단계로 넘기면 역할 카드 없이 하나의 정책·시행령·예산 최종 템플릿을 함께 채웁니다.
                </p>
              </div>
            </section>
          </HighlightBox>
        )
      })()}

      {/* 역할중심 ① 역할 및 준비: 역할 나누기(먼저) → 준비 활동(워드클라우드·할 일·비슷한 시행령) */}
      {!previewMode && !isCollaborativeExecutive && draftUnits.length > 0 && (
        <HighlightBox active={!anyHL || isRoleStep} anyHighlight={anyHL} scrollBlock="start">
          <section className="bg-violet-50/50 border-2 border-violet-300 rounded-2xl p-4 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-violet-900 flex items-baseline gap-2">
                <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">①</span>
                역할 및 준비 — 역할 나누기 → 우리 부처가 할 일 정하기
              </h2>
              <p className="text-xs text-violet-700 mt-1">
                ① 먼저 역할을 나누고(대표 포함, 교사가 확정·잠금) ② 정책뉴스·워드클라우드를 보며 ③ 우리 부처가 할 일을 정한 뒤 ④ 비슷한 시행령을 찾습니다. 초안 작성은 다음 단계(②)에서.
              </p>
            </div>
            {draftUnits.map((unit) => {
              const pGid = branchConfig?.executive?.presidentGroupId
              const isPresidentUnit =
                unit.unitId === 'exe-president' ||
                (pGid && unit.groupId === pGid) ||
                Boolean(groups?.[unit.groupId]?.name?.includes('대통령'))
              return (
                <div key={unit.unitId} className={`border-2 rounded-2xl overflow-hidden bg-white ${isPresidentUnit ? 'border-yellow-300' : 'border-amber-200'}`}>
                  <div className={`px-4 py-2 ${isPresidentUnit ? 'bg-yellow-100' : 'bg-amber-100'}`}>
                    <span className="text-sm font-bold text-amber-800">
                      {isPresidentUnit ? '👑' : '🇰🇷'} {unit.ministryName || groups?.[unit.groupId]?.name || unit.groupId}
                      {isPresidentUnit && <span className="ml-2 text-yellow-700 font-normal text-xs">대통령실 — 행정부 총괄</span>}
                    </span>
                  </div>
                  <div className="p-4">
                    <BranchUnitWorkspace
                      unitId={unit.unitId}
                      branch="executive"
                      isCollaborative={false}
                      executivePhase="roles"
                      prepSlot={isPresidentUnit ? (
                        <div className="space-y-3">
                          {/* 대통령실 전용 — 가결 법안 확인 + 공약·지시사항 + 자료 수집 */}
                          <details open className="rounded-2xl border border-yellow-300 bg-yellow-50/40">
                            <summary className="cursor-pointer px-4 py-2 text-sm font-bold text-yellow-900 hover:bg-yellow-50/80 rounded-2xl">
                              📜 통과 법안 확인 (공약과 연결할 법안 고르기)
                            </summary>
                            <div className="p-3">
                              <PassedLawPrepPanel billsMap={billsMap} />
                            </div>
                          </details>
                          {/* 공약 선택 + 부처별 업무지시 + 국무회의 대본 */}
                          <PresidentControlPanel groupId={unit.groupId} />
                          {/* 관련 뉴스·시행령 자료 수집 (모둠원 각자 올릴 수 있음) */}
                          <details open className="rounded-2xl border border-yellow-300 bg-yellow-50/40">
                            <summary className="cursor-pointer px-4 py-2 text-sm font-bold text-yellow-900 hover:bg-yellow-50/80 rounded-2xl">
                              🔍 관련 뉴스·시행령 자료 수집
                            </summary>
                            <div className="p-3">
                              <ResearchWorkspace
                                contextKey="phase3_executive"
                                groupId={unit.groupId}
                                title="공약 실현 근거 자료실"
                                description={researchDescription}
                                defaultTargets={researchTargets}
                                accent="amber"
                                referenceLinks={EXEC_RESEARCH_REF_LINKS}
                              />
                            </div>
                          </details>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* 가결 법령 확인 + 집행계획 근거 자료실(기사 수집) — 역할 나눈 뒤 근거 기사부터 찾기 */}
                          <details open className="rounded-2xl border border-amber-200 bg-amber-50/40">
                            <summary className="cursor-pointer px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-50/80 rounded-2xl">
                              📚 가결 법령 확인 + 근거 기사 찾기 (자료실)
                            </summary>
                            <div className="p-3 space-y-3">
                              <PassedLawPrepPanel billsMap={billsMap} />
                              <ResearchWorkspace
                                contextKey="phase3_executive"
                                groupId={unit.groupId}
                                title="집행계획 근거 자료실"
                                description={researchDescription}
                                defaultTargets={researchTargets}
                                accent="amber"
                                referenceLinks={EXEC_RESEARCH_REF_LINKS}
                              />
                            </div>
                          </details>
                          <ExecutivePrepPanel unitId={unit.unitId} groupId={unit.groupId} />
                        </div>
                      )}
                    />
                  </div>
                </div>
              )
            })}
          </section>
        </HighlightBox>
      )}
      </div>
      {/* === ② 예산편성 및 시행령 작성 영역 — 항상 budgetRef wrapper === */}
      <div ref={budgetRef} className="scroll-mt-4">
        <HighlightBox active={!anyHL || isBudgetStep} anyHighlight={anyHL} scrollBlock="start">
          <section className="bg-violet-50/50 border-2 border-violet-300 rounded-2xl p-4">
            <h2 className="text-lg font-bold text-violet-900 mb-3 flex items-baseline gap-2">
              <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">②</span>
              {isCollaborativeExecutive ? '공동 정책·시행령·예산 템플릿 작성' : '역할별 시행령·예산 초안 작성'}
            </h2>
            <p className="text-xs text-violet-800 mb-3">
              {isCollaborativeExecutive
                ? '🤝 공동작업 모드는 역할별 분담 없이 부처 구성원이 하나의 정책·시행령·예산 템플릿을 함께 읽고 수정하며 완성합니다.'
                : '🎭 역할중심 모드는 각 학생이 맡은 시행령 조문과 실행 예산 항목을 저장하고, 저장본이 아래 초안 작업판에 모입니다. 대표는 이를 보며 최종 정책보고서를 정리합니다.'}
            </p>

            {/* 초안 작성 단계에서도 상단에 통과 법안 확인 — 시행령은 이 법을 집행하기 위한 것 */}
            {!isCollaborativeExecutive && !previewMode && (
              <details open className="mb-3 rounded-2xl border border-indigo-200 bg-indigo-50/40">
                <summary className="cursor-pointer px-4 py-2 text-sm font-bold text-indigo-900 hover:bg-indigo-50/80 rounded-2xl">
                  📜 통과된 법안 확인 — 시행령은 이 법을 집행하기 위한 규칙이에요
                </summary>
                <div className="p-3">
                  <PassedLawPrepPanel billsMap={billsMap} />
                </div>
              </details>
            )}

            {draftUnits.length > 0 ? (
              <div className="space-y-4">
                {draftUnits.map((unit) => {
                  // 대통령실 유닛 판별: 학급설정에서 대통령 모둠을 지정하면 unitId는
                  // genUnitId('exe')(예: exe-a1b2c3)로 저장되므로 'exe-president' 리터럴만
                  // 비교하면 인식되지 않는다. presidentGroupId·모둠명으로도 함께 판별한다.
                  const pGid = branchConfig?.executive?.presidentGroupId
                  const isPresidentUnit =
                    unit.unitId === 'exe-president' ||
                    (pGid && unit.groupId === pGid) ||
                    Boolean(groups?.[unit.groupId]?.name?.includes('대통령'))
                  return (
                    <div key={unit.unitId} className={`border-2 rounded-2xl overflow-hidden bg-white ${
                      isPresidentUnit ? 'border-yellow-300' : 'border-amber-200'
                    }`}>
                      <div className={`px-4 py-2 flex items-center gap-2 ${
                        isPresidentUnit ? 'bg-yellow-100' : 'bg-amber-100'
                      }`}>
                        <span className="text-sm font-bold text-amber-800">
                          {isPresidentUnit ? '👑' : '🇰🇷'} {unit.ministryName || groups?.[unit.groupId]?.name || unit.groupId}
                          {!isPresidentUnit && !isCollaborativeExecutive && (
                            <span className="ml-2 text-amber-600 font-normal text-xs">장관: {unit.representativeStudentId || '미지정'}</span>
                          )}
                          {isPresidentUnit && (
                            <span className="ml-2 text-yellow-700 font-normal text-xs">대통령실 — 행정부 총괄</span>
                          )}
                        </span>
                        {isCollaborativeExecutive && !isPresidentUnit && (
                          <span className="ml-auto rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-700">
                            공동작업 템플릿
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        {/* 대통령실 PresidentControlPanel은 역할 단계(prepSlot)에서만 표시.
                            초안작성 단계에서는 중복 제거 — 역할 단계에서 이미 작성한 내용 그대로 유지됨. */}
                        {isPresidentUnit && (
                          <details open className="rounded-2xl border border-yellow-300 bg-yellow-50/40 mb-3">
                            <summary className="cursor-pointer px-4 py-2 text-sm font-bold text-yellow-900 hover:bg-yellow-50/80 rounded-2xl">
                              📜 통과 법안 확인
                            </summary>
                            <div className="p-3">
                              <PassedLawPrepPanel billsMap={billsMap} />
                            </div>
                          </details>
                        )}
                        <BranchUnitWorkspace
                            unitId={unit.unitId}
                            branch="executive"
                            isCollaborative={isCollaborativeExecutive}
                            executivePhase={isCollaborativeExecutive ? undefined : 'draft'}
                            renderCustomSectionEditor={(key, sec, onSave, saving, myNote, roleDef) => (
                              <ExecutiveSectionEditor
                                sectionKey={key}
                                sec={sec}
                                onSave={onSave}
                                saving={saving}
                                groupId={unit.groupId}
                                passedBills={passedBills}
                                myNote={myNote}
                                roleDef={roleDef}
                              />
                            )}
                            renderCustomSectionViewer={(key, sec) => (
                              <ExecutiveSectionViewer sectionKey={key} sec={sec} />
                            )}
                            renderCustomFinalEditor={(sections, finalDoc, onSaveDraft, saving, onPublishSubmit, allSectionsDone) => (
                              <ExecutiveFinalAssembler
                                sections={sections}
                                finalDoc={finalDoc}
                                onSaveDraft={onSaveDraft}
                                saving={saving}
                                onPublishSubmit={onPublishSubmit}
                                allSectionsDone={allSectionsDone}
                                groupId={unit.groupId}
                                isCollaborative={isCollaborativeExecutive}
                              />
                            )}
                            renderCustomFinalViewer={(finalDoc, viewerOptions = {}) => (
                              <ExecutiveFinalViewer finalDoc={finalDoc} {...viewerOptions} />
                            )}
                            renderCustomBudgetManager={(budgetItems, setBudgetItems, gId, sectionKey, suggestions) => (
                              <>
                                <ExecutiveStatsReference countryName={countryName} />
                                <ExecutiveSectionBudgetManager
                                  budgetItems={budgetItems}
                                  setBudgetItems={setBudgetItems}
                                  groupId={gId}
                                  suggestions={suggestions}
                                />
                              </>
                            )}
                            onPublish={async (publishedData) => {
                              if (!roomCode) return
                              await setAt(roomCode, `policies/${unit.groupId}`, {
                                ministryName: unit.ministryName || '',
                                groupId: unit.groupId,
                                authorStudentId: unit.representativeStudentId,
                                status: 'submitted',
                                branchUnitId: unit.unitId,
                                submittedAt: Date.now(),
                                ...publishedData,
                              })
                            }}
                          >
                            <ExecutivePolicyBudgetDraft groupId={unit.groupId} />
                          </BranchUnitWorkspace>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : previewMode ? (
              <div className="bg-white border border-violet-200 rounded-xl p-4 text-xs text-gray-600">
                👩‍🏫 학생 화면에서는 장관(또는 모둠원)이 예산편성과 시행령을 작성합니다.
              </div>
            ) : isPresidentGroup && isCollaborativeExecutive ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 text-xs text-yellow-900">
                  👑 <b>대통령실 — 국무회의 준비</b>: 공동작업 모드에서는 부처 시행령을 직접 쓰지 않습니다. 다른 부처가 시행령을 만드는 동안, 아래에서 <b>국무회의 대본·부처 업무지시·관련 자료</b>를 준비하세요. 여기서 만든 <b>국무회의 대본</b>은 나중에 토론도구(국무회의)에 그대로 올라갑니다.
                </div>
                {/* 공약 선택 · 부처 업무지시 · 국무회의 대본 작성 */}
                <PresidentControlPanel groupId={myGroupId} />
                {/* 국무회의 준비 자료 올리기 (편집 가능) */}
                <details open className="rounded-2xl border border-amber-200 bg-amber-50/40">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-50/80 rounded-2xl">
                    📎 국무회의 준비 자료 올리기
                  </summary>
                  <div className="p-3">
                    <ResearchWorkspace
                      contextKey="phase3_executive"
                      groupId={myGroupId}
                      title="국무회의 준비 자료실"
                      description="국무회의에 필요한 자료(공약 근거, 부처별 쟁점, 예산 현황 등)를 모으세요."
                      defaultTargets={researchTargets}
                      accent="amber"
                      referenceLinks={EXEC_RESEARCH_REF_LINKS}
                    />
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-sm text-gray-500">모둠 가입이 필요해요.</p>
            )}
          </section>
        </HighlightBox>
      </div>

      {/* === ③ 예산 초안 검토 — 정부 총예산 대비 부처별 청구액 전광판 === */}
      <HighlightBox active={!anyHL || isReviewStep} anyHighlight={anyHL} scrollBlock="start">
        <section ref={reviewRef} className="bg-slate-950 border-2 border-indigo-400 rounded-2xl overflow-hidden shadow-xl">
          <ExecutiveBudgetReviewBoard />
        </section>
      </HighlightBox>

      {/* === ④ 토의 및 평가 — 제출된 집행계획에 댓글·의견 === */}
      <HighlightBox active={!anyHL || isDiscussStep} anyHighlight={anyHL} scrollBlock="start">
        <section ref={discussRef} className="bg-amber-50/50 border-2 border-amber-300 rounded-2xl p-4">
          <h2 className="text-lg font-bold text-amber-900 mb-3 flex items-baseline gap-2">
            <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">④</span>
            토의 및 평가 — 다른 모둠 집행계획 평가
          </h2>
          <p className="text-xs text-amber-800 mb-3">
            발의된 정책·예산안만 노출됩니다.
            다른 부처의 집행계획·시행령·예산안을 보고 찬성/반대/중립 의견과 3축 평가를 남기세요.
            <b className="text-amber-900"> 토의 결과가 ④ 국무회의 토론의 토대</b>가 됩니다.
          </p>
          <ExecutivePolicyDiscussionList />
        </section>
      </HighlightBox>

      {/* === ④ 국무회의 토론 (오프) === */}
      <HighlightBox active={!anyHL || isMeetingStep} anyHighlight={anyHL} scrollBlock="start">
        <section ref={meetingRef} className="bg-indigo-50/50 border-2 border-indigo-400 rounded-2xl p-4">
          <h2 className="text-lg font-bold text-indigo-900 mb-3 flex items-baseline gap-2">
            <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">⑤</span>
            다자간 토론(국무회의)
          </h2>
          <div className="bg-white border border-indigo-200 rounded-xl p-3 text-sm text-indigo-900 space-y-2">
            <p>
              🎙️ 학급 전체가 모여 <b>국무회의 형식의 오프라인 토론</b> 을 진행합니다.
              각 부처의 장관(또는 발표자)이 집행계획과 예산 필요성을 설명하고, 정부 예산 안에 맞게 최종 배정액을 조정합니다.
            </p>
            <p className="text-xs text-indigo-700">
              {role === 'teacher'
                ? '👩‍🏫 위의 최종 배정 예산 입력칸에서 조정 결과를 반영하고, 각 정책을 최종안으로 확정하세요.'
                : '🎙️ 우리 부처 예산이 줄거나 늘면 실행 규모와 기대효과를 어떻게 바꿀지 준비하세요.'}
            </p>
          </div>
        </section>
      </HighlightBox>

      {/* === ⑥ 정책 및 예산안 최종 수정 === */}
      <HighlightBox active={!anyHL || isAdjustStep} anyHighlight={anyHL} scrollBlock="start">
        <section ref={briefingRef} className="bg-sky-50/50 border-2 border-sky-300 rounded-2xl p-4 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-sky-900 flex items-baseline gap-2">
              <span className="bg-sky-600 text-white text-xs px-2 py-0.5 rounded-full">⑥</span>
              정책 및 예산안 최종 수정 (국무회의 후속 조치)
            </h2>
            <p className="text-xs text-sky-800 mt-1">
              국무회의 토론 결과를 바탕으로 각 부처의 시행령과 최종 배정 예산안을 집중 수정합니다.
              대통령 모둠과 각 부처 장관이 상호 검토 후 최종 승인합니다.
            </p>
          </div>

          {/* 맨 위: 우리 부처 최종 수정 폼 — 일반 모둠원(대통령실은 모둠원만, 대통령(대표)은 제외) */}
          {myGroupId && !isPresidentLeader && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-violet-900">우리 부처 최종 수정 폼</h3>
              {isPresidentGroup && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  👑 대통령실 모둠원: 우리 공약 시행령·예산을 수정하세요. 최종 승인은 대통령(대표)이 합니다.
                </p>
              )}
              <ExecutivePolicyFinalEdit groupId={myGroupId} />
            </div>
          )}

          {/* 최종 승인 보드 — 교사 또는 대통령(대표)만 (일반 모둠원은 안 보임) */}
          {(role === 'teacher' || isPresidentLeader) && (
            <>
              {isPresidentLeader && (
                <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5">
                  👑 대통령(대표): 각 부처 시행령·예산을 검토하고 승인/반려하세요. 시행령 수정은 모둠원이 합니다.
                </p>
              )}
              <ExecutiveApprovalBoard />
            </>
          )}

          {/* 정부 전체 예산 요약 패널 */}
          <div className="bg-white rounded-2xl p-4 border border-sky-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 mb-2">총예산 대비 배정 현황판</h3>
            <ExecutiveCabinetPanel />
          </div>

          {/* 교사: 전체 부처 최종 수정 / 미가입 안내 */}
          {!myGroupId && (role === 'teacher' ? (
            <div className="space-y-4 pt-4 border-t border-sky-200">
              <h3 className="text-sm font-bold text-violet-900">👩‍🏫 전체 부처 최종 수정 및 대통령 승인 관리</h3>
              {Object.keys(groups || {}).filter((gid) => !groups[gid]?.name?.includes('대통령')).map((gid) => (
                <ExecutivePolicyFinalEdit key={gid} groupId={gid} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-4 bg-white rounded-xl border">
              우리 부처의 최종 수정 폼을 보려면 모둠 가입이 필요합니다.
            </p>
          ))}
        </section>
      </HighlightBox>

      {/* === ⑦ 발표 — 최종 결과 확인 === */}
      <HighlightBox active={!anyHL || isFinalStep} anyHighlight={anyHL} scrollBlock="start">
        <section ref={finalRef} className="bg-emerald-50/50 border-2 border-emerald-300 rounded-2xl p-4">
          <h2 className="text-lg font-bold text-emerald-900 mb-3 flex items-baseline gap-2">
            <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">⑦</span>
            최종 예산안 발표
          </h2>
          <p className="text-xs text-emerald-800 mb-3">
            최종 정책·배정 예산·조정 이유를 확인합니다. 행정 결과 기사는 다음 활동에서 따로 작성합니다.
          </p>
          <ExecutiveCabinetPanel />
        </section>
      </HighlightBox>
    </div>
  )
}

export default ExecutiveTab
