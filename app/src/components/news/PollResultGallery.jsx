import PollFeed from '../shared/PollFeed'
import CoreIssuePoll from '../phase1/CoreIssuePoll'
import useGameStore from '../../store/gameStore'

function PollResultGallery() {
  const currentPhase = useGameStore((s) => s.currentPhase)

  return (
    <div className="space-y-4">
      {/* 현재 활동까지 공개 가능한 여론조사 결과 */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-4">
        <h2 className="text-lg font-bold text-emerald-800 mb-3 flex items-center gap-2">
          <span>📊 여론조사 아카이브</span>
          <span className="text-xs font-normal bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            현재까지 게시된 결과
          </span>
        </h2>
        <PollFeed newsBoardMode={true} />
        <div className="mt-6 pt-6 border-t border-dashed border-emerald-100">
           <CoreIssuePoll />
        </div>
      </div>
    </div>
  )
}

export default PollResultGallery
