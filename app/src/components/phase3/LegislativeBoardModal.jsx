import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt } from '../../lib/rtdb-helpers'

/**
 * 본회의 전광판 — 정식 상정된 법안의 표결을 풀스크린으로 시각화.
 *
 * 동작:
 *  - rooms/{rc}/billBoard.active === true 일 때만 표시 (모든 학생·교사 동시 노출)
 *  - 학생: 집계 비노출 상태에서 본인 표결 버튼만 노출
 *  - 교사: 이 모달 미사용 (TV 전광판 창에서만 결과 송출)
 *
 * App.jsx 글로벌 마운트 → 어느 페이지든 활성화되면 모달 표시.
 */
function LegislativeBoardModal() {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const billBoard = useGameStore((s) => s.roomData?.billBoard)
  const coreIssue = useGameStore((s) => s.roomData?.coreIssue)
  const groups = useGameStore((s) => s.groups)

  const [bill, setBill] = useState(null)
  const [finalVotes, setFinalVotes] = useState({})

  const billId = billBoard?.billId
  const active = billBoard?.active && billId

  useEffect(() => {
    if (!active || !roomCode || !billId) return
    const u1 = subscribe(roomCode, `bills/${billId}`, (d) => setBill(d ? { id: billId, ...d } : null))
    const u2 = subscribe(roomCode, `bills/${billId}/finalVotes`, (d) => setFinalVotes(d || {}))
    return () => { u1?.(); u2?.() }
  }, [active, roomCode, billId])

  if (!active || !bill) return null
  // 교사는 풀스크린 전광판을 띄우지 않음 — 새 창(TVBoardPage) 으로만 송출.
  // 그래야 교사가 대시보드를 계속 조작할 수 있음.
  if (role === 'teacher') return null

  const proposer = bill.proposerGroupId ? groups[bill.proposerGroupId] : null
  const coreIssueGroup = coreIssue ? groups?.[coreIssue] : null
  const coreIssueLabel = coreIssueGroup?.name || (typeof coreIssue === 'string' ? coreIssue : null)
  const coreIssueSlogan = coreIssueGroup?.slogan
  const billBodyText = buildBillBodyText(bill)
  const myChoice = myStudentId ? finalVotes[myStudentId]?.choice : null

  const cast = async (choice) => {
    if (role !== 'student' || !myStudentId) return
    if (myChoice) {
      alert('이미 표결을 완료하셨습니다. 변경할 수 없습니다.')
      return
    }
    const choiceLabels = { pro: '찬성', con: '반대', abstain: '기권' }
    const confirmed = confirm(`정말로 ${choiceLabels[choice]}하시겠습니까?\n제출 후에는 변경할 수 없습니다.`)
    if (!confirmed) return

    await setAt(roomCode, `bills/${billId}/finalVotes/${myStudentId}`, {
      choice, ts: Date.now(),
    })
  }

  // 표결 발표 모드 — billBoard.resultShown && bill.voteResult 면 결과 화면으로 전환
  const announced = !!billBoard?.resultShown && !!bill.voteResult
  if (announced) {
    const vr = bill.voteResult
    const passed = !!vr.passed
    return (
      <div className="fixed inset-0 z-[80] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <p className="text-amber-300 text-sm sm:text-base font-bold tracking-widest mb-3">
          🏛️ 본회의 표결 결과
        </p>
        <h1 className="text-white text-2xl sm:text-5xl font-black leading-tight text-center mb-6 sm:mb-8 max-w-4xl">
          📜 {bill.title}
        </h1>

        {/* 3열 수치 카드 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-4xl mb-6 sm:mb-8">
          <div className="rounded-2xl border-2 border-lime-400/60 bg-lime-900/30 p-4 sm:p-6 text-center">
            <p className="text-lime-300 font-bold text-base sm:text-2xl">찬성</p>
            <p className="text-lime-300 text-5xl sm:text-8xl font-black tabular-nums mt-1">{vr.pro || 0}</p>
            <p className="text-lime-200/80 text-xs sm:text-base mt-1">명</p>
          </div>
          <div className="rounded-2xl border-2 border-rose-400/60 bg-rose-900/30 p-4 sm:p-6 text-center">
            <p className="text-rose-300 font-bold text-base sm:text-2xl">반대</p>
            <p className="text-rose-300 text-5xl sm:text-8xl font-black tabular-nums mt-1">{vr.con || 0}</p>
            <p className="text-rose-200/80 text-xs sm:text-base mt-1">명</p>
          </div>
          <div className="rounded-2xl border-2 border-amber-400/60 bg-amber-900/30 p-4 sm:p-6 text-center">
            <p className="text-amber-300 font-bold text-base sm:text-2xl">기권</p>
            <p className="text-amber-300 text-5xl sm:text-8xl font-black tabular-nums mt-1">{vr.abstain || 0}</p>
            <p className="text-amber-200/80 text-xs sm:text-base mt-1">명</p>
          </div>
        </div>

        {/* 최종 의결 메시지 */}
        <div className={`w-full max-w-4xl rounded-2xl px-4 py-5 sm:px-8 sm:py-8 text-center shadow-2xl ${
          passed
            ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 border-2 border-emerald-300/60'
            : 'bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 border-2 border-rose-300/60'
        }`}>
          <p className="text-white/90 text-base sm:text-xl font-bold mb-2">
            재석 {(vr.pro || 0) + (vr.con || 0) + (vr.abstain || 0)}명 중 찬성 {vr.pro || 0}명
          </p>
          <p className="text-3xl sm:text-6xl font-black text-white tracking-tight drop-shadow-lg">
            {passed ? '✅ 이 법안은 가결되었습니다' : '❌ 이 법안은 부결되었습니다'}
          </p>
        </div>

        <p className="text-white/60 text-xs sm:text-sm mt-6 sm:mt-8">
          선생님이 전광판을 끄면 다음 단계로 넘어갑니다.
        </p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto">
      {/* 헤더 — 법안 정보 */}
      <div className="text-center mb-8 sm:mb-12">
        <p className="text-amber-300 text-sm sm:text-base font-bold tracking-widest mb-2">
          🏛️ 본회의 표결
        </p>
        <h1 className="text-white text-3xl sm:text-6xl font-black leading-tight">
          {bill.title}
        </h1>
        {proposer && (
          <p className="text-indigo-300 text-base sm:text-xl mt-3">
            발의: {proposer.name}
          </p>
        )}
      </div>

      <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-black/20 px-5 py-4 sm:px-8 sm:py-6 mb-5 sm:mb-7">
        <p className="text-amber-300 text-xs sm:text-sm font-bold mb-1">🎯 코어 이슈</p>
        <p className="text-white text-base sm:text-2xl font-bold">
          {coreIssueLabel || '아직 코어 이슈가 선정되지 않았어요.'}
        </p>
        {coreIssueSlogan && (
          <p className="text-amber-100/90 text-sm sm:text-lg italic mt-1">
            "{coreIssueSlogan}"
          </p>
        )}
      </div>

      <div className="w-full max-w-5xl rounded-2xl border border-indigo-300/40 bg-indigo-950/30 px-5 py-4 sm:px-8 sm:py-6 mb-5 sm:mb-7">
        <p className="text-indigo-200 text-xs sm:text-sm font-bold mb-2">📜 이번 표결 법안 내용</p>
        <p className="text-white/95 text-sm sm:text-lg whitespace-pre-wrap leading-relaxed max-h-[26vh] overflow-y-auto pr-1">
          {billBodyText}
        </p>
      </div>

      <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-black/20 px-5 py-4 sm:px-8 sm:py-6 mb-8 sm:mb-10">
        <p className="text-white text-base sm:text-xl text-center font-semibold">
          실시간 집계는 숨겨져 있습니다.
        </p>
        <p className="text-white/70 text-sm sm:text-lg text-center mt-1">
          충분히 생각한 뒤 찬성·반대·기권 중 하나를 선택해 주세요.
        </p>
      </div>

      {role === 'student' && (
        <div className="space-y-4 w-full max-w-5xl">
          {!myChoice ? (
            <div className="bg-rose-500/25 border border-rose-550 text-rose-300 text-xs sm:text-sm font-black px-4 py-2.5 rounded-xl text-center shadow-xs">
              ⚠️ 표결 제출 후에는 선택을 변경할 수 없습니다. 신중히 결정해 주세요.
            </div>
          ) : (
            <div className="bg-emerald-500/25 border border-emerald-550 text-emerald-300 text-xs sm:text-sm font-black px-4 py-2.5 rounded-xl text-center shadow-xs">
              ✓ 표결 완료 (선택 변경 불가)
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5">
            <VoteButton
              active={myChoice === 'pro'}
              disabled={!!myChoice}
              onClick={() => cast('pro')}
              color="emerald"
              icon="✅"
              label="찬성"
            />
            <VoteButton
              active={myChoice === 'con'}
              disabled={!!myChoice}
              onClick={() => cast('con')}
              color="rose"
              icon="❌"
              label="반대"
            />
            <VoteButton
              active={myChoice === 'abstain'}
              disabled={!!myChoice}
              onClick={() => cast('abstain')}
              color="slate"
              icon="⚪"
              label="기권"
            />
          </div>
        </div>
      )}

      {role === 'student' && myChoice && (
        <p className="text-emerald-300 text-base sm:text-2xl font-bold mt-6 animate-pulse text-center">
          ✓ 표결 완료 — 다른 친구들이 모두 표결할 때까지 기다려요
        </p>
      )}
    </div>
  )
}

function buildBillBodyText(bill) {
  const rawBody = typeof bill?.body === 'string' ? bill.body.trim() : ''
  if (rawBody) return rawBody

  const data = bill?.templateData
  if (!data || typeof data !== 'object') return '법안 본문이 아직 입력되지 않았습니다.'

  const labelMap = {
    purpose: '제1조 (목적)',
    definition: '제2조 (정의)',
    duty: '제3조 (의무)',
    penalty: '제4조 (벌칙)',
    background: '입법 배경',
    problem: '해결할 문제',
    proposal: '핵심 제안',
    effect: '기대 효과',
    rebuttal: '우려 대응',
  }
  const preferredOrder = [
    'purpose', 'definition', 'duty', 'penalty',
    'background', 'problem', 'proposal', 'effect', 'rebuttal',
  ]

  const lines = []
  const used = new Set()

  const toText = (value) => {
    if (typeof value === 'string') return value.trim()
    if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean).join('\n')
    return ''
  }

  for (const key of preferredOrder) {
    const text = toText(data[key])
    if (!text) continue
    lines.push(`${labelMap[key] || key}\n${text}`)
    used.add(key)
  }

  for (const [key, value] of Object.entries(data)) {
    if (used.has(key) || key === 'title' || key === 'lockedAt') continue
    const text = toText(value)
    if (!text) continue
    lines.push(`${labelMap[key] || key}\n${text}`)
  }

  return lines.length > 0 ? lines.join('\n\n') : '법안 본문이 아직 입력되지 않았습니다.'
}

const COLOR_CLS = {
  emerald: { bg: 'bg-emerald-600/20', text: 'text-emerald-300', border: 'border-emerald-500/50', solid: 'bg-emerald-500', hover: 'hover:bg-emerald-600', solidActive: 'bg-emerald-500 ring-4 ring-emerald-300' },
  rose:    { bg: 'bg-rose-600/20',    text: 'text-rose-300',    border: 'border-rose-500/50',    solid: 'bg-rose-500',    hover: 'hover:bg-rose-600',    solidActive: 'bg-rose-500 ring-4 ring-rose-300' },
  slate:   { bg: 'bg-slate-600/20',   text: 'text-slate-300',   border: 'border-slate-500/50',   solid: 'bg-slate-500',   hover: 'hover:bg-slate-600',   solidActive: 'bg-slate-500 ring-4 ring-slate-300' },
}

function VoteButton({ active, onClick, color, icon, label, disabled }) {
  const c = COLOR_CLS[color]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`py-6 sm:py-10 rounded-2xl text-white font-black text-2xl sm:text-4xl shadow-lg transition active:scale-95 disabled:pointer-events-none ${
        active 
          ? c.solidActive 
          : disabled 
          ? 'bg-slate-800 text-slate-500 opacity-40 shadow-none border border-slate-700' 
          : `${c.solid} ${c.hover}`
      }`}
    >
      <div className="text-5xl sm:text-7xl mb-2">{icon}</div>
      {label}
    </button>
  )
}

export default LegislativeBoardModal
