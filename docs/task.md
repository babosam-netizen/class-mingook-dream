# 현재 작업 메모 (최종 갱신 2026-06-17 / v1.7.36)

## `[구현 완료·배포]` 사법부 판결중심 9개 개선 (v1.7.36, 2026-06-17) [Claude]
- 활동메모 통합(`JudicialActivityMemo`)·대본 강조·참관판사 명칭/평가노출 기본ON·증거TV 초기화·기사단계 평가 회수.
- 상세: `history.md` v1.7.36, `project_context.md` §3-0.
- **미검증**: 판결중심 라이브 룸 인터랙티브 검증(룸·학생 로그인 필요).

## `[구현 완료·배포]` 대통령 승인 버그 + 행정부 대표 양방향 동기화 (v1.7.34~35, 2026-06-16) [Claude]
- v1.7.34: `normalizeRoleList` 대통령 역할 잘림 수정 → 대통령 승인 보드 정상 표시.
- v1.7.35: **대표 양방향 동기화 구현(아래 검토대기 항목의 Phase 1 완료)** — `lib/representative-sync.js`, 학급설정 대통령 대표 selector 신설, `isPresidentLeader` 두 출처 OR.
- ⚠️ 레거시 방: 구버전 지정 대통령 대표(`minister` 키)는 **다시 지정** 필요.

## `[구현 완료·배포]` 행정부 워크플로 집중 개편 (v1.7.6~v1.7.28, 2026-06-15) [Claude]
- 온라인토의: 부처 답글·작성자 수정삭제·초안수정 중 의견유지·대통령실 평가잠금 해제.
- 대통령 승인 보드 신설(단계 스텝퍼·초안↔최종 차액·반려(사유)) + 합계를 현황판과 일치(발의된 부처만).
- 대통령실 역할분리: 대표(`pledge_purpose`)=승인만, 모둠원=시행령 수정만.
- 대통령실 정합성: 발의(finalDoc locked) 후 policies 누락 → 교사 빠른제어 자가치유 + FinalEdit finalDoc 폴백.
- 국무회의: 토론준비 모달(설문·팀·절차), 타이머 [시행령 보기↗] 새창, 대본+업무지시 노출.
- 빠른제어: 부처 카드 평점 배지+상세모달, 최종안 보기(작성중도), 눈 아이콘 제거.
- 상세: `history.md` v1.7.6~v1.7.28, `project_context.md` §3-0.
- **남은 근본 과제(미착수)**: 행정부 데이터흐름 구조 통합 → 아래 검토대기 항목 / `proposal_executive_consolidation.md`.

## `[검토 대기 — 코드 변경 보류]` 행정부 데이터 흐름 정리 (2026-06-12 / [Claude])

제안서: `docs/proposal_executive_consolidation.md`
- **배경**: 예산·정책·전광판이 계속 어긋남(제출했는데 0), 대표지정이 학급설정·빠른제어 따로 놀아 학생 화면에 대표 안 뜸. → 표면 버그 아니라 **행정부 경로 파편화** 구조 문제로 진단.
- **발견**: ①대표 2곳 따로 저장(config vs sessionRoles, 미동기화) ②정책 제출 4경로 제각각 ③섹션→정책 합치기 2종(naive vs qna매핑) ④중복(budgetItemTotal 3벌·편집기 3종)·죽은코드 ⑤자동일괄제출이 예산 입력 전 잠금.
- **확정**: 대표 단일화는 **양방향 동기화**(우선순위 없음, 둘 항상 일치) — 사용자 결정.
- **사용자 지시**: 지금은 **코드 변경 말고 제안서만 검토**. 제안서 §5 검토포인트(자동제출 유지여부 / ExecutivePolicyFinalEdit 사용여부 / 대통령 예산분리 유지)에 사용자 결정 필요.
- **진행**: ✅ Phase 1(대표 양방향 동기화) v1.7.35에서 완료. 남은 검토 포인트(자동제출 유지여부 / ExecutivePolicyFinalEdit 사용여부 / 대통령 예산분리)는 여전히 사용자 결정 대기.
- 진행 전까지 v1.7.x 행정부 예산/전광판 표면 패치(v1.6.9~v1.7.4)는 임시방편 상태로 유지.



