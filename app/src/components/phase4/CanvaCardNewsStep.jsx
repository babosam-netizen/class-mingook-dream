import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, getOnce } from '../../lib/rtdb-helpers'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'
import { getDebatePrepCardConfig } from '../debate/tools/DebatePrepCard'
import PosterMedia from '../phase1/PosterMedia'
import { calculateRanks } from '../../lib/election'
import { getStudentJudicialSide } from '../../lib/judicial-teams'

const JUD_SCRIPT_SPEAKERS = { judge: ['judge'], prosecution: ['prosecution', 'witness'], defense: ['defense', 'defendant'] }
const JUD_SPEAKER_LABEL   = { judge: '⚖️ 판사', prosecution: '👨‍💼 검사', defense: '🛡️ 변호인', witness: '👤 증인', defendant: '🙍 피고인' }

// 순수 헬퍼 함수 — 컴포넌트 밖에 두어 참조 안정
const sessionBranch = (s) => {
  if (!s) return null
  const sid = String(s.sourceStepId || '')
  if (s.type === 'trial' || s.relatedCaseId || sid.startsWith('judicial') || sid.startsWith('verdict')) return 'judicial'
  if (s.relatedExecutiveMeeting || s.type === 'multi_party' || sid.startsWith('executive')) return 'executive'
  if (s.relatedBillId || sid.startsWith('legislative')) return 'legislative'
  return null
}
const sectionKey = (phase, branch) => {
  if (phase !== 3 || !branch) return `p${phase}`
  return { legislative: 'p3-leg', executive: 'p3-exe', judicial: 'p3-jud' }[branch] || 'p3-leg'
}
const sectionPhase = (sec) => sec.startsWith('p3') ? 3 : Number(sec.replace('p', ''))

/**
 * 2단계: 캔바 카드뉴스 제작 + URL 제출
 * - 1단계에서 별점 준 상위 활동 3개 참고 목록 표시 (누르면 아코디언으로 본문/투표결과/미디어 전체 펼침)
 * - 캔바 링크 자료는 단순 링크 텍스트가 아닌 Canva Embed iframe으로 자동 렌더링
 * - 내가 작성한 동료 평가 댓글(원글 제목 노출 및 제목 클릭 시 내용 펼침) 수집 및 시각화 지원
 * - Canva 바로가기 버튼 + 제작 가이드
 * - URL/embed 제출 + 미리보기
 */
