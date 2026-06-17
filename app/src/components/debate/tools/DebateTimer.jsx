import { useEffect, useRef, useState } from 'react'

/** 국어 6-1-3단원 — 토론 7단계 기본값 */
export const DEFAULT_DEBATE_STAGES = [
  { label: '찬성 측 주장 펼치기',         seconds: 180, hint: '찬성 측이 주장을 펼치는 시간입니다' },
  { label: '반대 측 주장 펼치기',         seconds: 180, hint: '반대 측이 주장을 펼치는 시간입니다' },
  { label: '반대 측 반론 + 찬성 측 답변', seconds: 240, hint: '반대 측 반론과 찬성 측 답변 시간입니다' },
  { label: '찬성 측 반론 + 반대 측 답변', seconds: 240, hint: '찬성 측 반론과 반대 측 답변 시간입니다' },
  { label: '찬성 측 주장 다지기',         seconds: 120, hint: '찬성 측이 주장을 다지는 시간입니다' },
  { label: '반대 측 주장 다지기',         seconds: 120, hint: '반대 측이 주장을 다지는 시간입니다' },
  { label: '평가단 평가 결과 발표',       seconds: 180, hint: '평가단이 결과를 발표하는 시간입니다' },
]

/** 국민참여재판 절차 — 법교육 테마 */
export const TRIAL_STAGES = [
  { label: '시작 및 진술거부권 고지',     seconds: 180, hint: '재판장이 재판을 시작하고 피고인의 권리를 알립니다' },
  { label: '검사의 모두 진술',           seconds: 180, hint: '검사가 공소사실(사건 내용)을 설명합니다' },
  { label: '피고인의 모두 진술',         seconds: 180, hint: '피고인이 공소사실에 대한 입장을 밝힙니다' },
  { label: '증거 조사 및 증인 신문',     seconds: 300, hint: '증거를 확인하고 증인에게 질문을 합니다' },
  { label: '피고인 신문',               seconds: 300, hint: '검사와 변호인이 피고인에게 질문을 합니다' },
  { label: '검사의 의견 진술 및 구형',   seconds: 180, hint: '검사가 최종 의견을 말하고 형량을 요청합니다' },
  { label: '피고인/변호인 최종 진술',     seconds: 180, hint: '피고인과 변호인이 마지막으로 할 말을 합니다' },
  { label: '배심원 평의 및 평결',       seconds: 300, hint: '배심원들이 유/무죄와 형량에 대해 토의합니다' },
  { label: '판결 선고',                 seconds: 180, hint: '재판장이 배심원 의견을 참고하여 판결을 내립니다' },
]

/** 판결중심(시나리오) 재판 순서 — 대본 연기 진행 + 마지막에 참관 판사 평의·판결문 작성 */
export const VERDICT_TRIAL_STAGES = [
  { label: '재판 시작·모두진술',          seconds: 240, hint: '재판장이 재판을 열고, 검사·피고인이 사건에 대한 입장을 밝힙니다 (대본 연기)' },
  { label: '증거 조사·증인 신문',         seconds: 300, hint: '증거를 확인하고 증인에게 질문합니다 (대본 연기)' },
  { label: '피고인 신문',                seconds: 240, hint: '검사와 변호인이 피고인에게 질문합니다 (대본 연기)' },
  { label: '최종 변론',                  seconds: 240, hint: '검사와 변호인이 마지막 의견을 말합니다 (대본 연기)' },
  { label: '참관 판사 평의·판결문 작성',  seconds: 600, hint: '참관 판사(전 모둠)가 평의하고, 모둠별로 판결문을 작성·게시합니다' },
]

/** 다자간 토론 절차 — 여러 팀이 참여하는 토론 */
export const MULTI_PARTY_STAGES = [
  { label: '기조 발언',               seconds: 50,  hint: '팀별로 기본 입장과 주장을 발표합니다', isRound: true, teams: ['1팀', '2팀', '3팀', '4팀'] },
  { label: '상호 질의 및 응답',         seconds: 70,  hint: '서로의 주장에 대해 질문하고 답변합니다', isRound: true, teams: ['1팀', '2팀', '3팀', '4팀'] },
  { label: '공통 쟁점 자유 토론',       seconds: 600, hint: '핵심 쟁점에 대해 자유롭게 의견을 나눕니다' },
  { label: '최종 발언 및 정리',         seconds: 60,  hint: '팀별로 최종 입장과 근거를 정리합니다', isRound: true, teams: ['1팀', '2팀', '3팀', '4팀'] },
  { label: '평가단 평가 및 결과 발표',   seconds: 180, hint: '평가단이 결과를 발표합니다' },
]

