import useGameStore from '../../store/gameStore'
import { updateAt } from '../../lib/rtdb-helpers'
import { preserveWindowScrollAfter } from '../../lib/preserve-scroll'

/**
 * 페이즈별 '교사가 할 일' 단계 가이드.
 * 단방향(다음으로 진행) + 되돌아가기(이전 단계로) 가능.
 *
 * RTDB:
 *   rooms/{rc}/workflow/phase{N}/stepIndex: number (0부터)
 */

// PHASE_STEPS의 각 단계는 학생 화면의 어느 섹션을 강조할지(highlight),
// 활동 요약을 보여줄지(showSummary), 차시 정보(session) 메타를 함께 갖는다.
export const PHASE_STEPS = {
  1: [
    { id: 'opening',  session: '1차시',    label: '오프닝 멘트 ("우리의 턴이 왔다")',          hint: '학생들에게 프로젝트 세계관을 설명',          highlight: 'opening',         studentLabel: '오프닝 — 선생님 말씀을 들어요' },
    { id: 'petition', session: '1차시',    label: '우리 동네·학교·사회 문제 발굴 및 주제 선정',  hint: '학생이 직접 문제를 제안하고 공감을 모은다', highlight: 'petition',   studentLabel: '우리 동네 문제 발굴' },
    { id: 'topics',   session: '2차시',    label: '시민단체 결성 및 슬로건 입력 + 사전 여론조사',       hint: '청원 결과를 보고 관심 분야로 모둠 결성 및 사전 여론조사 실시',     highlight: 'groups',     studentLabel: '시민단체 결성 및 슬로건 입력 + 사전 여론조사' },
    { id: 'media',    session: '3차시',    label: '캠페인 포스터·주장글·링크 제출 안내',       hint: '모둠별 의제를 포스터/글/영상으로 표현',      highlight: 'media',      studentLabel: '포스터·주장글·영상 제작' },
    { id: 'rate',     session: '4차시',    label: '포스터 댓글 + 다축 평가 시간',              hint: '서로의 포스터를 비판적으로 본다',            highlight: 'gallery',    studentLabel: '포스터 댓글·평가' },
    { id: 'poll1',    session: '5차시',    label: '사후 여론조사 1 및 최우선 과제 선정',         hint: '결과 1위 모둠 주제가 최우선 과제가 됩니다',    highlight: 'poll',       studentLabel: '사후 여론조사 1', showSummary: true },
    { id: 'article',  session: '5차시',    label: '기사 작성 — 시민단체 활동 결과를 기사로',   hint: '작성 후 교사 승인 → 여론판 게시',            highlight: 'article',    studentLabel: '기사 작성' },
    { id: 'lock',     session: '5차시',    label: '최우선 과제 잠금 + 두 번째 여정 안내',             hint: '결정된 최우선 과제를 확정하고 다음 여정 안내', highlight: 'lock',       studentLabel: '최우선 과제 발표', showSummary: true },
  ],
  2: [
    { id: 'prep',       session: '6차시',    label: '후보 캠프 구성 및 공약 개발용 자료 수집',      hint: '관련 기사나 영상 자료를 모아 공약을 준비합니다.',         highlight: 'linkBoard',  studentLabel: '자료 수집 및 캠프 구성' },
    { id: 'register',   session: '6차시',    label: '후보 등록 및 지지 선언문 작성',               hint: '후보자는 공약을 등록하고 모둠원은 지지 선언문을 작성합니다.', highlight: 'register',   studentLabel: '후보 등록·지지 선언' },
    { id: 'agora',      session: '7차시',    label: '후보 비교 및 아고라 찬반 의견',               hint: '후보별 정보를 비교하고 아고라에서 토론합니다. (투표 불가)',    highlight: 'candidates', studentLabel: '후보 비교·아고라 토론' },
    { id: 'prepoll',    session: '8차시',    label: '사전 선거 여론조사 (이유 쓰기)',              hint: '현재 지지하는 후보와 그 이유를 여론조사로 응답합니다.',     highlight: 'poll',       studentLabel: '선거 사전 여론조사', showSummary: true },
    { id: 'debatePrep', session: '8차시',    label: '토론 준비 — 아래 선거토론 빠른제어에서 토론 설정',             hint: '바로 열리지 않습니다. 아래 선거토론 빠른제어에서 참여 후보를 고르고 토론 세션을 생성해 주세요.',  highlight: 'candidates', studentLabel: '토론 준비' },
    { id: 'debateEval', session: '9차시',    label: '토론 결과 평가 및 기사 작성',                 hint: '토론을 지켜보고 평가하며 기사를 작성합니다.',             highlight: 'article',    studentLabel: '토론 평가·기사 작성' },
    { id: 'vote',       session: '9차시',    label: '투표 시작 및 결과 확인 (선거 4원칙 준수)',      hint: '실제 투표를 진행하고 결과를 확인합니다.',                highlight: 'candidates', studentLabel: '본 투표 시작' },
    { id: 'finalNews',  session: '9차시',    label: '선거 결과 기사 작성',                        hint: '최종 당선 결과를 기사로 정리합니다.',                   highlight: 'article',    studentLabel: '최종 결과 기사 작성' },
    { id: 'nextJourney',session: '9차시',    label: '다음 여정 안내 (직책 및 순서)',               hint: '대통령, 국회의장 등 직책과 페이즈 3 일정을 안내합니다.',   highlight: 'result',     studentLabel: '다음 여정 안내', showSummary: true },
  ],
  3: [
    { id: 'core',        session: '10차시',     label: '최우선 과제 다시 보여주기',                    hint: '입법·행정·사법부 활동 모두 한 주제로',           highlight: 'briefing',    studentLabel: '최우선 과제 확인',                      stage: 0 },
    { id: 'legislative-prep',    session: '10차시',  label: '  └ 입법 ① 준비',                     hint: '법안을 만들기 전 필요한 자료를 수집하고 역할·쟁점을 확인합니다.',  highlight: 'legislative', studentLabel: '입법 ① 준비',                         stage: 0 },
    { id: 'legislative-draft',   session: '10차시',  label: '  └ 입법 ② 법안 발의',                hint: '학생들이 역할별 작업 공간에서 활동 — 법안 작성자는 4조항 작성·발의, 그 외 역할은 미션 메모 작성',  highlight: 'legislative', studentLabel: '입법 ② 법안 발의',                   stage: 1 },
    { id: 'legislative-discuss', session: '11차시',  label: '  └ 입법 ③ 토의 및 평가',             hint: '학생들이 다른 모둠 법안에 별점(공익성·실행가능성·법적 타당성) + 추천 — 점수 1·2·3등 자동 정렬',                  highlight: 'legislative', studentLabel: '입법 ③ 토의 및 평가',                  stage: 2 },
    { id: 'legislative-tabling', session: '11차시',  label: '  └ 입법 ④ 상정 토론',                hint: '⬇️ 빠른 제어의 [✓ 정식 상정] → [🎙️ 이 법안으로 오프라인 토론 시작] — 토론 도구 자동 활성화',     highlight: 'legislative', studentLabel: '입법 ④ 상정 토론',                    stage: 3 },
    { id: 'legislative-vote',     session: '12차시',  label: '  └ 입법 ⑤ 표결',                    hint: '⬇️ 빠른 제어의 [🎬 전광판 띄우기] → 학생 표결 → 다음 단계로 진행',                            highlight: 'legislative', studentLabel: '입법 ⑤ 표결',                         stage: 4 },
    { id: 'legislative-announce', session: '12차시',  label: '  └ 입법 ⑥ 발표',                    hint: '표결 결과와 의결 종료 법안을 함께 확인합니다.',           highlight: 'legislative', studentLabel: '입법 ⑥ 발표',                    stage: 5 },
    { id: 'article1',    session: '12차시',     label: '기사 작성 — 입법 결과를 기사로',            hint: '작성 후 교사 승인 → 여론판 게시',          highlight: 'article',     studentLabel: '기사 작성 (입법부 활동)' },
    { id: 'poll2',       session: '12차시',     label: '사후 여론조사 3-1 — 입법 결과에 대한 시민 반응', hint: '여론조사 메뉴에서 실시',                    highlight: 'poll',        studentLabel: '사후 여론조사 3-1', showSummary: true },
    { id: 'executive-roles',    session: '13차시',     label: '행정 ① 역할 및 준비',                         hint: '역할을 먼저 나눈 뒤(대표 포함, 교사 확정·잠금), 정책뉴스·워드클라우드로 우리 부처가 할 일을 정하고 비슷한 시행령을 찾습니다.',                  highlight: 'executive',   studentLabel: '행정 ① 역할 및 준비',          stage: 0 },
    { id: 'executive-budget',   session: '13차시',     label: '  └ 행정 ② 정책 및 예산 초안',                  hint: '부처별 집행계획, 시행령 초안, 예산 항목 작성. 저장 시 평가단 열람 가능, 제출 시 공식 공개',                         highlight: 'executive',   studentLabel: '행정 ② 정책 및 예산 초안',          stage: 1 },
    { id: 'executive-review',   session: '13차시',     label: '  └ 행정 ③ 청구예산비교',                  hint: '⬇️ 빠른 제어의 [🎬 전광판 띄우기] → 정부 총예산 대비 부처별 예산 청구액 방송 시청',                         highlight: 'executive',   studentLabel: '행정 ③ 청구예산비교',          stage: 2 },
    { id: 'executive-discuss',  session: '14차시',     label: '  └ 행정 ④ 토의 및 평가',                hint: '다른 부처 집행계획·시행령·예산안에 찬성/반대/중립 의견과 3축 평가 작성',                                                  highlight: 'executive',   studentLabel: '행정 ④ 토의 및 평가',              stage: 3 },
    { id: 'executive-meeting',  session: '14차시',     label: '  └ 행정 ⑤ 다자간 토론(국무회의)',              hint: '평가단 브리핑 후 초과액/잔여액을 놓고 오프라인 국무회의 진행 및 여론조사 실시',                                     highlight: 'executive',   studentLabel: '행정 ⑤ 다자간 토론(국무회의)',                stage: 4 },
    { id: 'executive-adjust',   session: '15차시',     label: '  └ 행정 ⑥ 정책 및 예산안 최종 수정',                  hint: '토론 결과를 반영해 별도 수정 창에서 시행령과 최종 배정 예산안을 집중 수정',                                                  highlight: 'executive',   studentLabel: '행정 ⑥ 정책 및 예산안 최종 수정',                  stage: 5 },
    { id: 'executive-final',    session: '15차시',     label: '  └ 행정 ⑦ 최종 발표',                     hint: '부처별 최종 정책·배정 예산·조정 이유를 발표하고 행정부 활동을 정리합니다.',                                                                 highlight: 'executive',   studentLabel: '행정 ⑦ 최종 발표',             stage: 6 },
    { id: 'article2',           session: '15차시',     label: '기사 작성 — 행정 결과를 기사로', hint: '작성 후 교사 승인 → 여론판 게시',                                                                          highlight: 'article',     studentLabel: '기사 작성 (행정부 활동)' },
    { id: 'poll3',       session: '15차시',     label: '사후 여론조사 3-2 — 예산 편성 평가',             hint: '여론조사 메뉴에서 실시',                    highlight: 'poll',        studentLabel: '사후 여론조사 3-2', showSummary: true },
    // ──── 사법부 v3.2 — 7단계 (16~18차시) ────
    { id: 'judicial-prep',       session: '16차시', label: '사법 ① 준비 (사건 확인 + 역할 선택)',     hint: '사건 자료실에서 사건 배경·내용·증거를 읽고, 팀 배정 확인 + 모둠 내 역할을 선택합니다.', highlight: 'judicial', studentLabel: '사법 ① 사건 확인·역할 선택', stage: 0 },
    { id: 'judicial-research',   session: '16차시', label: '  └ 사법 ② 자료 조사',                   hint: '팀별로 판례·법조항·뉴스·통계 등 사건과 관련된 자료를 수집합니다.',           highlight: 'judicial', studentLabel: '사법 ② 자료 조사',          stage: 1 },
    { id: 'judicial-draft',      session: '16차시', label: '  └ 사법 ③ 논고초안 작성',                hint: '역할별 3가지 미션 작성(출처 링크 포함) → 섹션 초안에 불러오기 → 대표가 최종 확정·제출.', highlight: 'judicial', studentLabel: '사법 ③ 논고초안 작성',     stage: 2 },
    { id: 'judicial-discussion', session: '17차시', label: '  └ 사법 ④ 온라인 토의',                 hint: '제출된 논고초안을 다른 모둠 친구들이 읽고 찬성·반대·질문으로 평가 토의.',     highlight: 'judicial', studentLabel: '사법 ④ 온라인 토의',        stage: 3 },
    { id: 'judicial-trial',      session: '17차시', label: '  └ 사법 ⑤ 국민참여재판 (토론도구)',     hint: '⬇️ 빠른 제어 [🎙️ 모의재판 시작] — 토론도구 자동 연결. 준비→진행→정리(평결·판결문).', highlight: 'judicial', studentLabel: '사법 ⑤ 국민참여재판',     stage: 4 },
    { id: 'article3',            session: '18차시', label: '사법 ⑥ 기사 작성 — 판결 결과를 기사로', hint: '기자 모둠 보도 기사 + 다른 모둠 자유 기사. 작성 후 교사 승인 → 여론판 게시.',  highlight: 'article',  studentLabel: '사법 ⑥ 기사 작성',          stage: 5 },
    { id: 'poll4',               session: '18차시', label: '사법 ⑦ 사후 여론조사 — 판결에 대한 평가', hint: '판결 결과에 대한 시민 평가를 여론조사로 받습니다.',                       highlight: 'poll',     studentLabel: '사법 ⑦ 사후 여론조사', stage: 6, showSummary: true },
  ],
  4: [
    { id: 'timeline',  session: '19차시',      label: '나의 여정 타임라인 + 별점 자율평가',   hint: '1·2·3 여정에서 본인이 한 활동을 돌아보며 각 활동에 별점(⭐1~5)을 매겨 봅니다.',     highlight: 'timeline', studentLabel: '나의 여정 돌아보기 · 별점 주기' },
    { id: 'canvanews', session: '19차시',      label: '캔바 카드뉴스 제작 및 제출',          hint: '별점 준 활동을 중심으로 Canva에서 카드뉴스를 만들고 URL을 제출합니다.',             highlight: 'canva',    studentLabel: '캔바 카드뉴스 제작' },
    { id: 'reflect',   session: '19차시',      label: '구조적 정리글 작성',                  hint: '카드뉴스를 참고하여 개요(3단락)+중심/뒷받침문장+사실·의견 구조로 정리글을 씁니다.', highlight: 'editor',   studentLabel: '정리글 작성' },
    { id: 'approve',   session: '19~20차시',   label: '정리글 승인 큐 처리 (빠른제어)',       hint: '빠른 제어 패널에서 학생 정리글을 확인하고 승인/반려합니다.',                         highlight: 'approve',  studentLabel: '선생님께서 검토 중이에요...' },
    { id: 'gallery',   session: '20차시',      label: '갤러리 워크: 친구들 공감·댓글',        hint: '승인된 친구들의 정리글과 카드뉴스를 읽고 이모지 공감과 댓글을 남깁니다.',            highlight: 'gallery',  studentLabel: '친구들 정리글 감상 · 공감 · 댓글' },
    { id: 'closing',   session: '20차시',      label: '학급 여정 피날레 + 마무리',            hint: '우리 반 별점 하이라이트 타임라인과 마무리 메시지로 프로젝트를 마칩니다.',             highlight: 'finale',   studentLabel: '우리 반의 여정 마무리 🎉' },
  ],
}

