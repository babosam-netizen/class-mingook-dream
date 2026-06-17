import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { onValue, ref } from 'firebase/database'
import { database } from '../lib/firebase'
import { subscribe } from '../lib/rtdb-helpers'

const DISPLAY_SLOT_COUNT = 30
const STATUS_STYLE = {
  pending: {
    label: '투표전',
    nameText: 'text-slate-100',
    badge: 'bg-slate-700/60 text-slate-100 border-slate-400/60',
  },
  pro: {
    label: '찬성',
    nameText: 'text-lime-300',
    badge: 'bg-lime-700/40 text-lime-200 border-lime-400/70',
  },
  con: {
    label: '반대',
    nameText: 'text-rose-300',
    badge: 'bg-rose-700/40 text-rose-200 border-rose-400/70',
  },
  abstain: {
    label: '기권',
    nameText: 'text-amber-300',
    badge: 'bg-amber-700/40 text-amber-200 border-amber-400/70',
  },
  empty: {
    label: '미배정',
    nameText: 'text-slate-500',
    badge: 'bg-slate-900/70 text-slate-400 border-slate-600/70',
  },
}

/**
 * TV 송출용 전광판 페이지 — 새 창(window.open)으로 열어 TV·프로젝터에 띄움.
 *
 * - URL 쿼리 ?room=ROOMCODE 로 방 식별
 * - billBoard.active === true 면 풀스크린 전광판 표시
 * - billBoard.active === false 가 되면 자동으로 window.close()
 * - 인증 불필요 (방 코드만으로 읽기 가능)
 */
