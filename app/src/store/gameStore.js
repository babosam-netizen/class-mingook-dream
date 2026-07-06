import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ref,
  set as firebaseSet,
  update,
  remove,
  onValue,
  onDisconnect,
  get as firebaseGet,
} from 'firebase/database'
import { database } from '../lib/firebase'
import {
  DEFAULT_BRIEFINGS,
  DEFAULT_ROLES,
  DEFAULT_TEMPLATES,
  DEFAULT_EXPERT_QUOTA,
} from '../lib/scaffolding-data'

// 6자리 영숫자 반 코드 자동 생성
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 헷갈리는 0,O,1,I 제외
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

let activeListener = null
let connectionListener = null
let heartbeatTimer = null
let visibilityHandler = null
let burstTimers = []
let pendingLeaveTimer = null

// 기본 학급 설정 — 토픽 6종, 자유 합류, 모둠당 4명, 링크 닫힘
export const DEFAULT_TOPICS = {
  env:    { id: 'env',    name: '환경',     emoji: '🌱', color: 'emerald' },
  labor:  { id: 'labor',  name: '노동',     emoji: '🛠️', color: 'amber'   },
  wealth: { id: 'wealth', name: '빈부격차', emoji: '💰', color: 'yellow'  },
  rights: { id: 'rights', name: '인권',     emoji: '🤝', color: 'rose'    },
  home:   { id: 'home',   name: '주거',     emoji: '🏠', color: 'sky'     },
  region: { id: 'region', name: '지역격차', emoji: '🗺️', color: 'violet'  },
}

export function getDefaultConfig() {
  return {
    topics: DEFAULT_TOPICS,
    assignmentMode: 'free',   // 'free' | 'assigned'
    assignedSlots: {},        // { '15': 'env', '16': 'labor', ... }
    maxPerGroup: 4,
    linksOpen: true,          // 학생이 외부 링크(YouTube/Canva) 제출 가능 — 디폴트 ON
    videoUploadHint: {
      enabled: false,
      url: '',
      label: '학교 드라이브',
    },
    // v3 전문성 스캐폴딩 4종 데이터 ---
    briefings: DEFAULT_BRIEFINGS,
    roles: DEFAULT_ROLES,
    templates: DEFAULT_TEMPLATES,
    expertCallQuotaPerGroup: DEFAULT_EXPERT_QUOTA,
    autoApproveArticles: false, // 기사 제출 시 자동 승인 여부
    autoApproveVideos: false,   // 영상·캔바 제출 시 자동 승인 여부
    phase1ActivityMode: 'both', // poster | essay | both
    // [Antigravity] Phase 1 세부 활동 활성화 설정 추가
    phase1Activities: {
      poster: true,
      essay: true,
      news: true,
      video: true,
      article: true,
    },
    // 시스템 활성화 플래그 (학급 설정에서 토글)
    petitionEnabled: true,     // 국민청원 시스템 사용 여부 (Phase 1 학생 탭·교사 모달)
    debateToolEnabled: true,   // 토론 도구 시스템 사용 여부 (학생 플로팅 + 교사 모달)
    // 선거 등수별 직책 (학급 설정에서 편집)
    // 1위=대통령, 2위=국회의장, 3위=대법원장 이 기본값.
    // 등수가 등록된 후보 수보다 많으면 해당 등수에는 직책 없음.
    electionRoles: [
      { rank: 1, label: '대통령',     emoji: '🇰🇷' },
      { rank: 2, label: '국회의장',   emoji: '🏛️' },
      { rank: 3, label: '대법원장',   emoji: '⚖️' },
    ],
    // 국민청원 시스템 설정 (Phase 1-0 사전 단계)
    petitionConfig: {
      prefixOptions: ['환경', '노동', '주거', '인권', '교육', '안전', '기타'],
      isOpen: true,
      maxHashTags: 3,
      autoApprove: false,
    },
    // Phase 3 부서 단위 배치 설정
    // 교사가 각 부서에 몇 개 모둠을 배치할지 수업 전 설정.
    // units 배열이 비어 있으면 기존 단일 법안/정책/판결 동작(하위 호환).
    branchConfig: {
      legislative: { units: [] },  // [{ unitId, groupId, title, representativeStudentId }]
      executive:   { units: [], presidentGroupId: null },  // [{ unitId, groupId, ministryName, representativeStudentId }]
      judicial: {
        mode: 'press_panel',       // 'press_panel' | 'all_judicial'
        // 작업 방식 (사법부 2모드, 2026-05 재정의): 입법·행정의 공동/역할 토글과 같은 레벨.
        //   'verdict'(판결중심) — AI 대본 재판 참관 후 전원 판사로 모둠별 판결문 작성
        //   'role'(역할중심)   — 학생이 직접 논고·변론·심문하며 실제 재판 진행
        // 구버전 'collaborative'(공동작업) 저장값은 로드 시 'verdict'로 마이그레이션됨.
        workMode: 'role',
        caseType: 'criminal',      // 'criminal'(형사) | 'civil'(민사) — 기본값 형사
        prosecution: [],           // [{ unitId, groupId, representativeStudentId }]  검사팀
        defense:     [],           // [{ unitId, groupId, representativeStudentId }]  변호팀
        witness:     [],           // [{ unitId, groupId, representativeStudentId }]  증인 모둠
        jury:        [],           // [{ unitId, groupId, representativeStudentId }]  배심원 모둠
        judge:       [],           // [{ unitId, groupId, representativeStudentId }]  판사 모둠
        press:       [],           // [{ unitId, groupId, representativeStudentId }]  기자 모둠
        // 팀 배정 방식: 'group'(모둠 단위) | 'individual'(개인 단위 — 토론도구 진영 선택처럼)
        assignMode:  'group',
        // 개인 단위 배정 시 사용: members.{side} = { studentId: true }
        members:     {},
        // 시나리오 양식 시스템 (v1.2.236)
        activeCaseId: 'byeolbit_2024', // 현재 적용된 사건 ID ('preset:id' or 'custom:id')
        activeCase:   null,            // JudicialCaseTemplate 전체 스냅샷 (null=미설정)
        currentStage: 0,               // v3: 0~7 (8단계)
      },
      evaluators: [],              // [{ groupId, type: 'citizens'|'press', targetScope: 'all'|'legislative'|... }]
    },
    // [Antigravity] 활동 안내 문구 설정 (페이즈 2 전환 중심)
    guidance: {
      showPhase2Transition: true,
      phase2TransitionText: "우리가 선정한 이 문제가 이제 우리 반의 최우선 과제가 되었습니다. 두 번째 여정에서는 각 시민단체가 후보 캠프가 되어 이 문제를 해결할 후보를 내고, 최우선과제 해결 공약과 지지 선언문을 준비합니다.",
    },
  }
}

