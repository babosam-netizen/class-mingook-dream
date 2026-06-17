import { useState, useEffect, useRef } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, setAt, subscribe } from '../../lib/rtdb-helpers'
import { DraftSaver } from '../../lib/draft-saver'

const PERSPECTIVE_OPTIONS = [
  { id: 'critical',   label: '비판',  emoji: '🔍', cls: 'border-rose-400 bg-rose-50 text-rose-800' },
  { id: 'supportive', label: '옹호',  emoji: '👍', cls: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  { id: 'neutral',    label: '중립',  emoji: '⚖️', cls: 'border-gray-400 bg-gray-50 text-gray-700' },
]

export const ARTICLE_NATURE_OPTIONS = [
  { id: 'news',      label: '뉴스 보도', hint: '사실 전달' },
  { id: 'editorial', label: '사설/논평', hint: '의견 표현' },
  { id: 'feature',   label: '현장 취재', hint: '인터뷰·르포' },
  { id: 'analysis',  label: '심층 분석', hint: '맥락·배경' },
]

const TARGET_OPTIONS = [
  { id: 'legislative', label: '입법부 활동' },
  { id: 'executive',   label: '행정부 활동' },
  { id: 'judicial',    label: '사법부 활동' },
  { id: 'election',    label: '선거 관련' },
  { id: 'general',     label: '일반' },
]

const CONTEXT_OPTIONS = [
  { id: 'debate',   label: '📢 토론 중', hint: '토론하며 작성' },
  { id: 'activity', label: '🌱 여정 활동', hint: '활동 중 작성' },
  { id: 'free',     label: '✏️ 자유 작성', hint: '별도 맥락 없음' },
]

/**
 * 기사 작성 에디터 — 헤드라인 + 본문 + 관점 + 대상.
 * 작성하면 status: pending → 교사 승인 후 NewsBoard에 게시.
 */
function ArticleEditor({ editingArticleId, articleData, onSuccess, onCancel }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber = useGameStore((s) => s.myNumber)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)

  const myGroupId = (() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  })()

  const currentPhase = useGameStore((s) => s.currentPhase)
  const autoApprove = useGameStore((s) => s.config?.autoApproveArticles)
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [perspective, setPerspective] = useState('neutral')
  const [articleNature, setArticleNature] = useState('news')
  const [target, setTarget] = useState('general')
  const [contextType, setContextType]       = useState('activity')
  const [debateSessionId, setDebateSessionId] = useState('')
  const [debateSessions, setDebateSessions]   = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // 수정 모드 진입 시 폼을 '한 번만' 초기화한다.
  // articleData 는 실시간 구독본에서 매번 새 객체로 내려오므로(articles 노드가 바뀔 때마다),
  // 매 변경마다 초기화하면 사용자가 입력 중인 내용이 서버 저장본으로 되돌아가거나 사라진다.
  const initializedFor = useRef(null)
  useEffect(() => {
    if (editingArticleId) {
      // 같은 기사 id 에 대해 이미 초기화했다면, 이후 실시간 갱신으로 폼을 덮어쓰지 않는다.
      if (initializedFor.current === editingArticleId) return
      if (!articleData) return // 구독 지연으로 잠깐 비어 있을 때는 기존 입력 유지
      initializedFor.current = editingArticleId
      setHeadline(articleData.headline || '')
      setBody(articleData.body || '')
      setPerspective(articleData.perspective || 'neutral')
      setArticleNature(articleData.articleNature || 'news')
      setTarget(articleData.target || 'general')
    } else {
      // 새 기사 작성 모드: 폼 비우기 (한 번)
      if (initializedFor.current === null) return
      initializedFor.current = null
      setHeadline('')
      setBody('')
      setPerspective('neutral')
      setArticleNature('news')
      setTarget('general')
    }
  }, [editingArticleId, articleData])

  useEffect(() => {
    if (!roomCode) return
    const unsub = subscribe(roomCode, 'debateSessions', (d) => {
      setDebateSessions(Object.entries(d || {}).map(([id, s]) => ({ id, ...s })))
    })
    return () => unsub?.()
  }, [roomCode])

  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    const d = DraftSaver.load('article')
    if (d) setHasDraft(true)
  }, [])

  const onSaveDraft = () => {
    DraftSaver.save('article', { headline, body, perspective, target })
    setHasDraft(true)
    alert('임시저장되었습니다.')
  }

  const onLoadDraft = () => {
    const d = DraftSaver.load('article')
    if (d && d.data) {
      setHeadline(d.data.headline || '')
      setBody(d.data.body || '')
      setPerspective(d.data.perspective || 'neutral')
      setTarget(d.data.target || 'general')
      alert('임시저장된 내용을 불러왔습니다.')
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!headline.trim() || !body.trim()) {
      setError('헤드라인과 본문을 모두 입력해 주세요.')
      return
    }
    if (headline.length > 30) {
      setError('헤드라인은 30자 이내로 작성해 주세요.')
      return
    }
    setBusy(true)
    try {
      const status = autoApprove ? 'approved' : 'pending'
      const selectedSession = contextType === 'debate' && debateSessionId
        ? debateSessions.find((s) => s.id === debateSessionId)
        : null
      const data = {
        headline: headline.trim(),
        body: body.trim(),
        perspective,
        articleNature,
        target,
        phase: currentPhase || 1,
        contextType,
        ...(selectedSession ? { debateSessionId: selectedSession.id, debateSessionTopic: selectedSession.topic || '' } : {}),
        authorStudentId: myStudentId,
        authorNumber: myNumber,
        authorNickname: myNickname,
        authorGroupId: myGroupId,
        status,
        ...(status === 'approved' ? { approvedAt: Date.now() } : {}),
        updatedAt: Date.now(),
      }

      if (editingArticleId) {
        await setAt(roomCode, `articles/${editingArticleId}`, { ...articleData, ...data })
      } else {
        await pushUnder(roomCode, 'articles', data)
      }

      setHeadline('')
      setBody('')
      setPerspective('neutral')
      setTarget('general')
      DraftSaver.clear('article')
      setHasDraft(false)
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
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-2xl border-2 border-blue-200 shadow-sm space-y-2"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-blue-800 text-sm">📰 기사 작성 {editingArticleId && <span className="text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ml-2">수정 중...</span>}</h3>
        <div className="flex gap-1">
          {hasDraft && !editingArticleId && (
            <button
              type="button"
              onClick={onLoadDraft}
              className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded border border-amber-200 font-bold hover:bg-amber-200"
            >
              📂 불러오기
            </button>
          )}
          {!editingArticleId && (
            <button
              type="button"
              onClick={onSaveDraft}
              className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 font-bold hover:bg-blue-100"
            >
              💾 임시저장
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-500">
        헤드라인 + 본문 + 관점을 적어 선생님께 제출하면 승인 후 여론판에 게시됩니다.
      </p>

      <input
        type="text"
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="헤드라인 (30자 이내)"
        maxLength={30}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-bold"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="본문 (200~500자 권장, 최대 1000자)"
        rows={5}
        maxLength={1000}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
      />
      <p className="text-xs text-gray-400 text-right">
        {body.length} / 1000자
      </p>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">관점</p>
        <div className="grid grid-cols-3 gap-1">
          {PERSPECTIVE_OPTIONS.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setPerspective(p.id)}
              className={`py-1.5 text-xs rounded border-2 font-semibold transition ${
                perspective === p.id ? p.cls : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">기사 성격</p>
        <div className="grid grid-cols-2 gap-1">
          {ARTICLE_NATURE_OPTIONS.map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() => setArticleNature(n.id)}
              className={`py-1.5 text-xs rounded border-2 font-semibold transition flex items-center justify-center gap-1 ${
                articleNature === n.id
                  ? 'border-blue-400 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {n.label}
              <span className="text-[10px] font-normal opacity-60">{n.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">관련 영역</p>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full px-2 py-1.5 text-sm rounded border border-gray-300"
        >
          {TARGET_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* 작성 맥락 — 숨김 분류 태그 */}
      <div className="border-t border-dashed border-gray-200 pt-2">
        <p className="text-[10px] font-bold text-gray-400 mb-1.5">
          🏷️ 작성 맥락 <span className="font-normal text-gray-300">(분류용 태그)</span>
        </p>
        <div className="flex gap-1 flex-wrap">
          {CONTEXT_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setContextType(c.id); if (c.id !== 'debate') setDebateSessionId('') }}
              className={`py-1 px-2.5 text-[10px] rounded-lg border font-bold transition ${
                contextType === c.id
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-indigo-200 hover:text-indigo-500'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {contextType === 'debate' && (
          <select
            value={debateSessionId}
            onChange={(e) => setDebateSessionId(e.target.value)}
            className="mt-1.5 w-full px-2 py-1.5 text-[11px] rounded-lg border border-indigo-200 text-gray-700 bg-indigo-50/30 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="">— 어떤 토론이었나요? —</option>
            {debateSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.topic || '주제 미지정'}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
          {error}
        </p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
          {autoApprove ? '✓ 게시 완료!' : '✓ 제출 완료. 선생님 승인을 기다려 주세요.'}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50 hover:bg-blue-700"
        >
          {busy ? (editingArticleId ? '수정 중...' : '제출 중...') : (editingArticleId ? '수정 완료' : (autoApprove ? '바로 게시하기' : '제출 (승인 후 게시)'))}
        </button>
        {editingArticleId && (
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
  )
}

export default ArticleEditor

export { PERSPECTIVE_OPTIONS, TARGET_OPTIONS }
