import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import CommentList from '../phase1/CommentList'
import VerdictTemplate from '../scaffolding/VerdictTemplate'
import JudicialCaseRoom from './JudicialCaseRoom'
import JudicialActivityMemo from './JudicialActivityMemo'
import BranchUnitBanner from './BranchUnitBanner'
import ArticleSection from '../news/ArticleSection'
import PollFeed from '../shared/PollFeed'
import { getJudicialAssignmentSummary, getStudentJudicialSide } from '../../lib/judicial-teams'
import JudicialCaseRoomButton from './JudicialCaseRoomButton'
import { EVAL_AXES } from '../debate/tools/SpeechEval'

// 연기 3팀이 화면에서 보는 자기 대사(speaker) 매핑.
// 판결중심에서는 판사·검사·변호사 3팀만 연기하므로, 증인·피고인 대사는 양측에 나눠 배정한다.
const SCRIPT_SPEAKERS_BY_SIDE = {
  judge:       ['judge'],
  prosecution: ['prosecution', 'witness'],
  defense:     ['defense', 'defendant'],
}
const SPEAKER_LABEL = {
  judge: '⚖️ 판사', prosecution: '👨‍💼 검사', defense: '🛡️ 변호인', witness: '👤 증인', defendant: '🙍 피고인',
}
const ACTING_META = {
  judge:       { label: '⚖️ 판사팀',   color: 'border-slate-300 bg-slate-50',  text: 'text-slate-800' },
  prosecution: { label: '👨‍💼 검사팀',  color: 'border-red-200 bg-red-50',      text: 'text-red-800'   },
  defense:     { label: '🛡️ 변호사팀', color: 'border-sky-200 bg-sky-50',      text: 'text-sky-800'   },
}

/**
 * JudicialVerdictTab — 학생용 사법부 '판결중심(시나리오)' 모드 탭 (전원 판사).
 *
 * 워크플로 step → stage:
 *   verdict-prep       (0) ① 준비 — 사건 개요 파악 + 팀 배정 확인
 *   verdict-issues     (1) ② 쟁점 파악 — 모둠별 쟁점 메모
 *   verdict-trial      (2) ③ 재판하기 — 연기 3팀 대본 연기 + 토론도구에서 판결문 작성·게시
 *   verdict-discussion (3) ④ 판결문 토의 — 게시된 판결문별 평가·댓글·답변
 *   article3           (5) ⑥ 기사 작성
 *   poll4              (6) ⑦ 여론조사
 */
