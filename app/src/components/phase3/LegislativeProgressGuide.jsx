import { useState, useEffect, useMemo } from 'react'
import { useWorkflow } from '../../lib/use-workflow'
import { updateAt, subscribe } from '../../lib/rtdb-helpers'
import useGameStore from '../../store/gameStore'
import { isDiscussionBill } from '../../lib/bill-status'
import { preserveWindowScrollAfter } from '../../lib/preserve-scroll'

/**
 * 본회의 진행 가이드 — 현재 단계 + 교사·학생이 다음에 할 행동 명시
 * stage(0~4)는 PHASE_STEPS[3] 각 step의 stage 필드에서 직접 가져옵니다.
 * bills/isVotingActive는 자체 구독으로 관리 (Phase3Page props 불필요).
 */
function LegislativeProgressGuide({ role }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const roomData = useGameStore((s) => s.roomData)
  const billBoard = useGameStore((s) => s.roomData?.billBoard)
  const wf = useWorkflow()
  const stepIndex = roomData?.workflow?.phase3?.stepIndex ?? 0

  const [billsMap, setBillsMap] = useState({})
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'bills', (d) => setBillsMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const bills = useMemo(() => Object.entries(billsMap).map(([id, b]) => ({ id, ...b })), [billsMap])
  const isVotingActive = useMemo(() => {
    if (!billBoard?.active || !billBoard?.billId) return false
    return billsMap[billBoard.billId]?.status === 'tabled'
  }, [billBoard, billsMap])

  const all = bills
  const discussion = all.filter(isDiscussionBill)
  const tabled     = all.filter((b) => b.status === 'tabled')
  const closed     = all.filter((b) => b.status === 'passed' || b.status === 'rejected')

  // === 단계 판정 (stage 값은 PHASE_STEPS의 각 step.stage 필드에서 가져옴) ===
  let stage = wf.currentStep?.stage
  if (stage === undefined) {
    if (discussion.length === 0 && tabled.length === 0 && closed.length === 0) stage = 0
    else if (tabled.length === 0 && discussion.length > 0) stage = 1
    else if (tabled.length > 0 && !isVotingActive) stage = 2
    else if (tabled.length > 0 && isVotingActive) stage = 3
    else stage = 4
  }

  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const isCollaborative = (branchConfig?.legislative?.mode || 'role_based') === 'collaborative'

  const STAGE_INFO = [
    {
      label: '① 준비',
      student: '🔎 법안 발의 전에 필요한 자료를 모으고 쟁점을 확인하세요.',
      teacher: '학생들이 법안 근거 자료를 수집하고 쟁점을 정리하도록 안내하세요.',
    },
    {
      label: '② 법안 발의',
      student: isCollaborative 
        ? '🤝 모둠원들과 함께 [📜 법안 템플릿]을 열고 공동으로 법안을 작성·발의하세요. 실시간으로 함께 수정할 수 있습니다.'
        : '✍️ 위 [내 역할 작업 공간] 에서 자신의 역할 미션을 수행하세요. 법안 작성자는 [📜 법안 템플릿] 으로 4조항을 작성·발의합니다.',
      teacher: isCollaborative
        ? '학생들이 공동 작업 공간에서 법안을 함께 작성하고 발의할 때까지 기다리세요. 모든 모둠이 발의했으면 다음 단계로 넘어가세요.'
        : '학생들이 역할별 미션과 발의 템플릿으로 법안을 발의할 때까지 기다리세요. 모두 발의했으면 다음 단계로 넘어가세요.',
    },
    {
      label: '③ 토의 및 평가',
      student: '🎯 다른 모둠 법안에 댓글로 별점(주제·실현·설득)을 주고 추천을 누르세요.',
      teacher: '⬇️ 토의 카드 중 한 법안의 [✓ 이 법안을 정식 상정] 버튼을 눌러 상정+토론 단계로 넘기세요.',
    },
    {
      label: '④ 상정 토론',
      student: '🎙️ 정식 상정된 법안에 대해 오프라인 토론에 참여하세요. 토론 도구로 입장 표명·준비 카드를 작성합니다.',
      teacher: '⬇️ 정식 상정 카드에서 [🎙️ 이 법안으로 오프라인 토론 시작] → 토론 후 [🎬 전광판 띄우기] 로 표결 단계로.',
    },
    {
      label: '⑤ 표결',
      student: '🗳️ 전광판을 보며 찬/반/기권 중 하나를 선택하세요.',
      teacher: '⬆️ 학생 표결이 끝나면 [표결 마감 + 결과 확정] 을 눌러 의결을 종료하세요.',
    },
    {
      label: '⑥ 발표',
      student: '📢 표결 결과와 의결 종료 법안을 확인하세요.',
      teacher: '📂 발표 단계에서 의결 종료 법안을 확인한 뒤 다음 기사 작성 활동으로 넘어가세요.',
    },
  ]
  const info = STAGE_INFO[stage] || STAGE_INFO[0]
  const stageLabel = info.label
  const nextAction = role === 'student' ? info.student : info.teacher

  const stages = [
    { idx: 0, label: '준비' },
    { idx: 1, label: '발의' },
    { idx: 2, label: '토의·평가' },
    { idx: 3, label: '상정토론' },
    { idx: 4, label: '표결' },
    { idx: 5, label: '발표' },
  ]

  return (
    <section className="bg-white border-2 border-slate-300 rounded-2xl p-3 space-y-2 shadow-sm">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-bold text-slate-800">🏛️ 본회의 진행 단계</h3>
        <span className="text-[11px] text-slate-500">
          토의 {discussion.length} · 상정 {tabled.length} · 종료 {closed.length}
        </span>
      </div>
      {/* 단계 진행 바 */}
      <div className="flex items-center gap-1">
        {stages.map((s, i) => {
          const done = stage > s.idx
          const current = stage === s.idx
          return (
            <div key={s.idx} className="flex-1 flex items-center gap-1">
              <div
                className={`flex-1 h-1.5 rounded-full ${
                  done ? 'bg-emerald-500' : current ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              />
              <span
                className={`text-[10px] font-bold ${
                  done ? 'text-emerald-600' : current ? 'text-indigo-700' : 'text-gray-400'
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
              ? 'bg-indigo-50 border border-indigo-200'
              : 'bg-amber-50 border border-amber-200'
          }`}
        >
          <p className={`text-xs font-bold ${role === 'teacher' ? 'text-indigo-800' : 'text-amber-800'}`}>
            {stageLabel}
          </p>
          <p className={`text-sm mt-0.5 ${role === 'teacher' ? 'text-indigo-900' : 'text-amber-900'}`}>
            {role === 'teacher' ? '👩‍🏫 다음 행동: ' : '👥 다음 행동: '}
            <b>{nextAction}</b>
          </p>
        </div>

        {/* 교사용 이전/다음 단계 제어 버튼 */}
        {role === 'teacher' && (
          <div className="flex md:flex-col gap-2 shrink-0 md:w-32">
            <button
              onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: Math.max(0, stepIndex - 1) }))}
              className="flex-1 px-3 py-1 text-xs rounded-lg bg-white border-2 border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-50"
            >
              ← 이전 단계
            </button>
            <button
              onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: stepIndex + 1 }))}
              className="flex-1 px-3 py-1 text-xs rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm"
            >
              다음 단계 →
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default LegislativeProgressGuide
