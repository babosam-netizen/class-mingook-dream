import { PHASE_STEPS } from '../components/teacher/PhaseWorkflow'

function stepIndexOf(phase, stepId) {
  const steps = PHASE_STEPS[phase] || []
  return steps.findIndex((step) => step.id === stepId)
}

export function isPlannedPollReached(poll, currentPhase, roomData) {
  const phase = Number(poll?.phaseStep?.phase || 0)
  const stepId = poll?.phaseStep?.stepId
  if (!phase || !stepId) return true
  if (phase < currentPhase) return true
  if (phase > currentPhase) return false

  const steps = PHASE_STEPS[phase] || []
  const currentIndex = Math.max(
    0,
    Math.min(steps.length - 1, Number(roomData?.workflow?.[`phase${phase}`]?.stepIndex) || 0),
  )
  const pollIndex = stepIndexOf(phase, stepId)
  if (pollIndex < 0) return false
  return pollIndex <= currentIndex
}

export function isNewsBoardPollResultVisible(poll, currentPhase, roomData) {
  if (poll?.status !== 'published') return false
  return isPlannedPollReached(poll, currentPhase, roomData)
}