export function getRoundTeams(stage) {
  if (!stage?.isRound) return []
  const teams = Array.isArray(stage.teams) ? stage.teams : []
  const fallback = Array.isArray(stage.evalNames) ? stage.evalNames : []
  return (teams.length ? teams : fallback)
    .map((name, idx) => String(name || '').trim() || `${idx + 1}팀`)
    .filter(Boolean)
}

export function getRoundInfo(timer, stage) {
  const teams = getRoundTeams(stage)
  if (!teams.length) return { isRound: false, teams: [], teamIdx: 0, teamLabel: '', isLastTeam: true }
  const rawIdx = Number(timer?.currentTeamIdx) || 0
  const teamIdx = Math.max(0, Math.min(teams.length - 1, rawIdx))
  return {
    isRound: true,
    teams,
    teamIdx,
    teamLabel: teams[teamIdx] || `${teamIdx + 1}팀`,
    isLastTeam: teamIdx >= teams.length - 1,
  }
}

/** 협의 토론 절차 — 합의안을 도출하는 토론 */
export const CONSULTATIVE_STAGES = [
  { label: '문제 상황 및 원인 공유',     seconds: 180, hint: '토론할 문제와 그 원인을 확인합니다' },
  { label: '해결 방안 제안',           seconds: 300, hint: '각자 생각하는 해결책을 제안합니다' },
  { label: '방안별 실현 가능성 검토',   seconds: 360, hint: '제안된 방안들의 장단점을 따져봅니다' },
  { label: '의견 조율 및 합의안 도출',   seconds: 480, hint: '서로 양보하며 최선의 합의안을 만듭니다' },
  { label: '최종 합의안 발표 및 정리',   seconds: 180, hint: '결정된 합의안을 발표하고 마무리합니다' },
]

/**
 * 현재 단계의 남은 초를 계산.
 * - paused: pausedRemaining
 * - running: stageSeconds - elapsed
 * - idle:    stageSeconds
 */
export function computeRemaining(timer) {
  if (!timer) return 0
  const stages = timer.stages || []
  const idx = Number(timer.currentStage) || 0
  const stage = stages[idx]
  if (!stage) return 0
  if (timer.isPaused) return Math.max(0, Number(timer.pausedRemaining) || 0)
  if (timer.isRunning && timer.startedAt) {
    const elapsed = (Date.now() - Number(timer.startedAt)) / 1000
    return Math.max(0, Number(stage.seconds) - elapsed)
  }
  return Number(stage.seconds) || 0
}

function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

const blank = (text = '') => text || '(                                                         )'

