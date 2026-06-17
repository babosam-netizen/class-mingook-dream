import useGameStore from '../store/gameStore'
import { getPhaseSteps } from '../components/teacher/PhaseWorkflow'

/**
 * 현재 페이즈의 워크플로 단계 상태를 반환하는 훅.
 * 학생/교사 모두 사용. 학생은 표시 전용.
 *
 * 반환:
 *   steps:        해당 페이즈의 단계 배열
 *   stepIndex:    현재 단계 인덱스
 *   currentStep:  현재 단계 객체 (id, label, highlight, showSummary, ...)
 *   isHighlight(sectionKey): 그 섹션이 현재 강조 대상인지
 *   isPast(sectionKey):     그 섹션의 단계가 이미 지나갔는지
 */
export function useWorkflow() {
  const currentPhase = useGameStore((s) => s.currentPhase)
  const roomData = useGameStore((s) => s.roomData)
  const judicialWorkMode = useGameStore((s) => s.config?.branchConfig?.judicial?.workMode) || 'role'
  const steps = getPhaseSteps(currentPhase, judicialWorkMode)
  const rawIdx = roomData?.workflow?.[`phase${currentPhase}`]?.stepIndex
  const stepIndex = Math.max(0, Math.min(steps.length - 1, Number(rawIdx) || 0))
  const currentStep = steps[stepIndex] || null

  const isHighlight = (sectionKey) =>
    currentStep?.highlight === sectionKey

  const isPast = (sectionKey) => {
    const stepIdx = steps.findIndex((s) => s.highlight === sectionKey)
    return stepIdx >= 0 && stepIdx < stepIndex
  }

  const showSummary = !!currentStep?.showSummary

  return { steps, stepIndex, currentStep, isHighlight, isPast, showSummary, currentPhase }
}
