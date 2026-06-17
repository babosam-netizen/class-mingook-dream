import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { setAt } from '../../lib/rtdb-helpers'
import CandidateCard from './CandidateCard'

/**
 * 투표 모달 — 후보 카드의 ‘투표’ 버튼 → 이 모달에서 확정.
 * - 보통, 평등, 직접, 비밀선거의 원칙 안내 추가
 */
function ElectionVoteModal({ candidate, group, supportStatements = [], onClose, onAfterVote }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)

  const [busy, setBusy] = useState(false)

  const onConfirm = async () => {
    if (!candidate?.groupId) return
    setBusy(true)
    try {
      await setAt(roomCode, `electionVotes/${myStudentId}`, {
        candidateGroupId: candidate.groupId,
        weighted: false,
        at: Date.now(),
      })
      onAfterVote?.(candidate.groupId)
      onClose?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full p-2 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-4 custom-scrollbar">
          <header className="mb-4 text-center px-4 pt-4">
            <h2 className="text-xl font-black text-gray-900">🗳️ 소중한 한 표를 행사해 주세요</h2>
            <div className="mt-2 inline-block px-4 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100">
              "보통, 평등, 직접, 비밀선거의 원칙에 따라 투표해주세요."
            </div>
          </header>

          <CandidateCard 
            candidate={candidate}
            group={group}
            supportStatements={supportStatements}
            previewMode={true} 
          />
          
          <div className="mt-6 px-4 pb-4">
            <div className="bg-rose-50 p-4 rounded-3xl text-sm text-rose-900 font-medium text-center border border-rose-100">
              정말로 <strong className="text-rose-600">{candidate.leaderNumber}번 {candidate.leaderNickname}</strong> 후보에게
              <br />당신의 소중한 한 표를 행사하시겠어요?
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex-1 py-4 rounded-2xl bg-rose-600 text-white font-black shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-50"
              >
                {busy ? '투표 중...' : '확인, 투표하겠습니다!'}
              </button>
              <button
                onClick={onClose}
                disabled={busy}
                className="px-6 py-4 rounded-2xl bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition-all"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ElectionVoteModal
