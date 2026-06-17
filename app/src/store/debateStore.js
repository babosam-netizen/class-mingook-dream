import { create } from 'zustand'
import { subscribe } from '../lib/rtdb-helpers'

/**
 * 토론 도구 시스템의 RTDB 구독·정리 헬퍼.
 */

/** 진영 라벨링 상수 (v1.2.9) - 전역에서 참조 가능하도록 Store 파일로 이동 */
export const DEBATE_SIDE_LABELS = {
  general: { pro: '찬성', con: '반대', evaluator: '평가단', chair: '의장' },
  trial: { pro: '검사', con: '변호/피고', evaluator: '평가단(배심원)', chair: '재판장' },
  multi_party: { pro: 'A팀', con: 'B팀', evaluator: '평가단', chair: '의장' },
  consultative: { pro: '제안측', con: '조율측', evaluator: '평가단', chair: '의장' },
}

const useDebateStore = create((set, get) => ({
  // 세션 데이터 (RTDB 동기)
  sessionsMap: {},
  currentSessionId: null,
  currentSession: null,
  prepCards: [],
  scripts: {},      // { pro: { body: '' }, con: { body: '' }, ... }
  stancePolls: {},   // { pre?: PollWithVotes, post?: PollWithVotes }
  speechEvals: [],   // [{ id, targetLabel, isOpen, results: {studentId: {...}}, ... }]
  evaluators: {},    // { studentId: true }
  isChair: false,
  isEvaluator: false,

  // 학생용 UI: 패널 열림/닫힘
  panelOpen: false,
  setPanelOpen: (v) => set({ panelOpen: !!v }),

  // 단일 구독 라이프사이클
  _unsub: null,

  attachListener: (roomCode, myStudentId) => {
    // 기존 구독 해제
    const prev = get()._unsub
    if (typeof prev === 'function') prev()

    if (!roomCode) {
      set({ sessionsMap: {}, currentSessionId: null, currentSession: null, prepCards: [], scripts: {}, stancePolls: {}, speechEvals: [], evaluators: {}, isChair: false, isEvaluator: false, _unsub: null })
      return
    }

    const u = subscribe(roomCode, 'debateSessions', (data) => {
      const map = data || {}
      const entries = Object.entries(map).map(([id, s]) => ({ id, ...s }))
      // 활성 세션 한 개 (createdAt 가장 최근)
      const active = entries
        .filter((s) => s.isActive)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null

      const sid = active?.id || null
      const session = active || null

      // prepCards
      const cardsObj = active?.prepCards || {}
      const prepCards = Object.entries(cardsObj)
        .map(([id, c]) => ({ id, ...c }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))

      // scripts
      const scripts = active?.scripts || {}

      // stancePolls (pre/post)
      const polls = active?.stancePoll || {}
      const stancePolls = {}
      for (const key of Object.keys(polls)) {
        const p = polls[key]
        const votes = p?.votes || {}
        stancePolls[key] = { id: key, ...p, votes }
      }

      // 발언 평가 (speechEvals) — 시간순 배열
      const evalsObj = active?.speechEvals || {}
      const speechEvals = Object.entries(evalsObj)
        .map(([id, e]) => ({ id, ...e, results: e?.results || {} }))
        .sort((a, b) => (a.openedAt || 0) - (b.openedAt || 0))

      // 평가단 명단 (evaluators 맵 → studentId 집합)
      const evaluators = active?.evaluators || {}

      const isChair = !!(myStudentId && active?.chairId && active.chairId === myStudentId)
      const isEvaluator = !!(myStudentId && evaluators[myStudentId])

      set({
        sessionsMap: map, currentSessionId: sid, currentSession: session,
        prepCards, scripts, stancePolls, speechEvals, evaluators,
        isChair, isEvaluator,
      })
    })

    set({ _unsub: u })
  },

  detach: () => {
    const u = get()._unsub
    if (typeof u === 'function') u()
    set({
      _unsub: null,
      sessionsMap: {},
      currentSessionId: null,
      currentSession: null,
      prepCards: [],
      scripts: {},
      stancePolls: {},
      speechEvals: [],
      evaluators: {},
      isChair: false,
      isEvaluator: false,
    })
  },
}))

export default useDebateStore