// ──── 판결중심(시나리오) 모드 사법 7단계 — workMode === 'verdict'일 때 사법 단계를 이걸로 치환 ────
// 역할중심과 공유하는 기사(article3)·여론조사(poll4)는 id를 유지해 기사·여론조사 시스템과 호환(라벨만 판결중심용으로 교체).
const JUDICIAL_VERDICT_STEPS = [
  { id: 'verdict-prep',       session: '16차시', label: '판결 ① 준비 (사건 개요 + 팀 배정)',      hint: '사건 자료실에서 사건 개요를 함께 읽고, 교사가 연기 3팀(판사·검사·변호사)을 지정합니다. 나머지 모둠은 참관·판결문 작성팀입니다.', highlight: 'judicial', studentLabel: '판결 ① 사건 개요·팀 배정', stage: 0 },
  { id: 'verdict-issues',     session: '16차시', label: '  └ 판결 ② 쟁점 파악',                   hint: '재판을 능동적으로 보기 위해, 이 사건에서 무엇이 판결에 중요할지 모둠별로 쟁점을 정리합니다.',           highlight: 'judicial', studentLabel: '판결 ② 쟁점 파악',          stage: 1 },
  { id: 'verdict-trial',      session: '17차시', label: '  └ 판결 ③ 재판하기 (대본 연기+판결문 작성)', hint: '⬇️ 빠른 제어에서 토론도구를 열어 대본 연기, 판사 메모, 모둠 판결문 작성·게시까지 진행합니다.', highlight: 'judicial', studentLabel: '판결 ③ 재판하기',         stage: 2 },
  { id: 'verdict-discussion', session: '18차시', label: '  └ 판결 ④ 판결문 토의',                 hint: '토론도구에서 게시된 모둠별 판결문을 읽고 근거·결론이 어떻게 다른지 비교하며 토의합니다.',                  highlight: 'judicial', studentLabel: '판결 ④ 판결문 토의',        stage: 3 },
  { id: 'article3',           session: '18차시', label: '판결 ⑤ 기사 작성 — 사법부가 하는 일',     hint: '사법부의 역할과 이번 재판을 기사로 정리합니다. 작성 후 교사 승인 → 여론판 게시.',                       highlight: 'article',  studentLabel: '판결 ⑤ 기사 작성',          stage: 4 },
  { id: 'poll4',              session: '18차시', label: '판결 ⑥ 여론조사 — 판결에 대한 평가',      hint: '여러 모둠의 판결에 대한 시민 평가를 여론조사로 받습니다.',                                              highlight: 'poll',     studentLabel: '판결 ⑥ 여론조사', stage: 5, showSummary: true },
]