## `[구현 완료·배포]` 대통령실 개편 — 공약 연계 시행령·예산 (2026-06-05 / [Claude])

제안서: `docs/proposal_president_pledge_decree_2026-06-05.md` (rev1)
- ✅ v1.3.1: 대통령실 라우팅 버그 수정.
- ✅ v1.3.2(증분1): `executive_president` 역할을 일반 부처 미러(시행령 요소 4 + 예산 1개씩, 공약 프레이밍)로 교체 + 부처 엔진 재사용, `PresidentWorkspace` 데드코드 제거.
- ✅ v1.3.3(증분2~4): `PresidentControlPanel`(공약 선택·부처 업무지시·국무회의 대본 자동생성) + 예산 예약분(전광판·교사 패널).
- **남은 검증(인터랙티브, 라이브 방)**: 대통령 모둠 지정 → 공약 1개 선택 → 시행령 요소별 작성/예산 → 업무지시 → 대본 자동생성 → 전광판에서 👑예약분 분리 표시 확인.
- **향후(선택)**: 업무지시를 최종 시행령 뷰어에 합치기 / 대본 전광판 노출 / 공동작업 모드 적용.

## 최근 완료 — 사법부 2모드 재정의 (판결중심/역할중심) (v1.2.309, 2026-05-28 / [Claude])

제안서 `docs/proposal_사법부_2모드_재정의_2026-05-28.md` (사용자 승인) 전 항목 구현·배포 완료.
- ✅ 데이터: `workMode: verdict|role` 재정의 + collaborative→verdict 마이그레이션, 사건 JSON `trialScript`.
- ✅ 워크플로: `getPhaseSteps(phase, workMode)`, 판결중심 7단계(verdict-*), 기사·여론조사 article3/poll4 공통.
- ✅ 학생: `JudicialTab` 래퍼 분기 + 신규 `JudicialVerdictTab`(쟁점/대본뷰어/판결문/비교토의).
- ✅ 교사: `Phase3JudicialQuickPanel` verdict 분기 + 준비단계 빠른제어 강화(연기3팀 지정·대본·체크리스트).
- ✅ 학급설정 토글 라벨 변경, AI 프롬프트 trialScript 생성 추가.

### `[ ]` 남은 검증 (다음 세션/사용자) — **인터랙티브 미수행**
- demo24에서 학급설정 → 사법부 활동 방식 **판결중심** 선택 → 빠른제어 준비단계에서 사건·대본 만들기 / 연기 3팀 지정 동작 확인.
- 학생 화면: 연기팀이 자기 대사만 보는지, 참관팀은 메모/판결문 작성되는지, 게시된 판결문이 ⑤ 비교토의에 모이는지.
- 기존 역할중심 방이 그대로 동작하는지(회귀 없음) 확인.
- AI(Claude/ChatGPT/Gemini)로 판결중심 사건 생성 → trialScript 포함 JSON 업로드 → 적용 확인.

## (이전) 진행 중 (사용자 승인 완료 2026-05-26)

- `[진행 중]` **사법부 v3 — 9단계 작업 (Phase 1/9 완료)** (제안서: `docs/proposal_judicial_v3.md`)
  - ✅ Phase 1: 데이터 모델 (`gameStore.judicial.workMode`, `scaffolding-data` lead 역할 5종) — v1.2.268
  - ✅ Phase 2: 워크플로 8단계 정의 (`PhaseWorkflow.PHASE_STEPS.phase3`) — v1.2.268
  - ⏳ Phase 3: 공용 컴포넌트 — `BranchUnitWorkspace` 공동작업 분기 + 신규 섹션 (`prosecutionFinal` 등)
  - ⏳ Phase 4: 학생 화면 — `JudicialTab` 8단계 전면 재구조화 (자료조사·여론조사·토론전카드·마무리기사 정식 섹션)
  - ⏳ Phase 5: 교사 화면 — `BranchConfigEditor` workMode 토글 + `Phase3JudicialQuickPanel` 8단계 progress bar
  - ⏳ Phase 6: 부가 연동 — 여론조사(④), 토론도구(⑤·⑥), 기사(⑧), 시사회
  - ⏳ Phase 7: 모니터링 — `SubmissionMonitor` 8단계 지원
  - ⏳ Phase 8: 검증 — demo24 학생/교사 테스트
  - ⏳ Phase 9: 문서 — `implementation_plan.md`, `project_context.md`, `dev_guidelines.md` 최종 업데이트

