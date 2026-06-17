import useGameStore from '../../store/gameStore'
import { updateAt } from '../../lib/rtdb-helpers'

/**
 * 학생 — 이번 페이즈에서 자기 활동을 끝냈음을 알리는 버튼.
 * 모든 학생이 끝내면 교사 대시보드의 ‘다음 페이즈’ 버튼이 깜박임.
 *
 * sticky 하단 바 형태. 학생 페이지 모두에 부착.
 */
function SessionFinishButton() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const students = useGameStore((s) => s.students)
  const currentPhase = useGameStore((s) => s.currentPhase)

  if (role !== 'student' || !myStudentId) return null

  const me = students[myStudentId] || {}
  const finishedAtPhase = me.sessionFinishedAtPhase
  const finished = finishedAtPhase === currentPhase

  const onFinish = async () => {
    await updateAt(roomCode, `students/${myStudentId}`, {
      sessionFinishedAtPhase: currentPhase,
      sessionFinishedAt: Date.now(),
    })
  }

  const onCancel = async () => {
    await updateAt(roomCode, `students/${myStudentId}`, {
      sessionFinishedAtPhase: null,
      sessionFinishedAt: null,
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-30">
      {finished ? (
        <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg">
          <span className="font-bold">✓ 이 차시 끝</span>
          <button
            onClick={onCancel}
            className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={onFinish}
          className="bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-lg font-bold hover:bg-indigo-700 transition"
        >
          ✓ 이 차시 끝냈어요
        </button>
      )}
    </div>
  )
}

export default SessionFinishButton
