import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import EntryPage from './pages/EntryPage'
import Phase1Page from './pages/Phase1Page'
import Phase2Page from './pages/Phase2Page'
import Phase3Page from './pages/Phase3Page'
import NewsBoardPage from './pages/NewsBoardPage'
import ReflectionPage from './pages/ReflectionPage'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentAnalyticsPage from './pages/StudentAnalyticsPage'
import PosterGalleryPage from './pages/PosterGalleryPage'
import SuperAdminPage from './pages/SuperAdminPage'
import QrSharePage from './pages/QrSharePage'
import DebateTimerTVPage from './pages/DebateTimerTVPage'
import PhaseGate from './components/shared/PhaseGate'
import StudentAutoNavigator from './components/shared/StudentAutoNavigator'
import useGameStore from './store/gameStore'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth } from './lib/firebase'
import OpinionSideBanner from './components/news/OpinionSideBanner'
import GlobalPollPopup from './components/shared/GlobalPollPopup'
import DebateToolPanel from './components/debate/DebateToolPanel'
import ConnectionStatusOverlay from './components/shared/ConnectionStatusOverlay'
import LegislativeBoardModal from './components/phase3/LegislativeBoardModal'
import TVBoardPage from './pages/TVBoardPage'
import JourneyViewPage from './pages/JourneyViewPage'
import TVExecutiveBoardPage from './pages/TVExecutiveBoardPage'
import './App.css'

function App() {
  const roomCode = useGameStore((s) => s.roomCode)
  const attachListener = useGameStore((s) => s.attachListener)
  // 브라우저 탭 제목 동적 표시용
  const role = useGameStore((s) => s.role)
  const countryName = useGameStore((s) => s.config?.countryName || s.roomData?.config?.countryName)
  const className = useGameStore((s) => s.roomData?.className)

  // Firebase Auth 준비 완료 여부
  const [authReady, setAuthReady] = useState(false)

  // 앱 시작 시 Firebase Auth 상태 확인 — 미로그인이면 익명 로그인 후 authReady
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 로그인 상태 확인 완료
        setAuthReady(true)
      } else {
        // 미로그인 → 익명 로그인 후 onAuthStateChanged가 다시 호출됨
        signInAnonymously(auth).catch((e) => {
          console.warn('[Auth] 익명 로그인 실패:', e.message)
          setAuthReady(true) // 실패해도 앱은 동작하도록
        })
      }
    })
    return () => unsubscribe()
  }, [])

  // Auth 준비 완료 후 저장된 roomCode로 Firebase 구독 시작
  useEffect(() => {
    if (authReady && roomCode && typeof attachListener === 'function') {
      attachListener(roomCode)
    }
  }, [authReady, roomCode, attachListener])

  // TV 송출용 새 창인지 감지 — globals 미마운트
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const isTVBoardWindow = hash.startsWith('#/tv-board') || hash.startsWith('#/debate-timer-tv') || hash.startsWith('#/tv-executive-board')

  // 탭 제목 — 역할(교사/학생) + 학급의 나라 이름으로 구분
  useEffect(() => {
    if (isTVBoardWindow) return
    const tail = (countryName && String(countryName).trim()) || (className && String(className).trim()) || '작은 대한민국'
    const prefix = role === 'teacher' ? '민국이의 꿈 (교사)' : role === 'student' ? '민국이의 꿈 (학생)' : '민국이의 꿈'
    document.title = `${prefix} - ${tail}`
  }, [role, countryName, className, isTVBoardWindow])

  if (isTVBoardWindow) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/tv-board" element={<TVBoardPage />} />
          <Route path="/debate-timer-tv" element={<DebateTimerTVPage />} />
          <Route path="/tv-executive-board" element={<TVExecutiveBoardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    )
  }

  return (
    <HashRouter>
      <ConnectionStatusOverlay />
      <OpinionSideBanner />
      <GlobalPollPopup />
      <DebateToolPanel />
      <LegislativeBoardModal />
      <StudentAutoNavigator />
      <Routes>
        <Route path="/" element={<EntryPage />} />

        <Route
          path="/phase1"
          element={
            <PhaseGate allowedPhases={[1]} readOnlyPhases={[2, 3, 4]}>
              <Phase1Page />
            </PhaseGate>
          }
        />
        <Route
          path="/phase2"
          element={
            <PhaseGate allowedPhases={[2]} readOnlyPhases={[3, 4]}>
              <Phase2Page />
            </PhaseGate>
          }
        />
        <Route
          path="/phase3"
          element={
            <PhaseGate allowedPhases={[3]} readOnlyPhases={[4]}>
              <Phase3Page />
            </PhaseGate>
          }
        />
        <Route
          path="/news"
          element={
            <PhaseGate allowedPhases={[1, 2, 3, 4]} readOnlyPhases={[]}>
              <NewsBoardPage />
            </PhaseGate>
          }
        />
        <Route
          path="/reflection"
          element={
            <PhaseGate allowedPhases={[4]} readOnlyPhases={[]}>
              <ReflectionPage />
            </PhaseGate>
          }
        />
        <Route path="/journey" element={<JourneyViewPage />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/analytics" element={<StudentAnalyticsPage />} />
        <Route path="/gallery" element={<PosterGalleryPage />} />
        <Route path="/super-admin" element={<SuperAdminPage />} />
        <Route path="/share" element={<QrSharePage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