export default function CanvaCardNewsStep() {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups = useGameStore((s) => s.groups)
  const candidatesMap = useGameStore((s) => s.candidates) || {}

  const myGroupId = useMemo(() => {
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const [ratings,         setRatings]         = useState({})
  const [essays,          setEssays]          = useState({})
  const [posters,         setPosters]         = useState({})
  const [candidates,      setCandidates]      = useState({})
  const [supports,        setSupports]        = useState({})
  const [articles,        setArticles]        = useState({})
  const [branchData,      setBranchData]      = useState({})  // branchUnits (legacy)
  const [branchDrafts,    setBranchDrafts]    = useState({})  // 역할별 초안
  const [billsMap,        setBillsMap]        = useState({})  // 정식 법안
  const [policiesMap,     setPoliciesMap]     = useState({})  // 행정 정책 완성본
  const [verdicts,        setVerdicts]        = useState({})  // 판결문
  const [config,          setConfig]          = useState({})  // branchConfig
  const [groupHistory,    setGroupHistory]    = useState({})  // 모둠 변경 이력
  const [links,           setLinks]           = useState({})
  const [polls,           setPolls]           = useState({})
  const [pollReasons,     setPollReasons]     = useState({})
  const [electionVotes,   setElectionVotes]   = useState({})
  const [billVotes,       setBillVotes]       = useState({})
  const [juryVotes,       setJuryVotes]       = useState({})
  const [debateSessions,  setDebateSessions]  = useState({})
  const [commentsMap,     setCommentsMap]     = useState({})
  const [reflectionsMap,  setReflectionsMap]  = useState({})
  const [petitions,       setPetitions]       = useState({})

  const [canvaInput, setCanvaInput] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [expandedKey, setExpandedKey] = useState(null)
  const [showEmbedGuide, setShowEmbedGuide] = useState(false)

  // 기존 저장값 및 전체 활동 리소스를 로드/구독
  useEffect(() => {
    if (!roomCode || !myStudentId) return
    getOnce(roomCode, `students/${myStudentId}`).then((d) => {
      if (d?.journeyRatings) setRatings(d.journeyRatings)
      if (d?.canvaCardNewsUrl) {
        setSavedUrl(d.canvaCardNewsUrl)
        setCanvaInput(d.canvaCardNewsUrl)
      }
    })
    const subs = [
      subscribe(roomCode, 'essays',            (d) => setEssays(d || {})),
      subscribe(roomCode, 'posters',           (d) => setPosters(d || {})),
      subscribe(roomCode, 'candidates',        (d) => setCandidates(d || {})),
      subscribe(roomCode, 'supportStatements', (d) => setSupports(d || {})),
      subscribe(roomCode, 'articles',          (d) => setArticles(d || {})),
      subscribe(roomCode, 'branchUnits',       (d) => setBranchData(d || {})),
      subscribe(roomCode, 'branchDrafts',      (d) => setBranchDrafts(d || {})),
      subscribe(roomCode, 'bills',             (d) => setBillsMap(d || {})),
      subscribe(roomCode, 'policies',          (d) => setPoliciesMap(d || {})),
      subscribe(roomCode, 'verdicts',          (d) => setVerdicts(d || {})),
      subscribe(roomCode, 'config',            (d) => setConfig(d || {})),
      subscribe(roomCode, 'groupHistory',      (d) => setGroupHistory(d || {})),
      subscribe(roomCode, 'links',             (d) => setLinks(d || {})),
      subscribe(roomCode, 'polls',             (d) => setPolls(d || {})),
      subscribe(roomCode, 'polls/reasons',     (d) => setPollReasons(d || {})),
      subscribe(roomCode, 'electionVotes',     (d) => setElectionVotes(d || {})),
      subscribe(roomCode, 'billVotes',         (d) => setBillVotes(d || {})),
      subscribe(roomCode, 'juryVotes',         (d) => setJuryVotes(d || {})),
      subscribe(roomCode, 'debateSessions',    (d) => setDebateSessions(d || {})),
      subscribe(roomCode, 'comments',          (d) => setCommentsMap(d || {})),
      subscribe(roomCode, 'reflections',       (d) => setReflectionsMap(d || {})),
      subscribe(roomCode, 'petitions',         (d) => setPetitions(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode, myStudentId])

  // ── MyJourneyTimeline과 동일한 groupOkAt 로직 ──
  const groupOkAt = useMemo(() => {
    const myTrans = Object.values(groupHistory?.[myStudentId] || {})
      .filter((h) => h && typeof h.cutoff === 'number' && (h.from || h.to))
      .sort((a, b) => a.cutoff - b.cutoff)
    const studentGroupAt = (rank) => {
      if (!myTrans.length) return null
      let g = myTrans[0].from
      for (const t of myTrans) { if (rank >= t.cutoff) g = t.to }
      return g
    }
    // myGroupIds fallback: 내가 속한 모둠 합집합
    const myGroupIds = new Set()
    Object.entries(groups || {}).forEach(([gid, g]) => { if (g?.members?.[myStudentId]) myGroupIds.add(gid) })
    Object.values(posters || {}).forEach((p) => { if (p?.authorStudentId === myStudentId && p.groupId) myGroupIds.add(p.groupId) })

    return (gid, rank) => {
      if (!gid) return false
      if (myTrans.length) return studentGroupAt(rank) === gid
      return myGroupIds.has(gid)
    }
  }, [groupHistory, myStudentId, groups, posters])

  // 전체 활동 수집 (MyJourneyTimeline 키 포맷과 일치)
  const activities = useMemo(() => {
    const acts = []

    // 1-1. 슬로건
    Object.entries(groups || {}).forEach(([gid, g]) => {
      const ss = g?.slogans || {}
      Object.entries(ss).forEach(([sid, s]) => {
        if (s?.authorStudentId === myStudentId) {
          acts.push({
            key: `phase1_slogan_${gid}_${sid}`,
            phase: 1,
            type: 'slogan',
            icon: '💬',
            shortTitle: '슬로건',
            stepLabel: '슬로건 제출',
            title: `시민광장 슬로건`,
            content: `내가 제출한 슬로건:\n"${s.text}"`
          })
        }
      })
    })

    // 1-1b. 국민청원 (MyJourneyTimeline: phase1_petition_${id})
    Object.entries(petitions || {}).forEach(([id, p]) => {
      if (p?.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_petition_${id}`, phase: 1,
        type: 'petition', icon: '📜', shortTitle: '국민청원',
        stepLabel: '국민청원 작성',
        title: p.title || '국민청원',
        content: p.body || p.content || '',
      })
    })

    // 1-2. 주장하는 글 (에세이)
    Object.entries(essays).forEach(([id, e]) => {
      if (e.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_essay_${id}`, phase: 1,
        type: 'essay',
        icon: '📝', shortTitle: '주장글',
        stepLabel: '나의 주장글(에세이) 작성',
        title: e.title || '주장하는 글',
        content: [
          e.claim ? `[주장] ${e.claim}` : '',
          e.evidence ? `[근거] ${e.evidence}` : '',
          e.impact ? `[해결 방안 및 기대 효과] ${e.impact}` : ''
        ].filter(Boolean).join('\n\n'),
      })
    })

    // 1-3. 포스터 — groupOkAt(gid, 10)으로 1여정 모둠 판정 (MyJourneyTimeline과 동일)
    Object.entries(posters).forEach(([id, p]) => {
      if (p.authorStudentId !== myStudentId && !groupOkAt(p.groupId, 10)) return
      const isMyUpload = p.authorStudentId === myStudentId
      acts.push({
        key: `phase1_poster_${id}`, phase: 1,
        type: 'poster',
        poster: p,
        icon: '🖼️', shortTitle: isMyUpload ? '내포스터' : '모둠포스터',
        stepLabel: isMyUpload ? '내 포스터 제작' : '모둠 포스터 제작',
        title: p.title || p.caption || (isMyUpload ? '내가 올린 포스터' : '우리 모둠 포스터'), 
        content: p.caption || p.description || '',
      })
    })

    // 1-4. 시민광장 설문조사 투표 → polls_group_p1 (MyJourneyTimeline과 동일)
    {
      const p1VoteBucket = []
      Object.entries(polls).forEach(([pid, p]) => {
        const isPhase1 = pid.startsWith('phase1') || (typeof p?.tag === 'string' && p.tag.includes('시민'))
        if (!isPhase1) return
        const v = p?.votes?.[myStudentId]
        if (!v) return
        const optIdx = parseInt(v.optionId?.replace('opt_', '') || '', 10)
        const opt = p.options?.[optIdx] || p.options?.[v.optionId]
        const label = typeof opt === 'string' ? opt : (opt?.label || opt?.id || v.optionId)
        const reason = pollReasons[pid]?.[myStudentId] || ''
        p1VoteBucket.push({ kind: 'poll', title: p.question || '시민광장 설문조사', myChoice: label, reason, total: Object.keys(p.votes || {}).length })
      })
      if (p1VoteBucket.length) {
        acts.push({
          key: 'polls_group_p1', phase: 1,
          type: 'polls_group', polls: p1VoteBucket,
          icon: '📊', shortTitle: '설문모음',
          stepLabel: '시민 여론조사 투표',
          title: `설문·투표 모음 (${p1VoteBucket.length}건)`,
          content: '',
        })
      }
    }

    // 2-1. 후보 등록 — MyJourneyTimeline과 동일: gid 포함 키 + groupOkAt(gid, 20)
    Object.entries(candidates).forEach(([gid, c]) => {
      const isMine = c?.leaderStudentId === myStudentId   // 내가 후보 당사자
      if (!isMine && !groupOkAt(gid, 20)) return           // 선거=2여정(랭크20)
      const candName = c.leaderNickname || c.candidateName
      acts.push({
        key: `phase2_candidate_${gid}`, phase: 2,
        type: 'candidate', candidate: c,
        icon: '🗳️',
        shortTitle: isMine ? '내 후보등록' : (candName ? `후보: ${candName}` : '모둠 후보'),
        stepLabel: isMine ? '내가 등록한 대통령 후보' : '우리 모둠 대통령 후보',
        title: isMine
          ? `내가 등록한 대통령 후보${candName ? ` (${candName})` : ''}`
          : (candName ? `우리 모둠 대통령 후보 (${candName})` : '우리 모둠 대통령 후보'),
        content: c.pamphlet ? `[출마선언문]\n${c.pamphlet}` : '대통령 후보 등록 완료',
      })
    })

    // 2-2. 지지 선언문
    Object.entries(supports).forEach(([id, s]) => {
      if (s.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase2_support_${id}`, phase: 2,
        type: 'support',
        icon: '📣', shortTitle: '지지선언',
        stepLabel: '대통령 후보 지지선언문',
        title: '대통령 후보 지지 선언문',
        content: s.content || s.statement || '',
      })
    })

    // 2-3. 선거 기사 — 제목: [선거기사] 헤드라인
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 2) return
      acts.push({
        key: `phase2_article_${id}`, phase: 2,
        type: 'article',
        icon: '📰', shortTitle: '선거기사',
        stepLabel: '선거 보도 기사 작성',
        title: a.headline ? `[선거기사] ${a.headline}` : (a.title || '선거 기사'),
        content: a.headline ? `[헤드라인] ${a.headline}\n\n${a.body}` : a.body || a.content || '',
      })
    })

    // 2-4. 대통령 선거 투표 → polls_group_p2 (MyJourneyTimeline과 동일)
    if (electionVotes[myStudentId]) {
      const votedGid = electionVotes[myStudentId]?.candidateGroupId
      const votedCand = votedGid ? candidates[votedGid] : null
      const votedName = votedCand ? (votedCand.leaderNickname || votedCand.candidateName || '후보') : null
      acts.push({
        key: 'polls_group_p2', phase: 2,
        type: 'polls_group',
        polls: [{ kind: 'election', title: '대통령 선거 투표', myChoice: votedName ? `${votedName} 후보` : '투표함', total: Object.keys(electionVotes || {}).length }],
        icon: '🗳️', shortTitle: '대선투표',
        stepLabel: '대통령 선거 투표',
        title: '대통령 선거 투표 참여',
        content: '',
      })
    }

    // 2-5. 공유 뉴스 기사 (type: news인 외부 링크)
    Object.entries(links).forEach(([id, l]) => {
      if (l.submitterStudentId !== myStudentId || l.type !== 'news') return
      acts.push({
        key: `phase2_news_${id}`, phase: 2,
        type: 'link',
        link: l,
        icon: '🔗', shortTitle: '뉴스공유',
        stepLabel: '선거 관련 뉴스 공유',
        title: l.title || '공유한 뉴스기사',
        content: l.summary ? `[요약]\n${l.summary}` : '',
      })
    })

    // ── 3여정: MyJourneyTimeline과 동일한 소스·키 사용 ──
    const bc = config?.branchConfig || {}
    const sectionText = (content) =>
      typeof content === 'object' ? (content?.policyFields?.text || content?.text || '') : (content || '')
    const budgetLines = (items) => {
      const arr = Array.isArray(items) ? items : Object.values(items || {})
      return arr.filter(Boolean).map((it) => `${it.name || it.label || '항목'}: ${it.amount ?? it.budget ?? 0}억`)
    }

    // 3-1. 입법부 — 내 조항 초안 (branchDrafts)
    ;(bc.legislative?.units || []).forEach((unit) => {
      if (!unit?.unitId || !groupOkAt(unit.groupId, 31)) return
      const draft = branchDrafts?.[unit.unitId]
      Object.entries(draft?.sections || {}).forEach(([sk, s]) => {
        if (s?.authorStudentId !== myStudentId) return
        const txt = sectionText(s.content)
        if (!txt.trim()) return
        acts.push({
          key: `phase3_legsec_${unit.unitId}_${sk}`, phase: 3,
          type: 'legdraft', icon: '✍️', shortTitle: '내 조항초안',
          stepLabel: '입법 — 내 조항(역할) 초안 작성',
          title: `내 입법 초안 · ${sk}`,
          content: txt,
        })
      })
    })
    // 3-1b. 우리 모둠 법안 (bills 노드)
    Object.entries(billsMap || {}).forEach(([bid, b]) => {
      if (!groupOkAt(b?.proposerGroupId, 31)) return
      const statusKo = b.status === 'passed' ? '✅ 통과' : '❌ 부결'
      acts.push({
        key: `phase3_bill_${bid}`, phase: 3,
        type: 'bill', icon: '🏛️', shortTitle: '모둠법안',
        stepLabel: '우리 모둠 법안',
        title: `${b.title || '법안'} (${statusKo})`,
        content: `${b.body || ''}${b.voteResult ? `\n\n[표결] 찬성 ${b.voteResult.yesCount ?? b.voteResult.yes} · 반대 ${b.voteResult.noCount ?? b.voteResult.no}` : ''}`,
      })
    })

    // 3-2. 행정부 — 내 시행령·예산 초안 + 부처 정책 완성본
    const exeUnits = [...(bc.executive?.units || [])]
    if (bc.executive?.presidentGroupId) exeUnits.push({ unitId: 'exe-president', groupId: bc.executive.presidentGroupId, ministryName: '대통령실' })
    exeUnits.forEach((unit) => {
      if (!unit?.unitId || !groupOkAt(unit.groupId, 32)) return
      const draft = branchDrafts?.[unit.unitId]
      Object.entries(draft?.sections || {}).forEach(([sk, s]) => {
        if (s?.authorStudentId !== myStudentId) return
        const txt = sectionText(s.content)
        const budget = budgetLines(s?.content?.budgetItems)
        if (!txt.trim() && budget.length === 0) return
        acts.push({
          key: `phase3_exesec_${unit.unitId}_${sk}`, phase: 3,
          type: 'exedraft', icon: '✍️', shortTitle: '내 시행령',
          stepLabel: '행정 — 내 시행령·예산(역할) 작성',
          title: `내 시행령·예산 · ${sk}`,
          content: `${txt}${budget.length ? `\n\n[예산]\n${budget.join('\n')}` : ''}`,
        })
      })
    })
    Object.entries(policiesMap || {}).forEach(([gid, p]) => {
      if (!groupOkAt(gid, 32)) return
      const arr = Array.isArray(p?.budgetItems) ? p.budgetItems : Object.values(p?.budgetItems || {})
      const sum = Number(p?.requestedBudget) || arr.reduce((s, it) => s + (Number(it?.amount) || Number(it?.total) || 0), 0)
      acts.push({
        key: `phase3_policy_${gid}`, phase: 3,
        type: 'policy', icon: '🏢', shortTitle: '모둠정책',
        stepLabel: '우리 부처 정책 완성본(시행령·예산)',
        title: `${p.policyFields?.title || p.policyName || '정책'}${sum ? ` · ${sum}억` : ''}`,
        content: `${p.policyFields?.ordinance || p.ordinance || p.impact || ''}`,
      })
    })

    // 3-3. 사법부 — 우리 모둠 판결문
    {
      const byGroup = {}
      for (const byCase of Object.values(verdicts || {})) {
        if (typeof byCase !== 'object') continue
        for (const v of Object.values(byCase)) {
          if (!v?.body) continue
          const g = v.judgeGroupId || v.groupId
          if (!g || !groupOkAt(g, 33)) continue
          if (!byGroup[g] || (v.createdAt || 0) > (byGroup[g].createdAt || 0)) byGroup[g] = v
        }
      }
      Object.entries(byGroup).forEach(([g, v]) => {
        acts.push({
          key: `phase3_verdict_${g}`, phase: 3,
          type: 'judicial', icon: '⚖️', shortTitle: '모둠판결문',
          stepLabel: '우리 모둠 판결문',
          title: `우리 모둠 판결 — ${v.decision === 'guilty' ? '유죄' : '무죄'}`,
          content: `${v.sentence ? `[선고] ${v.sentence}\n\n` : ''}${v.body || ''}`,
        })
      })
    }

    // 3-3b. 재판 전 대본 — 내 역할 대본
    {
      const jc = bc.judicial
      const activeCase = jc?.activeCase
      const side = getStudentJudicialSide(myStudentId, jc, groups)
      const allow = JUD_SCRIPT_SPEAKERS[side] || []
      const script = Array.isArray(activeCase?.trialScript) ? activeCase.trialScript : []
      const myLines = allow.length
        ? [...script].filter((l) => allow.includes(l?.speaker)).sort((a, b) => (a.order || 0) - (b.order || 0))
        : []
      if (myLines.length) {
        acts.push({
          key: 'phase3_jud_script', phase: 3,
          type: 'judscript', icon: '🎭', shortTitle: '재판 대본',
          stepLabel: '재판 전 — 내 역할 대본',
          title: `내 역할 대본 (${myLines.length}줄)`,
          content: myLines.map((l) => `[${JUD_SPEAKER_LABEL[l.speaker] || l.speaker}${l.scene ? ` · ${l.scene}` : ''}]\n${l.text || ''}`).join('\n\n'),
        })
      }
    }

    // 3-3c. 재판 중 연설 평가
    {
      const evalLines = []
      Object.values(debateSessions || {}).forEach((s) => {
        if (!s || s.type !== 'trial') return
        Object.values(s.speechEvals || {}).forEach((ev) => {
          const r = ev?.results?.[myStudentId]
          if (!r) return
          const tgt = ev.targetName || ev.speakerName || ev.label || ev.title || ev.targetSpeaker || '연설'
          const scoreStr = r.scores && typeof r.scores === 'object'
            ? Object.values(r.scores).map((x) => `★${x}`).join(' ') : ''
          evalLines.push(`• ${tgt}: ${scoreStr}${r.comment ? `\n  "${r.comment}"` : ''}`)
        })
      })
      if (evalLines.length) {
        acts.push({
          key: 'phase3_jud_speecheval', phase: 3,
          type: 'speecheval', icon: '📋', shortTitle: '재판 중 평가',
          stepLabel: '재판 중 — 내가 한 연설 평가',
          title: `재판 중 연설 평가 (${evalLines.length}건)`,
          content: evalLines.join('\n\n'),
        })
      }
    }

    // 3-4. 국정 기사
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 3) return
      acts.push({
        key: `phase3_article_${id}`, phase: 3,
        type: 'article',
        icon: '📰', shortTitle: '국정기사',
        stepLabel: '국정 기사 보도',
        title: a.headline || a.title || '국정 기사',
        content: a.headline ? `[헤드라인] ${a.headline}\n\n${a.body}` : a.body || a.content || '',
      })
    })

    // 3-7. 공유 영상/캔바 링크 (type이 news가 아닌 외부 링크)
    Object.entries(links).forEach(([id, l]) => {
      if (l.submitterStudentId !== myStudentId || l.type === 'news') return
      acts.push({
        key: `phase3_video_${id}`, phase: 3,
        type: 'link',
        link: l,
        icon: '🎬', shortTitle: '영상공유',
        stepLabel: '영상/캔바 자료 공유',
        title: l.title || '공유한 영상/캔바',
        content: '',
      })
    })

    // ── 3-8. 토론 여론조사 및 토론 활동 ──
    // 투표/설문은 섹션별로 묶어서 단일 키(polls_group_${sec})로 표현 — MyJourneyTimeline과 동일
    const voteBuckets = {}
    const pushVote = (sec, item) => { (voteBuckets[sec] = voteBuckets[sec] || []).push(item) }

    // 법안 투표 — 내 모둠 법안만 (proposerGroupId 체크)
    Object.entries(billVotes).forEach(([bid, votes]) => {
      const mv = votes && votes[myStudentId]
      if (!mv) return
      const b = billsMap?.[bid]
      if (!b || !groupOkAt(b.proposerGroupId, 31)) return  // 다른 모둠 법안 제외
      pushVote('p3-leg', {
        kind: 'billvote',
        title: `법안 표결: ${b.title || '법안'}`,
        myChoice: mv === 'pro' ? '✅ 찬성' : mv === 'con' ? '❌ 반대' : '⚪ 기권',
        total: Object.keys(votes).length,
      })
    })

    // 배심원 재판 투표
    Object.entries(juryVotes).forEach(([cid, votes]) => {
      const mv = votes && votes[myStudentId]
      if (!mv) return
      pushVote('p3-jud', {
        kind: 'juryvote',
        title: '배심원 평결',
        myChoice: mv === 'pro' ? '⚖️ 유죄' : mv === 'con' ? '🕊️ 무죄' : String(mv),
        total: Object.keys(votes).length,
      })
    })

    // 토론 여론조사 + 토론 준비 카드 + 최종 평가
    Object.entries(debateSessions).forEach(([sid, s]) => {
      const preVote = s.stancePoll?.pre?.votes?.[myStudentId]
      const postVote = s.stancePoll?.post?.votes?.[myStudentId]
      const phase = Number(s.phase) || 3
      const sec = sectionKey(phase, sessionBranch(s))

      if (preVote || postVote) {
        pushVote(sec, {
          kind: 'debate_poll',
          title: s.title || '토론 여론조사',
          myChoice: postVote || preVote,
          total: Object.keys(s.stancePoll?.post?.votes || s.stancePoll?.pre?.votes || {}).length,
        })
      }

      // 토론 준비 카드 (개별 키 유지 — 명확히 "내 것")
      const cardsObj = s.prepCards || {}
      Object.entries(cardsObj).forEach(([cid, card]) => {
        if (card.studentId === myStudentId) {
          acts.push({
            key: `debate_prep_${sid}_${card.studentId}`,
            phase, type: 'debate_prep',
            icon: '📇', shortTitle: '토론전카드',
            stepLabel: '토론 준비 카드 작성',
            title: `토론 준비 카드 (${s.title || '토론'})`,
            debateCard: card, debateSession: s,
            content: `[입장] ${card.stance || '미정'}\n\n[주장/판단] ${card.mainClaim || ''}\n\n[근거] ${card.evidence || ''}\n\n[반박] ${card.rebuttal || ''}\n\n[대응] ${card.counterRebuttal || ''}`
          })
        }
      })

      // 평가단 최종 종합 평가 (개별 키 유지)
      const myEval = s.finalEvaluations?.[myStudentId]
      if (myEval) {
        acts.push({
          key: `debate_final_eval_${sid}_${myStudentId}`,
          phase, type: 'debate_final_eval',
          icon: '⚖️', shortTitle: '최종평가',
          stepLabel: '평가단 최종 종합 평가 제출',
          title: `평가단 최종 종합 평가 (${s.title || '토론'})`,
          content: typeof myEval === 'string' ? myEval : myEval.content || myEval.comment || '',
        })
      }
    })

    // 투표 그룹 노드 삽입
    Object.entries(voteBuckets).forEach(([sec, items]) => {
      if (!items.length) return
      acts.push({
        key: `polls_group_${sec}`, phase: sectionPhase(sec), section: sec,
        type: 'polls_group', polls: items,
        icon: '📊', shortTitle: '설문모음',
        stepLabel: '투표·설문 참여 모음',
        title: `설문·투표 모음 (${items.length}건)`,
        content: '',
      })
    })

    // ── 4. 내가 작성한 댓글 및 동료 평가 — 섹션별 그룹 키 (MyJourneyTimeline과 동일) ──
    const commentBuckets = {}
    const pushComment = (sec, item) => { (commentBuckets[sec] = commentBuckets[sec] || []).push(item) }

    Object.entries(commentsMap).forEach(([cid, c]) => {
      if (c.authorStudentId !== myStudentId || c.parentId) return
      let targetTitle = '원글 자료'
      let targetBody = ''
      let phase = 1
      let branch = null

      if (c.targetType === 'poster') {
        const p = posters[c.targetId]
        targetTitle = p ? `🖼️ 포스터: "${p.title || p.caption || '제목 없음'}"` : '🖼️ 친구의 포스터'
        targetBody = p?.caption || p?.description || ''
        phase = p?.phase || 1
      } else if (c.targetType === 'article') {
        const a = articles[c.targetId]
        targetTitle = a ? `📰 기사: "${a.headline || a.title || '제목 없음'}"` : '📰 친구의 기사'
        targetBody = a?.body || ''
        phase = Number(a?.phase) || 2
        branch = a?.target || null
      } else if (c.targetType === 'bill') {
        const b = billsMap?.[c.targetId]
        targetTitle = b?.title ? `🏛️ 법안: "${b.title}"` : '🏛️ 의회 법안'
        targetBody = b?.body || ''
        phase = 3; branch = 'legislative'
      } else if (c.targetType === 'trial') {
        targetTitle = '⚖️ 사법 재판'
        phase = 3; branch = 'judicial'
      } else if (c.targetType === 'policy') {
        const pol = policiesMap?.[c.targetId]
        const pname = pol?.policyFields?.title || pol?.policyName
        targetTitle = pname ? `🏢 행정 정책: "${pname}"` : '🏢 행정 정책'
        targetBody = pol?.policyFields?.ordinance || pol?.ordinance || ''
        phase = 3; branch = 'executive'
      } else if (c.targetType === 'reflection') {
        const r = reflectionsMap[c.targetId]
        targetTitle = r ? `📝 정리글: "${r.title || '친구의 글'}"` : '📝 친구의 정리글'
        targetBody = r?.finalEssay || r?.body || ''
        phase = 4
      }

      pushComment(sectionKey(phase, branch), {
        targetTitle, targetBody,
        body: c.body,
        ratings: c.ratings || {},
        targetType: c.targetType,
      })
    })

    Object.entries(commentBuckets).forEach(([sec, items]) => {
      if (!items.length) return
      acts.push({
        key: `comments_group_${sec}`, phase: sectionPhase(sec), section: sec,
        type: 'comments_group', comments: items,
        icon: '💬', shortTitle: '댓글모음',
        stepLabel: '동료 평가·댓글 모음',
        title: `댓글 모음 (${items.length}건)`,
        content: '',
      })
    })

    // 여정별 단계 번호 및 전역 발자취 번호 동적 부여
    const phaseCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const processedActs = acts.map((act, idx) => {
      phaseCounts[act.phase]++
      return {
        ...act,
        phaseStep: phaseCounts[act.phase],
        globalStep: idx + 1
      }
    })

    return processedActs
  }, [essays, posters, petitions, candidates, supports, articles, branchData, branchDrafts, billsMap, policiesMap, verdicts, config, groupHistory, links, polls, pollReasons, electionVotes, billVotes, juryVotes, debateSessions, commentsMap, reflectionsMap, myStudentId, myGroupId, groups, groupOkAt])

  // 별점 준 활동 전체 — 별점 높은 순으로 정렬(개수 제한 없음, 스크롤로 표시)
  const topActivities = useMemo(() => {
    const scored = activities.filter((act) => (ratings[act.key] || 0) > 0)
    return scored
      .map((act) => ({
        ...act,
        score: ratings[act.key],
      }))
      .sort((a, b) => b.score - a.score)
  }, [activities, ratings])

  const handleSave = async () => {
    setError('')
    const url = formatCanvaEmbedUrl(canvaInput.trim())
    if (!url) { setError('Canva URL 또는 embed 코드를 입력해 주세요.'); return }
    setSaving(true)
    try {
      await updateAt(roomCode, `students/${myStudentId}`, { canvaCardNewsUrl: url })
      setSavedUrl(url)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleExpand = (key) => {
    setExpandedKey(prev => prev === key ? null : key)
  }

  return (
    <div className="space-y-5">
      {/* 안내 헤더 */}
      <div className="bg-gradient-to-r from-violet-50 to-pink-50 rounded-2xl p-4 border border-violet-200 shadow-xs">
        <h2 className="font-black text-violet-800 text-lg mb-1">🎨 캔바 카드뉴스 제작</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          1단계에서 별점 준 활동들을 중심으로 Canva에서 카드뉴스를 만들어요.
          나의 여정을 멋진 카드뉴스로 정리해 보세요!
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 왼쪽: 참고 활동 (아코디언 구조) */}
        <div className="space-y-4">
          {topActivities.length > 0 && (
            <div className="bg-yellow-50/70 border border-yellow-200 rounded-2xl p-4 space-y-3">
              <div className="border-b border-yellow-250 pb-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-black text-yellow-800 text-sm">⭐ 내가 높이 평가한 활동들 <span className="text-[10px] font-bold text-yellow-600">({topActivities.length}개 · 별점순)</span></h3>
                  <a
                    href={`${window.location.origin}${window.location.pathname}#/journey`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold hover:bg-amber-200 transition shrink-0"
                  >
                    📅 발자취 보기 ↗
                  </a>
                </div>
                <p className="text-[10px] text-gray-500">별점 높은 순으로 모두 표시됩니다. 제목을 누르면 내용이 펼쳐져요. 스크롤하며 참고하세요!</p>
              </div>

              <style>{`.canva-act-scroll::-webkit-scrollbar{width:6px}.canva-act-scroll::-webkit-scrollbar-track{background:#fefce8;border-radius:9px}.canva-act-scroll::-webkit-scrollbar-thumb{background:#fcd34d;border-radius:9px}`}</style>
              <div className="canva-act-scroll space-y-2 max-h-[360px] overflow-y-scroll pr-1" style={{scrollbarWidth:'thin',scrollbarColor:'#fcd34d #fefce8'}}>
                {topActivities.map((act) => {
                  const isExpanded = expandedKey === act.key
                  return (
                    <div key={act.key} className="border border-yellow-200 rounded-xl overflow-hidden bg-white/90 shadow-2xs transition-all">
                      {/* 아코디언 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(act.key)}
                        className="w-full text-left px-4 py-3 font-semibold text-gray-800 hover:bg-yellow-50/50 transition flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-amber-500 text-xs shrink-0 select-none">
                            {'★'.repeat(act.score)}
                          </span>
                          <span className="text-[9px] font-black shrink-0 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/50">
                            발자취 {act.globalStep}
                          </span>
                          <span className="text-xs font-black truncate">{act.title}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 font-black">
                          {isExpanded ? '접기 ▴' : '펼치기 ▾'}
                        </span>
                      </button>

                      {/* 아코디언 내용부 */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2.5 border-t border-yellow-100 bg-amber-50/15 space-y-3 animate-in fade-in duration-200 text-xs text-gray-700">
                          
                          {/* 1. 포스터 렌더링 */}
                          {act.type === 'poster' && act.poster && (
                            <div className="rounded-xl overflow-hidden shadow-xs border bg-white aspect-[4/3] relative max-w-sm">
                              <PosterMedia 
                                poster={act.poster} 
                                className="w-full h-full"
                              />
                            </div>
                          )}

                          {/* 2. 링크 (영상/캔바) - 캔바 링크는 무조건 임베드 렌더링, 링크 주소 노출 없음 */}
                          {act.type === 'link' && act.link && (() => {
                            const l = act.link
                            const isCanva = l.url && l.url.toLowerCase().includes('canva.')
                            return (
                              <div className="space-y-2">
                                {isCanva ? (
                                  <div className="rounded-xl overflow-hidden border shadow-xs bg-slate-50 aspect-[4/3] relative max-w-sm">
                                    <iframe
                                      src={formatCanvaEmbedUrl(l.url)}
                                      loading="lazy"
                                      allowFullScreen
                                      allow="fullscreen; autoplay"
                                      className="absolute inset-0 w-full h-full border-0"
                                      title="카드뉴스 캔바 임베드"
                                    />
                                  </div>
                                ) : (
                                  <div className="bg-white/90 p-3 rounded-lg border text-xs shadow-2xs">
                                    <span className="font-bold text-indigo-700">🔗 외부 자료 링크: </span>
                                    <a href={l.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                                      {l.url} ↗
                                    </a>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* 3. 후보등록 상세 */}
                          {act.type === 'candidate' && act.candidate && (() => {
                            const c = act.candidate
                            return (
                              <div className="space-y-3 max-w-sm">
                                <div className="bg-white p-3 rounded-xl border border-rose-100 flex items-center justify-between">
                                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px]">
                                    기호 {c.candidateNumber ?? c.leaderNumber ?? '?'}번
                                  </span>
                                  <h4 className="font-black text-gray-800 text-xs">👑 {c.leaderNickname || c.candidateName} 후보</h4>
                                </div>
                                {c.pamphlet && <p className="italic text-gray-600 bg-white p-3 rounded-xl border border-gray-150">"{c.pamphlet}"</p>}
                                {c.posterCanvaUrl && (
                                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden border bg-slate-50 shadow-2xs">
                                    <iframe src={formatCanvaEmbedUrl(c.posterCanvaUrl)} className="absolute inset-0 w-full h-full border-0" title="선거 포스터" />
                                  </div>
                                )}
                                {c.canvaUrl && (
                                  <div className="relative aspect-[16/9] rounded-xl overflow-hidden border bg-slate-50 shadow-2xs">
                                    <iframe src={formatCanvaEmbedUrl(c.canvaUrl)} className="absolute inset-0 w-full h-full border-0" title="공약 카드뉴스" />
                                  </div>
                                )}
                                {c.videoCanvaUrl && (
                                  <div className="relative aspect-video rounded-xl overflow-hidden border bg-slate-900 shadow-2xs">
                                    <iframe src={formatCanvaEmbedUrl(c.videoCanvaUrl)} className="absolute inset-0 w-full h-full border-0" title="홍보영상" />
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {/* 4. 일반 설문조사 결과 그래프 */}
                          {act.type === 'poll' && act.rawPoll && (() => {
                            const p = act.rawPoll
                            const votes = p.votes || {}
                            const totalVotes = Object.keys(votes).length
                            const normalizedOptions = (p.options || []).map((opt, index) => {
                              if (typeof opt === 'string') return { id: `opt_${index}`, label: opt }
                              return { id: opt.id || `opt_${index}`, label: opt.label || opt.id || '' }
                            })
                            const counts = {}
                            Object.values(votes).forEach((v) => {
                              if (v?.optionId) counts[v.optionId] = (counts[v.optionId] || 0) + 1
                            })
                            const myVoteId = votes[myStudentId]?.optionId

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-2 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">📊 여론조사 집계 (총 {totalVotes}명)</p>
                                <div className="space-y-2">
                                  {normalizedOptions.map((o) => {
                                    const cnt = counts[o.id] || 0
                                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                                    const isMine = myVoteId === o.id
                                    return (
                                      <div key={o.id} className={`p-2 rounded-lg border text-[10px] ${isMine ? 'bg-indigo-50/70 border-indigo-300 font-bold' : 'bg-gray-50/40'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                          <span>{isMine && '✨ '}{o.label}</span>
                                          <span className="font-mono text-gray-500">{cnt}표 ({pct}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div className={`h-full ${isMine ? 'bg-indigo-500' : 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 5. 토론 사전/사후 비교 결과 그래프 */}
                          {act.type === 'debate_poll' && act.debateSession && (() => {
                            const s = act.debateSession
                            const prePoll = s.stancePoll?.pre || {}
                            const postPoll = s.stancePoll?.post || {}
                            const options = ['찬성', '반대', '중립']
                            const preVotes = prePoll.votes || {}
                            const postVotes = postPoll.votes || {}
                            const preTotal = Object.keys(preVotes).length
                            const postTotal = Object.keys(postVotes).length
                            const preCounts = { '찬성': 0, '반대': 0, '중립': 0 }
                            const postCounts = { '찬성': 0, '반대': 0, '중립': 0 }

                            Object.values(preVotes).forEach(v => { if (v?.option && preCounts[v.option] !== undefined) preCounts[v.option]++ })
                            Object.values(postVotes).forEach(v => { if (v?.option && postCounts[v.option] !== undefined) postCounts[v.option]++ })

                            const myPre = preVotes[myStudentId]?.option
                            const myPost = postVotes[myStudentId]?.option

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-3 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">🗳️ 토론 전/후 내 선택 변화</p>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div>
                                    <p className="font-bold mb-1 text-gray-500">토론 전 (총 {preTotal}명)</p>
                                    {options.map(o => {
                                      const cnt = preCounts[o] || 0
                                      const pct = preTotal ? Math.round((cnt / preTotal) * 100) : 0
                                      const isMine = myPre === o
                                      return (
                                        <div key={o} className={`p-1.5 rounded border mb-1 ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                          <div className="flex justify-between">{o} <span>{pct}%</span></div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div>
                                    <p className="font-bold mb-1 text-gray-500">토론 후 (총 {postTotal}명)</p>
                                    {options.map(o => {
                                      const cnt = postCounts[o] || 0
                                      const pct = postTotal ? Math.round((cnt / postTotal) * 100) : 0
                                      const isMine = myPost === o
                                      return (
                                        <div key={o} className={`p-1.5 rounded border mb-1 ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                          <div className="flex justify-between">{o} <span>{pct}%</span></div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* 6. 대통령 선거 득표 그래프 */}
                          {act.type === 'election' && act.rawVotes && (() => {
                            const votes = act.rawVotes
                            const totalVotes = Object.keys(votes).length
                            const ranks = calculateRanks(candidatesMap || {}, votes)
                            const myVoteGroupId = votes[myStudentId]?.candidateGroupId

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-2 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">🏆 선거 개표 현황 (총 {totalVotes}표)</p>
                                <div className="space-y-1.5">
                                  {ranks.map((r) => {
                                    const pct = totalVotes ? Math.round((r.count / totalVotes) * 100) : 0
                                    const isMine = myVoteGroupId === r.groupId
                                    return (
                                      <div key={r.groupId} className={`p-2 rounded-lg border text-[10px] ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                        <div className="flex justify-between mb-1">
                                          <span>{r.candidateNumber}번 {r.leaderNickname} 후보</span>
                                          <span className="font-mono text-gray-500">{pct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-200 rounded-full">
                                          <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 7. 법안 투표 그래프 */}
                          {act.type === 'billvote' && act.rawVotes && (() => {
                            const votes = act.rawVotes
                            const myChoice = votes[myStudentId]
                            const totalVotes = Object.keys(votes).length
                            const counts = { pro: 0, con: 0, abstain: 0 }
                            Object.values(votes).forEach(v => { if (counts[v] !== undefined) counts[v]++ })
                            const opts = [
                              { id: 'pro', label: '찬성', color: 'bg-emerald-500' },
                              { id: 'con', label: '반대', color: 'bg-rose-500' },
                              { id: 'abstain', label: '기권', color: 'bg-gray-400' }
                            ]

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-2 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">🏛️ 의회 법안 투표 결과 (총 {totalVotes}표)</p>
                                <div className="space-y-1.5">
                                  {opts.map((o) => {
                                    const cnt = counts[o.id] || 0
                                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                                    const isMine = myChoice === o.id
                                    return (
                                      <div key={o.id} className={`p-2 rounded-lg border text-[10px] ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                        <div className="flex justify-between mb-1">
                                          <span>{o.label}</span>
                                          <span className="font-mono text-gray-500">{pct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-200 rounded-full">
                                          <div className={`h-full ${o.color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 8. 배심원 재판 투표 그래프 */}
                          {act.type === 'juryvote' && act.rawVotes && (() => {
                            const votes = act.rawVotes
                            const myChoice = votes[myStudentId]
                            const totalVotes = Object.keys(votes).length
                            const counts = { pro: 0, con: 0 }
                            Object.values(votes).forEach(v => { if (counts[v] !== undefined) counts[v]++ })
                            const opts = [
                              { id: 'pro', label: '유죄', color: 'bg-amber-500' },
                              { id: 'con', label: '무죄', color: 'bg-sky-500' }
                            ]

                            return (
                              <div className="bg-white border p-3 rounded-xl space-y-2 max-w-sm">
                                <p className="text-[10px] text-gray-500 font-bold border-b pb-1">⚖️ 배심원 판결 결과 (총 {totalVotes}표)</p>
                                <div className="space-y-1.5">
                                  {opts.map((o) => {
                                    const cnt = counts[o.id] || 0
                                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                                    const isMine = myChoice === o.id
                                    return (
                                      <div key={o.id} className={`p-2 rounded-lg border text-[10px] ${isMine ? 'bg-indigo-50 border-indigo-300 font-bold' : ''}`}>
                                        <div className="flex justify-between mb-1">
                                          <span>{o.label}</span>
                                          <span className="font-mono text-gray-500">{pct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-200 rounded-full">
                                          <div className={`h-full ${o.color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 9. 내가 작성한 댓글 및 동료 평가 상세 피드 */}
                          {act.type === 'comment' && (
                            <div className="space-y-2.5 max-w-sm">
                              {/* 1. 작성한 댓글 내용 (가장 위) */}
                              <div className="p-3 bg-white rounded-xl border leading-relaxed text-xs shadow-2xs">
                                <span className="font-bold text-indigo-700 block mb-1">✍️ 내가 작성한 댓글</span>
                                <p className="font-semibold text-gray-800">"${act.commentBody}"</p>
                              </div>

                              {/* 2. 원글보기 (작은 라벨 + 원글 제목) */}
                              <div className="bg-white p-3 rounded-xl border shadow-2xs">
                                <span className="text-[9px] font-bold text-gray-400 block mb-1">🔍 원글보기</span>
                                <p className="font-extrabold text-indigo-900 text-xs">${act.targetTitle}</p>
                              </div>
                              
                              {/* 3. 3축 평가 점수 */}
                              {act.ratings && Object.keys(act.ratings).length > 0 && (
                                <div className="bg-white p-3 rounded-xl border shadow-2xs space-y-1.5">
                                  <p className="text-[9px] font-bold text-gray-400 block">📊 내가 매긴 3축 평가 점수</p>
                                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                                    {Object.entries(act.ratings).map(([axis, val]) => {
                                      const labelMap = { relevance: '공익/정확', feasibility: '실행/배려', logic: '타당/설득' }
                                      return (
                                        <div key={axis} className="bg-slate-50 border rounded-lg p-1.5">
                                          <span className="block text-[8px] text-gray-400 font-bold mb-0.5">{labelMap[axis] || axis}</span>
                                          <span className="font-mono text-amber-550 font-black">★ {val}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 9-1. 토론 준비 카드 */}
                          {act.type === 'debate_prep' && act.debateCard && (() => {
                            const card = act.debateCard
                            const s = act.debateSession
                            const config = getDebatePrepCardConfig(s)
                            const fields = config?.fields || {}
                            return (
                              <div className="space-y-2 max-w-sm">
                                <div className="bg-white border rounded-xl p-3 shadow-2xs flex flex-col gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-block px-2 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-black uppercase">
                                      입장: {card.stance || '미정'}
                                    </span>
                                  </div>
                                  {Object.entries(fields).map(([key, f]) => {
                                    const val = card[key]
                                    if (!val) return null
                                    return (
                                      <div key={key} className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                                        <span className="block text-[8px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">💡 {f.label}</span>
                                        <p className="text-[10px] text-gray-700 leading-relaxed whitespace-pre-wrap">{val}</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {/* 9-2. 평가단 최종 종합 평가 */}
                          {act.type === 'debate_final_eval' && (
                            <div className="bg-white border rounded-xl p-3 shadow-2xs space-y-2 max-w-sm">
                              <span className="text-[9px] font-bold text-gray-400 block border-b pb-0.5">⚖️ 평가단 최종 종합 평가</span>
                              <p className="text-[10px] text-gray-750 leading-relaxed whitespace-pre-wrap">
                                {act.content}
                              </p>
                            </div>
                          )}

                          {/* 10. 본문 텍스트 콘텐츠 */}
                          {act.content && act.type !== 'comment' && act.type !== 'debate_prep' && act.type !== 'debate_final_eval' && (
                            <div className="p-3 bg-white rounded-xl border leading-relaxed text-xs whitespace-pre-wrap shadow-2xs">
                              {act.content}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {topActivities.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-sm text-gray-500 text-center shadow-inner">
              1단계에서 별점을 주면 여기에 활동이 표시돼요.
            </div>
          )}


        </div>

                {/* 오른쪽: URL 제출 + 미리보기 */}
        <div className="space-y-3">
          {/* 캔바 바로가기 + 제작 가이드 */}
          <div className="bg-white border border-violet-100 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="font-black text-violet-800 text-sm">📋 카드뉴스 제작 가이드</h3>
            <ol className="text-xs text-gray-700 space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-black text-[10px] flex items-center justify-center">1</span>
                <span>캔바 열기 → <strong>만들기</strong> → 검색창에 <strong>"카드뉴스"</strong> 입력 후 원하는 형식 선택</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-black text-[10px] flex items-center justify-center">2</span>
                <span>마음에 드는 <strong>템플릿</strong> 고르기</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-black text-[10px] flex items-center justify-center">3</span>
                <span><strong>표지</strong> 만들기 — 제목(나의 여정 이야기 등)과 작성자 이름</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-black text-[10px] flex items-center justify-center">4</span>
                <span><strong>슬라이드 2~4</strong>: 1·2·3여정 각 하이라이트 한 장씩 — 왼쪽 별점 높은 활동 결과물 소개와 활동 설명</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-black text-[10px] flex items-center justify-center">5</span>
                <span><strong>마지막 슬라이드</strong>: 나의 다짐이나 소감 정리</span>
              </li>
            </ol>
            <a
              href="https://www.canva.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-bold text-sm hover:opacity-90 transition shadow-sm cursor-pointer"
            >
              🎨 Canva 열기
            </a>
          </div>
          <div className="bg-white border border-violet-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="border-b border-violet-100 pb-2.5">
              <button
                type="button"
                onClick={() => setShowEmbedGuide(!showEmbedGuide)}
                className="w-full text-left flex items-center justify-between hover:bg-violet-50/50 p-2 rounded-xl transition cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <h3 className="font-black text-violet-850 text-sm flex items-center gap-1.5">
                    <span>📎</span> 캔바 임베드 코드 제출
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5 font-bold leading-relaxed">
                    갤러리워크에서 카드뉴스가 바로 보이게 제출하기
                  </p>
                </div>
                <span className="text-[10px] text-violet-600 font-bold shrink-0 bg-violet-50 border border-violet-200/50 px-2.5 py-1 rounded-full shadow-2xs">
                  {showEmbedGuide ? '안내 접기 ▴' : '방법 보기 ▾'}
                </span>
              </button>
            </div>

            {/* 임베드 코드 복사 방법 가이드 (접기/펼치기) */}
            {showEmbedGuide && (
              <div className="bg-violet-50/50 rounded-xl p-3.5 border border-violet-100 text-xs space-y-2.5 text-violet-950 font-medium animate-in fade-in duration-200">
                <p className="font-bold text-violet-850 text-[11px] flex items-center gap-1">
                  <span>💡</span> 캔바에서 임베드 코드 복사하는 방법:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-gray-700 pl-0.5">
                  <li>Canva 편집 화면 우측 상단의 <strong className="text-violet-850">우측 [공유]</strong> 버튼을 누릅니다.</li>
                  <li>아래 메뉴 중 <strong className="text-violet-850">[더 보기](점 3개 •••)</strong>를 누릅니다.</li>
                  <li>목록에서 <strong className="text-violet-850">[임베디드]</strong> 아이콘( <code className="bg-violet-100 text-violet-800 px-1 py-0.2 rounded font-mono font-bold text-[9px]">&lt;/&gt;</code> 모양 )을 선택합니다.</li>
                  <li>활성화 후, <strong className="text-violet-850">‘HTML 임베디드 코드’</strong>의 <strong className="text-violet-900">[복사]</strong>를 누릅니다.</li>
                </ol>
                <div className="text-[10px] bg-amber-50/70 text-amber-800 border border-amber-200/50 p-2.5 rounded-lg leading-relaxed mt-1 flex items-start gap-1 font-semibold">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>
                    브라우저 주소창의 링크(canva.com/design/...)나 일반 [링크 복사] 주소는 갤러리에서 정상 동작하지 않을 수 있으니 꼭 <strong>임베디드 코드</strong>를 붙여넣어 주세요!
                  </span>
                </div>
              </div>
            )}

                        <div className="space-y-1.5">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">✍️ 임베디드 코드 입력</span>
              <textarea
                value={canvaInput}
                onChange={(e) => setCanvaInput(e.target.value)}
                rows={4}
                placeholder="<iframe ...> 로 시작하는 Canva 임베디드 코드를 통째로 붙여넣어 주세요."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none shadow-inner bg-slate-50/50 leading-relaxed font-mono"
              />
            </div>

            {error && <p className="text-xs text-red-650 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}
            {saved && <p className="text-xs text-emerald-600 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">✓ 성공적으로 저장되었습니다!</p>}
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-sm hover:from-violet-750 hover:to-indigo-750 disabled:opacity-50 transition-all transform active:scale-[0.98] shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>{saving ? '저장 중...' : savedUrl ? '✏️ 임베디드 코드 수정' : '제출하기'}</span>
            </button>
          </div>

          {/* 미리보기 (Canva Embed iframe 형식으로만 풀 렌더링) */}
          {savedUrl && (
            <div className="bg-white border border-violet-200 rounded-2xl overflow-hidden shadow-sm">
              <p className="text-xs font-black text-violet-700 px-4 py-2.5 border-b border-violet-100 bg-violet-50/50">
                제출 완료된 카드뉴스 미리보기
              </p>
              <div className="aspect-video relative bg-slate-50">
                <iframe
                  src={savedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  title="캔바 카드뉴스 미리보기"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {savedUrl && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center shadow-xs">
          <p className="text-sm text-emerald-700 font-black">
            ✓ 카드뉴스가 완벽하게 제출되었습니다 — 이제 3단계에서 정리글을 작성해 보세요!
          </p>
        </div>
      )}
    </div>
  )
}