function scriptSectionForStage(stage, idx, topic) {
  const label = stage?.label || ''
  const topicText = blank(topic)

  if (label.includes('판정') || label.includes('평가') || idx >= 6) {
    return {
      title: '4단계: 평가하기',
      lines: [
        ['사회자', '마지막으로 평가단의 평가 의견을 듣겠습니다.'],
        ['평가단 대표', '양측의 토론을 공정하게 평가했습니다. 찬성 측은 (                                                                           ) 점이 훌륭했고, 반대 측은 (                                                                           ) 점이 돋보였습니다. 평가 기준에 따라 객관적인 근거를 제시하고 논리적으로 설득한 (          ) 측이 이번 토론을 더 잘 이끌었다고 평가합니다.'],
        ['사회자', '이상으로 토론을 모두 마치겠습니다. 수고하셨습니다.'],
      ],
    }
  }

  if (label.includes('다지기') || idx >= 4) {
    return {
      title: '3단계: 주장 다지기',
      lines: [
        ['사회자', '다음은 주장 다지기 단계입니다. 찬성 측부터 최종 주장을 정리해 주십시오.'],
        ['찬성 측 1', `앞서 토론한 내용을 종합해 볼 때, (                                                                                              ) 하므로 저희는 ${topicText}에 강력히 찬성합니다.`],
        ['사회자', '반대 측, 주장 다지기 해 주십시오.'],
        ['반대 측 1', `토론 과정을 통해 확인했듯이, (                                                                                              ) 하므로 저희는 ${topicText}에 단호히 반대합니다.`],
      ],
    }
  }

  if (label.includes('반론') || idx >= 2) {
    return {
      title: '2단계: 반론하기',
      lines: [
        ['사회자', '이제 반론하기 단계입니다. 먼저 반대 측에서 찬성 측 주장에 대해 반론하고, 찬성 측은 답변해 주십시오.'],
        ['반대 측 2', '찬성 측에서는 (                                                )라고 하셨지만, (                                                )라는 문제점이 발생할 수 있습니다. 이에 대해 어떻게 생각하십니까?'],
        ['찬성 측 2', '그 점에 대해서는 (                                                                                           )와 같은 방법으로 해결할 수 있습니다.'],
        ['사회자', '이번에는 찬성 측에서 반대 측 주장에 대해 반론하고, 반대 측은 답변해 주십시오.'],
        ['찬성 측 3', '반대 측은 (                                                )라고 하셨지만, (                                                )라는 점도 고려해야 하지 않습니까?'],
        ['반대 측 3', '비록 (                                                )라 하더라도, (                                                                                           )이기 때문에 여전히 저희의 주장이 타당합니다.'],
      ],
    }
  }

  return {
    title: '도입 + 1단계: 주장 펼치기',
    lines: [
      ['사회자', `지금부터 ${topicText}라는 주제로 토론을 시작하겠습니다. 토론자들은 규칙을 지키며 타당한 근거를 들어 말씀해 주시기 바랍니다.`],
      ['사회자', '먼저 찬성 측, 주장을 펼쳐 주십시오.'],
      ['찬성 측 1', `저희는 ${topicText}에 찬성합니다. 그 이유는 (                                                                                    ) 때문입니다. 이를 뒷받침할 근거(통계, 전문가 의견 등)로는 (                                                                                     )이/가 있습니다.`],
      ['사회자', '다음으로 반대 측, 주장을 펼쳐 주십시오.'],
      ['반대 측 1', `저희는 ${topicText}에 반대합니다. 그 이유는 (                                                                                    ) 때문입니다. 이를 뒷받침할 근거(통계, 전문가 의견 등)로는 (                                                                                     )이/가 있습니다.`],
    ],
  }
}

/**
 * 토론 타이머 표시 컴포넌트 (학생/공용 — 읽기 전용).
 *
 * @param {{timer, compact?: boolean, topic?: string}} props
 *   timer: rooms/{roomCode}/debateSessions/{sid}/debateTimer 객체
 *   compact: true 면 의장용 미니(헤드라인+남은시간만)
 */
