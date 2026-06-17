import { useEffect, useRef, useState } from 'react'

/**
 * 가로 자동 흐름 캐러셀 — 신문기사·영상 양쪽 모두 사용.
 *
 * 영상 카드(YouTube)는 자동으로 썸네일 추출(img.youtube.com/vi/{id}/mqdefault.jpg)
 *
 * props:
 *   items: { id, title, thumbnail, source, type, url, submitter*, addedByTeacher }
 *   emptyText: 비었을 때 표시할 안내 문구 ('아직 공유된 기사가 없어요')
 */
const STEP_MS = 3500
const CARD_WIDTH = 200

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

const TYPE_PLACEHOLDER = {
  youtube: { emoji: '▶️', cls: 'from-red-100 to-red-50' },
  canva:   { emoji: '🎨', cls: 'from-violet-100 to-violet-50' },
  vimeo:   { emoji: '🎬', cls: 'from-sky-100 to-sky-50' },
  news:    { emoji: '📰', cls: 'from-blue-100 to-blue-50' },
  other:   { emoji: '🔗', cls: 'from-gray-100 to-gray-50' },
}

function NewsCarousel({ items, emptyText = '아직 공유된 자료가 없어요.' }) {
  const trackRef = useRef(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || items.length <= 1) return
    const id = setInterval(() => {
      const el = trackRef.current
      if (!el) return
      const max = el.scrollWidth - el.clientWidth
      const next = el.scrollLeft + CARD_WIDTH + 8
      if (next >= max - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollTo({ left: next, behavior: 'smooth' })
      }
    }, STEP_MS)
    return () => clearInterval(id)
  }, [paused, items.length])

  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-3 bg-white/40 rounded-lg border border-dashed">
        {emptyText}
      </p>
    )
  }

  return (
    <div
      ref={trackRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1"
      style={{ scrollbarWidth: 'thin' }}
    >
      {items.map((l) => {
        const thumb = resolveThumb(l)
        const ph = TYPE_PLACEHOLDER[l.type] || TYPE_PLACEHOLDER.other
        return (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="snap-start flex-shrink-0 bg-white rounded-lg border hover:border-blue-400 hover:shadow transition overflow-hidden"
            style={{ width: CARD_WIDTH }}
          >
            {thumb ? (
              <img
                src={thumb}
                alt=""
                className="w-full aspect-video object-cover bg-gray-100"
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <div
                className={`w-full aspect-video bg-gradient-to-br ${ph.cls} flex items-center justify-center text-2xl`}
              >
                {ph.emoji}
              </div>
            )}
            <div className="p-2 space-y-0.5">
              <h4 className="font-bold text-[11px] leading-snug line-clamp-2 min-h-[2.4em]">
                {l.title}
              </h4>
              {l.source && (
                <p className="text-[9px] text-blue-700 font-semibold truncate">
                  {l.source}
                </p>
              )}
              <p className="text-[9px] text-gray-400 truncate">
                {l.addedByTeacher
                  ? '👩‍🏫'
                  : l.submitterNickname
                  ? `${l.submitterNumber}번 ${l.submitterNickname}`
                  : ''}
              </p>
            </div>
          </a>
        )
      })}
    </div>
  )
}

export default NewsCarousel
