import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useGameStore from '../../store/gameStore'

/**
 * 학생 자동 페이즈 전환기 — 라우터 안에서 동작.
 *
 * 학생은 메뉴 없이 currentPhase에 따라 자동으로 해당 페이지로 강제 이동.
 * 교사가 Phase 2 → Phase 3로 전환하면 학생 화면이 자동으로 /phase3로 바뀐다.
 *
 * 학생이 직접 다른 URL로 가려고 해도 currentPhase 페이지로 즉시 redirect.
 *
 * 교사·미입장 사용자는 그대로 둠.
 */
const PHASE_PATH = {
  1: '/phase1',
  2: '/phase2',
  3: '/phase3',
  4: '/reflection',
}

// 학생이 자유롭게 머물 수 있는 예외 경로 (여론판, 갤러리 등)
const ALLOWED_FOR_STUDENT = ['/super-admin', '/share', '/news', '/gallery']

const normalizePath = (pathname) => {
  if (!pathname) return '/'
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

function StudentAutoNavigator() {
  const navigate = useNavigate()
  const location = useLocation()
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const currentPhase = useGameStore((s) => s.currentPhase)

  useEffect(() => {
    if (role !== 'student' || !roomCode) return
    const target = PHASE_PATH[currentPhase] || '/phase1'
    const current = normalizePath(location.pathname)
    // 학생이 명시적으로 머물 수 있는 페이지에 있으면 그대로 둔다(여론판 등)
    if (ALLOWED_FOR_STUDENT.includes(current)) return
    if (current === '/') {
      navigate(target, { replace: true })
      return
    }
    if (current !== target) {
      navigate(target, { replace: true })
    }
  }, [role, roomCode, currentPhase, location.pathname, navigate])

  return null
}

export default StudentAutoNavigator