function DebateTimer({ timer, compact = false, topic = '', defaultFullscreen = false, onPolicyReview = null }) {
  const [, setTick] = useState(0)
  const [fullscreen, setFullscreen] = useState(defaultFullscreen)
  const [scriptOpen, setScriptOpen] = useState(false)
  const intervalRef = useRef(null)

  // 1초 tick — 실행 중일 때만 강제 리렌더
  useEffect(() => {
    if (timer?.isRunning && !timer?.isPaused) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timer?.isRunning, timer?.isPaused, timer?.startedAt, timer?.currentStage, timer?.currentTeamIdx])

  if (!timer || !Array.isArray(timer.stages) || timer.stages.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed p-4 text-center text-sm text-gray-400">
        토론 타이머가 아직 설정되지 않았습니다.
      </div>
    )
  }

  const stages = timer.stages
  const idx = Number(timer.currentStage) || 0
  const cur = stages[idx] || stages[0]
  const roundInfo = getRoundInfo(timer, cur)
  const remaining = computeRemaining(timer)
  const danger = remaining <= 30 && timer.isRunning
  const finished = remaining <= 0 && timer.isRunning
  const stageGridStyle = { gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }
  const scriptSection = scriptSectionForStage(cur, idx, topic)

  // === 컴팩트(의장 미니) ===
  if (compact) {
    const compactLabel = roundInfo.isRound
      ? `${cur.label} · ${roundInfo.teamLabel} (${roundInfo.teamIdx + 1}/${roundInfo.teams.length})`
      : cur.label
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
        <span className="text-[10px] text-indigo-600 font-bold whitespace-nowrap">{idx + 1}/{stages.length}</span>
        <span className="text-xs flex-1 truncate">{compactLabel}</span>
        <span
          className={`font-mono text-base font-bold tabular-nums ${
            finished ? 'text-red-600 animate-pulse'
            : danger ? 'text-red-600'
            : 'text-gray-800'
          }`}
        >
          {fmt(remaining)}
        </span>
      </div>
    )
  }

  // === 전체 표시 ===
  const body = (
    <div className={`${fullscreen ? 'min-h-screen w-screen flex flex-col justify-center px-5 sm:px-8 lg:px-10 py-10 space-y-8' : 'p-4 space-y-3'}`}>
      <div className="flex items-baseline justify-between">
        <span className={`font-bold ${fullscreen ? 'text-2xl text-indigo-400' : 'text-[11px] text-indigo-700'}`}>
          ⏱️ 토론 타이머
        </span>
        <div className="flex items-center gap-2">
          {onPolicyReview && (
            <button
              type="button"
              onClick={onPolicyReview}
              title="새 창으로 다른 모둠 시행령·예산 보기"
              className={`rounded-full font-black transition ${
                fullscreen
                  ? 'px-4 py-2 text-base bg-white/10 text-white hover:bg-white/20 border border-white/15'
                  : 'px-2.5 py-1 text-[11px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              📜 시행령 보기 ↗
            </button>
          )}
          <button
            type="button"
            onClick={() => setScriptOpen(true)}
            className={`rounded-full font-black transition ${
              fullscreen
                ? 'px-4 py-2 text-base bg-white/10 text-white hover:bg-white/20 border border-white/15'
                : 'px-2.5 py-1 text-[11px] bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            대본 보기
          </button>
          <span className={`${fullscreen ? 'text-xl text-white/40' : 'text-[10px] text-gray-500'}`}>
            {idx + 1}단계 / {stages.length}단계
          </span>
        </div>
      </div>

      {/* 현재 단계명 */}
      <div className="text-center">
        <p className={`font-black ${fullscreen ? 'text-8xl text-white drop-shadow-2xl mb-4' : 'text-2xl text-gray-900'}`}>
          {cur.label}
        </p>
        {roundInfo.isRound && (
          <div className={`mt-3 inline-flex flex-col items-center rounded-2xl border ${
            fullscreen ? 'border-emerald-300/30 bg-emerald-400/10 px-8 py-4' : 'border-emerald-200 bg-emerald-50 px-4 py-2'
          }`}>
            <p className={`font-black ${fullscreen ? 'text-5xl text-emerald-200' : 'text-lg text-emerald-800'}`}>
              {roundInfo.teamLabel} 발언 중
            </p>
            <div className={`mt-2 flex items-center gap-2 ${fullscreen ? 'text-3xl' : 'text-sm'}`}>
              <span className={fullscreen ? 'text-emerald-200 tracking-[0.35em]' : 'text-emerald-600 tracking-[0.25em]'}>
                {roundInfo.teams.map((_, teamIdx) => (teamIdx <= roundInfo.teamIdx ? '●' : '○')).join('')}
              </span>
              <span className={`font-black tabular-nums ${fullscreen ? 'text-white/80' : 'text-emerald-700'}`}>
                ({roundInfo.teamIdx + 1}/{roundInfo.teams.length})
              </span>
            </div>
          </div>
        )}
        {cur.hint && (
          <p className={`mt-1 ${fullscreen ? 'text-3xl text-white/80' : 'text-xs text-gray-500'}`}>
            {cur.hint}
          </p>
        )}
      </div>

      {/* 남은 시간 */}
      <div className="text-center">
        <p
          className={`font-mono font-black tabular-nums ${
            fullscreen ? 'text-[25vh] leading-none' : 'text-5xl'
          } ${
            finished ? 'text-red-600 animate-pulse'
            : danger ? 'text-red-600'
            : fullscreen ? 'text-white' : 'text-gray-900'
          }`}
        >
          {fmt(remaining)}
        </p>
        {timer.isPaused && (
          <p className={`mt-2 font-bold ${fullscreen ? 'text-4xl text-amber-300' : 'text-xs text-amber-600'}`}>
            ⏸ 일시정지
          </p>
        )}
        {finished && !timer.isPaused && (
          <p className={`mt-2 font-bold ${fullscreen ? 'text-4xl text-red-300' : 'text-xs text-red-600'}`}>
            ⏰ 시간 종료
          </p>
        )}
      </div>

      {/* 단계 진행 바 */}
      <div className={fullscreen ? 'pt-10 space-y-4 w-full' : 'pt-1 space-y-1.5'}>
        <div className={`flex items-center gap-1 justify-center`}>
          {stages.map((s, i) => {
            const done = i < idx
            const current = i === idx
            return (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  fullscreen ? 'h-4' : 'h-1.5'
                } ${
                  done ? 'bg-emerald-500'
                  : current ? 'bg-indigo-600 ring-4 ring-white/30'
                  : 'bg-gray-200'
                }`}
                style={{ flex: 1 }}
                title={`${i + 1}. ${s.label}`}
              />
            )
          })}
        </div>
        <div
          className={`grid gap-1.5 text-center ${fullscreen ? 'text-white/55' : 'text-gray-500'}`}
          style={stageGridStyle}
        >
          {stages.map((s, i) => {
            const done = i < idx
            const current = i === idx
            const label = s.label || `${i + 1}단계`
            return (
              <div
                key={i}
                className={`min-w-0 rounded-xl transition-all ${
                  fullscreen
                    ? current
                      ? 'bg-white text-slate-950 shadow-2xl scale-[1.03] px-2 py-3'
                      : done
                      ? 'bg-emerald-500/15 text-emerald-200 px-2 py-2'
                      : 'bg-white/5 text-white/45 px-2 py-2'
                    : current
                    ? 'text-indigo-700 font-bold'
                    : done
                    ? 'text-emerald-600'
                    : ''
                }`}
                title={`${i + 1}. ${label}`}
              >
                <div className={fullscreen ? 'text-xl font-black tabular-nums' : 'text-[9px] font-bold tabular-nums'}>
                  {i + 1}
                </div>
                <div
                  className={`font-bold leading-tight ${
                    fullscreen ? 'mt-1 text-[clamp(0.8rem,1.15vw,1.35rem)]' : 'mt-0.5 text-[9px] line-clamp-2'
                  }`}
                >
                  {label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 전체화면 토글 */}
      {!fullscreen ? (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
            title="TV 투사용 전체화면"
          >
            🖥️ 전체화면
          </button>
        </div>
      ) : !defaultFullscreen ? (
        // TV 모드(defaultFullscreen=true)에서는 닫기 버튼 숨김
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="absolute top-8 right-8 text-white/50 hover:text-white text-4xl transition-colors"
          title="전체화면 닫기"
        >
          ✕
        </button>
      ) : null}

      {scriptOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full overflow-hidden rounded-3xl shadow-2xl border ${
            fullscreen ? 'max-w-5xl bg-slate-950 border-white/15 text-white' : 'max-w-3xl bg-white border-amber-100 text-slate-900'
          }`}>
            <div className={`flex items-center gap-3 justify-between px-5 py-4 border-b ${
              fullscreen ? 'border-white/10 bg-white/5' : 'border-amber-100 bg-amber-50'
            }`}>
              <div className="min-w-0">
                <p className={`text-[11px] font-black ${fullscreen ? 'text-amber-300' : 'text-amber-700'}`}>
                  현재 단계 대본
                </p>
                <h3 className={`font-black truncate ${fullscreen ? 'text-3xl' : 'text-lg'}`}>
                  {scriptSection.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScriptOpen(false)}
                className={`shrink-0 rounded-full font-black ${
                  fullscreen ? 'w-11 h-11 text-2xl bg-white/10 hover:bg-white/20 text-white' : 'w-9 h-9 bg-white hover:bg-amber-100 text-slate-500'
                }`}
                title="대본 닫기"
              >
                ✕
              </button>
            </div>
            <div className={`max-h-[70vh] overflow-y-auto px-5 py-4 space-y-3 ${
              fullscreen ? 'text-xl' : 'text-sm'
            }`}>
              {scriptSection.lines.map(([speaker, text], i) => (
                <div
                  key={`${speaker}-${i}`}
                  className={`rounded-2xl border p-3 ${
                    fullscreen ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <p className={`font-black mb-1 ${fullscreen ? 'text-amber-300' : 'text-indigo-700'}`}>
                    {speaker}
                  </p>
                  <p className={`leading-relaxed whitespace-pre-wrap ${fullscreen ? 'text-white/90' : 'text-slate-700'}`}>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
        {body}
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm">
      {body}
    </div>
  )
}

export default DebateTimer
