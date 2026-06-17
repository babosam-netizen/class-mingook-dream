import { useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, updateAt } from '../../lib/rtdb-helpers'

const DEFAULT_PREFIXES = ['환경', '노동', '주거', '인권', '교육', '안전', '기타']

/** YouTube videoId 파싱 */
function getYoutubeId(url = '') {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

/** URL 도메인 추출 */
function getDomain(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** 해시태그 정규화: 한/영/숫자만, 소문자, '#' 제거 */
function normalizeTag(raw) {
  return String(raw || '')
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '')
}

function PetitionForm({ editData = null, onCancel = null }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)

  const petitionConfig = config?.petitionConfig || {}
  const prefixOptions = useMemo(
    () => (petitionConfig.prefixOptions?.length ? petitionConfig.prefixOptions : DEFAULT_PREFIXES),
    [petitionConfig.prefixOptions],
  )
  const maxHashTags = petitionConfig.maxHashTags || 3
  const isOpen = petitionConfig.isOpen !== false
  const autoApprove = !!petitionConfig.autoApprove

  const myGroupName = useMemo(() => {
    if (!myStudentId) return ''
    for (const [, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return g.name || ''
    }
    return ''
  }, [groups, myStudentId])

  const [prefixTag, setPrefixTag] = useState(editData?.prefixTag || prefixOptions[0] || '기타')
  const [title, setTitle] = useState(editData?.title || '')
  const [claim, setClaim] = useState(editData?.claim || '')
  const [evidence, setEvidence] = useState(editData?.evidence || '')
  const [mediaUrl, setMediaUrl] = useState(editData?.mediaUrl || '')
  const [mediaSummary, setMediaSummary] = useState(editData?.mediaSummary || '')
  const [hashTags, setHashTags] = useState(editData?.hashTags || [])
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const ytId = useMemo(() => getYoutubeId(mediaUrl), [mediaUrl])

  if (role !== 'student') return null

  if (!isOpen) {
    return (
      <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-300 text-center">
        <p className="text-sm text-gray-500">선생님이 청원을 닫았습니다.</p>
        <p className="text-xs text-gray-400 mt-1">기존 청원은 게시판에서 읽을 수 있어요.</p>
      </div>
    )
  }

  const commitTag = () => {
    const t = normalizeTag(tagInput)
    if (!t) return setTagInput('')
    if (hashTags.includes(t)) return setTagInput('')
    if (hashTags.length >= maxHashTags) return setTagInput('')
    setHashTags([...hashTags, t])
    setTagInput('')
  }

  const removeTag = (t) => setHashTags(hashTags.filter((x) => x !== t))

  const onTagKey = (e) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTag()
    } else if (e.key === 'Backspace' && !tagInput && hashTags.length > 0) {
      setHashTags(hashTags.slice(0, -1))
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) return setError('청원 제목을 입력해 주세요.')
    if (title.length > 30) return setError('제목은 30자 이내로 작성해 주세요.')
    if (!claim.trim()) return setError('주장을 입력해 주세요.')
    if (claim.length > 200) return setError('주장은 200자 이내로 작성해 주세요.')
    if (!evidence.trim()) return setError('근거를 입력해 주세요.')
    if (evidence.length > 200) return setError('근거는 200자 이내로 작성해 주세요.')
    if (!mediaUrl.trim()) return setError('미디어(영상/뉴스) URL을 입력해 주세요.')
    if (!mediaSummary.trim()) return setError('미디어 요약을 입력해 주세요.')
    if (mediaSummary.length > 80) return setError('요약은 80자 이내로 작성해 주세요.')

    setBusy(true)
    try {
      if (editData) {
        await updateAt(roomCode, `petitions/${editData.id}`, {
          title: title.trim(),
          claim: claim.trim(),
          evidence: evidence.trim(),
          mediaUrl: mediaUrl.trim(),
          mediaSummary: mediaSummary.trim(),
          prefixTag,
          hashTags,
        })
        setDone(true)
        setTimeout(() => {
          setDone(false)
          if (onCancel) onCancel()
        }, 1500)
      } else {
        const status = autoApprove ? 'approved' : 'pending'
        await pushUnder(roomCode, 'petitions', {
          studentId: myStudentId,
          studentName: myNickname,
          studentNumber: Number(myNumber) || null,
          groupName: myGroupName,
          title: title.trim(),
          claim: claim.trim(),
          evidence: evidence.trim(),
          mediaUrl: mediaUrl.trim(),
          mediaSummary: mediaSummary.trim(),
          prefixTag,
          hashTags,
          likeCount: 0,
          likedBy: [],
          status,
        })
        // 초기화
        setTitle('')
        setClaim('')
        setEvidence('')
        setMediaUrl('')
        setMediaSummary('')
        setHashTags([])
        setTagInput('')
        setDone(true)
        setTimeout(() => setDone(false), 2500)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-2xl border-2 border-amber-200 shadow-sm space-y-3"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold text-amber-800">{editData ? '📜 국민청원 수정' : '📜 국민청원 작성'}</h3>
        {!editData && autoApprove && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
            자동 승인 중
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        우리 사회·학교·{config?.countryName || '우리 반'}에 어떤 문제가 있는지 직접 청원해 보세요. 주장과 근거, 미디어 자료가 모두 필요합니다.
      </p>

      {/* 1) 말머리 */}
      <div>
        <label className="text-xs font-semibold text-gray-600">① 말머리</label>
        <select
          value={prefixTag}
          onChange={(e) => setPrefixTag(e.target.value)}
          className="w-full mt-1 px-2 py-1.5 text-sm rounded border border-gray-300"
        >
          {prefixOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* 2) 제목 */}
      <div>
        <label className="text-xs font-semibold text-gray-600">② 청원 제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={30}
          placeholder="한 줄로 요약한 청원 제목"
          className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold"
        />
        <p className="text-[10px] text-gray-400 text-right">{title.length}/30</p>
      </div>

      {/* 3) 주장 */}
      <div>
        <label className="text-xs font-semibold text-gray-600">③ 주장</label>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="나는 ○○ 문제를 해결해야 한다고 주장합니다."
          className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
        <p className="text-[10px] text-gray-400 text-right">{claim.length}/200</p>
      </div>

      {/* 4) 근거 */}
      <div>
        <label className="text-xs font-semibold text-gray-600">④ 근거</label>
        <textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="왜냐하면..."
          className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
        <p className="text-[10px] text-gray-400 text-right">{evidence.length}/200</p>
      </div>

      {/* 5) 미디어 URL */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-600">⑤ 미디어(영상·뉴스) URL <span className="text-red-500">*</span></label>
          <a href="https://news.naver.com" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline">🔗 네이버뉴스</a>
        </div>
        <input
          type="url"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... 또는 뉴스 기사 URL"
          className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex justify-end gap-3 mt-1.5">
          <a href="https://padlet.com/appletree128909/padlet-1vb4794g2zw7acy7" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline">🔗 사과나무당선생님자료</a>
          <a href="https://www.triplelight.co/insight/2024-korean-social-problems-report-58di01" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline">🔗 한국부정적이슈</a>
        </div>
        {mediaUrl && (
          <div className="mt-2">
            {ytId ? (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="block w-32 aspect-video rounded-md overflow-hidden bg-black"
              >
                <img
                  src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                  alt="YouTube 썸네일"
                  className="w-full h-full object-cover"
                />
              </a>
            ) : (
              <div className="text-xs text-blue-700 inline-flex items-center gap-1 px-2 py-1 bg-blue-50 rounded">
                🔗 {getDomain(mediaUrl)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6) 미디어 요약 */}
      <div>
        <label className="text-xs font-semibold text-gray-600">⑥ 미디어 요약 <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={mediaSummary}
          onChange={(e) => setMediaSummary(e.target.value)}
          maxLength={80}
          placeholder="이 자료는 ○○를 보여줍니다."
          className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <p className="text-[10px] text-gray-400 text-right">{mediaSummary.length}/80</p>
      </div>

      {/* 7) 해시태그 */}
      <div>
        <label className="text-xs font-semibold text-gray-600">⑦ 해시태그 (최대 {maxHashTags}개)</label>
        <div className="flex flex-wrap gap-1 mt-1 px-2 py-1.5 border border-gray-300 rounded-lg min-h-[36px] focus-within:ring-2 focus-within:ring-amber-400">
          {hashTags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
            >
              #{t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                className="text-amber-500 hover:text-amber-800"
              >
                ✕
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={onTagKey}
            onBlur={commitTag}
            disabled={hashTags.length >= maxHashTags}
            placeholder={hashTags.length >= maxHashTags ? `최대 ${maxHashTags}개` : '#태그 입력 후 스페이스/엔터'}
            className="flex-1 min-w-[120px] text-xs outline-none bg-transparent disabled:opacity-50"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
          {autoApprove ? '✓ 즉시 게시되었습니다!' : '✓ 제출 완료. 선생님 승인을 기다려 주세요.'}
        </p>
      )}

      <div className="flex gap-2 mt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-bold disabled:opacity-50 hover:bg-gray-300"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white font-bold disabled:opacity-50 hover:bg-amber-700"
        >
          {busy ? '처리 중...' : editData ? '수정 완료' : autoApprove ? '청원 바로 게시하기' : '청원 제출 (승인 대기)'}
        </button>
      </div>
    </form>
  )
}

export default PetitionForm
