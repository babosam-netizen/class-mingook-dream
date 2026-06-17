import { useState, useEffect, useMemo, useRef } from 'react'
import RoomBar from '../components/shared/RoomBar'

import LegislativeTab from '../components/phase3/LegislativeTab'
import ExecutiveTab from '../components/phase3/ExecutiveTab'
import JudicialTab from '../components/phase3/JudicialTab'
import LegislativeProgressGuide from '../components/phase3/LegislativeProgressGuide'
import ExecutiveProgressGuide from '../components/phase3/ExecutiveProgressGuide'
// RoundTabShell: 새 라운드를 추가할 때 사용하는 제네릭 쉘 (useCustomTab: false 인 라운드에서 사용)
import RoundTabShell from '../components/phase3/RoundTabShell'

import { PHASE_META } from '../styles/tokens'
import SessionFinishButton from '../components/shared/SessionFinishButton'
import PollFeed from '../components/shared/PollFeed'
import DiscussionPrompt from '../components/shared/DiscussionPrompt'
import BriefingAutoModal from '../components/scaffolding/BriefingAutoModal'
import BriefingLibrary from '../components/scaffolding/BriefingLibrary'
import RoleAssigner from '../components/scaffolding/RoleAssigner'
import RoleCard from '../components/scaffolding/RoleCard'
import ExpertCallButton from '../components/scaffolding/ExpertCallButton'
import StudentWorkflowProgress from '../components/shared/StudentWorkflowProgress'
import PhaseActivitySummary from '../components/shared/PhaseActivitySummary'
import HighlightBox from '../components/shared/HighlightBox'
import { useWorkflow } from '../lib/use-workflow'
import useGameStore from '../store/gameStore'
import ArticleSection from '../components/news/ArticleSection'
import EvaluatorPanel from '../components/phase3/EvaluatorPanel'

/**
 * ROUNDS — Phase 3의 라운드 설정.
 *
 * 새 라운드를 추가하려면 이 배열에 항목만 추가하면 됩니다.
 * 각 항목의 필드:
 *   id            : 워크플로 highlight 값과 일치 (탭 자동 전환에 사용)
 *   label         : 탭 버튼에 표시할 이름
 *   sessions      : 차시 범위 표시
 *   headline      : 라운드 헤더 제목
 *   articleStepId : 이 라운드의 기사 작성 step id (탭 강제 전환에 사용)
 *   prompt        : 토론 유도 질문 { q, sub }
 *   TabComponent  : 라운드 본문 컴포넌트
 *   ProgressGuide    : 진행 단계 상태바 컴포넌트 (없으면 null)
 *
 * ── 새 라운드 추가 시 (RoundTabShell 사용):
 *   useCustomTab     : false (생략 가능) → TabComponent 대신 RoundTabShell 사용
 *   color            : Tailwind 색상 키 ('emerald'|'violet'|'amber'|'slate'|'indigo')
 *   sessionId        : 역할 세션 ID (예: 'assembly-default')
 *   submissionLabel  : ③ 결과제출 섹션 제목
 *   offlineLabel     : ⑥ 오프토론 섹션 이름
 *   dataPath         : RTDB 제출물 경로 (예: 'assemblyProposals')
 *   SubmissionForm   : ③ 결과제출 폼 컴포넌트 (RoundTabShell에 주입)
 *   ResultDisplay    : ⑦ 결과발표 컴포넌트 (없으면 null)
 *   teacherNote      : 교사 화면 안내 문구
 */
