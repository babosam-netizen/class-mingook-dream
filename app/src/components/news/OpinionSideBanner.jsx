import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import { isPlannedPollReached } from '../../lib/poll-visibility'
import { 
  GripVertical, 
  TrendingUp, 
  Vote, 
  FileText, 
  ChevronRight, 
  Minimize2, 
  Maximize2,
  MessageSquare
} from 'lucide-react'

/**
 * 학생 화면 — 우측 중앙 드래그 가능 세로 배너.
 *
 * 표시 항목:
 *   📊 활성 여론조사 (status='voting'|'published')
 *   🔥 인기 기사 (댓글 평가 합 + 댓글 수)
 *   📰 최근 기사 (approvedAt 기준)
 *
 * - 세로 무한 스크롤(CSS keyframe), 마우스 hover 시 정지
 * - 드래그로 위치 이동(상단 손잡이), 위치는 localStorage에 저장
 * - 최소화 버튼: 작은 아이콘으로 축소
 * - 본문이 너무 좁으면 안 되니 폭 200px 고정
 */
// 안정적 참조 상수 — selector 또는 state 기본값으로 사용하여 무한 리렌더 방지
const EMPTY_OBJ = {}
const EMPTY_ARRAY = []

const PERSPECTIVE_EMOJI = {
  critical: <MessageSquare size={10} className="text-rose-500" />,
  supportive: <MessageSquare size={10} className="text-emerald-500" />,
  neutral: <MessageSquare size={10} className="text-slate-500" />,
}

const STORAGE_KEY = 'class-democra-opinion-banner'
const WIDTH = 200
const HEIGHT = 360

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function clampPos(x, y, w = WIDTH, h = HEIGHT) {
  const maxX = Math.max(0, window.innerWidth - w - 8)
  const maxY = Math.max(0, window.innerHeight - h - 8)
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  }
}

