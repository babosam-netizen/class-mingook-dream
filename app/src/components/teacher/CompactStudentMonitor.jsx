import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import StudentActivityMonitor from './StudentActivityMonitor'

const EMPTY_STUDENTS = {}

/**
 * 교사 대시보드 우측 사이드바 — 학생 접속 모니터(컴팩트).
 *
 * - 기본: 접속 카운트 + 학생 한 줄 리스트 (점 + 번호 + 이름 + ✓ 차시 끝)
 * - 인원수 따라 세로로 늘어남 (sticky)
 * - 클릭 → 풀 StudentActivityMonitor 모달로 자세히 보기
 */
function CompactStudentMonitor() {
  const students = useGameStore((s) => s.students) ?? EMPTY_STUDENTS
  const currentPhase = useGameStore((s) => s.currentPhase)
  const [open, setOpen] = useState(false)

  // lastSeen 기반 effective online (StudentActivityMonitor 와 동일 로직)
  const [, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(i)
  }, [])

  const rows = useMemo(() => {
    return Object.entries(students)
      .map(([sid, s]) => ({
        sid,
        number: s?.number || 0,
        nickname: s?.nickname || '',
        isOnline: !!s?.isOnline || (!!s?.lastSeen && (Date.now() - Number(s.lastSeen) < 45000)),
        isTabActive: s?.isTabActive !== false,
        sessionFinishedAtPhase: s?.sessionFinishedAtPhase || null,
      }))
      .sort((a, b) => (a.number || 0) - (b.number || 0))
  }, [students])

  const onlineCount = rows.filter((r) => r.isOnline).length
  const finishedCount = rows.filter((r) => r.sessionFinishedAtPhase === currentPhase && r.isOnline).length

  return (
    <>
      <section className="bg-white rounded-2xl shadow border p-3 space-y-2 sticky top-2">
        <header className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-indigo-700">📊 학생 모니터</h3>
          <button
            onClick={() => setOpen(true)}
            className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold"
            title="전체 활동 자세히 보기"
          >
            자세히 ▢
          </button>
        </header>

        {/* 카운트 요약 */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
          <p className="text-[10px] text-emerald-600 font-semibold">접속</p>
          <p className="text-2xl font-black text-emerald-700 tabular-nums">
            {onlineCount}
            <span className="text-base text-emerald-500 font-normal"> / {rows.length}</span>
          </p>
          {finishedCount > 0 && (
            <p className="text-[10px] text-emerald-600 mt-0.5">
              차시 끝 {finishedCount}명
            </p>
          )}
        </div>

        {/* 학생 리스트 — 인원수 따라 늘어남 */}
        <ul className="space-y-0.5 max-h-[60vh] overflow-y-auto">
          {rows.length === 0 ? (
            <li className="text-[11px] text-gray-400 text-center py-2">
              아직 입장한 학생 없음
            </li>
          ) : (
            rows.map((r) => (
              <li
                key={r.sid}
                className={`flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] rounded ${
                  r.isOnline ? '' : 'opacity-50'
                }`}
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                    r.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <span className="font-mono text-gray-500 w-5 text-right">{r.number}</span>
                <span className="truncate flex-1">{r.nickname}</span>
                {r.isOnline && !r.isTabActive && (
                  <span className="text-[10px] grayscale" title="다른 탭을 보고 있음">💤</span>
                )}
                {r.sessionFinishedAtPhase === currentPhase && (
                  <span className="text-[9px] text-emerald-600">✓</span>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      {/* 풀 모니터 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-2xl text-gray-400 hover:text-gray-700 leading-none"
              title="닫기"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold text-indigo-700 mb-3">📊 학생 활동 자세히 보기</h2>
            <StudentActivityMonitor />
          </div>
        </div>
      )}
    </>
  )
}

export default CompactStudentMonitor
