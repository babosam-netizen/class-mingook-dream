/**
 * judicial-case-data.js
 * 사법부 사건 시나리오 양식(JudicialCaseTemplate) + 프리셋 + 유효성 검사
 *
 * 사용 방법:
 *   1. 교사가 AI로 JSON 생성 → 업로드 → validateCaseJson() 검증 → Firebase 저장
 *   2. 또는 JUDICIAL_PRESETS 중 선택 → Firebase 저장
 *   3. branchConfig.judicial.activeCase 에 저장된 JSON을 학생 화면(JudicialCaseRoom)과
 *      교사 패널(Phase3JudicialQuickPanel)이 읽어서 재판 단계별로 표시
 */

// ─────────────────────────────────────────
// 유효성 검사
// ─────────────────────────────────────────
export function validateCaseJson(data) {
  const errors = []
  const warnings = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['JSON 파일을 파싱할 수 없습니다.'], warnings: [] }
  }

  const required = ['id', 'title', 'caseType', 'defendant', 'evidence', 'witnesses', 'stageGuides']
  for (const f of required) {
    if (!data[f]) errors.push(`필수 항목 누락: ${f}`)
  }

  if (Array.isArray(data.stageGuides) && data.stageGuides.length < 7) {
    errors.push(`stageGuides는 1~7단계 7개가 필요합니다. (현재 ${data.stageGuides.length}개)`)
  }

  if (!Array.isArray(data.evidence) || data.evidence.length === 0) {
    warnings.push('증거(evidence)가 비어있습니다.')
  } else {
    data.evidence.forEach((ev, i) => {
      if (!ev?.sampleContent) warnings.push(`evidence[${i}].sampleContent 항목이 없습니다. 학생이 증거 내용을 바로 읽기 어렵습니다.`)
      if (!ev?.imagePrompt) warnings.push(`evidence[${i}].imagePrompt 항목이 없습니다. 교사가 증거 사진을 만들기 어렵습니다.`)
    })
  }
  if (!Array.isArray(data.witnesses) || data.witnesses.length === 0) {
    warnings.push('증인(witnesses)이 비어있습니다.')
  } else {
    const prosecutionWitnesses = data.witnesses.filter((w) => w?.side === 'prosecution').length
    const defenseWitnesses = data.witnesses.filter((w) => w?.side === 'defense').length
    if (prosecutionWitnesses > 2) warnings.push(`검사측 증인이 ${prosecutionWitnesses}명입니다. 수업 운영상 2명 이하를 권장합니다.`)
    if (defenseWitnesses > 2) warnings.push(`변호측 증인이 ${defenseWitnesses}명입니다. 수업 운영상 2명 이하를 권장합니다.`)
    data.witnesses.forEach((w, i) => {
      if (!w?.saw) warnings.push(`witnesses[${i}].saw 항목이 없습니다. 증인이 직접 본 것을 알기 어렵습니다.`)
      if (!w?.heard) warnings.push(`witnesses[${i}].heard 항목이 없습니다. 증인이 직접 들은 말을 알기 어렵습니다.`)
      if (!Array.isArray(w?.knows) || w.knows.length === 0) warnings.push(`witnesses[${i}].knows 항목이 비어있습니다.`)
      if (!w?.answerGuide) warnings.push(`witnesses[${i}].answerGuide 항목이 없습니다.`)
      if (!Array.isArray(w?.expectedQuestions) || w.expectedQuestions.length === 0) warnings.push(`witnesses[${i}].expectedQuestions 항목이 비어있습니다.`)
    })
  }

  // 사전 이야기(story) — 있으면 객체·문자열 형식 확인 (없어도 동작은 함, 단 학생 자료실 풍부도가 떨어짐)
  if (data.story !== undefined && data.story !== null) {
    if (typeof data.story !== 'object' || Array.isArray(data.story)) {
      errors.push('story는 { background, incident } 객체여야 합니다.')
    } else {
      for (const k of ['background', 'incident']) {
        const v = data.story[k]
        if (v != null && typeof v !== 'string') {
          errors.push(`story.${k} 는 문자열이어야 합니다.`)
        } else if (!v || !String(v).trim()) {
          warnings.push(`story.${k} 가 비어있습니다. 사건 자료실의 풍부도가 떨어집니다.`)
        }
      }
    }
  } else {
    warnings.push('story 항목이 없습니다. 사건 자료실에 배경 이야기가 표시되지 않습니다.')
  }

  // 판결중심 모드 전용 대본(trialScript) 검증 — 있으면 형식을 확인 (없어도 역할중심에서는 정상)
  if (data.trialScript !== undefined && data.trialScript !== null) {
    if (!Array.isArray(data.trialScript)) {
      errors.push('trialScript는 배열이어야 합니다.')
    } else if (data.trialScript.length > 0) {
      const validSpeakers = ['judge', 'prosecution', 'defense', 'witness', 'defendant']
      data.trialScript.forEach((line, i) => {
        if (!line || typeof line !== 'object') {
          errors.push(`trialScript[${i}] 항목이 객체가 아닙니다.`)
          return
        }
        if (!validSpeakers.includes(line.speaker)) {
          warnings.push(`trialScript[${i}].speaker "${line.speaker}"가 표준 화자(judge/prosecution/defense/witness/defendant)가 아닙니다.`)
        }
        if (!line.text || !String(line.text).trim()) {
          warnings.push(`trialScript[${i}].text가 비어있습니다.`)
        }
      })
    }
  }

  const requiredHints = ['judges', 'prosecution', 'defense', 'jury']
  if (data.roleHints) {
    for (const h of requiredHints) {
      if (!data.roleHints[h]) warnings.push(`roleHints.${h}가 비어있습니다.`)
    }
    if (!data.roleHints.press) {
      warnings.push('roleHints.press 항목이 비어있습니다. (기자단 편성 모드 사용 시 필요)')
    }
  } else {
    warnings.push('roleHints 항목이 없습니다. 학생 안내가 표시되지 않을 수 있습니다.')
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ─────────────────────────────────────────
// 빈 양식 생성 헬퍼
// ─────────────────────────────────────────
export function createEmptyCase(roomCode = '') {
  return {
    id: `custom_${roomCode}_${Date.now().toString(36)}`,
    title: '',
    subtitle: '',
    caseType: 'criminal',
    trialType: 'national_participation',
    period: '',
    summary: '',
    defendant: { name: '', age: 0, occupation: '', persona: 'evader', script: '', scriptHint: '' },
    victims: [],
    charges: [],
    prosecutionDemand: '',
    keyIssues: [],
    evidence: [],
    witnesses: [],
    roleHints: { judges: '', prosecution: '', defense: '', jury: '', witness: '', defendant: '', press: '' },
    // 사건의 사전 이야기 (동화·소설처럼). 사건 자료실 ① 사건 배경 탭에 노출되어 학생이 맥락을 풍부하게 이해하도록 한다.
    // background: 인물·환경·이전 상황의 배경 이야기 (3~5문장)
    // incident:   실제 사건이 어떻게 벌어졌는지 이야기 형태로 풀어 쓴 사건 경위 (4~7문장)
    story: { background: '', incident: '' },
    // 판결중심 모드 전용: 역할극 대본 (speaker별 대사). 역할중심 모드에서는 비워둔다.
    // speaker: 'judge' | 'prosecution' | 'defense' | 'witness' | 'defendant'
    trialScript: [],
    stageGuides: Array.from({ length: 7 }, (_, i) => ({
      stage: i + 1, teacherNote: '', studentNote: '', timerMinutes: 10,
    })),
  }
}

// ─────────────────────────────────────────
// 프리셋 1: 별빛 24시 편의점 (기본 — 가장 풍부한 자료)
// ─────────────────────────────────────────
export const PRESET_BYEOLBIT = {
  id: 'byeolbit_2024',
  title: '별빛 24시 편의점 시급 인상 사칭 사건',
  subtitle: '근로기준법 위반 — 누적 임금체불 약 700만원',
  caseType: 'criminal',
  trialType: 'national_participation',
  period: '2024년 3월 ~ 12월',
  summary: '편의점 점주 김○○이 시급 인상을 약속한 뒤 9개월간 최저임금 이하로 지급, 알바생 3명에게 누적 약 700만원의 임금을 체불한 사건.',

  // 동화·소설처럼 풍부한 사전 이야기 — 사건 자료실 ① 사건 배경 탭에 노출
  story: {
    background: '도시 변두리 골목 끝, 24시간 불이 켜진 가게 하나가 있어요. 이름은 "별빛 24시 편의점". 십 년 가까이 동네 학생들과 야간 노동자들이 라면을 사먹고 가는 작은 가게였습니다. 점주 김○○ 아저씨는 동네에서 정 많은 사장님으로 통했고, 알바생들도 김 아저씨를 "삼촌"이라 부르며 따랐습니다. 알바생 셋, 이○○·박○○·정○○은 모두 갓 스물을 넘긴 학생이거나 사회 초년생이었고, 학비·월세·동생 학원비 때문에 새벽 시간대까지 카운터를 지키며 일해 왔습니다. 그러던 2024년 1월, 김 아저씨는 단체 카톡방에 "올해는 좀 더 챙겨줄게, 시급 9,860원으로 올려줄게~"라는 메시지를 남깁니다. 알바생들은 환호했고, 그 한 줄 메시지를 캡처해 휴대폰 앨범에 저장했습니다.',
    incident: '하지만 3월이 와도 통장에 찍힌 금액은 그대로 시급 8,000원이었습니다. 알바생들은 처음엔 "사장님이 깜빡하셨나" 생각했고, 카운터 옆에서 조심스레 물어봤습니다. 김 아저씨는 그때마다 "이번 달은 매출이 좀 안 좋아, 다음 달에 꼭"이라며 미소로 넘겼습니다. 그 무렵 길 건너편에 큰 마트가 새로 문을 열었고, 별빛의 손님이 한눈에 줄어드는 것이 보였습니다. 알바생들은 사장님 사정을 안쓰러워하며 한 달 더 기다리고, 또 한 달 더 기다렸습니다. 그렇게 4월, 6월, 10월—세 번의 정산 요청은 모두 "조금만 더"로 돌아왔고, 어느덧 9개월이 흘렀습니다. 12월, 정산을 받지 못한 누적 금액이 약 700만원에 이르자 알바생 셋은 처음으로 함께 모여 통장 내역을 비교했고, 그날 밤 노동청에 진정서를 냈습니다. 며칠 뒤 노동청은 "임금대장과 실제 지급액 사이에 명백한 차액이 확인된다"는 조사 결과를 내놓았습니다. 사건은 그렇게 우리 반 법정 앞에 도착했습니다.',
  },

  defendant: {
    name: '김○○', age: 45, occupation: '편의점 점주', persona: 'evader',
    script: '1월에 알바생들이랑 카톡으로 얘기하다가 "올해는 좀 더 챙겨줄게"라고 한 건 맞아요. 근데 그게 정식 약속은 아니었어요. 그냥 격려 차원이었죠. 3월부터 옆에 대형마트가 들어서면서 매출이 정말 안 좋아졌어요. 알바생들 요청도 "곧 줄게"라고 했는데 자꾸 미루게 됐어요. 의도적으로 떼먹으려던 건 절대 아닙니다.',
    scriptHint: '경영난 강조 / 고의성 부인 / 카톡을 "격려성 멘트"로 재해석',
  },

  victims: [
    { name: '이○○', age: 20, role: '알바생 A', experience: '9개월 근무, 미지급 약 350만원', statementSummary: '추가 지급 요청 3회 묵살 경험' },
    { name: '박○○', age: 22, role: '알바생 B', experience: '6개월 근무, 현금 지급 주장 반박', statementSummary: '"현금 받은 적 없음" 확인' },
    { name: '정○○', age: 19, role: '알바생 C', experience: '4개월 근무, 카톡 약속 동석 목격', statementSummary: '1월 카톡 당시 동석 확인' },
  ],

  charges: [
    { law: '근로기준법 제36조', description: '금품 청산 의무 위반' },
    { law: '근로기준법 제43조', description: '임금 지급 방법 위반 (정기·직접·전액 지급 원칙)' },
  ],
  prosecutionDemand: '징역 1년 또는 벌금 2,000만원 및 미지급 임금 전액 지급 명령',

  keyIssues: [
    '카톡 메시지가 법적 효력 있는 임금 약속인가, 격려성 멘트인가?',
    '실제로 매출이 감소하여 지급 불능 상태였는가? (경영난 인정 여부)',
    '알바생들의 추가 지급 요청을 의도적으로 묵살하였는가?',
  ],

  evidence: [
    { id: 'e1', title: '알바생 카톡 인상 약속 캡처', side: 'prosecution', revealedAtStage: 4,
      description: '2024년 1월 점주: "시급 9,860원으로 올려줄게~" 메시지',
      imageHint: '카카오톡 대화 스크린샷 — 점주 발신' },
    { id: 'e2', title: '통장 거래 내역', side: 'prosecution', revealedAtStage: 4,
      description: '3월~12월 입금액이 시급 8,000원 기준 → 최저임금(9,860원)과의 차액 누적 약 700만원',
      imageHint: '엑셀표 — 월별 지급액 vs 최저임금 비교' },
    { id: 'e3', title: '추가 지급 요청 메시지', side: 'prosecution', revealedAtStage: 4,
      description: '알바생들이 3월·6월·10월 세 차례 정산 요청, 점주 "곧 줄게"로 회피',
      imageHint: '카카오톡 대화 3건 — 무시·회피 응답 포함' },
    { id: 'e4', title: '노동청 조사 결과서', side: 'prosecution', revealedAtStage: 4,
      description: '"명백한 차액 미지급" 인정, 시정 명령 발령',
      imageHint: '공문서 — 노동청 직인 포함' },
    { id: 'e5', title: '매출·영업이익 자료', side: 'both', revealedAtStage: 4,
      description: '검사: "2024년 연간 흑자" / 변호: "3월 이후 30% 매출 감소"',
      imageHint: '그래프 — 양측이 각자 유리한 구간 강조' },
    { id: 'e6', title: '현금 지급 영수증 (점주 자필)', side: 'defense', revealedAtStage: 5,
      description: '점주 주장: 일부 현금 추가 지급 영수증. 알바생 서명 없음 → 신빙성 낮음',
      imageHint: '손으로 쓴 영수증 — 서명란 공란' },
    { id: 'e7', title: '점주 월별 손익 계산서', side: 'defense', revealedAtStage: 5,
      description: '회계사 작성. 3월 이후 적자 월 5개 주장 (검사측 신빙성 반박)',
      imageHint: '회계 서류 — 항목별 수익·비용 표' },
  ],

  witnesses: [
    { id: 'w1', name: '이○○', role: '알바생 A', side: 'prosecution',
      statement: '저는 2024년 3월부터 12월까지 9개월간 일했어요. 1월에 점주님이 카톡으로 "시급 올려줄게"라고 했을 때 진짜 올려주실 줄 알았거든요. 그런데 3월 급여를 받아보니 전이랑 똑같았어요. 여쭤봤더니 "다음 달에"라고 하셨는데 계속 같은 말만 반복하셨어요.',
      keyPoint: '카톡 약속 신뢰 + 3회 이상 요청에도 묵살 경험' },
    { id: 'w2', name: '박○○', role: '알바생 B', side: 'prosecution',
      statement: '저는 점주님이 현금으로 따로 줬다고 하시는데, 저는 한 번도 현금을 받은 적이 없어요. 만약 줬다면 어딘가에 제 서명이 있어야 하지 않나요? 서명도 없는 영수증은 믿기 어렵습니다.',
      keyPoint: '현금 지급 주장 전면 부인 — 영수증 신빙성 공격' },
    { id: 'w3', name: '정○○', role: '알바생 C', side: 'prosecution',
      statement: '1월에 점주님이 카톡 보낼 때 제가 옆에 있었어요. "올해는 최저시급 꼭 맞춰줄게"라고 직접 말씀도 하셨어요. 그게 그냥 격려였다는 건 말이 안 돼요.',
      keyPoint: '카톡 약속 발언 당시 동석 — 격려성 주장 반박' },
    { id: 'w4', name: '노동청 조사관', role: '노동청 담당자', side: 'prosecution',
      statement: '신고를 접수받아 조사한 결과, 임금대장과 실제 지급액 사이에 명확한 차액이 확인되었습니다. 사업장 측에서 경영난을 주장하였으나, 경영난은 임금체불의 법적 면책 사유가 되지 않습니다.',
      keyPoint: '경영난은 임금체불의 면책 사유 아님 — 법적 기준 명시' },
    { id: 'w5', name: '배우자 (점주 처)', role: '변호측 증인', side: 'defense',
      statement: '남편이 가게 때문에 정말 힘들어했어요. 밤에 잠을 못 자고, 통장 잔고가 0원인 날도 있었어요. 일부러 안 준 게 아니에요. 알바생들한테 진심으로 미안해하고 있어요.',
      keyPoint: '정상참작 호소 — 경영난의 사실적 고통 증언' },
    { id: 'w6', name: '회계사', role: '변호측 전문가 증인', side: 'defense',
      statement: '제가 2024년 1월부터 12월까지 손익을 검토했습니다. 3월 이후 대형마트 개점으로 매출이 32% 감소했고, 5개월은 실제 적자였습니다. 이런 상황에서 임금 지급 능력이 일시적으로 부족할 수 있습니다.',
      keyPoint: '적자 5개월 데이터 — 지급 불능 가능성 제시' },
  ],

  roleHints: {
    judges:      '핵심 쟁점 3가지(카톡 약속 효력 / 경영난 / 고의성)를 정리하고, 관련 법조항과 양형 기준을 조사하세요.',
    prosecution: '증거 e1~e4로 임금 미지급 사실을 입증하고, 피고인 진술의 모순을 파악하세요. 알바생 A·B의 진술 카드를 미리 작성하세요.',
    defense:     '증거 e6·e7과 증인 w5·w6으로 경영난을 입증하고, 고의성이 없었음을 주장하세요. 점주 진술서를 숙지하고 예상 반박 질문을 준비하세요.',
    jury:        '핵심 쟁점 3가지를 중심으로 판단 기준을 세우세요. 양측 주장을 들으며 메모하고, 평의 시 근거를 제시할 수 있도록 준비하세요.',
    witness:     '자신의 역할(알바생 A/B/C, 노동청 조사관)의 진술서를 충분히 숙지하세요. 예상 반박 질문에도 답할 수 있도록 준비하세요.',
    defendant:   '피고인 진술서를 읽고 변호사팀과 협의하세요. 경영난 자료를 검토하고 어떤 식으로 진술할지 전략을 세우세요.',
    press:       '사건 개요(① 단계) → 재판 진행(③~⑥ 단계) → 결과(⑦ 단계) 순서로 기사를 작성하세요. 기자단 A는 공식 보도, B는 시민 시각으로 관점을 다르게 설정하세요.',
  },

  // 판결중심 모드 전용 대본 — 판사·검사·변호사가 각자 자기 대사만 보며 연기.
  // 공방 대사를 통해 핵심 쟁점(카톡 약속 효력 / 경영난 / 고의성)이 드러나도록 구성.
  // 판결은 마지막에 학생(전 모둠)이 직접 작성하므로 대본은 선고 직전에서 끝난다.
  trialScript: [
    { order: 1,  scene: '모두진술', speaker: 'judge',       text: '지금부터 별빛 24시 편의점 임금체불 사건의 재판을 시작하겠습니다. 먼저 검사 측 모두진술 하십시오.' },
    { order: 2,  scene: '모두진술', speaker: 'prosecution', text: '피고인 김○○은 2024년 1월 알바생들에게 카톡으로 시급 인상을 약속했으나, 9개월간 최저임금에 못 미치는 임금을 지급해 약 700만원을 체불했습니다. 명백한 근로기준법 위반입니다.' },
    { order: 3,  scene: '모두진술', speaker: 'defense',     text: '피고인은 결코 고의로 임금을 떼먹지 않았습니다. 대형마트 개점으로 매출이 급감해 일시적으로 지급이 어려웠을 뿐이며, 카톡 메시지는 정식 약속이 아닌 격려의 말이었습니다.' },
    { order: 4,  scene: '증거조사', speaker: 'judge',       text: '검사 측, 증거를 제시하십시오.' },
    { order: 5,  scene: '증거조사', speaker: 'prosecution', text: '증거 제1호, 2024년 1월 점주가 보낸 "시급 9,860원으로 올려줄게" 카톡입니다. 제2호, 통장 거래 내역으로 9개월간 차액이 누적 700만원임이 확인됩니다.' },
    { order: 6,  scene: '증거조사', speaker: 'defense',     text: '카톡은 "올려줄게~"라는 일상적 표현일 뿐 법적 약속으로 보기 어렵습니다. 또한 회계사 검토 결과 3월 이후 5개월은 실제 적자였음을 증거로 제출합니다.' },
    { order: 7,  scene: '증인심문', speaker: 'judge',       text: '증인 신문을 진행합니다. 알바생 증인은 앞으로 나와 주십시오.' },
    { order: 8,  scene: '증인심문', speaker: 'witness',     text: '저는 1월에 점주님이 "올해는 최저시급 꼭 맞춰줄게"라고 직접 말씀하시는 걸 옆에서 들었어요. 3월부터 여러 번 정산을 요청했지만 "곧 줄게"라는 말만 반복하셨습니다.' },
    { order: 9,  scene: '증인심문', speaker: 'prosecution', text: '증인에게 묻습니다. 점주가 약속을 지키겠다는 의사를 보인 적이 한 번이라도 있었습니까?' },
    { order: 10, scene: '증인심문', speaker: 'witness',     text: '말로는 "다음 달에"라고 했지만 실제로 올려준 적은 한 번도 없었어요.' },
    { order: 11, scene: '피고인신문', speaker: 'judge',     text: '피고인은 발언하십시오.' },
    { order: 12, scene: '피고인신문', speaker: 'defendant',  text: '카톡으로 "더 챙겨줄게"라고 한 건 맞지만 정식 약속은 아니었습니다. 3월부터 매출이 정말 안 좋아져서 미루게 된 것이지, 일부러 떼먹으려던 건 절대 아닙니다.' },
    { order: 13, scene: '피고인신문', speaker: 'prosecution', text: '경영이 어려웠다고 해도, 노동청은 "경영난은 임금체불의 면책 사유가 아니다"라고 명시했습니다. 피고인은 이를 알고 있었습니까?' },
    { order: 14, scene: '피고인신문', speaker: 'defendant',  text: '...그건 나중에 알게 되었습니다.' },
    { order: 15, scene: '최종변론', speaker: 'prosecution', text: '피고인은 약속을 인지하고도 9개월간 체불을 방치했습니다. 징역 1년 또는 벌금 2,000만원과 미지급 임금 전액 지급을 구형합니다.' },
    { order: 16, scene: '최종변론', speaker: 'defense',     text: '피고인은 반성하고 있으며 고의성이 없었고 경영난이라는 정상참작 사유가 있습니다. 관대한 판결을 부탁드립니다.' },
    { order: 17, scene: '선고직전', speaker: 'judge',       text: '양측의 주장과 증거, 증인의 진술을 모두 들었습니다. 이제 이 사건의 판결은 우리 법정의 판사 여러분께 맡기겠습니다. 핵심 쟁점을 정리해 판결문을 작성해 주십시오.' },
  ],

  stageGuides: [
    { stage: 1, timerMinutes: 10,
      teacherNote: '모둠별 역할을 배정하고 사건 자료실 링크를 공유하세요. 각 모둠에게 해당 역할 힌트를 확인하도록 안내하세요.',
      studentNote: '사건 배경을 읽고, 내 역할에 맞는 힌트를 확인하세요.' },
    { stage: 2, timerMinutes: 15,
      teacherNote: '논고 카드 작성 시간을 드리세요. 판사·배심원은 쟁점 정리, 검사·변호는 전략 카드, 증인·피고인은 진술 카드입니다.',
      studentNote: '논고 카드를 작성하세요. 증거 자료를 꼼꼼히 읽어보세요.' },
    { stage: 3, timerMinutes: 8,
      teacherNote: '검사·변호인의 모두진술을 듣습니다. 2~3분씩 배정하세요.',
      studentNote: '검사부·변호인부가 사건에 대한 첫 입장을 발표합니다. 잘 들으며 메모하세요.' },
    { stage: 4, timerMinutes: 15,
      teacherNote: '증거를 순서대로 제시합니다. 검사측(e1~e4) 먼저, 변호측(e5~e7). 반박 기회를 각 1분씩 드리세요.',
      studentNote: '제시된 증거를 살펴보고, 반박할 내용을 메모하세요.' },
    { stage: 5, timerMinutes: 12,
      teacherNote: '피고인 진술 후 검사측 심문 → 변호인측 재심문 순서로 진행합니다. 증인은 판사의 허가 후 발언합니다.',
      studentNote: '심문받는 학생은 진술서에 따라 답변하세요.' },
    { stage: 6, timerMinutes: 8,
      teacherNote: '검사 구형 → 변호인 최종변론 순서로 진행합니다. 각 3분씩 배정하세요.',
      studentNote: '최종 입장을 정리하여 발표하세요.' },
    { stage: 7, timerMinutes: 15,
      teacherNote: '배심원 평의 시간(5분) 후 평결을 발표하게 하세요. 이후 판사가 판결문을 낭독합니다.',
      studentNote: '배심원은 평의 후 유무죄와 양형 의견을 제시하세요.' },
  ],
}

// ─────────────────────────────────────────
// 프리셋 2~5: 기존 NPC 사건 양식화 (경량 버전)
// ─────────────────────────────────────────

const SHARED_STAGE_GUIDES = [
  { stage: 1, timerMinutes: 10, teacherNote: '모둠별 역할을 배정하고 사건 자료실을 공유하세요.', studentNote: '사건 배경을 읽고 역할을 파악하세요.' },
  { stage: 2, timerMinutes: 15, teacherNote: '논고 카드 작성 시간을 드리세요.', studentNote: '논고 카드를 작성하고 증거를 검토하세요.' },
  { stage: 3, timerMinutes: 8,  teacherNote: '검사·변호인 모두진술을 진행하세요.', studentNote: '각 측의 첫 입장을 발표하세요.' },
  { stage: 4, timerMinutes: 15, teacherNote: '증거를 순서대로 제시합니다.', studentNote: '증거를 살펴보고 반박을 준비하세요.' },
  { stage: 5, timerMinutes: 12, teacherNote: '피고인 진술 및 증인 심문을 진행하세요.', studentNote: '진술서에 따라 답변하세요.' },
  { stage: 6, timerMinutes: 8,  teacherNote: '검사 구형 및 최종 변론을 진행하세요.', studentNote: '최종 입장을 발표하세요.' },
  { stage: 7, timerMinutes: 15, teacherNote: '배심원 평의 후 판결을 선고합니다.', studentNote: '배심원은 평의 후 평결을 발표하세요.' },
]

export const PRESET_WASTEWATER = {
  id: 'wastewater_2024',
  title: '화학공장 야간 폐수 방류 사건',
  subtitle: '환경보전법 위반 — 수질 오염 기준치 8배 검출',
  caseType: 'criminal',
  trialType: 'national_participation',
  period: '2024년',
  summary: '한 화학공장이 야간에 정화처리 없이 폐수를 강에 방류한 정황이 포착됐습니다. 환경부 점검 결과 수질 오염 기준치의 8배가 검출되었습니다.',
  defendant: { name: '박○○', age: 52, occupation: '화학공장 대표', persona: 'villain',
    script: '야간 정기 점검 중 설비 고장으로 방류 제어가 안 됐습니다. 의도적으로 방류한 것이 아닙니다.',
    scriptHint: '설비 고장 주장 / 고의성 부인' },
  victims: [{ name: '인근 주민들', age: 0, role: '피해 주민', experience: '식수원 오염 피해', statementSummary: '피부염·음용수 오염 피해' }],
  charges: [{ law: '물환경보전법 제38조', description: '수질오염물질 무단 방류' }],
  prosecutionDemand: '징역 2년 또는 벌금 5,000만원',
  keyIssues: ['야간 방류가 고의적이었는가?', '설비 고장이 실제로 있었는가?', '오염이 이 공장에서 비롯된 것인가?'],
  evidence: [
    { id: 'e1', title: '환경부 수질 검사 결과', side: 'prosecution', revealedAtStage: 4, description: '기준치 8배 폐수 성분 검출', imageHint: '수질 분석 보고서' },
    { id: 'e2', title: 'CCTV 영상 (야간)', side: 'prosecution', revealedAtStage: 4, description: '야간 11시~새벽 2시 폐수 방류 장면', imageHint: 'CCTV 캡처 이미지' },
    { id: 'e3', title: '인근 주민 진단서', side: 'prosecution', revealedAtStage: 4, description: '피부염·소화장애 진단 10건', imageHint: '의료 진단서 묶음' },
    { id: 'e4', title: '설비 점검 기록', side: 'defense', revealedAtStage: 5, description: '정기 점검 기록 존재. 단, 해당 날짜 고장 기록 없음', imageHint: '정비 일지' },
  ],
  witnesses: [
    { id: 'w1', name: '환경부 조사관', role: '수질 오염 전문가', side: 'prosecution', statement: '현장 조사 결과 공장 배수구에서 기준치 8배의 오염 물질이 검출되었습니다. 이는 정화 처리를 거치지 않은 상태에서만 나올 수 있는 수치입니다.', keyPoint: '기준치 8배 — 정화 미처리 확실' },
    { id: 'w2', name: '공장 직원 (내부 고발자)', role: '내부 고발자', side: 'prosecution', statement: '사실 야간에 비용 아끼려고 정화 과정을 생략하라는 지시가 있었어요. 몇 달 전부터 반복됐습니다.', keyPoint: '고의적 지시 존재 — 내부 고발' },
    { id: 'w3', name: '설비 기사', role: '변호측 전문가', side: 'defense', statement: '해당 날짜에 제어 밸브 오작동이 발생할 수 있는 외부 기온이었습니다. 자동 방류가 됐을 가능성이 있습니다.', keyPoint: '기계적 오작동 가능성 제시' },
  ],
  roleHints: {
    judges:      '고의성 여부와 설비 고장 주장의 신빙성을 중심으로 쟁점을 정리하세요.',
    prosecution: '내부 고발자 진술과 CCTV를 핵심으로 고의성을 입증하세요.',
    defense:     '설비 오작동 가능성과 정기 점검 기록으로 고의성을 부인하세요.',
    jury:        '"CCTV가 충분한 증거인가?" "설비 고장이 사실일 수 있는가?"를 중심으로 판단하세요.',
    witness:     '각자의 역할에 맞는 진술을 준비하세요.',
    defendant:   '설비 고장 주장을 구체적으로 준비하세요.',
    press:       '환경 오염의 사회적 영향과 재판 결과를 보도하세요.',
  },
  stageGuides: SHARED_STAGE_GUIDES,
}

export const PRESET_NIGHTSHIFT = {
  id: 'nightshift_2024',
  title: '물류회사 야간 강제근무 사건',
  subtitle: '근로기준법 위반 — 동의 없는 야간 강제근무 및 수당 미지급',
  caseType: 'criminal',
  trialType: 'national_participation',
  period: '2024년',
  summary: '한 물류회사가 직원들에게 동의 없이 야간 강제 근무를 시키고 수당을 지급하지 않은 사실이 내부 고발로 드러났습니다.',
  defendant: { name: '최○○', age: 48, occupation: '물류회사 대표', persona: 'evader',
    script: '물량이 급증해서 어쩔 수 없었어요. 직원들도 암묵적으로 동의한 거라고 생각했고, 수당은 다음 분기에 몰아서 주려고 했습니다.',
    scriptHint: '암묵적 동의 주장 / 지급 의도 있었다고 주장' },
  victims: [{ name: '물류 직원들', age: 0, role: '피해 직원', experience: '야간 강제근무 8주, 수당 미지급', statementSummary: '동의 없는 야간 근무 강요' }],
  charges: [{ law: '근로기준법 제56조', description: '야간·연장근로 수당 미지급' }, { law: '근로기준법 제53조', description: '연장 근로 동의 없이 강제 시행' }],
  prosecutionDemand: '벌금 3,000만원 및 미지급 수당 전액 즉시 지급',
  keyIssues: ['직원들이 야간 근무에 실제로 동의했는가?', '수당 미지급이 의도적이었는가?', '경영상 긴박성이 인정되는가?'],
  evidence: [
    { id: 'e1', title: '근태 기록', side: 'prosecution', revealedAtStage: 4, description: '8주간 야간 근무 기록, 동의서 없음', imageHint: '근태 관리 시스템 캡처' },
    { id: 'e2', title: '직원 단체 메시지', side: 'prosecution', revealedAtStage: 4, description: '"또 야간이에요?" "거부하면 불이익 주겠다고 했어요" 내용', imageHint: '단체 카톡 메시지' },
    { id: 'e3', title: '급여명세서', side: 'prosecution', revealedAtStage: 4, description: '야간 수당 항목 없음 — 기본급만 지급', imageHint: '급여명세서 8주치' },
    { id: 'e4', title: '물량 급증 자료', side: 'defense', revealedAtStage: 4, description: '해당 기간 물량 300% 증가 자료', imageHint: '물량 현황 표' },
  ],
  witnesses: [
    { id: 'w1', name: '물류 직원 A', role: '피해 직원', side: 'prosecution', statement: '"거부하면 불이익이 있다"고 들어서 어쩔 수 없이 나왔어요. 동의한 게 아니에요.', keyPoint: '강압적 분위기 — 자발적 동의 아님' },
    { id: 'w2', name: '노무사', role: '법률 전문가', side: 'prosecution', statement: '암묵적 동의는 근로기준법상 인정되지 않습니다. 서면 동의서가 없으면 동의한 것으로 볼 수 없습니다.', keyPoint: '서면 동의 없으면 법적 무효' },
    { id: 'w3', name: '현장 팀장', role: '변호측 증인', side: 'defense', statement: '직원들이 불만은 없었어요. 다들 회사 상황을 이해하고 자발적으로 남아서 일했습니다.', keyPoint: '자발적 참여 주장' },
  ],
  roleHints: {
    judges:      '"암묵적 동의"가 법적으로 유효한지, 수당 미지급의 고의성을 중심으로 쟁점을 정리하세요.',
    prosecution: '서면 동의서 부재와 직원 증언으로 강제성을 입증하세요.',
    defense:     '물량 급증이라는 긴박한 상황과 암묵적 동의를 주장하세요.',
    jury:        '직원들의 증언과 팀장 증언 중 어느 쪽이 더 신뢰할 만한지 판단하세요.',
    witness:     '각자의 역할에 맞는 진술을 준비하세요.',
    defendant:   '"다음 분기에 줄 계획이었다"는 주장을 구체적으로 준비하세요.',
    press:       '직장 내 강제근무 문제의 사회적 의미를 보도하세요.',
  },
  stageGuides: SHARED_STAGE_GUIDES,
}

export const PRESET_CARTEL = {
  id: 'cartel_2024',
  title: '대기업 4개사 입찰 담합 사건',
  subtitle: '공정거래법 위반 — 시장 가격 인위적 조작',
  caseType: 'criminal',
  trialType: 'national_participation',
  period: '2023년 ~ 2024년',
  summary: '대기업 4곳이 1년간 입찰 단가를 사전에 협의해 시장 가격을 인위적으로 올려왔다는 혐의가 제기됐습니다.',
  defendant: { name: '이○○', age: 55, occupation: '대기업 A사 대표', persona: 'righteous',
    script: '시장 안정을 위해 업계 전체가 공동 대응한 것입니다. 소비자 피해를 줄이기 위한 정당한 협력이었습니다.',
    scriptHint: '"시장 안정" 명분 / "정당한 업계 협력" 주장' },
  victims: [{ name: '소비자 및 중소기업', age: 0, role: '피해자', experience: '담합으로 인한 가격 피해', statementSummary: '입찰 가격 30% 인상 피해' }],
  charges: [{ law: '독점규제 및 공정거래에 관한 법률 제40조', description: '부당한 공동행위 (담합)' }],
  prosecutionDemand: '각 사 벌금 100억원 이상 및 관련 임원 징역 1~3년',
  keyIssues: ['가격 협의가 실제로 이루어졌는가?', '이것이 불법 담합인가, 정당한 업계 협력인가?', '소비자 피해가 입증되는가?'],
  evidence: [
    { id: 'e1', title: '업계 비공개 회의 기록', side: 'prosecution', revealedAtStage: 4, description: '4개 대기업 임원이 참석한 비공개 모임에서 입찰 단가 협의', imageHint: '회의록 문서' },
    { id: 'e2', title: '입찰 가격 패턴 분석', side: 'prosecution', revealedAtStage: 4, description: '1년간 4개사 입찰가가 ±2% 오차 내로 일치 — 자연 발생 확률 0.01%', imageHint: '통계 그래프' },
    { id: 'e3', title: '내부 이메일', side: 'prosecution', revealedAtStage: 4, description: '"이번엔 우리가 따고 다음엔 A사가 따는 것으로" 이메일 내용', imageHint: '이메일 스크린샷' },
    { id: 'e4', title: '업계 전문가 의견서', side: 'defense', revealedAtStage: 5, description: '"원자재 가격 상승으로 인한 자연스러운 가격 수렴"이라는 전문가 의견', imageHint: '경제 분석 보고서' },
  ],
  witnesses: [
    { id: 'w1', name: '공정거래위원회 조사관', role: '공정거래 전문가', side: 'prosecution', statement: '이 정도의 가격 일치율은 우연으로 발생하기 거의 불가능합니다. 명백한 담합의 증거입니다.', keyPoint: '통계적으로 담합 입증 가능' },
    { id: 'w2', name: '피해 중소기업 대표', role: '피해자 측 증인', side: 'prosecution', statement: '입찰에서 번번이 지는데, 대기업들 가격이 신기하게 항상 비슷해요. 우리는 가격 경쟁 자체가 안 됩니다.', keyPoint: '중소기업의 실질적 피해' },
    { id: 'w3', name: '경제학 교수', role: '변호측 전문가', side: 'defense', statement: '원자재 가격이 동시에 오르면 경쟁 기업들의 입찰가가 비슷해질 수 있습니다. 담합 없이도 이런 결과가 나올 수 있어요.', keyPoint: '자연스러운 가격 수렴 가능성' },
  ],
  roleHints: {
    judges:      '"자연스러운 가격 수렴"과 "의도적 담합"을 구분하는 법적 기준을 조사하세요.',
    prosecution: '이메일과 통계 분석으로 협의의 존재를 입증하세요.',
    defense:     '원자재 상승이라는 외부 요인과 전문가 의견으로 자연스러운 현상임을 주장하세요.',
    jury:        '비공개 회의의 목적이 담합이었는지, 아니면 업계 정보 공유였는지 판단하세요.',
    witness:     '각자의 역할에 맞는 진술을 준비하세요.',
    defendant:   '"시장 안정을 위한 공동 대응"이라는 논리를 구체적으로 준비하세요.',
    press:       '기업 담합이 소비자와 시장에 미치는 영향을 보도하세요.',
  },
  stageGuides: SHARED_STAGE_GUIDES,
}

export const PRESET_DATABREAK = {
  id: 'databreak_2024',
  title: '대형 쇼핑몰 개인정보 유출 사건',
  subtitle: '개인정보보호법 위반 — 회원 50만 명 정보 유출',
  caseType: 'criminal',
  trialType: 'national_participation',
  period: '2024년',
  summary: '대형 쇼핑몰의 보안 취약점 때문에 회원 50만 명의 개인정보가 유출됐습니다. 회사는 보안 투자에 인색했다는 비판을 받습니다.',
  defendant: { name: '정○○', age: 43, occupation: '쇼핑몰 대표', persona: 'victim',
    script: '외부 해커의 공격을 받은 겁니다. 저희도 피해자예요. 보안 투자를 안 한 것이 아니라 당시 기술로는 막을 수 없었습니다.',
    scriptHint: '"외부 공격 피해자" 주장 / 보안 투자 했다고 강조' },
  victims: [{ name: '회원 50만 명', age: 0, role: '정보 유출 피해자', experience: '이름·전화·주소·카드번호 유출', statementSummary: '2차 피해 (스팸·보이스피싱) 발생' }],
  charges: [{ law: '개인정보보호법 제29조', description: '개인정보 안전 조치 의무 위반' }],
  prosecutionDemand: '벌금 2,000만원 및 피해자 집단 손해배상 명령',
  keyIssues: ['보안 취약점이 이미 알려져 있었는가?', '보안 투자 부족이 유출의 직접 원인인가?', '회사가 법적 보안 의무를 다했는가?'],
  evidence: [
    { id: 'e1', title: '보안 감사 보고서 (사전)', side: 'prosecution', revealedAtStage: 4, description: '6개월 전 외부 감사에서 "취약점 보완 필요" 경고 → 미조치', imageHint: '감사 보고서 문서' },
    { id: 'e2', title: '보안 예산 삭감 기록', side: 'prosecution', revealedAtStage: 4, description: '전년 대비 보안 예산 40% 삭감 결정', imageHint: '예산 집행 표' },
    { id: 'e3', title: '피해자 2차 피해 신고', side: 'prosecution', revealedAtStage: 4, description: '유출 후 1개월간 보이스피싱·스팸 신고 1,200건', imageHint: '피해 신고 통계' },
    { id: 'e4', title: '보안 인증 서류', side: 'defense', revealedAtStage: 5, description: '해당 연도 정보보안 인증(ISMS) 통과 서류', imageHint: '인증서 사본' },
  ],
  witnesses: [
    { id: 'w1', name: '보안 전문가', role: '사이버보안 전문가', side: 'prosecution', statement: '이 취약점은 이미 업계에서 6개월 전부터 알려진 것이었습니다. 패치를 적용하지 않은 것은 명백한 과실입니다.', keyPoint: '알려진 취약점 미조치 — 과실 명백' },
    { id: 'w2', name: '피해 회원', role: '피해자 대표', side: 'prosecution', statement: '유출된 정보로 제 명의로 대출 신청까지 됐어요. 이건 단순 실수가 아니에요.', keyPoint: '실질적 금전 피해 발생' },
    { id: 'w3', name: '회사 IT 담당자', role: '변호측 증인', side: 'defense', statement: '저희도 정기 보안 점검을 했고, 인증도 통과했어요. 이번 공격은 국가 수준의 해커가 쓰는 수법이라 일반 기업이 막기 어렵습니다.', keyPoint: '정기 점검 실시 + 고도 공격 주장' },
  ],
  roleHints: {
    judges:      '"법적 보안 의무"의 구체적 기준과 과실 판단 방법을 조사하세요.',
    prosecution: '사전 경고 무시와 예산 삭감이 유출의 직접 원인임을 입증하세요.',
    defense:     'ISMS 인증과 외부 해커 공격을 강조하며 과실이 없었음을 주장하세요.',
    jury:        '"인증을 받았으면 의무를 다한 것인가?" "경고를 무시한 것이 결정적인가?"를 판단하세요.',
    witness:     '각자의 역할에 맞는 진술을 준비하세요.',
    defendant:   '"외부 공격 피해자"라는 입장을 구체적으로 준비하세요.',
    press:       '개인정보 보호의 사회적 중요성과 기업의 책임을 보도하세요.',
  },
  stageGuides: SHARED_STAGE_GUIDES,
}

// ─────────────────────────────────────────
// 프리셋 목록 (순서 = UI 드롭다운 순서)
// ─────────────────────────────────────────
export const JUDICIAL_PRESETS = [
  PRESET_BYEOLBIT,
  PRESET_WASTEWATER,
  PRESET_NIGHTSHIFT,
  PRESET_CARTEL,
  PRESET_DATABREAK,
]

export const JUDICIAL_PRESET_MAP = Object.fromEntries(JUDICIAL_PRESETS.map((p) => [p.id, p]))

// persona → 학생 표시용 라벨
export const PERSONA_LABEL = {
  villain:   '😈 악의형',
  evader:    '🎭 회피형',
  righteous: '⚖️ 억울형',
  victim:    '🤕 피해자형',
}

// caseType → 표시 라벨
export const CASE_TYPE_LABEL = {
  criminal: '⛓️ 형사',
  civil:    '📜 민사',
}
