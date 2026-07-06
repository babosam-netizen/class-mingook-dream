/**
 * 학생별 활동 통계 집계
 *
 * 입력: rooms/{rc} 하위 모든 컬렉션 맵
 * 출력: studentId → stats 객체
 */

export function computeStudentStats({
  students = {},
  groups = {},
  posters = {},
  comments = {},
  candidates = {},
  electionVotes = {},
  bills = {},
  billVotes = {},
  juryVotes = {},
  verdicts = {},
  articles = {},
  reflections = {},
  links = {},
  polls = {},
  pollReasons = {},
  coreIssueVotes = {},
  debateSessions = {},
}) {
  const out = {}

  // 학생별 초기 객체 생성
  for (const [studentId, s] of Object.entries(students)) {
    const groupId = s?.groupId
      || Object.entries(groups).find(([, g]) => g?.members?.[studentId])?.[0]
      || null
    const group = groupId ? groups[groupId] : null

    out[studentId] = {
      studentId,
      number: s?.number || 0,
      nickname: s?.nickname || '',
      groupId,
      groupName: group?.name || null,
      isOnline: !!s?.isOnline,
      joinedAt: s?.joinedAt || 0,

      posters: 0,
      comments: { total: 0, byTarget: {} },
      givenRatings: { count: 0, sumLogic: 0, sumFeas: 0, sumRel: 0 },
      receivedRatings: { count: 0, sumLogic: 0, sumFeas: 0, sumRel: 0 },

      isCandidate: false,
      electionVoted: false,

      bills: { proposed: 0, voted: 0, yes: 0, no: 0 },

      judicial: { juryVotes: 0, verdictsWritten: 0 },

      articles: {
        total: 0, approved: 0, pending: 0, rejected: 0,
        byPerspective: { critical: 0, supportive: 0, neutral: 0 },
      },

      reflection: null, // { status, isPrivate, color, ... }

      links: { submitted: 0, approved: 0, pending: 0, rejected: 0 },

      empathyGiven: 0,

      timeline: [], // [{ at, type, label, ...details }]
    }
  }

  // 데이터 순회하며 학생별 타임라인 및 통계 집계
  for (const [studentId, st] of Object.entries(out)) {
    // 1. 포스터
    for (const p of Object.values(posters)) {
      if (p?.authorStudentId === studentId) {
        st.posters += 1
        st.timeline.push({ 
          at: p.createdAt || 0, 
          type: 'poster', 
          label: '포스터 업로드',
          imageUrl: p.imageUrl,
          canvaUrl: p.canvaUrl || p.posterCanvaUrl,
          slogan: p.slogan
        })
      }
    }

    // 2. 댓글 (작성자) + 준 평가
    for (const c of Object.values(comments)) {
      if (c?.authorStudentId === studentId) {
        st.comments.total += 1
        const t = c.targetType || 'unknown'
        st.comments.byTarget[t] = (st.comments.byTarget[t] || 0) + 1
        if (c.ratings) {
          st.givenRatings.count += 1
          st.givenRatings.sumLogic += Number(c.ratings.logic) || 0
          st.givenRatings.sumFeas  += Number(c.ratings.feasibility) || 0
          st.givenRatings.sumRel   += Number(c.ratings.relevance) || 0
        }
        st.timeline.push({
          at: c.createdAt || 0,
          type: 'comment',
          label: `${t} 댓글`,
          body: c.body,
          targetType: t
        })
      }
      
      // 받은 평가는 댓글 대상이 나의 포스터일 때
      if (c?.targetType === 'poster' && c.ratings) {
        const posterAuthor = posters[c.targetId]?.authorStudentId
        if (posterAuthor === studentId) {
          st.receivedRatings.count += 1
          st.receivedRatings.sumLogic += Number(c.ratings.logic) || 0
          st.receivedRatings.sumFeas  += Number(c.ratings.feasibility) || 0
          st.receivedRatings.sumRel   += Number(c.ratings.relevance) || 0
        }
      }
    }

    // 3. 후보 등록
    for (const cand of Object.values(candidates)) {
      if (cand?.leaderStudentId === studentId) {
        st.isCandidate = true
        st.timeline.push({
          at: cand.registeredAt || 0,
          type: 'candidate',
          label: '후보로 등록',
        })
      }
    }

    // 4. 선거 투표
    const eVote = electionVotes[studentId]
    if (eVote) {
      st.electionVoted = true
      st.timeline.push({
        at: eVote?.at || 0,
        type: 'electionVote',
        label: '선거 투표',
      })
    }

    // 5. 법안 발의
    for (const b of Object.values(bills)) {
      if (b?.proposerStudentId === studentId) {
        st.bills.proposed += 1
        st.timeline.push({
          at: b.createdAt || 0,
          type: 'bill',
          label: `법안 발의: ${b.title}`,
          title: b.title,
          body: b.body
        })
      }
    }

    // 6. 법안 투표
    for (const billVotesByStudent of Object.values(billVotes)) {
      const v = billVotesByStudent?.[studentId]
      if (v) {
        st.bills.voted += 1
        if (v?.choice === 'yes') st.bills.yes += 1
        else if (v?.choice === 'no') st.bills.no += 1
        st.timeline.push({
          at: v?.at || 0,
          type: 'billVote',
          label: `의결: ${v?.choice === 'yes' ? '찬성' : '반대'}`,
          choice: v.choice,
        })
      }
    }

    // 7. 배심원 평결
    for (const juryByStudent of Object.values(juryVotes)) {
      const v = juryByStudent?.[studentId]
      if (v) {
        st.judicial.juryVotes += 1
        st.timeline.push({
          at: v?.at || 0,
          type: 'jury',
          label: `평결: ${v?.choice === 'guilty' ? '유죄' : '무죄'}`,
          choice: v.choice
        })
      }
    }

    // 8. 기사
    for (const a of Object.values(articles)) {
      if (a?.authorStudentId === studentId) {
        st.articles.total += 1
        if (a.status === 'approved') st.articles.approved += 1
        else if (a.status === 'pending') st.articles.pending += 1
        else if (a.status === 'rejected') st.articles.rejected += 1
        if (a.perspective && st.articles.byPerspective[a.perspective] !== undefined) {
          st.articles.byPerspective[a.perspective] += 1
        }
        st.timeline.push({
          at: a.createdAt || 0,
          type: 'article',
          label: `기사: ${a.headline}`,
          headline: a.headline,
          body: a.body,
          perspective: a.perspective,
          status: a.status
        })
      }
    }

    // 9. 정리글
    for (const r of Object.values(reflections)) {
      if (r?.authorStudentId === studentId) {
        st.reflection = {
          status: r.status,
          isPrivate: !!r.isPrivate,
          color: r.color,
          hasImpressive: !!r.impressive,
          hasRevisit: !!r.revisit,
          hasPledge: !!r.pledge,
        }
        st.timeline.push({
          at: r.createdAt || 0,
          type: 'reflection',
          label: '정리글 제출',
          body: r.body,
          impressive: r.impressive,
          revisit: r.revisit,
          pledge: r.pledge,
          status: r.status
        })
      }
      // 공감 이모지 내가 준 것
      if (r.empathyVoters && r.empathyVoters[studentId]) {
        st.empathyGiven += 1
      }
    }

    // 10. 외부 링크
    for (const l of Object.values(links)) {
      if (l?.submitterStudentId === studentId) {
        st.links.submitted += 1
        if (l.status === 'approved') st.links.approved += 1
        else if (l.status === 'pending') st.links.pending += 1
        else if (l.status === 'rejected') st.links.rejected += 1
        st.timeline.push({
          at: l.createdAt || 0,
          type: 'link',
          label: `링크 제출: ${l.title}`,
          url: l.url,
          title: l.title,
          status: l.status
        })
      }
    }

    // 11. 개별 설문 (Polls) [Antigravity]
    // 11-1. 등록된 설문들 순회
    for (const [pid, p] of Object.entries(polls)) {
      const v = p?.votes?.[studentId]
      if (v) {
        const optIdx = parseInt(String(v.optionId || '').replace('opt_', ''), 10)
        const opt = p.options?.[optIdx] || p.options?.[v.optionId]
        const choiceLabel = typeof opt === 'string' ? opt : (opt?.label || v.optionId)
        st.timeline.push({
          at: v.at || 0,
          type: 'poll',
          label: `설문 참여: ${p.question || pid}`,
          question: p.question || pid,
          choice: choiceLabel,
          reason: pollReasons[pid || p.systemKey || '']?.[studentId] || ''
        })
      }
    }

    // 11-2. 등록되지 않은 시스템 설문 사유 (예: phase1_poll1) [Antigravity Special Case]
    for (const [pid, reasons] of Object.entries(pollReasons)) {
      // 이미 위(11-1)에서 처리된 설문(투표함)이면 중복 방지
      if (polls[pid]?.votes?.[studentId]) continue
      
      const reason = reasons[studentId]
      if (reason) {
        st.timeline.push({
          at: Date.now(), // 사유만 있는 경우 정확한 시간 추적 어려우면 현재 혹은 대략적 시간
          type: 'poll',
          label: `설문 사유 기록: ${pid}`,
          question: pid === 'phase1_poll1' ? '사전-사후 태도 변화' : pid,
          choice: '—',
          reason: reason
        })
      }
    }
    // 11-3. 핵심 이슈 투표 (coreIssue) [Antigravity]
    const civ = coreIssueVotes?.[studentId]
    if (civ) {
      const g = groups[civ.groupId]
      st.timeline.push({
        at: civ.at || 0,
        type: 'poll',
        label: '1차 여론조사 참여',
        question: '가장 시급한 문제 투표',
        choice: g?.name || civ.groupId,
        reason: ''
      })
    }

    // 11-4. 토론 여론조사 및 토론 활동 [Antigravity]
    for (const [sid, s] of Object.entries(debateSessions)) {
      const preVote = s.stancePoll?.pre?.votes?.[studentId]
      const postVote = s.stancePoll?.post?.votes?.[studentId]
      const preOption = preVote?.option || ''
      const postOption = postVote?.option || ''
      const postReason = postVote?.reason || ''

      if (preVote || postVote) {
        st.timeline.push({
          at: postVote?.votedAt || preVote?.votedAt || s.createdAt || 0,
          type: 'debate_poll',
          label: `토론 여론조사 (${s.title || '토론'})`,
          title: s.title || '토론 여론조사',
          choice: `[사전] ${preOption || '미참여'} → [사후] ${postOption || '미참여'}`,
          reason: postReason,
        })
      }

      // 토론 준비 카드
      const cardsObj = s.prepCards || {}
      for (const card of Object.values(cardsObj)) {
        if (card.studentId === studentId) {
          st.timeline.push({
            at: card.createdAt || s.createdAt || 0,
            type: 'debate_prep',
            label: `토론 준비 카드 (${s.title || '토론'})`,
            stance: card.stance,
            mainClaim: card.mainClaim,
            evidence: card.evidence,
            rebuttal: card.rebuttal,
            counterRebuttal: card.counterRebuttal,
            sources: card.sources,
            isEvaluatorCard: !!card.isEvaluatorCard,
            evalViewpoint: card.evalViewpoint,
            evalCriteria: card.evalCriteria,
            evalFocus: card.evalFocus,
            evalPrediction: card.evalPrediction,
          })
        }
      }

      // 평가단 최종 종합 평가
      const finalEvals = s.finalEvaluations || {}
      const myEval = finalEvals[studentId]
      if (myEval) {
        st.timeline.push({
          at: myEval.createdAt || myEval.savedAt || s.createdAt || 0,
          type: 'debate_final_eval',
          label: `평가단 최종 종합 평가 (${s.title || '토론'})`,
          body: typeof myEval === 'string' ? myEval : myEval.content || myEval.comment || '',
        })
      }
    }
  }

  // 평균 계산 + 타임라인 정렬 + 활동 점수 합산
  for (const st of Object.values(out)) {
    if (st.givenRatings.count > 0) {
      st.givenRatings.avgLogic = st.givenRatings.sumLogic / st.givenRatings.count
      st.givenRatings.avgFeas  = st.givenRatings.sumFeas  / st.givenRatings.count
      st.givenRatings.avgRel   = st.givenRatings.sumRel   / st.givenRatings.count
    }
    if (st.receivedRatings.count > 0) {
      st.receivedRatings.avgLogic = st.receivedRatings.sumLogic / st.receivedRatings.count
      st.receivedRatings.avgFeas  = st.receivedRatings.sumFeas  / st.receivedRatings.count
      st.receivedRatings.avgRel   = st.receivedRatings.sumRel   / st.receivedRatings.count
    }
    st.timeline.sort((a, b) => (b.at || 0) - (a.at || 0))

    st.activityScore =
      st.posters * 5 +
      st.comments.total * 2 +
      st.bills.proposed * 8 +
      st.bills.voted * 1 +
      st.judicial.juryVotes * 1 +
      st.articles.total * 4 +
      (st.reflection ? 6 : 0) +
      st.links.submitted * 3 +
      (st.isCandidate ? 5 : 0) +
      (st.electionVoted ? 1 : 0) +
      st.empathyGiven * 0.5
  }

  return out
}

