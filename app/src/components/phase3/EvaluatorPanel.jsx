import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, subscribe } from '../../lib/rtdb-helpers'

/**
 * EvaluatorPanel — 평가단(시민단체·기사단) 작성 패널
 *
 * 평가단으로 배치된 학생의 화면 하단 또는 별도 탭에 표시.
 * 시민단체: 특정 유닛에 요청 댓글 전송
 * 기사단:   특정 유닛을 대상으로 평가 기사 작성
 *
 * 대상 유닛은 각 부서의 branchConfig units 에서 가져옴.
 *
 * RTDB: rooms/{roomCode}/externalFeed/{feedId}
 */
export default function EvaluatorPanel() {
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups      = useGameStore((s) => s.groups)
  const config      = useGameStore((s) => s.config)

  const branchConfig = config?.branchConfig

  // 내 모둠 ID
  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // 내 평가단 역할
  const myEvalRole = useMemo(() => {
    if (!myGroupId || !branchConfig?.evaluators) return null
    return branchConfig.evaluators.find((e) => e.groupId === myGroupId) || null
  }, [myGroupId, branchConfig])

  // 대상 유닛 목록 (targetScope 필터)
  const targetUnits = useMemo(() => {
    if (!myEvalRole || !branchConfig) return []
    const scope = myEvalRole.targetScope || 'all'
    const leg = branchConfig.legislative?.units || []
    const exe = branchConfig.executive?.units || []
    const pro = (branchConfig.judicial?.prosecution || []).map((u) => ({ ...u, _branch: 'judicial', _side: '검사팀' }))
    const def = (branchConfig.judicial?.defense     || []).map((u) => ({ ...u, _branch: 'judicial', _side: '변호팀' }))

    const all = [
      ...leg.map((u) => ({ ...u, _branch: 'legislative', _branchLabel: '입법부' })),
      ...exe.map((u) => ({ ...u, _branch: 'executive',   _branchLabel: '행정부' })),
      ...pro.map((u) => ({ ...u, _branchLabel: '사법부' })),
      ...def.map((u) => ({ ...u, _branchLabel: '사법부' })),
    ]

    if (scope === 'all') return all
    return all.filter((u) => u._branch === scope)
  }, [myEvalRole, branchConfig])

  const [feedMap, setFeedMap]       = useState({})
  const [targetUnitId, setTargetUnitId] = useState('')
  const [text, setText]             = useState('')
  const [headline, setHeadline]     = useState('')
  const [body, setBody]             = useState('')
  const [busy, setBusy]             = useState(false)
  const [sent, setSent]             = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'externalFeed', (d) => setFeedMap(d || {}))
    return () => u?.()
  }, [roomCode])

  // 내가 보낸 피드만
  const myFeed = Object.entries(feedMap)
    .map(([id, f]) => ({ id, ...f }))
    .filter((f) => f.authorGroupId === myGroupId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  if (!myEvalRole) return null

  const isPress    = myEvalRole.type === 'press'
  const canSubmit  = targetUnitId && (isPress ? (headline.trim() && body.trim()) : text.trim())

  async function handleSubmit() {
    if (!canSubmit || busy) return
    setBusy(true)
    const payload = {
      type: myEvalRole.type,
      authorGroupId: myGroupId,
      authorStudentId: myStudentId,
      targetUnitId: targetUnitId || 'all',
      createdAt: Date.now(),
      isVisible: true,
    }
    if (isPress) {
      payload.headline = headline.trim()
      payload.body     = body.trim()
    } else {
      payload.requestText = text.trim()
    }
    await pushUnder(roomCode, 'externalFeed', payload)
    setText(''); setHeadline(''); setBody('')
    setSent(true)
    setTimeout(() => setSent(false), 2000)
    setBusy(false)
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 overflow-hidden">
      <div className="bg-emerald-100 px-4 py-2 flex items-center gap-2">
        <span className="text-sm font-bold text-emerald-800">
          {isPress ? '📰 기사단 — 평가 기사 작성' : '🏛️ 시민단체 — 요청 전달'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-emerald-700">
          {isPress
            ? '각 모둠의 작업 내용을 열람하고 평가 기사를 작성합니다. 기사는 해당 모둠 작업창 상단에 즉시 표시됩니다.'
            : '각 모둠의 작업 내용을 열람하고 시민 요청을 전달합니다. 요청은 해당 모둠 작업창 상단에 즉시 표시됩니다.'}
        </p>

        {/* 대상 선택 */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">대상 모둠</label>
          <select
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            value={targetUnitId}
            onChange={(e) => setTargetUnitId(e.target.value)}
          >
            <option value="">— 대상 선택 —</option>
            {targetUnits.map((u) => {
              const grp   = groups?.[u.groupId]
              const label = u.ministryName || u.title || (u._side ? `${u._side}` : '') || ''
              return (
                <option key={u.unitId} value={u.unitId}>
                  {u._branchLabel} / {grp?.name || u.groupId}{label ? ` — ${label}` : ''}
                </option>
              )
            })}
          </select>
        </div>

        {/* 기사단: 헤드라인 + 본문 */}
        {isPress ? (
          <>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">헤드라인 (30자 이내)</label>
              <input
                type="text"
                maxLength={30}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                placeholder="예: 모둠1 법안, 예산 근거 없이 발의 예정"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
              <div className="text-right text-[11px] text-gray-400">{headline.length}/30</div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">본문 (200자 이내)</label>
              <textarea
                rows={4}
                maxLength={200}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-none"
                placeholder="기사 내용을 작성하세요."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="text-right text-[11px] text-gray-400">{body.length}/200</div>
            </div>
          </>
        ) : (
          /* 시민단체: 요청 텍스트 */
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">요청 내용 (150자 이내)</label>
            <textarea
              rows={3}
              maxLength={150}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-none"
              placeholder="시민의 입장에서 요청 또는 의견을 작성하세요."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="text-right text-[11px] text-gray-400">{text.length}/150</div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          className="w-full py-2 text-sm font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-40"
        >
          {sent ? '✅ 전송됨!' : busy ? '전송 중…' : isPress ? '📰 기사 전송' : '🏛️ 요청 전달'}
        </button>

        {/* 내가 보낸 피드 목록 */}
        {myFeed.length > 0 && (
          <div className="border-t border-emerald-200 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500">내가 보낸 의견 ({myFeed.length}건)</p>
            {myFeed.slice(0, 5).map((f) => {
              const target = targetUnits.find((u) => u.unitId === f.targetUnitId)
              const grp    = groups?.[target?.groupId]
              const time   = new Date(f.createdAt).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={f.id} className="bg-white rounded-lg p-2 text-xs text-gray-600 border border-gray-100">
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>→ {grp?.name || f.targetUnitId}</span>
                    <span>{time}</span>
                  </div>
                  <p className="line-clamp-2">{f.headline || f.requestText}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
