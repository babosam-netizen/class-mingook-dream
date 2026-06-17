# 사법부 다단계 워크플로 구축 및 행정·사법 빠른 제어 UI 통일화 계획

본 계획은 교사용 화면의 빠른 제어 패널(입법·행정·사법) 간의 디자인 및 로직 일관성을 강화하고, 사법 활동을 다단계(6단계) 흐름으로 세분화하여 학생용 사법부 화면에 게이팅 및 오토 스크롤을 이식하기 위한 구체적인 구현 방안을 기술합니다. 공동작업 모드(collaborative)는 완성 단계이므로 절대 침범하지 않으며 오직 역할중심 모드 관점에서 안정적으로 통합합니다.

---

## 📒 수정 누적 로그 (Modification Log)

> **사용 규칙**: 이 문서(`implementation_plan.md`)와 `implementation_plan_v4_1.md`는 초기 설계 PRD다.
> 이후 실제 수정은 PRD 본문을 갈아엎지 않고, **각 수정에 이름을 붙여 아래 표에 한 줄씩 누적**한다.
> 최신이 위로 오도록 시간 역순으로 적는다.
>
> **상태 표기**: ✅ 수정완료 · 🔶 부분 적용 · ⏸ 보류

| 수정명(이름) | 날짜 | 상태 | 요약 / 다음에 할 일 | 관련 |
|---|---|---|---|---|
| 전광판 섹션 예산(branchDrafts) 폴백 합산 | 2026-06-08 | ✅ 수정완료 | 정책 예산 비면 섹션 예산 합계로 표시(`budgetOf` 폴백). | v1.7.2 |
| 역할중심 제출 예산이 전광판 0(빈배열 truthy) | 2026-06-08 | ✅ 수정완료 | `mergedFinalDoc` resultBudgets를 finalBudgets.length>0로 판정. | v1.7.1 |
| 교사 빠른제어 초안/예산 작성내용 클릭 확인 | 2026-06-08 | ✅ 수정완료 | `Phase3ExecutiveQuickPanel` 상세 모달(역할 카드/공동작업 카드 클릭). | v1.7.0 |
| 예산 전광판 제출정책 예산 반영(항목합계 폴백) | 2026-06-08 | ✅ 수정완료 | `ExecutiveBudgetReviewBoard` budgetOf — draftBudget 없으면 budgetItems 합계. | v1.6.9 |
| 대통령실 대표 최종검토/조립 부처와 동일화 | 2026-06-08 | ✅ 수정완료 | 조립기 대통령 전용 분기(옛 키) 제거, 부처 공통 분기 적용. | v1.6.8 |
| '작성본 모두 불러오기' 일부 내용 2번 들어가던 중복 | 2026-06-08 | ✅ 수정완료 | 제1조 purpose·problem 중복(Set 제거), 조립기 txt 폴백 제거. | v1.6.7 |
| 대표 최종검토 '작성본 모두 불러오기' 설명·경고·저장 | 2026-06-07 | ✅ 수정완료 | 버튼 설명, 직접수정 있으면 confirm 후 새로 불러오기, 불러온 즉시 저장. | v1.6.6 |
| 역할중심 통합 미리보기 누락(제3조 등)+원문 폴백 | 2026-06-07 | ✅ 수정완료 | decree q0+q1 합침, 미리보기/조립기에 섹션 원문(text) 폴백. | v1.6.5 |
| 역할중심 시행령 최종조립 1~5조 비던 버그 | 2026-06-07 | ✅ 수정완료 | `ExecutiveFinalAssembler`가 원시 필드만 읽어 qna 저장분 누락. `fieldsOf`로 qna→조항필드 변환. | v1.6.4 |
| 행정부 초안 일괄 제출 단계전환 시 자동 실행 | 2026-06-07 | ✅ 수정완료 | stage≥2 진입 시 `bulkSubmitDrafts` 1회 자동(마커). 버튼만이라 안눌러 'saved' 남던 문제 해결. | v1.6.2 |
| 행정부 토의평가 작성분 일괄 제출 + 평가 중 즉시 수정 | 2026-06-07 | ✅ 수정완료 | 교사 "일괄 제출" 버튼(`bulkSubmitDrafts`), 토의화면 우리 모둠 "수정하기"→인라인 편집·재제출. | v1.6.1 |
| 공동작업 대통령실 국무회의 준비 페이지 | 2026-06-07 | ✅ 수정완료 | PresidentControlPanel(공약·업무지시·대본)+자료실. 대본→토론도구. | v1.6.0 #1 |
| 토론도구 "나머지 전부 평가단" 일괄 | 2026-06-07 | ✅ 수정완료 | `setRestAsEvaluators`(미배정만). | v1.6.0 #2 |
| Phase4 갤러리워크 전부 펼침 + 글쓴이만 답글 | 2026-06-07 | ✅ 수정완료 | `ReflectionCard` 펼침, `CommentList` ownerStudentId. | v1.6.0 #3 |
| Phase4 캔바 평가활동 별점순 전체 스크롤 | 2026-06-07 | ✅ 수정완료 | 상위4 제한 제거. | v1.6.0 #4 |
| 공동작업 제출 후 임시저장이 status 강등하던 버그 | 2026-06-07 | ✅ 수정완료 | `handleSaveDraft`/`handleSavePart`에서 getOnce로 DB status 확인 후 제출 상태면 저장 차단. | v1.5.2 |
| 행정부 초안 제출 교사 취소→재제출 | 2026-06-07 | ✅ 수정완료 | 공동/역할중심 공통. 빠른제어 "↩️ 제출 취소" → finalDoc 'draft' + policies 'saved'(내용 보존). | v1.5.1 |
| 제출물 열람 "시간별 모아보기" 타임라인 탭 | 2026-06-07 | ✅ 수정완료 | 신규 `SubmissionTimeline` — 여러 노드 통합, 날짜별 섹션+날짜 필터, 클릭 시 본문 펼침. | v1.5.0 |
| ② 초안작성 자료실 입력창 제거→준비 요약(읽기전용) | 2026-06-07 | ✅ 수정완료 | 신규 `ExecutivePrepSummary`(수집자료+대표 할일+비슷한 시행령·참고자료 읽기전용). | v1.4.8 |
| ② 초안작성 단계 상단 통과 법안 확인 | 2026-06-07 | ✅ 수정완료 | `PassedLawPrepPanel` 상단 노출. | v1.4.7 |
| 교사 빠른제어에서 대표 직접 지정 | 2026-06-06 | ✅ 수정완료 | 부처별 현황에 "👑 대표 지정" 드롭다운(모둠원 중 대표 역할 부여, 기존 대표 해제). | v1.4.6 |
| 교사 빠른제어 역할및준비 라벨·역할배정 가독성·대표·워드클라우드/할일 | 2026-06-06 | ✅ 수정완료 | `Phase3ExecutiveQuickPanel` 라벨 변경, 역할 카드 2줄(이름 크게+대표 배지), 부처 현황에 워드클라우드+할일 표시. 잠금은 기존. | v1.4.5 |
| 비슷한 시행령 참고자료 구버전도 삭제 | 2026-06-06 | ✅ 수정완료 | ownerId=r.by\|\|r.id. | v1.4.4 |
| 행정부 ① 순서 재정비(자료실 통합) + 참고자료 다중 추가 | 2026-06-06 | ✅ 수정완료 | 가결법령·근거자료실을 ① 흐름 안으로(역할→근거기사→워드클라우드→할일→비슷한시행령). 참고자료 다중([추가] 버튼, 링크+메모). | v1.4.3 |
| 부처별 정책뉴스(korea.kr) 링크 기사자료수집으로 이동 | 2026-06-06 | ✅ 수정완료 | `ResearchWorkspace` referenceLinks prop. | v1.4.2 |
| 워드클라우드 한글 IME 이중입력 수정 | 2026-06-06 | ✅ 수정완료 | isComposing 가드 + 재진입 잠금. | v1.4.1 |
| 행정부 ① "역할 및 준비" 단계 신설(역할 나누기 앞으로+준비활동) | 2026-06-06 | ✅ 수정완료 | 역할중심 전용. 역할 나누기를 ① 맨 앞으로, ②는 초안만. `BranchUnitWorkspace` executivePhase 분할, 신규 `ExecutivePrepPanel`(워드클라우드/할일/비슷한 시행령/참고자료), 자료실 korea.kr 링크. 새 노드 `branchDrafts/{unitId}/prep/*`. | v1.4.0 |
| 역할중심 시행령 작성기에 통과 법안 보기 | 2026-06-06 | ✅ 수정완료 | `ExecutiveSectionEditor` 상단에 통과(가결) 법안 접기 패널 추가. 역할중심 모드에서 통과 법안이 안 보이던 문제 보완. | v1.3.8 |
| 기사 본문 글자수 400 → 1000자 | 2026-06-06 | ✅ 수정완료 | `ArticleEditor` maxLength·카운터 1000자. | v1.3.7 |
| 기사 수정 중 내용 사라짐/되돌아감 버그 | 2026-06-06 | ✅ 수정완료 | `ArticleEditor` 수정 모드에서 실시간 구독본(`articleData`)이 갱신될 때마다 폼이 서버 저장본으로 리셋되던 문제. `initializedFor` ref로 같은 기사 id는 1회만 초기화. | v1.3.6 |
| 제출물 열람 — 기사 유형별(여정/토론후) 구분 | 2026-06-06 | ✅ 수정완료 | `SubmissionStatusQuickPanel` 기사 단계(article1/2/3)를 여정·토론후 그룹으로 나눠 이름과 함께 표시, 기사 제목 클릭 시 본문 펼침. | v1.3.5 |
| 국무회의 대본 타이머 노출 | 2026-06-06 | ✅ 수정완료 | `CabinetScriptBox` — 국무회의 토론에서 대통령실 타이머 밑 진행 대본 노출. | v1.3.4 #1 |
| 업무지시 → 온라인 토의(시행령 문서) 노출 | 2026-06-06 | 🔶 부분 적용 | 토의 카드에 "부처별 업무지시" 블록 노출 완료. **남음**: 최종 시행령 뷰어 본문에 자동 합쳐 표기(미적용). | v1.3.4 #2 |
| 대통령실 대표 호칭 '장관'→'비서실장' | 2026-06-06 | ✅ 수정완료 | `BranchUnitWorkspace`/`ExecutiveFinalViewer` repLabel. | v1.3.4 #3 |
| 제출물 열람 — 주제 필터 + 빈칸(빈칸) 전체 양식 | 2026-06-06 | ✅ 수정완료 | `SubmissionMonitor` 토론 주제별 필터 + 토론카드 4항목 전체·빈칸 표기. | v1.3.4 #4 |
| 대통령실 — 공약선택·부처 업무지시·국무회의 대본·예산 예약분 | 2026-06-05 | ✅ 수정완료 | `PresidentControlPanel` + 예약분 계산. | v1.3.3 |
| 대통령실 — 공약 연계 시행령 모델(역할/엔진 재사용) | 2026-06-05 | ✅ 수정완료 | `executive_president` 역할 부처 미러로 교체, `PresidentWorkspace` 제거. | v1.3.2 |
| 대통령실 지정 라우팅 버그 | 2026-06-05 | ✅ 수정완료 | 지정한 대통령 모둠이 일반 부처 폼으로 떨어지던 문제. | v1.3.1 |
| 공동작업 모드 대통령실 적용 | — | ⏸ 보류 | 현재 역할중심 모드 기준. 공동작업 모드 적용은 추후. | proposal rev1 |

