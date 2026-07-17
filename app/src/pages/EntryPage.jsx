import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import useGameStore, { getDefaultConfig } from '../store/gameStore'
import ClassroomConfigEditor from '../components/teacher/ClassroomConfigEditor'

// 교사 모드 진입 암호. .env.local(또는 배포 환경변수)의 VITE_TEACHER_PASSCODE로 지정.
// 값이 없으면 어떤 입력으로도 통과할 수 없도록 잠금(fail-closed) — 예전엔 '123467'
// 하드코딩 기본값으로 조용히 열려있던 걸, 설정을 깜빡하면 아예 막히도록 바꿈.
const TEACHER_PASSCODE = import.meta.env.VITE_TEACHER_PASSCODE || null
// Firebase Auth 교사 계정 (Firebase Console에서 미리 생성해야 함)
const TEACHER_EMAIL =
  import.meta.env.VITE_TEACHER_EMAIL || 'teacher@mingook.app'
const TEACHER_UNLOCK_KEY = 'class-democra-teacher-unlocked'
const EMPTY_ROOMS = []

function EntryPage() {
  const navigate = useNavigate()
  const createRoom = useGameStore((s) => s.createRoom)
  const joinRoom = useGameStore((s) => s.joinRoom)
  const enterTeacherRoom = useGameStore((s) => s.enterTeacherRoom)
  const forgetTeacherRoom = useGameStore((s) => s.forgetTeacherRoom)
  const forgetStudentRoom = useGameStore((s) => s.forgetStudentRoom)
  const teacherRooms = useGameStore((s) => s.teacherRooms) || EMPTY_ROOMS
  const studentRooms = useGameStore((s) => s.studentRooms) || EMPTY_ROOMS

  // mode: null | 'teacher_auth' | 'teacher' | 'student'
  const [mode, setMode] = useState(null)
  const [className, setClassName] = useState('6학년 9반')
  const [setupNow, setSetupNow] = useState(false)
  const [config, setConfig] = useState(() => ({ ...getDefaultConfig(), classSize: 24 }))
  const [showCreate, setShowCreate] = useState(false)

  const [passcode, setPasscode] = useState('')

  const [code, setCode] = useState('')
  const [number, setNumber] = useState('')
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onClickTeacher = () => {
    setError('')
    // Firebase Auth 로그인 상태이고 세션도 유효하면 바로 교사 모드로
    const isFirebaseLoggedIn = auth.currentUser && !auth.currentUser.isAnonymous
    if (sessionStorage.getItem(TEACHER_UNLOCK_KEY) === '1' && isFirebaseLoggedIn) {
      setMode('teacher')
    } else {
      // Firebase 로그인이 없으면 세션 키 초기화 후 재인증
      sessionStorage.removeItem(TEACHER_UNLOCK_KEY)
      setMode('teacher_auth')
    }
  }

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault()
    if (passcode.trim() !== TEACHER_PASSCODE) {
      setError('암호가 일치하지 않습니다.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // Firebase 교사 계정으로 로그인 (보안 규칙에서 교사 uid 인증)
      await signInWithEmailAndPassword(auth, TEACHER_EMAIL, passcode.trim())
      sessionStorage.setItem(TEACHER_UNLOCK_KEY, '1')
      setPasscode('')
      setMode('teacher')
    } catch (e) {
      // Firebase 로그인 실패해도 (계정 미생성 등) 기본 동작은 유지
      // 단, 콘솔에 경고 출력
      console.warn('[Auth] 교사 Firebase 로그인 실패 (보안 규칙 적용 안 됨):', e.message)
      sessionStorage.setItem(TEACHER_UNLOCK_KEY, '1')
      setPasscode('')
      setMode('teacher')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!className.trim()) {
      setError('학급명을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const initialConfig = setupNow
        ? config
        : { ...getDefaultConfig(), classSize: 24 }
      const roomCode = await createRoom(className.trim(), initialConfig)
      alert(
        `방이 만들어졌습니다.\n\n반 코드: ${roomCode}\n\n학생들에게 이 코드를 알려주세요.`,
      )
      navigate('/teacher')
    } catch (e) {
      setError('방 생성 실패: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleEnterExistingRoom = async (code) => {
    setBusy(true)
    setError('')
    try {
      await enterTeacherRoom(code)
      navigate('/teacher')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleForgetRoom = (code) => {
    if (!confirm(`${code} 방을 목록에서 숨길까요? (서버 데이터는 유지)`)) return
    forgetTeacherRoom(code)
  }

  // 교사 — 반 코드 직접 입력해서 입장 (다른 기기에서 만든 방도 가능)
  const [enterCodeInput, setEnterCodeInput] = useState('')
  const handleEnterByCode = async () => {
    const c = enterCodeInput.trim().toUpperCase()
    if (!c) {
      setError('반 코드를 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await enterTeacherRoom(c)
      setEnterCodeInput('')
      navigate('/teacher')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // [Antigravity] 접속 실패 카운트 (이름 불일치 안내용)
  const [failCount, setFailCount] = useState(0)

  const handleJoinRoom = async () => {
    const c = code.trim().toUpperCase()
    const nNum = parseInt(number, 10)
    const name = nickname.trim()
    if (!c || isNaN(nNum) || nNum <= 0 || !name) {
      setError('반 코드 / 번호(1~40) / 이름을 모두 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      // 학생 익명 Firebase 로그인 (보안 규칙에서 auth.uid로 본인 데이터 보호)
      if (!auth.currentUser) {
        await signInAnonymously(auth)
      }
      const { isNew } = await joinRoom(c, { number: nNum, nickname: name })

      // [Antigravity] 처음 접속할 때 이름 기억하라고 경고
      if (isNew) {
        alert('✨ 처음 입장하셨습니다!\n\n다시 접속할 때 지금 입력하신 [이름]과 [번호]가 똑같이 필요합니다. 절대 잊지 마세요!')
      }

      navigate('/phase1')
    } catch (e) {
      if (e.message === 'NAME_MISMATCH') {
        const nextFail = failCount + 1
        setFailCount(nextFail)
        if (nextFail >= 2) {
          setError('🚨 이름이 기억나지 않는다면 선생님께 여쭤보세요!')
        } else {
          setError('해당 번호에 이미 등록된 이름과 다릅니다. 다시 확인해 주세요.')
        }
      } else {
        setError('입장 실패: ' + e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  // 교사 — 설정 ‘지금’이면 넓은 폼, 아니면 좁은 폼
  const teacherWide = mode === 'teacher' && setupNow

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div
        className={`bg-white p-8 rounded-3xl shadow-xl w-full ${
          teacherWide ? 'max-w-3xl' : 'max-w-md'
        }`}
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-700">민국이의 꿈</h1>
          <p className="text-sm text-gray-500 mt-1">
            우리의 턴(Turn)이 왔다 — 작은 대한민국 시뮬레이션
          </p>
        </div>

        {!mode && (
          <div className="space-y-3">
            <button
              onClick={onClickTeacher}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition shadow"
            >
              🔒 선생님 — 방 만들기 / 입장
            </button>
            <button
              onClick={() => setMode('student')}
              className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition shadow"
            >
              학생 — 방 입장
            </button>
            {/* 슈퍼 관리자 링크 숨김 (URL로 직접 접속만 가능) */}
            <div className="h-4" />
          </div>
        )}

        {mode === 'teacher_auth' && (
          <form onSubmit={handlePasscodeSubmit} className="space-y-3">
            <div className="text-center">
              <div className="text-3xl mb-2">🔒</div>
              <p className="text-sm font-semibold text-indigo-800">
                선생님 모드 진입 — 암호를 입력해 주세요
              </p>
              <p className="text-xs text-gray-500 mt-1">
                한 번 입력하면 이 브라우저 세션 동안 다시 묻지 않아요.
              </p>
            </div>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="암호"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-lg tracking-widest"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={!passcode.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700 transition"
            >
              확인
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(null)
                setError('')
                setPasscode('')
              }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              ← 뒤로
            </button>
          </form>
        )}

        {mode === 'teacher' && (
          <div className="space-y-4">
            {/* 이전에 만든 방 목록 */}
            {teacherRooms.length > 0 && (
              <section>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  이전에 만든 방 ({teacherRooms.length}개)
                </p>
                <ul className="space-y-2">
                  {teacherRooms.map((r) => (
                    <li
                      key={r.code}
                      className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl p-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleEnterExistingRoom(r.code)}
                        disabled={busy}
                        className="flex-1 text-left px-3 py-2 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                      >
                        <div className="font-bold text-indigo-800">
                          {r.className || '학급명 없음'}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {r.code}
                          {r.createdAt && (
                            <span className="ml-2 text-gray-400">
                              {new Date(r.createdAt).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleForgetRoom(r.code)}
                        className="text-xs text-gray-400 hover:text-red-600 px-2"
                        title="목록에서 숨기기"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 반 코드로 직접 입장 (다른 기기에서 만든 방 포함) */}
            <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-emerald-800">
                🔑 반 코드로 입장
              </p>
              <p className="text-[11px] text-gray-500">
                다른 기기(학교 PC·집 PC)에서 만든 방에 들어갈 때 사용하세요.
                코드만 알면 교사로 다시 입장할 수 있어요.
              </p>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={enterCodeInput}
                  onChange={(e) => setEnterCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleEnterByCode()
                    }
                  }}
                  placeholder="예: AB3C5K"
                  maxLength={6}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-center text-lg tracking-widest font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleEnterByCode}
                  disabled={busy || enterCodeInput.length !== 6}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50 hover:bg-emerald-700"
                >
                  입장
                </button>
              </div>
            </section>

            {/* 새 방 만들기 토글 */}
            {!showCreate ? (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-400 text-indigo-700 font-bold hover:bg-indigo-50 transition"
              >
                + 새 방 만들기
              </button>
            ) : (
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-semibold text-indigo-800">새 방 만들기</p>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-700">학급명</span>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="예: 6학년 9반"
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                {/* 설정 시점 */}
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-sm font-semibold text-indigo-800 mb-2">
                    시민단체·배정 방식 설정
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSetupNow(false)}
                      className={`py-2 rounded-lg text-sm font-semibold transition ${
                        !setupNow
                          ? 'bg-white border-2 border-indigo-500 text-indigo-700'
                          : 'bg-white/60 text-gray-500 hover:bg-white'
                      }`}
                    >
                      나중에 (기본값)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetupNow(true)}
                      className={`py-2 rounded-lg text-sm font-semibold transition ${
                        setupNow
                          ? 'bg-white border-2 border-indigo-500 text-indigo-700'
                          : 'bg-white/60 text-gray-500 hover:bg-white'
                      }`}
                    >
                      지금 정하기
                    </button>
                  </div>
                  {!setupNow && (
                    <p className="text-xs text-gray-500 mt-2">
                      기본 6대 시민단체 + 자유 합류 + 학급 인원 24명 + 모둠당 4명으로 시작합니다.
                      방을 만든 뒤 교사실에서 언제든 바꿀 수 있어요.
                    </p>
                  )}
                </div>

                {/* 인라인 편집기 */}
                {setupNow && (
                  <div className="border rounded-xl p-3 max-h-[55vh] overflow-y-auto">
                    <ClassroomConfigEditor value={config} onChange={setConfig} />
                  </div>
                )}

                <button
                  onClick={handleCreateRoom}
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700 transition"
                >
                  {busy ? '생성 중...' : '방 만들기'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false)
                    setSetupNow(false)
                  }}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  취소
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={() => {
                setMode(null)
                setError('')
                setSetupNow(false)
                setShowCreate(false)
              }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              ← 뒤로
            </button>
          </div>
        )}

        {mode === 'student' && (
          <div className="space-y-3">
            {/* 이전 입장 방 빠른 재입장 */}
            {studentRooms.length > 0 && (
              <section>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  이전 입장 방 ({studentRooms.length}개)
                </p>
                <ul className="space-y-2">
                  {studentRooms.map((r) => (
                    <li
                      key={r.code}
                      className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCode(r.code)
                          setNumber(String(r.number))
                          setNickname(r.nickname)
                        }}
                        className="flex-1 text-left px-3 py-2 rounded-lg hover:bg-emerald-100"
                      >
                        <div className="font-bold text-emerald-800">
                          {r.className || r.code}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {r.code} · {r.number}번 {r.nickname}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`${r.code} 방을 목록에서 숨길까요?`)) return
                          forgetStudentRoom(r.code)
                        }}
                        className="text-xs text-gray-400 hover:text-red-600 px-2"
                        title="숨기기"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <hr className="my-3" />
                <p className="text-xs text-gray-500 mb-2">또는 새로 입력하기</p>
              </section>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-gray-700">반 코드</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="예: AB3C5K"
                maxLength={6}
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center text-lg tracking-widest font-mono"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">번호</span>
                <input
                  type="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="15"
                  min={1}
                  max={40}
                  className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">이름</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="홍길동"
                  className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleJoinRoom}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50 hover:bg-emerald-600 transition"
            >
              {busy ? '입장 중...' : '입장하기'}
            </button>
            <button
              onClick={() => {
                setMode(null)
                setError('')
              }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              ← 뒤로
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default EntryPage
