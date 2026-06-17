import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, removeAt } from '../../lib/rtdb-helpers'
import { topicBg } from '../../styles/tokens'
import NewsCarousel from './NewsCarousel'

const TYPE_LABEL = {
  youtube: { label: 'YouTube', emoji: '▶️', cls: 'bg-red-100 text-red-700' },
  vimeo:   { label: 'Vimeo',   emoji: '🎬', cls: 'bg-sky-100 text-sky-700' },
  canva:   { label: 'Canva',   emoji: '🎨', cls: 'bg-violet-100 text-violet-700' },
  other:   { label: '링크',    emoji: '🔗', cls: 'bg-gray-100 text-gray-700' },
}

function getYoutubeId(url) {
  const m1 = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/)
  return m1 ? m1[1] : null
}

function LinkBoard() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const [linksMap, setLinksMap] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'links', (d) => setLinksMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const { videos, news } = useMemo(() => {
    const arr = Object.entries(linksMap)
      .map(([id, l]) => ({ id, ...l }))
      .filter((l) => l.status === 'approved')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return {
      videos: arr.filter((l) => l.type !== 'news'),
      news: arr.filter((l) => l.type === 'news'),
    }
  }, [linksMap])

  if (videos.length === 0 && news.length === 0) return null

  const removeMine = (id) => {
    if (!confirm('이 링크를 삭제할까요?')) return
    removeAt(roomCode, `links/${id}`)
  }
  const canDelete = (l) =>
    role === 'teacher' || (l.submitterStudentId === myStudentId)

  return (
    <div className="space-y-6">
      {/* 영상·캔바 */}
      {videos.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-bold text-amber-800">📺 영상·캔바 자료실</h2>
            <span className="text-xs text-gray-500">{videos.length}개</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {videos.map((l) => {
              const meta = TYPE_LABEL[l.type] || TYPE_LABEL.other
              const ytId = l.type === 'youtube' ? getYoutubeId(l.url) : null
              const group = l.groupId ? groups[l.groupId] : null
              return (
                <article
                  key={l.id}
                  className="bg-white rounded-2xl shadow-sm border overflow-hidden"
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
                      {meta.emoji}
                    </div>
                  )}
                  <div className="p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {group && <span className="text-gray-500">{group.name}</span>}
                    </div>
                    <h3 className="font-bold text-sm">{l.title}</h3>
                    <p className="text-xs text-gray-500">
                      {l.addedByTeacher
                        ? '👩‍🏫 선생님이 공유'
                        : `${l.submitterNumber}번 ${l.submitterNickname}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        새 탭에서 열기 ↗
                      </a>
                      {canDelete(l) && (
                        <button
                          onClick={() => removeMine(l.id)}
                          className="ml-auto text-xs text-gray-400 hover:text-red-600"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* 신문기사 — 모둠별 구역 + 가로 캐러셀 */}
      {news.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-bold text-blue-800">📰 관련 신문기사</h2>
            <span className="text-xs text-gray-500">{news.length}개 · 호버 시 멈춤</span>
          </div>
          <div className="space-y-4">
            {/* 모둠별 그룹화: 모둠이 있는 학생이 올린 건 모둠 카드 안에, 없으면 ‘기타’ */}
            {(() => {
              // 모둠별 group + ‘기타(groupId 없음)’
              const buckets = []
              for (const [gid, g] of Object.entries(groups)) {
                const list = news.filter((n) => n.groupId === gid)
                if (list.length > 0) buckets.push({ gid, group: g, list })
              }
              const orphan = news.filter(
                (n) => !n.groupId || !groups[n.groupId],
              )
              if (orphan.length > 0) buckets.push({ gid: '__orphan', group: null, list: orphan })

              return buckets.map(({ gid, group, list }) => {
                const topicMeta = group ? config?.topics?.[group?.topic] : null
                const color = topicMeta?.color || group?.color || 'sky'
                return (
                  <section
                    key={gid}
                    className={`rounded-2xl border-2 p-3 ${topicBg(color)}`}
                  >
                    <header className="flex items-baseline justify-between mb-2">
                      <h3 className="font-bold text-base">
                        {group?.name || '기타 / 모둠 미지정'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {list.length}개 기사
                      </span>
                    </header>
                    <NewsCarousel items={list} />
                    {/* 본인 작성한 카드 삭제 — 캐러셀 아래 행 */}
                    {role !== null && (
                      <div className="flex flex-wrap gap-1 mt-2 text-[10px]">
                        {list
                          .filter((l) => canDelete(l))
                          .map((l) => (
                            <button
                              key={l.id}
                              onClick={() => removeMine(l.id)}
                              className="text-gray-400 hover:text-red-600 truncate max-w-[180px]"
                              title={l.title}
                            >
                              ✕ {l.title}
                            </button>
                          ))}
                      </div>
                    )}
                  </section>
                )
              })
            })()}
          </div>
        </section>
      )}
    </div>
  )
}

export default LinkBoard
