import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { topicBg } from '../../styles/tokens'
import PosterMedia from '../phase1/PosterMedia'
import { getStudentJudicialSide, JUDICIAL_SIDE_LABEL } from '../../lib/judicial-teams'
import { DEFAULT_ROLES, normalizeRoleList, normalizeTodo } from '../../lib/scaffolding-data'

// 사법부 역할별 '내 대본'에 해당하는 발화자 (JudicialVerdictTab과 동일)
const SCRIPT_SPEAKERS_BY_SIDE = {
  judge:       ['judge'],
  prosecution: ['prosecution', 'witness'],
  defense:     ['defense', 'defendant'],
}
const SPEAKER_LABEL = {
  judge: '⚖️ 판사', prosecution: '👨‍💼 검사', defense: '🛡️ 변호인', witness: '👤 증인', defendant: '🙍 피고인',
}

/**
 * 페이즈 활동 요약 — 여론조사·기사 작성 단계에서 ‘이번 여정에 일어난 일’을 한 화면에.
 *
 * props:
 *   phase: 1 | 2 | 3
 *   tab?: 'legislative'|'executive'|'judicial'  (세 번째 여정일 때 어떤 부 활동 요약할지)
 *
 * 사법(judicial) 탭은 학급 전체가 아니라 '내가 사법부에서 한 모든 활동'을 모아 보여준다:
 *   맡은 역할 · 작성한 쟁점 메모 · 토론 준비 카드 · 역할 대본 · 배심원 투표 · 모둠 판결문 · 개인 종합 평가
 */
