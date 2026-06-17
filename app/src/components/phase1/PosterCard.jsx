import { useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import CommentList from './CommentList'
import MultiAxisRating from '../shared/MultiAxisRating'
import TrustGauge from '../shared/TrustGauge'
import PosterMedia from './PosterMedia'

/**
 * 포스터 카드 — 이미지 + 모둠명 + 슬로건 + 캡션 + 다축 평균 + 댓글 토글
 *
 * props:
 *   poster: { id, groupId, imageUrl, caption, authorStudentId }
 *   ratingsByPoster: { [posterId]: { ratings:[], avg:{logic,feasibility,relevance} } }
 */
function PosterCard({ poster, comments }) {
  const groups = useGameStore((s) => s.groups)
  const [open, setOpen] = useState(false)

  const group = groups[poster.groupId]

  const stats = useMemo(() => {
    const my = (comments || []).filter(
      (c) => c.targetType === 'poster' && c.targetId === poster.id,
    )
    const sum = { logic: 0, feasibility: 0, relevance: 0 }
    let n = 0
    for (const c of my) {
      if (!c.ratings) continue
      n += 1
      sum.logic += Number(c.ratings.logic) || 0
      sum.feasibility += Number(c.ratings.feasibility) || 0
      sum.relevance += Number(c.ratings.relevance) || 0
    }
    if (n === 0) return { avg: { logic: 0, feasibility: 0, relevance: 0 }, n: 0, total: 0 }
    return {
      avg: {
        logic: sum.logic / n,
        feasibility: sum.feasibility / n,
        relevance: sum.relevance / n,
      },
      n,
      total: (sum.logic + sum.feasibility + sum.relevance) / n,
    }
  }, [comments, poster.id])

  const [zoom, setZoom] = useState(false)

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      {(poster.imageUrl || poster.canvaUrl || poster.posterCanvaUrl) && (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="block w-full bg-gray-100 hover:opacity-90 transition"
        >
          <PosterMedia
            poster={poster}
            className="w-full aspect-[4/3]"
            imageClassName="w-full aspect-[4/3] object-cover"
          />
        </button>
      )}
      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoom(false)}
        >
          <PosterMedia
            poster={poster}
            className="w-full max-w-5xl aspect-[4/3] rounded-xl overflow-hidden shadow-2xl cursor-auto"
            imageClassName="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
          />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-sm">{group?.name || '모둠'}</h3>
          <span className="text-xs text-gray-400">
            평가 {stats.n}건
          </span>
        </div>
        {group?.slogan && (
          <p className="text-xs italic text-gray-600">"{group.slogan}"</p>
        )}
        {group?.slogans && Object.keys(group.slogans).length > 0 && (
          <ul className="text-xs italic text-gray-600 space-y-0.5">
            {Object.values(group.slogans)
              .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
              .slice(0, 3)
              .map((s, i) => (
                <li key={i}>
                  "{s.text}" <span className="not-italic text-gray-400">— {s.authorNickname}</span>
                </li>
              ))}
            {Object.keys(group.slogans).length > 3 && (
              <li className="text-gray-400">외 {Object.keys(group.slogans).length - 3}개</li>
            )}
          </ul>
        )}
        {poster.caption && (
          <p className="text-sm text-gray-700">{poster.caption}</p>
        )}
        <MultiAxisRating value={stats.avg} readOnly compact />
        <TrustGauge score={stats.total} max={3} compact />
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          {open ? '댓글 접기 ▲' : '댓글 + 평가 펼치기 ▼'}
        </button>
        {open && (
          <div className="pt-2 border-t">
            <CommentList targetType="poster" targetId={poster.id} />
          </div>
        )}
      </div>
    </div>
  )
}

export default PosterCard
