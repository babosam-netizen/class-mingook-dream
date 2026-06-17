import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { onValue, ref } from 'firebase/database'
import { database } from '../lib/firebase'
import DebateTimer from '../components/debate/tools/DebateTimer'
import { formatCanvaEmbedUrl } from '../lib/canva-embed'

/**
 * TV 송출용 토론 타이머 전용 페이지.
 * - 전체화면 타이머가 기본 (토글 버튼 없음)
 * - judicialPresentation 이 있으면 타이머 위에 증거 오버레이
 *   (단계명 + 타이머는 상단에 작게 실시간 표시)
 */
function DebateTimerTVPage() {
  const [search] = useSearchParams()
  const roomCode = search.get('room')
  const sessionId = search.get('sessionId')

  const [session, setSession] = useState(null)
  const [presentation, setPresentation] = useState(null)
  const [, setTick] = useState(0)
  const intervalRef = useRef(null)
  // 이 TV 창이 열린 시각 — 이후에 설정된 송출만 표시
  const mountTimeRef = useRef(Date.now())
  const firstSnapRef = useRef(true)

  useEffect(() => {
    if (!roomCode || !sessionId) return
    const u = onValue(ref(database, `rooms/${roomCode}/debateSessions/${sessionId}`), (snap) => {
      setSession(snap.val())
    })
    return () => u?.()
  }, [roomCode, sessionId])

  useEffect(() => {
    if (!roomCode) return
    const u = onValue(ref(database, `rooms/${roomCode}/judicialPresentation`), (snap) => {
      // 첫 스냅샷은 창 열기 전 잔여 데이터 → 무시
      if (firstSnapRef.current) {
        firstSnapRef.current = false
        return
      }
      setPresentation(snap.val())
    })
    return () => u?.()
  }, [roomCode])

  // 매초 tick — 오버레이 타이머 갱신용
  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  if (!roomCode || !sessionId) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-xl">
        ⚠ 파라미터가 부족합니다. (room, sessionId)
      </div>
    )
  }

  const hasEvidence = presentation?.type === 'evidence'
  const timer = session?.debateTimer
  const stages = Array.isArray(timer?.stages) ? timer.stages : []
  const curIdx = Math.max(0, Math.min((timer?.currentStage ?? 0), stages.length - 1))
  const curStage = stages[curIdx]

  const sideLabel = hasEvidence
    ? presentation.side === 'prosecution' ? '🔴 검사측 증거'
    : presentation.side === 'defense' ? '🔵 변호측 증거'
    : '🟣 공통 자료'
    : ''

  // 남은 시간 계산 (매초 tick으로 갱신)
  const secondsLeft = (() => {
    if (!timer) return 0
    if (!timer.isRunning || timer.isPaused) return timer.secondsLeft ?? 0
    const elapsed = Math.floor((Date.now() - (timer.startedAt || Date.now())) / 1000)
    return Math.max(0, (timer.secondsLeft ?? 0) - elapsed)
  })()
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">

      {/* ── 전체화면 타이머 (기본, 항상 표시) ── */}
      <div className="absolute inset-0">
        <DebateTimer timer={timer} topic={session?.topic} defaultFullscreen={true} />
      </div>

      {/* ── 증거 오버레이 (타이머 z-[60] 위에) ── */}
      {hasEvidence && (
        <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col text-white">

          {/* 상단 미니 타이머 바 */}
          <div className="flex-shrink-0 flex items-center justify-between px-8 py-3 bg-black/60 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-black text-white/40 uppercase tracking-widest shrink-0">진행 중</span>
              {curStage && (
                <span className="text-sm font-bold text-white/80 truncate">{curStage.label}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-2xl font-black tabular-nums ${secondsLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {mm}:{ss}
              </span>
              {timer?.isRunning && !timer?.isPaused && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
          </div>

          {/* 증거 본문 — 이미지/Canva 있으면 좌우 분할, 없으면 텍스트 중앙 */}
          <div className={`flex-1 min-h-0 flex ${(presentation.imageUrl || presentation.canvaUrl) ? 'flex-col lg:flex-row' : 'items-center justify-center p-10'}`}>

            {(presentation.imageUrl || presentation.canvaUrl) ? (
              <>
                {/* 이미지 / Canva */}
                <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
                  {presentation.canvaUrl ? (
                    <iframe
                      src={formatCanvaEmbedUrl(presentation.canvaUrl)}
                      allowFullScreen
                      allow="fullscreen"
                      className="w-full h-full border-0"
                      title={presentation.title || '증거 자료'}
                    />
                  ) : (
                    <img
                      src={presentation.imageUrl}
                      alt={presentation.title || '증거 사진'}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                {/* 텍스트 사이드 */}
                <div className="lg:w-96 flex-shrink-0 flex flex-col bg-white/5 border-t lg:border-t-0 lg:border-l border-white/10 p-6 space-y-4 overflow-y-auto">
                  <div>
                    <span className="text-xs font-black text-white/40 uppercase tracking-widest">{sideLabel}</span>
                    <h2 className="text-2xl font-black mt-1 leading-tight">{presentation.title}</h2>
                  </div>
                  {presentation.description && (
                    <div>
                      <p className="text-xs font-bold text-white/40 mb-1">증거 설명</p>
                      <p className="text-base leading-relaxed text-white/85">{presentation.description}</p>
                    </div>
                  )}
                  {presentation.sampleContent && (
                    <div className="rounded-xl bg-white/10 border border-white/10 p-4">
                      <p className="text-xs font-bold text-white/40 mb-2">자료 내용</p>
                      <p className="text-3xl leading-relaxed whitespace-pre-wrap text-white/75">{presentation.sampleContent}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* 이미지 없을 때 — 텍스트 전체화면 중앙 배치 */
              <div className="w-full max-w-4xl space-y-8 text-center">
                <div>
                  <span className="text-sm font-black text-white/40 uppercase tracking-widest">{sideLabel}</span>
                  <h2 className="text-5xl font-black mt-3 leading-tight">{presentation.title}</h2>
                </div>
                {presentation.imageHint && (
                  <div className="inline-block bg-white/10 border border-white/20 rounded-2xl px-8 py-5">
                    <p className="text-xs font-bold text-white/40 mb-2">자료 형태</p>
                    <p className="text-2xl font-bold text-white/80">{presentation.imageHint}</p>
                  </div>
                )}
                {presentation.description && (
                  <p className="text-2xl leading-relaxed text-white/85">{presentation.description}</p>
                )}
                {presentation.sampleContent && (
                  <div className="text-left rounded-2xl bg-white/10 border border-white/10 p-8">
                    <p className="text-xs font-bold text-white/40 mb-3">자료 내용</p>
                    <p className="text-6xl leading-relaxed whitespace-pre-wrap text-white/80">{presentation.sampleContent}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        body { background-color: black; margin: 0; padding: 0; }
        .bg-white { background-color: transparent !important; border: none !important; box-shadow: none !important; }
        .text-gray-900, .text-gray-800 { color: white !important; }
        .text-gray-500 { color: rgba(255,255,255,0.6) !important; }
        .text-indigo-700, .text-indigo-600 { color: #818cf8 !important; }
      `}</style>
    </div>
  )
}

export default DebateTimerTVPage