---

## 보류 (Deferred — 나중에 입법부 법안이 실제로 통과된 다음 작업)

- `[보류]` **사법부 — 통과된 법안 자동 선택 → AI 사건 시나리오 생성 기능** (2026-05-25 / [Claude])
  - **배경**: 현재 사법부 재판은 별빛 편의점 임금체불 사건(`byeolbit_2024` 프리셋)으로 고정.
    원래 설계 의도는 *입법부에서 통과된 법안을 위반한 사건*을 재판으로 다루는 것이지만, 아직 입법부에서 실제 법안이 나오지 않아 임시로 편의점 사건 사용.
  - **앞으로 만들 기능**:
    1. **학급설정 → 사법부**에 "통과된 법안에서 사건 만들기" 드롭다운 추가
    2. Firebase `rooms/{rc}/bills/{billId}` 중 `status: 'passed'`인 법안 목록을 자동 로드
    3. 교사가 법안 하나를 선택하면, 그 법안의 조항·취지가 AI 프롬프트의 `[관련 법]` 자리에 자동 삽입된 채로 .txt 다운로드
    4. 교사는 AI에 붙여넣어 JSON 받기 → 학급설정 업로드 → "이 사건으로 재판 열기"
  - **현재는 수동 우회 가능**: AI 프롬프트 다운로드 후 `[관련 법]` 칸에 통과된 법안 조항을 교사가 직접 복사·붙여넣기.
  - **착수 조건**: 입법부에서 실제로 법안이 통과되어 `bills/{billId}` 에 `status: 'passed'`인 데이터가 생긴 다음에 구현. (지금 만들어두면 테스트할 데이터가 없음.)

---

## 다음 작업 (확인 대기)

- `[ ]` **v1.2.237 사법부 검증 + 후속 기능** — v1.2.236 배포 후 실제 사용 전 확인 항목:
  - 교사 학급 설정 → 모드 토글(언론패널/전원사법) 동작 확인
  - 프리셋 선택 드롭다운 → "별빛 24시" 적용 → `branchConfig.judicial.activeCase` Firebase 기록 확인
  - JSON 파일 업로드 → 유효성 검사 → 적용 → 학생 화면 사건 자료실 갱신 확인
  - 7단계 progress bar — 현재 단계 표시·전진·후진 동작 확인
  - 학생용 사건 자료실(`JudicialCaseRoom`) 탭별 (사건배경·증거·증인·피고인진술·역할힌트) 동작 확인
  - 단계 진행에 따른 `revealedAtStage` 필터 작동 확인 (증거 단계적 공개)
  
- `[ ]` **AI 프롬프트 가이드 학급용 안내** — `docs/judicial-case-ai-prompt.md`를 선생님에게 공유 (링크 or 출력)

- `[ ]` **사법부 — 피고인·증인 역할 학생 진술서 제출** (모드 B 전용):
  - 모드 B(전원사법) 편성 시 `witness`/`defendant` 역할 학생이 진술서를 입력·저장하는 UI 추가
  - Firebase `rooms/{roomCode}/judicialStatements/{studentId}` 경로 저장

