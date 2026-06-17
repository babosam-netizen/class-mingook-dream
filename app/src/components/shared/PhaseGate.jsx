import { Navigate } from 'react-router-dom'
import useGameStore from '../../store/gameStore'
import { PHASE_META } from '../../styles/tokens'

/**
 * 페이즈 게이트
 * - 활성 페이즈가 아니면 안내 화면 또는 홈으로 리다이렉트
 * - role === 'teacher'는 모든 페이즈 자유 접근
 *
 * props:
 *   allowedPhases: number[]  예: [1] = Phase 1에서만 / [3] = Phase 3에서만
 *   readOnlyPhases: number[] (옵션) 읽기 전용 허용 페이즈. 일단 자유 접근
 *   children
 */
function PhaseGate({ allowedPhases = [], readOnlyPhases = [], children }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const currentPhase = useGameStore((s) => s.currentPhase)

  if (!roomCode) {
    return <Navigate to="/" replace />
  }

  // 교사는 자유 접근
  if (role === 'teacher') return children

  if (allowedPhases.includes(currentPhase)) return children
  if (readOnlyPhases.includes(currentPhase)) return children

  const meta = PHASE_META[currentPhase] || PHASE_META[1]

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${meta.pageBg}`}>
      <div className="bg-white p-8 rounded-2xl shadow text-center max-w-md">
        <h2 className={`text-2xl font-bold mb-2 ${meta.titleText}`}>
          이 화면은 다음 차시에 열립니다
        </h2>
        <p className="text-gray-600">
          현재는 <span className="font-bold">{meta.label}</span> 입니다.
        </p>
        <p className="text-sm text-gray-400 mt-4">
          선생님이 페이즈를 전환할 때까지 기다려 주세요.
        </p>
      </div>
    </div>
  )
}

export default PhaseGate
