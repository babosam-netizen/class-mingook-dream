import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import { subscribe } from '../lib/rtdb-helpers'
import { topicBg } from '../styles/tokens'
import MultiAxisRating from '../components/shared/MultiAxisRating'
import TrustGauge from '../components/shared/TrustGauge'
import PosterMedia from '../components/phase1/PosterMedia'

/**
 * 포스터 갤러리 — 큰 화면 송출용 + 교사 검토용.
 *
 * 라우트 /gallery (HashRouter라 #/gallery)
 *
 * 모드:
 *   - 'showcase' 모드: 큰 그리드, 모둠별 포스터·슬로건·평가 평균
 *   - 'review' 모드: 송출용 + 댓글·평가 자세히
 */
function PosterGalleryPage() {
  const navigate = useNavigate()
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const className = useGameStore((s) => s.className)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)

  const [postersMap, setPostersMap] = useState({})
  const [commentsMap, setCommentsMap] = useState({})
  const [linksMap, setLinksMap] = useState({})
  const [zoom, setZoom] = useState(null) // 풀스크린 이미지
  const [mode, setMode] = useState('showcase') // 'showcase'|'review'
  const [showPosters, setShowPosters] = useState(true)
  const [showLinks, setShowLinks] = useState(true)

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'posters', (d) => setPostersMap(d || {})),
      subscribe(roomCode, 'comments', (d) => setCommentsMap(d || {})),
      subscribe(roomCode, 'links', (d) => setLinksMap(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  const posters = useMemo(
    () =>
      Object.entries(postersMap)
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [postersMap],
  )
  const comments = useMemo(
    () => Object.entries(commentsMap).map(([id, c]) => ({ id, ...c })),
    [commentsMap],
  )
  const approvedLinks = useMemo(
    () =>
      Object.entries(linksMap)
        .map(([id, l]) => ({ id, ...l }))
        .filter((l) => l.status === 'approved'),
    [linksMap],
  )

  const groupStats = useMemo(() => {
    const out = {}
    for (const gid of Object.keys(groups)) {
      const myPosters = posters.filter((p) => p.groupId === gid).map((p) => p.id)
      const my = comments.filter(
        (c) => c.targetType === 'poster' && myPosters.includes(c.targetId),
      )
      const sum = { logic: 0, feasibility: 0, relevance: 0 }
      let n = 0
      for (const c of my) {
        if (!c.ratings) continue
        n += 1
        sum.logic += c.ratings.logic || 0
        sum.feasibility += c.ratings.feasibility || 0
        sum.relevance += c.ratings.relevance || 0
      }
      out[gid] = {
        n,
        avg: n
          ? {
              logic: sum.logic / n,
              feasibility: sum.feasibility / n,
              relevance: sum.relevance / n,
            }
          : { logic: 0, feasibility: 0, relevance: 0 },
        total: n ? (sum.logic + sum.feasibility + sum.relevance) / n : 0,
      }
    }
    return out
  }, [groups, posters, comments])

  // 모둠 단위로 묶음 (모둠당 첫 포스터 + 모둠별 평균)
  const byGroup = useMemo(() => {
    return Object.entries(groups).map(([gid, g]) => {
      const gPosters = posters.filter((p) => p.groupId === gid)
      const stats = groupStats[gid] || { n: 0, avg: {}, total: 0 }
      const topicMeta = config?.topics?.[g?.topic]
      return {
        gid,
        group: g,
        posters: gPosters,
        stats,
        color: topicMeta?.color || g?.color,
      }
    })
  }, [groups, posters, groupStats, config])

  return (
    <div className="min-h-screen bg-amber-50">
      {/* 상단 송출용 헤더 */}
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="font-bold text-amber-700">📷 캠페인 갤러리</span>
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
            {className || '학급'}
          </span>
          <span className="text-xs text-gray-500">
            {posters.length}개 포스터 · {approvedLinks.length}개 링크
          </span>

          <div className="ml-auto flex gap-1 flex-wrap">
            {/* 모드 */}
            <button
              onClick={() => setMode('showcase')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                mode === 'showcase'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              📺 송출
            </button>
            <button
              onClick={() => setMode('review')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                mode === 'review'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              🔍 검토
            </button>

            {/* 표시 토글 */}
            <span className="w-px bg-gray-300 mx-1" aria-hidden="true" />
            <button
              onClick={() => setShowPosters((v) => !v)}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                showPosters
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              📷 포스터 {showPosters ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowLinks((v) => !v)}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                showLinks
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              📺 링크 {showLinks ? 'ON' : 'OFF'}
            </button>

            <span className="w-px bg-gray-300 mx-1" aria-hidden="true" />
            <button
              onClick={() => (role === 'teacher' ? navigate('/teacher') : navigate('/'))}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              ← 돌아가기
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-6">
        {showPosters && posters.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center text-gray-400 text-lg">
            아직 올라온 포스터가 없어요.
          </div>
        )}
        {showPosters && posters.length > 0 && (
          <div
            className={
              mode === 'showcase'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'grid grid-cols-1 lg:grid-cols-2 gap-6'
            }
          >
            {byGroup.map(({ gid, group, posters: gPosters, stats, color }) => {
              if (gPosters.length === 0) return null
              return gPosters.map((p) => (
                <article
                  key={p.id}
                  className={`rounded-3xl border-2 overflow-hidden shadow-lg ${topicBg(color)}`}
                >
                  {(p.imageUrl || p.canvaUrl || p.posterCanvaUrl) && (
                    <button
                      type="button"
                      onClick={() => setZoom(p)}
                      className={`block w-full hover:opacity-90 transition ${
                        mode === 'review' ? 'bg-gray-100' : 'bg-gray-100'
                      }`}
                    >
                      <PosterMedia
                        poster={p}
                        className={mode === 'review' ? 'w-full aspect-[4/3]' : 'w-full aspect-[4/3]'}
                        imageClassName={
                          mode === 'review'
                            ? 'w-full max-h-[70vh] object-contain'
                            : 'w-full aspect-[4/3] object-cover'
                        }
                      />
                    </button>
                  )}
                  <div className="p-4 space-y-2">
                    <header>
                      <h2 className="text-xl font-bold">{group?.name || gid}</h2>
                      {group?.slogan && (
                        <p className="text-sm italic text-gray-700">"{group.slogan}"</p>
                      )}
                    </header>

                    {p.caption && (
                      <p className="text-sm text-gray-800">{p.caption}</p>
                    )}

                    {mode === 'review' && (
                      <>
                        <div className="pt-2 border-t border-white/60">
                          <p className="text-xs font-semibold text-gray-600 mb-1">
                            받은 평가 ({stats.n}건)
                          </p>
                          <MultiAxisRating value={stats.avg} readOnly compact />
                          <TrustGauge score={stats.total} max={3} compact />
                        </div>
                      </>
                    )}
                  </div>
                </article>
              ))
            })}
          </div>
        )}

        {/* 둘 다 OFF인 경우 */}
        {!showPosters && !showLinks && (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center text-gray-400 text-lg">
            상단에서 ‘포스터’ 또는 ‘링크’를 켜 주세요.
          </div>
        )}

        {/* 승인된 영상·캔바 링크 — showLinks ON 일 때만 */}
        {showLinks && approvedLinks.length > 0 && (
          <section className={showPosters ? 'mt-10' : ''}>
            <h2 className="text-2xl font-bold text-amber-800 mb-3">
              📺 승인된 영상·캔바 링크
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedLinks.map((l) => {
                const ytMatch = l.url?.match(
                  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
                )
                const ytId = l.type === 'youtube' && ytMatch ? ytMatch[1] : null
                const group = l.groupId ? groups[l.groupId] : null
                return (
                  <li
                    key={l.id}
                    className="bg-white rounded-2xl border shadow-sm overflow-hidden"
                  >
                    {ytId ? (
                      <div className="aspect-video bg-black">
                        <iframe
                          title={l.title}
                          src={`https://www.youtube.com/embed/${ytId}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gray-100 flex items-center justify-center text-5xl">
                        {l.type === 'canva' ? '🎨' : '🔗'}
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="font-bold text-sm">{l.title}</h3>
                      {group && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {group.name}
                        </p>
                      )}
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        새 탭에서 열기 ↗
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </main>

      {/* 풀스크린 라이트박스 */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoom(null)}
        >
          <PosterMedia
            poster={zoom}
            className="w-full max-w-5xl aspect-[4/3] rounded-xl overflow-hidden shadow-2xl cursor-auto"
            imageClassName="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  )
}

export default PosterGalleryPage