// 사법 단계 앞부분(준비~여론조사 3-2) + 판결중심 사법 7단계
const PHASE3_PRE_JUDICIAL = (PHASE_STEPS[3] || []).filter(
  (s) => !s.id.startsWith('judicial-') && s.id !== 'article3' && s.id !== 'poll4',
)
const PHASE3_VERDICT_STEPS = [...PHASE3_PRE_JUDICIAL, ...JUDICIAL_VERDICT_STEPS]

// 사법 워크플로 그룹(⚖️) 판정 — 역할중심 judicial-* / 판결중심 verdict-* 모두 포함
export function isJudicialGroupStep(id) {
  return typeof id === 'string' && (id.startsWith('judicial-') || id.startsWith('verdict-'))
}

// workMode를 반영한 페이즈 단계 배열을 반환. 판결중심(verdict) 사법 모드만 phase3 사법 단계를 치환.
// 그 외 페이즈/모드는 정적 PHASE_STEPS 그대로(하위 호환).
export function getPhaseSteps(phase, judicialWorkMode) {
  const p = Number(phase)
  if (p === 3 && judicialWorkMode === 'verdict') return PHASE3_VERDICT_STEPS
  return PHASE_STEPS[p] || []
}

// PollManager 드롭다운 — 어떤 페이즈/단계에서 어떤 여론조사를 돌릴지 안내.
// (1차 여론조사는 별도의 CoreIssuePoll 시스템이라 제외)
export const POLL_SLOTS = [
  { 
    phase: 1, stepId: 'topics', tag: '사전 여론조사 1', label: '첫 번째 여정 · 사전 여론조사 1 (분야 선정)',
    question: '우리 반에서 어떤 분야의 문제에 집중해야 하는가?',
    options: ['환경', '노동', '빈부격차', '인권', '주거', '지역격차'],
  },
  { 
    phase: 1, stepId: 'poll1', tag: '사후 여론조사 1', label: '첫 번째 여정 · 사후 여론조사 1 (최우선 과제 선정)',
    question: '우리 반에서 가장 시급하게 해결해야 할 문제는 무엇인가요?',
    options: ['환경 문제', '노동 문제', '빈부격차 문제', '인권 문제', '주거 문제', '지역격차 문제'],
  },
  {
    phase: 2, stepId: 'prepoll', tag: '사전 여론조사 2', label: '두 번째 여정 · 사전 여론조사 2 (후보 지지도)',
    question: '최우선과제를 가장 잘 해결할 대통령 후보는 누구인가요?',
    useGroups: true,
  },
  { 
    phase: 3, stepId: 'poll2', tag: '사후 여론조사 3-1', label: '세 번째 여정 · 사후 여론조사 3-1 (입법 결과 평가)',
    question: '이번 입법부 활동에서 통과된 법안들이 우리 동네 문제를 해결하는 데 적절하다고 생각하나요?',
    options: ['매우 적절함', '적절함', '보통', '미흡함', '매우 미흡함']
  },
  { 
    phase: 3, stepId: 'poll3', tag: '사후 여론조사 3-2', label: '세 번째 여정 · 사후 여론조사 3-2 (예산 편성 평가)',
    question: '정부의 이번 예산 편성이 공평하고 효율적으로 이루어졌다고 생각하나요?',
    options: ['매우 잘됨', '잘됨', '보통', '미흡함', '매우 미흡함']
  },
  { 
    phase: 3, stepId: 'poll4', tag: '사후 여론조사 3-3', label: '세 번째 여정 · 사후 여론조사 3-3 (판결 평가)',
    question: '이번 재판의 판결이 법과 원칙에 따라 공정하게 내려졌다고 생각하나요?',
    options: ['매우 공정함', '공정함', '보통', '불공정함', '매우 불공정함']
  },
]