function TVBoardPage() {
  const [search] = useSearchParams()
  const roomCode = search.get('room')

  const [billBoard, setBillBoard] = useState(null)
  const [bill, setBill] = useState(null)
  const [students, setStudents] = useState({})
  const [groups, setGroups] = useState({})
  const [finalVotes, setFinalVotes] = useState({})
  // billBoard 구독
  useEffect(() => {
    if (!roomCode) return
    const u = onValue(ref(database, `rooms/${roomCode}/billBoard`), (snap) => {
      const v = snap.val()
      setBillBoard(v)
      // billBoard 가 비활성화되면 창 자동 닫기
      if (v && v.active === false) {
        setTimeout(() => window.close(), 800)
      }
      if (!v) {
        setTimeout(() => window.close(), 800)
      }
    })
    return () => u?.()
  }, [roomCode])

  // students / groups 구독 (표시용)
  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'students', (d) => setStudents(d || {}))
    const u2 = subscribe(roomCode, 'groups', (d) => setGroups(d || {}))
    return () => { u1?.(); u2?.() }
  }, [roomCode])

  // 활성 bill 구독
  const billId = billBoard?.billId
  useEffect(() => {
    if (!roomCode || !billId) {
      setBill(null)
      setFinalVotes({})
      return
    }
    const u1 = subscribe(roomCode, `bills/${billId}`, (d) => setBill(d ? { id: billId, ...d } : null))
    const u2 = subscribe(roomCode, `bills/${billId}/finalVotes`, (d) => setFinalVotes(d || {}))
    return () => { u1?.(); u2?.() }
  }, [roomCode, billId])

  if (!roomCode) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-2xl">
        ⚠ room 파라미터가 없습니다.
      </div>
    )
  }
  if (!billBoard?.active || !bill) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="text-center space-y-2">
          <p className="text-3xl font-bold">전광판 대기 중</p>
          <p className="text-base text-white/70">선생님이 표결을 시작하면 화면이 켜집니다.</p>
          <p className="text-xs text-white/40 mt-4">표결이 끝나면 이 창은 자동으로 닫힙니다.</p>
        </div>
      </div>
    )
  }

  const proposer = bill.proposerGroupId ? groups[bill.proposerGroupId] : null
  const studentsCount = Object.keys(students).length
  const tally = { pro: 0, con: 0, abstain: 0 }
  for (const v of Object.values(finalVotes)) {
    if (v?.choice && tally[v.choice] !== undefined) tally[v.choice] += 1
  }
  const total = tally.pro + tally.con + tally.abstain
  const remaining = Math.max(0, studentsCount - total)
  const voteRows = Object.entries(students || {})
    .map(([sid, stu]) => ({
      sid,
      number: Number(stu?.number) || 0,
      name: stu?.nickname || sid,
      choice: finalVotes?.[sid]?.choice || null,
    }))
    .sort((a, b) => a.number - b.number)
  const fixedSeats = DISPLAY_SLOT_COUNT
  const presentSeats = studentsCount
  const rowByNumber = new Map(voteRows.map((row) => [row.number, row]))
  const boardSlots = Array.from({ length: DISPLAY_SLOT_COUNT }, (_, idx) => {
    const number = idx + 1
    const row = rowByNumber.get(number)
    if (!row) {
      return {
        sid: `slot-${number}`,
        number,
        name: '—',
        statusKey: 'empty',
      }
    }
    return {
      sid: row.sid,
      number,
      name: row.name,
      statusKey: row.choice || 'pending',
    }
  })
  const boardTitle = makeBoardTitle(bill.title, proposer?.name)
  const counterItems = [
    { key: 'fixed', label: '재적', count: fixedSeats, tone: 'text-white' },
    { key: 'present', label: '재석', count: presentSeats, tone: 'text-white' },
    { key: 'pro', label: '찬성', count: tally.pro, tone: 'text-lime-400' },
    { key: 'con', label: '반대', count: tally.con, tone: 'text-rose-400' },
    { key: 'abstain', label: '기권', count: tally.abstain, tone: 'text-amber-300' },
  ]

  // 결과 발표 모드 — billBoard.resultShown && bill.voteResult 가 있으면 결과 화면으로 전환
  const announced = !!billBoard?.resultShown && !!bill.voteResult
  if (announced) {
    const vr = bill.voteResult
    const passed = !!vr.passed
    return (
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_#9aa5b3_0%,_#6f7886_42%,_#4e5460_100%)] p-4 md:p-8">
        <div className="w-full h-full max-w-[1920px] max-h-[1080px] mx-auto flex flex-col">
          <h1 className="text-white text-4xl md:text-5xl font-black tracking-tight mb-3 md:mb-4 drop-shadow-lg">
            대한민국 국회 · 표결 결과
          </h1>
          <section className="flex-1 min-h-0 border-4 border-amber-600 bg-[#101318] shadow-2xl flex flex-col overflow-hidden">
            {/* 안건 제목 */}
            <div className="border-b-4 border-amber-600 px-6 md:px-10 py-4 md:py-6 text-white text-2xl md:text-4xl font-black text-center">
              📜 {boardTitle}
            </div>
            {/* 표결 수치 — 3열 큼지막 */}
            <div className="flex-1 grid grid-cols-3 border-b-4 border-amber-600">
              <div className="flex flex-col items-center justify-center border-r-4 border-amber-600 p-4">
                <span className="text-xl md:text-3xl font-bold text-lime-300">찬성</span>
                <span className="text-7xl md:text-9xl font-black text-lime-300 tabular-nums mt-2">{vr.pro || 0}</span>
                <span className="text-base md:text-2xl text-lime-200/80 mt-1">명</span>
              </div>
              <div className="flex flex-col items-center justify-center border-r-4 border-amber-600 p-4">
                <span className="text-xl md:text-3xl font-bold text-rose-300">반대</span>
                <span className="text-7xl md:text-9xl font-black text-rose-300 tabular-nums mt-2">{vr.con || 0}</span>
                <span className="text-base md:text-2xl text-rose-200/80 mt-1">명</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4">
                <span className="text-xl md:text-3xl font-bold text-amber-300">기권</span>
                <span className="text-7xl md:text-9xl font-black text-amber-300 tabular-nums mt-2">{vr.abstain || 0}</span>
                <span className="text-base md:text-2xl text-amber-200/80 mt-1">명</span>
              </div>
            </div>
            {/* 최종 의결 — 가결/부결 큰 메시지 */}
            <div className={`px-6 md:px-10 py-6 md:py-10 text-center ${
              passed ? 'bg-gradient-to-r from-emerald-900 via-emerald-700 to-emerald-900' : 'bg-gradient-to-r from-rose-900 via-rose-700 to-rose-900'
            }`}>
              <p className="text-white/90 text-xl md:text-3xl font-bold mb-2">
                재석 {(vr.pro || 0) + (vr.con || 0) + (vr.abstain || 0)}명 중 찬성 {vr.pro || 0}명
              </p>
              <p className="text-4xl md:text-7xl font-black text-white tracking-tight drop-shadow-lg">
                {passed ? '✅ 이 법안은 가결되었습니다' : '❌ 이 법안은 부결되었습니다'}
              </p>
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_#9aa5b3_0%,_#6f7886_42%,_#4e5460_100%)] p-2 md:p-4">
      <div className="w-full h-full max-w-[1920px] max-h-[1080px] mx-auto flex flex-col">
        <h1 className="text-white text-4xl md:text-5xl font-black tracking-tight mb-2 md:mb-3 drop-shadow-lg">
          대한민국 국회
        </h1>

        <section className="flex-1 min-h-0 border-2 border-amber-600 bg-[#101318] shadow-2xl flex flex-col overflow-hidden">
          <div className="border-b-2 border-amber-600 px-4 md:px-5 py-3 text-white text-xl md:text-3xl font-bold">
            {boardTitle}
          </div>

          <div className="grid grid-cols-5 border-b-2 border-amber-600">
            {counterItems.map((item, idx) => (
              <div
                key={item.key}
                className={`px-3 md:px-4 py-2 md:py-2.5 text-xl md:text-3xl font-bold bg-[#171b22] ${idx < counterItems.length - 1 ? 'border-r-2 border-amber-600' : ''}`}
              >
                <span className="text-white">{item.label}: </span>
                <span className={item.tone}>{item.count} 인</span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 bg-amber-600 p-px">
            <div className="h-full grid grid-cols-5 grid-rows-6 gap-px bg-amber-600">
              {boardSlots.map((row) => {
                const style = STATUS_STYLE[row.statusKey] || STATUS_STYLE.pending
                return (
                  <div key={row.sid} className="bg-[#11161c] px-3 md:px-4 py-2 md:py-2.5 flex items-center justify-between gap-2 overflow-hidden">
                    <p className={`text-xl md:text-3xl font-black leading-none truncate ${style.nameText}`}>
                      {row.number}번 {row.name}
                    </p>
                    <span className={`shrink-0 text-sm md:text-base font-bold px-2.5 md:px-3 py-0.5 rounded border ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <div className="mt-2 text-right text-white/80 text-xs md:text-sm font-medium">
          표결 진행 {total}/{studentsCount}명 · 미투표 {remaining}명
        </div>
      </div>
    </div>
  )
}

function makeBoardTitle(title, proposerName) {
  const cleanTitle = String(title || '').trim() || '상정 안건'
  if (!proposerName) return `안건. ${cleanTitle}`
  return `안건. ${cleanTitle} (${proposerName} 발의)`
}

export default TVBoardPage