function JudicialVerdictTab({ previewMode = false }) {
  const role        = useGameStore((s) => s.role)
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups      = useGameStore((s) => s.groups)
  const students    = useGameStore((s) => s.students)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)

  const activeCase     = branchConfig?.judicial?.activeCase || null
  const judicialCaseId = activeCase?.id || branchConfig?.judicial?.activeCaseId || 'judicial-default'
  const trialScript = useMemo(
    () => Array.isArray(activeCase?.trialScript) ? activeCase.trialScript : [],
    [activeCase],
  )
  const assignmentSummary = useMemo(
    () => getJudicialAssignmentSummary(branchConfig?.judicial, groups, students, ['judge', 'prosecution', 'defense']),
    [branchConfig, groups, students],
  )

  // ─── 워크플로 단계 게이팅 ──────────────────────────────────────────────
  const wf = useWorkflow()
  const stepId = wf.currentStep?.id
  const STAGE_OF_STEP = {
    core: 0,
    'verdict-prep':       0,
    'verdict-issues':     1,
    'verdict-trial':      2,
    'verdict-discussion': 3,
    article3:             4,
    poll4:                5,
  }
  const knownStage = STAGE_OF_STEP[stepId]
  const isKnown    = knownStage !== undefined
  const showAll    = previewMode || !isKnown

  const modeFor = (stages) => {
    if (showAll) return 'active'
    if (stages.includes(knownStage)) return 'active'
    if (stages.every((s) => s < knownStage)) return 'past'
    return 'hidden'
  }
  const prepMode       = modeFor([0])
  const issuesMode     = modeFor([1])
  const trialMode      = modeFor([2])
  const discussionMode = modeFor([3])
  const articleMode    = modeFor([4])
  const pollMode       = modeFor([5])

  const prepRef       = useRef(null)
  const issuesRef     = useRef(null)
  const trialRef      = useRef(null)
  const writingRef    = useRef(null)
  const discussionRef = useRef(null)
  const articleRef    = useRef(null)
  const pollRef       = useRef(null)

  useEffect(() => {
    if (previewMode || !isKnown) return
    const refMap = {
      0: prepRef,
      1: issuesRef,
      2: trialRef,
      3: discussionRef,
      4: articleRef,
      5: pollRef,
    }
    const target = refMap[knownStage]?.current
    if (!target) return
    const t = setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => clearTimeout(t)
  }, [stepId, previewMode, isKnown, knownStage])

  const pastClass   = 'opacity-50 pointer-events-none select-none [filter:blur(1.8px)_grayscale(40%)]'
  const sectionWrap = (mode) => `transition-all duration-300 ${mode === 'past' ? pastClass : ''}`

  // ─── Firebase 구독 ─────────────────────────────────────────────────────
  const [verdicts, setVerdicts] = useState({})
  const [debateSessions, setDebateSessions] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'debateSessions', (d) => setDebateSessions(d || {}))
    return () => u?.()
  }, [roomCode])

  // 활성 재판 토론 세션
  const trialDebate = Object.entries(debateSessions)
    .map(([id, s]) => s ? { ...s, id } : null)
    .find((s) => s?.isActive && s?.type === 'trial') || null

  // 판결문 작성 페이지: 토론도구를 띄우면 도구 안(VerdictTrialDraftPanel)에서 작성하고,
  // 토론도구를 안 띄우면 재판하기(stage 2) 단계에서 이 탭의 작성 페이지를 쓴다.
  const writingMode = trialDebate ? 'hidden' : modeFor([2])

  // 기사 단계용 — 종료됐어도 가장 최근 재판 세션(평가 기록 회수용)
  const latestTrialSession = useMemo(() => (
    Object.entries(debateSessions)
      .map(([id, s]) => s ? { ...s, id } : null)
      .filter((s) => s?.type === 'trial')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null
  ), [debateSessions])

  useEffect(() => {
    if (!roomCode || !judicialCaseId) return
    const u = subscribe(roomCode, `verdicts/${judicialCaseId}`, (d) => setVerdicts(d || {}))
    return () => u?.()
  }, [roomCode, judicialCaseId])

  // ─── 내 모둠 / 팀 ───────────────────────────────────────────────────────
  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // 연기팀 판정 — 모둠별/개인별 배정 모두 반영. 판사·검사·변호만 연기팀, 그 외는 참관·판결문 작성팀
  const myActingSide = useMemo(() => {
    const side = getStudentJudicialSide(myStudentId, branchConfig?.judicial, groups)
    return (side === 'judge' || side === 'prosecution' || side === 'defense') ? side : null
  }, [branchConfig, groups, myStudentId])

  // ② 쟁점/활동 메모는 JudicialActivityMemo 컴포넌트가 자동저장으로 직접 처리한다.

  // ── ④ 판결문 결정 토글(모둠별) ───────────────────────────────────────────
  const [decisionChoice, setDecisionChoice] = useState('notGuilty')

  // 게시된 판결문 (모둠별 최신 1건) — ④/⑤에서 사용
  const postedVerdicts = useMemo(() => {
    const byGroup = {}
    for (const [vid, v] of Object.entries(verdicts || {})) {
      if (!v || !v.body) continue
      const gid = v.judgeGroupId || v.groupId
      if (!gid) continue
      const prev = byGroup[gid]
      if (!prev || (v.createdAt || 0) > (prev.createdAt || prev.submittedAt || 0)) {
        byGroup[gid] = { ...v, _vid: vid }
      }
    }
    return byGroup
  }, [verdicts])

  // 연기팀 라인 (내 팀 speaker만)
  const myScriptLines = useMemo(() => {
    if (!myActingSide) return []
    const allow = SCRIPT_SPEAKERS_BY_SIDE[myActingSide] || []
    return [...trialScript]
      .filter((l) => allow.includes(l?.speaker))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [trialScript, myActingSide])

  const fullScript = useMemo(
    () => [...trialScript].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [trialScript],
  )

  // ④ 토의에 올릴 대본의 '선고직전' 판사 마무리 발언 (대본은 유죄/무죄 결론 없이 여기서 끝난다)
  const closingJudgeLines = useMemo(() => {
    const judgeLines = fullScript.filter((l) => l?.speaker === 'judge')
    if (judgeLines.length === 0) return []
    const sungo = judgeLines.filter((l) => /선고/.test(l?.scene || ''))
    return sungo.length > 0 ? sungo : [judgeLines[judgeLines.length - 1]]
  }, [fullScript])

  return (
    <div className="space-y-4">
      {/* 모드 안내 배너 */}
      <div className="bg-gradient-to-r from-rose-50 to-amber-50 border-2 border-rose-200 rounded-xl px-4 py-2.5">
        <p className="text-sm font-bold text-rose-800">⚖️ 판결중심 모드 (시나리오) — 우리 모두가 판사</p>
        <p className="text-[11px] text-rose-600 mt-0.5">
          재판을 참관하고, 모둠별로 판결문을 작성해 비교합니다. 판사·검사·변호사팀은 대본을 받아 연기합니다.
        </p>
      </div>

      {/* ════════ ① 준비 — 사건 개요 + 팀 배정 ════════ */}
      {prepMode !== 'hidden' && (
        <div ref={prepRef} className={sectionWrap(prepMode)}>
          <div className="bg-white rounded-xl border border-rose-200 px-4 py-3 mb-3">
            <h2 className="text-base font-bold text-rose-800">⚖️ ① 준비 — 사건 개요 + 팀 배정</h2>
            <p className="text-xs text-rose-600 mt-0.5">
              <b>사건 자료실</b>에서 사건 개요를 함께 읽으세요. 선생님이 <b>연기 3팀(판사·검사·변호사)</b>을 정합니다.
              나머지 모둠은 재판을 보며 <b>판결문</b>을 작성하는 판사가 됩니다.
            </p>
          </div>

          <div className="grid lg:grid-cols-[3fr_2fr] gap-3 mb-3">
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-4">
              <p className="text-xs font-bold text-rose-700 mb-2">📖 사건 자료실 (사건 개요)</p>
              {/* 판결중심: 사건 시나리오(개요)만 — 증거·역할힌트는 숨김 */}
              <JudicialCaseRoom currentStage={1} hideEvidence hideRoleHints />
            </div>

            <aside className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-4 space-y-3 self-start">
              <h3 className="text-sm font-bold text-slate-800">
                🎬 연기 팀 / 참관 팀
                <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                  혼합 배정
                </span>
              </h3>
              <div className="space-y-2">
                {['judge', 'prosecution', 'defense'].map((side) => {
                  const meta = ACTING_META[side]
                  const assigned = assignmentSummary[side] || { groups: [], students: [] }
                  const names = [
                    ...assigned.groups.map((g) => g.name),
                    ...assigned.students.map((s) => s.name),
                  ].join(', ')
                  return (
                    <div key={side} className={`border-2 rounded-xl px-3 py-2 ${meta.color}`}>
                      <p className={`text-xs font-bold ${meta.text}`}>{meta.label} (연기)</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {names ? names : '아직 배정되지 않음 — 선생님이 지정합니다.'}
                      </p>
                    </div>
                  )
                })}
                <div className="border-2 border-dashed border-gray-300 rounded-xl px-3 py-2 bg-white">
                  <p className="text-xs font-bold text-gray-700">
                    🧑‍⚖️ 그 외 학생·모둠 — 판결문 작성팀
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    재판을 보며 메모하고, 모둠별 판결문을 씁니다.
                  </p>
                </div>
              </div>
              {role === 'student' && myStudentId && (
                <div className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800">
                  나는 
                  {myActingSide
                    ? `${ACTING_META[myActingSide].label} (연기팀)`
                    : '판결문 작성팀 (참관)'}
                  입니다.
                </div>
              )}
            </aside>
          </div>

          <BranchUnitBanner branch="judicial" />
        </div>
      )}

      {/* ════════ ② 쟁점 파악 ════════ */}
      {issuesMode !== 'hidden' && (
        <div ref={issuesRef} className={sectionWrap(issuesMode)}>
          <div className="bg-white rounded-xl border border-amber-200 px-4 py-3 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-amber-800">🔎 ② 쟁점 파악</h2>
                <p className="text-xs text-amber-600 mt-0.5">
                  재판을 보기 전에, 이 사건에서 <b>무엇이 판결에 중요할지</b> 모둠끼리 쟁점을 정리하세요.
                  재판을 더 날카롭게 볼 수 있어요. <b>사건 자료실</b>에서 사건 내용을 다시 확인할 수 있습니다.
                </p>
              </div>
              {/* ① 사건 자료실 — 모든 역할 공통 */}
              <div className="shrink-0">
                <JudicialCaseRoomButton currentStage={2} />
              </div>
            </div>
          </div>

          {!previewMode && role === 'student' && myGroupId ? (
            <section className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
              <JudicialActivityMemo
                title="📝 내 사법부 활동 메모 (쟁점)"
                subtitle="개인 메모입니다. 재판하기·토론도구·판결 단계에서 계속 이어서 보이고, 모둠 판결문은 토론도구 종합판결문에서 함께 정리합니다. 입력하면 자동 저장됩니다."
                placeholder="예) 카톡 메시지가 진짜 약속인가? / 경영이 어려우면 임금을 안 줘도 되나? / 일부러 안 준 것인가?"
              />
            </section>
          ) : (
            <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
              🔎 학생 화면에서 모둠별 쟁점 메모를 작성합니다.
            </div>
          )}
        </div>
      )}

      {/* ════════ ③ 재판하기 (대본 연기 + 판결문 작성) ════════ */}
      {trialMode !== 'hidden' && (
        <div ref={trialRef} className={sectionWrap(trialMode)}>
          <div className="bg-white rounded-xl border border-rose-200 px-4 py-3 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-rose-800">🎬 ③ 재판하기</h2>
                <p className="text-xs text-rose-600 mt-0.5">
                  연기 3팀(판사·검사·변호사)은 각자 <b>자기 대사</b>를 보며 순서대로 연기합니다.
                  나머지 모둠은 토론도구에서 메모하고 모둠 판결문을 작성·게시하세요.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <JudicialCaseRoomButton currentStage={3} />
                {trialDebate && (
                  <button
                    onClick={() => updateAt(roomCode, `debateSessions/${trialDebate.id}`, { isPopupOpen: true })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
                  >
                    🎙️ 토론 도구
                  </button>
                )}
              </div>
            </div>
          </div>

          {trialScript.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-5 text-center text-sm text-gray-500">
              ⏳ 아직 재판 대본이 없습니다. 선생님이 <b>학급 설정 → 사법부</b> 또는 빠른 제어에서 판결중심 대본을 만들어 적용하면 여기에 표시됩니다.
            </div>
          ) : (previewMode || role === 'teacher') ? (
            // 교사/미리보기 — 전체 대본
            <ScriptList lines={fullScript} showAllSpeakers title="전체 대본 (교사용)" />
          ) : myActingSide ? (
            // 연기팀 학생 — 전체 대본(내 대사 강조: 검정·굵게 / 남의 대사 연회색)
            <div className="space-y-3">
              <div className={`border-2 rounded-xl px-4 py-2 ${ACTING_META[myActingSide].color}`}>
                <p className={`text-sm font-bold ${ACTING_META[myActingSide].text}`}>
                  {ACTING_META[myActingSide].label} — 전체 대본 (내 대사 {myScriptLines.length}줄, 진하게 표시)
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  진하게 표시된 줄이 <b>내 대사</b>입니다. 연한 회색은 다른 역할의 대사예요 — 흐름을 보며 내 차례를 기다리세요.
                </p>
              </div>
              <ScriptList
                lines={fullScript}
                title="재판 대본 (전체)"
                highlightSpeakers={SCRIPT_SPEAKERS_BY_SIDE[myActingSide] || []}
              />
            </div>
          ) : (
            // 참관팀 학생 — 안내만 (메모는 아래 공통 메모 블록 또는 토론도구에서)
            <section className="bg-white rounded-2xl shadow-sm border-2 border-violet-200 p-4">
              <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
                <p className="text-sm font-bold text-violet-800">우리 모둠은 참관·판결문 작성팀</p>
                <p className="text-[11px] text-violet-700 mt-0.5">
                  모의 재판을 보며 핵심 발언·증거·쟁점을 메모하세요. 다음 단계에서 판결문을 작성합니다.
                </p>
              </div>
            </section>
          )}

          {/* ⑧ 토론도구를 안 올렸을 때: 재판하기 단계에서 활동 메모를 이어서 작성(모든 역할 공통).
              토론도구가 열리면 메모는 토론도구 안에서 보이므로 여기서는 숨긴다. */}
          {!previewMode && role === 'student' && myGroupId && !trialDebate && (
            <section className="mt-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
              <JudicialActivityMemo
                title="🗒️ 사법부 활동 메모 (이어서 기록)"
                subtitle="쟁점 단계에서 쓴 메모를 이어서 보강하세요. 판결문 작성에 참고할 수 있습니다. (토론도구를 열면 토론도구 안에서 같은 메모가 보입니다.)"
              />
            </section>
          )}
        </div>
      )}

      {/* ════════ 모둠 판결문 작성·게시 (재판하기 단계 내, 토론도구 미사용 시) ════════ */}
      {writingMode !== 'hidden' && (
        <div ref={writingRef} className={sectionWrap(writingMode)}>
          <div className="bg-white rounded-xl border border-slate-300 px-4 py-3 mb-3">
            <h2 className="text-base font-bold text-slate-800">📜 모둠 판결문 작성·게시</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              이제 모든 모둠이 <b>판사</b>입니다. 재판에서 들은 주장·증거를 바탕으로 모둠끼리 <b>유죄/무죄를 정하고 판결문</b>을 작성해 게시하세요.
              게시한 판결문은 다음 <b>판결문 토의</b> 단계에서 함께 비교합니다.
            </p>
          </div>

          {!previewMode && role === 'student' && myGroupId ? (
            <section className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-rose-900 mb-1">① 우리 모둠의 결론</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDecisionChoice('guilty')}
                    className={`flex-1 py-2 text-sm rounded-lg font-semibold ${decisionChoice === 'guilty' ? 'bg-rose-600 text-white' : 'bg-white text-rose-800 border-2 border-rose-200 hover:bg-rose-100'}`}
                  >⚖️ 유죄</button>
                  <button
                    onClick={() => setDecisionChoice('notGuilty')}
                    className={`flex-1 py-2 text-sm rounded-lg font-semibold ${decisionChoice === 'notGuilty' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-800 border-2 border-emerald-200 hover:bg-emerald-100'}`}
                  >🕊️ 무죄</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-rose-900 mb-1">② 판결문 작성</p>
                <VerdictTemplate caseId={judicialCaseId} groupId={myGroupId} decision={decisionChoice} />
              </div>
            </section>
          ) : (
            <div className="bg-rose-50 border-2 border-dashed border-rose-200 rounded-2xl p-4 text-sm text-rose-700">
              📜 학생 화면에서 모둠별로 유죄/무죄를 정하고 판결문을 작성·게시합니다.
            </div>
          )}

          {/* 우리 모둠이 이미 게시한 판결문 미리보기 */}
          {myGroupId && postedVerdicts[myGroupId] && (
            <div className="mt-3 bg-white border-2 border-emerald-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-emerald-700 mb-1">✓ 우리 모둠이 게시한 판결문</p>
              <VerdictCard v={postedVerdicts[myGroupId]} groupName={groups?.[myGroupId]?.name || myGroupId} />
            </div>
          )}
        </div>
      )}

      {/* ════════ ④ 판결문 토의 (판결문별 평가·댓글·답변) ════════ */}
      {discussionMode !== 'hidden' && (
        <div ref={discussionRef} className={sectionWrap(discussionMode)}>
          <div className="bg-white rounded-xl border border-violet-200 px-4 py-3 mb-3">
            <h2 className="text-base font-bold text-violet-800">💬 ④ 판결문 토의</h2>
            <p className="text-xs text-violet-600 mt-0.5">
              각 판결문을 펼쳐 읽고, <b>근거·공정성·설득력</b>을 평가한 뒤 댓글이나 질문을 남기세요.
              질문에는 <b>해당 판결문을 쓴 모둠</b>만 답변할 수 있습니다.
            </p>
          </div>

          {/* ④ 대본의 '선고직전' 재판장 마무리 발언 */}
          {closingJudgeLines.length > 0 && (
            <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-4 mb-3">
              <h3 className="text-sm font-black text-slate-800 mb-1">⚖️ 재판장 마무리 발언 (대본)</h3>
              <p className="text-[11px] text-slate-500 mb-2">
                재판은 여기서 끝났고, <b>판결은 우리 모두(판사)에게</b> 맡겨졌습니다. 아래 발언을 떠올리며 모둠별 판결문을 비교해 보세요.
              </p>
              <div className="space-y-1.5">
                {closingJudgeLines.map((l, i) => (
                  <p key={i} className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-white border border-slate-200 rounded-lg px-3 py-2">
                    ⚖️ {l.text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {Object.keys(postedVerdicts).length > 0 ? (
            <section className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
              <h3 className="font-bold text-amber-800 text-base mb-1">📚 게시된 모둠별 판결문</h3>
              <p className="text-xs text-amber-700 mb-3">
                판결문마다 토의창이 따로 열립니다. 자기 모둠 판결문에는 새 평가를 달지 않고, 친구들의 질문에 답변합니다.
              </p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {Object.entries(postedVerdicts)
                  .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
                  .map(([gid, v]) => (
                    <details key={gid} open className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
                      <summary className="cursor-pointer px-3 py-2 bg-slate-100 flex items-center gap-2 select-none">
                        <span className="text-sm font-bold text-slate-800">
                          🧑‍⚖️ {groups?.[gid]?.name || gid}
                        </span>
                        <span className={`text-xs font-bold ${v.decision === 'guilty' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {v.decision === 'guilty' ? '유죄' : '무죄'}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-auto">게시됨</span>
                      </summary>
                      <div className="p-3 space-y-3">
                        <VerdictCard v={v} groupName={groups?.[gid]?.name || gid} hideHeader />
                        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                          <h4 className="text-sm font-bold text-violet-800 mb-2">3축 평가와 댓글</h4>
                          <CommentList
                            targetType="verdict"
                            targetId={`${judicialCaseId}:${gid}`}
                            targetGroupId={gid}
                            allowReplies
                          />
                        </div>
                      </div>
                    </details>
                  ))}
              </div>
            </section>
          ) : (
            <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl p-4 mb-3 text-center text-sm text-amber-700">
              ⏳ 아직 게시된 판결문이 없습니다. ④ 단계에서 모둠 판결문을 게시하면 여기에 모입니다.
            </div>
          )}
        </div>
      )}

      {/* ════════ ⑥ 기사 작성 ════════ */}
      {articleMode !== 'hidden' && (
        <div ref={articleRef} className={sectionWrap(articleMode)}>
          <div className="bg-white rounded-xl border border-emerald-200 px-4 py-3 mb-3">
            <h2 className="text-base font-bold text-emerald-800">📰 ⑥ 기사 작성 — 사법부가 하는 일</h2>
            <p className="text-xs text-emerald-600 mt-0.5">
              이번 재판과 사법부의 역할을 기사로 정리합니다. 교사 승인 후 여론판에 게시됩니다.
            </p>
          </div>
          {/* ⑨ 참관 판사 종합평가·개별평가 회수 — 기사 작성에 참고 (항상 펼침) */}
          {!previewMode && role === 'student' && myStudentId && latestTrialSession && (
            <VerdictEvalRecap session={latestTrialSession} myStudentId={myStudentId} />
          )}
          <ArticleSection />
        </div>
      )}

      {/* ════════ ⑦ 여론조사 ════════ */}
      {pollMode !== 'hidden' && (
        <div ref={pollRef} className={sectionWrap(pollMode)}>
          <div className="bg-white rounded-xl border border-indigo-200 px-4 py-3 mb-3">
            <h2 className="text-base font-bold text-indigo-800">📊 ⑦ 여론조사 — 판결에 대한 평가</h2>
            <p className="text-xs text-indigo-600 mt-0.5">
              여러 모둠의 판결에 대해 어떻게 생각하나요? 시민의 한 사람으로서 의견을 응답해 주세요.
            </p>
          </div>
          <PollFeed plannedOnly={true} />
        </div>
      )}
    </div>
  )
}

// 대본 줄 목록
// highlightSpeakers: 내 대사로 강조할 speaker 집합(있으면 화자 라벨 항상 표시).
//   - 내 대사: 검정·굵게 / 남의 대사: 연한 회색 → 빠진 번호도 누가 말하는지 보임.
function ScriptList({ lines, title, showAllSpeakers = false, highlightSpeakers = null }) {
  if (!lines || lines.length === 0) {
    return <p className="text-xs text-gray-400 italic px-2">표시할 대사가 없습니다.</p>
  }
  const hi = highlightSpeakers ? new Set(highlightSpeakers) : null
  const showSpeaker = showAllSpeakers || !!hi
  // scene별 그룹
  const scenes = []
  let cur = null
  for (const l of lines) {
    const scene = l.scene || ''
    if (!cur || cur.scene !== scene) {
      cur = { scene, items: [] }
      scenes.push(cur)
    }
    cur.items.push(l)
  }
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
      {title && <h3 className="text-sm font-bold text-slate-800">{title}</h3>}
      {scenes.map((sc, si) => (
        <div key={si} className="space-y-1.5">
          {sc.scene && (
            <p className="text-[11px] font-bold text-slate-400 border-b border-slate-100 pb-0.5">▌ {sc.scene}</p>
          )}
          {sc.items.map((l, i) => {
            const mine = hi ? hi.has(l.speaker) : true
            return (
              <div key={i} className={`flex gap-2 items-start ${mine ? '' : 'opacity-100'}`}>
                <span className={`text-[10px] font-mono mt-1 w-5 shrink-0 text-right ${mine ? 'text-slate-500' : 'text-gray-300'}`}>{l.order}</span>
                <div className="flex-1">
                  {showSpeaker && (
                    <span className={`text-[11px] font-bold mr-1 ${mine ? 'text-slate-700' : 'text-gray-400'}`}>{SPEAKER_LABEL[l.speaker] || l.speaker}:</span>
                  )}
                  <span className={`whitespace-pre-wrap leading-relaxed ${mine ? 'text-sm font-bold text-gray-900' : 'text-sm font-normal text-gray-400'}`}>{l.text}</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// 판결문 카드
function VerdictCard({ v, groupName, hideHeader = false }) {
  if (!v) return null
  return (
    <div className="space-y-1">
      {!hideHeader && (
        <p className="text-sm font-semibold">
          {v.decision === 'guilty' ? '⚖️ 유죄' : '🕊️ 무죄'} — {groupName}
        </p>
      )}
      <p className="text-sm whitespace-pre-wrap text-gray-800">{v.body}</p>
      {v.sentence && <p className="text-xs text-gray-500 mt-1">선고/주문: {v.sentence}</p>}
    </div>
  )
}

// ⑨ 참관 판사가 토론도구에서 작성한 종합평가·개별평가를 기사 단계에서 회수해 보여준다.
function VerdictEvalRecap({ session, myStudentId }) {
  const final = session?.finalEvaluations?.[myStudentId]
  const finalText = typeof final === 'string' ? final : (final?.content || final?.comment || '')
  const evals = Object.values(session?.speechEvals || {})
  const lines = []
  evals.forEach((ev) => {
    const myRes = ev?.results?.[myStudentId]
    if (!myRes) return
    if (ev.targetLabel && Array.isArray(myRes.scores)) {
      lines.push({
        label: ev.targetLabel,
        scores: myRes.scores.map((v, i) => `${EVAL_AXES[i]} ${v}`).join(' · '),
        comment: myRes.comment || '',
      })
    }
    if (myRes.perTarget) {
      Object.entries(myRes.perTarget).forEach(([tid, d]) => {
        const t = ev.targets?.find((x) => x.id === tid)
        lines.push({
          label: `${ev.targetLabel || ''} ${t ? t.label : tid}`.trim(),
          scores: Array.isArray(d.scores) ? d.scores.map((v, i) => `${EVAL_AXES[i]} ${v}`).join(' · ') : '',
          comment: d.comment || '',
        })
      })
    }
  })

  if (!finalText && lines.length === 0) return null

  return (
    <div className="mb-3 rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-4 space-y-3">
      <h3 className="text-sm font-black text-violet-800">🧑‍⚖️ 내가 쓴 참관 판사 평가 (기사 참고용)</h3>
      {finalText && (
        <div className="rounded-xl bg-white border border-violet-200 p-3">
          <p className="text-[11px] font-bold text-violet-700 mb-1">📝 최종 종합 평가</p>
          <p className="text-sm whitespace-pre-wrap text-slate-800 leading-relaxed">{finalText}</p>
        </div>
      )}
      {lines.length > 0 && (
        <div className="rounded-xl bg-white border border-violet-200 p-3">
          <p className="text-[11px] font-bold text-violet-700 mb-1">⭐ 개별 평가 ({lines.length}건)</p>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-xs text-slate-700">
                <span className="font-bold">{l.label}</span>
                {l.scores && <span className="text-violet-600"> — {l.scores}</span>}
                {l.comment && <span className="block text-slate-500 pl-2">└ {l.comment}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default JudicialVerdictTab
