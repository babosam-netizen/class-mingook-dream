/**
 * 본회의 의결 — 집계 로직
 *
 * 현재는 1인 1표로 집계한다.
 * 복원 메모: 보상권/가중치 기능을 되살릴 때만 v1.2.28 이전처럼 v.weighted를 2표로 반영한다.
 */

export function tallyBill(votes) {
  let yes = 0, no = 0
  let yesCount = 0, noCount = 0
  for (const v of Object.values(votes || {})) {
    if (!v?.choice) continue
    if (v.choice === 'yes') {
      yes += 1
      yesCount += 1
    } else if (v.choice === 'no') {
      no += 1
      noCount += 1
    }
  }
  return {
    yes,
    no,
    yesCount,   // 명수
    noCount,
    total: yes + no,
    totalCount: yesCount + noCount,
    passed: yes > no,
  }
}