/**
 * CSV 변환 — 학생별 핵심 지표 한 행씩
 */
export function statsToCSV(statsMap) {
  const headers = [
    '번호', '이름', '모둠', '활동점수', '포스터', '댓글수',
    '받은평가(평균)', '준 평가(평균)',
    '후보등록', '선거투표', '법안발의', '법안투표(찬/반)',
    '배심원표', '판결참여', '기사(승인/대기)', '정리글', '링크제출',
  ]
  const rows = [headers.join(',')]

  const list = Object.values(statsMap).sort((a, b) => (a.number || 0) - (b.number || 0))
  for (const st of list) {
    const recvAvg = st.receivedRatings.count
      ? ((st.receivedRatings.avgLogic + st.receivedRatings.avgFeas + st.receivedRatings.avgRel) / 3).toFixed(2)
      : ''
    const givenAvg = st.givenRatings.count
      ? ((st.givenRatings.avgLogic + st.givenRatings.avgFeas + st.givenRatings.avgRel) / 3).toFixed(2)
      : ''
    rows.push([
      st.number,
      st.nickname,
      st.groupName || '',
      st.activityScore.toFixed(1),
      st.posters,
      st.comments.total,
      recvAvg,
      givenAvg,
      st.isCandidate ? 'O' : '',
      st.electionVoted ? 'O' : '',
      st.bills.proposed,
      `${st.bills.yes}/${st.bills.no}`,
      st.judicial.juryVotes,
      st.judicial.verdictsWritten,
      `${st.articles.approved}/${st.articles.pending}`,
      st.reflection?.status || '',
      st.links.submitted,
    ].join(','))
  }
  return rows.join('\n')
}
