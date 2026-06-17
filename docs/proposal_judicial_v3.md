# 사법부 v3 재정비 제안서

> 작성일: 2026-05-26
> 작성자: [Claude]
> 상태: **사용자 확인 대기**
> 영향 범위: Phase 3 사법부 전 영역 (학생 화면·교사 학급설정·빠른 제어·워크플로·여론조사·토론도구·기사·시사회 + 데이터 스키마)

---

## 1. 배경

### 현재 v2의 한계

현 사법부(v2)는 6단계로 구성:
1. 준비·역할 배정 → 2. 주장/변론서 작성 → 3. 증거 제출 → 4. 모의재판 → 5. 최종 변론·구형 → 6. 평결·선고

**한계**:
- 입법·행정에 있는 **자료 조사 단계가 없음** (학생이 변호·검사 입장에서 무엇을 조사해야 하는지 학습 부족)
- 작성된 논고서가 학급 전체에 **여론으로 노출되는 단계가 없음** (입법·행정에는 여론조사 단계가 있음)
- 토론도구의 **"토론 전 카드"가 사용되지 않음** (입론 → 본 토론 흐름 미적용)
- 작업 방식(공동작업 vs 역할중심) **모드 선택이 없음** (입법·행정에는 있음)
- 결과적으로 입법·행정·사법 3개 영역이 **다른 구조**가 되어 학생·교사 혼란

### v3 목표

**입법·행정과 동일한 8단계 구조 + 작업 방식 모드 토글**로 통일.

---

## 2. 8단계 흐름 (확정)

| # | 단계 ID | 차시 | 학생 활동 | 데이터 |
|---|---|---|---|---|
| ① | `judicial-prep` | **16차시 (준비)** | 사건 배당, 모둠별 팀 배정 확인, 모둠 내 4역할 배정 | `groups.{gid}.sessionRoles` |
| ② | `judicial-research` | 16차시 | 팀별 자료 조사 (판례·법조항·뉴스·통계) | `research/{contextKey}/{groupId}` |
| ③ | `judicial-statement` | 16차시 | 논고/변론서 작성 (공동작업 또는 역할중심) | `branchDrafts/{unitId}` |
| ④ | `judicial-poll` | 16차시 | 양측 논고 온라인 제출 → 학급 여론조사 (사전) | `polls/{judicialCaseId}/preTrial` |
| ⑤ | `judicial-debate-prep` | **17차시 (모의재판)** | 토론도구에서 입장·핵심 주장·반박 카드 정리 | 토론도구 `debate/{sessionId}/cards` |
| ⑥ | `judicial-trial` | 17차시 | 모의재판 진행 (변론 + 증인 심문) | 토론도구 `debate/{sessionId}/transcript` + `comments[trial/{caseId}]` |
| ⑦ | `judicial-verdict` | **18차시 (정리)** | 배심원 평결 투표 + 판사 판결문 선고 | `juryVotes/{caseId}` + `verdicts/{caseId}` |
| ⑧ | `judicial-article` | 18차시 | 기자 모둠 보도 기사 + 다른 모둠 자유 기사 작성 | `articles/{articleId}` |

**기존 분리된 단계 (확정: 유지)**
- `article3` (사법부 결과 기사) — 사법부 8단계 외부에서 그대로 유지
- `poll4` (사후 여론조사 3-3) — 사법부 8단계 외부에서 그대로 유지

→ `judicial-poll`(④, 사전)과 `poll4`(사후)는 **별개**. ④는 양측 입장 들은 직후 시민이 어떻게 생각하는지(사전), `poll4`는 판결 끝난 뒤 평가(사후).
→ `judicial-article`(⑧, 기자단 + 모둠 자유 보도)과 `article3`(전체 학급 기사 작성 시간)도 **별개**.

---

## 3. 작업 방식 모드 매핑 (확정)

학급 설정에서 토글 1개: **공동작업 / 역할중심**.

### 공동작업 모드 (`workMode: 'collaborative'`)

**모든 팀에 동일 규칙 적용** — 모둠 4명이 하나의 문서를 함께 작성.

| 팀 | 작성 결과물 | 섹션 |
|---|---|---|
| 검사팀 | 논고서 1건 | `prosecutionFinal` (단일) |
| 변호팀 | 변론서 1건 | `defenseFinal` (단일) |
| 증인 모둠 | 증인 진술 1건 (4명 합의) | `witnessFinal` (단일) |
| 배심원 모둠 | 평의 메모 1건 | `juryFinal` (단일) |
| 판사 모둠 | 판결문 1건 (1~2명 단독) | `judgePrep` (기존) |
| 기자 모둠 | 보도 기사 1건 | `pressFinal` (단일) |

