import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import PollFeed from './PollFeed'

/**
 * 학생 화면 전역 최상단에 뜨는 여론조사 팝업 (교사 강제 호출)
 * roomData.activePopupPoll 에 값이 있으면 모달로 띄움.
 */
function GlobalPollPopup() {
  const role = useGameStore((s) => s.role)
  const activePollId = useGameStore((s) => s.roomData?.activePopupPoll)

  // 학생이 스스로 '닫기'를 누른 폴 ID 상태 (교사가 새 폴을 띄우면 갱신됨)
  const [dismissedId, setDismissedId] = useState(null)

  // 만약 교사가 activePollId를 바꾸면 dismissed 초기화
  useEffect(() => {
    if (activePollId && activePollId !== dismissedId) {
      setDismissedId(null)
    }
  }, [activePollId])

  if (role !== 'student') return null
  if (!activePollId) return null
  if (activePollId === dismissedId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 bg-indigo-600 text-white flex justify-between items-center">
          <h2 className="font-bold text-lg">📣 선생님이 보낸 여론조사</h2>
          <button 
            onClick={() => setDismissedId(activePollId)}
            className="text-white/80 hover:text-white px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <PollFeed targetPollId={activePollId} />
        </div>
        <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
          <button
            onClick={() => setDismissedId(activePollId)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default GlobalPollPopup
