import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { updateAt } from '../../lib/rtdb-helpers'
import PetitionForm from './PetitionForm'

const PREFIX_COLOR = {
  환경:   'bg-green-600',
  노동:   'bg-orange-600',
  주거:   'bg-blue-600',
  인권:   'bg-purple-600',
  교육:   'bg-yellow-600',
  안전:   'bg-red-600',
  기타:   'bg-gray-600',
}
const FALLBACK_COLOR = 'bg-slate-600'

function getYoutubeId(url = '') {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

function getDomain(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60000) return '방금 전'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
  return `${Math.floor(diff / 86400000)}일 전`
}

/**
 * @param {{petition, rank?: 1|2|3, onTagClick?: (tag) => void}} props
 */
function PetitionCard({ petition: p, rank, onTagClick }) {
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const roomCode = useGameStore((s) => s.roomCode)
  const [zoom, setZoom] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const ytId = getYoutubeId(p.mediaUrl)
  const isMine = p.studentId === myStudentId
  const likedBy = Array.isArray(p.likedBy) ? p.likedBy : []
  const liked = myStudentId ? likedBy.includes(myStudentId) : false
  const colorCls = PREFIX_COLOR[p.prefixTag] || FALLBACK_COLOR

  const toggleLike = async () => {
    if (!myStudentId || isMine || busy) return
    setBusy(true)
    try {
      const nextLiked = liked ? likedBy.filter((x) => x !== myStudentId) : [...likedBy, myStudentId]
      await updateAt(roomCode, `petitions/${p.id}`, {
        likedBy: nextLiked,
        likeCount: nextLiked.length,
      })
    } finally {
      setBusy(false)
    }
  }

  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  const cardCls = rank
    ? 'border-2 border-amber-400 shadow-md bg-gradient-to-br from-amber-50 to-white'
    : 'border border-gray-200 bg-white'

  return (
    <article className={`rounded-2xl p-3.5 shadow-sm space-y-2 ${cardCls}`}>
      {/* 상단: 메달 + 말머리 + 해시태그 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {medal && <span className="text-xl leading-none">{medal}</span>}
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold text-white ${colorCls}`}>
          {p.prefixTag || '기타'}
        </span>
        {Array.isArray(p.hashTags) && p.hashTags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTagClick?.(t)}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
          >
            #{t}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-gray-400">{timeAgo(p.createdAt)}</span>
      </div>

      {/* 제목 */}
      <h3 className="font-bold text-base leading-tight">{p.title}</h3>

      {/* 주장 */}
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="block w-full text-left text-sm text-gray-700 line-clamp-2 hover:bg-gray-50 rounded p-1 -m-1"
        title="클릭하여 전체 보기"
      >
        <span className="text-[10px] font-bold text-amber-700 mr-1">주장 ▸</span>
        {p.claim}
      </button>

      {/* 근거 */}
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="block w-full text-left text-xs text-gray-600 line-clamp-2 hover:bg-gray-50 rounded p-1 -m-1"
        title="클릭하여 전체 보기"
      >
        <span className="text-[10px] font-bold text-blue-700 mr-1">근거 ▸</span>
        {p.evidence}
      </button>

      {/* 미디어 */}
      {p.mediaUrl && (
        <div className="pt-1">
          {ytId ? (
            <a
              href={p.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full aspect-video rounded-lg overflow-hidden bg-black"
            >
              <img
                src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                alt={p.title}
                className="w-full h-full object-cover"
              />
            </a>
          ) : (
            <a
              href={p.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"
            >
              🔗 {getDomain(p.mediaUrl)}
            </a>
          )}
          {p.mediaSummary && (
            <p className="text-xs italic text-gray-500 mt-1.5">"{p.mediaSummary}"</p>
          )}
        </div>
      )}

      {/* 하단: 작성자 + 공감 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="text-[11px] text-gray-500">
          {p.studentNumber ? `${p.studentNumber}번 ` : ''}{p.studentName}
          {p.groupName && <span className="text-gray-400"> · {p.groupName}</span>}
          {isMine && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="ml-2 text-blue-500 hover:underline font-semibold"
            >
              수정
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={toggleLike}
          disabled={isMine || busy || !myStudentId}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ${
            liked
              ? 'bg-red-500 text-white border-red-500 scale-110'
              : isMine
              ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-rose-50 hover:border-rose-300'
          }`}
          title={isMine ? '내 청원에는 공감할 수 없어요' : liked ? '공감 취소' : '공감하기'}
        >
          <span className={`leading-none ${liked ? 'animate-pulse' : ''}`}>
            {liked ? '❤️' : '🤍'}
          </span>
          <span className="font-bold tabular-nums">{p.likeCount || 0}</span>
        </button>
      </div>

      {/* 전체 보기 모달 */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setZoom(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold text-white ${colorCls}`}>
                {p.prefixTag}
              </span>
              {Array.isArray(p.hashTags) && p.hashTags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  #{t}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-bold">{p.title}</h2>
            <div>
              <p className="text-xs font-bold text-amber-700 mb-1">주장</p>
              <p className="text-sm whitespace-pre-wrap">{p.claim}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700 mb-1">근거</p>
              <p className="text-sm whitespace-pre-wrap">{p.evidence}</p>
            </div>
            {p.mediaUrl && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">참고 자료</p>
                <a href={p.mediaUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">
                  {p.mediaUrl}
                </a>
                {p.mediaSummary && <p className="text-xs italic text-gray-500 mt-1">"{p.mediaSummary}"</p>}
              </div>
            )}
            <div className="text-xs text-gray-500 pt-2 border-t flex items-center justify-between">
              <span>
                {p.studentNumber ? `${p.studentNumber}번 ` : ''}{p.studentName}
                {p.groupName && ` · ${p.groupName}`}
              </span>
              <span>❤️ {p.likeCount || 0}</span>
            </div>
            <button
              type="button"
              onClick={() => setZoom(false)}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {isEditing && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
            <PetitionForm editData={p} onCancel={() => setIsEditing(false)} />
          </div>
        </div>
      )}
    </article>
  )
}

export default PetitionCard
export { PREFIX_COLOR, FALLBACK_COLOR }