const ROUNDS = [
  {
    id: 'legislative',
    label: '입법부 · 의사당',
    sessions: '10~12차시',
    headline: '🥇 1라운드 — 입법부 (10~12차시)',
    articleStepId: 'article1',
    pollStepIds: ['poll2'],       // 입법 결과 여론조사
    useCustomTab: true,          // 기존 커스텀 탭 사용 (BillTemplate, 야당연합 등 특수 기능 포함)
    prompt: {
      q: '어떤 법을 만들어야 하는가?',
      sub: `코어 이슈를 풀기 위해 어떤 법안이 필요한지 토론하고, 본회의에서 의결합니다. 입법부는 예산 승인·국정 감사도 담당합니다.`,
    },
    TabComponent: LegislativeTab,
    ProgressGuide: LegislativeProgressGuide,
  },
  {
    id: 'executive',
    label: '행정부 · 대시보드',
    sessions: '13~15차시',
    headline: '🥈 2라운드 — 행정부 (13~15차시)',
    articleStepId: 'article2',
    pollStepIds: ['poll3'],       // 예산 편성 평가 여론조사
    useCustomTab: true,          // 기존 커스텀 탭 사용 (MinisterPolicyDraft, 국무회의 등 특수 기능 포함)
    prompt: {
      q: '어디에 예산을 많이 사용해야 하는가? (공약대로 잘하고 있는가?)',
      sub: '제한된 예산을 어디에 우선 배정할지 토론하고 결정합니다. 시민들은 행정부의 시행을 감시하고 기사로 비판합니다.',
    },
    TabComponent: ExecutiveTab,
    ProgressGuide: ExecutiveProgressGuide,
  },
  {
    id: 'judicial',
    label: '사법부 · 법원',
    sessions: '16~18차시',
    headline: '🥉 3라운드 — 사법부 (16~18차시)',
    articleStepId: 'article3',
    pollStepIds: ['poll4'],       // 판결 평가 여론조사
    useCustomTab: true,          // 기존 커스텀 탭 사용 (NPC 사건, 배심원 평결 등 특수 기능 포함)
    prompt: {
      q: '어떤 판결을 내려야 하는가?',
      sub: 'NPC 사건의 변론을 듣고 검사·변호인의 주장을 비교한 뒤, 배심원으로서 유·무죄를 결정합니다.',
    },
    TabComponent: JudicialTab,
    ProgressGuide: null,
  },

  /*
   * ── 새 라운드 추가 예시 (RoundTabShell 사용) ──────────────────────────────
   * {
   *   id: 'assembly',
   *   label: '학급자치 · 운영위원회',
   *   sessions: '19차시',
   *   headline: '🏅 4라운드 — 학급 자치회의',
   *   articleStepId: 'article4',
   *   useCustomTab: false,
   *   color: 'slate',
   *   sessionId: 'assembly-default',
   *   submissionLabel: '자치 의안 제출',
   *   offlineLabel: '학급 자치회의',
   *   dataPath: 'assemblyProposals',
   *   SubmissionForm: AssemblyProposalForm,   // 새로 만들 제출 폼
   *   ResultDisplay: AssemblyResultDisplay,   // 새로 만들 결과 표시
   *   teacherNote: '학생들이 자치 의안을 작성하는 단계입니다.',
   *   prompt: {
   *     q: '우리 학급 규칙을 어떻게 바꿀 것인가?',
   *     sub: '...',
   *   },
   *   TabComponent: null,   // useCustomTab: false 이면 RoundTabShell이 사용됨
   *   ProgressGuide: null,
   * },
   * ─────────────────────────────────────────────────────────────────────────
   */
]

// 워크플로 highlight → 탭 자동 전환에 사용
const ROUND_IDS = ROUNDS.map((r) => r.id)

