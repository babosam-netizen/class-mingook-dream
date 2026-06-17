import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt } from '../../lib/rtdb-helpers'

/**
 * 사법부 활동 메모 (판결중심 모드, 개인 단위 자동저장).
 *
 * 쟁점 단계에서 시작한 "내 메모"를 재판하기·토론도구·참관판사 평가 영역에서
 * 같은 메모로 계속 이어서 기록한다. 학생마다 따로 쓰며, 모둠 종합은 토론도구의
 * 종합판결문(모둠원 종합평가 카드 + 판결문 작성)에서 정리한다.
 * 저장 위치: judicialIssues/{caseId}/{studentId}.
 * 입력하면 디바운스 자동저장되며, '저장 중…' → '✓ 저장됨' 상태를 표시한다.
 */
export default function JudicialActivityMemo({
  title = '📝 사법부 활동 메모',
  subtitle,
  placeholder,
  rows = 5,
  className = '',
  readOnly = false,
}) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const activeCase = branchConfig?.judicial?.activeCase || null
  const judicialCaseId = activeCase?.id || branchConfig?.judicial?.activeCaseId || 'judicial-default'

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) if (g?.members?.[myStudentId]) return gid
    return null
  }, [groups, myStudentId])

  const [remote, setRemote] = useState('')
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('idle') // idle | saving | saved
  const focused = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!roomCode || !judicialCaseId || !myStudentId) return
    const u = subscribe(roomCode, `judicialIssues/${judicialCaseId}/${myStudentId}`, (d) => setRemote(d?.body || ''))
    return () => u?.()
  }, [roomCode, judicialCaseId, myStudentId])

  // 원격값 → 로컬 동기화 (내가 편집 중일 때는 덮어쓰지 않음)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!focused.current) setDraft(remote) }, [remote])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const save = async (text) => {
    if (!roomCode || !myStudentId) return
    setStatus('saving')
    await setAt(roomCode, `judicialIssues/${judicialCaseId}/${myStudentId}`, {
      body: text, studentId: myStudentId, groupId: myGroupId || '', at: Date.now(),
    })
    setStatus('saved')
  }

  const onChange = (e) => {
    const v = e.target.value
    setDraft(v)
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(v), 600)
  }

  if (!myStudentId) {
    return <div className={`text-sm text-gray-400 italic ${className}`}>학생으로 입장하면 개인 메모를 작성할 수 있습니다.</div>
  }

  // 읽기 전용 모드 — 참고용으로만 보여주고 복사 가능(편집 불가)
  if (readOnly) {
    const copyMemo = async () => {
      try {
        await navigator.clipboard.writeText(remote || '')
        setStatus('copied')
        setTimeout(() => setStatus('idle'), 1500)
      } catch { /* 클립보드 차단 시 무시 — 텍스트 직접 선택해 복사 가능 */ }
    }
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-1 gap-2">
          <h3 className="text-sm font-bold text-amber-900">{title}</h3>
          <button
            type="button"
            onClick={copyMemo}
            disabled={!remote}
            className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-amber-300 bg-white text-amber-700 hover:bg-amber-100 disabled:opacity-40"
          >
            {status === 'copied' ? '✓ 복사됨' : '📋 복사'}
          </button>
        </div>
        {subtitle && <p className="text-[11px] text-amber-700 mb-1.5 leading-snug">{subtitle}</p>}
        <div className="w-full text-sm whitespace-pre-wrap leading-relaxed rounded-xl border-2 border-amber-100 bg-white p-3 text-slate-800 select-text min-h-[3rem]">
          {remote ? remote : <span className="text-gray-400 italic">쟁점 단계에서 작성한 메모가 여기 표시됩니다. (아직 작성 전)</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <h3 className="text-sm font-bold text-amber-900">{title}</h3>
        <span className="text-[11px] shrink-0">
          {status === 'saving' ? <span className="text-amber-500">저장 중…</span>
            : status === 'saved' ? <span className="text-emerald-600">✓ 저장됨</span>
            : <span className="text-gray-300">자동 저장</span>}
        </span>
      </div>
      {subtitle && <p className="text-[11px] text-amber-700 mb-1.5 leading-snug">{subtitle}</p>}
      <textarea
        value={draft}
        onChange={onChange}
        onFocus={() => { focused.current = true }}
        onBlur={() => { focused.current = false; if (timer.current) { clearTimeout(timer.current); save(draft) } }}
        rows={rows}
        maxLength={600}
        placeholder={placeholder || '재판을 보며 핵심 쟁점·발언·증거를 메모하세요. (자동 저장)'}
        className="w-full text-sm border-2 border-amber-200 rounded-xl p-3 focus:outline-none focus:border-amber-400 bg-white"
      />
    </div>
  )
}