function OpinionSideBanner() {
  const navigate = useNavigate()
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups) || EMPTY_OBJ
  const currentPhase = useGameStore((s) => s.currentPhase)
  const roomData = useGameStore((s) => s.roomData)
  const wf = useWorkflow()

  const [articlesMap, setArticlesMap] = useState(EMPTY_OBJ)
  const [commentsMap, setCommentsMap] = useState(EMPTY_OBJ)
  const [pollsMap, setPollsMap] = useState(EMPTY_OBJ)

  const initial = useMemo(() => loadPersisted(), [])
  const [minimized, setMinimized] = useState(initial?.minimized ?? false)
  const curW = minimized ? 48 : WIDTH
  const curH = minimized ? 48 : HEIGHT

  // 위치 상태
  const [pos, setPos] = useState(() =>
    clampPos(
      initial?.x ?? window.innerWidth - curW - 24,
      initial?.y ?? 100,
      curW,
      curH
    ),
  )

  // 위치 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: pos.x, y: pos.y, minimized }))
  }, [pos, minimized])

  // 창 리사이즈에 따라 위치 클램프
  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p.x, p.y, curW, curH))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [curW, curH])

  // 데이터 구독
  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'articles', (d) => setArticlesMap(d || EMPTY_OBJ))
    const u2 = subscribe(roomCode, 'comments', (d) => setCommentsMap(d || EMPTY_OBJ))
    const u3 = subscribe(roomCode, 'polls', (d) => setPollsMap(d || EMPTY_OBJ))
    return () => {
      u1?.()
      u2?.()
      u3?.()
    }
  }, [roomCode])

  // 표시 항목 합성
  const items = useMemo(() => {
    if (!articlesMap || Object.keys(articlesMap).length === 0) {
      if (!pollsMap || Object.keys(pollsMap).length === 0) return EMPTY_ARRAY
    }
    const out = []

    // 1) 활성 여론조사
    for (const [pid, p] of Object.entries(pollsMap || {})) {
      if (!p) continue
      
      let shouldShow = false
      if (!p.phaseStep) {
        // 실시간(수시) 여론조사: 진행 중이거나 게시됨 모두 노출
        shouldShow = p.status === 'voting' || p.status === 'published'
      } else {
        // 기본(계획된) 여론조사
        if (p.status === 'published') {
          shouldShow = isPlannedPollReached(p, currentPhase, roomData)
        } else if (p.status === 'voting') {
          // 투표 진행 중일 때는 현재 활동(워크플로) 순서일 때만 노출
          shouldShow = p.phaseStep.phase === currentPhase && p.phaseStep.stepId === wf.currentStep?.id
        }
      }

      if (shouldShow) {
        let winnerOption = null
        if (p.status === 'published' && p.options) {
          const counts = {}
          // pollsMap 안의 p.votes 가 없을 수도 있으니 구조 확인 필요 (보통 p.votes 에 들어있음)
          const pollVotes = p.votes || {}
          for (const v of Object.values(pollVotes)) {
            if (v.optionId) counts[v.optionId] = (counts[v.optionId] || 0) + 1
          }
          let max = -1
          for (const opt of p.options) {
            const c = counts[opt.id] || 0
            if (c > max) {
              max = c
              winnerOption = opt.label || opt.text || opt.id
            }
          }
        }
        out.push({
          kind: 'poll',
          id: `poll-${pid}`,
          tag: p.tag,
          title: p.question,
          status: p.status,
          winner: winnerOption,
          hasVoted: myStudentId ? !!p.votes?.[myStudentId] : false,
        })
      }
    }

    // 2) 기사 — 인기/최근 합집합 (인기 3 + 최근 3, 중복 제거)
    const articles = Object.entries(articlesMap || {})
      .map(([id, a]) => ({ id, ...a }))
      .filter((a) => a?.status === 'approved')

    if (articles.length > 0) {
      const scoreById = {}
      const countById = {}
      for (const c of Object.values(commentsMap || {})) {
        if (c?.targetType !== 'article' || !c?.targetId) continue
        const r = c.ratings || {}
        const sum =
          (Number(r.logic) || 0) +
          (Number(r.feasibility) || 0) +
          (Number(r.relevance) || 0)
        scoreById[c.targetId] = (scoreById[c.targetId] || 0) + sum
        countById[c.targetId] = (countById[c.targetId] || 0) + 1
      }
      const decorated = articles.map((a) => ({
        ...a,
        score: (scoreById[a.id] || 0) + (countById[a.id] || 0),
      }))
      const popular = [...decorated]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      const recent = [...decorated]
        .sort(
          (a, b) =>
            (b.approvedAt || b.createdAt || 0) -
            (a.approvedAt || a.createdAt || 0),
        )
        .slice(0, 3)
      const seen = new Set()
      for (const a of popular) {
        if (seen.has(a.id)) continue
        seen.add(a.id)
        out.push({
          kind: 'popular',
          id: `popular-${a.id}`,
          articleId: a.id,
          tag: '🔥 인기',
          title: a.headline,
          group: a.authorGroupId ? groups[a.authorGroupId]?.name : null,
          perspective: a.perspective,
          score: a.score,
        })
      }
      for (const a of recent) {
        if (seen.has(a.id)) continue
        seen.add(a.id)
        out.push({
          kind: 'recent',
          id: `recent-${a.id}`,
          articleId: a.id,
          tag: '📰 최근',
          title: a.headline,
          group: a.authorGroupId ? groups[a.authorGroupId]?.name : null,
          perspective: a.perspective,
        })
      }
    }

    return out
  }, [articlesMap, commentsMap, pollsMap, groups, myStudentId, currentPhase, roomData, wf.currentStep?.id])

  // 무한 스크롤 항목 반복 (최소 12개 이상 & 항상 4배수로 복제하여 끊김 방지)
  // ⚠️ 훅 규칙: useMemo는 반드시 얼리 리턴보다 먼저 호출되어야 함
  const looped = useMemo(() => {
    if (items.length === 0) return EMPTY_ARRAY
    const repeat = Math.max(4, Math.ceil(12 / items.length) * 4)
    const res = []
    for (let i = 0; i < repeat; i++) res.push(...items)
    return res
  }, [items])

  // 항목당 약 10초씩 화면에 머무르도록 — (looped 전체 / 2)가 실제 스크롤 항목 수
  const animDuration = Math.max(40, (looped.length / 2) * 10)

  // posRef: 드래그 핸들러가 stale closure 없이 최신 pos를 읽기 위해
  const posRef = useRef(pos)
  useEffect(() => { posRef.current = pos }, [pos])

  // 드래그 핸들 ref — 네이티브 이벤트로 등록해 { passive: false } 지원
  const dragHandleRef = useRef(null)
  useEffect(() => {
    const el = dragHandleRef.current
    if (!el) return
    const onStart = (e) => {
      // [Antigravity] 드래그 시작 시 클릭 이벤트 전파 차단 (최소화 상태에서 드래그 시 확장 방지)
      e.stopPropagation()
      const t = e.touches?.[0]
      const startX = t?.clientX ?? e.clientX
      const startY = t?.clientY ?? e.clientY
      const orig = { ...posRef.current }
      const onMove = (ev) => {
        if (ev.cancelable) ev.preventDefault()
        const mt = ev.touches?.[0]
        const cx = mt?.clientX ?? ev.clientX
        const cy = mt?.clientY ?? ev.clientY
        setPos(clampPos(orig.x + (cx - startX), orig.y + (cy - startY), curW, curH))
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onUp)
    }
    el.addEventListener('mousedown', onStart)
    el.addEventListener('touchstart', onStart, { passive: false })
    return () => {
      el.removeEventListener('mousedown', onStart)
      el.removeEventListener('touchstart', onStart)
    }
  }, [minimized]) // [Antigravity] 최소화 상태 변경 시 핸들이 새로 그려지므로 리스너 재등록 필요


  // 학생 전용
  if (role !== 'student') return null
  // items가 없어도 여론판 바로가기는 보여야 하므로 리턴 제거 [Antigravity]

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: minimized ? 48 : WIDTH,
        height: minimized ? 48 : HEIGHT,
        zIndex: 50,
        transition: 'width 0.3s ease, height 0.3s ease',
      }}
      className={`bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50 flex flex-col overflow-hidden transition-all duration-300 ${
        minimized ? 'hover:scale-110 cursor-pointer' : ''
      }`}
      onClick={() => minimized && setMinimized(false)}
    >
      {/* 헤더 — 드래그 손잡이 */}
      <div
        className={`flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-600/90 to-blue-600/90 text-white select-none ${
          minimized ? 'h-full justify-center p-0' : ''
        }`}
      >
        <div
          ref={dragHandleRef}
          className={`flex items-center gap-1.5 cursor-move active:cursor-grabbing flex-1 h-full py-1 ${
            minimized ? 'justify-center' : ''
          }`}
          title="드래그로 이동"
          style={{ touchAction: 'none' }}
        >
          {minimized ? (
            <TrendingUp size={24} />
          ) : (
            <>
              <GripVertical size={14} className="opacity-70" />
              <span className="text-[11px] font-extrabold tracking-tight uppercase">한눈에 여론</span>
            </>
          )}
        </div>
        
        {!minimized && (
          <button 
            onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
            className="p-1 hover:bg-white/20 rounded-md transition-colors"
          >
            <Minimize2 size={14} />
          </button>
        )}
      </div>

      {!minimized && (
        <>
          {/* 무한 스크롤 본문 */}
          <div className="flex-1 overflow-hidden relative group bg-gradient-to-b from-transparent to-indigo-50/30">
            <div
              className="absolute inset-x-0 vmarquee-track"
              style={{
                animation: `vmarquee ${animDuration}s linear infinite`,
                willChange: 'transform',
              }}
            >
              {looped.map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  onClick={() => navigate(item.articleId ? `/news?article=${item.articleId}` : '/news')}
                  className="block w-full text-left px-3 py-3 border-b border-indigo-100/50 hover:bg-white/60 transition-all group/item"
                >
                  {/* 태그 줄 */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className={`p-1 rounded-md ${
                      item.kind === 'poll' ? 'bg-amber-100 text-amber-600' : 
                      item.kind === 'popular' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {item.kind === 'poll' ? <Vote size={10} /> : 
                       item.kind === 'popular' ? <TrendingUp size={10} /> : <FileText size={10} />}
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 tracking-tighter">
                      {item.tag}
                    </span>
                    {item.kind === 'poll' && item.status === 'voting' && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 animate-pulse">
                        <span className="w-1 h-1 bg-amber-500 rounded-full" />
                        진행중
                      </span>
                    )}
                  </div>

                  {/* 콘텐츠 영역 */}
                  <div className="space-y-1.5">
                    <h3 className="text-[12px] font-bold text-slate-800 leading-[1.3] line-clamp-2 group-hover/item:text-indigo-600 transition-colors">
                      {item.title}
                    </h3>

                    {item.kind === 'poll' && item.status === 'published' && item.winner && (
                      <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-1.5 mt-1">
                        <span className="text-[10px]">🏆</span>
                        <span className="text-[10px] font-bold text-indigo-700 truncate flex-1">
                          {item.winner}
                        </span>
                      </div>
                    )}

                    {item.kind !== 'poll' && (
                      <div className="flex items-center gap-1.5">
                        {item.perspective && PERSPECTIVE_EMOJI[item.perspective]}
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          {item.group || '익명'}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {/* 상하 페이드 처리 */}
            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          </div>

          {/* 하단 — 여론판 이동 */}
          <button
            onClick={() => navigate('/news')}
            className="flex items-center justify-between px-3 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <span className="text-[11px] font-bold">여론판 바로가기</span>
            <ChevronRight size={14} />
          </button>
        </>
      )}

      <style>{`
        @keyframes vmarquee {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .group:hover .vmarquee-track {
          animation-play-state: paused !important;
        }
      `}</style>
    </div>
  )
}

export default OpinionSideBanner
