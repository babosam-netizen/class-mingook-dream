import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import RoomBar from '../components/shared/RoomBar'
import ArticleEditor from '../components/news/ArticleEditor'
import ArticleCard, { ArticleDetailModal } from '../components/news/ArticleCard'
import ArticleApprovalQueue from '../components/news/ArticleApprovalQueue'
import PollResultGallery from '../components/news/PollResultGallery'
import OpinionBriefing from '../components/news/OpinionBriefing'
import useGameStore from '../store/gameStore'
import { subscribe } from '../lib/rtdb-helpers'

const PERSPECTIVE_FILTERS = [
  { id: 'all',        label: '전체' },
  { id: 'critical',   label: '🔍 비판' },
  { id: 'supportive', label: '👍 옹호' },
  { id: 'neutral',    label: '⚖️ 중립' },
]

const PERSPECTIVE_BADGE = {
  critical:   { emoji: '🔍', cls: 'bg-rose-100 text-rose-700' },
  supportive: { emoji: '👍', cls: 'bg-emerald-100 text-emerald-700' },
  neutral:    { emoji: '⚖️', cls: 'bg-gray-100 text-gray-700' },
}

const NATURE_LABELS = {
  news:      '뉴스 보도',
  editorial: '사설/논평',
  feature:   '현장 취재',
  analysis:  '심층 분석',
}

const TARGET_LABELS = {
  legislative: '입법부',
  executive:   '행정부',
  judicial:    '사법부',
  election:    '선거',
  general:     '일반',
}

const PERSPECTIVE_LABELS = {
  critical:   '비판',
  supportive: '옹호',
  neutral:    '중립',
}

const STATUS_BADGE = {
  approved: { label: '게시 중',  cls: 'bg-emerald-100 text-emerald-700' },
  pending:  { label: '승인 대기', cls: 'bg-amber-100 text-amber-700' },
  rejected: { label: '반려됨',   cls: 'bg-red-100 text-red-600' },
}