// 페이즈/단계 → 진행 순서 인덱스 (작을수록 먼저)
export function pollSlotOrder(phase, stepId) {
  const steps = PHASE_STEPS[phase] || []
  const idx = steps.findIndex((s) => s.id === stepId)
  return phase * 100 + (idx >= 0 ? idx : 99)
}

function PhaseWorkflow({ phase: phaseProp, embedded = false }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const currentPhase = useGameStore((s) => s.currentPhase)
  const roomData = useGameStore((s) => s.roomData)
  const judicialWorkMode = useGameStore((s) => s.config?.branchConfig?.judicial?.workMode) || 'role'
  const targetPhase = phaseProp || currentPhase
  const isCurrent = targetPhase === currentPhase

  const steps = getPhaseSteps(targetPhase, judicialWorkMode)
  const stepIndex = roomData?.workflow?.[`phase${targetPhase}`]?.stepIndex ?? 0
  const setStepIndex = async (next) => {
    if (!isCurrent) return // 다른 페이즈는 진행 불가(읽기 전용)
    const clamped = Math.max(0, Math.min(steps.length - 1, next))
    await preserveWindowScrollAfter(() =>
      updateAt(roomCode, `workflow/phase${targetPhase}`, {
        stepIndex: clamped,
      }),
    )
  }

  return (
    <div className={embedded ? '' : 'bg-white rounded-2xl shadow p-5'}>
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="font-bold text-indigo-700">
          📋 {targetPhase === 1 ? '첫 번째' : targetPhase === 2 ? '두 번째' : targetPhase === 3 ? '세 번째' : '네 번째'} 여정 진행 가이드
          {roomData?.config?.countryName && (
            <span className="ml-2 text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">
              {roomData.config.countryName}
            </span>
          )}
          {!isCurrent && (
            <span className="ml-2 text-xs font-normal text-gray-400">(참고)</span>
          )}
        </h2>
        <span className="text-xs text-gray-500">
          {isCurrent ? `${stepIndex + 1} / ${steps.length}` : `${steps.length}단계`}
        </span>
      </header>

      <ol className="space-y-1.5 mb-3">
        {steps.map((step, i) => {
          // --- 동적 라벨/힌트 처리 [Antigravity] ---
          const country = roomData?.config?.countryName || '우리 반'
          let displayLabel = step.label
          let displayHint = step.hint

          // '우리 동네' 치환 (단, 첫 번째 여정의 2번 활동인 petition 단계는 예외)
          if (step.id !== 'petition') {
            displayLabel = displayLabel.replace(/우리 동네/g, country === '우리 동네' ? '우리 반' : country)
            displayHint = displayHint.replace(/우리 동네/g, country === '우리 동네' ? '우리 반' : country)
          }

          // 1. 국민청원 시스템 비활성화 시 건너뛰기 안내
          if (step.id === 'petition' && roomData?.config?.petitionEnabled === false) {
            displayLabel = '문제 발굴 및 주제 선정 (청원 건너뜀)'
            displayHint = '학급 설정에서 국민청원이 비활성화되어 있습니다.'
          }

          // 2. 모둠 결성 모드(자율/지정) 반영
          if (step.id === 'topics') {
            const isFree = roomData?.config?.assignmentMode === 'free'
            displayLabel = isFree ? '시민단체 결성 및 슬로건 입력 + 사전 여론조사 (자율 모드)' : '시민단체 결성 및 슬로건 입력 + 사전 여론조사 (번호별 지정 모드)'
            displayHint = isFree 
              ? '학생들이 직접 원하는 단체를 선택하여 입장하고 슬로건을 입력합니다.' 
              : '교사가 미리 번호별로 단체를 지정해두어, 학생이 입장하면 슬로건을 입력하게 합니다.'
          }

          const done = i < stepIndex
          const current = i === stepIndex

          // --- 그룹화 처리 (입법 라운드) ---
          if (step.id.startsWith('legislative-')) {
            if (step.id !== 'legislative-prep') return null // 첫 단계만 렌더링
            
            const groupSteps = steps.filter((s) => s.id.startsWith('legislative-'))
            const lastIdx = steps.indexOf(groupSteps[groupSteps.length - 1])
            const isGroupDone = stepIndex > lastIdx
            const isGroupCurrent = stepIndex >= i && stepIndex <= lastIdx
            
            return (
              <li
                key="legislative-group"
                className={`p-2 rounded-lg text-sm flex items-start gap-2 transition ${
                  isGroupCurrent ? 'bg-indigo-100 border-2 border-indigo-500' : isGroupDone ? 'bg-emerald-50 text-gray-500' : 'bg-gray-50 text-gray-400'
                }`}
              >
                <span className="font-mono text-xs mt-0.5">
                  {isGroupDone ? '✓' : isGroupCurrent ? '▶' : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <div className={`font-semibold ${isGroupCurrent ? 'text-indigo-800' : ''}`}>
                      🏛️ 입법부 활동 진행
                    </div>
                    <span className="text-[10px] font-mono shrink-0 text-gray-400">10~12차시</span>
                  </div>
                  {isGroupCurrent && (
                    <div className="text-xs text-indigo-600 mt-0.5 font-bold">
                      👉 입법부 탭의 [상태바]에서 이전/다음 단계를 제어하세요.
                    </div>
                  )}
                </div>
              </li>
            )
          }

          // --- 그룹화 처리 (행정 라운드) ---
          if (step.id.startsWith('executive-')) {
            if (step.id !== 'executive-roles') return null // 첫 단계만 렌더링
            
            const groupSteps = steps.filter((s) => s.id.startsWith('executive-'))
            const lastIdx = steps.indexOf(groupSteps[groupSteps.length - 1])
            const isGroupDone = stepIndex > lastIdx
            const isGroupCurrent = stepIndex >= i && stepIndex <= lastIdx
            
            return (
              <li
                key="executive-group"
                className={`p-2 rounded-lg text-sm flex items-start gap-2 transition ${
                  isGroupCurrent ? 'bg-indigo-100 border-2 border-indigo-500' : isGroupDone ? 'bg-emerald-50 text-gray-500' : 'bg-gray-50 text-gray-400'
                }`}
              >
                <span className="font-mono text-xs mt-0.5">
                  {isGroupDone ? '✓' : isGroupCurrent ? '▶' : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <div className={`font-semibold ${isGroupCurrent ? 'text-indigo-800' : ''}`}>
                      🏢 행정부 활동 진행
                    </div>
                    <span className="text-[10px] font-mono shrink-0 text-gray-400">13~15차시</span>
                  </div>
                  {isGroupCurrent && (
                    <div className="text-xs text-indigo-600 mt-0.5 font-bold">
                      👉 행정부 탭의 [상태바]에서 이전/다음 단계를 제어하세요.
                    </div>
                  )}
                </div>
              </li>
            )
          }

          // --- 그룹화 처리 (사법 라운드: 역할중심 judicial-* / 판결중심 verdict-*) ---
          if (isJudicialGroupStep(step.id)) {
            if (step.id !== 'judicial-prep' && step.id !== 'verdict-prep') return null // 첫 단계만 렌더링

            const groupSteps = steps.filter((s) => isJudicialGroupStep(s.id))
            const lastIdx = steps.indexOf(groupSteps[groupSteps.length - 1])
            const isGroupDone = stepIndex > lastIdx
            const isGroupCurrent = stepIndex >= i && stepIndex <= lastIdx
            
            return (
              <li
                key="judicial-group"
                className={`p-2 rounded-lg text-sm flex items-start gap-2 transition ${
                  isGroupCurrent ? 'bg-indigo-100 border-2 border-indigo-500' : isGroupDone ? 'bg-emerald-50 text-gray-500' : 'bg-gray-50 text-gray-400'
                }`}
              >
                <span className="font-mono text-xs mt-0.5">
                  {isGroupDone ? '✓' : isGroupCurrent ? '▶' : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <div className={`font-semibold ${isGroupCurrent ? 'text-indigo-800' : ''}`}>
                      ⚖️ 사법부 활동 진행
                    </div>
                    <span className="text-[10px] font-mono shrink-0 text-gray-400">16~18차시</span>
                  </div>
                  {isGroupCurrent && (
                    <div className="text-xs text-indigo-600 mt-0.5 font-bold">
                      👉 사법부 탭의 [상태바]에서 이전/다음 단계를 제어하세요.
                    </div>
                  )}
                </div>
              </li>
            )
          }

          // 기존 기본 렌더링
          return (
            <li
              key={step.id}
              className={`p-2 rounded-lg text-sm flex items-start gap-3 transition ${
                current
                  ? 'bg-indigo-50 border-2 border-indigo-200 shadow-sm'
                  : done
                  ? 'bg-emerald-50 text-gray-600'
                  : 'bg-gray-50 text-gray-400'
              }`}
            >
              <span
                className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-black transition-colors ${
                  done
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : current
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-200'
                    : 'bg-gray-300 text-white'
                }`}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <div className={`font-bold ${current ? 'text-indigo-900' : done ? 'text-emerald-900' : ''}`}>
                    {displayLabel}
                  </div>
                  {step.session && (
                    <span
                      className={`text-[10px] font-mono shrink-0 ${
                        current ? 'text-indigo-600' : 'text-gray-400'
                      }`}
                    >
                      {step.session}
                    </span>
                  )}
                </div>
                {current && (
                  <div className="text-xs text-gray-500 mt-0.5">{displayHint}</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {isCurrent && (
        <div className="flex gap-2">
          <button
            onClick={() => setStepIndex(stepIndex - 1)}
            disabled={stepIndex === 0}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 disabled:opacity-40 hover:bg-gray-200"
          >
            ← 이전
          </button>
          <button
            onClick={() => setStepIndex(stepIndex + 1)}
            disabled={stepIndex >= steps.length - 1}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}

export default PhaseWorkflow
