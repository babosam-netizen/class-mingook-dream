# 제안서: 행정부(Phase 3) 데이터 흐름 정리 (Consolidation)

> 작성: 2026-06-12 [Claude] · 상태: **검토 대기(사용자 확인 후 코드 변경)**
> 배경: 예산·정책·전광판이 계속 어긋나고(제출했는데 0), 대표지정이 학급설정·빠른제어에서 따로 놀며 학생 화면에 대표가 안 뜸. 표면 버그가 아니라 **행정부 데이터 경로가 여러 곳으로 파편화**된 구조 문제로 판단됨.

---

## 1. 핵심 발견 — 같은 일을 하는 코드가 여러 벌

### (A) 대표(Representative)가 두 곳에 따로 저장 ← 사용자가 지적한 바로 그 버그
| 출처 | 저장 위치 | 누가 씀 | 누가 읽음 |
|---|---|---|---|
| **Source A (config)** | `config.branchConfig.executive.units[].representativeStudentId` | **학급설정**(BranchConfigEditor 드롭다운) | `isRepresentative`(BranchUnitWorkspace:364), 대표 배지(1814·2293), `authorStudentId`(입법·사법·행정 제출 시) |
| **Source B (역할)** | `groups/{gid}/sessionRoles/executive-default/{studentId} = 'minister'` (isRepresentative 플래그 가진 역할) | **빠른제어**(assignRepresentative), 학생 역할선택 | `myRoleIsRepresentative`(483) → `canEditFinal`(486) |

→ 빠른제어로 대표를 정하면 **Source B만** 바뀌고 Source A는 빈 채로 남음. 그래서 config를 읽는 학생 화면 표시(대표 배지/안내)는 "대표 없음"으로 뜸. 둘은 한 번도 동기화되지 않음.

### (B) 정책 제출(`policies/{gid}` 쓰기)이 4곳에서 제각각
1. `Phase3ExecutiveQuickPanel.bulkSubmitDrafts`(147) — 자동 일괄 제출
2. `ExecutiveTab.onPublish`(580) — 역할중심 대표 최종 제출(assembler)
3. `ExecutivePolicyBudgetDraft.handlePublish`(2069) — 공동작업 모드 제출
4. `ExecutivePolicyBudgetDraft.writeIntermediatePolicy`(1963) — 부분 임시저장

→ 각자 저장하는 필드 모양·예산 계산 방식이 미묘하게 달라 어떤 경로로 제출됐는지에 따라 `policyFields`/`requestedBudget`이 들어가기도, 비기도 함.

### (C) 섹션→정책 "합치기"가 서로 다른 두 로직
- `Phase3ExecutiveQuickPanel.mergeSectionContent`(111): **필드 키를 그대로 복사**(naive). 자동 일괄 제출이 이걸 씀.
- `BranchUnitWorkspace.buildExecutiveSectionMergedDoc`(249) + `mapExecutiveSectionToPolicyFields`(181): **질문답변(qna)→필드 매핑**. 대표 미리보기/최종안이 이걸 씀.

→ **같은 섹션 데이터인데 합치는 방식이 달라** 자동 제출 결과(전광판 반영)와 대표가 보는 미리보기가 불일치. "제출했는데 0/내용 없음"의 직접 원인.

### (D) 중복 정의된 헬퍼·죽은 코드
- `budgetItemTotal`: **3벌** (ExecutivePolicyBudgetDraft:153, ExecutivePolicyFinalEdit:5, BranchUnitWorkspace:100)
- `emptyPolicyFields`/`createEmptyExecutivePolicyFields`: **2벌** (ExecutivePolicyBudgetDraft:14, BranchUnitWorkspace:135)
- **정책 편집기가 3종**: `ExecutivePolicyBudgetDraft`(공동작업), `ExecutiveFinalAssembler`(역할중심 대표), `ExecutivePolicyFinalEdit`(별도 "최종 수정 폼" — 자체 budgetItemTotal 보유, 레거시 가능성). 셋 다 정책/예산을 쓴다.

### (E) 전광판 0의 구조적 원인(가설, 위 항목들의 귀결)
- 자동 일괄 제출이 **학생이 예산을 입력하기 전에 1회 실행**되어 `budgetItems=[]`로 submitted 처리 → 이후 예산 입력은 "이미 제출됨"으로 건너뜀(재반영 안 됨).
- 전광판은 `roomData.config.branchConfig`를 읽는데, 자동제출 경로(naive merge)와 매핑이 달라 `branchUnitId`/예산이 안 맞음 → 섹션 폴백도 unit 매칭 실패 시 0.

---

## 2. 정리 방향 (제안)

### 원칙: **단일 출처(single source) + 단일 변환 함수 + 단일 제출 함수**

**2-1. 대표 단일화 — 방식: 양방향 동기화 (2026-06-12 사용자 확정)**
- 우선순위 다툼을 두지 않고 **두 출처를 항상 일치**시킨다. 어느 화면에서 대표를 바꾸든 다른 출처도 같이 갱신.
  - **빠른제어** `assignRepresentative`: sessionRole(minister) 지정과 **동시에** `config…units[].representativeStudentId`도 같은 학생으로 set/clear.
  - **학급설정** 대표 드롭다운: `representativeStudentId` 변경과 **동시에** 해당 학생에게 sessionRole(isRepresentative 역할)도 부여/회수.
