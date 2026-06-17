import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import { ref, get as firebaseGet, update } from 'firebase/database'
import { database } from '../lib/firebase'

/**
 * 슈퍼 관리자 페이지 (/super-admin)
 *
 * 보안 규칙이 root 전체 read를 막고 있으므로 ‘코드별 조회’ 방식.
 * - 이 기기의 teacherRooms 자동 표시
 * - 다른 기기에서 만든 방은 반 코드 입력으로 추가 → localStorage에 누적
 * - 각 방: 학급명·생성일·학생/모둠/포스터/기사 수 + 입장/삭제 가능
 *
 * 인증: 별도 슈퍼 관리자 암호 (sessionStorage 1회).
 */

const SUPER_PASSCODE =
  import.meta.env.VITE_SUPER_ADMIN_PASSCODE || ''
const UNLOCK_KEY = 'class-democra-super-unlocked'
const LIST_KEY = 'class-democra-super-rooms'
const EMPTY_ROOMS = []

function SuperAdminPage() {
  const navigate = useNavigate()
  const teacherRooms = useGameStore((s) => s.teacherRooms) || EMPTY_ROOMS
  const enterTeacherRoom = useGameStore((s) => s.enterTeacherRoom)

  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(UNLOCK_KEY) === '1',
  )
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')

  // 슈퍼 관리자가 추가한 추가 코드 목록 (다른 기기 방 등) — localStorage 누적
  const [extraCodes, setExtraCodes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LIST_KEY) || '[]')
    } catch {
      return []
    }
  })
  const persistExtra = (next) => {
    setExtraCodes(next)
    localStorage.setItem(LIST_KEY, JSON.stringify(next))
  }

  // 모든 방의 스냅샷 (코드 → data) + 인덱스 메타
  const [snapshots, setSnapshots] = useState({})
  const [indexMeta, setIndexMeta] = useState({})
  const [loading, setLoading] = useState(false)
  const [addInput, setAddInput] = useState('')

  // 표시할 코드 = roomsIndex + teacherRooms + extraCodes (중복 제거)
  const allCodes = (() => {
    const set = new Set()
    for (const code of Object.keys(indexMeta)) set.add(code)
    for (const r of teacherRooms) set.add(r.code)
    for (const c of extraCodes) set.add(c)
    return Array.from(set)
  })()

  const fetchAll = async () => {
    setLoading(true)
    // 1. roomsIndex GET (모든 기기에서 만든 방의 메타)
    let idx = {}
    try {
      const snap = await firebaseGet(ref(database, 'roomsIndex'))
      idx = snap.val() || {}
      setIndexMeta(idx)
    } catch (e) {
      console.warn('roomsIndex 조회 실패:', e)
    }

    // 2. 모든 코드에 대해 rooms/{code} 상세 GET (학생/모둠/포스터/기사 카운트용)
    const codesToFetch = new Set([
      ...Object.keys(idx),
      ...teacherRooms.map((r) => r.code),
      ...extraCodes,
    ])
    if (codesToFetch.size === 0) {
      setSnapshots({})
      setLoading(false)
      return
    }
    const next = {}
    await Promise.all(
      Array.from(codesToFetch).map(async (code) => {
        try {
          const snap = await firebaseGet(ref(database, `rooms/${code}`))
          next[code] = snap.exists() ? snap.val() : null
        } catch {
          next[code] = null
        }
      }),
    )
    setSnapshots(next)
    setLoading(false)
  }

  useEffect(() => {
    if (unlocked) fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, teacherRooms.length, extraCodes.length])

  const onUnlock = (e) => {
    e.preventDefault()
    if (pwd.trim() === SUPER_PASSCODE) {
      sessionStorage.setItem(UNLOCK_KEY, '1')
      setUnlocked(true)
      setPwd('')
      setError('')
    } else {
      setError('암호가 일치하지 않습니다.')
    }
  }

  const onAddCode = async (e) => {
    e.preventDefault()
    const c = addInput.trim().toUpperCase()
    setError('')
    if (!/^[A-Z2-9]{6}$/.test(c)) {
      setError('반 코드는 6자리 영숫자(O/0/1/I 제외)여야 합니다.')
      return
    }
    if (extraCodes.includes(c) || teacherRooms.some((r) => r.code === c)) {
      setError('이미 목록에 있는 코드입니다.')
      return
    }
    persistExtra([c, ...extraCodes].slice(0, 50))
    setAddInput('')
  }

  const onForgetExtra = (code) => {
    persistExtra(extraCodes.filter((c) => c !== code))
  }

  const onEnter = async (code) => {
    try {
      await enterTeacherRoom(code)
      navigate('/teacher')
    } catch (e) {
      alert(e.message)
    }
  }

  const onDestroy = async (code) => {
    if (
      !confirm(
        `정말 ${code} 방을 영구 삭제할까요?\n학생 전원의 모든 활동(포스터·댓글·기사·정리글 등)이 사라지며 복구할 수 없습니다.`,
      )
    )
      return
    try {
      await update(ref(database), {
        [`rooms/${code}`]: null,
        [`roomsIndex/${code}`]: null,
      })
      // 새로고침
      const next = { ...snapshots }
      delete next[code]
      setSnapshots(next)
      const nextIdx = { ...indexMeta }
      delete nextIdx[code]
      setIndexMeta(nextIdx)
      persistExtra(extraCodes.filter((c) => c !== code))
    } catch (e) {
      alert('삭제 실패: ' + e.message)
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-6">
        <form
          onSubmit={onUnlock}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-3"
        >
          <div className="text-center mb-2">
            <div className="text-4xl mb-2">🔐</div>
            <h1 className="text-xl font-bold text-slate-800">슈퍼 관리자</h1>
            <p className="text-xs text-gray-500 mt-1">
              모든 학급 방을 관리하는 화면입니다
            </p>
          </div>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="슈퍼 관리자 암호"
            autoFocus
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-500 text-center"
          />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button
            type="submit"
            disabled={!pwd.trim()}
            className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold disabled:opacity-50 hover:bg-slate-900"
          >
            확인
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 홈으로
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-bold">🔐 슈퍼 관리자</span>
          <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full">
            {allCodes.length}개 방 관리 중
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
            >
              {loading ? '⏳ 새로고침...' : '🔄 새로고침'}
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem(UNLOCK_KEY)
                setUnlocked(false)
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20"
            >
              🔒 잠그기
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20"
            >
              ← 홈
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
        {/* 코드 추가 */}
        <section className="bg-white rounded-2xl shadow-sm border p-4">
          <h2 className="font-bold text-slate-800 mb-2">+ 옛 방 코드로 추가</h2>
          <p className="text-xs text-gray-500 mb-2">
            보안 규칙 게시 후 만들어진 방은 <strong>모든 기기에서 자동 표시</strong>됩니다.
            <br />
            규칙 게시 전에 만들어진 옛 방만 코드를 직접 입력해 주세요.
          </p>
          <form onSubmit={onAddCode} className="flex gap-1">
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value.toUpperCase())}
              placeholder="예: AB3C5K"
              maxLength={6}
              className="flex-1 max-w-xs px-3 py-2 rounded-lg border border-gray-300 text-center font-mono tracking-widest uppercase"
            />
            <button
              type="submit"
              disabled={addInput.length !== 6}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white font-semibold disabled:opacity-50"
            >
              추가
            </button>
          </form>
          {error && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
              {error}
            </p>
          )}
        </section>

        {/* 방 카드 그리드 */}
        {allCodes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-400">
            관리할 방이 없어요. 위에서 코드를 추가해 주세요.
          </div>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {allCodes.map((code) => {
              const data = snapshots[code]
              const isFromExtra = extraCodes.includes(code)
              const fromTeacher = teacherRooms.find((r) => r.code === code)
              if (data === undefined) {
                return (
                  <div
                    key={code}
                    className="bg-white rounded-2xl border p-4 text-sm text-gray-400 text-center"
                  >
                    {code} · 불러오는 중...
                  </div>
                )
              }
              if (data === null) {
                return (
                  <div
                    key={code}
                    className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-sm"
                  >
                    <p className="font-mono font-bold">{code}</p>
                    <p className="text-rose-700 mt-1">⚠️ 존재하지 않는 방</p>
                    <button
                      onClick={() => onForgetExtra(code)}
                      className="mt-2 text-xs text-gray-500 hover:text-red-600"
                    >
                      목록에서 제거
                    </button>
                  </div>
                )
              }

              const studentCount = Object.keys(data.students || {}).length
              const onlineCount = Object.values(data.students || {}).filter(
                (s) => s?.isOnline,
              ).length
              const groupCount = Object.keys(data.groups || {}).length
              const posterCount = Object.keys(data.posters || {}).length
              const articleCount = Object.values(data.articles || {}).filter(
                (a) => a?.status === 'approved',
              ).length
              const reflectionCount = Object.keys(data.reflections || {}).length
              const created = data.createdAt
                ? new Date(data.createdAt).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  })
                : '—'

              return (
                <article
                  key={code}
                  className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2"
                >
                  <header className="flex items-baseline justify-between flex-wrap gap-1">
                    <div>
                      <h3 className="font-bold">{data.className || '학급명 없음'}</h3>
                      <p className="text-xs text-gray-500 font-mono">
                        {code} · {created}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                      Phase {data.currentPhase || 1}
                    </span>
                  </header>

                  <div className="grid grid-cols-3 gap-1 text-center text-xs">
                    <div className="bg-emerald-50 rounded p-1.5">
                      <div className="font-bold text-emerald-700">
                        {onlineCount}/{studentCount}
                      </div>
                      <div className="text-gray-500">학생</div>
                    </div>
                    <div className="bg-amber-50 rounded p-1.5">
                      <div className="font-bold text-amber-700">{groupCount}</div>
                      <div className="text-gray-500">모둠</div>
                    </div>
                    <div className="bg-blue-50 rounded p-1.5">
                      <div className="font-bold text-blue-700">{posterCount}</div>
                      <div className="text-gray-500">포스터</div>
                    </div>
                    <div className="bg-rose-50 rounded p-1.5">
                      <div className="font-bold text-rose-700">{articleCount}</div>
                      <div className="text-gray-500">기사</div>
                    </div>
                    <div className="bg-pink-50 rounded p-1.5">
                      <div className="font-bold text-pink-700">{reflectionCount}</div>
                      <div className="text-gray-500">정리글</div>
                    </div>
                    <div className="bg-gray-50 rounded p-1.5">
                      <div className="font-bold text-gray-700 text-[10px]">
                        {fromTeacher
                          ? '내 기기'
                          : isFromExtra
                          ? '추가'
                          : indexMeta[code]
                          ? '🌐 DB'
                          : '—'}
                      </div>
                      <div className="text-gray-500">출처</div>
                    </div>
                  </div>

                  <div className="flex gap-1 pt-1 flex-wrap">
                    <button
                      onClick={() => onEnter(code)}
                      className="flex-1 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                    >
                      교사로 입장
                    </button>
                    {isFromExtra && (
                      <button
                        onClick={() => onForgetExtra(code)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        숨기기
                      </button>
                    )}
                    <button
                      onClick={() => onDestroy(code)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>
    </div>
  )
}

export default SuperAdminPage