const EMPTY_OBJ = {}
const DEFAULT_CONFIG = getDefaultConfig()
const DEFAULT_PLANNED_POLLS = {
  phase1_prepoll: {
    isSystem: true,
    systemKey: 'prepoll1',
    tag: '사전 여론조사 1',
    question: '우리 반에서 어떤 분야의 문제에 집중해야 하는가?',
    options: [
      { id: 'opt_1', label: '환경' },
      { id: 'opt_2', label: '노동' },
      { id: 'opt_3', label: '빈부격차' },
      { id: 'opt_4', label: '인권' },
      { id: 'opt_5', label: '주거' },
      { id: 'opt_6', label: '지역격차' },
    ],
    status: 'voting',
    phaseStep: { phase: 1, stepId: 'topics' },
    createdAt: Date.now(),
  },
  phase1_poll1: {
    isSystem: true,
    systemKey: 'poll1',
    tag: '사후 여론조사 1',
    question: '우리 반에서 가장 시급하게 해결해야 할 문제는 무엇인가요?',
    options: [
      { id: 'opt_1', label: '환경 문제' },
      { id: 'opt_2', label: '노동 문제' },
      { id: 'opt_3', label: '빈부격차 문제' },
      { id: 'opt_4', label: '인권 문제' },
      { id: 'opt_5', label: '주거 문제' },
      { id: 'opt_6', label: '지역격차 문제' },
    ],
    status: 'voting',
    phaseStep: { phase: 1, stepId: 'poll1' },
    createdAt: Date.now(),
  },
  phase2_prepoll: {
    isSystem: true,
    systemKey: 'prepoll',
    tag: '사전 여론조사 2',
    question: '최우선과제를 가장 잘 해결할 대통령 후보는 누구인가요?',
    options: [
      { id: 'opt_1', label: '1모둠 후보' },
      { id: 'opt_2', label: '2모둠 후보' },
      { id: 'opt_3', label: '3모둠 후보' },
      { id: 'opt_4', label: '4모둠 후보' },
      { id: 'opt_5', label: '5모둠 후보' },
      { id: 'opt_6', label: '6모둠 후보' },
    ],
    status: 'voting',
    phaseStep: { phase: 2, stepId: 'prepoll' },
    createdAt: Date.now(),
  },
  phase3_poll2: {
    isSystem: true,
    systemKey: 'poll2',
    tag: '사전 여론조사 3-1',
    question: '이번 입법부 활동에서 통과된 법안들이 우리 반의 문제를 해결하는 데 적절하다고 생각하나요?',
    options: [
      { id: 'opt_1', label: '매우 적절함' },
      { id: 'opt_2', label: '적절함' },
      { id: 'opt_3', label: '보통' },
      { id: 'opt_4', label: '미흡함' },
      { id: 'opt_5', label: '매우 미흡함' },
    ],
    status: 'voting',
    phaseStep: { phase: 3, stepId: 'poll2' },
    createdAt: Date.now(),
  },
  phase3_poll3: {
    isSystem: true,
    systemKey: 'poll3',
    tag: '사전 여론조사 3-2',
    question: '정부의 이번 예산 편성이 공평하고 효율적으로 이루어졌다고 생각하나요?',
    options: [
      { id: 'opt_1', label: '매우 잘됨' },
      { id: 'opt_2', label: '잘됨' },
      { id: 'opt_3', label: '보통' },
      { id: 'opt_4', label: '미흡함' },
      { id: 'opt_5', label: '매우 미흡함' },
    ],
    status: 'voting',
    phaseStep: { phase: 3, stepId: 'poll3' },
    createdAt: Date.now(),
  },
  phase3_poll4: {
    isSystem: true,
    systemKey: 'poll4',
    tag: '사전 여론조사 3-3',
    question: '이번 재판의 판결이 법과 원칙에 따라 공정하게 내려졌다고 생각하나요?',
    options: [
      { id: 'opt_1', label: '매우 공정함' },
      { id: 'opt_2', label: '공정함' },
      { id: 'opt_3', label: '보통' },
      { id: 'opt_4', label: '불공정함' },
      { id: 'opt_5', label: '매우 불공정함' },
    ],
    status: 'voting',
    phaseStep: { phase: 3, stepId: 'poll4' },
    createdAt: Date.now(),
  },
}

