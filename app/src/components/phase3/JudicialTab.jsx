import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt, pushUnder } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import CommentList from '../phase1/CommentList'
import VerdictTemplate from '../scaffolding/VerdictTemplate'
import RoleWorkspace from '../scaffolding/RoleWorkspace'
import RoleAssigner from '../scaffolding/RoleAssigner'
import GroupRoleSummary from '../scaffolding/GroupRoleSummary'
import BranchUnitBanner from './BranchUnitBanner'
import BranchUnitWorkspace from './BranchUnitWorkspace'
import ResearchWorkspace from '../research/ResearchWorkspace'
import JudicialCaseRoom from './JudicialCaseRoom'
import JudicialCaseRoomButton from './JudicialCaseRoomButton'
import ArticleSection from '../news/ArticleSection'
import PollFeed from '../shared/PollFeed'
import StanceComments from '../phase2/StanceComments'
import JudicialVerdictTab from './JudicialVerdictTab'
import { getStudentJudicialSide } from '../../lib/judicial-teams'

const SESSION_ID = 'judicial-default'

/**
 * JudicialTab — 학생용 사법부 탭 (v3.2 — 7단계 흐름)
 *
 * 워크플로 step → knownStage:
 *  judicial-prep       (0) ① 준비 — 사건 확인 + 팀 배정 + 역할 선택 (자동 스크롤)
 *  judicial-research   (1) ② 자료 조사 — ResearchWorkspace
 *  judicial-draft      (2) ③ 논고초안 — 역할별 미션(출처 링크 포함) + 섹션 초안(불러오기) + 대표 최종 제출
 *  judicial-discussion (3) ④ 온라인 토의 — 제출된 논고 모음 + 평가 토의(찬성·반대·질문)
 *  judicial-trial      (4) ⑤ 국민참여재판 — 준비(자리·논고)/진행(토론도구·기록)/정리(평결·판결문)
 *  article3            (5) ⑥ 기사 작성 — ArticleSection
 *  poll4               (6) ⑦ 사후 여론조사 — PollFeed
 */
// 사법부 탭 — workMode에 따라 판결중심/역할중심 분기 (래퍼는 훅 1개만 호출해 훅 순서 안전)
function JudicialTab({ previewMode = false }) {
  const judicialWorkMode = useGameStore((s) => s.config?.branchConfig?.judicial?.workMode) || 'role'
  if (judicialWorkMode === 'verdict') return <JudicialVerdictTab previewMode={previewMode} />
  return <JudicialRoleTab previewMode={previewMode} />
}

