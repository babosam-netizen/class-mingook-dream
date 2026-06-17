import { useState, useEffect } from 'react'
import { useWorkflow } from '../../lib/use-workflow'
import { updateAt, subscribe } from '../../lib/rtdb-helpers'
import useGameStore from '../../store/gameStore'
import { preserveWindowScrollAfter } from '../../lib/preserve-scroll'

/**
 * 행정부 진행 가이드 — 현재 단계 + 교사·학생이 다음에 할 행동 명시
 * stage(0~5)는 PHASE_STEPS[3] 각 행정부 step의 stage 필드에서 직접 가져옵니다.
 * policies는 자체 구독으로 관리 (Phase3Page props 불필요).
 */
function ExecutiveProgressGuide({ role }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const roomData = useGameStore((s) => s.roomData)
  const wf = useWorkflow()
  const stepId = wf.currentStep?.id
  const stepIndex = roomData?.workflow?.phase3?.stepIndex ?? 0

  // 이전/다음 단계 라벨
  const prevStep = stepIndex > 0 ? wf.steps[stepIndex - 1] : null
  const nextStep = stepIndex < wf.steps.length - 1 ? wf.steps[stepIndex + 1] : null
  const prevShort = prevStep?.studentLabel || null
  const nextShort = nextStep?.studentLabel || null

  const [policies, setPolicies] = useState({})
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'policies', (d) => setPolicies(d || {}))
    return () => u?.()
  }, [roomCode])

  const all = Object.values(policies)
  const submitted = all.filter(p => ['submitted', 'requested', 'adjusted', 'final'].includes(p.status)).length

  // === 단계 판정 (stage 값은 PHASE_STEPS의 각 step.stage 필드에서 가져옴) ===
  // 행정부 step 이 아니면 stage = -1 (대기) — 입법/기사/여론조사 단계에서 0 으로 잘못 떨어지는 문제 방지
  const isExecStep = typeof stepId === 'string' && stepId.startsWith('executive-')
  let stage
  if (isExecStep) {
    stage = wf.currentStep?.stage ?? 0
  } else {
    stage = -1
  }

  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const isCollaborative = (branchConfig?.executive?.mode || 'role_based') === 'collaborative'

  const STAGE_INFO = [
    {
      label: isCollaborative ? '① 공동 작업 준비' : '① 역할 배정·임무 확인',
      student: isCollaborative
        ? '🤝 모둠원들과 함께 법률 집행계획·시행령·예산안을 작성할 준비를 하세요.'
        : '🎭 역할은 혼자 담당이 아니라 주도 책임입니다. 목적·대상, 시행 절차, 지원 내용, 점검·보완 역할을 확인하세요.',
      teacher: isCollaborative
        ? '학생들이 부처별로 모여 공동 집행계획 작성을 시작하도록 안내하세요.'
        : '학생들이 부처별 역할을 정하고 역할카드의 힌트를 참고하도록 안내하세요.',
    },
    {
      label: '② 정책 및 예산 초안 작성',
      student: isCollaborative
        ? '📈 하나의 정책·시행령·예산 템플릿을 부처 구성원이 함께 읽고 수정하며 완성하세요. 저장 시 평가단 열람 가능, 제출 시 공식 공개됩니다.'
        : '📊 각자 맡은 시행령 조문과 실행 예산 항목을 저장하세요. 저장본은 초안 작업판에 모이고, 대표가 이를 바탕으로 최종 정책보고서를 정리합니다.',
      teacher: isCollaborative
        ? '각 부처가 하나의 공동 템플릿 안에서 집행계획·시행령·예산 초안을 함께 완성하도록 독려하세요.'
        : '각 학생이 자기 시행령 조문과 실행 예산 항목을 저장하고, 대표가 역할별 저장본을 최종 정책보고서로 정리하도록 안내하세요.',
    },
    {
      label: '③ 청구예산비교',
      student: '📺 TV 전광판 방송을 통해 정부 총예산 대비 각 부처의 예산 청구액을 확인하고 예산 한계를 파악하세요.',
      teacher: '빠른 제어 패널의 [🎬 전광판 띄우기] 버튼을 눌러 각 부처 예산 청구 현황을 교실 TV로 방송하세요.',
    },
    {
      label: '④ 온라인 토의 및 평가',
      student: '💬 다른 부처의 집행계획·시행령·예산안을 읽고 찬성/반대/중립 의견과 3축 평가를 남기세요.',
      teacher: '학생들이 집행계획과 예산 산출식을 함께 보며 피드백하도록 지도하세요.',
    },
    {
      label: '⑤ 다자간 토론(국무회의)',
      student: '🏛️ 평가단 브리핑을 듣고, 정부 전체 예산에 맞게 줄일 곳 또는 더 배정할 곳을 국무회의에서 토론하세요. 토론 후 여론조사에도 참여하세요.',
      teacher: '평가단 브리핑 후 초과액/잔여액을 보며 국무회의 토론을 진행하고, 토론 후 여론조사를 실시하세요.',
    },
    {
      label: '⑥ 정책 및 예산안 최종 수정',
      student: '📌 국무회의 토론 결과를 반영해 별도 수정 창에서 시행령과 최종 배정 예산안을 집중 수정하고 확정하세요.',
      teacher: '대통령 모둠과 각 부처가 합의하여 시행령과 최종 배정액을 확정하도록 지도하세요.',
    },
    {
      label: '⑦ 최종 발표',
      student: '📢 부처별 최종 정책·배정 예산·조정 이유를 확인하세요.',
      teacher: '최종 예산안 발표 화면을 보며 행정부 활동 결과를 정리하세요.',
    },
  ]

  const WAITING_INFO = {
    label: '⏳ 행정부 시작 전 대기',
    student: '🙌 입법부 활동이 끝나면 자동으로 행정부 화면으로 이동해요. 잠시 기다리세요.',
    teacher: '입법부 마지막 단계(여론조사)를 마친 뒤 다음 단계 → 로 ① 준비 단계에 진입하세요.',
  }
  const info = stage === -1 ? WAITING_INFO : (STAGE_INFO[stage] || STAGE_INFO[0])
  const stageLabel = info.label
  const nextAction = role === 'student' ? info.student : info.teacher

  const stages = [
    { idx: 0, label: isCollaborative ? '준비' : '역할' },
    { idx: 1, label: '초안작성' },
    { idx: 2, label: '청구예산비교' },
    { idx: 3, label: '토의·평가' },
    { idx: 4, label: '국무회의' },
    { idx: 5, label: '최종수정' },
    { idx: 6, label: '발표' },
  ]

  return (
    <section className="bg-white border-2 border-violet-300 rounded-2xl p-3 space-y-2 shadow-sm">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-bold text-violet-800">🏢 행정부 진행 단계</h3>
        <span className="text-[11px] text-violet-500">
          부처 6개 · 제출 {submitted}개
        </span>
      </div>
      {/* 단계 진행 바 — 대기 상태(stage = -1)이면 어떤 점도 활성화하지 않음 */}
      <div className="flex items-center gap-1">
        {stages.map((s, i) => {
          const done = stage >= 0 && stage > s.idx
          const current = stage >= 0 && stage === s.idx
          return (
            <div key={s.idx} className="flex-1 flex items-center gap-1">
              <div
                className={`flex-1 h-1.5 rounded-full ${
                  done ? 'bg-emerald-500' : current ? 'bg-violet-600' : 'bg-gray-200'
                }`}
              />
              <span
                className={`text-[10px] font-bold ${
                  done ? 'text-emerald-600' : current ? 'text-violet-700' : 'text-gray-400'
                }`}
              >
                {done ? '✓' : current ? '▶' : ''}{s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* 현재 단계 + 다음 행동 안내 및 제어 버튼 */}
      <div className="flex flex-col md:flex-row gap-2">
        <div
          className={`flex-1 rounded-lg p-3 ${
            role === 'teacher'
              ? 'bg-violet-50 border border-violet-200'
              : 'bg-amber-50 border border-amber-200'
          }`}
        >
          <p className={`text-xs font-bold ${role === 'teacher' ? 'text-violet-800' : 'text-amber-800'}`}>
            {stageLabel}
          </p>
          <p className={`text-sm mt-0.5 ${role === 'teacher' ? 'text-violet-900' : 'text-amber-900'}`}>
            {role === 'teacher' ? '👩‍🏫 다음 행동: ' : '👥 다음 행동: '}
            <b>{nextAction}</b>
          </p>
        </div>

        {/* 교사용 이전/다음 단계 제어 버튼 — 이동 대상 라벨 명시 */}
        {role === 'teacher' && (
          <div className="flex md:flex-col gap-2 shrink-0 md:w-44">
            <button
              onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: Math.max(0, stepIndex - 1) }))}
              disabled={!prevStep}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border-2 border-violet-200 text-violet-700 font-bold hover:bg-violet-50 disabled:opacity-40 text-left leading-tight"
              title={prevShort || ''}
            >
              ← 이전 단계
              {prevShort && <div className="text-[10px] font-normal text-violet-500 truncate">({prevShort})</div>}
            </button>
            <button
              onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: stepIndex + 1 }))}
              disabled={!nextStep}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white font-bold hover:bg-violet-700 shadow-sm disabled:opacity-40 text-left leading-tight"
              title={nextShort || ''}
            >
              다음 단계 →
              {nextShort && <div className="text-[10px] font-normal text-violet-100 truncate">({nextShort})</div>}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default ExecutiveProgressGuide