function PhaseActivitySummary({ phase, tab }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const myStudentId = useGameStore((s) => s.myStudentId)

  const [posters, setPosters] = useState({})
  const [comments, setComments] = useState({})
  const [bills, setBills] = useState({})
  const [policies, setPolicies] = useState({})
  const [verdicts, setVerdicts] = useState({})
  const [judicialIssues, setJudicialIssues] = useState({})
  const [debateSessions, setDebateSessions] = useState({})
  const [juryVotes, setJuryVotes] = useState({})
  const [branchDrafts, setBranchDrafts] = useState({})
  const [billVotes, setBillVotes] = useState({})
  const [articles, setArticles] = useState({})

  // 타임라인 단계 '자세히 보기' — 펼친 단계 키 집합
  const [expanded, setExpanded] = useState({})
  const toggleExpand = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'posters', (d) => setPosters(d || {})),
      subscribe(roomCode, 'comments', (d) => setComments(d || {})),
      subscribe(roomCode, 'bills', (d) => setBills(d || {})),
      subscribe(roomCode, 'policies', (d) => setPolicies(d || {})),
      subscribe(roomCode, 'verdicts', (d) => setVerdicts(d || {})),
      subscribe(roomCode, 'judicialIssues', (d) => setJudicialIssues(d || {})),
      subscribe(roomCode, 'debateSessions', (d) => setDebateSessions(d || {})),
      subscribe(roomCode, 'juryVotes', (d) => setJuryVotes(d || {})),
      subscribe(roomCode, 'branchDrafts', (d) => setBranchDrafts(d || {})),
      subscribe(roomCode, 'billVotes', (d) => setBillVotes(d || {})),
      subscribe(roomCode, 'articles', (d) => setArticles(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  // 내 모둠 id
  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // 내가 이 탭에서 쓴 기사 + 그때 같은 모둠(authorGroupId 스냅샷)이 함께 쓴 기사
  // 모둠 스냅샷을 쓰므로 지금은 모둠이 바뀌었어도 그 당시 함께였던 친구 기록이 남는다.
  const myArticles = useMemo(() => {
    if (!(phase === 3 && tab)) return []
    // 토론 세션 → 소속 부 추론 (target 미설정 기사 보강)
    const sessionBranch = (s) => {
      if (!s) return null
      const sid = String(s.sourceStepId || '')
      if (s.type === 'trial' || s.relatedCaseId || sid.startsWith('judicial') || sid.startsWith('verdict')) return 'judicial'
      if (s.relatedExecutiveMeeting || s.type === 'multi_party' || sid.startsWith('executive')) return 'executive'
      if (s.relatedBillId || sid.startsWith('legislative')) return 'legislative'
      return null
    }
    const all = Object.entries(articles || {})
      .filter(([, a]) => a?.target === tab ||
        ((!a?.target || a?.target === 'general') && a?.debateSessionId && sessionBranch(debateSessions?.[a.debateSessionId]) === tab))
      .map(([id, a]) => ({ id, ...a }))
    const mine = all.filter((a) => a.authorStudentId === myStudentId)
    // 내가 그때 속했던 모둠 id 집합 (기사 스냅샷 우선, 없으면 현재 모둠)
    const myGroupIds = new Set(mine.map((a) => a.authorGroupId).filter(Boolean))
    if (myGroupId) myGroupIds.add(myGroupId)
    return all
      .filter((a) => a.authorStudentId === myStudentId || (a.authorGroupId && myGroupIds.has(a.authorGroupId)))
      .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
  }, [phase, tab, articles, myStudentId, myGroupId, debateSessions])

  // 섹션 content가 문자열/객체 모두 가능 → 텍스트 추출
  const sectionText = (content) =>
    typeof content === 'object'
      ? (content?.policyFields?.text || content?.text || '')
      : (content || '')

  // 내가 이 탭(부)에서 한 모든 활동을 진행 순서 타임라인 steps로 구성
  const branchActivity = useMemo(() => {
    if (phase !== 3 || !tab) return null
    const bc = config?.branchConfig || {}

    // 내가 이 부에서 그때 속했던 모둠 id 집합 (스냅샷 기반)
    // → 지금 모둠이 바뀌었어도, 당시 모둠의 법안·정책·판결문·기사를 함께 보여주기 위함.
    const myGroupIds = new Set()
    if (myGroupId) myGroupIds.add(myGroupId)
    myArticles.forEach((a) => { if (a.authorStudentId === myStudentId && a.authorGroupId) myGroupIds.add(a.authorGroupId) })
    const unitsForBranch = tab === 'judicial'
      ? ['prosecution', 'defense', 'jury', 'witness', 'judge', 'press'].flatMap((k) => bc.judicial?.[k] || [])
      : (bc[tab]?.units || [])
    unitsForBranch.forEach((u) => {
      const d = u?.unitId ? branchDrafts?.[u.unitId] : null
      if (!d) return
      const mine = d.memberNotes?.[myStudentId] || Object.values(d.sections || {}).some((s) => s?.authorStudentId === myStudentId)
      if (mine && u.groupId) myGroupIds.add(u.groupId)
    })

    // 공통: 내가 쓴 기사 step
    const articleStep = {
      icon: '📰', label: '기사 작성 (토론도구 포함)', dot: 'bg-cyan-400',
      done: myArticles.length > 0,
      body: myArticles.length > 0
        ? <div className="space-y-2">
            {myArticles.map((a) => {
              const isMine = a.authorStudentId === myStudentId
              return (
                <div key={a.id} className="text-xs text-gray-700">
                  <p className="font-bold text-cyan-800">
                    {a.contextType === 'debate' ? '📢 ' : ''}{a.headline || '제목 없음'}
                    {a.perspective ? <span className="ml-1 text-gray-400">· {a.perspective === 'critical' ? '비판' : a.perspective === 'supportive' ? '옹호' : '중립'}</span> : null}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {isMine ? '✍️ 내가 작성' : `🧑‍🤝‍🧑 ${a.authorNickname || '모둠 친구'} (당시 같은 모둠)`}
                  </p>
                  {a.body && <p className="mt-0.5 whitespace-pre-wrap">{a.body}</p>}
                </div>
              )
            })}
          </div>
        : null,
    }

    // ── 사법부 ─────────────────────────────────────────────
    if (tab === 'judicial') {
      const judicialConfig = bc.judicial
      const workMode = judicialConfig?.workMode || 'role'
      const activeCase = judicialConfig?.activeCase
      const activeCaseId = judicialConfig?.activeCaseId || activeCase?.id
      const side = getStudentJudicialSide(myStudentId, judicialConfig, groups)
      // 판결중심(verdict) 모드: 판사·검사·변호 3팀만 연기, 그 외 전원은 '참관 판사'(판결문 작성)
      const isActor = side === 'judge' || side === 'prosecution' || side === 'defense'
      const roleLabel = workMode === 'verdict'
        ? (isActor ? `🎭 연기팀 ${JUDICIAL_SIDE_LABEL[side] || side} · 판사` : '🧑‍⚖️ 참관 판사 (판결문 작성)')
        : (side ? (JUDICIAL_SIDE_LABEL[side] || side) : null)
      const memo = activeCaseId ? (judicialIssues?.[activeCaseId]?.[myStudentId]?.body || '') : ''

      const prepCards = []
      const finalEvals = []
      Object.values(debateSessions || {}).forEach((s) => {
        if (!s || s.type !== 'trial') return
        Object.values(s.prepCards || {}).forEach((card) => {
          if (card?.studentId === myStudentId) prepCards.push(card)
        })
        const ev = s.finalEvaluations?.[myStudentId]
        if (ev) finalEvals.push(typeof ev === 'string' ? ev : (ev.content || ev.comment || ''))
      })

      const allowSpeakers = SCRIPT_SPEAKERS_BY_SIDE[side] || []
      const script = Array.isArray(activeCase?.trialScript) ? activeCase.trialScript : []
      const myLines = allowSpeakers.length
        ? [...script].filter((l) => allowSpeakers.includes(l?.speaker)).sort((a, b) => (a.order || 0) - (b.order || 0))
        : []

      const rawJury = activeCaseId ? juryVotes?.[activeCaseId]?.[myStudentId] : null
      const jvLabel = rawJury === 'pro' || rawJury === 'guilty' ? '⚖️ 유죄'
                    : rawJury === 'con' || rawJury === 'notGuilty' ? '🕊️ 무죄' : null

      let myVerdict = null
      for (const byCase of Object.values(verdicts || {})) {
        if (typeof byCase !== 'object') continue
        for (const v of Object.values(byCase)) {
          if (!v?.body) continue
          const gid = v.judgeGroupId || v.groupId
          if (gid && myGroupIds.has(gid)) {
            if (!myVerdict || (v.createdAt || v.submittedAt || 0) > (myVerdict.createdAt || myVerdict.submittedAt || 0)) myVerdict = v
          }
        }
      }

      const steps = [
        { icon: '🏷️', label: '역할 배정', dot: 'bg-slate-400', done: !!roleLabel,
          body: roleLabel ? <strong className="text-sm text-slate-800">{roleLabel}</strong> : null },
        { icon: '📝', label: '쟁점·재판 메모', dot: 'bg-amber-400', done: !!memo,
          body: memo ? <p className="text-xs text-gray-700 whitespace-pre-wrap">{memo}</p> : null },
        { icon: '📇', label: '토론 준비 카드', dot: 'bg-indigo-400', done: prepCards.length > 0,
          body: prepCards.length > 0
            ? <div className="space-y-2">
                {prepCards.map((card, i) => (
                  <div key={i} className="text-xs text-gray-700 space-y-0.5">
                    {card.stance && <p className="font-bold text-indigo-700">입장: {card.stance}</p>}
                    {card.mainClaim && <p><b>주장/판단:</b> {card.mainClaim}</p>}
                    {card.evidence && <p><b>근거:</b> {card.evidence}</p>}
                    {card.rebuttal && <p><b>반박:</b> {card.rebuttal}</p>}
                    {card.counterRebuttal && <p><b>대응:</b> {card.counterRebuttal}</p>}
                  </div>
                ))}
              </div> : null },
        { icon: '🎭', label: '재판 — 내 역할 대본', dot: 'bg-violet-400', done: myLines.length > 0,
          body: myLines.length > 0
            ? <ul className="text-xs text-gray-700 space-y-1">
                {myLines.map((l, i) => (
                  <li key={i}>
                    <span className="font-bold">{SPEAKER_LABEL[l.speaker] || l.speaker}</span>
                    {l.scene ? <span className="text-gray-400"> · {l.scene}</span> : null}
                    {l.text ? <span className="block whitespace-pre-wrap">{l.text}</span> : null}
                  </li>
                ))}
              </ul> : null },
        { icon: '🗳️', label: '배심원 투표', dot: 'bg-sky-400', done: !!jvLabel,
          body: jvLabel ? <strong className="text-sm text-sky-800">{jvLabel}</strong> : null },
        { icon: '⚖️', label: '우리 모둠 판결문', dot: 'bg-rose-400', done: !!myVerdict,
          body: myVerdict
            ? <div>
                <span className="text-xs font-bold">{myVerdict.decision === 'guilty' ? '⚖️ 유죄' : '🕊️ 무죄'}</span>
                {myVerdict.sentence && <p className="text-xs text-gray-600 mt-0.5">선고: {myVerdict.sentence}</p>}
                {myVerdict.body && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{myVerdict.body}</p>}
              </div> : null },
        { icon: '📋', label: '재판 종합 평가', dot: 'bg-emerald-400', done: finalEvals.filter(Boolean).length > 0,
          body: finalEvals.filter(Boolean).length > 0
            ? <div className="space-y-2">{finalEvals.filter(Boolean).map((ev, i) => <p key={i} className="text-xs text-gray-700 whitespace-pre-wrap">{ev}</p>)}</div> : null },
        articleStep,
      ]
      return { title: activeCase?.title || '모의재판', lineColor: 'border-rose-200', intro: '재판에서 내가 한 활동을 순서대로 정리했어요.', steps }
    }

    // ── 입법부 ─────────────────────────────────────────────
    if (tab === 'legislative') {
      const SESSION_ID = 'legislative-default'
      const isCollaborative = (bc.legislative?.mode || 'role_based') === 'collaborative'
      const unit = (bc.legislative?.units || []).find((u) => myGroupIds.has(u.groupId)) || null
      const draft = unit?.unitId ? branchDrafts?.[unit.unitId] : null
      const myNote = draft?.memberNotes?.[myStudentId]
      const mySections = Object.entries(draft?.sections || {}).filter(([, s]) => s?.authorStudentId === myStudentId)
      const myBills = Object.entries(bills || {}).filter(([, b]) => myGroupIds.has(b?.proposerGroupId)).map(([id, b]) => ({ id, ...b }))
      const myBillVotes = Object.entries(billVotes || {})
        .filter(([, v]) => v && v[myStudentId])
        .map(([bid, v]) => ({ bid, choice: v[myStudentId], title: bills?.[bid]?.title || bid }))

      // 역할중심 모드 — 내 역할 + 역할 메모(사전조사)·미션(초안). 그때 모둠(unit.groupId) 기준으로 조회.
      const actGroupId = unit?.groupId || myGroupId
      const myRoleKey = groups?.[actGroupId]?.sessionRoles?.[SESSION_ID]?.[myStudentId] || null
      const roles = normalizeRoleList('legislative', config?.roles?.legislative || bc.legislative?.roles || DEFAULT_ROLES.legislative)
      const myRole = myRoleKey ? roles.find((r) => r.key === myRoleKey) : null
      const roleNotes = myRoleKey ? groups?.[actGroupId]?.roleNotes?.[SESSION_ID]?.[myRoleKey] : null
      const roleLabel = myRole ? `${myRole.emoji || ''} ${myRole.label}`.trim() : null

      // 사전자료조사: 역할 memoGuide Q&A → 없으면 memberNotes
      const memoGuide = myRole?.memoGuide || []
      const memoQnas = roleNotes?.memoQnas || []
      const memoItems = memoGuide
        .map((q, i) => ({ label: typeof q === 'string' ? q : q.label, a: memoQnas[i] || '' }))
        .filter((x) => x.a && x.a.trim())
      const hasPrep = memoItems.length > 0 || !!(myNote?.text)

      // 입법초안(역할별): 역할 미션 답변(fields) + 내 담당 섹션
      const todos = myRole?.todos || []
      const fields = roleNotes?.fields || {}
      const links = roleNotes?.links || {}
      const missionItems = todos
        .map((t, i) => ({ label: normalizeTodo(t).label, a: fields[i] || '', link: links[i] || '' }))
        .filter((x) => x.a && x.a.trim())
      const hasDraft = missionItems.length > 0 || mySections.length > 0

      const steps = [
        { icon: '🏷️', label: '위원회·역할 배정', dot: 'bg-slate-400', done: !!unit || !!roleLabel,
          body: (unit || roleLabel)
            ? <div className="text-sm">
                <strong>{unit?.title || '입법 위원회'}</strong>
                <span className="text-xs text-gray-500 ml-1">({groups[actGroupId]?.name || '우리 모둠'})</span>
                {roleLabel && <p className="text-xs text-indigo-700 font-bold mt-0.5">내 역할: {roleLabel}</p>}
              </div> : null },
        { icon: '🔎', label: '사전 자료조사', dot: 'bg-amber-400', done: hasPrep,
          body: hasPrep
            ? <div className="text-xs text-gray-700 space-y-1.5">
                {memoItems.map((m, i) => <div key={i}><p className="font-bold text-amber-700">{m.label}</p><p className="whitespace-pre-wrap">{m.a}</p></div>)}
                {memoItems.length === 0 && myNote?.text && <p className="whitespace-pre-wrap">{myNote.text}</p>}
                {(myNote?.links || []).length > 0 && <ul className="list-disc pl-4 text-blue-600">{myNote.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="underline break-all">{l.url}</a></li>)}</ul>}
              </div> : null },
        { icon: '✍️', label: isCollaborative ? '내 조항 초안' : '입법 초안 작성 (내 역할)', dot: 'bg-indigo-400', done: hasDraft,
          body: hasDraft
            ? <div className="text-xs text-gray-700 space-y-2">
                {missionItems.map((m, i) => (
                  <div key={`m${i}`}>
                    <p className="font-bold text-indigo-700">{m.label}</p>
                    <p className="whitespace-pre-wrap">{m.a}</p>
                    {m.link && <p className="text-[11px]">🔗 <a href={m.link} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{m.link}</a></p>}
                  </div>
                ))}
                {mySections.map(([k, s]) => <div key={`s${k}`}><p className="font-bold text-indigo-700">조항: {k}</p><p className="whitespace-pre-wrap">{sectionText(s.content)}</p></div>)}
              </div> : null },
        { icon: '🏛️', label: '우리 모둠 법안', dot: 'bg-emerald-400', done: myBills.length > 0,
          body: myBills.length > 0
            ? <div className="space-y-2">{myBills.map((b) => (
                <div key={b.id} className="text-xs text-gray-700">
                  <p className="font-bold">{b.title} <span className="font-normal text-gray-400">· {b.status === 'passed' ? '✅ 가결' : b.status === 'rejected' ? '❌ 부결' : '🗳️ 의결 중'}</span></p>
                  {b.body && <p className="whitespace-pre-wrap">{b.body}</p>}
                  {b.voteResult && <p className="text-gray-500">찬성 {b.voteResult.yesCount ?? b.voteResult.yes}명 · 반대 {b.voteResult.noCount ?? b.voteResult.no}명</p>}
                </div>))}
              </div> : null },
        { icon: '🗳️', label: '내 법안 표결 (선택)', dot: 'bg-sky-400', done: myBillVotes.length > 0,
          body: myBillVotes.length > 0
            ? <ul className="text-xs text-gray-700 space-y-0.5">{myBillVotes.map((v) => <li key={v.bid}><b>{v.title}</b> → 내 선택: <b>{v.choice === 'pro' ? '✅ 찬성' : v.choice === 'con' ? '❌ 반대' : '⚪ 기권'}</b></li>)}</ul> : null },
        articleStep,
      ]
      return { title: '입법부', lineColor: 'border-emerald-200', intro: '입법부에서 내가 한 활동을 순서대로 정리했어요.', steps }
    }

    // ── 행정부 ─────────────────────────────────────────────
    if (tab === 'executive') {
      const presidentGroupId = bc.executive?.presidentGroupId
      const isPresident = (presidentGroupId && myGroupIds.has(presidentGroupId)) ||
        [...myGroupIds].some((gid) => groups[gid]?.name?.includes('대통령'))

      // 정책 예산 합계 헬퍼 (requestedBudget → budgetItems → budget map)
      const policyBudgetSum = (p) => {
        if (Number(p?.requestedBudget)) return Number(p.requestedBudget)
        const items = p?.budgetItems
        const arr = Array.isArray(items) ? items : Object.values(items || {})
        if (arr.length) return arr.reduce((s, it) => s + (Number(it?.amount) || Number(it?.total) || 0), 0)
        return Object.values(p?.budget || {}).reduce((a, n) => a + (Number(n) || 0), 0)
      }
      const policyOrdinance = (p) =>
        p?.policyFields?.ordinance || p?.ordinance || (typeof p?.decree === 'string' ? p.decree : '') || ''

      // ── 대통령실 ──
      if (isPresident) {
        const presDraft = branchDrafts?.['exe-president'] || {}
        const selectedPledge = presDraft.selectedPledge
        const directives = Object.values(presDraft.directives || {}).filter((d) => d?.text)
        const cabinetScript = presDraft.cabinetScript?.text || ''
        const myNote = presDraft.memberNotes?.[myStudentId]
        const mySections = Object.entries(presDraft.sections || {}).filter(([, s]) => s?.authorStudentId === myStudentId)
        const myPolicy = presidentGroupId ? policies?.[presidentGroupId] : null
        // 다른 부처 정책 중 검토·승인/반려한 것
        const reviewed = Object.entries(policies || {})
          .filter(([gid, p]) => gid !== presidentGroupId && (p?.status === 'final' || p?.status === 'rejected'))
          .map(([gid, p]) => ({ gid, ...p }))

        const steps = [
          { icon: '👑', label: '대통령실 배정', dot: 'bg-amber-400', done: true,
            body: <div className="text-sm"><strong>👑 대통령실</strong><span className="text-xs text-gray-500 ml-1">({groups[myGroupId]?.name || '우리 모둠'})</span></div> },
          { icon: '📜', label: '실현할 공약 선택', dot: 'bg-yellow-400', done: !!(selectedPledge?.text),
            body: selectedPledge?.text
              ? <div className="text-xs text-gray-700"><p className="font-bold text-amber-800">「{selectedPledge.text}」</p>
                  {selectedPledge.lawLink && <p className="mt-1"><b>이번 법령과의 연결:</b> {selectedPledge.lawLink}</p>}
                </div> : null },
          { icon: '📢', label: '부처별 업무지시', dot: 'bg-orange-400', done: directives.length > 0,
            body: directives.length > 0
              ? <ul className="text-xs text-gray-700 space-y-1">{directives.map((d, i) => <li key={i}><b>🏛️ {d.ministryName || '부처'}:</b> {d.text}</li>)}</ul> : null },
          { icon: '🗒️', label: '내 메모·자료 조사', dot: 'bg-amber-300', done: !!(myNote?.text),
            body: myNote?.text
              ? <div className="text-xs text-gray-700"><p className="whitespace-pre-wrap">{myNote.text}</p>
                  {(myNote.links || []).length > 0 && <ul className="mt-1 list-disc pl-4 text-blue-600">{myNote.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="underline break-all">{l.url}</a></li>)}</ul>}
                </div> : null },
          { icon: '📋', label: '우리 공약 시행령·예산', dot: 'bg-indigo-400', done: !!myPolicy || mySections.length > 0,
            body: (myPolicy || mySections.length > 0)
              ? <div className="space-y-2 text-xs text-gray-700">
                  {myPolicy && (
                    <div>
                      <p className="font-bold">{myPolicy.policyFields?.title || myPolicy.policyName || '공약 시행령'}
                        {policyBudgetSum(myPolicy) ? <span className="font-mono font-normal text-gray-400"> · {policyBudgetSum(myPolicy)}억</span> : null}</p>
                      {policyOrdinance(myPolicy) && <p className="whitespace-pre-wrap mt-0.5">{policyOrdinance(myPolicy)}</p>}
                    </div>
                  )}
                  {mySections.map(([k, s]) => {
                    const items = s?.content?.budgetItems || []
                    return <div key={k}><p className="font-bold text-indigo-700">{k} (내가 작성)</p>
                      <p className="whitespace-pre-wrap">{sectionText(s.content)}</p>
                      {items.length > 0 && <ul className="mt-0.5 list-disc pl-4">{items.map((it, i) => <li key={i}>{it.name || it.label || '항목'}: {it.amount ?? it.budget ?? 0}억</li>)}</ul>}
                    </div>
                  })}
                </div> : null },
          { icon: '🗣️', label: '국무회의 대본', dot: 'bg-rose-400', done: !!cabinetScript,
            body: cabinetScript ? <p className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{cabinetScript}</p> : null },
          { icon: '✅', label: '다른 부처 정책 승인·검토', dot: 'bg-emerald-400', done: reviewed.length > 0,
            body: reviewed.length > 0
              ? <ul className="text-xs text-gray-700 space-y-1">{reviewed.map((p) => (
                  <li key={p.gid}>
                    <b>{groups[p.gid]?.name || p.ministryName || p.policyFields?.title || '부처'}</b>
                    {' '}— {p.status === 'final' ? '✅ 승인(발표 확정)' : '🔴 반려'}
                    {p.status === 'rejected' && p.rejectReason && <span className="block text-gray-500">사유: {p.rejectReason}</span>}
                  </li>
                ))}</ul> : null },
          articleStep,
        ]
        return { title: '대통령실', lineColor: 'border-amber-300', intro: '대통령실에서 내가 한 활동을 순서대로 정리했어요.', steps }
      }

      // ── 일반 부처 ──
      const unit = (bc.executive?.units || []).find((u) => myGroupIds.has(u.groupId)) || null
      const draft = unit?.unitId ? branchDrafts?.[unit.unitId] : null
      const myNote = draft?.memberNotes?.[myStudentId]
      const mySections = Object.entries(draft?.sections || {}).filter(([, s]) => s?.authorStudentId === myStudentId)
      const myPolicies = Object.entries(policies || {}).filter(([gid]) => myGroupIds.has(gid)).map(([id, p]) => ({ id, ...p }))

      const steps = [
        { icon: '🏷️', label: '부처·역할 배정', dot: 'bg-slate-400', done: !!unit,
          body: unit ? <div className="text-sm"><strong>{unit.ministryName || '행정 부처'}</strong><span className="text-xs text-gray-500 ml-1">({groups[myGroupId]?.name || '우리 모둠'})</span></div> : null },
        { icon: '🗒️', label: '내 메모·자료 조사', dot: 'bg-amber-400', done: !!(myNote?.text),
          body: myNote?.text
            ? <div className="text-xs text-gray-700"><p className="whitespace-pre-wrap">{myNote.text}</p>
                {(myNote.links || []).length > 0 && <ul className="mt-1 list-disc pl-4 text-blue-600">{myNote.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="underline break-all">{l.url}</a></li>)}</ul>}
              </div> : null },
        { icon: '✍️', label: '내 시행령 초안·예산', dot: 'bg-indigo-400', done: mySections.length > 0,
          body: mySections.length > 0
            ? <div className="space-y-2 text-xs text-gray-700">{mySections.map(([k, s]) => {
                const items = s?.content?.budgetItems || []
                return <div key={k}><p className="font-bold text-indigo-700">{k}</p>
                  <p className="whitespace-pre-wrap">{sectionText(s.content)}</p>
                  {items.length > 0 && <ul className="mt-0.5 list-disc pl-4">{items.map((it, i) => <li key={i}>{it.name || it.label || '항목'}: {it.amount ?? it.budget ?? 0}억</li>)}</ul>}
                </div>
              })}</div> : null },
        { icon: '🏢', label: '우리 부처 정책 보고서', dot: 'bg-emerald-400', done: myPolicies.length > 0,
          body: myPolicies.length > 0
            ? <div className="space-y-2">{myPolicies.map((p) => {
                const status = p.status === 'final' ? '✅ 대통령 승인' : p.status === 'rejected' ? '🔴 반려' : p.status === 'adjusted' ? '⏳ 승인 대기' : ''
                return <div key={p.id} className="text-xs text-gray-700">
                  <p className="font-bold">{p.policyFields?.title || p.policyName || '정책'} {policyBudgetSum(p) ? <span className="font-mono font-normal text-gray-400">· {policyBudgetSum(p)}억</span> : null} {status && <span className="font-normal text-gray-400">· {status}</span>}</p>
                  {policyOrdinance(p) && <p className="whitespace-pre-wrap mt-0.5">{policyOrdinance(p)}</p>}
                  {p.impact && <p className="italic">"{p.impact}"</p>}
                </div>
              })}</div> : null },
        articleStep,
      ]
      return { title: '행정부', lineColor: 'border-sky-200', intro: '행정부에서 내가 한 활동을 순서대로 정리했어요.', steps }
    }

    return null
  }, [phase, tab, config, myStudentId, myGroupId, groups, judicialIssues, debateSessions, juryVotes, verdicts, branchDrafts, bills, billVotes, policies, myArticles])

  const groupTrust = useMemo(() => {
    const out = {}
    for (const gid of Object.keys(groups)) {
      const myPosters = Object.entries(posters)
        .filter(([, p]) => p?.groupId === gid)
        .map(([id]) => id)
      const my = Object.values(comments).filter(
        (c) => c?.targetType === 'poster' && myPosters.includes(c.targetId),
      )
      let n = 0, sum = 0
      for (const c of my) {
        if (!c?.ratings) continue
        n += 1
        sum += (Number(c.ratings.logic) || 0) +
               (Number(c.ratings.feasibility) || 0) +
               (Number(c.ratings.relevance) || 0)
      }
      out[gid] = { n, avg: n ? sum / n : 0 }
    }
    return out
  }, [groups, posters, comments])

  if (!phase) return null

  return (
    <section className="bg-white rounded-2xl border-2 border-emerald-300 shadow-sm p-4 space-y-3">
      <header className="flex items-baseline justify-between">
        <h3 className="font-bold text-emerald-800">
          📚 이번 여정에 일어난 일
        </h3>
        <span className="text-xs text-gray-500">
          여론조사 답변 전, 한 번 훑어 보세요
        </span>
      </header>

      {/* Phase 1 — 모둠별 포스터·신뢰도 */}
      {phase === 1 && (
        <ul className="grid sm:grid-cols-2 gap-2">
          {Object.entries(groups).map(([gid, g]) => {
            const t = groupTrust[gid]
            const topicMeta = config?.topics?.[g?.topic]
            const myPosters = Object.values(posters).filter((p) => p?.groupId === gid)
            return (
              <li
                key={gid}
                className={`p-3 rounded-xl border-2 ${topicBg(topicMeta?.color || g?.color)}`}
              >
                <div className="font-bold text-sm">{g.name || gid}</div>
                {g.slogan && (
                  <p className="text-xs italic text-gray-700 mt-0.5">"{g.slogan}"</p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  포스터 {myPosters.length}개 · 평가 {t?.n || 0}건 ·
                  평균 <strong>{t?.avg ? t.avg.toFixed(1) : '0'}</strong>
                </p>
                {(myPosters[0]?.imageUrl || myPosters[0]?.canvaUrl || myPosters[0]?.posterCanvaUrl) && (
                  <PosterMedia
                    poster={myPosters[0]}
                    className="mt-2 w-full aspect-[4/3] rounded-lg overflow-hidden"
                    imageClassName="w-full aspect-[4/3] object-cover rounded-lg"
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Phase 3 — 내가 이 부(府)에서 한 모든 활동 (세로 타임라인) */}
      {phase === 3 && branchActivity && (() => {
        const { title, lineColor, intro, steps } = branchActivity
        const anyDone = steps.some((s) => s.done)
        return (
          <div className="space-y-3">
            <p className="text-[11px] text-gray-600 -mt-1"><b>{title}</b> {intro}</p>

            <ol className={`relative ml-2 border-l-2 ${lineColor} space-y-4 py-1`}>
              {steps.map((s, i) => {
                const key = `${tab}-${i}`
                const isOpen = !!expanded[key]
                return (
                  <li key={i} className="relative pl-5">
                    <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white ${s.done ? s.dot : 'bg-gray-200'}`} />
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${s.done ? 'text-gray-800' : 'text-gray-300'}`}>
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                      {!s.done && <span className="text-[10px] font-normal text-gray-300">· 기록 없음</span>}
                    </div>
                    {s.done && s.body && (
                      <div className="mt-1.5 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                        <div className={isOpen ? '' : 'max-h-40 overflow-hidden relative'}>
                          {s.body}
                          {!isOpen && (
                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(key)}
                          className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {isOpen ? '접기 ▲' : '자세히 보기 ▼'}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>

            {!anyDone && (
              <p className="text-sm text-gray-400 text-center py-3">아직 기록된 내 활동이 없어요.</p>
            )}
          </div>
        )
      })()}
    </section>
  )
}

export default PhaseActivitySummary