- 추가 안전망: 읽기용 리졸버 `resolveRepStudentId(unit, group)` 1개를 두어, 혹시 과거 데이터로 둘이 어긋나 있어도 "둘 중 하나라도 대표면 인정(OR)"으로 읽음. (동기화가 정상 동작하면 둘은 항상 같지만, 레거시 방어용)
- 효과: 어느 화면에서 대표를 정하든 학생 화면·편집권한·배지가 항상 일치.

**2-2. 변환 함수 단일화**
- `mergeSectionContent`(naive)를 폐기하고, 자동 일괄 제출도 `buildExecutiveSectionMergedDoc`(qna 매핑)을 쓰게 통일. 변환 로직을 `src/lib/executive-policy.js`(신규)로 추출해 한 곳에서 관리.

**2-3. 제출 함수 단일화**
- `submitExecutivePolicy(roomCode, unit, content)` 헬퍼 1개로 4개 경로를 수렴. `policyFields`/`budgetItems`/`requestedBudget` 모양을 한 곳에서 보장.
- 자동 일괄 제출은 **예산이 비면 submitted로 잠그지 않도록**(또는 이후 예산 반영을 막지 않도록) 정책 수정.

**2-4. 중복/죽은 코드 제거**
- `budgetItemTotal`·`emptyPolicyFields`를 `executive-policy.js`로 1벌만 두고 import.
- `ExecutivePolicyFinalEdit`가 실제로 쓰이는 단계인지 확인 후, 역할이 겹치면 제거 또는 흡수.

---

## 3. 다른 여정(입법·사법) 영향 — 사용자의 우려에 대한 답

- **공유 컴포넌트는 `BranchUnitWorkspace`**(3부 공용). 여기서 바꾸는 것은 **대표 판정(`isRepresentative`/`canEditFinal`)뿐**.
- 입법·사법은 `representativeStudentId`를 `authorStudentId` 용도로만 읽고, 편집권한은 `myRoleIsRepresentative`(입법은 billDrafter) 기준. → **리졸버를 "둘 중 하나라도 대표면 인정(OR)"으로 넓히는 변경은 기존 동작을 깨지 않고 더 관대해질 뿐**(안전).
- 변환/제출 함수 단일화(2-2, 2-3)는 **행정부 전용 파일**에서만 일어나므로 입법·사법 무관.
- 결론: **대표 리졸버만 공유 컴포넌트를 건드리고, 그마저 OR 확장이라 저위험.** 나머지는 행정부 격리.

---

## 4. 단계별 실행안 (안전 순서)

- **Phase 1 (저위험·즉효):** 대표 리졸버 도입(읽기 OR 확장) + 빠른제어/학급설정 양방향 동기화. → "학생 화면에 대표 안 뜸" 즉시 해결. 입법·사법 회귀 테스트.
- **Phase 2 (행정부 격리):** `executive-policy.js` 추출 — `budgetItemTotal`·`emptyPolicyFields`·`buildMergedDoc`·`submitPolicy` 단일화. 자동 일괄 제출을 통일 변환으로 교체 + 예산 미입력 시 잠금 방지. → 예산/정책/전광판 일치.
- **Phase 3 (정리):** `mergeSectionContent` 등 중복 제거, `ExecutivePolicyFinalEdit` 사용처 정리.

각 Phase 끝에 빌드·배포·history 기록. Phase 1은 즉시 가능.

---

## 5. 검토 포인트 (사용자가 결정/확인할 것)

> 상태: **코드 변경 보류 — 제안서 검토 중** (2026-06-12 사용자 지시)

- [x] **대표 우선순위** → "양방향 동기화"로 확정(2-1). 우선순위 없음.
- [ ] **자동 일괄 제출(bulkSubmitDrafts)을 계속 둘지**: 지금은 단계가 stage≥2로 넘어가면 1회 자동 제출됨. 예산 미입력 상태에서 잠그는 부작용의 근원. 선택지 — (a) 자동 제출 유지하되 "예산 비면 잠그지 않기"만 수정, (b) 자동 제출을 없애고 대표의 명시적 [최종 제출]만 인정. → **어느 쪽이 수업 운영에 맞나요?**
- [ ] **정책 편집기 3종 중 `ExecutivePolicyFinalEdit`**(별도 "최종 수정 폼")가 실제 수업에서 쓰는 화면인지: 현재 ExecutiveTab 특정 단계에서 렌더됨. 역할이 assembler/공동작업과 겹치면 Phase 3에서 제거 대상. → **이 "최종 수정 폼" 화면을 수업에서 쓰시나요?**
- [ ] **전광판의 대통령 예산 분리 처리**(`isPresidentPolicy`로 totalRequested에서 제외 후 presidentReserved로 별도 표시)를 유지할지. 현재 로직이 복잡도를 키우는 요인 중 하나.

## 6. 다음 행동

사용자가 위 검토 포인트를 확인/결정하면, Phase 1부터 코드 변경 착수. 그 전까지는 **읽기 전용(코드 미변경)**.

