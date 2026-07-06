import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'

/**
 * 네번째 여정 교사 빠른제어 — 학생 작업 현황판
 * 1단계(timeline):  학생별 별점 평가 완료 여부
 * 2단계(canvanews): 학생별 캔바 URL 제출 여부
 * 3단계(reflect):   학생별 정리글 작성·승인 상태
 */
export default function Phase4QuickPanel() {
  const roomCode  = useGameStore((s) => s.roomCode)
  const students  = useGameStore((s) => s.students) || {}
  const wf        = useWorkflow()
  const stepId    = wf.currentStep?.id || 'timeline'

  const [studentsData, setStudentsData] = useState({})
  const [reflections,  setReflections]  = useState({})

  // students 노드 전체 구독 (journeyRatings + canvaCardNewsUrl)
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'students', (d) => setStudentsData(d || {}))
    return () => u?.()
  }, [roomCode])

  // reflections 구독
  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'reflections', (d) => setReflections(d || {}))
    return () => u?.()
  }, [roomCode])

  // 학생 목록: number 기준 정렬
  const studentList = useMemo(() =>
    Object.entries(students)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => (a.number || 0) - (b.number || 0)),
    [students]
  )

  // 학생별 정리글 상태 맵
  const reflMap = useMemo(() => {
    const m = {}
    for (const r of Object.values(reflections)) {
      if (r?.authorStudentId) m[r.authorStudentId] = r.status || 'writing'
    }
    return m
  }, [reflections])

  const total = studentList.length
  if (total === 0) return null

  // ── 단계별 요약 계산 ───────────────────────────────
  const summary1 = useMemo(() => {
    let done = 0
    for (const s of studentList) {
      const jr = studentsData[s.id]?.journeyRatings
      if (jr && Object.keys(jr).length > 0) done++
    }
    return { done, total }
  }, [studentList, studentsData])

  const summary2 = useMemo(() => {
    let done = 0
    for (const s of studentList) {
      if (studentsData[s.id]?.canvaCardNewsUrl) done++
    }
    return { done, total }
  }, [studentList, studentsData])

  const summary3 = useMemo(() => {
    let writing = 0, pending = 0, approved = 0, rejected = 0
    for (const s of studentList) {
      const st = reflMap[s.id]
      if (!st)               writing++
      else if (st === 'pending')  pending++
      else if (st === 'approved') approved++
      else if (st === 'rejected') rejected++
      else                   writing++
    }
    return { writing, pending, approved, rejected }
  }, [studentList, reflMap])

  // ── 렌더 헬퍼 ──────────────────────────────────────
  const renderGrid = (cells) => (
    <div className="flex flex-wrap gap-1 mt-2">
      {cells}
    </div>
  )

  const Chip = ({ label, color }) => (
    <span className={`inline-flex items-center justify-center text-[11px] font-bold rounded-lg px-2 py-0.5 ${color}`}>
      {label}
    </span>
  )

  // ── 1단계: 별점 현황판 ─────────────────────────────
  const renderTimeline = () => {
    const done  = summary1.done
    const left  = total - done
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-pink-700">⭐ 별점 평가</span>
          <span className="text-gray-500">{done}/{total}명 완료</span>
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-pink-400 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          {left > 0 && <span className="text-xs text-amber-600 font-semibold">미완료 {left}명</span>}
        </div>
        {renderGrid(studentList.map((s) => {
          const jr    = studentsData[s.id]?.journeyRatings
          const count = jr ? Object.keys(jr).length : 0
          const isDone = count > 0
          return (
            <div key={s.id}
              title={`${s.number}번 ${s.nickname || ''} — 별점 ${count}개`}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border
                ${isDone ? 'bg-pink-100 border-pink-300 text-pink-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              {s.number}
            </div>
          )
        }))}
        <div className="flex gap-3 text-[11px] text-gray-500 mt-1">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-100 border border-pink-300 inline-block" /> 완료</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200 inline-block" /> 미완료</span>
        </div>
      </div>
    )
  }

  // ── 2단계: 캔바 URL 제출 현황판 ────────────────────
  const renderCanvanews = () => {
    const done = summary2.done
    const left = total - done
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-violet-700">🎨 캔바 URL 제출</span>
          <span className="text-gray-500">{done}/{total}명 제출</span>
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-violet-400 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          {left > 0 && <span className="text-xs text-amber-600 font-semibold">미제출 {left}명</span>}
        </div>
        {renderGrid(studentList.map((s) => {
          const url   = studentsData[s.id]?.canvaCardNewsUrl
          const isDone = !!url
          return (
            <div key={s.id}
              title={isDone ? `${s.number}번 ${s.nickname || ''} — 제출 완료` : `${s.number}번 ${s.nickname || ''} — 미제출`}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border
                ${isDone ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              {isDone ? '✓' : s.number}
            </div>
          )
        }))}
        <div className="flex gap-3 text-[11px] text-gray-500 mt-1">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-violet-100 border border-violet-300 inline-block" /> 제출 완료</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200 inline-block" /> 미제출</span>
        </div>
        {/* 제출한 학생 URL 목록 */}
        {done > 0 && (
          <details className="mt-1">
            <summary className="text-xs text-violet-600 cursor-pointer hover:underline">제출 URL 목록 보기 ({done}개)</summary>
            <div className="mt-1 space-y-1 max-h-40 overflow-y-auto pr-1">
              {studentList.filter((s) => studentsData[s.id]?.canvaCardNewsUrl).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-600 w-6 shrink-0">{s.number}번</span>
                  <a href={studentsData[s.id].canvaCardNewsUrl} target="_blank" rel="noreferrer"
                    className="text-violet-600 hover:underline truncate">
                    {studentsData[s.id].canvaCardNewsUrl}
                  </a>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    )
  }

  // ── 3단계: 정리글 현황판 ────────────────────────────
  const STATUS_COLOR = {
    writing:  'bg-gray-50 border-gray-200 text-gray-400',
    pending:  'bg-yellow-100 border-yellow-300 text-yellow-700',
    approved: 'bg-emerald-100 border-emerald-300 text-emerald-700',
    rejected: 'bg-red-100 border-red-300 text-red-600',
  }
  const STATUS_ICON = { writing: '–', pending: '⏳', approved: '✓', rejected: '✗' }

  const renderReflect = () => {
    const { writing, pending, approved, rejected } = summary3
    return (
      <div className="space-y-3">
        {/* 요약 칩 */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="font-bold text-sm text-teal-700">📝 정리글 현황</span>
          <Chip label={`미작성 ${writing}`}  color="bg-gray-100 text-gray-500" />
          <Chip label={`검토대기 ${pending}`} color="bg-yellow-100 text-yellow-700" />
          <Chip label={`승인 ${approved}`}    color="bg-emerald-100 text-emerald-700" />
          <Chip label={`반려 ${rejected}`}    color="bg-red-100 text-red-600" />
        </div>
        {/* 진행 바 (승인 기준) */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden flex">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${total ? (approved / total) * 100 : 0}%` }} />
            <div className="h-full bg-yellow-300 transition-all" style={{ width: `${total ? (pending / total) * 100 : 0}%` }} />
            <div className="h-full bg-red-300 transition-all" style={{ width: `${total ? (rejected / total) * 100 : 0}%` }} />
          </div>
          <span className="text-xs text-gray-500">{approved}/{total}명 승인</span>
        </div>
        {/* 학생 격자 */}
        {renderGrid(studentList.map((s) => {
          const st  = reflMap[s.id] || 'writing'
          const col = STATUS_COLOR[st] || STATUS_COLOR.writing
          const ico = STATUS_ICON[st] || '–'
          return (
            <div key={s.id}
              title={`${s.number}번 ${s.nickname || ''} — ${st}`}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${col}`}>
              {st === 'writing' ? s.number : ico}
            </div>
          )
        }))}
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mt-1">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200 inline-block" /> 미작성</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" /> 검토대기</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> 승인</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> 반려</span>
        </div>
      </div>
    )
  }

  // 4단계 이후는 현황판 불필요
  if (!['timeline', 'canvanews', 'reflect'].includes(stepId)) return null

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-1">
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">학생 작업 현황</p>
      {stepId === 'timeline'  && renderTimeline()}
      {stepId === 'canvanews' && renderCanvanews()}
      {stepId === 'reflect'   && renderReflect()}
    </div>
  )
}