/* ── 기사 작성/수정 모달 ── */
function ArticleEditorModal({ onClose, editingArticleId, articleData }) {
  const isEditing = Boolean(editingArticleId)
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="font-black text-lg text-gray-900">{isEditing ? '✏️ 기사 수정' : '✏️ 기사 작성'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-lg"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ArticleEditor
            editingArticleId={editingArticleId}
            articleData={articleData}
            onSuccess={onClose}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}

/* ── 내가 작성한 문서 패널 ── */
function MyArticlesPanel({ articles, onEdit }) {
  const [open, setOpen] = useState(false)
  if (articles.length === 0) return null
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-indigo-800 hover:bg-indigo-100/50"
      >
        <span>📝 내가 작성한 문서 ({articles.length}개)</span>
        <span className="text-indigo-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {articles.map((a) => {
            const badge = STATUS_BADGE[a.status] || STATUS_BADGE.pending
            return (
              <div key={a.id} className="bg-white border border-indigo-100 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                  {a.perspective && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${(PERSPECTIVE_BADGE[a.perspective] || PERSPECTIVE_BADGE.neutral).cls}`}>
                      {(PERSPECTIVE_BADGE[a.perspective] || PERSPECTIVE_BADGE.neutral).emoji} {PERSPECTIVE_LABELS[a.perspective] || a.perspective}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold leading-tight">{a.headline || '(제목 없음)'}</p>
                {a.body && <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>}
                <button
                  type="button"
                  onClick={() => onEdit(a)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  ✏️ 이어서 작성
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── 우리 모둠 기사 미니 패널 ── */
function MyGroupArticlesPanel({ articles }) {
  const [open, setOpen] = useState(false)
  if (articles.length === 0) return null
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-blue-800 hover:bg-blue-100/50"
      >
        <span>📋 우리 모둠 기사 ({articles.length}개)</span>
        <span className="text-blue-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {articles.map((a) => {
            const badge = STATUS_BADGE[a.status] || STATUS_BADGE.pending
            return (
              <div key={a.id} className="bg-white border rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {a.authorNumber}번 {a.authorNickname}
                  </span>
                </div>
                <p className="text-sm font-bold leading-tight">{a.headline}</p>
                <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── 기자 명단 ── */
function JournalistDirectory({ journalists, selected, onSelect, journalistArticles, onArticleClick }) {
  if (journalists.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
          <span>🗞️</span> 기자 명단
          <span className="text-gray-400 font-normal text-xs">{journalists.length}명 · 총 {journalists.reduce((s, j) => s + j.count, 0)}건</span>
        </h3>
      </div>

      {/* 기자 칩 목록 */}
      <div className="px-4 py-3 flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
            !selected
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          전체
        </button>
        {journalists.map((j) => (
          <button
            key={j.studentId}
            type="button"
            onClick={() => onSelect(j.studentId === selected?.studentId ? null : j)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
              selected?.studentId === j.studentId
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            <span>✍️ {j.nickname} 기자</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
              selected?.studentId === j.studentId
                ? 'bg-indigo-500 text-indigo-100'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {j.count}
            </span>
          </button>
        ))}
      </div>

      {/* 선택된 기자의 헤드라인 목록 */}
      {selected && journalistArticles.length > 0 && (
        <div className="border-t border-gray-100 mx-4 mb-4">
          <p className="text-[10px] font-bold text-indigo-600 pt-3 pb-2 uppercase tracking-wider">
            ✍️ {selected.nickname} 기자의 기사 {journalistArticles.length}편
          </p>
          <ul className="space-y-1">
            {journalistArticles.map((a) => {
              const badge = PERSPECTIVE_BADGE[a.perspective] || PERSPECTIVE_BADGE.neutral
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onArticleClick(a)}
                    className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition group"
                  >
                    <span className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${badge.cls}`}>
                      {badge.emoji}
                    </span>
                    <span className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 leading-snug">
                      {a.headline}
                    </span>
                    <span className="ml-auto text-xs text-indigo-400 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      →
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {selected && journalistArticles.length === 0 && (
        <p className="px-4 pb-4 text-xs text-gray-400">게시된 기사가 없어요.</p>
      )}
    </div>
  )
}

/* ── 메인 페이지 ── */
function NewsBoardPage() {
  const navigate       = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const role           = useGameStore((s) => s.role)
  const roomCode       = useGameStore((s) => s.roomCode)
  const myStudentId    = useGameStore((s) => s.myStudentId)
  const groups         = useGameStore((s) => s.groups)
  const currentPhase   = useGameStore((s) => s.currentPhase)

  const [articlesMap, setArticlesMap]         = useState({})
  const [electionJournalistsMap, setElJMap]   = useState({})
  const [studentsMap, setStudentsMap]         = useState({})
  const [filter, setFilter]                   = useState('all')
  const [searchQuery, setSearchQuery]         = useState('')
  const [editorOpen, setEditorOpen]           = useState(false)
  const [editingArticleId, setEditingArticleId] = useState(null)
  const [editingArticleData, setEditingArticleData] = useState(null)
  const [columns, setColumns]                 = useState(3)

  // 기자 선택 상태
  const [selectedJournalist, setSelectedJournalist] = useState(null)
  // 헤드라인 목록에서 클릭된 기사 (모달 용)
  const [headlineArticle, setHeadlineArticle]       = useState(null)

  const returnPathByPhase = { 1: '/phase1', 2: '/phase2', 3: '/phase3', 4: '/reflection' }
  const returnPath = returnPathByPhase[Number(currentPhase)] || '/phase1'

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'articles',            (d) => setArticlesMap(d || {}))
    const u2 = subscribe(roomCode, 'electionJournalists', (d) => setElJMap(d || {}))
    const u3 = subscribe(roomCode, 'students',            (d) => setStudentsMap(d || {}))
    return () => { u1?.(); u2?.(); u3?.() }
  }, [roomCode])

  // URL ?article= 파라미터로 진입하면 해당 기사 모달 자동 오픈
  useEffect(() => {
    const targetId = searchParams.get('article')
    if (!targetId || Object.keys(articlesMap).length === 0) return
    const found = articlesMap[targetId]
    if (found?.status === 'approved') {
      setHeadlineArticle({ id: targetId, ...found })
      // 파라미터 제거 (뒤로가기 시 재오픈 방지)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, articlesMap])

  // 기자단으로 등록된 모둠 ID 집합
  const journalistGroupIds = useMemo(() => new Set(Object.keys(electionJournalistsMap)), [electionJournalistsMap])

  const myGroupId = useMemo(() => {
    if (!myStudentId || !groups) return null
    for (const [gid, g] of Object.entries(groups)) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [myStudentId, groups])

  const myGroupArticles = useMemo(() => {
    if (!myGroupId) return []
    return Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => a.authorGroupId === myGroupId && a.status !== 'deleted')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [articlesMap, myGroupId])

  const myArticles = useMemo(() => {
    if (!myStudentId) return []
    return Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => a.authorStudentId === myStudentId && a.status !== 'deleted')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [articlesMap, myStudentId])

  // 게시된 기사 전체 (검색/필터 전, 기자 명단 집계용)
  const allArticles = useMemo(() =>
    Object.entries(articlesMap)
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => a.status === 'approved')
      .sort((a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0)),
  [articlesMap])

  // 기자 명단 집계 — 기자단 모둠 소속 학생 전원 (기사 없어도 표시)
  const journalists = useMemo(() => {
    if (journalistGroupIds.size === 0) return []
    const map = {}
    // 기자단 모둠원 전원을 먼저 등록 (기사 0건이어도)
    journalistGroupIds.forEach((gid) => {
      const members = groups?.[gid]?.members || {}
      Object.keys(members).forEach((sid) => {
        const s = studentsMap[sid]
        if (s) map[sid] = { studentId: sid, nickname: s.nickname || '?', number: s.number || 0, count: 0 }
      })
    })
    // 승인된 기사로 count 누적
    allArticles.forEach((a) => {
      if (!journalistGroupIds.has(a.authorGroupId)) return
      if (map[a.authorStudentId]) {
        map[a.authorStudentId].count++
        if (!map[a.authorStudentId].nickname || map[a.authorStudentId].nickname === '?') {
          map[a.authorStudentId].nickname = a.authorNickname
          map[a.authorStudentId].number   = a.authorNumber
        }
      } else {
        map[a.authorStudentId] = { studentId: a.authorStudentId, nickname: a.authorNickname, number: a.authorNumber, count: 1 }
      }
    })
    return Object.values(map).sort((a, b) => b.count - a.count || a.number - b.number)
  }, [allArticles, journalistGroupIds, groups, studentsMap])

  // 선택된 기자의 기사 목록
  const journalistArticles = useMemo(() => {
    if (!selectedJournalist) return []
    return allArticles.filter((a) => a.authorStudentId === selectedJournalist.studentId)
  }, [allArticles, selectedJournalist])

  // 그리드 표시용 기사 (검색 + 관점 필터)
  // 띄어쓰기로 구분된 단어를 각각 AND 조건으로 검색
  const articles = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return allArticles.filter((a) => {
      if (filter !== 'all' && a.perspective !== filter) return false
      if (tokens.length === 0) return true
      const searchable = [
        a.headline || '',
        a.body || '',
        `${a.authorNumber}번 ${a.authorNickname}`,
        NATURE_LABELS[a.articleNature] || '',
        TARGET_LABELS[a.target] || '',
        PERSPECTIVE_LABELS[a.perspective] || '',
      ].join(' ').toLowerCase()
      return tokens.every((t) => searchable.includes(t))
    })
  }, [allArticles, filter, searchQuery])

  const openEditor = (article) => {
    setEditingArticleId(article.id)
    setEditingArticleData(article)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingArticleId(null)
    setEditingArticleData(null)
  }

  // 기자 선택 핸들러 (모달 내 "이 기자의 다른 기사" 버튼에서 호출)
  const handleSelectJournalist = (info) => {
    setSelectedJournalist(info)
    // 선택 후 기자명단 영역으로 스크롤
    setTimeout(() => {
      document.getElementById('journalist-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const gridCls = columns === 2
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'

  return (
    <div className="min-h-screen bg-blue-50">
      <RoomBar />
      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-5">

        {/* 헤더 */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-800">여론판</h1>
            <p className="text-sm text-gray-600">
              우리가 만든 기사가 여론을 형성하고, 다음 차시의 출발점이 됩니다.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {role === 'student' && (
              <button
                type="button"
                onClick={() => { setEditingArticleId(null); setEditingArticleData(null); setEditorOpen(true) }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200/60 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 transition"
              >
                <span className="text-base">✏️</span>기사 작성
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(role === 'teacher' ? '/teacher' : returnPath)}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:border-indigo-300 transition"
            >
              ↩ 이전으로 복귀
            </button>
          </div>
        </header>

        {/* 교사: 승인 큐 */}
        {role === 'teacher' && (
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <ArticleApprovalQueue />
          </div>
        )}

        {/* 여론 브리핑 + 여론조사 */}
        <div className="grid md:grid-cols-2 gap-4">
          <OpinionBriefing />
          <PollResultGallery />
        </div>

        {/* 우리 모둠 기사 + 내가 작성한 문서 (학생) */}
        {role === 'student' && (
          <div className="space-y-2">
            <MyArticlesPanel articles={myArticles} onEdit={openEditor} />
            <MyGroupArticlesPanel articles={myGroupArticles} />
          </div>
        )}

        {/* 기자 명단 */}
        <div id="journalist-directory">
          <JournalistDirectory
            journalists={journalists}
            selected={selectedJournalist}
            onSelect={setSelectedJournalist}
            journalistArticles={journalistArticles}
            onArticleClick={setHeadlineArticle}
          />
        </div>

        {/* 검색 + 필터 + 단 설정 */}
        <div className="space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔎</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="제목·내용·기자이름·태그 검색..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white shrink-0">
              {[2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setColumns(n)}
                  className={`px-3 py-2 text-xs font-bold transition ${
                    columns === n ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {n}단
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 shrink-0">{articles.length}개</span>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {PERSPECTIVE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 text-sm rounded-lg transition ${
                  filter === f.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border hover:border-blue-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 기사 그리드 — 고정 높이 스크롤 컨테이너 */}
        <div className="overflow-y-auto rounded-2xl" style={{ height: '58vh', minHeight: '320px' }}>
          {articles.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border p-10 text-center text-gray-400 text-sm h-full flex items-center justify-center">
              {searchQuery ? `"${searchQuery}" 검색 결과가 없어요.` : '아직 게시된 기사가 없어요.'}
            </div>
          ) : (
            <div className={`${gridCls} pb-4`}>
              {articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  onSelectJournalist={handleSelectJournalist}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 기사 작성/수정 모달 */}
      {editorOpen && (
        <ArticleEditorModal
          onClose={closeEditor}
          editingArticleId={editingArticleId}
          articleData={editingArticleData}
        />
      )}

      {/* 헤드라인 목록에서 클릭한 기사 모달 */}
      {headlineArticle && (
        <ArticleDetailModal
          article={headlineArticle}
          onClose={() => setHeadlineArticle(null)}
          onSelectJournalist={handleSelectJournalist}
        />
      )}
    </div>
  )
}

export default NewsBoardPage