function Phase3Page({ previewMode = false, forcedTab = null }) {
  const [tab, setTab] = useState(forcedTab || ROUNDS[0].id)
  const [showBriefingPanel, setShowBriefingPanel] = useState(false)
  const [showRoleAssigner, setShowRoleAssigner] = useState(false)
  const [isCoreBriefingAcknowledged, setIsCoreBriefingAcknowledged] = useState(false)

  const wf = useWorkflow()
  const meta = PHASE_META[3]
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const coreIssue = useGameStore((s) => s.roomData?.coreIssue)
  const coreIssueGroup = coreIssue ? (groups[coreIssue] || { name: coreIssue }) : null
  const isStudent = role === 'student' || previewMode
  const config = useGameStore((s) => s.config)
  const anyHL = isStudent && !!wf.currentStep?.highlight
  const isArticleStep = wf.currentStep?.highlight === 'article'
  const isPollStep = wf.currentStep?.highlight === 'poll'
  const lockToArticle = isStudent && isArticleStep
  const lockToPoll = isStudent && isPollStep

  // 현재 활동(부 활동) 정보
  const currentRoundIdx = wf.currentStep?.stage ?? 0

  // 학생 탭 자동 전환 — 워크플로 진행에 맞춰 입법/행정/사법 탭을 강제 동기화
  // 매칭 우선순위:
  //  1) 기사 단계(article1/article2/article3)는 해당 라운드 탭으로
  //  2) stepId 가 `legislative-...` / `executive-...` / `judicial-...` 로 시작하면 해당 라운드
  //  3) currentStep.highlight 가 라운드 id 와 일치하면 해당 라운드
  const stepId = wf.currentStep?.id
  const highlight = wf.currentStep?.highlight
  const expectedTab = useMemo(() => {
    if (!isStudent) return null
    // 1) 기사 단계 — articleStepId 매칭
    const articleRound = ROUNDS.find((r) => r.articleStepId === stepId)
    if (articleRound) return articleRound.id
    // 2) 여론조사 단계 — pollStepIds 매칭 (poll2→legislative, poll3→executive, poll4→judicial)
    const pollRound = ROUNDS.find((r) => r.pollStepIds?.includes(stepId))
    if (pollRound) return pollRound.id
    // 3) stepId prefix 매칭 (예: 'executive-roles' → 'executive')
    if (stepId) {
      const prefixMatch = ROUND_IDS.find((rid) => stepId.startsWith(rid + '-') || stepId === rid)
      if (prefixMatch) return prefixMatch
    }
    // 4) highlight 매칭
    if (ROUND_IDS.includes(highlight)) return highlight
    return null
  }, [isStudent, stepId, highlight])

  const effectiveTab = forcedTab || expectedTab || tab
  const currentRound = ROUNDS.find((r) => r.id === effectiveTab) || ROUNDS[0]

  useEffect(() => {
    const nextTab = forcedTab || expectedTab
    if (nextTab && nextTab !== tab) {
      setTab(nextTab)
    }
  }, [expectedTab, forcedTab, tab])

  // 탭 전환 시 탭 영역 최상단으로 스크롤
  const tabContainerRef = useRef(null)
  const pollSectionRef = useRef(null)
  useEffect(() => {
    if (isStudent && !previewMode && tabContainerRef.current) {
      setTimeout(() => {
        tabContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [tab])

  // 기사 단계에서 여론조사 단계로 넘어갈 때는 탭 본문을 접고 여론조사 카드로 직접 이동
  useEffect(() => {
    if (!lockToPoll || previewMode || !pollSectionRef.current) return
    const t = setTimeout(() => {
      pollSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 140)
    return () => clearTimeout(t)
  }, [lockToPoll, previewMode, stepId])

  // 브리핑 단계가 해제되면 확인 상태 초기화 (나중에 다시 브리핑으로 오면 다시 안내)
  useEffect(() => {
    if (!wf.isHighlight('briefing')) {
      setIsCoreBriefingAcknowledged(false)
    }
  }, [wf.currentStep?.highlight])

  // bills/policies 구독은 LegislativeProgressGuide·ExecutiveProgressGuide가 각자 처리

  const myGroupId = (() => {
    if (previewMode) {
      const gids = Object.keys(groups || {})
      return gids.length > 0 ? gids[0] : 'preview_group'
    }
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  })()
  const sessionId = `${effectiveTab}-default`
  const isRoundCollaborative =
    effectiveTab === 'executive' && config?.branchConfig?.executive?.mode === 'collaborative'

  const { TabComponent, ProgressGuide, useCustomTab = true } = currentRound

  return (
    <div className={`min-h-screen ${meta.pageBg}`}>
      <RoomBar />

      <main className="max-w-6xl mx-auto p-4 lg:p-6 space-y-4">
        {!wf.isHighlight('briefing') && <StudentWorkflowProgress tone="slate" />}

        <header className="space-y-2">
          <h1 className={`text-2xl font-bold ${meta.titleText}`}>국정 포털</h1>

          {/* 코어 이슈 배너 (평소 노출) */}
          {coreIssueGroup && (
            <div className="bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                🎯 National Agenda
              </p>
              <h2 className="text-lg font-bold text-amber-900">
                {config?.countryName ? `${config.countryName} 최우선 과제` : '최우선 과제'}: {coreIssueGroup.name}
              </h2>
            </div>
          )}

          {!wf.isHighlight('briefing') && (
            <div className="bg-white border rounded-xl px-3 py-2 text-sm">
              <strong>{currentRound.headline}</strong>{' '}
              <span className="text-gray-500">
                · 활동 끝에 기사 작성 → 교사 승인 → 여론판 게시 → N차 여론조사
              </span>
            </div>
          )}
          
          <DiscussionPrompt tone="slate" question={currentRound.prompt.q} subline={currentRound.prompt.sub} />

          {!lockToArticle && !lockToPoll && !wf.isHighlight('briefing') && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBriefingPanel((v) => !v)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200"
                >
                  📖 5분 브리핑 카드 {showBriefingPanel ? '접기' : '보기'}
                </button>
                <span className="text-xs text-gray-500">
                  차시 시작 5분에 함께 읽어요
                </span>
              </div>
              {showBriefingPanel && <BriefingLibrary defaultKind={effectiveTab} />}
            </>
          )}
        </header>

        {/* [Antigravity] 코어 이슈 다시보기 전용 모달 — 프리미엄 브리핑 스타일 */}
        {wf.isHighlight('briefing') && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto pt-10">
            <div 
              className="relative w-full max-w-2xl animate-in zoom-in-95 duration-300 mb-20"
              onClick={(e) => e.stopPropagation()}
            >
              {coreIssueGroup ? (
                <div className="bg-[#fdfcf0] border-[6px] border-double border-amber-200 rounded-[2.5rem] p-6 lg:p-10 shadow-2xl relative overflow-hidden text-center">
                  {/* 장식용 요소 */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/30 rounded-full -mr-16 -mt-16 border border-amber-200" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-100/30 rounded-full -ml-12 -mb-12 border border-rose-200" />
                  
                  <div className="relative z-10 space-y-6">
                    <header className="space-y-2 border-b-2 border-amber-100 pb-6">
                      <div className="inline-block px-3 py-1 bg-amber-600 text-white text-[10px] font-black rounded-full mb-2 tracking-tighter uppercase">
                        Priority Task Report
                      </div>
                      <h2 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">
                        최우선 과제 보고서
                      </h2>
                      <p className="text-sm text-gray-500 font-medium">
                        {config?.countryName || config?.className || '우리 반'} 국정운영위원회 · 사후 여론조사 1위 선정 의제
                      </p>
                    </header>

                    <div className="py-8 space-y-4">
                      <p className="text-sm text-amber-700 font-bold">시민의 선택으로 결정된 우리의 핵심 과제</p>
                      <div className="inline-block relative">
                        <span className="absolute -inset-2 bg-amber-100/50 blur-lg rounded-full" />
                        <h3 className="relative text-4xl lg:text-5xl font-black text-gray-900 drop-shadow-sm">
                          {coreIssueGroup.name}
                        </h3>
                      </div>
                      {coreIssueGroup.slogan && (
                        <p className="text-lg lg:text-xl text-gray-500 font-serif italic">
                          "{coreIssueGroup.slogan}"
                        </p>
                      )}
                    </div>

                    <div className="bg-white/60 rounded-2xl p-6 border border-amber-100 space-y-4 shadow-inner text-left">
                      <h4 className="text-xs font-black text-amber-900 uppercase flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
                        활동별 통합 운영 안내
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-white rounded-xl border border-indigo-100">
                          <p className="text-[10px] font-bold text-indigo-600 mb-1">🏛️ 입법부 활동</p>
                          <p className="text-xs text-gray-600 leading-relaxed">문제를 해결하기 위한 <br/><strong>새로운 법안</strong>을 만듭니다.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-600 mb-1">🏢 행정부 활동</p>
                          <p className="text-xs text-gray-600 leading-relaxed">법을 실천하기 위한 <br/><strong>예산을 편성</strong>합니다.</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-rose-100">
                          <p className="text-[10px] font-bold text-rose-600 mb-1">⚖️ 사법부 활동</p>
                          <p className="text-xs text-gray-600 leading-relaxed">갈등과 위반에 대한 <br/><strong>공정한 심판</strong>을 내립니다.</p>
                        </div>
                      </div>
                    </div>

                    <footer className="pt-6">
                      <button
                        onClick={() => setIsCoreBriefingAcknowledged(true)}
                        disabled={isCoreBriefingAcknowledged}
                        className={`w-full py-4 font-black rounded-2xl transition-colors shadow-lg ${
                          isCoreBriefingAcknowledged
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-indigo-900 text-white hover:bg-indigo-800'
                        }`}
                      >
                        {isCoreBriefingAcknowledged ? '입장 준비중입니다' : '내용을 확인했습니다'}
                      </button>
                      {isCoreBriefingAcknowledged && (
                        <p className="mt-3 text-xs font-bold text-emerald-700">
                          선생님이 다음 단계로 넘길 때까지 이 화면에서 기다려 주세요.
                        </p>
                      )}
                    </footer>
                  </div>
                  
                  {/* 스탬프 느낌의 장식 */}
                  <div className="absolute bottom-6 right-8 opacity-20 transform rotate-12 pointer-events-none select-none">
                    <div className="border-4 border-rose-600 rounded-full w-24 h-24 flex items-center justify-center text-rose-600 font-black text-xs text-center p-2 leading-tight">
                      APPROVED BY CITIZENS
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border-2 border-dashed">
                  아직 확정된 코어 이슈가 없습니다. Phase 1 여론조사를 완료해 주세요.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 최우선 과제 보고서 단계일 때도 아래 요소를 보여주되, 위에 모달이 뜸 */}
        <div className={wf.isHighlight('briefing') ? 'pointer-events-none opacity-50 grayscale-[0.5]' : ''}>
            {/* 탭 버튼 — ROUNDS 배열에서 동적 생성 */}
            {!lockToArticle && !lockToPoll && (
              <div className="flex gap-1 mb-4 border-b">
                {ROUNDS.map((r) => {
                  // expectedTab(현재 진행 라운드) 기준으로 활성/잠금 판단
                  const isActiveRound = effectiveTab === r.id
                  // 학생은 현재 진행 중인 라운드 탭만 클릭 가능 (비활성화 처리)
                  const isDisabled = isStudent && expectedTab !== null && !isActiveRound

                  return (
                    <button
                      key={r.id}
                      onClick={(e) => {
                        if (isDisabled) { e.preventDefault(); return }
                        setTab(r.id)
                      }}
                      disabled={isDisabled}
                      title={isDisabled ? '지금은 다른 라운드 진행 중이라 잠겨 있어요.' : ''}
                      className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${
                        effectiveTab === r.id
                          ? 'bg-white border-x border-t text-slate-800'
                          : isDisabled
                          ? 'text-gray-300 cursor-not-allowed bg-gray-50 opacity-60'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {isDisabled ? '🔒 ' : ''}{r.label}
                      <span className="ml-2 text-xs text-gray-400">{r.sessions}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* 학생 — 내 역할 카드 (미리보기 모드 포함) */}
            {isStudent && myGroupId && !lockToArticle && !lockToPoll && !isRoundCollaborative && (
              <div className="mb-4">
                <RoleCard sessionId={sessionId} kind={effectiveTab} />
                <button
                  onClick={() => setShowRoleAssigner((v) => !v)}
                  className="mt-2 text-xs text-indigo-600 hover:underline"
                >
                  {showRoleAssigner ? '역할 배정 닫기' : '🎭 모둠 4역할 배정/변경'}
                </button>
                {showRoleAssigner && (
                  <div className="mt-2">
                    <RoleAssigner
                      groupId={myGroupId}
                      sessionId={sessionId}
                      kind={effectiveTab}
                      onClose={() => setShowRoleAssigner(false)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 탭 컨텐츠 — ROUNDS 설정에서 동적으로 TabComponent / ProgressGuide 렌더링 */}
            {!lockToArticle && !lockToPoll && (
              <div className="space-y-4" ref={tabContainerRef}>
                {/* 진행 단계 상태바 — 학생용 가이드 포함 (미리보기 시에는 교사용 버튼 숨김) */}
                {ProgressGuide && <ProgressGuide role={previewMode ? 'student' : role} />}

                {/* 라운드 본문:
                    useCustomTab: true  → 기존 커스텀 탭 (LegislativeTab 등) 사용
                    useCustomTab: false → RoundTabShell에 config 주입 */}
                {useCustomTab ? (
                  <TabComponent previewMode={previewMode} />
                ) : (
                  <RoundTabShell
                    kind={currentRound.id}
                    sessionId={currentRound.sessionId || `${currentRound.id}-default`}
                    color={currentRound.color}
                    submissionLabel={currentRound.submissionLabel}
                    offlineLabel={currentRound.offlineLabel}
                    dataPath={currentRound.dataPath}
                    SubmissionForm={currentRound.SubmissionForm}
                    ResultDisplay={currentRound.ResultDisplay}
                    teacherNote={currentRound.teacherNote}
                    previewMode={previewMode}
                  />
                )}
              </div>
            )}

            {/* 평가단 패널 — 시민단체·기사단으로 배치된 학생에게만 표시 (EvaluatorPanel 내부 자체 필터링) */}
            {!lockToArticle && !lockToPoll && <EvaluatorPanel />}

            {/* 기사 작성 — 여론조사 단계에서는 블러 카드로 남기지 않고 완전히 접음 */}
            {!lockToPoll && (
              <HighlightBox active={wf.isHighlight('article')} anyHighlight={anyHL} previewMode={previewMode}>
                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-blue-800 mb-3">📰 기사 작성</h2>
                  <p className="text-sm text-gray-500 mb-3">
                    이번 라운드 결과를 기사로 정리해 여론판에 게시하세요.
                  </p>
                  {lockToArticle && <PhaseActivitySummary phase={3} tab={effectiveTab} />}
                  <ArticleSection />
                </section>
              </HighlightBox>
            )}

            {/* 여론조사 단계 — 라운드별 활동 요약 */}
            {lockToPoll && (
              <section ref={pollSectionRef} className="bg-white border-2 border-sky-200 rounded-2xl p-4 space-y-3 scroll-mt-6">
                <div>
                  <h2 className="text-lg font-bold text-sky-900">📊 {wf.currentStep?.studentLabel || '여론조사'}</h2>
                  <p className="text-sm text-sky-700 mt-1">
                    지금은 선생님이 연 여론조사에 참여하는 단계입니다. 이전 기관 활동 화면은 잠시 접어 두고, 아래 여론조사를 확인하세요.
                  </p>
                </div>
                <PollFeed plannedOnly={true} />
              </section>
            )}



            {/* 학생용 자동 모달 */}
            {!lockToArticle && !lockToPoll && <BriefingAutoModal kind={effectiveTab} />}

            {!lockToArticle && !lockToPoll && (
              <HighlightBox active={wf.isHighlight('poll')} anyHighlight={anyHL} previewMode={previewMode}>
                <div className="mt-4">
                  <PollFeed plannedOnly={true} />
                </div>
              </HighlightBox>
            )}
        </div>
      </main>
      <SessionFinishButton />
    </div>
  )
}

export default Phase3Page