## User Review Required

> [!IMPORTANT]
> 공동작업 모드(`collaborative`)의 소스 코드(기존 입법/행정부 활동 완성본)는 일절 수정하지 않고, 역할중심 모드의 관점에서 추가적인 로직을 이식합니다.

> [!NOTE]
> 사법부 모의재판도 입법부/행정부와 동일하게 `debateSessions` 노드를 활용해 다자/라운드 토론 세션을 교실 전광판 및 학생 토론 도구와 유기적으로 연결합니다.

## Proposed Changes

### [Common & Workflow]

#### [MODIFY] [PhaseWorkflow.jsx](app/src/components/teacher/PhaseWorkflow.jsx)
- `PHASE_STEPS[3]`의 기존 단일 `judicial` 단계를 제거하고, 6단계(`judicial-prep`, `judicial-statement`, `judicial-evidence`, `judicial-witness`, `judicial-debate`, `judicial-verdict`)로 확장하여 고도화합니다.
- `judicial-`로 시작하는 단계들은 교사용 진행 가이드 리스트 상에서 `⚖️ 사법부 활동 진행`이라는 하나의 항목으로 그룹화하여 단순하게 렌더링되도록 묶음 로직을 구현합니다.

### [Teacher Dashboard Components]

#### [MODIFY] [Phase3ExecutiveQuickPanel.jsx](app/src/components/teacher/Phase3ExecutiveQuickPanel.jsx)
- 기존 가로 `h-1.5` 진행 바 레이아웃을 입법부와 동일하게 원형 숫자(dot) + 하단 텍스트(label) + 연결선(line) 방식의 **Pattern C** 디자인으로 리팩토링합니다.

