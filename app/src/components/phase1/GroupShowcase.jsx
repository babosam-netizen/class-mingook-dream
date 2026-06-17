import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { topicBg } from '../../styles/tokens'
import MultiAxisRating from '../shared/MultiAxisRating'
import CommentList from './CommentList'
import PosterMedia from './PosterMedia'

// YouTube 썸네일 자동 추출
function getYoutubeId(url = '') {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}
function resolveThumb(item) {
  if (item.thumbnail) return item.thumbnail
  if (item.type === 'youtube') {
    const id = getYoutubeId(item.url)
    if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`
  }
  return null
}
const TYPE_PH = {
  youtube: { emoji: '▶️', cls: 'bg-red-50' },
  canva:   { emoji: '🎨', cls: 'bg-violet-50' },
  vimeo:   { emoji: '🎬', cls: 'bg-sky-50' },
  news:    { emoji: '📰', cls: 'bg-blue-50' },
  other:   { emoji: '🔗', cls: 'bg-gray-50' },
}

/** 가로형 미니 카드 — 썸네일 좌측 + 헤드라인·출처 우측 */
export function MiniCard({ item, myStudentId, roomCode, onEditLink }) {
  const thumb = resolveThumb(item)
  const ph = TYPE_PH[item.type] || TYPE_PH.other
  
  const isMine = myStudentId && item.submitterStudentId === myStudentId

  const handleDelete = async (e) => {
    e.preventDefault()
    if (!confirm('정말 삭제할까요?')) return
    try {
      const { removeAt } = await import('../../lib/rtdb-helpers')
      await removeAt(roomCode, `links/${item.id}`)
    } catch (err) {
      alert('삭제 실패: ' + err.message)
    }
  }

  const handleEdit = (e) => {
    e.preventDefault()
    onEditLink?.(item.id)
  }

  return (
    <div className="relative group/card">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="flex gap-2 bg-white rounded-md p-1.5 hover:bg-blue-50 transition border border-transparent hover:border-blue-200"
      >
      <div className="w-14 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-base ${ph.cls}`}>
            {ph.emoji}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <h5 className="text-[11px] font-bold line-clamp-2">{item.title}</h5>
        {item.source && (
          <p className="text-[9px] text-blue-700 truncate">{item.source}</p>
        )}
      </div>
      </a>
      {isMine && (
        <div className="absolute right-1 top-1 bottom-1 flex flex-col justify-center gap-1 opacity-100 transition">
          <button 
            onClick={handleEdit} 
            className="w-5 h-5 bg-white border border-gray-200 rounded shadow-sm flex items-center justify-center text-[10px] hover:bg-gray-50"
            title="수정"
          >
            ✏️
          </button>
          <button 
            onClick={handleDelete} 
            className="w-5 h-5 bg-white border border-red-200 rounded shadow-sm flex items-center justify-center text-[10px] hover:bg-red-50 text-red-500"
            title="삭제"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}

/** 미니 리스트 — 최대 N개 카드, 초과 시 페이지네이션 */
export function MiniLinkList({ items, max = 2, emptyText, accent = 'blue', myStudentId, roomCode, onEditLink }) {
  const [page, setPage] = useState(1)
  if (items.length === 0) {
    return (
      <p className="text-[10px] text-gray-400 text-center py-2 bg-white/40 rounded border border-dashed">
        {emptyText}
      </p>
    )
  }

  const totalPages = Math.ceil(items.length / max)
  const safePage = Math.min(page, totalPages)
  const shown = items.slice((safePage - 1) * max, safePage * max)

  return (
    <div className="space-y-1">
      <div className="min-h-[90px] space-y-1">
        {shown.map((l) => (
          <MiniCard 
            key={l.id} 
            item={l} 
            myStudentId={myStudentId} 
            roomCode={roomCode} 
            onEditLink={onEditLink} 
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1.5 mt-1">
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-4 h-4 text-[9px] flex items-center justify-center rounded border transition ${
                  safePage === p
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 모둠 단위 통합 카드 — 시민단체 1팀의 모든 활동(슬로건·포스터·기사)을 한 박스에.
 *
 * - 세로 포스터(3:4) + 그 위에 슬로건 오버레이
 * - 포스터 미게시 모둠은 점선 박스 + "📷 준비 중"
 * - 자기 모둠은 슬로건/포스터 인라인 편집 + 강조 ring
 * - 신문기사는 작은 가로 캐러셀로 포스터 아래
 *
 * props:
 *   group, posters, essays, newsLinks, videoLinks, articles, comments, topicMeta, isMine, myStudentId
 */
function GroupShowcase({
  group,
  posters,
  essays = [],
  newsLinks,
  videoLinks = [],
  articles = [],
  comments,
  topicMeta,
  isMine,
  myStudentId,
  roomCode,
  onEditEssay,
}) {
  const config = useGameStore(s => s.config)
  const acts = config?.phase1Activities || { poster: true, essay: true, news: true, video: true, article: true }
  const [zoom, setZoom] = useState(false)

  const color = topicMeta?.color || group?.color || 'sky'
  const latest = posters[0] // 최근 1장만
  const slogansArr = Object.entries(group?.slogans || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  const memberList = Object.keys(group?.members || {})

  // 받은 평가 평균
  const ratings = comments
    .filter(
      (c) =>
        c.targetType === 'poster' &&
        posters.some((p) => p.id === c.targetId) &&
        c.ratings,
    )
    .map((c) => c.ratings)
  const avg = ratings.length
    ? {
        logic:       ratings.reduce((a, r) => a + (r.logic || 0), 0) / ratings.length,
        feasibility: ratings.reduce((a, r) => a + (r.feasibility || 0), 0) / ratings.length,
        relevance:   ratings.reduce((a, r) => a + (r.relevance || 0), 0) / ratings.length,
      }
    : null

  return (
    <article
      className={`p-3 rounded-2xl border-2 transition ${topicBg(color)} ${
        isMine ? 'ring-4 ring-indigo-400/60 ring-offset-2' : ''
      }`}
    >
      {/* 헤더 */}
      <header className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="font-bold text-base">
            {topicMeta?.emoji} {group?.name || '모둠'}
            {isMine && <span className="ml-1 text-xs text-indigo-700">· 우리 모둠</span>}
          </h3>
          <p className="text-[11px] text-gray-500">
            {memberList.length}명 · 평가 {ratings.length}건
            {avg && ` · 평균 ${((avg.logic + avg.feasibility + avg.relevance) / 3).toFixed(1)}`}
          </p>
        </div>
      </header>

      {/* 슬로건 마퀴 */}
      {slogansArr.length > 0 && (() => {
        const baseLen = slogansArr.length
        const repeatCount = Math.max(2, Math.ceil(8 / baseLen) * 2)
        const repeated = []
        for (let i = 0; i < repeatCount; i++) repeated.push(...slogansArr)
        const duration = baseLen * 7
        return (
          <div className="mb-2 overflow-hidden bg-white/60 rounded-lg py-1.5 border">
            <div
              className="flex gap-8 whitespace-nowrap text-sm slogan-marquee"
              style={{ animationDuration: `${duration}s` }}
            >
              {repeated.map((s, i) => (
                <span key={`${s.id}-${i}`} className="inline-flex items-center gap-1 flex-shrink-0">
                  <span className="text-amber-700">•</span>
                  <span className="italic font-semibold">"{s.text}"</span>
                  <span className="text-[11px] text-gray-500">
                    — {s.authorNumber}번 {s.authorNickname}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 gap-3">
        {/* 포스터 영역 [Antigravity] */}
        {acts.poster && (
          latest?.imageUrl || latest?.canvaUrl || latest?.posterCanvaUrl ? (
            <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 shadow-inner border">
              <button
                type="button"
                onClick={() => setZoom(true)}
                className="block w-full aspect-[3/4] flex items-center justify-center"
              >
                <PosterMedia
                  poster={latest}
                  className="w-full h-full"
                  imageClassName="max-w-full max-h-full object-contain"
                />
              </button>
              {latest?.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-[10px] backdrop-blur-sm">
                  {latest.caption}
                </div>
              )}
            </div>
          ) : (
             <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-white/50 border-2 border-dashed border-gray-300 text-gray-400 rounded-xl">
               <span className="text-2xl mb-1">📷</span>
               <span className="text-[10px] font-semibold">포스터 준비 중</span>
             </div>
          )
        )}

        {/* 주장하는 글 영역 [Antigravity] */}
        {acts.essay && (
          essays.length > 0 ? (
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200 space-y-2 shadow-sm">
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                ✍️ 주장하는 글 {essays.length}개
              </h4>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {essays.map((essay) => {
                  const mine = essay.authorStudentId === myStudentId
                  return (
                    <div key={essay.id} className={`space-y-1.5 p-2 rounded-lg border ${mine ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-100' : 'bg-white/70 border-emerald-100'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-emerald-900 truncate">{essay.title}</p>
                          <p className="text-[9px] text-gray-400">
                            {essay.authorNumber ? `${essay.authorNumber}번 ` : ''}{essay.authorNickname || '작성자'}
                            {mine && <span className="ml-1 text-emerald-700 font-black">· 내 글</span>}
                          </p>
                        </div>
                        {isMine && mine && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onEditEssay?.(essay.id)}
                              className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 text-[10px] text-emerald-700 font-bold hover:bg-emerald-100"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('주장하는 글을 삭제할까요?')) return
                                try {
                                  const { removeAt } = await import('../../lib/rtdb-helpers')
                                  await removeAt(roomCode, `essays/${essay.id}`)
                                } catch (err) {
                                  alert('삭제 실패: ' + err.message)
                                }
                              }}
                              className="px-1.5 py-0.5 rounded bg-white border border-rose-200 text-[10px] text-rose-500 font-bold hover:bg-rose-50"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="bg-emerald-50/50 p-1.5 rounded border border-emerald-100">
                        <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-tighter">[문제 제기]</p>
                        <p className="text-[11px] leading-tight text-gray-800 font-medium">{essay.claim}</p>
                      </div>
                      <div className="px-1.5">
                        <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-tighter">[문제 근거]</p>
                        <p className="text-[11px] leading-tight text-gray-700 whitespace-pre-wrap">{essay.evidence}</p>
                      </div>
                      {essay.impact && (
                        <div className="px-1.5">
                          <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-tighter">[실제 상황/피해]</p>
                          <p className="text-[11px] leading-tight text-gray-700 whitespace-pre-wrap">{essay.impact}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            !acts.poster && (
              <div className="w-full py-6 flex flex-col items-center justify-center bg-white/50 border-2 border-dashed border-gray-300 text-gray-400 rounded-xl">
                <span className="text-xl mb-1">✍️</span>
                <span className="text-[10px] font-semibold">주장하는 글 준비 중</span>
              </div>
            )
          )
        )}
      </div>


      {/* 관련 기사·영상·작성글 — 2단 그리드 [Antigravity] */}
      <div className="mt-2 pt-2 border-t border-white/60 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {acts.news && (
            <div>
              <p className="text-[11px] font-semibold text-blue-700 mb-1">
                📰 관련 기사 {newsLinks.length > 0 ? `· ${newsLinks.length}` : ''}
              </p>
              <MiniLinkList
                items={newsLinks}
                max={2}
                emptyText="📰 준비 중"
                accent="blue"
              />
            </div>
          )}
          {acts.video && (
            <div>
              <p className="text-[11px] font-semibold text-rose-700 mb-1">
                🎬 관련 영상 {videoLinks.length > 0 ? `· ${videoLinks.length}` : ''}
              </p>
              <MiniLinkList
                items={videoLinks}
                max={2}
                emptyText="🎬 준비 중"
                accent="rose"
              />
            </div>
          )}
        </div>

        {/* 작성한 기사 (뉴스보드) [Antigravity] */}
        {acts.article && (
          <div className="bg-white/40 p-2 rounded-lg border border-indigo-100">
            <p className="text-[11px] font-semibold text-indigo-700 mb-1.5 flex items-center gap-1">
              📋 작성한 기사 {articles.length > 0 ? `· ${articles.length}` : ''}
            </p>
            {articles.length === 0 ? (
              <p className="text-[10px] text-gray-400 text-center py-1 italic">작성된 기사가 없습니다</p>
            ) : (
              <div className="space-y-1">
                {articles.slice(0, 2).map(a => (
                  <div key={a.id} className="bg-white/80 p-1.5 rounded border text-[10px] shadow-sm truncate">
                    <span className="font-bold text-indigo-600">[{a.perspective === 'pro' ? '옹호' : a.perspective === 'con' ? '비판' : '중립'}]</span> {a.headline}
                  </div>
                ))}
                {articles.length > 2 && <p className="text-[9px] text-gray-400 text-right">+ {articles.length - 2}개 더 있음</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 댓글·평가 — 항상 노출 */}
      {latest && (
        <div className="mt-2 pt-2 border-t border-white/60">
          <p className="text-[11px] font-semibold text-indigo-700 mb-1">
            💬 댓글·평가 ·{' '}
            {comments.filter((c) => c.targetType === 'poster' && c.targetId === latest.id).length}
            건
          </p>
          {avg && (
            <div className="mb-2">
              <MultiAxisRating value={avg} readOnly compact />
            </div>
          )}
          <CommentList
            targetType="poster"
            targetId={latest.id}
            targetGroupId={group?.id || latest.groupId}
          />
        </div>
      )}

      {/* 풀스크린 라이트박스 */}
      {zoom && (latest?.imageUrl || latest?.canvaUrl || latest?.posterCanvaUrl) && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoom(false)}
        >
          <PosterMedia
            poster={latest}
            className="w-full max-w-5xl aspect-[4/3] rounded-xl overflow-hidden shadow-2xl cursor-auto"
            imageClassName="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
          />
        </div>
      )}
    </article>
  )
}

export default GroupShowcase
