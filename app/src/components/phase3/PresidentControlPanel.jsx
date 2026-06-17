import { useEffect, useMemo, useRef, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, setAt } from '../../lib/rtdb-helpers'
import { formatBudgetAmount, roundBudgetAmount } from './executiveBudgetData'

/**
 * 대통령실 전용 상단 패널.
 * 일반 부처와 달리 대통령실은 "공약 1개를 골라 그 공약 시행령·예산을 만들고,
 * 각 부처에 업무지시를 내리며, 국무회의 대본을 준비"한다.
 * - ① 공약 선택: 선거 등록 공약(candidates/{대통령모둠}.pledges) 중 1개 선택 + 이번 법령과의 연결 한 줄.
 * - ② 부처별 업무지시: 교사가 역할중심으로 설정한 부처(branchConfig.executive.units, 대통령실 제외) 자동 나열.
 * - ③ 국무회의 대본: ①②와 우리 공약 시행령 예산을 묶어 자동 생성 → 함께 수정.
 * 저장 위치: branchDrafts/exe-president/{selectedPledge|directives|cabinetScript}
 */
const PRES_DRAFT = 'branchDrafts/exe-president'

export default function PresidentControlPanel({ groupId }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const className = useGameStore((s) => s.className)
  const config = useGameStore((s) => s.config)
  const branchConfig = config?.branchConfig
  const presidentGroupId = branchConfig?.executive?.presidentGroupId || groupId
  const countryName = branchConfig?.executive?.countryName || config?.countryName || className || '비빔민국'

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])
  const canEdit = role === 'teacher' || myGroupId === presidentGroupId

  // 구독
  const [candidate, setCandidate] = useState(null)
  const [selectedPledge, setSelectedPledge] = useState(null)
  const [directives, setDirectives] = useState({})
  const [cabinetScript, setCabinetScript] = useState(null)
  const [myPolicy, setMyPolicy] = useState(null)

  useEffect(() => {
    if (!roomCode || !presidentGroupId) return
    const u = subscribe(roomCode, `candidates/${presidentGroupId}`, (d) => setCandidate(d || null))
    return () => u?.()
  }, [roomCode, presidentGroupId])
  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, `${PRES_DRAFT}/selectedPledge`, (d) => setSelectedPledge(d || null))
    const u2 = subscribe(roomCode, `${PRES_DRAFT}/directives`, (d) => setDirectives(d || {}))
    const u3 = subscribe(roomCode, `${PRES_DRAFT}/cabinetScript`, (d) => setCabinetScript(d || null))
    return () => { u1?.(); u2?.(); u3?.() }
  }, [roomCode])
  useEffect(() => {
    if (!roomCode || !presidentGroupId) return
    const u = subscribe(roomCode, `policies/${presidentGroupId}`, (d) => setMyPolicy(d || null))
    return () => u?.()
  }, [roomCode, presidentGroupId])

  const pledges = useMemo(
    () => (candidate?.pledges || []).filter((p) => p && String(p).trim()),
    [candidate]
  )
  const ministries = useMemo(() => {
    const units = branchConfig?.executive?.units || []
    return units.filter((u) => u.groupId && u.groupId !== presidentGroupId)
  }, [branchConfig, presidentGroupId])

  // 대통령 공약 예약 예산 (시행령 예산 합계)
  const reservedBudget = useMemo(() => {
    if (!myPolicy) return 0
    if (Number(myPolicy.draftBudget)) return roundBudgetAmount(myPolicy.draftBudget)
    const items = myPolicy.budgetItems || myPolicy.budget?.items || []
    const arr = Array.isArray(items) ? items : Object.values(items || {})
    return roundBudgetAmount(arr.reduce((sum, it) => sum + (Number(it?.amount) || Number(it?.total) || 0), 0))
  }, [myPolicy])

  // ── 로컬 편집 상태 (포커스 중에는 원격 덮어쓰기 방지) ──
  const [lawLink, setLawLink] = useState('')
  const [directiveDrafts, setDirectiveDrafts] = useState({})
  const [scriptText, setScriptText] = useState('')
  const focused = useRef(null)

  useEffect(() => {
    if (focused.current !== 'lawLink') setLawLink(selectedPledge?.lawLink || '')
  }, [selectedPledge])
  useEffect(() => {
    setDirectiveDrafts((prev) => {
      const next = { ...prev }
      for (const m of ministries) {
        if (focused.current !== `dir_${m.unitId}`) next[m.unitId] = directives[m.unitId]?.text || ''
      }
      return next
    })
  }, [directives, ministries])
  useEffect(() => {
    if (focused.current !== 'script') setScriptText(cabinetScript?.text || '')
  }, [cabinetScript])

  const ministryLabel = (m) => m.ministryName || groups?.[m.groupId]?.name || '부처'

  // ── 저장 핸들러 ──
  const savePledge = async (index) => {
    if (!canEdit || !roomCode) return
    await setAt(roomCode, `${PRES_DRAFT}/selectedPledge`, {
      index,
      text: pledges[index] || '',
      lawLink: selectedPledge?.lawLink || lawLink || '',
      updatedAt: Date.now(),
    })
  }
  const saveLawLink = async () => {
    if (!canEdit || !roomCode || !selectedPledge) return
    await setAt(roomCode, `${PRES_DRAFT}/selectedPledge`, {
      ...selectedPledge,
      lawLink,
      updatedAt: Date.now(),
    })
  }
  const saveDirective = async (m) => {
    if (!canEdit || !roomCode) return
    await setAt(roomCode, `${PRES_DRAFT}/directives/${m.unitId}`, {
      ministryName: ministryLabel(m),
      groupId: m.groupId,
      text: directiveDrafts[m.unitId] || '',
      updatedAt: Date.now(),
    })
  }
  const saveScript = async () => {
    if (!canEdit || !roomCode) return
    await setAt(roomCode, `${PRES_DRAFT}/cabinetScript`, { text: scriptText, updatedAt: Date.now() })
  }
  const generateScript = async () => {
    if (!canEdit || !roomCode) return
    const lines = []
    lines.push(`📋 ${countryName} 국무회의 진행 대본 (대통령 모둠용)`)
    lines.push('')
    lines.push('【1. 대통령 모두발언】')
    if (selectedPledge?.text) {
      lines.push(`존경하는 국민 여러분, 각 부처 장관 여러분. 우리 정부는 이번에 통과된 법령에 발맞추어 핵심 공약 「${selectedPledge.text}」을(를) 반드시 실현하겠습니다.`)
      if (selectedPledge.lawLink) lines.push(`(이 공약과 이번 법령의 연결: ${selectedPledge.lawLink})`)
    } else {
      lines.push('(먼저 위에서 실현할 공약을 선택해 주세요.)')
    }
    lines.push('')
    lines.push('【2. 부처별 업무지시】')
    if (ministries.length === 0) {
      lines.push('(교사 학급설정에서 부처를 먼저 배치해 주세요.)')
    } else {
      ministries.forEach((m) => {
        const t = directives[m.unitId]?.text || directiveDrafts[m.unitId] || ''
        lines.push(`- ${ministryLabel(m)}: ${t || '(업무지시 작성 필요)'}`)
      })
    }
    lines.push('')
    lines.push('【3. 예산 조정 안내】')
    lines.push(`우리 공약 예산 ${formatBudgetAmount(reservedBudget)}억은 먼저 확보합니다. 남은 예산 안에서 각 부처가 시행령 예산을 조정해 주시기 바랍니다.`)
    lines.push('')
    lines.push('【4. 마무리】')
    lines.push('각 부처의 협조를 부탁드리며, 오늘 국무회의를 시작하겠습니다.')
    const text = lines.join('\n')
    setScriptText(text)
    await setAt(roomCode, `${PRES_DRAFT}/cabinetScript`, { text, generatedAt: Date.now(), updatedAt: Date.now() })
  }

  const selectedIdx = selectedPledge?.index

  return (
    <div className="space-y-4 mb-4">
      {/* 안내 배너 */}
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 flex items-start gap-3">
        <span className="text-2xl">👑</span>
        <div>
          <p className="font-black text-yellow-900 text-sm">대통령실 — 공약 연계 시행령·예산</p>
          <p className="text-xs text-yellow-800 mt-1">
            일반 부처가 <b>통과 법령</b>을 집행한다면, 대통령실은 <b>우리 공약 1개</b>를 골라 이번 법령과 엮어
            시행령·예산을 만들고 각 부처에 <b>업무지시</b>를 내립니다. 아래에서 공약을 먼저 정하고, 역할을 나눠 시행령을 작성하세요.
          </p>
        </div>
      </div>

      {/* ① 공약 선택 */}
      <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <h3 className="text-sm font-bold text-amber-900">① 이번 법령과 함께 실현할 공약 고르기</h3>
        </div>
        <div className="p-4 space-y-3">
          {pledges.length === 0 ? (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-3">
              ⚠️ 대통령 모둠의 등록 공약을 찾을 수 없습니다. 선거 단계에서 후보 등록 시 작성한 공약이 있어야 불러올 수 있어요.
            </p>
          ) : (
            <div className="space-y-2">
              {pledges.map((p, i) => {
                const isSel = selectedIdx === i
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => savePledge(i)}
                    className={`w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm transition ${
                      isSel
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-900'
                        : 'border-gray-200 bg-white hover:border-amber-300 text-slate-700'
                    } ${canEdit ? '' : 'opacity-70 cursor-default'}`}
                  >
                    <span className="mr-2">{isSel ? '✅' : '⬜'}</span>{p}
                  </button>
                )
              })}
            </div>
          )}

          {selectedPledge?.text && (
            <label className="block space-y-1 pt-1">
              <span className="text-[11px] font-black text-amber-700">이 공약이 이번 통과 법령과 어떻게 연결되나요? (한 줄)</span>
              <textarea
                value={lawLink}
                disabled={!canEdit}
                onFocus={() => { focused.current = 'lawLink' }}
                onBlur={() => { focused.current = null; saveLawLink() }}
                onChange={(e) => setLawLink(e.target.value)}
                rows={2}
                placeholder="예: 전쟁 화해 법령의 '갈등 해소' 취지에 맞춰, 피해가 큰 사회적 약자에게 한시적으로 시급을 올려 줍니다."
                className="w-full resize-none rounded border border-amber-200 px-2 py-1.5 text-xs bg-white"
              />
            </label>
          )}
        </div>
      </div>

      {/* ② 부처별 업무지시 */}
      <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <h3 className="text-sm font-bold text-amber-900">② 각 부처에 내릴 업무지시</h3>
          <p className="text-[11px] text-amber-700 mt-0.5">교사가 배치한 부처가 자동으로 나옵니다. 국무회의에서 낭독할 지시를 적어 두세요.</p>
        </div>
        <div className="p-4 space-y-3">
          {ministries.length === 0 ? (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
              아직 배치된 부처가 없습니다. 교사 학급설정 → 행정부에서 부처를 배치하면 여기에 자동으로 나타납니다.
            </p>
          ) : (
            ministries.map((m) => (
              <label key={m.unitId} className="block space-y-1">
                <span className="text-xs font-bold text-slate-700">🏛️ {ministryLabel(m)}</span>
                <textarea
                  value={directiveDrafts[m.unitId] || ''}
                  disabled={!canEdit}
                  onFocus={() => { focused.current = `dir_${m.unitId}` }}
                  onBlur={() => { focused.current = null; saveDirective(m) }}
                  onChange={(e) => setDirectiveDrafts((prev) => ({ ...prev, [m.unitId]: e.target.value }))}
                  rows={2}
                  placeholder={`${ministryLabel(m)}에 내릴 지시 (예: 공약 시행에 필요한 OO 자료·협조를 준비해 주세요)`}
                  className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-xs bg-white"
                />
              </label>
            ))
          )}
        </div>
      </div>

      {/* ③ 국무회의 대본 */}
      <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-amber-900">③ 국무회의 진행 대본</h3>
            <p className="text-[11px] text-amber-700 mt-0.5">공약·업무지시·예산을 묶어 자동으로 만든 뒤 함께 다듬으세요.</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={generateScript}
              className="shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition active:scale-95"
            >
              🤖 대본 자동 생성
            </button>
          )}
        </div>
        <div className="p-4">
          <textarea
            value={scriptText}
            disabled={!canEdit}
            onFocus={() => { focused.current = 'script' }}
            onBlur={() => { focused.current = null; saveScript() }}
            onChange={(e) => setScriptText(e.target.value)}
            rows={10}
            placeholder="[🤖 대본 자동 생성]을 누르면 공약·부처 업무지시·예산 안내가 담긴 국무회의 대본 초안이 만들어집니다."
            className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-xs bg-white leading-relaxed font-mono"
          />
          {!canEdit && (
            <p className="text-[10px] text-gray-400 mt-1">대통령 모둠과 교사만 수정할 수 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}