#### [NEW] [Phase3JudicialQuickPanel.jsx](app/src/components/teacher/Phase3JudicialQuickPanel.jsx)
- 사법부 6단계 흐름을 직관적으로 제어할 수 있는 교사용 퀵패널 컴포넌트를 신설합니다.
- **Pattern C** progress bar 디자인 적용 (Rose/Crimson 테마).
- 이전 단계 / 다음 단계 제어 버튼과 단계별 교사용 가이드를 표시합니다.
- 사건이 투입되지 않았을 때 NPC 사건 프리셋 목록과 [사건 투입] 버튼을 제공하며, 투입 완료 시 사건 정보와 [🗑️ 사건 삭제] 버튼을 노출합니다.
- [🎙️ 모의재판 시작] 버튼을 배치하여 검사 모둠(`proStudents`), 변호인 모둠(`conStudents`), 배심원/평가단(`evaluators`)을 자동 매핑하고 다자토론/라운드토론 세션을 실시간으로 생성합니다.
- 배심원 평결 현황(유죄/무죄 투표 수 및 누적률 바)을 실시간으로 중계합니다.
- 판사의 최종 판결문 작성 상태 및 작성된 본문을 조회할 수 있도록 구성합니다.

#### [MODIFY] [TeacherDashboard.jsx](app/src/pages/TeacherDashboard.jsx)
- 상단에 신설된 `Phase3JudicialQuickPanel`을 임포트합니다.
- `currentPhase === 3 && (wf.currentStep?.highlight === 'judicial' || wf.currentStep?.id?.startsWith('judicial-'))` 조건 하에 퀵패널을 렌더링하도록 변경합니다.