- `[ ]` **사법부 — 교사가 현재 단계(currentStage)를 Firebase에 기록** → 학생 화면 자동 갱신:
  - 현재 `JudicialCaseRoom`은 `currentStage` prop으로 받는데, 교사 제어 → Firebase → Zustand 구독 경로가 아직 미구현
  - `branchConfig.judicial.currentStage`를 교사가 단계 이동 시 동기화 필요

## 완료

- `[x]` v1.2.236 [Claude]: 사법부 v2.0 — `judicial-case-data.js`, `JudicialCaseRoom.jsx`, BranchConfigEditor 모드토글·프리셋·JSON업로드 UI, 7단계 progress bar, Phase3JudicialQuickPanel 리팩토링. 빌드 오류(`activeCase` 이중선언) 수정 후 배포 완료.
- `[x]` v1.2.235 [Claude]: `gameStore.js`에서 Firebase 저장 `config.roles`(구버전 라벨 오염)를 무시하고 항상 `DEFAULT_CONFIG.roles`(현재 코드 역할 정의)를 사용하도록 수정 → 교사 빠른제어·학생 화면에서 "정책기획자" 구버전 라벨 표시 근본 수정.
- `[x]` v1.2.235 [Claude]: `BranchUnitWorkspace.mapExecutiveSectionToPolicyFields()`의 `decree` 섹션이 `fields.ordinance`(최종 어셈블러 전용)에 쓰던 버그 수정 → `fields.content`로 정정.
- `[x]` v1.2.234 [Claude]: `EXECUTIVE_ROLE_CARDS` 구 이름("정책기획관" 등) → 시행령 기반 4역할명으로 수정.
- `[x]` v1.2.234 [Claude]: `decree` 섹션의 `fields.ordinance` 충돌 제거 (최종 어셈블러 전용 필드와 충돌하던 문제). `fields.content` 단일 필드로 단순화.
- `[x]` v1.2.234 [Claude]: 섹션 에디터 헤더를 "시행령·근거 초안 작성" → "{sectionLabel} 초안 작성" 역할별 맞춤 표시.
- `[x]` v1.2.234 [Claude]: `loadPreviewToEditor()`에 역할중심 전용 조항 조립 로직 추가 (제1조~제5조 순서 자동 조립).
- `[x]` v1.2.234 [Claude]: `ExecutiveSectionViewer` 섹션별 레이블 개선.
- `[x]` v1.2.234: `npm run build` 통과, 배포 완료.
- `[x]` v1.2.233 [Claude]: 행정부 4역할(+추가 3역할) 안내 문구(`memoGuide`/`todos`/`sectionPlaceholder`/`sosWhen`)를 초등 6학년 눈높이로 평이하게 다듬음. 한자어/딱딱한 Q1/Q2 형식을 풀어씀.
- `[x]` v1.2.233 [Claude]: 역할중심 모드 [최종안 직접 수정하기]가 공동작업 모드의 시행령 작성 질문 도우미를 그대로 노출하던 문제 분리. `ExecutiveFinalAssembler`에 `isCollaborative` prop 추가하여 역할중심에서는 시행령 최종본 textarea + 예산 통합 편집만 노출.
- `[x]` v1.2.233 [Claude]: 문구 수정 중 발생한 `scaffolding-data.js`의 유니코드/ASCII 따옴표 충돌 일괄 복구.
- `[x]` v1.2.233: `npm run build` 통과, 빌드·배포 완료.
- `[x]` v1.2.231 [Codex]: 다른 모둠 정책안 제출·예산 청구액 통합 표시.
- `[x]` v1.2.232 [Antigravity]: 구버전 역할명 마이그레이션 예외 보완 + 누락 배포 수동 재실행.
- `[x]` 행정부 ② 초안 작성 영역 제목/설명을 공동작업 모드와 역할중심 모드별로 분리.
- `[x]` 공동작업 모드 설명: 하나의 정책·시행령·예산 템플릿을 함께 읽고 수정하며 완성.
- `[x]` 역할중심 모드 설명: 각자 맡은 정책 파트와 예산 항목을 저장하고, 저장본을 바탕으로 대표가 최종 정책보고서를 정리.
- `[x]` `ExecutiveProgressGuide`의 ② 단계 학생/교사 안내 문구도 같은 기준으로 수정.
- `[x]` `APP_BUILD` v1.2.230 반영, `npm run build` 통과 및 빌드·배포 완료.
- `[x]` 행정부 역할중심 모드의 `역할 선택 및 모둠 현황`을 왼쪽 컬럼에서 상단 전체폭 보드로 이동.
- `[x]` 역할 카드를 화면 폭에 따라 4개 한 줄 또는 2x2로 정렬되게 조정.
- `[x]` 하단 2컬럼은 왼쪽 역할별 섹션 초안, 오른쪽 예산 청구 및 편성/다른 모둠 현황 중심으로 남겨 좌우 균형 보정.
- `[x]` 공동작업모드는 수정하지 않음. 이번 변경은 행정부 역할중심 화면 배치에 한정.
- `[x]` `APP_BUILD` v1.2.229 반영, `npm run build` 통과 및 빌드·배포 완료.
- `[x]` 행정부 역할중심 기본 4역할을 정책안 파트 기준으로 정리: 배경·필요성, 시행령·집행계획, 시민영향·대응, 기대효과·점검.
- `[x]` 4명 모두 자기 정책 파트와 연결된 예산 항목을 1개 이상 작성하도록 역할 안내와 할 일 문구 수정.
- `[x]` 추가 예시 역할의 `예산 조율원`을 `예산 검토원`으로 변경하고, 예산을 대신 쓰는 사람이 아니라 중복·산출식·총액을 점검하는 보조 역할로 설명 수정.
- `[x]` 하단 자동 조립 미리보기는 최종 보고서 카드 대신 1~4번 초안 작업판으로 표시. 정리된 정책보고서 형태는 대표 최종 검토 창에서만 유지.
- `[x]` 공동작업모드는 수정하지 않음. 이번 변경은 행정부 역할중심 역할 안내와 자동 조립 미리보기 표현에 한정.
- `[x]` `APP_BUILD` v1.2.228 반영, `npm run build` 통과 및 빌드·배포 완료.
- `[x]` 행정부 역할중심 모드 하단의 개인 초안 원문 미리보기를 `우리 부처 통합 정책·예산안 초안 미리보기`로 교체.
- `[x]` 역할별 저장 Q&A를 정책보고서 필드로 변환하는 매핑 추가: 정책 뼈대, 시행령, 근거와 사례, 국민 눈높이 반영, 기대효과, 토론 대비책, 예산 항목.
- `[x]` 각 역할 저장본이 통합 미리보기판에 반영되었는지 상태 카드로 표시.
- `[x]` 대표 최종 검토는 별도 편집기로 유지하고, 대표가 저장 버튼을 누르기 전 입력 중인 내용도 같은 부처 구성원에게 실시간 반영되도록 유지.
- `[x]` 대표 자동 저장 디바운스를 1초로 조정해 Firebase 무료 사용량 부담을 줄임.
- `[x]` 공동작업모드는 수정하지 않음. 이번 변경은 행정부 역할중심 모드에 한정.
- `[x]` `APP_BUILD` v1.2.227 반영, `npm run build` 통과 및 빌드·배포 완료.
- `[x]` 교사용 행정부 빠른 제어 패널 런타임 오류 수정: 역할중심 현황판에서 `policyFields` 값에 배열/객체가 들어왔을 때 `.trim()` 호출로 발생하던 `TypeError: ... trim is not a function` 방어.
- `[x]` `Phase3ExecutiveQuickPanel.jsx`에 `hasMeaningfulValue` 헬퍼 추가. 문자열, 숫자, 배열, 객체를 모두 안전하게 검사해 역할별 작성중/완료 상태를 판단.
- `[x]` 공동작업모드는 수정하지 않음. 교사용 역할중심 현황 표시 방어에만 한정.
- `[x]` `APP_BUILD` v1.2.226 반영, `npm run build` 통과 및 빌드·배포 완료.
- `[x]` 행정부 역할중심 모드 런타임 오류 핫픽스: 배포 화면에서 `ReferenceError: Cannot access 'ze' before initialization`가 발생하던 문제를 확인하고, 최신 소스 기준으로 빌드 순서가 안전하게 반영되도록 재빌드/배포.
- `[x]` `BranchUnitWorkspace.jsx` 역할별 진행률 계산(`statusProgressByRole`)에서 `byRole` 반환이 누락되어 역할 카드/현황판 진행률이 빈 값이 될 수 있던 문제 수정.
- `[x]` 공동작업모드는 확정 상태이므로 수정하지 않음. 이번 변경은 역할중심 모드 안정성 및 진행률 표시 보강에 한정.
- `[x]` `APP_BUILD` v1.2.225 반영, `npm run build` 통과 및 빌드·배포 완료.
- `[x]` 전역 상수 및 헬퍼 함수 컴포넌트 내 인라인 이전 핫픽스: `BranchUnitWorkspace.jsx`에서 모듈 스코프 상수로 존재해 빌드 난독화 및 코드 재정렬 시 TDZ 에러(`ReferenceError: Cannot access 'Pe' before initialization`)를 일으키던 `STEP_LABELS`, `COLLAB_STEP_LABELS`, `SECTION_META`, `isValidUrl`, `getText`, `contentReadinessScore` 등을 컴포넌트 내부 최상단 스코프로 안전하게 인라인 이전하여 원천 해결.
- `[x]` `APP_BUILD` v1.2.224 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 번들러 호이스팅 TDZ 핫픽스: `BranchUnitWorkspace.jsx`에서 `emptyPolicyFields`가 모듈 스코프 상단에 위치해 있어 Vite/Rolldown 번들러가 컴포넌트 내부에서 참조할 때 선언 전 접근(`ReferenceError: Cannot access 'Ne' before initialization`) 에러를 유발하는 현상을 수정하기 위해, `emptyPolicyFields`를 `mergedFinalDoc` `useMemo` 내부의 로컬 상수로 완전하게 가두어 해결.
- `[x]` `APP_BUILD` v1.2.223 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 대표 수정 시 실시간 중계 연동 (디바운스 자동 저장): 대표가 최종 조립기(`ExecutiveFinalAssembler`)나 기본 법안 편집기(`textarea`)에서 입력 폼을 타이핑하여 내용을 수정하거나 예산을 조율할 때, 400ms 디바운스로 조용히 DB에 임시 저장(auto-save)되도록 `useEffect` 감지 및 딥 이퀄 최적화 기법을 적용하여 모둠원들이 대표가 수정하는 모습을 실시간으로 지켜볼 수 있게 연동.
- `[x]` `APP_BUILD` v1.2.222 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 대표 최종 검토 실시간 모둠원 초안 자동 머지 및 동기화 개선: `BranchUnitWorkspace.jsx`에서 `mergedFinalDoc` useMemo를 구현하여 대표가 저장하지 않았거나 비어있는 필드는 모둠원들이 저장한 실시간 초안(`sections`)이 자동으로 병합되어 나타나도록 연동.
- `[x]` 대표 에디터 실시간 동기화 개선: `ExecutivePolicyBudgetDraft.jsx`의 `ExecutiveFinalAssembler`에서 `isEditing`이 아닐 때 상위의 `mergedFinalDoc`의 최신 변경 내용을 로컬 state(`fields`, `budgetItems`)에 계속 동기화하는 useEffect 추가.
- `[x]` `APP_BUILD` v1.2.221 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 학생용 내 역할 정책안 초안 미리보기 카드 추가: 역할중심 모드에서 비대표 학생 화면 하단에 [내 역할 정책안 초안 미리보기] 카드를 추가하여 저장 버튼 클릭 시 실시간으로 최종 보고서 및 예산 명세서 스타일로 미리보기 출력.
- `[x]` `APP_BUILD` v1.2.220 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 교사 제어 패널 실시간 작성 현황 모니터링 대시보드 추가: `Phase3ExecutiveQuickPanel.jsx` 하단에 공동작업모드 및 역할중심모드별 부처 작성 현황과 역할 배정 및 작성률 실시간 감지 UI 추가.
- `[x]` 옛 버전 역할명 잔재 데이터 정합성 방어: `RoleSelfSelector.jsx`, `BranchUnitWorkspace.jsx`에서 DB의 예전 역할 데이터가 현재 역할 정의와 다를 때 역할 변경 및 편집이 안 되던 문제 방지 처리.
- `[x]` 학생 화면 역할 잠금 안내 배너 보강: `BranchUnitWorkspace.jsx`에 교사가 역할을 잠갔을 때 명확히 이를 안내해주는 잠금 알림 배너 추가.
- `[x]` `APP_BUILD` v1.2.211 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 행정부 역할 중심 모드 할 일 노출 버그 수정: `BranchUnitWorkspace.jsx`에서 `myRoleKey`를 `unitGroupId` 기준으로 찾도록 하여 역할 배정 후 할 일 목록 정상 노출.
- `[x]` 교사용 빠른 제어 패널 기능 추가: `Phase3ExecutiveQuickPanel.jsx`에 역할중심 모드 및 stage 0에서 '역할 잠금/해제' 및 '역할 전체 초기화' 버튼 및 RTDB 연동 추가.
- `[x]` `APP_BUILD` v1.2.210 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 교사 학급설정 오류 수정: `BranchConfigEditor.jsx` todos 객체 렌더링 오류 (`[object Object]` 출력)
- `[x]` 교사 학급설정 오류 수정: `ExecutiveFinalAssembler`의 `patchFields` 미선언 → 법령 선택 시 `TypeError` 수정
- `[x]` 교사 학급설정 오류 수정: `ExecutiveBudgetEditor`의 `useGameStore.getState()` 비반응형 → selector로 교체
- `[x]` `APP_BUILD` v1.2.209 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 행정부를 먼저 정리한다는 사용자 승인에 따라 입법부는 아직 수정하지 않고 행정부 화면만 작업.
- `[x]` 행정부 공동작업 모드는 최종 정책·시행령·예산 템플릿을 바로 작성하는 방식으로 분리.
- `[x]` 행정부 역할중심 모드는 `BranchUnitWorkspace`에서 역할별 섹션 초안을 작성하고 조립하는 방식으로 유지.
- `[x]` 공동작업 모드와 역할중심 모드의 작업공간이 같은 단계에서 동시에 보이지 않도록 `ExecutiveTab.jsx` 분기 정리.
- `[x]` 기존 반 데이터 호환: `branchDrafts/{unitId}/finalDoc`가 없거나 비어 있으면 `policies/{groupId}` 저장본을 공동작업 폼에 복구.
- `[x]` 빈 `locked finalDoc`가 있어도 실제 내용이 없으면 제출완료 뷰로 막지 않도록 방어.
- `[x]` 역할중심 섹션 완료 판정을 구조화 필드와 예산 항목까지 포함해 계산하도록 보완.
- `[x]` `npm run build` 통과.
- `[x]` `app/deploy.sh`로 배포 완료.
- `[x]` `demo24` 실제 학생 화면에서 함께마을 기존 저장본(`청년주거안정정책`, 시행령, 예산 항목 30억)이 공동작업 폼에 복구되는지 확인. 저장/제출/삭제는 누르지 않음.
- `[x]` 행정부 공동작업 템플릿에 질문형 시행령 자동 조립 도우미 추가.
- `[x]` 행정부 역할중심 최종 조립 폼에도 같은 질문형 시행령 자동 조립 도우미 추가.
- `[x]` 가결 법령 선택, 법령 내용 확인, 준비자료 참고 패널, 질문 답변, 시행령 미리보기, 최종안 반영 버튼을 한 흐름으로 배치.
- `[x]` 자동 조립 미리보기는 최종안 칸을 즉시 덮어쓰지 않고 버튼으로만 반영하도록 처리.
- `[x]` `APP_BUILD` v1.2.203 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 시행령 작성 도우미를 3개 접기 구역으로 재분리: 입법내용 확인, 질문 답변, 시행령 미리보기·최종안.
- `[x]` 세 구역 각각에 저장 버튼 추가.
- `[x]` 공동작업 모드 구역 저장 시 `policies/{groupId}`를 `status: saved`로 공개해 평가단/대통령 모둠이 중간 산출물을 볼 수 있게 복구.
- `[x]` 이미 제출/청구/최종 상태인 정책은 구역 저장으로 `saved`로 내려가지 않도록 보존.
- `[x]` `APP_BUILD` v1.2.204 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 정책·시행령 템플릿 위에 `~국 통계` 접기 영역 추가.
- `[x]` 통계 영역은 예산 계산기와 같은 `BIBIM_STATS`를 사용하며 새창 보기 버튼 제공.
- `[x]` 초안 단계에서 `온라인 정책토의 의견 반영` 칸 제거. 해당 내용은 최종 수정 페이지에서 작성하도록 유지.
- `[x]` 초안 단계에 `국민 눈높이 반영` 칸 추가: 예상 피해/손해보는 시민·분야, 대응 방법.
- `[x]` `국민 눈높이 반영 저장` 버튼 추가 및 `publicEye` 파트 저장 연결.
- `[x]` 온라인 정책토의 목록과 예산 초안 검토 전광판에 국민 눈높이 반영 내용을 표시.
- `[x]` `APP_BUILD` v1.2.205 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` `ReferenceError: countryName is not defined` 핫픽스. `ExecutiveGuidedPolicyBuilder` props에 `countryName = '축소국'` 기본값 추가.
- `[x]` `APP_BUILD` v1.2.206 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` `~국 통계`를 정책·시행령 질문 도우미에서 예산안 작성 영역으로 이동.
- `[x]` `필요 근거 및 사례`를 독립 칸에서 `국민 눈높이 반영` 섹션 안으로 이동.
- `[x]` 정책토의 목록, 예산 초안 검토 전광판, 최종 제출 뷰에서 근거/사례가 국민 눈높이 반영 안에 표시되도록 보정.
- `[x]` `APP_BUILD` v1.2.207 반영 후 `app/deploy.sh`로 배포 완료.
- `[x]` 독립 기대효과 입력칸 제거.
- `[x]` `기대 효과 및 홍보에 쓸 표현`을 `국민 눈높이 반영` 섹션 안으로 이동.
- `[x]` 정책토의 목록, 예산 초안 검토 전광판, 최종 제출 뷰에서 기대효과가 국민 눈높이 반영 안에 표시되도록 보정.
- `[x]` `APP_BUILD` v1.2.208 반영 후 `app/deploy.sh`로 배포 완료.

## 후속 점검

- `[ ]` 사용자가 v1.2.233 화면을 직접 확인 — 평이해진 안내 문구가 실제 학생 화면에서 자연스럽게 읽히는지, [최종안 직접 수정하기]에서 시행령·예산 직접 편집 UI만 노출되는지.
- `[ ]` 통합 미리보기(`mergedFinalDoc`)에서 자동 조립되는 시행령 텍스트가 [최종안 직접 수정] 진입 시 textarea에 잘 채워지는지 검증 (시행령 4조각이 한 덩어리로 보이는지, 빈 줄·구분이 자연스러운지).
- `[ ]` 사용자가 행정부 화면을 직접 확인한 뒤, 같은 패턴을 입법부에도 적용할지 승인받기.
- `[ ]` 입법부 적용 시 기존 `bills`, `branchDrafts/{unitId}/finalDoc`, 역할별 섹션 데이터의 우선순위를 먼저 문서화하고 테스트방 데이터로 읽기 검증하기.
- `[ ]` 입법부 공동작업 모드는 최종 법률안 템플릿 직접 작성, 역할중심 모드는 역할별 법안 섹션 초안 조립 방식으로 분리할 예정.
