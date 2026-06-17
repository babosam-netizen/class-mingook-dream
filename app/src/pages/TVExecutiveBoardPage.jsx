import { useSearchParams } from 'react-router-dom'
import ExecutiveBudgetReviewBoard from '../components/phase3/ExecutiveBudgetReviewBoard'

/**
 * 행정부 예산 초안 검토 전광판 페이지 (TV 송출용 새 창)
 * URL 쿼리 ?room=ROOMCODE 로 방을 식별하여 방송 화면을 표시합니다.
 */
function TVExecutiveBoardPage() {
  const [search] = useSearchParams()
  const roomCode = search.get('room')

  if (!roomCode) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-white text-2xl font-bold">
        ⚠ room 파라미터가 없습니다.
      </div>
    )
  }

  return <ExecutiveBudgetReviewBoard roomCodeProp={roomCode} />
}

export default TVExecutiveBoardPage