### [Student View Components]

#### [MODIFY] [JudicialTab.jsx](app/src/components/phase3/JudicialTab.jsx)
- 입법부(`LegislativeTab.jsx`)와 완벽히 대칭되는 게이팅 및 스크롤 아키텍처를 도입합니다.
- `STAGE_OF_STEP` 매핑 추가 및 `modeFor` 판별 헬퍼 작성.
- 각 섹션(준비 자료실, 역할 배정/작업공간, 사건 브리핑/변론토론, 배심원 평결 및 판결문)을 `sectionWrap`으로 묶고, 미래 단계는 `hidden`으로 숨기며, 지나간 단계는 `pastClass`로 블러 처리 및 클릭 비활성화를 적용합니다.
- `useRef`를 각 섹션 앵커에 할당하고 `scrollIntoView` 메커니즘을 적용하여 교사가 단계를 넘길 때 활성 영역으로 부드럽게 오토 스크롤을 실행하도록 구성합니다.

## Verification Plan

### Automated Tests
- 로컬 개발 서버를 빌드(`npm run build`)하여 문법 에러 및 번들링 성공 여부를 검증합니다.

### Manual Verification
- 교사 대시보드와 학생용 사법부 화면을 양옆에 띄워 단계 이동 시 실시간으로 게이팅(블러/숨김) 및 오토 스크롤이 매끄럽게 연동되는지 검증합니다.
- 교사 대시보드 사법부 퀵패널에서 사건 투입, 토론 시작(토론 도구 연동), 판결 확인 흐름이 막힘 없이 동작하는지 테스트합니다.
- 공동작업 모드로 설정 시 행정부와 입법부 화면이 이상 없이 공동작업 상태로 유지되고 동작하는지 검토합니다.