const useGameStore = create(
  persist(
    (set, get) => ({
      // ===== 상태 =====
      roomCode: null,
      role: null, // 'teacher' | 'student'
      myStudentId: null,
      myNumber: null,
      myNickname: null,

      // RTDB 동기화 데이터
      roomData: null,
      currentPhase: 1,
      currentSession: 1,
      className: '',
      students: EMPTY_OBJ,
      groups: EMPTY_OBJ,
      config: DEFAULT_CONFIG,
      electionStatus: 'idle', // 'idle' | 'voting' | 'ended'

      // 네트워크 연결 상태 — Firebase RTDB '.info/connected' 기반
      // 'connected'   : 정상 연결 (또는 아직 입장 전)
      // 'connecting'  : 초기 연결 중 / 일시 끊김 후 재연결 시도 중
      // 'disconnected': 끊김 (오프라인) — UI 입력 차단·재연결 안내
      // 'kicked'      : 교사가 학생 강제 삭제 → 재로그인 필요
      connectionStatus: 'connected',
      connectionLostAt: null, // 끊긴 시각 (ms) — 5초 이상 지속되면 오버레이 표시

      // 이 기기에서 만든 교사용 방 목록 (localStorage 저장)
      // [{ code, className, createdAt }]
      teacherRooms: [],

      // 이 기기로 학생이 들어가본 방 목록 (localStorage 저장)
      // [{ code, className, number, nickname, joinedAt }]
      studentRooms: [],

      // ===== 액션 =====

      // 교사: 방 만들기
      // initialConfig가 있으면 그걸로, 없으면 기본 config 적용
      createRoom: async (classNameRaw, initialConfig = null) => {
        const className = (classNameRaw || '').trim()
        if (!className || className.length < 2) {
          throw new Error('학급명을 2자 이상 입력해 주세요.')
        }
        const code = generateRoomCode()
        const config = initialConfig || getDefaultConfig()
        const createdAt = Date.now()
        await firebaseSet(ref(database, `rooms/${code}`), {
          className,
          currentPhase: 1,
          currentSession: 1,
          coreIssue: null,
          config,
          polls: DEFAULT_PLANNED_POLLS,
          createdAt,
        })
        // 슈퍼 관리자용 인덱스(메타만)
        await firebaseSet(ref(database, `roomsIndex/${code}`), {
          className,
          createdAt,
          lastSeen: createdAt,
        })
        // 이 기기의 교사 방 목록에 추가 (최신이 위)
        const prevRooms = get().teacherRooms || []
        const dedup = prevRooms.filter((r) => r.code !== code)
        const nextRooms = [{ code, className, createdAt }, ...dedup].slice(0, 20)
        set({
          roomCode: code,
          role: 'teacher',
          className,
          teacherRooms: nextRooms,
        })
        get().attachListener(code)
        return code
      },

      // 교사: 반 코드로 방 입장 (RTDB 존재 확인)
      // - 이 기기에서 만든 방이든, 다른 기기에서 만든 방이든 동일하게 동작
      // - 목록에 없으면 자동 추가(다음에 한 클릭으로 들어올 수 있게)
      enterTeacherRoom: async (rawCode) => {
        const code = String(rawCode || '').trim().toUpperCase()
        if (!/^[A-Z2-9]{6}$/.test(code)) {
          throw new Error('반 코드는 6자리 영숫자여야 합니다.')
        }
        const snap = await firebaseGet(ref(database, `rooms/${code}`))
        if (!snap.exists()) {
          // 목록에 있었다면 정리
          const prev = get().teacherRooms || []
          set({ teacherRooms: prev.filter((r) => r.code !== code) })
          throw new Error('해당 반 코드의 방이 존재하지 않습니다.')
        }
        const data = snap.val() || {}
        const prev = get().teacherRooms || []
        const exists = prev.some((r) => r.code === code)
        const nextList = exists
          ? prev.map((r) =>
              r.code === code
                ? { ...r, className: data.className || r.className }
                : r,
            )
          : [
              {
                code,
                className: data.className || '',
                createdAt: data.createdAt || Date.now(),
              },
              ...prev,
            ].slice(0, 20)

        // 인덱스 갱신/등록 (옛날 만든 방도 처음 입장 시 자동 등록)
        try {
          await update(ref(database, `roomsIndex/${code}`), {
            className: data.className || '',
            createdAt: data.createdAt || Date.now(),
            lastSeen: Date.now(),
          })
        } catch {
          /* 인덱스 갱신 실패는 입장 흐름을 막지 않음 */
        }

        set({
          roomCode: code,
          role: 'teacher',
          className: data.className || '',
          teacherRooms: nextList,
        })
        get().attachListener(code)
      },

      // 교사 방 목록에서 제거(서버는 안 건드림 — 단순히 '내 기기에서 숨기기')
      forgetTeacherRoom: (code) => {
        const prev = get().teacherRooms || []
        set({ teacherRooms: prev.filter((r) => r.code !== code) })
      },

      // 교사: config 일부 업데이트 (학급명, 토픽, 배정 모드 등)
      updateConfig: async (partial) => {
        const { roomCode } = get()
        if (!roomCode) return
        await update(ref(database, `rooms/${roomCode}/config`), partial)
      },

      // 학생: 방 입장
      joinRoom: async (code, { number, nickname }) => {
        const nNum = parseInt(number, 10)
        if (isNaN(nNum) || nNum <= 0 || nNum > 99) {
          throw new Error('유효한 번호를 입력해 주세요 (1~99).')
        }
        const sId = `student_${nNum}`
        const studentRef = ref(database, `rooms/${code}/students/${sId}`)
        const joinedAt = Date.now()

        // 방 존재 여부 확인 (없으면 입장 거부)
        const snap = await firebaseGet(ref(database, `rooms/${code}`))
        if (!snap.exists()) {
          // 학생 방 목록에서도 제거
          const prev = get().studentRooms || []
          set({ studentRooms: prev.filter((r) => r.code !== code) })
          throw new Error('해당 반 코드의 방이 존재하지 않습니다.')
        }
        const className = snap.val()?.className || ''

        // [Antigravity] 기존 데이터 확인 및 이름 불일치 방어
        const existingSnap = await firebaseGet(studentRef)
        const isNew = !existingSnap.exists()
        
        if (!isNew) {
          const existingData = existingSnap.val()
          // 번호는 같지만 이름이 다르면 다른 학생이 번호를 잘못 입력한 것이므로 차단
          if (existingData?.nickname !== nickname) {
            throw new Error('NAME_MISMATCH')
          }
          // (중복 접속 에러는 제거하여, 세션 꼬임 시 새로고침/재접속으로 해결할 수 있도록 허용)
        }

        await update(studentRef, {
          number: nNum,
          nickname,
          isOnline: true,
          lastSeen: Date.now(),
          joinedAt: isNew ? joinedAt : (existingSnap.val()?.joinedAt || joinedAt),
        })

        // 자동 오프라인 처리
        onDisconnect(ref(database, `rooms/${code}/students/${sId}/isOnline`)).set(false)

        // 학생 방 목록 갱신
        const prev = get().studentRooms || []
        const dedup = prev.filter((r) => r.code !== code)
        const nextRooms = [
          { code, className, number: nNum, nickname, joinedAt },
          ...dedup,
        ].slice(0, 20)

        set({
          roomCode: code,
          role: 'student',
          myStudentId: sId,
          myNumber: nNum,
          myNickname: nickname,
          studentRooms: nextRooms,
        })
        get().attachListener(code)
        
        return { isNew }
      },

      // 교사: 특정 학생 강제 삭제 (잘못 접속한 학생 정리용)
      removeStudent: async (studentId) => {
        const roomCode = get().roomCode
        if (!roomCode) return
        const studentData = get().students?.[studentId]

        // 모둠 멤버십에서도 제거
        if (studentData?.groupId) {
          await remove(ref(database, `rooms/${roomCode}/groups/${studentData.groupId}/members/${studentId}`))
        } else {
          // groupId가 없을 때도 전체 그룹 순회해 혹시 남아있는 멤버 레코드 정리
          const groups = get().groups || {}
          for (const [gid, g] of Object.entries(groups)) {
            if (g?.members?.[studentId]) {
              await remove(ref(database, `rooms/${roomCode}/groups/${gid}/members/${studentId}`))
            }
          }
        }

        await remove(ref(database, `rooms/${roomCode}/students/${studentId}`))
      },

      // 학생 방 목록에서 제거
      forgetStudentRoom: (code) => {
        const prev = get().studentRooms || []
        set({ studentRooms: prev.filter((r) => r.code !== code) })
      },

      // 방 데이터 실시간 구독
      attachListener: (code) => {
        if (activeListener) {
          activeListener()
          activeListener = null
        }
        if (connectionListener) {
          connectionListener()
          connectionListener = null
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (visibilityHandler) {
          document.removeEventListener('visibilitychange', visibilityHandler)
          visibilityHandler = null
        }
        if (burstTimers.length) {
          burstTimers.forEach(clearTimeout)
          burstTimers = []
        }
        if (pendingLeaveTimer) {
          clearTimeout(pendingLeaveTimer)
          pendingLeaveTimer = null
        }

        // 학생 isOnline=true 강제 갱신 헬퍼 — 재연결·하트비트·visibility 복귀 등에서 공통 사용
        const refreshOnline = async () => {
          const { role, myStudentId } = get()
          if (role !== 'student' || !myStudentId || !code) return
          try {
            const studentRef = ref(database, `rooms/${code}/students/${myStudentId}`)
            await update(studentRef, { 
              isOnline: true, 
              lastSeen: Date.now(),
              isTabActive: document.visibilityState === 'visible' && document.hasFocus()
            })
            // onDisconnect 핸들러 재등록 (반드시 update 성공 후)
            onDisconnect(ref(database, `rooms/${code}/students/${myStudentId}/isOnline`)).set(false)
          } catch (err) {
            console.warn('[connection] refreshOnline failed', err)
          }
        }

        // ===== onDisconnect 경쟁 조건 방어 =====
        // 학생 새로고침 시: 이전 연결의 onDisconnect 가 서버 타임아웃 후(5~30초)
        // 발화하여 새 연결이 막 설정한 isOnline=true 를 false 로 덮어쓰는 race 발생.
        // → 페이지 로드 직후 일련의 시점에 lastSeen+isOnline 을 강제 재기록하여
        //   어느 시점에 stale onDisconnect 가 떨어져도 곧바로 덮어씀.
        const startBurst = () => {
          burstTimers.forEach(clearTimeout)
          burstTimers = []
          ;[2000, 5000, 10000, 20000, 35000].forEach((ms) => {
            burstTimers.push(setTimeout(refreshOnline, ms))
          })
        }

        // ===== 연결 상태 감지 ('.info/connected' 특수 ref) =====
        // RTDB SDK 가 서버와 실제로 연결되어 있는지 boolean 으로 알려줌.
        // - 끊김: connectionStatus='disconnected' + connectionLostAt 기록
        // - 재연결: connectionStatus='connected' → 학생이면 isOnline 자동 복원
        const connRef = ref(database, '.info/connected')
        connectionListener = onValue(connRef, (snap) => {
          const connected = snap.val() === true
          const { connectionStatus } = get()
          if (connected) {
            set({ connectionStatus: 'connected', connectionLostAt: null })
            refreshOnline()
            startBurst()
          } else {
            set({
              connectionStatus: 'disconnected',
              connectionLostAt: connectionStatus === 'disconnected' ? get().connectionLostAt : Date.now(),
            })
          }
        })

        // ===== 하트비트: 15초마다 lastSeen+isOnline 갱신 =====
        // 교사 화면은 lastSeen 타임스탬프를 신뢰의 단일 소스로 사용 — stale
        // onDisconnect 가 isOnline=false 로 덮어써도 lastSeen 이 최근값이면 온라인으로 판정.
        heartbeatTimer = setInterval(() => {
          // [Antigravity] 하트비트는 탭이 비활성 상태여도 정기적으로 보냄 (접속 유지 확인용)
          if (get().connectionStatus === 'connected') {
            refreshOnline()
          }
        }, 15000)

        // ===== 페이지 visibility 및 포커스 상태 실시간 갱신 =====
        // 딴짓 감지: 탭 전환(visibilitychange) + 창 포커스 상실(blur/focus) 모두 감지
        visibilityHandler = () => {
          if (get().connectionStatus === 'connected') {
            refreshOnline()
          }
        }
        document.addEventListener('visibilitychange', visibilityHandler)
        window.addEventListener('focus', visibilityHandler)
        window.addEventListener('blur', visibilityHandler)

        const roomRef = ref(database, `rooms/${code}`)
        activeListener = onValue(roomRef, (snapshot) => {
          const data = snapshot.val()
          if (data) {
            // 기본 여론조사 5종 자동 보강:
            // - 키가 없으면 생성
            // - 1차/선거사전 질문이 비어 있으면 기본 문구로 복구
            const polls = data.polls || {}
            const pollUpdates = {}
            for (const [pid, basePoll] of Object.entries(DEFAULT_PLANNED_POLLS)) {
              const cur = polls[pid]
              if (!cur) {
                pollUpdates[pid] = basePoll
                continue
              }
              if ((pid === 'phase1_poll1' || pid === 'phase2_prepoll') && !String(cur.question || '').trim()) {
                pollUpdates[pid] = {
                  ...cur,
                  question: basePoll.question,
                  options: basePoll.options,
                  tag: basePoll.tag,
                  phaseStep: basePoll.phaseStep,
                  status: cur.status || basePoll.status,
                }
              }
            }
            if (Object.keys(pollUpdates).length > 0) {
              update(ref(database, `rooms/${code}/polls`), pollUpdates).catch(() => {})
            }

            // [Antigravity] 학생인 경우, 현재 내 ID가 서버의 학생 목록에 있는지 확인.
            // 교사가 학생을 삭제(강퇴)한 경우 실시간으로 감지하여 세션을 종료시킴.
            const { role, myStudentId } = get()
            if (role === 'student' && myStudentId) {
              const myDataExists = data.students && data.students[myStudentId]
              if (!myDataExists) {
                console.warn('현재 학생 데이터가 존재하지 않아 세션을 종료합니다. (삭제/강퇴됨)')
                // 'kicked' 상태로 표시 — ConnectionStatusOverlay 가 안내 모달을 띄움
                set({
                  connectionStatus: 'kicked',
                  roomCode: null,
                  role: null,
                  myStudentId: null,
                  myNumber: null,
                  myNickname: null,
                  roomData: null,
                })
                // 모든 리스너 정리
                if (activeListener) {
                  activeListener()
                  activeListener = null
                }
                if (connectionListener) {
                  connectionListener()
                  connectionListener = null
                }
                if (heartbeatTimer) {
                  clearInterval(heartbeatTimer)
                  heartbeatTimer = null
                }
                if (visibilityHandler) {
                  document.removeEventListener('visibilitychange', visibilityHandler)
                  window.removeEventListener('focus', visibilityHandler)
                  window.removeEventListener('blur', visibilityHandler)
                  visibilityHandler = null
                }
                if (burstTimers.length) {
                  burstTimers.forEach(clearTimeout)
                  burstTimers = []
                }
                return
              } else {
                // [Self-healing] 룸 데이터에서 내 isOnline=false 가 관측됐는데
                // 클라이언트는 .info/connected=true 상태면 stale onDisconnect 가 끼어든 것.
                // 즉시 refreshOnline() 호출해 보정 (race 자가치유).
                if (!data.students[myStudentId].isOnline && get().connectionStatus === 'connected') {
                  refreshOnline()
                }
              }
            }

            // 데이터가 돌아왔으면 예약된 leave 취소
            if (pendingLeaveTimer) {
              clearTimeout(pendingLeaveTimer)
              pendingLeaveTimer = null
            }
            set({
              roomData: data,
              currentPhase: data.currentPhase || 1,
              currentSession: data.currentSession || 1,
              className: data.className || '',
              students: data.students || EMPTY_OBJ,
              groups: data.groups || EMPTY_OBJ,
              // 이전 버전 방의 config에 신규 키(templates/roles/briefings)가 없을 수 있어
              // 최신 기본값으로 빈 키만 보충 (기존 설정은 유지)
              config: data.config ? {
                ...DEFAULT_CONFIG,
                ...data.config,
                templates: DEFAULT_CONFIG.templates, // 항상 현재 코드의 템플릿 사용 (교사 편집 불가 + 글자수 제한 등 갱신이 기존 방에도 적용되도록)
                roles:     DEFAULT_CONFIG.roles, // 항상 현재 코드의 역할 정의 사용 (Firebase 저장 버전은 라벨이 구버전일 수 있음)
                briefings: data.config.briefings || DEFAULT_CONFIG.briefings,
                phase1ActivityMode: data.config.phase1ActivityMode || DEFAULT_CONFIG.phase1ActivityMode,
                petitionConfig: {
                  ...DEFAULT_CONFIG.petitionConfig,
                  ...(data.config.petitionConfig || {}),
                },
                // 선거 직책: 저장된 값이 있으면 그대로, 없으면 기본값
                electionRoles: Array.isArray(data.config.electionRoles) && data.config.electionRoles.length > 0
                  ? data.config.electionRoles
                  : DEFAULT_CONFIG.electionRoles,
                branchConfig: data.config.branchConfig ? {
                  ...DEFAULT_CONFIG.branchConfig,
                  ...data.config.branchConfig,
                  judicial: (() => {
                    const j = {
                      ...DEFAULT_CONFIG.branchConfig.judicial,
                      ...(data.config.branchConfig.judicial || {}),
                    }
                    // 사법부 workMode 재정의(2026-05): 구 'collaborative'(공동작업) → 'verdict'(판결중심)
                    if (j.workMode === 'collaborative') j.workMode = 'verdict'
                    return j
                  })(),
                } : DEFAULT_CONFIG.branchConfig,
              } : DEFAULT_CONFIG,
              electionStatus: data.electionStatus || 'idle',
            })
          } else {
            // null이 일시적일 수 있으니 5초 유예. 그 안에 복구되면 유지.
            if (pendingLeaveTimer) return
            console.warn(
              `방 ${code} 데이터가 비어 있어요. 5초 안에 돌아오지 않으면 정리합니다.`,
            )
            pendingLeaveTimer = setTimeout(() => {
              pendingLeaveTimer = null
              console.warn(`방 ${code} 가 비어 있어 세션을 정리합니다.`)
              const prev = get().teacherRooms || []
              set({ teacherRooms: prev.filter((r) => r.code !== code) })
              get().leaveRoom()
            }, 5000)
          }
        })
      },

      // 나가기
      leaveRoom: () => {
        const { roomCode, myStudentId, role } = get()
        if (activeListener) {
          activeListener()
          activeListener = null
        }
        if (connectionListener) {
          connectionListener()
          connectionListener = null
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (visibilityHandler) {
          document.removeEventListener('visibilitychange', visibilityHandler)
          visibilityHandler = null
        }
        if (burstTimers.length) {
          burstTimers.forEach(clearTimeout)
          burstTimers = []
        }
        if (pendingLeaveTimer) {
          clearTimeout(pendingLeaveTimer)
          pendingLeaveTimer = null
        }
        if (role === 'student' && roomCode && myStudentId) {
          firebaseSet(
            ref(database, `rooms/${roomCode}/students/${myStudentId}/isOnline`),
            false,
          )
        }
        set({
          roomCode: null,
          role: null,
          myStudentId: null,
          myNumber: null,
          myNickname: null,
          roomData: null,
          currentPhase: 1,
          currentSession: 1,
          className: '',
          students: {},
          groups: {},
          config: getDefaultConfig(),
          electionStatus: 'idle',
        })
      },

      // 교사: 방 통째로 삭제 (학기 끝)
      destroyRoom: async () => {
        const { roomCode } = get()
        if (!roomCode) return
        await update(ref(database), {
          [`rooms/${roomCode}`]: null,
          [`roomsIndex/${roomCode}`]: null,
        })
        // 이 기기의 교사 방 목록에서도 제거
        const prev = get().teacherRooms || []
        set({ teacherRooms: prev.filter((r) => r.code !== roomCode) })
        get().leaveRoom()
      },

      // 교사: 페이즈 전환
      // 새 페이즈로 넘어가면 모든 학생의 sessionFinishedAtPhase는 자동으로 무효화(다른 페이즈 값을 가지게 됨)
      setPhase: async (phase) => {
        const { roomCode } = get()
        if (!roomCode) return
        await update(ref(database, `rooms/${roomCode}`), {
          currentPhase: phase,
        })
      },

      // 교사: 선거 상태 전환 — 'idle' | 'voting' | 'ended'
      setElectionStatus: async (status) => {
        const { roomCode } = get()
        if (!roomCode) return
        await update(ref(database, `rooms/${roomCode}`), {
          electionStatus: status,
        })
      },

      // 교사: 선거 결과 집계 (추가 보상 기능은 현재 보류)
      // ranks: [{ groupId, rank }, ...] — 외부에서 calculateRanks로 산출 후 전달
      finalizeElection: async (ranks) => {
        const { roomCode } = get()
        if (!roomCode || !ranks) return
        const updates = {}
        for (const r of ranks) {
          updates[`rooms/${roomCode}/groups/${r.groupId}/rank`] = r.rank
        }
        updates[`rooms/${roomCode}/electionStatus`] = 'ended'
        await update(ref(database), updates)
      },

      // 보류 중인 추가 보상 기능의 기존 API 자리.
      // 복원 시 inventory 차감 로직을 이 함수에 다시 연결한다.
      consumeWeightedCard: async () => {
        throw new Error('보상권 기능은 현재 보류 중입니다.')
      },

      // ─────────── v3 스캐폴딩 액션 ───────────

      // 모둠장: 한 차시 4역할 배정. roles는 { studentId: roleKey } 형태
      assignSessionRoles: async (groupId, sessionId, roles) => {
        const { roomCode } = get()
        if (!roomCode || !groupId || !sessionId) return
        await update(
          ref(database, `rooms/${roomCode}/groups/${groupId}/sessionRoles`),
          { [sessionId]: roles },
        )
      },

      // 학생: 브리핑 카드 읽음 기록
      markBriefingRead: async (briefingKind) => {
        const { roomCode, myStudentId } = get()
        if (!roomCode || !myStudentId || !briefingKind) return
        await update(
          ref(database, `rooms/${roomCode}/students/${myStudentId}/briefingsRead`),
          { [briefingKind]: Date.now() },
        )
      },

      // 학생: 전문가 호출 (한도 검증 포함)
      callExpert: async ({ groupId, sessionNo, request }) => {
        const { roomCode, roomData } = get()
        if (!roomCode || !groupId) throw new Error('방 정보가 없습니다.')
        const quota = roomData?.config?.expertCallQuotaPerGroup ?? 3
        const calls = roomData?.expertCalls || {}
        const used = Object.values(calls).filter((c) => c?.groupId === groupId).length
        if (used >= quota) {
          throw new Error(`이미 ${quota}회를 모두 사용했습니다.`)
        }
        const id = `call_${Date.now().toString(36)}`
        await update(ref(database, `rooms/${roomCode}/expertCalls/${id}`), {
          groupId,
          sessionNo: sessionNo || null,
          request: (request || '').trim(),
          status: 'pending',
          createdAt: Date.now(),
        })
        return id
      },

      // 교사: 전문가 호출 응답
      respondExpertCall: async (callId, status, teacherResponse) => {
        const { roomCode } = get()
        if (!roomCode || !callId) return
        const partial = { status }
        if (teacherResponse !== undefined) partial.teacherResponse = teacherResponse
        if (status === 'closed') partial.closedAt = Date.now()
        if (status === 'inProgress') partial.respondingAt = Date.now()
        await update(ref(database, `rooms/${roomCode}/expertCalls/${callId}`), partial)
      },

    }),
    {
      name: 'class-democra-storage',
      partialize: (state) => ({
        roomCode: state.roomCode,
        role: state.role,
        myStudentId: state.myStudentId,
        myNumber: state.myNumber,
        myNickname: state.myNickname,
        teacherRooms: state.teacherRooms,
        studentRooms: state.studentRooms,
      }),
    },
  ),
)

export default useGameStore