// 역할중심(증거논고) 모드 — 학생이 직접 논고·변론·심문하며 재판 진행 (기존 7단계 흐름)
function JudicialRoleTab({ previewMode = false }) {
  const role        = useGameStore((s) => s.role)
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups      = useGameStore((s) => s.groups)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)

  // 사법부 전체 부서 단위 (학급 설정에서 배정)
  const judUnits = [
    ...(branchConfig?.judicial?.prosecution || []).map((u) => ({ ...u, _side: 'prosecution' })),
    ...(branchConfig?.judicial?.defense     || []).map((u) => ({ ...u, _side: 'defense'     })),
    ...(branchConfig?.judicial?.witness     || []).map((u) => ({ ...u, _side: 'witness'     })),
    ...(branchConfig?.judicial?.jury        || []).map((u) => ({ ...u, _side: 'jury'        })),
    ...(branchConfig?.judicial?.judge       || []).map((u) => ({ ...u, _side: 'judge'       })),
    ...(branchConfig?.judicial?.press       || []).map((u) => ({ ...u, _side: 'press'       })),
  ]

  // 재판 연동 ID — branchConfig 우선, 미설정 시 고정 fallback
  const judicialCaseId = branchConfig?.judicial?.activeCaseId || 'judicial-default'

  // ─── 워크플로 기반 단계 게이팅 ─────────────────────────────────────────
  const wf = useWorkflow()
  const stepId = wf.currentStep?.id

  // v3.2 7단계 stepId → stage 매핑
  const STAGE_OF_STEP = {
    core: 0,
    // 7단계 정식
    'judicial-prep':       0,
    'judicial-research':   1,
    'judicial-draft':      2,
    'judicial-discussion': 3,
    'judicial-trial':      4,
    article3:              5,
    poll4:                 6,
    // 구버전 호환
    'judicial-statement':    2,
    'judicial-poll':         3,
    'judicial-debate-prep':  4,
    'judicial-verdict':      4,
    'judicial-article':      5,
    'judicial-evidence':     2,
    'judicial-witness':      4,
    'judicial-debate':       4,
  }
  const knownStage = STAGE_OF_STEP[stepId]
  const isKnown    = knownStage !== undefined
  // 교사 미리보기 또는 알 수 없는 단계 → 모든 섹션 active
  const showAll = previewMode || !isKnown

  // 섹션 상태: 'active' / 'past'(블러) / 'hidden'
  const modeFor = (stages) => {
    if (showAll) return 'active'
    if (stages.includes(knownStage)) return 'active'
    if (stages.every((s) => s < knownStage)) return 'past'
    return 'hidden'
  }
  const prepMode       = modeFor([0])
  const researchMode   = modeFor([1])
  const draftMode      = modeFor([2])
  const discussionMode = modeFor([3])
  const trialMode      = modeFor([4])
  const articleMode    = modeFor([5])
  const pollMode       = modeFor([6])

  // 단계 전환 시 활성 섹션으로 자동 스크롤
  const prepRef       = useRef(null)
  const researchRef   = useRef(null)
  const draftRef      = useRef(null)
  const discussionRef = useRef(null)
  const trialRef      = useRef(null)
  const articleRef    = useRef(null)
  const pollRef       = useRef(null)

  useEffect(() => {
    if (previewMode || !isKnown) return
    const refMap = [prepRef, researchRef, draftRef, discussionRef, trialRef, articleRef, pollRef]
    const target = refMap[knownStage]?.current
    if (!target) return
    const t = setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => clearTimeout(t)
  }, [stepId, previewMode, isKnown, knownStage])

  const pastClass   = 'opacity-50 pointer-events-none select-none [filter:blur(1.8px)_grayscale(40%)]'
  const sectionWrap = (mode) => `transition-all duration-300 ${mode === 'past' ? pastClass : ''}`

  // ─── Firebase 구독 ──────────────────────────────────────────────────────
  const [verdicts,  setVerdicts]  = useState({})
  const [juryVotes, setJuryVotes] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'verdicts', (d) => setVerdicts(d || {}))
    return () => u?.()
  }, [roomCode])

  useEffect(() => {
    if (!roomCode || !judicialCaseId) return
    const u = subscribe(roomCode, `juryVotes/${judicialCaseId}`, (d) => setJuryVotes(d || {}))
    return () => u?.()
  }, [roomCode, judicialCaseId])

  // ─── 내 모둠 정보 ───────────────────────────────────────────────────────
  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups)) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // 내가 어느 팀(검사/변호/증인/배심원/판사/기자)에 속하는지 — 모둠별/개인별 배정 모두 반영
  const myJudicialSide = useMemo(
    () => getStudentJudicialSide(myStudentId, branchConfig?.judicial, groups),
    [branchConfig, groups, myStudentId],
  )

  // ─── 평결 데이터 ─────────────────────────────────────────────────────────
  const verdict   = verdicts[judicialCaseId] || null
  const myJuryVote = myStudentId ? juryVotes[myStudentId]?.choice : null
  const guilty    = Object.values(juryVotes).filter((v) => v?.choice === 'guilty').length
  const notGuilty = Object.values(juryVotes).filter((v) => v?.choice === 'notGuilty').length

  const onVote = async (choice) => {
    if (!myStudentId || !judicialCaseId) return
    await setAt(roomCode, `juryVotes/${judicialCaseId}/${myStudentId}`, {
      choice, groupId: myGroupId, at: Date.now(),
    })
  }

  const verdictDecision = guilty > notGuilty ? 'guilty' : 'notGuilty'

  // ─── 6단계 렌더 ──────────────────────────────────────────────────────────
  // 팀별 SIDE_META (배지·색상)
  const SIDE_META = {
    prosecution: { label: '👨‍💼 검사팀',   color: 'border-red-200 bg-red-50',     header: 'bg-red-100',    text: 'text-red-800'   },
    defense:     { label: '🛡️ 변호팀',    color: 'border-sky-200 bg-sky-50',     header: 'bg-sky-100',    text: 'text-sky-800'   },
    witness:     { label: '👤 증인 모둠',  color: 'border-amber-200 bg-amber-50', header: 'bg-amber-100',  text: 'text-amber-800' },
    jury:        { label: '🙋 배심원 모둠',color: 'border-violet-200 bg-violet-50',header:'bg-violet-100', text: 'text-violet-800'},
    judge:       { label: '⚖️ 판사 모둠',  color: 'border-slate-200 bg-slate-50', header: 'bg-slate-100',  text: 'text-slate-800' },
    press:       { label: '📰 기자 모둠',  color: 'border-emerald-200 bg-emerald-50',header:'bg-emerald-100',text:'text-emerald-800'},
  }

  return (
    <div className="space-y-4">

      {/* ════════ ① 준비 (사건 확인 + 역할 선택) ════════ */}
      {prepMode !== 'hidden' && (
        <div ref={prepRef} className={sectionWrap(prepMode)}>
          <div className="bg-white rounded-xl border border-rose-200 px-4 py-3 mb-3">
            <h2 className="text-base font-bold text-rose-800">⚖️ ① 준비 — 사건 확인 + 역할 선택</h2>
            <p className="text-xs text-rose-600 mt-0.5">
              왼쪽 <b>사건 자료실</b>에서 사건의 배경·내용·증거를 읽고, 오른쪽 <b>역할 선택</b>에서 모둠 내 역할을 미리 정합니다.
              모둠 역할 정리는 다음 ③ 논고초안 단계에서 볼 수 있어요.
            </p>
          </div>

          {/* 좌: 사건 자료실 / 우: 역할 선택 — 2:1 그리드 (반응형) */}
          <div className="grid lg:grid-cols-[3fr_2fr] gap-3 mb-3">
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-4">
              <p className="text-xs font-bold text-rose-700 mb-2">📖 사건 자료실</p>
              <JudicialCaseRoom currentStage={1} />
            </div>

            {!previewMode && role === 'student' && myGroupId ? (
              <aside className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-4 space-y-3 self-start">
                <h3 className="text-sm font-bold text-slate-800">🎭 모둠내 역할 배정</h3>
                {!myJudicialSide ? (
                  <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-3">
                    <p className="text-xs font-bold text-amber-800 mb-1">⚠️ 아직 팀이 배정되지 않았어요</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      선생님이 <strong>학급 설정 → 사법부</strong>에서 모둠을 팀으로 배정한 뒤 역할 선택이 가능합니다.
                    </p>
                  </div>
                ) : (
                  <RoleAssigner groupId={myGroupId} sessionId={SESSION_ID} kind="judicial" filterSide={myJudicialSide} />
                )}
              </aside>
            ) : (
              <aside className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-xs text-slate-500 self-start">
                🎭 학생 화면에서는 여기에 역할 선택 카드가 표시됩니다.
              </aside>
            )}
          </div>

          {/* 팀 배치 현황 — 작게 하단에 */}
          <BranchUnitBanner branch="judicial" />
        </div>
      )}

      {/* ════════ ② 자료 조사 ════════ */}
      {researchMode !== 'hidden' && (() => {
        // 팀별 자료 조사 가이드 — 역할(팀)에 따라 다른 안내 + 추천 카드 목록
        const JUDICIAL_RESEARCH_HINTS = {
          prosecution: {
            description: '👨‍💼 검사팀은 피고인의 혐의를 입증할 자료를 찾습니다. 위반된 법률 조항, 비슷한 유죄 판결 사례, 피해 사실을 뒷받침할 기사·통계 등을 모아 주세요. 출처(국가법령정보센터, 대법원 판례, 신뢰할 만한 언론)를 꼭 기록합니다.',
            targets: ['위반된 법률 조항', '비슷한 유죄 판결 사례', '피해 사실 입증 기사·통계', '관련 사건 보도'],
          },
          defense: {
            description: '🛡️ 변호팀은 피고인을 변호할 자료를 찾습니다. 정상참작 사유, 무죄 가능성을 뒷받침할 사례, 피고인의 사정을 알 수 있는 자료 등을 균형 있게 모아 주세요.',
            targets: ['정상참작 사유 사례', '무죄·감형 판결 사례', '피고인의 배경·사정 자료', '검사 측 주장에 반박할 근거'],
          },
          witness: {
            description: '👤 증인 모둠은 증인 캐릭터의 입장에서 그 사람이 알 만한 사실·경험을 자료로 정리합니다. 사건 당시 정황, 증인의 배경 지식, 비슷한 상황에서의 일반적인 반응 등을 조사해 주세요.',
            targets: ['사건 당시 정황 자료', '증인의 배경 지식', '비슷한 상황의 일반적 반응', '증인 진술 신뢰성 자료'],
          },
          jury: {
            description: '🙋 배심원 모둠은 양쪽 주장을 객관적으로 비교할 수 있는 사실 정보를 모읍니다. 통계, 사회적 영향, 비슷한 사건의 일반적인 판단 기준 등이 도움이 됩니다.',
            targets: ['관련 사건 통계', '사회적 영향·반향', '일반적 판단 기준', '시민 의식 조사'],
          },
          judge: {
            description: '⚖️ 판사 모둠은 일관성 있는 판결을 위해 비슷한 판례, 양형 기준, 적용 법률 조항을 조사합니다. 국가법령정보센터·대법원 판례 검색을 참고하면 좋아요.',
            targets: ['적용 법률 조항', '비슷한 사건 판례', '양형 기준', '법원 판결 보도'],
          },
          press: {
            description: '📰 기자 모둠은 사건의 사회적 배경, 시민이 알아야 할 정보를 균형 있게 모읍니다. 양측 입장 모두 다룰 수 있도록 다양한 관점의 자료를 수집하세요.',
            targets: ['사건의 사회적 배경', '비슷한 사건 보도', '시민·전문가 인터뷰', '관련 통계·여론조사'],
          },
        }
        const hint = (myJudicialSide && JUDICIAL_RESEARCH_HINTS[myJudicialSide]) || null
        const description = hint?.description
          || '먼저 ① 준비 단계에서 팀 배정과 역할을 확인한 뒤, 사건과 관련된 판례·법조항·뉴스·통계를 팀별로 모아 주세요.'
        const defaultTargets = hint?.targets
          || ['과거의 비슷한 판결', '법률 위반 증거 기사', '피해자의 진술', '피고인의 변론 자료']
        return (
          <div ref={researchRef} className={sectionWrap(researchMode)}>
            <div className="bg-white rounded-xl border border-blue-200 px-4 py-3 mb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-blue-800">🔍 ② 자료 조사</h2>
                  <p className="text-xs text-blue-600 mt-0.5">
                    사건과 관련된 <b>판례·법조항·뉴스·통계</b> 등을 팀별로 모아 주세요. 다음 단계 온라인 토의·재판에서 근거 자료로 활용됩니다.
                  </p>
                </div>
                <JudicialCaseRoomButton currentStage={2} />
              </div>
            </div>
            {!previewMode && role === 'student' && myGroupId && (
              <ResearchWorkspace
                contextKey="phase3_judicial"
                groupId={myGroupId}
                title="재판 근거 자료실"
                description={description}
                defaultTargets={defaultTargets}
                accent="blue"
              />
            )}
          </div>
        )
      })()}

      {/* ════════ ③ 논고초안 작성 (역할 미션 + 섹션 초안 + 대표 최종 제출) ════════ */}
      {draftMode !== 'hidden' && (
        <div ref={draftRef} className={sectionWrap(draftMode)}>
          <div className="bg-white rounded-xl border border-slate-300 px-4 py-3 mb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800">📝 ③ 논고초안 작성</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  <b>1)</b> 각 역할별로 <b>3가지 미션</b>을 작성하세요(출처 링크 함께). <b>2)</b> 섹션 초안에서 <b>[내 미션 불러오기]</b>로 자동 채워 다듬고 저장. <b>3)</b> 대표가 모든 섹션 초안을 보고 <b>최종 변론서/논고서</b>로 편집해 제출합니다.
                </p>
              </div>
              <JudicialCaseRoomButton currentStage={3} />
            </div>
          </div>

          {/* 1) 좌: 역할별 3가지 미션 / 우: 우리 모둠 역할 현황 */}
          {!previewMode && role === 'student' && myGroupId && myJudicialSide && (
            <div className="grid lg:grid-cols-[3fr_2fr] gap-3 mb-3">
              <section className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-indigo-900 mb-3">✍️ 내 역할의 3가지 미션</h3>
                <RoleWorkspace groupId={myGroupId} sessionId={SESSION_ID} kind="judicial" filterSide={myJudicialSide} />
              </section>
              <aside className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-800">🎭 우리 모둠 역할 정리</h3>
                <GroupRoleSummary groupId={myGroupId} sessionId={SESSION_ID} kind="judicial" filterSide={myJudicialSide} />
              </aside>
            </div>
          )}

          {/* 2) 부서 단위 — 섹션 초안 + 대표 최종 제출 (내 팀만 노출, 교사는 전체) */}
          {!previewMode && judUnits.length > 0 && (
            <div className="space-y-3">
              {judUnits
                .filter((unit) => role === 'teacher' || !myJudicialSide || unit._side === myJudicialSide)
                .map((unit) => {
                  const meta = SIDE_META[unit._side] || SIDE_META.defense
                  return (
                    <div key={unit.unitId} className={`border-2 rounded-2xl overflow-hidden ${meta.color}`}>
                      <div className={`px-4 py-2 ${meta.header}`}>
                        <span className={`text-sm font-bold ${meta.text}`}>
                          {meta.label} — {groups?.[unit.groupId]?.name || unit.groupId}
                        </span>
                      </div>
                      <div className="p-4">
                        <BranchUnitWorkspace
                          unitId={unit.unitId}
                          branch="judicial"
                          onPublish={async (content) => {
                            if (!roomCode || !judicialCaseId) return
                            await pushUnder(roomCode, `verdicts/${judicialCaseId}`, {
                              side: unit._side,
                              groupId: unit.groupId,
                              authorStudentId: unit.representativeStudentId,
                              content,
                              branchUnitId: unit.unitId,
                              submittedAt: Date.now(),
                              kind: 'draft',
                            })
                          }}
                        >
                          <VerdictTemplate caseId={judicialCaseId} groupId={unit.groupId} />
                        </BranchUnitWorkspace>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ════════ ④ 온라인 토의 (제출된 논고 모음 + 학급 평가) ════════ */}
      {discussionMode !== 'hidden' && (
        <div ref={discussionRef} className={sectionWrap(discussionMode)}>
          <div className="bg-white rounded-xl border border-violet-200 px-4 py-3 mb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-violet-800">💬 ④ 온라인 토의</h2>
                <p className="text-xs text-violet-600 mt-0.5">
                  <b>다른 모둠 친구들</b>이 제출한 논고초안을 펼쳐 읽고, <b>찬성·반대·질문</b>으로 분류해 의견을 남겨 평가 토의에 참여합니다.
                  좋아요가 많이 달린 의견은 재판에서 중요하게 다뤄집니다.
                </p>
              </div>
              <JudicialCaseRoomButton currentStage={4} />
            </div>
          </div>

          {/* 제출된 논고초안 모음 (전체 학급 열람) */}
          {verdict && Object.values(verdict).filter((v) => v?.kind === 'draft' || !v?.decision).length > 0 ? (
            <section className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-3">
              <h3 className="font-bold text-amber-800 text-base mb-2">📚 제출된 논고초안 모음</h3>
              <p className="text-xs text-amber-700 mb-3">각 카드를 클릭해 펼치면 해당 팀의 논고/변론서를 자세히 볼 수 있어요.</p>
              <div className="space-y-3">
                {Object.entries(verdict)
                  .filter(([, v]) => v?.kind === 'draft' || !v?.decision)
                  .sort((a, b) => (b[1].submittedAt || 0) - (a[1].submittedAt || 0))
                  .map(([vid, v]) => {
                    const meta = SIDE_META[v.side] || SIDE_META.defense
                    return (
                      <details key={vid} className={`border-2 rounded-xl overflow-hidden ${meta.color}`}>
                        <summary className={`cursor-pointer px-3 py-2 ${meta.header} flex items-center gap-2 select-none`}>
                          <span className={`text-sm font-bold ${meta.text}`}>
                            {meta.label} — {groups?.[v.groupId]?.name || v.groupId}
                          </span>
                          <span className="text-[10px] text-gray-500 ml-auto">제출됨</span>
                        </summary>
                        <div className="p-3 bg-white">
                          {typeof v.content === 'string' ? (
                            <p className="text-sm whitespace-pre-wrap text-gray-800">{v.content}</p>
                          ) : v.content && typeof v.content === 'object' ? (
                            <div className="space-y-2">
                              {Object.entries(v.content).map(([k, val]) => (
                                <div key={k}>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{k}</p>
                                  <p className="text-sm whitespace-pre-wrap text-gray-800">{String(val || '')}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">내용 없음</p>
                          )}
                        </div>
                      </details>
                    )
                  })}
              </div>
            </section>
          ) : (
            <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl p-4 mb-3 text-center text-sm text-amber-700">
              ⏳ 아직 제출된 논고초안이 없습니다. ③ 논고초안 작성 단계에서 팀 대표가 제출하면 여기에 나타납니다.
            </div>
          )}

          {/* 학급 평가 토의 — 찬성/반대/질문 */}
          <section className="bg-white rounded-2xl shadow-sm border-2 border-violet-200 p-4">
            <h3 className="font-bold text-violet-800 text-base mb-2">🗣️ 평가 토의</h3>
            <StanceComments targetType="judicialDiscussion" targetId={judicialCaseId} />
          </section>
        </div>
      )}

      {/* ════════ ④ 국민참여재판 — 준비/진행/정리 3단계 ════════ */}
      {trialMode !== 'hidden' && (
        <div ref={trialRef} className={sectionWrap(trialMode)}>
          <div className="bg-white rounded-xl border border-rose-200 px-4 py-3 mb-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-base font-bold text-rose-800">⚖️ ④ 국민참여재판</h2>
              <JudicialCaseRoomButton currentStage={5} />
            </div>
            <p className="text-xs text-rose-600 mt-0.5">
              <b>온라인 토의</b>에서 제출한 논고초안을 바탕으로 실제 재판을 진행합니다.
              <b>A) 재판 준비</b> → <b>B) 재판 진행</b> → <b>C) 재판 정리(평결·판결)</b> 순서로 진행됩니다.
            </p>
          </div>

          {/* A) 재판 준비 — 시작 전 안내 */}
          <section className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-3">
            <h3 className="font-bold text-amber-900 text-sm mb-2">🪑 A) 재판 준비</h3>
            <ul className="space-y-1.5 text-xs text-amber-900 leading-relaxed">
              <li>• 자리 배치: <b>판사(중앙)</b> · <b>검사(왼쪽)</b> · <b>변호인(오른쪽)</b> · <b>증인석(앞)</b> · <b>배심원(뒷줄 또는 옆줄)</b> · <b>기자(객석)</b></li>
              <li>• 각 팀이 제출한 <b>논고초안</b>을 손 닿는 곳에 펼쳐 두기</li>
              <li>• 발언 순서 확인: 모두진술 → 증거조사 → 증인·피고인 심문 → 최종변론 → 배심원 평의 → 판사 선고</li>
              <li>• 교사가 <b>🎙️ 모의재판 시작</b>을 누르면 토론 도구(타이머·발언 평가 등)가 자동으로 열립니다.</li>
            </ul>
          </section>

          {/* B) 재판 진행 — 토론도구 + 보조 기록 */}
          <section className="bg-white rounded-2xl shadow-sm border-2 border-violet-200 p-4 mb-3">
            <h3 className="font-bold text-violet-800 text-sm mb-2">🎤 B) 재판 진행 (토론도구 + 진행 기록)</h3>
            <p className="text-xs text-gray-500 mb-3">
              교사 화면의 토론 도구로 발언·평가·타이머가 진행됩니다. 중요한 발언이나 메모는 아래 댓글창에 남겨 학급이 함께 보는 기록을 만드세요.
            </p>
            <CommentList targetType="trial" targetId={judicialCaseId} />
          </section>

          {/* C) 재판 정리 — 배심원 평결 + 판사 판결문 */}
          <section className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm px-1">📜 C) 재판 정리 — 평결과 선고</h3>
            <div className="grid lg:grid-cols-2 gap-4">
              {/* 배심원 평결 */}
              <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
                <h4 className="font-bold text-slate-800">🙋 배심원 평결</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-rose-700">유죄 {guilty}표</span>
                  <span className="text-emerald-700">무죄 {notGuilty}표</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                  <div className="bg-rose-500 transition-all" style={{ width: guilty + notGuilty ? `${(guilty / (guilty + notGuilty)) * 100}%` : '0%' }} />
                  <div className="bg-emerald-500 transition-all" style={{ width: guilty + notGuilty ? `${(notGuilty / (guilty + notGuilty)) * 100}%` : '0%' }} />
                </div>
                {role === 'student' && myJudicialSide === 'jury' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onVote('guilty')}
                      className={`flex-1 py-2 text-sm rounded-lg font-semibold ${myJuryVote === 'guilty' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'}`}
                    >유죄</button>
                    <button
                      onClick={() => onVote('notGuilty')}
                      className={`flex-1 py-2 text-sm rounded-lg font-semibold ${myJuryVote === 'notGuilty' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                    >무죄</button>
                  </div>
                )}
                {role === 'student' && myJudicialSide && myJudicialSide !== 'jury' && (
                  <p className="text-[11px] text-gray-400 bg-gray-50 p-2 rounded-lg">배심원 평결은 🙋 배심원 모둠만 참여합니다.</p>
                )}
              </div>

              {/* 판사 판결문 — 가장 최신 공식 판결문 1건만 노출 (다른 모둠/이전 버전 숨김) */}
              <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">
                <h4 className="font-bold text-slate-800">📜 판사 판결문</h4>
                {(() => {
                  const officialVerdicts = verdict
                    ? Object.entries(verdict).filter(([, v]) => v?.decision)
                    : []
                  if (officialVerdicts.length > 0) {
                    // 가장 최신 1건만 (submittedAt 또는 createdAt 기준)
                    const [vid, v] = officialVerdicts.sort(
                      (a, b) => (b[1].submittedAt || b[1].createdAt || 0) - (a[1].submittedAt || a[1].createdAt || 0),
                    )[0]
                    return (
                      <div key={vid} className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-sm font-semibold">{v.decision === 'guilty' ? '⚖️ 유죄' : '🕊️ 무죄'}</p>
                        <p className="text-sm whitespace-pre-wrap mt-1">{v.body}</p>
                        {v.sentence && <p className="text-xs text-gray-500 mt-2">선고: {v.sentence}</p>}
                      </div>
                    )
                  }
                  if (!previewMode && role === 'student') {
                    return myJudicialSide === 'judge' ? (
                      <VerdictTemplate caseId={judicialCaseId} groupId={myGroupId} decision={verdictDecision} />
                    ) : (
                      <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
                        판결문은 ⚖️ 판사 모둠이 작성합니다.
                      </p>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ════════ ⑤ 기사 작성 (article3 흡수) ════════ */}
      {articleMode !== 'hidden' && (
        <div ref={articleRef} className={sectionWrap(articleMode)}>
          <div className="bg-white rounded-xl border border-emerald-200 px-4 py-3 mb-3">
            <h2 className="text-base font-bold text-emerald-800">📰 ⑤ 기사 작성</h2>
            <p className="text-xs text-emerald-600 mt-0.5">
              <b>기자 모둠</b>은 재판 보도 기사를, 다른 모둠도 자유롭게 의견 기사를 작성할 수 있습니다.
              교사 승인 후 여론판에 게시됩니다.
            </p>
          </div>
          <ArticleSection />
        </div>
      )}

      {/* ════════ ⑥ 사후 여론조사 (poll4 흡수) ════════ */}
      {pollMode !== 'hidden' && (
        <div ref={pollRef} className={sectionWrap(pollMode)}>
          <div className="bg-white rounded-xl border border-indigo-200 px-4 py-3 mb-3">
            <h2 className="text-base font-bold text-indigo-800">📊 ⑥ 사후 여론조사</h2>
            <p className="text-xs text-indigo-600 mt-0.5">
              판결 결과에 대해 어떻게 생각하나요? 시민의 한 사람으로서 의견을 응답해 주세요.
            </p>
          </div>
          <PollFeed plannedOnly={true} />
        </div>
      )}
    </div>
  )
}

export default JudicialTab