### 역할중심 모드 (`workMode: 'role'`)

**팀별로 다르게 처리** — 옵션 B의 자동 매핑.

| 팀 | 모드 | 역할 (4역할) | 섹션 |
|---|---|---|---|
| 검사팀 | **역할중심** | 수석 검사 / 증거 검사 / 심문 검사 / 검사 보조 | `prosecutionBrief` / `prosecutionEvidence` / `questioningScript` / `prosecutionNotes` |
| 변호팀 | **역할중심** | 수석 변호인 / 증거 변호인 / 피고인 / 변호 보조 | `defenseBrief` / `defenseEvidence` / `defendantStatements` / `defenseNotes` |
| 증인 모둠 | **역할중심** | 증인 A / B / C / 변호측 증인 | 각자 `witnessStatements` (역할별 다른 캐릭터) |
| 배심원 모둠 | **공동작업** (강제) | — | `juryFinal` (역할중심 모드에서도 배심원은 4명이 함께 평의) |
| 판사 모둠 | **단독** | 판사 1명 | `judgePrep` |
| 기자 모둠 | **역할중심** | 편집장 / 취재 기자 A / B / 논설위원 | 모두 `pressFormal` (현재) — 역할별 작성 분담 |

**핵심**: 배심원만 역할중심 모드에서도 공동작업으로 강제. 다른 팀은 모드 토글에 따라 변경.

---

## 4. 데이터 스키마 변경

### `gameStore.js` `DEFAULT_CONFIG.branchConfig.judicial` 추가

```js
judicial: {
  mode: 'press_panel',          // (유지) 'press_panel' | 'all_judicial' — 기자 모둠 참여 여부
  workMode: 'role',             // 신규 'collaborative' | 'role' — 작업 방식 (기본: 역할중심)
  caseType: 'criminal',         // 유지
  currentStage: 0,              // 유지 (0~7로 확장)
  prosecution: [],              // 유지
  defense: [],                  // 유지
  witness: [],                  // 유지
  jury: [],                     // 유지
  judge: [],                    // 유지
  press: [],                    // 유지
  activeCaseId: 'byeolbit_2024',
  activeCase: null,
  evaluators: [],
}
```

### `scaffolding-data.js` `DEFAULT_ROLES.judicial` 추가 역할

공동작업 모드 전용 단일 역할(팀별 1개):
- `prosecutionLead` (검사팀 공동 작성자, `side: 'prosecution'`, `assignedSection: 'prosecutionFinal'`)
- `defenseLead` (변호팀 공동, `assignedSection: 'defenseFinal'`)
- `witnessLead` (증인 공동, `assignedSection: 'witnessFinal'`)
- `juryLead` (배심원 공동, `assignedSection: 'juryFinal'`)
- `pressLead` (기자 공동, `assignedSection: 'pressFinal'`)

→ workMode='collaborative'일 때 모둠원 전원이 이 단일 역할로 표시되어 같은 문서를 함께 편집.

### Firebase RTDB 신규 키

- `polls/{judicialCaseId}/preTrial` — ④ 사전 여론조사
- `debate/{judicialCaseId}/cards` — ⑤ 토론 전 카드 (토론도구 기존 구조 재사용)
- `debate/{judicialCaseId}/transcript` — ⑥ 모의재판 발언 기록

---

## 5. UI 변경 요약

### 학급 설정 (`BranchConfigEditor.jsx` 사법부 섹션)

**추가**: 🤝 작업 방식 토글 (`공동작업` / `역할중심`)
- 입법·행정 토글과 동일 디자인
- 도움말 박스 추가

### 학생 화면 (`JudicialTab.jsx`)

**8단계 섹션 헤더 + 게이팅 + 자동 스크롤** 재구성. 각 단계는 위 표의 데이터/컴포넌트 활용.

### 교사 빠른 제어 (`Phase3JudicialQuickPanel.jsx`)

**8단계 progress bar + 단계별 액션 버튼** 재구성.
- ② → 자료 조사 가이드 송출
- ④ → 여론조사 시작
- ⑤·⑥ → 토론도구 자동 연결
- ⑦ → 판사 판결문 잠금
- ⑧ → 기사 승인 큐

**모드 뱃지**: "🤝 공동작업 모드 진행 중" 또는 "🎭 역할중심 모드 진행 중" 항상 표시.

