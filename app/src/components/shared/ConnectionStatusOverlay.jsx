import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../../store/gameStore'

/**
 * 전역 네트워크 상태 오버레이.
 *
 * 동작:
 *  - 'disconnected' 가 5초 이상 지속되면 풀스크린 안내 (입력 차단)
 *    → 자동 재연결 시도 중. 끊긴 시점 표시 + 임시저장 안내
 *    → 폼 입력값(local state) 은 화면이 그대로라 보존됨
 *  - 'kicked' (교사가 학생 삭제 또는 학생 데이터 누락) → 강제 재로그인 모달
 *    → '다시 입장하기' 버튼으로 EntryPage 로 이동
 *  - 'connected' → 오버레이 숨김. 끊겼다가 돌아온 직후 1.5초간 '연결 복구됨' 토스트
 */
function ConnectionStatusOverlay() {
  const navigate = useNavigate()
  const status = useGameStore((s) => s.connectionStatus)
  const lostAt = useGameStore((s) => s.connectionLostAt)
  const role = useGameStore((s) => s.role)

  const [now, setNow] = useState(Date.now())
  const [showRecovered, setShowRecovered] = useState(false)
  const [prevStatus, setPrevStatus] = useState(status)

  // 1초 tick — 끊긴 시간 카운트
  useEffect(() => {
    if (status !== 'disconnected') return
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [status])

  // 끊김 → 연결 복구 토스트
  useEffect(() => {
    if (prevStatus === 'disconnected' && status === 'connected') {
      setShowRecovered(true)
      const t = setTimeout(() => setShowRecovered(false), 1500)
      return () => clearTimeout(t)
    }
    setPrevStatus(status)
  }, [status, prevStatus])

  // ===== 강퇴 / 세션 만료 =====
  if (status === 'kicked') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
          <div className="text-5xl">📤</div>
          <h2 className="text-xl font-bold text-gray-900">세션이 종료되었어요</h2>
          <p className="text-sm text-gray-600">
            선생님이 학생 정보를 정리하셨거나 새 학기 준비로 방이 초기화되었어요.<br />
            번호와 이름을 다시 입력하면 곧바로 이어서 활동할 수 있어요.
          </p>
          <button
            onClick={() => {
              // 강퇴 상태 해제 후 홈으로
              useGameStore.setState({ connectionStatus: 'connected' })
              navigate('/')
            }}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700"
          >
            다시 입장하기
          </button>
        </div>
      </div>
    )
  }

  // ===== 연결 끊김 (5초 이상 지속될 때만) =====
  // 짧은 깜빡 끊김으로 사용자 경험을 망치지 않도록 5초 임계값
  const sinceLost = lostAt ? now - lostAt : 0
  const showDisconnected = status === 'disconnected' && sinceLost >= 5000

  if (showDisconnected) {
    const seconds = Math.floor(sinceLost / 1000)
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-amber-900/80 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 border-4 border-amber-400">
          <div className="text-center text-5xl animate-pulse">📡</div>
          <h2 className="text-xl font-bold text-amber-900 text-center">
            인터넷 연결이 끊어졌어요
          </h2>
          <div className="bg-amber-50 rounded-lg p-3 space-y-1.5 text-sm text-amber-900">
            <p>• <b>자동으로 다시 연결</b>을 시도하고 있어요. 페이지를 닫지 마세요.</p>
            <p>• 작성 중인 글은 <b>화면을 그대로 두면</b> 사라지지 않아요.</p>
            <p>• 와이파이 / 데이터를 확인해 주세요.</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-amber-700">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            끊긴 지 <b className="tabular-nums">{seconds}</b>초 · 재연결 시도 중...
          </div>
          {seconds >= 30 && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700"
            >
              30초 넘게 끊겨 있어요 — 새로고침 시도
            </button>
          )}
          {role && (
            <p className="text-[10px] text-gray-400 text-center">
              내 역할: {role === 'teacher' ? '교사' : '학생'} · 자동 재접속 중
            </p>
          )}
        </div>
      </div>
    )
  }

  // ===== 연결 복구 토스트 =====
  if (showRecovered) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold shadow-lg flex items-center gap-2 animate-bounce">
        <span className="inline-block w-2 h-2 rounded-full bg-white" />
        ✓ 연결 복구됨
      </div>
    )
  }

  // ===== disconnected 상태인데 5초 미만 — 작은 상단 표시만 =====
  if (status === 'disconnected') {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[90] px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-semibold shadow flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        연결 확인 중...
      </div>
    )
  }

  return null
}

export default ConnectionStatusOverlay
