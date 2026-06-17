import { useState, useEffect } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, setAt } from '../../lib/rtdb-helpers'
import { fetchLinkMeta } from '../../lib/fetch-link-meta'

const TYPE_TABS = [
  { id: 'news',  label: '📰 신문기사',  desc: '네이버·다음·언론사' },
  { id: 'video', label: '🎬 영상·캔바', desc: '유튜브·비메오·캔바' },
]

function detectVideoType(url) {
  const u = url.toLowerCase()
  if (u.includes('youtu')) return 'youtube'
  if (u.includes('canva.')) return 'canva'
  if (u.includes('vimeo.')) return 'vimeo'
  return 'other'
}

/**
 * 학생용 — 외부 링크 제출 폼. [Antigravity]
 *
 * 두 가지 탭:
 *   • 영상·캔바: 교사 승인 후 게시 (status: pending)
 *   • 신문기사: 승인 없이 즉시 게시 (status: approved). 헤드라인·요약·이미지 입력
 */
function LinkSubmit({ groupId, showNews = true, showVideo = true, editingLinkId, linkData, onSuccess, onCancel }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)
  const videoHint = useGameStore((s) => s.config?.videoUploadHint)

  const activeTabs = TYPE_TABS.filter(t => (t.id === 'news' && showNews) || (t.id === 'video' && showVideo))
  const [tab, setTab] = useState(activeTabs[0]?.id || 'video')

  // 영상·캔바
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  // 뉴스
  const [newsUrl, setNewsUrl] = useState('')
  const [newsHeadline, setNewsHeadline] = useState('')
  const [newsSummary, setNewsSummary] = useState('')
  const [newsThumb, setNewsThumb] = useState('')
  const [newsSource, setNewsSource] = useState('')

  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoVia, setAutoVia] = useState(null)

  const autoApproveVideos = useGameStore((s) => s.config?.autoApproveVideos)

  // [Antigravity] 수정 모드 시 데이터 세팅
  useEffect(() => {
    if (editingLinkId && linkData) {
      if (linkData.type === 'news') {
        setTab('news')
        setNewsUrl(linkData.url || '')
        setNewsHeadline(linkData.title || '')
        setNewsSummary(linkData.summary || '')
        setNewsThumb(linkData.thumbnail || '')
        setNewsSource(linkData.source || '')
        
        setUrl('')
        setTitle('')
      } else {
        setTab('video')
        setUrl(linkData.url || '')
        setTitle(linkData.title || '')
        
        setNewsUrl('')
        setNewsHeadline('')
        setNewsSummary('')
        setNewsThumb('')
        setNewsSource('')
      }
    } else {
      setUrl(''); setTitle('')
      setNewsUrl(''); setNewsHeadline(''); setNewsSummary(''); setNewsThumb(''); setNewsSource('')
      // tab은 그대로 유지
    }
  }, [editingLinkId, linkData])

  const onSubmitVideo = async (e) => {
    e.preventDefault()
    setError('')
    if (!/^https?:\/\//.test(url.trim())) {
      setError('https:// 또는 http:// 로 시작하는 주소를 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const status = autoApproveVideos ? 'approved' : 'pending'
      const data = {
        type: detectVideoType(url),
        url: url.trim(),
        title: title.trim() || '(제목 없음)',
        groupId: groupId || null,
        submitterStudentId: myStudentId,
        submitterNumber: myNumber,
        submitterNickname: myNickname,
        status,
        ...(status === 'approved' ? { approvedAt: Date.now() } : {}),
        updatedAt: Date.now(),
      }

      if (editingLinkId) {
        await setAt(roomCode, `links/${editingLinkId}`, { ...linkData, ...data })
      } else {
        await pushUnder(roomCode, 'links', data)
      }
      setUrl('')
      setTitle('')
      setDone(true)
      setTimeout(() => setDone(false), 2500)
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onAutoFetch = async () => {
    setError('')
    setAutoVia(null)
    if (!/^https?:\/\//.test(newsUrl.trim())) {
      setError('먼저 기사 URL을 정확히 입력해 주세요.')
      return
    }
    setAutoBusy(true)
    try {
      const meta = await fetchLinkMeta(newsUrl.trim())
      if (meta.title)       setNewsHeadline(meta.title.slice(0, 80))
      if (meta.description) setNewsSummary(meta.description.slice(0, 200))
      if (meta.image)       setNewsThumb(meta.image)
      if (meta.source)      setNewsSource(meta.source)
      setAutoVia(meta.via)
    } catch (err) {
      setError(err.message)
    } finally {
      setAutoBusy(false)
    }
  }

  const onSubmitNews = async (e) => {
    e.preventDefault()
    setError('')
    if (!/^https?:\/\//.test(newsUrl.trim())) {
      setError('https:// 또는 http:// 로 시작하는 기사 주소를 입력해 주세요.')
      return
    }
    if (!newsHeadline.trim()) {
      setError('헤드라인을 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      // 자동 도메인 추출 (출처 표기용)
      let domain = newsSource.trim()
      if (!domain) {
        try { domain = new URL(newsUrl).hostname.replace(/^www\./, '') } catch {}
      }
      const data = {
        type: 'news',
        url: newsUrl.trim(),
        title: newsHeadline.trim(),
        summary: newsSummary.trim() || null,
        thumbnail: newsThumb.trim() || null,
        source: domain || null,
        groupId: groupId || null,
        submitterStudentId: myStudentId,
        submitterNumber: myNumber,
        submitterNickname: myNickname,
        status: 'approved',          // 승인 없이 즉시 게시
        approvedAt: Date.now(),
        updatedAt: Date.now(),
      }

      if (editingLinkId) {
        await setAt(roomCode, `links/${editingLinkId}`, { ...linkData, ...data })
      } else {
        await pushUnder(roomCode, 'links', data)
      }

      setNewsUrl(''); setNewsHeadline(''); setNewsSummary(''); setNewsThumb(''); setNewsSource('')
      setDone(true)
      setTimeout(() => setDone(false), 2500)
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white p-4 rounded-2xl border-2 border-emerald-200 shadow-sm space-y-2">
      <h3 className="font-bold text-emerald-800">📎 외부 자료 링크 {editingLinkId && <span className="text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ml-2">수정 중...</span>}</h3>

      {/* 탭 [Antigravity] */}
      {activeTabs.length > 1 && (
        <div className="grid grid-cols-2 gap-1">
          {activeTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setError(''); setDone(false) }}
              className={`py-2 text-sm rounded-lg font-semibold transition border-2 ${
                tab === t.id
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-emerald-300'
              }`}
            >
              <div>{t.label}</div>
              <div className="text-[11px] font-normal opacity-70">{t.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* 영상·캔바 폼 */}
      {tab === 'video' && (
        <form onSubmit={onSubmitVideo} className="space-y-2 pt-2">
          <p className="text-xs text-gray-500">
            유튜브·캔바·비메오 링크를 보내면 {autoApproveVideos ? '바로 게시돼요.' : '선생님 승인 후 게시돼요.'}
          </p>
          {videoHint?.enabled && videoHint?.url && (
            <a
              href={videoHint.url}
              target="_blank"
              rel="noreferrer"
              className="block px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 hover:bg-amber-100"
            >
              📁 영상 파일은{' '}
              <strong className="underline">{videoHint.label || '여기'}</strong>에
              올린 다음, 선생님께 여쭤보고 아래에 붙여주세요 ↗
            </a>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (예: 우리 모둠 환경 캠페인 영상)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            maxLength={50}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {error && <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>}
          {done && (
            <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
              {autoApproveVideos ? '✓ 게시 완료!' : '✓ 제출 완료. 선생님 승인을 기다려 주세요.'}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50 hover:bg-emerald-700"
            >
              {busy ? (editingLinkId ? '수정 중...' : '제출 중...') : (editingLinkId ? '수정 완료' : (autoApproveVideos ? '바로 게시하기' : '선생님께 제출'))}
            </button>
            {editingLinkId && (
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold"
              >
                취소
              </button>
            )}
          </div>
        </form>
      )}

      {/* 신문기사 폼 — 승인 없이 즉시 게시 */}
      {tab === 'news' && (
        <form onSubmit={onSubmitNews} className="space-y-2 pt-2">
          <p className="text-xs text-gray-500">
            관련 신문기사를 공유하면 <strong>승인 없이 바로 게시</strong>됩니다. 헤드라인·요약을 정확히 적어 주세요.
          </p>
          <div className="flex gap-1">
            <input
              type="url"
              value={newsUrl}
              onChange={(e) => setNewsUrl(e.target.value)}
              placeholder="기사 URL (https://...)"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              type="button"
              onClick={onAutoFetch}
              disabled={autoBusy || !newsUrl.trim()}
              title="URL에서 헤드라인·이미지·요약을 자동으로 가져옵니다"
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 whitespace-nowrap"
            >
              {autoBusy ? '⏳' : '🔍 자동 가져오기'}
            </button>
          </div>
          {autoVia && (
            <p className="text-[11px] text-gray-400">
              ✓ 자동 가져옴 ({autoVia === 'server' ? '서버' : 'microlink'}). 필요하면 수정 후 게시.
            </p>
          )}
          <input
            type="text"
            value={newsHeadline}
            onChange={(e) => setNewsHeadline(e.target.value)}
            placeholder="헤드라인 (기사 제목)"
            maxLength={80}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <textarea
            value={newsSummary}
            onChange={(e) => setNewsSummary(e.target.value)}
            placeholder="기사 요약 1~2문장 (선택)"
            maxLength={200}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
          <input
            type="url"
            value={newsThumb}
            onChange={(e) => setNewsThumb(e.target.value)}
            placeholder="기사 대표 이미지 URL (선택)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <input
            type="text"
            value={newsSource}
            onChange={(e) => setNewsSource(e.target.value)}
            placeholder="출처 (선택, 비우면 도메인 자동 추출)"
            maxLength={30}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {error && <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>}
          {done && (
            <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
              ✓ 게시 완료!
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !newsUrl.trim() || !newsHeadline.trim()}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50 hover:bg-blue-700"
            >
              {busy ? (editingLinkId ? '수정 중...' : '게시 중...') : (editingLinkId ? '수정 완료' : '바로 게시 (승인 없음)')}
            </button>
            {editingLinkId && (
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold"
              >
                취소
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

export default LinkSubmit