---

## 6. 워크플로 정의 (`PhaseWorkflow.jsx` `PHASE_STEPS.phase3`)

```
... (입법·행정 단계 그대로) ...
poll3 (사전 여론조사 3-2)

[16차시 — 준비]
judicial-prep        사법 ① 준비 및 역할 배정    (stage 0)
judicial-research    사법 ② 자료 조사            (stage 1)
judicial-statement   사법 ③ 논고/변론서 작성     (stage 2)
judicial-poll        사법 ④ 온라인 제출+여론조사 (stage 3)

[17차시 — 모의재판]
judicial-debate-prep 사법 ⑤ 토론 전 카드 정리   (stage 4)
judicial-trial       사법 ⑥ 모의재판 진행       (stage 5)

[18차시 — 정리]
judicial-verdict     사법 ⑦ 판사·배심원 평결    (stage 6)
judicial-article     사법 ⑧ 마무리 기사         (stage 7)

[사법부 단계 외부 — 기존 유지]
article3 (기사 작성 — 판결 결과를 기사로)
poll4    (사후 여론조사 3-3 — 판결에 대한 평가)

reflect, approve, gallery, closing (Phase 4)
```

기존 `judicial-witness`(④ 모의재판), `judicial-debate`(⑤ 최종 변론) 단계는 제거되고 새 단계로 흡수됨.

---

## 7. 마이그레이션 전략

### 기존 Firebase 데이터 처리

- `branchConfig.judicial.currentStage`가 0~5인 기존 방은 0~7로 자동 매핑 (대략 2배수)
- 새로 추가될 `workMode`는 기본값 `'role'` 적용
- 기존 `branchDrafts/{unitId}`는 그대로 보존 (섹션 키만 추가)

### 코드 작업 순서

1. **데이터 모델** (`gameStore.js`, `scaffolding-data.js`)
2. **워크플로 정의** (`PhaseWorkflow.jsx`)
3. **공용 컴포넌트** (`BranchUnitWorkspace.jsx` 사법부 공동작업 분기 + 신규 섹션)
4. **학생 화면** (`JudicialTab.jsx` 8단계 재구조화)
5. **교사 화면** (`BranchConfigEditor.jsx` workMode 토글, `Phase3JudicialQuickPanel.jsx` 8단계 대응)
6. **부가 연동** (여론조사, 토론도구, 기사, 시사회)
7. **모니터링** (`SubmissionMonitor`, 통계)
8. **검증** (demo24에서 학생/교사 양쪽 테스트 + 브라우저 확인)
9. **문서** (`implementation_plan.md`, `project_context.md`, `history.md`, `dev_guidelines.md`)

각 단계마다 별도 빌드/배포(`deploy.sh`)하여 검증 후 다음 단계 진행.

---

## 8. 위험 요소·열린 질문

| 항목 | 우려 | 대응 |
|---|---|---|
| 토론도구 연동 | `judicial-debate-prep`/`judicial-trial`에서 토론도구를 어떻게 자동 시작할지 (기존 선거 토론·입법 토론과 다른 사건 컨텍스트) | 토론 세션 생성 시 `caseId` 메타 추가, 사법부 전용 모드 추가 |
| 여론조사 ④ vs poll4 | 두 여론조사가 비슷해 보일 수 있음 (혼동) | ④는 "사건 듣고 첫인상", poll4는 "판결 보고 평가"로 안내 문구 명확히 |
| 기자 모둠 ⑧ vs article3 | 기자 모둠은 자동 보도, article3은 학급 전체 기사 시간 — 중복 가능성 | article3은 "전 학급 보도 + 시사회", ⑧은 "기자 모둠 전담 보도"로 역할 분리 |
| 작업량 | 8단계 전면 재구조화 + 모드 분기 + 4개 신규 연동 — 한 세션에 끝낼 수 없음 | 단계별 배포 (위 작업 순서대로 9단계) |

---

## 9. 사용자 최종 확인 사항

1. ✅ `article3` / `poll4` 분리 유지 — **확정**
2. ✅ 16~18차시 3차시 유지, 준비(16) / 모의재판(17) / 정리(18) — **확정**
3. ✅ workMode 토글 (공동작업/역할중심) — **확정**
4. ✅ 역할중심 모드에서 배심원만 공동작업 강제 — **확정**
5. ⏳ **이 제안서 전체 승인 여부** — 사용자 확인 필요

승인되면 위 작업 순서대로 단계별 진행 시작.
