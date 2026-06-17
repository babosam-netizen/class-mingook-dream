import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { updateAt } from '../../lib/rtdb-helpers'
import { REFLECTION_COLORS } from './ReflectionStructuredEditor'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'
import CommentList from '../phase1/CommentList'
import ReflectionStructuredEditor from './ReflectionStructuredEditor'

const EMOJIS = [
  { key: 'heart',     emoji: '❤️' },
  { key: 'clap',      emoji: '👏' },
  { key: 'lightbulb', emoji: '💡' },
  { key: 'thumbsup',  emoji: '👍' },
]

function TagBadge({ tag }) {
  if (!tag) return null
  return tag === 'fact'
    ? <span className="inline-block text-[9px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded font-bold ml-1">사실</span>
    : <span className="inline-block text-[9px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded font-bold ml-1">의견</span>
}

function ReflectionCard({ reflection }) {
  const role        = useGameStore((s) => s.role)
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const [editing, setEditing] = useState(false)

  const colorMeta = REFLECTION_COLORS.find((c) => c.id === reflection.color) || REFLECTION_COLORS[0]
  const empathy   = reflection.empathy || {}
  const myReact   = reflection.empathyVoters?.[myStudentId] || null
  const isOwn     = reflection.authorStudentId === myStudentId
  const canvaUrl  = reflection.canvaUrl ? formatCanvaEmbedUrl(reflection.canvaUrl) : ''

  const onReact = async (key) => {
    if (!myStudentId) return
    if (myReact === key) {
      await updateAt(roomCode, `reflections/${reflection.id}`, {
        [`empathy/${key}`]: Math.max(0, (empathy[key] || 0) - 1),
        [`empathyVoters/${myStudentId}`]: null,
      })
    } else {
      const updates = {}
      if (myReact) updates[`empathy/${myReact}`] = Math.max(0, (empathy[myReact] || 0) - 1)
      updates[`empathy/${key}`] = (empathy[key] || 0) + 1
      updates[`empathyVoters/${myStudentId}`] = key
      await updateAt(roomCode, `reflections/${reflection.id}`, updates)
    }
  }

  // 수정 모드
  if (editing) {
    return (
      <div className="p-4 rounded-2xl border-2 border-pink-300 shadow-md break-inside-avoid mb-4 bg-white">
        <ReflectionStructuredEditor
          existingReflection={reflection}
          onEditDone={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <article className={`p-4 rounded-2xl border-2 shadow-sm break-inside-avoid mb-4 ${colorMeta.cls}`}>
      {/* 상단 배지들 */}
      <div className="flex flex-wrap gap-1 mb-2">
        {reflection.isPrivate && (
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded font-bold">🔒 비공개</span>
        )}
        {reflection.isModified && (
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">✏️ 수정됨</span>
        )}
        {canvaUrl && (
          <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-bold">🎨 카드뉴스 있음</span>
        )}
      </div>

      {/* 캔바 카드뉴스 — 갤러리에서 바로 보이도록 펼친 상태 */}
      {canvaUrl && (
        <div className="mb-3 rounded-xl overflow-hidden border border-white/80">
          <div className="text-xs text-violet-700 font-bold px-2 py-1 bg-white/60">🎨 카드뉴스</div>
          <div className="aspect-video">
            <iframe src={canvaUrl} className="w-full h-full" frameBorder="0" allowFullScreen title="카드뉴스" />
          </div>
        </div>
      )}

      {/* 구조적 정리글 (신규) */}
      {reflection.p1?.main && (
        <div className="space-y-2 mb-2">
          {[
            { label: '📘 도입', data: reflection.p1 },
            { label: '📗 전개', data: reflection.p2 },
            { label: '📕 마무리', data: reflection.p3 },
          ].map(({ label, data }) => data?.main && (
            <div key={label}>
              <p className="text-[10px] font-bold text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-800">
                {data.main}<TagBadge tag={data.mainTag} />
              </p>
              {data.supportA && (
                <p className="text-xs text-gray-600 pl-2 mt-0.5">
                  ↳ {data.supportA}<TagBadge tag={data.supportATag} />
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 기존 5박스 호환 폴백 */}
      {!reflection.p1 && (
        <>
          {reflection.participation  && <div className="mb-2"><p className="text-[10px] font-bold text-gray-500">1️⃣ 참여한 활동</p><p className="text-sm whitespace-pre-wrap">{reflection.participation}</p></div>}
          {reflection.feelings       && <div className="mb-2"><p className="text-[10px] font-bold text-gray-500">2️⃣ 인상·느낌</p><p className="text-sm whitespace-pre-wrap">{reflection.feelings}</p></div>}
          {reflection.mostImpressive && <div className="mb-2"><p className="text-[10px] font-bold text-gray-500">3️⃣ 가장 인상 깊었던</p><p className="text-sm whitespace-pre-wrap">{reflection.mostImpressive}</p></div>}
          {reflection.newLearnings   && <div className="mb-2"><p className="text-[10px] font-bold text-gray-500">4️⃣ 새로 알게 된 점</p><p className="text-sm whitespace-pre-wrap">{reflection.newLearnings}</p></div>}
          {!reflection.participation && reflection.impressive && <div className="mb-2"><p className="text-[10px] font-bold text-gray-500">인상</p><p className="text-sm whitespace-pre-wrap">{reflection.impressive}</p></div>}
          {!reflection.feelings && reflection.revisit && <div className="mb-2"><p className="text-[10px] font-bold text-gray-500">다시 보고 싶은</p><p className="text-sm whitespace-pre-wrap">{reflection.revisit}</p></div>}
        </>
      )}

      {/* 다짐 */}
      {reflection.pledge && (
        <div className="mb-2 bg-white/60 p-2 rounded-lg">
          <p className="text-[10px] font-bold text-gray-500">5️⃣ 다짐</p>
          <p className="text-sm font-bold whitespace-pre-wrap">{reflection.pledge}</p>
        </div>
      )}

      {/* 마치며 — 갤러리에서 바로 보이도록 펼친 상태 */}
      {reflection.finalEssay && (
        <div className="mb-2 border-t border-white/50 pt-2">
          <p className="text-xs font-semibold text-gray-600">📜 마치며</p>
          <p className="text-sm whitespace-pre-wrap mt-1 bg-white/60 p-2 rounded">{reflection.finalEssay}</p>
        </div>
      )}

      {/* 반려 메모 (본인에게만 표시) */}
      {isOwn && reflection.rejectMemo && reflection.status === 'rejected' && (
        <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
          💬 선생님 메모: {reflection.rejectMemo}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">{reflection.authorNumber}번 {reflection.authorNickname}</p>

      {/* 공감 이모지 */}
      <div className="mt-2 flex gap-1 flex-wrap">
        {EMOJIS.map((e) => {
          const count = empathy[e.key] || 0
          const mine  = myReact === e.key
          return (
            <button key={e.key} onClick={() => onReact(e.key)}
              className={`px-2 py-1 rounded-full text-sm transition ${mine ? 'bg-white shadow ring-2 ring-pink-400' : 'bg-white/60 hover:bg-white'}`}>
              {e.emoji} {count > 0 && count}
            </button>
          )
        })}
      </div>

      {/* 수정 버튼 (본인만) */}
      {isOwn && (
        <button onClick={() => setEditing(true)}
          className="mt-2 text-xs text-pink-600 hover:text-pink-800 font-semibold underline underline-offset-2">
          ✏️ 내 글 수정하기
        </button>
      )}

      {/* 질문·댓글 — 갤러리에서 바로 보이도록 펼친 상태. 답글은 글쓴이(원작자)만 가능 */}
      <div className="mt-3 pt-2 border-t border-white/50">
        <p className="text-xs font-bold text-pink-700 mb-1">
          💬 질문·댓글
          {isOwn && <span className="ml-1 text-[10px] font-normal text-gray-500">— 친구들 질문에 답글을 달 수 있어요</span>}
        </p>
        <CommentList
          targetType="reflection"
          targetId={reflection.id}
          allowReplies
          ownerStudentId={reflection.authorStudentId}
        />
      </div>
    </article>
  )
}

export default ReflectionCard
