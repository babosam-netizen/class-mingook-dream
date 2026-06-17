import { useWorkflow } from '../../lib/use-workflow'
import useGameStore from '../../store/gameStore'

/**
 * 학생 화면 상단 — 교사가 진행 중인 단계가 차례대로 보임.
 *
 * 가로 스텝 표시: 완료 ✓ / 현재(강조 + 펄스) / 미진행(회색).
 * 학생만 표시. 교사 화면에서는 PhaseWorkflow가 따로 있어 숨김.
 */
function StudentWorkflowProgress({ tone = 'indigo' }) {
  const role = useGameStore((s) => s.role)
  const { steps, stepIndex, currentStep } = useWorkflow()
  if (role !== 'student' || steps.length === 0) return null

  const TONE = {
    indigo:  { current: 'bg-indigo-600 text-white', past: 'bg-indigo-200 text-indigo-700', future: 'bg-gray-100 text-gray-400', label: 'text-indigo-800' },
    amber:   { current: 'bg-amber-600 text-white',  past: 'bg-amber-200 text-amber-700',   future: 'bg-gray-100 text-gray-400', label: 'text-amber-800' },
    rose:    { current: 'bg-rose-600 text-white',   past: 'bg-rose-200 text-rose-700',     future: 'bg-gray-100 text-gray-400', label: 'text-rose-800' },
    slate:   { current: 'bg-slate-700 text-white',  past: 'bg-slate-200 text-slate-700',   future: 'bg-gray-100 text-gray-400', label: 'text-slate-800' },
    pink:    { current: 'bg-pink-600 text-white',   past: 'bg-pink-200 text-pink-700',     future: 'bg-gray-100 text-gray-400', label: 'text-pink-800' },
  }[tone] || { current: 'bg-indigo-600 text-white', past: 'bg-indigo-200 text-indigo-700', future: 'bg-gray-100 text-gray-400', label: 'text-indigo-800' }

  return (
    <section className="bg-white rounded-2xl border-2 shadow-sm p-3">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-1">
        <p className={`text-xs font-bold ${TONE.label}`}>
          📋 지금 진행 중 ({stepIndex + 1}/{steps.length})
        </p>
        {currentStep && (
          <p className="text-sm font-bold">
            {currentStep.studentLabel || currentStep.label}
          </p>
        )}
      </div>

      {/* 가로 스텝 — 모바일에서는 자동 줄바꿈 */}
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {steps.map((s, i) => {
          const done = i < stepIndex
          const cur = i === stepIndex
          const cls = cur
            ? `${TONE.current} animate-pulse font-bold`
            : done
            ? TONE.past
            : TONE.future
          return (
            <li
              key={s.id}
              className={`px-2 py-1 rounded-lg whitespace-nowrap ${cls}`}
              title={s.label}
            >
              {done ? '✓' : i + 1}. {s.studentLabel || s.label}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default StudentWorkflowProgress
