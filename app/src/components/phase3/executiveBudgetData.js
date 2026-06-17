export const DEFAULT_EXECUTIVE_BUDGET = 100

export function roundBudgetAmount(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

export function formatBudgetAmount(value) {
  const rounded = roundBudgetAmount(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export const EXECUTIVE_RATING_AXES = [
  { key: 'relevance', full: '🎯 과제관련성', short: '🎯 관련', color: 'bg-amber-500' },
  { key: 'feasibility', full: '🛠️ 실행가능성', short: '🛠️ 실행', color: 'bg-emerald-500' },
  { key: 'publicGood', full: '🤝 공익성', short: '🤝 공익', color: 'bg-sky-500' },
]

// 대한민국 실제 비율을 500만 명 기준으로 환산 (51,670,000명 기준, 2024 통계청)
export const BIBIM_STATS = [
  { key: 'total', label: '전체 시민', value: 5000000, desc: '전체 인구 500만 명 (대한민국 5,167만 명 비율 적용)' },
  { key: 'men', label: '남성', value: 2490000, desc: '남성 49.8% (대한민국 기준)' },
  { key: 'women', label: '여성', value: 2510000, desc: '여성 50.2% (대한민국 기준)' },
  { key: 'preschool', label: '0~5세', value: 151000, desc: '영유아 3.0% — 저출생으로 급감 (2019~2024 출생통계)' },
  { key: 'senior', label: '65세 이상', value: 987000, desc: '노인 19.7% — 초고령사회 진입 (2024 기준)' },
  { key: 'youth', label: '청소년 9~24세', value: 744000, desc: '청소년·청년 14.8% (2001~2015 출생통계)' },
  { key: 'schoolAge', label: '학령인구 6~21세', value: 686000, desc: '초·중·고·대 학령인구 13.7% (2003~2018 출생통계)' },
  { key: 'elementary', label: '초등 연령 6~11세', value: 232000, desc: '초등 교육 대상 4.6% (2013~2018 출생통계)' },
  { key: 'middle', label: '중학교 연령 12~14세', value: 138000, desc: '중학교 교육 대상 2.8% (2010~2012 출생통계)' },
  { key: 'high', label: '고등학교 연령 15~17세', value: 136000, desc: '고등학교 교육 대상 2.7% (2007~2009 출생통계)' },
  { key: 'urban', label: '도시 인구', value: 4060000, desc: '도시 거주 81.2% (2024 기준)' },
  { key: 'rural', label: '농촌 인구', value: 940000, desc: '농촌 거주 18.8% (2024 기준)' },
  { key: 'schools', label: '학교 수', value: 1940, desc: '유·초·중·고 합계 1,940개 (대한민국 20,025개 비율 적용)' },
]

export const MINISTRY_TEMPLATES = {
  humanRights: {
    label: '인권',
    ministries: ['교육부', '보건복지부', '법무부', '문화체육관광부', '행정안전부'],
  },
  inequality: {
    label: '빈부격차',
    ministries: ['기획재정부', '보건복지부', '고용노동부', '교육부', '국토교통부'],
  },
  conflict: {
    label: '갈등',
    ministries: ['교육부', '법무부', '여성가족부', '문화체육관광부', '행정안전부'],
  },
  war: {
    label: '전쟁',
    ministries: ['국방부', '외교부', '보건복지부', '행정안전부', '교육부'],
  },
  environment: {
    label: '환경',
    ministries: ['환경부', '교육부', '행정안전부', '산업통상자원부', '국토교통부'],
  },
  education: {
    label: '교육',
    ministries: ['교육부', '문화체육관광부', '보건복지부', '행정안전부', '기획재정부'],
  },
  labor: {
    label: '노동',
    ministries: ['고용노동부', '교육부', '보건복지부', '기획재정부', '법무부'],
  },
}

// 역할 중심 모드의 역할 카드 (시행령 조항 기반 분업)
// 역할별로 시행령 한 조항씩 담당 + 관련 예산 1개 이상
export const EXECUTIVE_ROLE_CARDS = [
  {
    key: 'minister',
    title: '목적·대상 설계원 (대표)',
    body: '제1조(목적)와 제2조(대상·범위)를 작성하고, 모둠원이 쓴 모든 조항을 모아 최종 시행령을 완성합니다.',
    hints: ['이 정책의 이름과 이유는?', '도움 받을 사람과 규칙 지켜야 할 사람은?', '모든 조항을 이어 붙여 최종 시행령 완성하기'],
  },
  {
    key: 'planner',
    title: '시행 절차 설계원',
    body: '제3조(시행 절차)를 담당합니다. 누가 담당하고, 어떤 순서로 신청·선정·지원이 이루어지는지 단계별로 정리합니다.',
    hints: ['누가(어느 기관이) 담당하나요?', '신청 → 선정 → 지원의 순서는?', '실제로 하려면 무엇이 필요한가요?'],
  },
  {
    key: 'investigator',
    title: '지원 내용 설계원',
    body: '제4조(지원 내용·예산)를 담당합니다. 어떤 지원인지, 몇 명에게 얼마씩인지, 비용 근거는 무엇인지 작성합니다.',
    hints: ['무슨 지원인가요? (돈·물건·시설·프로그램?)', '몇 명에게 얼마씩 드나요?', '지원 규모의 근거(통계·사례)는?'],
  },
  {
    key: 'analyst',
    title: '점검·보완 설계원',
    body: '제5조(점검·보완·제안)를 담당합니다. 정책이 잘 되고 있는지 확인 기준, 손해 볼 수 있는 사람, 문제 생길 때 보완 방법을 정리합니다.',
    hints: ['잘 됐는지 어떻게 알 수 있나요?', '손해를 볼 수 있는 사람과 보완 방법은?', '예외 상황이 생기면 어떻게 고칠까요?'],
  },
]

export const emptyBudgetCalc = () => ({
  statKey: 'total',
  targetPercent: 100,
  targetCount: 0,
  unitLabel: '명',
  unitCost: 0,
  times: 1,
  operationCost: 0,
  promotionCost: 0,
  etcCost: 0,
})

export function calcBudget(calc, stats = BIBIM_STATS) {
  const stat = stats.find((s) => s.key === calc?.statKey) || stats[0]
  const targetPeople = Number(calc?.targetCount) > 0
    ? Number(calc.targetCount)
    : Math.round((Number(stat?.value) || 0) * (Number(calc?.targetPercent) || 0) / 100)
  const directWon = targetPeople * (Number(calc?.unitCost) || 0) * (Number(calc?.times) || 0)
  const extraWon = ((Number(calc?.operationCost) || 0) + (Number(calc?.promotionCost) || 0) + (Number(calc?.etcCost) || 0)) * 100000000
  const totalWon = directWon + extraWon
  return {
    stat,
    targetPeople,
    directWon,
    totalWon,
    totalEok: roundBudgetAmount(totalWon / 100000000),
  }
}

export function totalRequestedBudget(policies = []) {
  return roundBudgetAmount(policies.reduce((sum, p) => {
    const itemTotal = Array.isArray(p.budgetItems)
      ? p.budgetItems.reduce((s, item) => s + (Number(item.amount) || 0), 0)
      : 0
    return sum + (Number(p.requestedBudget ?? p.draftBudget) || itemTotal || 0)
  }, 0))
}

export function totalFinalBudget(policies = []) {
  return roundBudgetAmount(policies.reduce((sum, p) => {
    const itemTotal = Array.isArray(p.budgetItems)
      ? p.budgetItems.reduce((s, item) => s + (Number(item.amount) || 0), 0)
      : 0
    return sum + (Number(p.finalBudget ?? p.requestedBudget ?? p.draftBudget) || itemTotal || 0)
  }, 0))
}
