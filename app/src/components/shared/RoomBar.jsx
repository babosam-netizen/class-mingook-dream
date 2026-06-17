import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { PHASE_META } from '../../styles/tokens'
import PollManagerModal from '../teacher/PollManagerModal'
import { APP_BUILD } from '../../lib/build-info'

function RoomBar() {
  const navigate = useNavigate()
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const className = useGameStore((s) => s.className)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const myNickname = useGameStore((s) => s.myNickname)
  const myNumber = useGameStore((s) => s.myNumber)
  const leaveRoom = useGameStore((s) => s.leaveRoom)
  const setPhase = useGameStore((s) => s.setPhase)
  const connectionStatus = useGameStore((s) => s.connectionStatus)

  const [isPollModalOpen, setIsPollModalOpen] = useState(false)

  const handleLeave = () => {
    if (window.confirm('나가시겠어요?')) {
      leaveRoom()
      navigate('/')
    }
  }

  const tabs = [
    { to: '/phase1', label: '시민광장', phase: 1 },
    { to: '/phase2', label: '선거', phase: 2 },
    { to: '/phase3', label: '국정포털', phase: 3 },
    { to: '/news', label: '여론판', phase: 'news' }, // 'news'는 페이즈 전환 안 함
    { to: '/reflection', label: '정리글벽', phase: 4 },
  ]

  // 교사가 페이즈 탭을 클릭하면 본인 이동 + 학생도 함께 이동(setPhase)
  const handleTeacherTab = (tab) => (e) => {
    if (typeof tab.phase === 'number' && tab.phase !== currentPhase) {
      setPhase(tab.phase)
    }
    // <Link>의 기본 navigate는 그대로 진행
  }

  return (
    <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {/* 연결 상태 표시등 — 학생만 (교사는 학생 모니터로 확인) */}
          {role === 'student' && (
            <span
              className={`inline-flex items-center justify-center w-2.5 h-2.5 rounded-full transition ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse'
                  : connectionStatus === 'kicked'
                  ? 'bg-rose-500'
                  : 'bg-amber-400 animate-pulse'
              }`}
              title={
                connectionStatus === 'connected'
                  ? '✓ 접속 중'
                  : connectionStatus === 'kicked'
                  ? '세션 종료됨'
                  : '연결 확인 중...'
              }
            />
          )}
          <span className="font-bold text-indigo-700">민국이의 꿈</span>
          <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
            {className || '학급'}
          </span>
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-mono">
            {roomCode}
          </span>
          <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-mono">
            {APP_BUILD}
          </span>
        </div>

        <nav className="flex items-center gap-1 ml-auto flex-wrap">
          {/* 학생은 메뉴 없음 — 교사가 페이즈를 옮기면 자동 전환 */}
          {role === 'teacher' && (
            <>
              {tabs.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  onClick={handleTeacherTab(t)}
                  className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100"
                  title={
                    typeof t.phase === 'number'
                      ? `${t.phase === 1 ? '첫 번째' : t.phase === 2 ? '두 번째' : t.phase === 3 ? '세 번째' : '네 번째'} 여정으로 전환 + 학생 자동 이동`
                      : t.label
                  }
                >
                  {t.label}
                </Link>
              ))}
              <button
                onClick={() => setIsPollModalOpen(true)}
                className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-bold ml-2"
              >
                ⚡ 여론조사
              </button>
              <Link
                to="/teacher"
                className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                👩‍🏫 교사실
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <Link
            to={currentPhase === 4 ? '/reflection' : `/phase${currentPhase}`}
            className="text-gray-500 hover:text-indigo-600 hover:underline transition-colors"
            title="현재 활동 화면으로 이동"
          >
            {PHASE_META[currentPhase]?.label}
          </Link>
          <span className="text-gray-700 font-semibold">
            {role === 'teacher'
              ? '👩‍🏫 선생님'
              : `${myNumber}번 ${myNickname}`}
          </span>
          <button
            onClick={handleLeave}
            className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded"
          >
            나가기
          </button>
        </div>
      </div>
      {role === 'teacher' && (
        <PollManagerModal isOpen={isPollModalOpen} onClose={() => setIsPollModalOpen(false)} />
      )}
    </header>
  )
}

export default RoomBar
