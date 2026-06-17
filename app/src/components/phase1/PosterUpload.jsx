import { useState, useEffect } from 'react'
import useGameStore from '../../store/gameStore'
import { setAt, pushUnder } from '../../lib/rtdb-helpers'
import { extractCanvaUrl, formatCanvaEmbedUrl } from '../../lib/canva-embed'

/**
 * 포스터 등록 — 학생이 자기 모둠 이름으로 캠페인 포스터를 한 장 올린다.
 * 이미지 파일 직접 업로드는 보안/관리 이유로 제거하고 Canva 임베드만 사용한다.
 * (기존에 올린 이미지 포스터는 갤러리에서 그대로 표시됨)
 *
 * props:
 *   groupId (필수) — 자기 모둠 ID
 *   posterId (선택) — 기존 포스터 수정 시 ID
 *   onSuccess (선택) — 업로드 성공 시 콜백
 */
function PosterUpload({ groupId, posterId, existingPoster, onSuccess }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)

  const [canvaUrl, setCanvaUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 수정 시 기존 값 세팅
  useEffect(() => {
    if (posterId && existingPoster) {
      setCaption(existingPoster.caption || '')
      setCanvaUrl(existingPoster.canvaUrl || existingPoster.posterCanvaUrl || '')
    } else {
      setCaption('')
      setCanvaUrl('')
    }
  }, [posterId, existingPoster?.createdAt, existingPoster?.updatedAt])

  const onSubmit = async () => {
    if (!canvaUrl.trim()) {
      setError('Canva 임베드 코드나 공유 링크를 붙여넣어 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = {
        groupId,
        imageUrl: null,
        canvaUrl: extractCanvaUrl(canvaUrl),
        posterType: 'canva',
        caption: caption.trim(),
        authorStudentId: myStudentId,
        updatedAt: Date.now(),
      }
      if (posterId) {
        await setAt(roomCode, `posters/${posterId}`, data)
      } else {
        await pushUnder(roomCode, `posters`, data)
      }
      setCanvaUrl('')
      setCaption('')
      onSuccess?.()
    } catch (e) {
      console.error('Poster Save Error:', e)
      setError('저장 실패: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-amber-200 h-full space-y-3">
      <h3 className="font-bold text-amber-800 flex items-center gap-1 text-lg">
        🎨 캠페인 포스터 (Canva)
        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm ml-1">모둠 공통 1장</span>
      </h3>

      <div className="space-y-3">
        <label className="block">
          <span className="block text-sm text-gray-500 mb-2">
            Canva에서 만든 포스터의 <b>공유 링크</b>나 <b>임베드 코드</b>를 붙여넣으세요. 후보 등록 화면과 같은 방식으로 표시됩니다.
          </span>
          <textarea
            value={canvaUrl}
            onChange={(e) => setCanvaUrl(extractCanvaUrl(e.target.value))}
            rows={3}
            placeholder='<iframe ...> 또는 https://www.canva.com/design/...'
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </label>

        {canvaUrl && (
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border bg-gray-50">
            <iframe
              src={formatCanvaEmbedUrl(canvaUrl)}
              allowFullScreen
              allow="fullscreen"
              className="absolute inset-0 w-full h-full border-0"
              title="Canva 포스터 미리보기"
            />
          </div>
        )}

        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="포스터 한 줄 설명 (선택)"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          maxLength={50}
        />

        <button
          onClick={onSubmit}
          disabled={busy || !canvaUrl.trim()}
          className="w-full py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50 hover:bg-indigo-700"
        >
          {busy ? (posterId ? '수정 중...' : '올리는 중...') : (posterId ? '수정하기' : '올리기')}
        </button>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100 animate-pulse">
          <strong>⚠️ 오류:</strong> {error}
        </div>
      )}
    </div>
  )
}

export default PosterUpload
