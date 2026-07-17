# 변경 사항 히스토리 (History & Changelog)

‘민국이의 꿈 프로젝트’의 모든 의미 있는 변경을 시간 역순(최신이 위)으로 기록한다.

기록 형식: `버전 (YYYY-MM-DD)` + 변경 요약(한 줄 또는 항목 목록).

---

## v1.7.113 (2026-07-10) [Claude] — 보안 점검: 교사 진입 암호 기본값 제거(fail-closed) + 실제 암호 재설정
- **발견**: 실제 배포된 JS 번들을 직접 열어 확인해보니, class-democra(운영)의 `VITE_TEACHER_PASSCODE` 환경변수가 애초에 설정된 적이 없어서 `EntryPage.jsx`의 하드코딩 기본값 `'123467'`이 그대로 살아있었음. 이 기본값은 공개 GitHub 저장소 소스코드에도 그대로 적혀있어, README 유출보다 훨씬 쉽게 알아낼 수 있는 상태였음.
- **관련 위험 확인**: 교사 암호로 로그인하면 실제 Firebase 계정(`teacher@mingook.app` 고정 이메일)에 그 암호를 비밀번호로 로그인 시도 — 성공하면 보안 규칙의 특정 UID 권한(`currentPhase`/`currentSession`/`config` 쓰기)까지 얻게 됨. 게다가 "반 코드로 입장" 기능으로 **내가 만들지 않은 다른 반에도 코드만 알면 교사로 들어갈 수 있음** — 즉 이 암호는 해당 Firebase 프로젝트 안의 모든 반에 대한 사실상의 마스터 키.
- **수정**: `EntryPage.jsx`의 `TEACHER_PASSCODE`에서 `|| '123467'` 하드코딩 기본값 제거, `|| null`로 변경 — 환경변수를 깜빡 설정 안 하면 어떤 입력으로도 통과 못 하도록 fail-closed로 전환. class-democra에 실제 암호(`VITE_TEACHER_PASSCODE`) 새로 설정.
- **참고**: 이 앱은 서버 없는 순수 클라이언트 앱이라 `VITE_*` 값은 빌드된 JS에 평문으로 그대로 들어감 — 소스코드를 아무리 깨끗이 해도 배포된 사이트의 실제 암호값 자체는 기술적으로 능숙한 사람에게 노출 가능한 구조. 진짜 방어선은 Firebase 보안 규칙(서버 강제)이며, 암호는 1차 저지선일 뿐.
- `npm run build` 통과 후 번들에서 옛 기본값(`123467`) 완전히 사라진 것 직접 확인. `APP_BUILD` v1.7.113.

## v1.7.112 (2026-07-10) [Claude] — 교사 승인/반려 시 상태 배지가 끝없이 번갈아 뜨던 무한 경합 수정
- **근본 원인**: `saveDraft()`(임시저장·2초 debounce 자동저장·언마운트 저장 공용 함수)가 매번 Firebase에 `status` 필드를 같이 써왔음. 교사가 승인/반려하면 `ReflectionPage.jsx`의 분기가 바뀌면서 `ReflectionStructuredEditor`가 통째로 리마운트되는데, **그 순간 사라지는(언마운트되는) 옛 인스턴스**가 정리 과정에서 `saveDraft`를 fire-and-forget으로 한 번 더 호출 — 이때 그 인스턴스가 마지막으로 알고 있던(교사의 액션을 반영하지 못한) 낡은 상태를 다시 써서 방금 바뀐 상태를 덮어씀. 이 덮어쓰기가 또 다른 리마운트를 유발하고, 그 리마운트도 똑같이 자기 몫의 낡은 상태를 덮어써서 — **pending↔writing↔rejected를 오가는 자기 지속형 핑퐁 루프**가 발생. 교사 화면의 "승인대기/작성중" 배지, 학생 화면의 "글 작성/수정" 뷰가 끝없이 번갈아 뜨던 원인.
- **수정**: `saveDraft()`의 Firebase 쓰기(임시저장 전용)에서 `status` 필드를 완전히 제거 — 상태 전환은 이제 오직 학생의 최종 제출(`handleFinalSubmit`)과 교사의 승인/반려 액션만 담당. 신규 글 최초 생성(`pushUnder`) 시에만 `status: 'writing'`을 한 번 지정. 이 구조에서는 어떤 리마운트·경합이 일어나도 임시저장 경로가 상태를 건드릴 수 없어 루프 자체가 원천 차단됨.
- **정리**: 위 문제를 우회하려고 이전 세션들에서 추가했던 `serverStatusRef`(낡은 상태 추적용 ref)와 관련 effect·주석을 모두 제거 — 더 이상 필요 없는 죽은 코드였음.
- `npm run build` 통과. `APP_BUILD` v1.7.112.

## v1.7.111 (2026-07-10) [Claude] — 정리글 작성 중 내용이 사라지는 치명적 버그 수정
- **근본 원인(핵심)**: `HighlightBox.jsx`가 교사가 워크플로 강조 단계를 다른 곳으로 옮기는 즉시 강조 대상이 아닌 섹션을 `return null`로 **완전히 언마운트**하고 있었음. 정리글 4번째 여정("시사회")의 정리글 작성(`editor`) 섹션도 이 컴포넌트로 감싸여 있어서, 학생이 한창 타이핑 중에 교사가 다른 학생을 위해 워크플로 단계를 이동하면(교실에서 매우 흔한 상황 — 진도가 빠른/느린 학생이 섞여 있으므로) **`ReflectionStructuredEditor`가 그 순간 통째로 사라지고 React state가 날아감**. 언마운트 cleanup이 fire-and-forget으로 저장을 시도하긴 하나 네트워크가 느리면 유실됨 — "글쓰다가 사라진다", "새로고침하면 없어진다"의 실제 원인. `HighlightBox`는 Phase1~4 전체(포스터, 법안, 사법 등)에서 널리 쓰이므로 같은 유형의 버그가 다른 입력 폼에도 잠재해 있었음.
- **수정**: 비강조 상태에서 `null` 대신 `className="hidden"`(display:none)으로 화면에서만 숨기고 마운트는 유지 — 진행 중이던 입력·자동저장 타이머·React state가 보존되며, 강조가 다시 돌아오면 즉시 원래 내용 그대로 나타남.
- **추가 버그(제출 상태 깜박임)**: `handleFinalSubmit`이 최종 제출 직전 예약돼 있던 debounced 자동저장 타이머(2초 유휴 후 발화)를 취소하지 않아, 제출 직후 그 타이머가 뒤늦게 발화하면 `status: 'pending'`(제출완료)을 `status: 'writing'`(임시저장)으로 다시 덮어쓰는 경합이 발생 — 교사 화면에서 "제출"과 "작성중" 배지가 번갈아 깜박이던 원인. `submitLockRef`를 추가해 제출 시작 시 타이머를 취소하고 잠그며, 자동저장 콜백도 잠금 상태면 스킵하도록 수정. 제출 실패 시엔 잠금을 풀어 계속 작성 가능하게 함.
- `npm run build` 통과. `APP_BUILD` v1.7.111.

## v1.7.110-docs (2026-07-10) [Claude] — 배포 방식 변경 문서 반영 (다른 세션)
- 사용자가 배포 방식을 서버 `deploy.sh` 수동 배포에서 **GitHub main 브랜치 `git push` 시 자동 빌드·배포**(Cloudflare Pages 등 연동)로 전환했다고 알려줌. `CLAUDE.md`(1·2절), `docs/project_context.md`(9·10절), `docs/dev_guidelines.md`(9절)에 남아있던 옛 배포 안내를 갱신.

## v1.7.110 (2026-07-10) [Claude] — 교사 정리글 완성 확인 동기화 버그 수정 + 검토 기능 강화 (다른 세션)
- **핵심 버그**: `SubmissionStatusQuickPanel.jsx`(교사 대시보드 '제출 확인 빠른보기')가 정리글을 `data.reflections?.[row.id]`로 학생 id를 키 삼아 직접 조회 — 실제로는 `pushUnder`의 랜덤 키에 저장되고 학생 id는 `authorStudentId` 필드에만 있어 조회가 항상 실패, 제출해도 계속 "미시작"으로 보이던 버그. `authorStudentId`로 찾는 `findReflectionByStudent()` 헬퍼로 해결.
- **번호 정렬 버그**: `ReflectionApprovalQueue.jsx` 목록이 제출 시각순 → 학생 번호 오름차순 정렬로 수정.
- **기능 추가**: 검토 모달에 확인/반려/수정 버튼 + 이전·다음 제출 학생 이동 버튼 추가.
- `APP_BUILD` v1.7.110. (로컬 `node_modules` 미설치 환경이라 `npm run build` 미실행)

## v1.7.109 (2026-07-09) [Claude] — 교사 학생분석 '자세히 보기' 팝업이 깨져 나오던 문제 수정
- **핵심 버그(이스케이프)**: `StudentAnalyticsPage.jsx`의 `handleOpenDetailWindow`가 새 창에 쓰는 최종 HTML 템플릿 리터럴에서 `<title>`, 학생 배지, `<h1>`, 시간, 본문(`bodyHtml`) 삽입부가 전부 `${...}`가 아니라 `\${...}`로 이스케이프되어 있었음 — 즉 실제 값 대신 `${bodyHtml}` 같은 글자 그대로가 팝업에 출력되던 것이 "이상하게 나온다"의 직접 원인. 백슬래시 제거로 정상 보간되도록 수정.
- **스코프 버그**: 같은 헤더에서 `openStudent`를 참조했지만 `handleOpenDetailWindow(t, nickname)`엔 `openStudent`가 전달되지 않아 원래도 깨져 있었음 — 함수 시그니처에 `number` 인자를 추가하고 호출부에서 `openStudent.number`도 함께 전달하도록 수정.
- **스키마 노후화 버그**: 정리글 관련 3곳(`student-stats.js`의 타임라인 push, 팝업의 정리글 섹션, 인라인 타임라인 카드)이 전부 정리글 에디터가 구조화 5단계 편집기로 개편되기 전의 옛 스키마(`body`/`impressive`/`revisit`/`pledge`)를 참조 — `body`는 현재 아예 안 쓰이는 필드라 에세이가 항상 "없음"으로 뜨고, `impressive`/`revisit`/`pledge`는 하위호환용으로 남아있던 값(p2/p1/p3 단락 중심문장)이 엉뚱한 라벨(예: "가장 인상 깊은 장면")로 표시되던 것도 함께 수정. 현재 스키마(`title`/`finalEssay`/`outline`/`p1`/`p2`/`p3`)를 그대로 노출하도록 세 지점 모두 갱신.
- `npm run build` 통과. `APP_BUILD` v1.7.109.

## v1.7.108 (2026-07-09) [Claude] — 정리글 최종 제출 '멈춤' 현상 수정 + 슈퍼어드민 비밀번호 설정
- **버그**: `ReflectionStructuredEditor`의 최종 제출 버튼(`🚀 정리글 최종 제출`)에 `disabled`/로딩 표시가 전혀 없었고, 제출 실패 시 뜨는 에러 메시지(`{error && ...}`)는 검토 모달(전체화면 오버레이) **뒤에** 렌더링되는 위치라 학생 화면엔 아무것도 안 보임 → 느린 네트워크·오류 시 클릭해도 화면이 그대로라 '멈춘 것'처럼 보이던 원인.
- **수정**: 제출 버튼에 `busy` 상태 연동(`disabled` + "⏳ 제출 처리 중..." 텍스트), 모달 내부에도 에러 메시지 표시 추가, Firebase 쓰기에 15초 타임아웃(`Promise.race`)을 걸어 네트워크가 끊겨도 무한 대기 대신 안내 메시지가 뜨도록 함.
- **보안**: `/super-admin` 페이지 비밀번호(`VITE_SUPER_ADMIN_PASSCODE`)가 로컬·Cloudflare 어디에도 설정돼 있지 않아 **빈 비밀번호로 통과**되던 것을 발견 — 값 설정(로컬 `.env.local` + Cloudflare Pages secret) 완료.
- `npm run build` 통과. `APP_BUILD` v1.7.108.

## v1.7.107 (2026-07-09) [Claude] — 교사가 정리글 반려 시 확인 토스트 추가
- **문제**: `ReflectionApprovalQueue`에서 '대기' 필터로 목록을 보다가 반려 버튼을 누르면, 상태는 실시간(Firebase)으로 바뀌지만 필터 조건(`status === filter`)에 안 맞아 항목이 그 자리에서 조용히 사라짐 — 반려가 실제로 처리됐는지 교사가 확신하기 어려움.
- **수정**: `reject()` 호출 시 우측 상단에 2초간 "✗ 반려 처리했어요 — 학생 화면에 바로 반영돼요." 토스트를 띄우도록 `actionToast` state 추가. 목록 빠른 반려 버튼·상세 패널 반려 버튼 모두 같은 `reject()`를 거치므로 동일하게 적용됨.
- `npm run build` 통과. `APP_BUILD` v1.7.107.

## v1.7.106 (2026-07-09) [Claude] — 정상 제출인데도 '수정됨' 배지가 뜨던 문제 수정 + Cloudflare Pages 자동배포 전환
- **버그**: `ReflectionStructuredEditor`의 `handleFinalSubmit`에서 `isModified: isEdit`로 저장 — `isEdit`은 기존 글을 불러와 편집 화면을 열기만 하면 무조건 `true`라서, 처음 제출이든 반려 후 재제출이든 상관없이 학생 화면(`ReflectionPage.jsx`)과 여론판 카드에 "✏️ 수정됨" 배지가 떠서 마치 뭔가 잘못된 것처럼 보였음.
- **수정**: `isModified: wasApproved`로 변경 — **이미 승인된 글을 승인 후에 다시 고쳤을 때만** '수정됨'을 표시하도록 의미를 바로잡음. 일반 제출·재제출 시에는 배지 없이 기존 성공 메시지(`제출 완료!` / `수정되었어요!`)만 뜸.
- **배포 인프라 전환**: 배포(`deploy.sh`)를 종료하고 실서비스 도메인 `<배포주소>`(Cloudflare Pages 프로젝트 `class-democra`)을 GitHub 저장소와 연동해 **git push만으로 자동배포**되도록 전환. 별도로 존재하던 `mingook-dream` 프로젝트(기존부터 git 자동배포, 별도 Firebase DB)는 그대로 유지·미변경.
  - Cloudflare Pages 대시보드에서 `class-democra`를 Connect to Git (root directory: `app`, build: `npm run build`, output: `dist`).
  - 빌드에 필요한 `VITE_FIREBASE_*` 등 환경변수 10개를 `wrangler pages secret put`으로 등록(로컬 `.env.local`과 동일 값 — 이 프로젝트의 실제 운영 Firebase 설정).
  - 로컬 npm(11.x)/Node(25.x)와 Cloudflare 빌드 환경(npm 10.9.x/Node 22.16.x)의 버전 차이로 `package-lock.json`의 optional dependency(lightningcss의 @emnapi wasm) 잠금 내용이 달라 `npm ci`가 실패 — `brew install node@22`로 맞춰 lock 파일 재생성.
  - **다음 세션 참고**: 이 저장소에서 `npm install`/`npm ci`를 실행할 때는 `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`로 Node 22를 앞에 두고 실행할 것 (기본 `node`는 26.x로 더 올라가 있음).
- `npm run build` 통과. `APP_BUILD` v1.7.106.

## v1.7.105 (2026-07-06) [Claude] — 정리글 임시저장이 제출·승인 상태를 'writing'으로 되돌리던 회귀 수정
- **배경**: v1.7.104까지의 정리글 사라짐 수정(localStorage 즉시복원·언마운트 자동저장·debounced 자동저장)은 새로고침/이동 시 글 유지 문제를 실제로 해결함. 다만 **부작용**이 있었음.
- **회귀 버그**: `ReflectionStructuredEditor`의 `saveDraft()`가 항상 `status: 'writing'`을 하드코딩. 자동저장 effect·언마운트 cleanup은 사용자가 타이핑하지 않아도 마운트 2초 뒤 자동 실행 → **이미 제출(pending)·승인(approved)된 정리글을 보기만 해도 상태가 'writing'으로 강등**되어 갤러리에서 사라지고 작성 화면으로 튕김. 최종 제출 직후 언마운트 cleanup도 제출을 취소시킴.
- **수정**: `serverStatusRef`로 서버 현재 상태 추적(Firebase 구독 동기화). 임시저장 시 `approved`/`pending`이면 상태를 보존하고 그 외에만 `writing`으로 저장. 최종 제출·신규 생성 직후에도 ref 즉시 갱신.
- **부수 수정**: `handleFinalSubmit`에서 신규 글(tempId 없음)을 최종 제출할 때 `tempId`를 세팅하지 않아 언마운트 자동저장이 **중복 정리글**을 만들던 버그도 함께 해결.
- `npm run build` 통과. `APP_BUILD` v1.7.105.

## v1.7.42 (2026-06-17) [Claude] — 사법부 활동 메모를 모둠 단위 → 개인 단위로 전환
- **변경**: `JudicialActivityMemo`(쟁점·재판·참관 판사 메모) 저장 경로를 `judicialIssues/{caseId}/{groupId}`(모둠 공유) → **`judicialIssues/{caseId}/{studentId}`(개인)**. 학생마다 자기 메모를 따로 작성. 모둠 종합은 토론도구 종합판결문(모둠원 종합평가 카드 + 판결문 작성)에서 정리하는 흐름 유지.
- **연동**: `EvaluatorFinalCommentForm`의 '메모+개별평가 불러오기'도 개인 메모(`{studentId}`)를 읽도록 수정. 문구 '우리 모둠 메모'→'내 메모', 쟁점 메모 안내에 "모둠 판결문은 종합판결문에서 정리" 명시.
- 참고: 설계 초기(2026-05-28 제안서)부터 쟁점 메모는 모둠 단위였음(개인 단위 결정 이력 없음) — 이번에 개인 단위로 전환.
- `npm run build` 통과 + dev 부팅 스모크. `APP_BUILD` v1.7.42.

## v1.7.41 (2026-06-17) [Claude] — 판결중심 재판 흐름 4종 (재판단계·종합평가 카드·전원 판결문·토의 마무리발언)
- **① 재판 타이머 판결중심 전용**: `VERDICT_TRIAL_STAGES` 신설(모두진술→증거·증인→피고인 신문→최종변론→**참관 판사 평의·판결문 작성**). `startJudicialDebate`가 판결중심이면 이 단계로 시드(역할중심은 기존 `TRIAL_STAGES`).
- **② 모둠원 종합평가 카드**: `VerdictTrialDraftPanel`에 모둠원 개인 종합평가(`finalEvaluations`)를 토론카드처럼 카드 그리드로 노출(저장 즉시 모둠원에게 공유).
- **③ 참관 판사도 판결문 작성**: 모둠 판결문 작성 패널을 연기팀뿐 아니라 **참관 판사(evaluator) 뷰에도** 렌더 → 모둠원 누구나 작성·게시. 제출 시 `verdicts/{caseId}` 게시 → 온라인 토의에서 판단.
- **④ 토의에 재판장 마무리 발언**: 판결문 토의 단계 상단에 대본의 '선고직전' 판사 발언 표시(`JudicialVerdictTab.closingJudgeLines`, scene `/선고/` 우선·없으면 마지막 judge 줄). 대본은 결론 없이 끝나는 설계 유지.
- `npm run build` 통과 + dev 부팅 스모크. `APP_BUILD` v1.7.41.

## v1.7.40 (2026-06-17) [Claude] — 기사 수정/삭제 아이콘 태블릿 가시성 수정
- **증상**: 토론도구·기사 작성의 '우리 모둠 기사' 목록에서 수정(✏️)/삭제(🗑️) 아이콘이 안 보임.
- **원인**: `ArticleSection`에서 아이콘 그룹이 `opacity-0 group-hover/article:opacity-100`(hover 시에만 노출)이라, hover가 없는 **태블릿(터치)에서 영영 안 보임**. 삭제된 게 아니라 숨겨져 있었음.
- **수정**: hover-reveal 제거 → 작성자 본인에게 **항상 표시**. `APP_BUILD` v1.7.40.

## v1.7.39 (2026-06-17) [Claude] — 판결중심 모둠 판결문 작성 페이지 복구 + 참관 안내 문구 수정
- **판결문 작성 페이지 복구**: `JudicialVerdictTab`의 `writingMode`가 `'hidden'`으로 박혀 있어 토론도구를 안 띄우면 판결문을 쓸 곳이 없던 문제 수정. `writingMode = trialDebate ? 'hidden' : modeFor([2])` — 토론도구 미사용 시 재판하기(stage 2) 단계에서 탭에 모둠 판결문 작성·게시 페이지 노출(VerdictTemplate, `verdicts/{caseId}` 게시 → 토의 단계 호환). 토론도구 사용 시엔 도구 안에서 작성(중복 방지). 헤더 옛 '④' 표기 정리.
- **문구**: 재판하기 참관팀 안내 '연기를 보며' → '모의 재판을 보며'.
- `npm run build` 통과. `APP_BUILD` v1.7.39.

## v1.7.38 (2026-06-17) [Claude] — 최종평가 저장 버튼 강조 + 기사쓰기 상단에 내 최종평가 노출
- **저장 버튼 가시성**: `EvaluatorFinalCommentForm`의 '최종 평가 저장' 버튼을 우하단 작은 버튼 → **전체폭·text-sm·굵게**(💾 최종 평가 저장하기, 저장완료 시 emerald)로 변경. 안내 문구는 버튼 아래로.
- **기사쓰기 상단 최종평가 노출**: 토론도구 '토론 후 기사 쓰기' 구역 `ArticleSection` 위에 `MyFinalEvalRecap` 추가 — 내가 저장한 최종 평가를 읽기 전용으로 표시(`finalEvaluations/{studentId}` 구독, 내용 있을 때만).
- `npm run build` 통과 + dev 부팅 스모크. `APP_BUILD` v1.7.38.

## v1.7.37 (2026-06-17) [Claude] — 토론도구 참관 판사 메모 읽기전용화 + '메모+개별평가 불러오기'
- **참관 판사 메모 읽기 전용**: 토론도구 참관 판사(evaluator) 뷰의 활동메모를 편집 textarea → 읽기 전용 표시로 변경(쟁점 단계 작성본을 참고용으로만 노출). `📋 복사` 버튼 추가(클립보드 + 텍스트 직접 선택 가능). `JudicialActivityMemo`에 `readOnly` prop 추가.
- **최종 종합평가 불러오기 강화**: `EvaluatorFinalCommentForm`의 '개별 평가 모두 불러오기' → '메모 + 개별평가 모두 불러오기'. 모둠 활동메모(`judicialIssues`)를 `【쟁점·재판 메모】`로, 개별 평가를 `【개별 평가】`로 묶어 종합평가란에 자동 삽입. 둘 중 하나만 있어도 처리.
- 연기팀 뷰의 '판결문 참고 메모'는 판결문 작성에 쓰이므로 기존대로 편집 가능 유지.
- `npm run build` 통과 + dev 부팅 스모크. `APP_BUILD` v1.7.37.

## v1.7.36 (2026-06-16) [Claude] — 사법부 판결중심 모드 9개 개선 (활동메모 통합·대본 강조·참관판사)
- **활동 메모 통합(신규 `JudicialActivityMemo.jsx`)**: 모둠 단위 `judicialIssues/{case}/{group}` 한 개를 쟁점 단계에서 시작해 재판하기·토론도구·참관판사 평가 영역에서 같은 메모로 이어서 작성. 자동저장 + '저장 중…/✓ 저장됨' 표시. 모든 역할 공통. (②④⑦⑧)
- **①** 쟁점 단계 헤더에 `JudicialCaseRoomButton` 추가 — 사건 자료실을 전 역할 공통 노출.
- **③** 연기팀 학생: 내 대사만 보던 것 → 전체 대본 표시(내 대사 검정·굵게 / 남의 대사 연회색). 토론도구 프롬프터: 역할별 대본을 전체 줄로 시드하되 내 줄만 전문, 남의 줄은 `번호. 화자: …`로 축약(빠진 번호의 화자 노출, 흐리게 표시). `Phase3JudicialQuickPanel.formatTrialScriptLines(ownSpeakers)`·`DebateScriptPrompter` 수정.
- **④** 토론도구(연기팀 뷰)의 per-student `VerdictTrialMemo` 제거 → 그룹 활동메모로 교체(쟁점에서 이어쓰기). 판결문 작성 패널의 중복 메모카드/죽은 코드 정리.
- **⑤** 판결중심 stage2: '대본 넣고 열기/AI 대본 적용' 버튼 제거 → '토론 도구 열기'만(세션 생성 시 대본 자동 주입).
- **⑥** 재판 세션 생성 시 `judicialPresentation` 초기화 — 증거 TV가 처음부터 '송출 중'으로 잘못 보이던 문제 해결(종료와 동일 상태로 시작).
- **⑦** '평가단' → 세션 `sideLabelOverrides.evaluator`('참관 판사') 동적 표기(SpeechEval 배지·대기문구, 현재단계 평가패널, 최종 종합평가 헤더, 교사 노출 토글). 판결중심 세션 `evalExposureEnabled: true` 기본 ON. 참관판사 평가란 위에 활동메모 노출.
- **⑧** 토론도구 미사용 시 재판하기 단계에서 활동메모를 모든 역할에게 노출(기존 참관팀 CommentList 대체). 토론도구 열리면 토론도구 안에서 표시.
- **⑨** 기사 단계에 참관 판사 종합평가 + 개별평가를 항상 펼쳐 보여주는 `VerdictEvalRecap` 패널 추가(종료된 최신 trial 세션에서 회수).
- **검증**: `npm run build` 통과 + dev 서버 부팅 스모크(에러 없음). 실제 판결중심 라이브 룸 인터랙티브 검증은 미수행.
- `APP_BUILD` v1.7.36. (배포·푸시 미수행 — 사용자 확인 대기)

## v1.7.35 (2026-06-16) [Claude] — 행정부 '대표' 양방향 동기화 (학급설정 ↔ 빠른제어) + 대통령 대표 selector 신설
- **문제**: 같은 "대표"가 두 저장소에 따로 존재해 동기화 안 됨. 학급설정 = `config.…units[].representativeStudentId`, 빠른제어 = `groups/{gid}/sessionRoles/executive-default/{sid}` 역할키. 기능마다 보는 출처도 달라(승인보드=sessionRoles, 최종조립 편집권=representativeStudentId) 어긋났다. 대통령 모둠은 학급설정에 대표 selector조차 없었다.
- **공용 모듈 신설**: `lib/representative-sync.js` — `syncExecutiveRepresentative()`가 대표 지정 시 (A) config representativeStudentId 와 (B) sessionRoles 역할키(대통령=`pledge_purpose`, 일반=`minister`)를 **한 번의 multi-path 업데이트로 동시 기록**. `getExecutiveRepKey`·`isPresidentUnit` 포함.
- **연결**: `Phase3ExecutiveQuickPanel.assignRepresentative`·`BranchConfigEditor`(일반 부처 onRepChange의 executive 분기)가 모두 이 함수를 호출 → 어느 화면에서 지정해도 양쪽 동기화.
- **대통령 대표 selector 추가**: `BranchConfigEditor` 대통령 섹션에 대통령실 대표 지정 드롭다운 신설(기존엔 빠른제어에만 있었음).
- **판정 보강**: `ExecutiveTab.isPresidentLeader`가 sessionRoles 역할키 또는 representativeStudentId 중 하나라도 나를 가리키면 인정(레거시 데이터 방어).
- **검증**: `npm run build` 통과 + dev 서버 부팅 스모크(랜딩 렌더·JS 에러 없음). 실제 대통령 방 인터랙티브 검증은 라이브 룸 필요.
- ⚠️ **레거시 주의**: 이전에 구버전 빠른제어로 지정해 둔 대통령 대표는 잘못된 키(`minister`)로 남아 있어, 배포 후 **대표를 한 번 다시 지정**해야 올바른 `pledge_purpose`로 기록된다.
- `APP_BUILD` v1.7.35.

## v1.7.34 (2026-06-16) [Claude] — 대통령 최종 승인 보드 안 뜨는 버그 수정 (대통령 역할 잘림)
- **증상**: 행정부 ⑥ 최종 수정 단계에서 대통령 모둠 대표에게 `ExecutiveApprovalBoard`(👑 최종 승인 버튼)가 절대 안 떴다.
- **원인**: `normalizeRoleList('executive', …)`가 executive일 때 일반 부처 4역할(minister/planner/investigator/analyst)을 맨 앞에 강제 정렬하고 대통령 역할(`pledge_*`)을 뒤쪽 `extras`로 밀었다. 이후 `BranchUnitWorkspace`의 `slice(0, memberCount)`(4인 기준 slice(0,4))에서 대통령 역할이 통째로 잘려, 학생이 대표 역할 `pledge_purpose`를 아예 선택할 수 없었다. → `isPresidentLeader`(`myRoleKey === 'pledge_purpose'`)가 영원히 false → 승인 보드 미표시.
- **수정**: `normalizeRoleList`(`lib/scaffolding-data.js`)의 executive 분기에서, 정규화 결과에 대통령 역할 키(`DEFAULT_ROLES.executive_president`의 key)가 하나라도 있으면 일반 부처 기본역할 강제 정렬을 건너뛰고 원래 순서(대표가 맨 앞)를 그대로 반환하도록 가드 추가.
- 의도된 동작(대표가 최종 수정 단계에서 승인)은 그대로 유지. 일반 부처 역할 정규화·교사 화면에는 영향 없음.
- `npm run build` 통과. `APP_BUILD` v1.7.34. (배포 미수행 — 사용자 확인 대기)

## v1.7.33 (2026-06-16) [Claude] — 업로드 기능·흔적 완전 제거 (서버 업로드엔드포인트 삭제 + 죽은 코드 정리)
- **서버**: `<배포경로>/업로드엔드포인트` 삭제(공개 업로드 엔드포인트 제거). `uploads/` 폴더(기존 사진 71개)는 보존 → 기존 포스터·증거 그대로 표시.
- **죽은 코드 삭제**: `src/lib/upload-helper.js`, `src/lib/image-compress.js`(둘 다 미사용).
- **env 정리**: `VITE_UPLOAD_URL` 제거(`.env.example`·`.env.local`·README). `VITE_FETCH_META_URL`·`VITE_APP_URL`는 업로드 무관이라 유지.
- 문서 갱신: README, **CLAUDE.md**(디렉토리표·기술스택·셋업기록에서 업로드엔드포인트 제거/폐지 표기, 서버 사본 동기화), **project_context.md**(§3-0 추가, 버전 v1.7.33). phase2_teacher_guide는 이미 "Canva·업로드 없음"으로 최신, 배포가이드 docx/pptx는 원래 업로드 언급 없음.
- 결과: 앱·서버 모두 이미지 업로드 경로 0. 공개 업로드 엔드포인트 노출 위험 완전 해소.
- `APP_BUILD` v1.7.33.

## v1.7.32 (2026-06-16) [Claude] — 사법부 증거자료도 업로드 없이(이미지 URL/Canva) → 앱이 서버 업로드 완전 미사용
- 증거 입력: 파일 업로드(`uploadImage`) → **이미지 직접 주소(URL) 또는 Canva 링크 붙여넣기**(prompt, canva.com이면 canvaUrl·아니면 imageUrl 자동 분기). `Phase3JudicialQuickPanel`.
- 표시: 학생 자료실(`JudicialCaseRoom`)·TV 송출(`DebateTimerTVPage`)에 canvaUrl이면 iframe, imageUrl이면 img. 송출 payload(`presentEvidence`/`TeacherDebateControl`)에 canvaUrl 추가.
- 효과: **앱이 더 이상 `업로드엔드포인트`(서버)를 호출하지 않음**(포스터 v1.7.29 + 증거 이번). Cloudflare 포크 배포에서도 추가 서버 없이 증거 자료 사용 가능. `upload-helper.js`는 미사용 코드로 남음.
- `APP_BUILD` v1.7.32.

## (문서) 2026-06-16 [Claude] — README 포크 가이드 갱신 (앱 코드 변경 아님)
- 포스터 Canva 전용 전환 반영, 이미지/링크 백엔드 표(VITE_UPLOAD_URL/FETCH_META_URL/APP_URL, 모두 선택) 추가.
- "포크 시 원작자 <배포주소> 넣지 말 것" 경고, Cloudflare 환경변수 필수·로그인 실패 시 승인도메인 추가·데모용 별도 Firebase 권장 안내 추가.
- ⚠️ `docs/배포가이드/*.docx·*.pptx`(상세 핸드아웃)는 별도 수동 갱신 필요.

## v1.7.31 (2026-06-16) [Claude] — QR/공유 주소: 앱 로드 위치 그대로 계산(임의 배포경로 대응)
- v1.7.30의 QR 계산(`/app` 경로 가정)을 → **앱이 실제 로드된 주소**(`window.location.href`에서 해시·쿼리·index.html 제거)로 변경.
- 효과: 포크해서 Cloudflare Pages 루트(`xxx.pages.dev/`)·임의 서브경로·서브경로 어디에 배포해도 QR이 그 배포 주소를 자동으로 가리킴. `VITE_APP_URL`로 고정 가능.
- `StudentJoinShare`·`QrSharePage` 적용. `APP_BUILD` v1.7.31.

## v1.7.30 (2026-06-16) [Claude] — 포크 안전: 서버/앱 주소를 소스에서 분리(환경변수+자동계산)
- 공개 repo 포크 시 원작자 서버(<배포주소>)로 업로드/요청 가던 문제 해결. 소스에서 <배포주소> 하드코딩 전부 제거.
- `upload-helper.js`: 업로드 URL = `VITE_UPLOAD_URL` || 같은 호스트 `/업로드엔드포인트`(상대경로). localhost→서버 강제 분기 제거.
- `fetch-link-meta.js`: `VITE_FETCH_META_URL` || 같은 호스트 `/fetch_meta.php`(실패 시 microlink fallback).
- `StudentJoinShare`·`QrSharePage`: 공유/QR 앱 주소를 현재 배포 위치에서 자동 계산(`VITE_APP_URL`로 덮어쓰기 가능).
- `.env.example`에 VITE_UPLOAD_URL/VITE_FETCH_META_URL/VITE_APP_URL 문서화(+포크 주의). 작성자 실제값은 gitignore된 `.env.local`에만.
- `APP_BUILD` v1.7.30.

## v1.7.29 (2026-06-15) [Claude] — 포스터: 서버 이미지 업로드 제거, Canva 전용으로 전환
- 보안(공개 업로드 엔드포인트 노출) + 캔바 사용에 따라 `PosterUpload`에서 '사진 올리기'(서버 `uploadImage`) 모드 제거 → **Canva 임베드 전용**. `uploadImage`/`compressImage` 의존 제거.
- 기존 이미지 포스터는 갤러리에서 그대로 표시(읽기 영향 없음). 사법부 증거사진은 여전히 `업로드엔드포인트` 사용 → 서버 남용방지(Origin·레이트리밋)는 별도 과제.
- `APP_BUILD` v1.7.29.

## v1.7.28 (2026-06-15) [Claude] — 최종수정 단계: 대통령실 역할 분리(대표=승인만, 모둠원=시행령 수정만)
- `ExecutiveTab` ⑥: 대통령실 안에서 **대표(대통령, role `pledge_purpose`=isRepresentative)** 와 일반 모둠원을 구분.
  - 일반 모둠원(대통령실 포함): '우리 부처 최종 수정 폼'만 표시(대통령실은 안내문 추가). 대표는 폼 숨김.
  - 승인 보드: 교사 또는 **대통령(대표)** 에게만 표시(일반 모둠원·일반 부처 학생은 안 보임).
  - 판별: `groups[myGroupId].sessionRoles['executive-default'][myStudentId] === presidentRepKey`. 대표 미지정이면 모둠원으로 간주(폼 표시).
- `APP_BUILD` v1.7.28.

## v1.7.27 (2026-06-15) [Claude] — 최종수정 폼: policies 없으면 초안(finalDoc) 폴백 로드 → 대통령실 수정 가능
- **증상**: 최종수정 단계에서 대통령실이 보이긴 하나 수정 불가. **원인**: `policies/home`이 아직 없어(자가치유는 교사가 빠른제어 연 뒤에만 작동) `ExecutivePolicyFinalEdit`가 "정책 초안 없음"으로 표시.
- **수정**: `ExecutivePolicyFinalEdit`가 `policies/{groupId}`가 없으면 `branchDrafts/{unitId}/finalDoc.content`를 폴백 로드(unitId는 branchConfig.units에서 매핑). 발의(locked)면 status 'submitted'로 간주. 저장 시 `updateAt`이 `policies/{gid}`를 생성하므로 이후 정상 연동.
- `APP_BUILD` v1.7.27.

## v1.7.26 (2026-06-15) [Claude] — 근본 수정: 발의된 부처가 policies에 누락되면 자가치유
- `Phase3ExecutiveQuickPanel`에 자가치유 useEffect 추가(교사 전용 단일 클라이언트): `branchDrafts/{unitId}/finalDoc.status === 'locked'`(발의 완료)인데 `policies/{gid}`가 없거나 submitted 미만이면, finalDoc.content로 `policies/{gid}`를 `status:'submitted'`로 보강.
- 효과: 대통령실처럼 일부 발의 경로가 finalDoc만 잠그고 policies를 안 쓰던 케이스를 정상화 → 현황판·승인 보드·전광판 모두 네이티브로 동일 집계. 기존 방 데이터도 교사가 빠른제어를 열면 자동 보정. 조건상 submitted+면 재기록 안 함(안정), 작성중(draft)은 건드리지 않음.
- v1.7.25의 현황판 finalDoc 폴백은 표시 안전장치로 유지.
- `APP_BUILD` v1.7.26.

## v1.7.25 (2026-06-15) [Claude] — 예산 합계 불일치 진짜 원인 수정(대통령실 초안 locked 반영)
- **진단(라이브 CTS48E 읽기전용 조회)**: 대통령실(home) 정책이 발의(`finalDoc` locked)됐는데도 `policies`에 저장 안 됨 → `policies`만 읽는 현황판이 0.8억 누락. 교육부(wealth)는 진짜 `saved`(작성중)라 양쪽 정당 제외.
- **수정**: `ExecutiveCabinetPanel`에 `branchDrafts` 구독 추가, policies에 없어도 `finalDoc.status==='locked'`인 부처(대통령실)를 발의로 간주해 합계 포함. `ExecutiveApprovalBoard` 합계는 v1.7.24의 policiesMap 기준 → **해석된 행(초안 locked 폴백 포함)** 기준으로 환원. → 두 패널 모두 동일(예: 68.9억).
- 작성중(saved/draft) 부처는 여전히 양쪽 제외(행은 '작성중·합계 미포함' 표시).
- 참고: 근본 원인은 대통령실 발의가 `policies`에 기록되지 않는 데이터흐름. 이번엔 표시 일관성으로 해결.
- `APP_BUILD` v1.7.25.

## v1.7.24 (2026-06-15) [Claude] — 승인 보드 합계를 총예산 현황판과 일치(발의된 부처만)
- **증상**: 대통령 학생 화면에서 승인 보드 최종 합계(79.9억)와 아래 총예산 현황판(68.1억)이 다름.
- **원인**: 승인 보드는 내용 있는 모든 부처(작성중/미발의 포함, 예: 교육부 11억) 합산, 현황판(`ExecutiveCabinetPanel`)은 발의(submitted+)된 부처만 합산.
- **수정**: `ExecutiveApprovalBoard` 합계(초안/최종/추가/감액/잔여/승인 카운트)를 **발의된 부처만**(status submitted/requested/adjusted/final) 기준으로 변경하고 `totalFinalBudget` 공용 헬퍼 사용 → 현황판과 동일. 작성중 부처는 행은 보이되 "작성중 · 합계 미포함" 표시 + 상단 안내(N개 제외).
- `APP_BUILD` v1.7.24.

## v1.7.23 (2026-06-15) [Claude] — 대통령 승인 보드: 반려(되돌리기) 추가
- `ExecutiveApprovalBoard`: 각 부처 행에 [↩️ 반려] 버튼(최종승인 옆). 클릭 시 사유 입력 → `policies/{gid}` status `saved` + `rejected:true`·`rejectReason`로 되돌림. 행에 🔴 반려됨 표시(빨간 테두리), 펼치면 반려 사유 표시. 최종 승인/취소 시 rejected 해제.
- `ExecutivePolicyFinalEdit`: 부처 화면 상단에 반려 사유 배너(🔴) 표시 → 고친 뒤 재제출 안내.
- `APP_BUILD` v1.7.23.

## v1.7.22 (2026-06-15) [Claude] — 토론 도구: 준비만 상시, 시작·전광판·결과는 국무회의 단계만
- `Phase3ExecutiveQuickPanel`: [🛠️ 토론 준비]는 역할및준비(stage≥0)부터 상시 노출. [바로 토론 시작]·[토론 전광판]·[결과 발표]는 `stage === 4`(국무회의)에서만. 그 외 단계엔 "국무회의 단계에서 나타납니다" 안내.
- `APP_BUILD` v1.7.22.

## v1.7.21 (2026-06-15) [Claude] — 행정부 토론 도구(준비 포함)를 역할및준비 단계부터 상시 노출
- `Phase3ExecutiveQuickPanel` 국무회의 토론 도구 블록 게이트 `stage === 4` → `stage >= 0`. 토론 준비/시작/전광판/결과 발표가 역할및준비(stage0)부터 계속 보임(부처별 진행 현황처럼).
- `APP_BUILD` v1.7.21.

## v1.7.20 (2026-06-15) [Claude] — 교사 빠른제어 부처 카드에 받은 평점 + 상세 모달
- `Phase3ExecutiveQuickPanel` 부처별 실시간 진행 현황: 토의·평가 단계(stage≥3)부터 카드에 `renderRatingBadge`(⭐3축평균 · 평가 N명 · 자세히) 노출(공동·역할중심 양 모드).
- 배지 클릭 → `ratingDetail` 모달: 찬반 집계·예산의견 집계·3축 평균·제안예산 평균 + 개별 댓글(찬반/예산/제안액/이유/3축 별점) 목록.
- `APP_BUILD` v1.7.20.

## v1.7.19 (2026-06-15) [Claude] — 최종수정 단계: '우리 부처 최종 수정 폼'을 맨 위로
- `ExecutiveTab` ⑥ 단계 순서 변경: 모둠 학생의 '우리 부처 최종 수정 폼'을 섹션 최상단(헤더 바로 아래)으로 이동. 그 아래로 승인 보드(대통령·교사) → 총예산 현황판 → (교사) 전체 부처 폼/미가입 안내 순.
- `APP_BUILD` v1.7.19.

## v1.7.18 (2026-06-15) [Claude] — 국무회의 토론 준비 모달(설문·팀·절차 미리세팅)
- `Phase3ExecutiveQuickPanel` ⑤ 국무회의 영역: [🛠️ 토론 준비] 버튼 + 모달 추가. 사전 설문 질문(수정 가능)·선택지 미리보기, 자동 팀 배정 미리보기(부처+대통령 의장+평가단), 토론 절차 각 단계 시간(초) 조정, 총 소요시간 표시. [이대로 토론 시작]으로 적용 시작. 기존 [▶ 바로 토론 시작]도 유지.
- `startCabinetDebate(overrides)` 리팩터: `pollQuestion`·`stageSeconds` 오버라이드 지원.
- `APP_BUILD` v1.7.18.

## v1.7.17 (2026-06-15) [Claude] — 승인 보드 개편(맨 위·단계·초안↔최종 차액) + 토론도구 대통령 업무지시·대본
- **승인 보드 개편**(`ExecutiveApprovalBoard`): ⑥ 단계 맨 위로 이동. 행마다 진행 단계 스텝퍼(작성중→발의됨→승인대기→승인완료) + 초안→최종 예산 + 추가/감액 차액 표시. [👑 최종 승인] 버튼을 상태 옆(접힌 행)에 두어 펼치지 않고 바로 승인. 상단 요약에 초안 합계·최종 합계·추가 합계·감액 합계·순변동 추가.
- **토론도구 대통령 표시(1c)**: `CabinetScriptBox`에 부처별 업무지시(`branchDrafts/exe-president/directives`) 섹션 추가, 평가단 화면에도 렌더(대통령실 자체 게이트). 대통령 모둠이 국무회의 토론도구에서 업무지시+진행 대본을 본다.
- 온라인토의 업무지시(1d)는 기존 대통령 카드 directives 블록으로 이미 노출됨(시행령 잠금해제 v1.7.9 이후 카드 표시).
- `APP_BUILD` v1.7.17.

## v1.7.16 (2026-06-15) [Claude] — 최종안 보기 모달: 내부 변수 진단 줄 → 쉬운 말로 교체
- `Phase3ExecutiveQuickPanel` 최종안 보기 모달 상단의 진단 줄(`제출상태: adjusted / requestedBudget / 섹션예산합계`) 제거 → 한국어 안내로: 진행 상태(상태코드→라벨 매핑), '청구한 예산', '모둠원이 각자 작성한 예산 합계', 둘이 다르면 ⚠️ 안내 문구.
- `APP_BUILD` v1.7.16.

## v1.7.15 (2026-06-15) [Claude] — 대통령 최종 승인 보드 신설 (대통령 모둠 직접 승인 + 교사 빠른제어)
- 신규 `ExecutiveApprovalBoard.jsx`: 예산현황판 스타일 요약(정부 총예산/최종 배정 합계/잔여·초과/승인 진행률) + 부처 간략 행 목록. 행 클릭 시 시행령·집행계획·정책명/문제/대상·예산 항목 펼침. 부처별 [👑 최종 승인](status `final`)·[↩️ 승인 취소](status `adjusted`). 승인 권한 `role === 'teacher' || isPresident`(대통령 모둠).
- `ExecutiveTab` ⑥ 최종수정 단계: `role === 'teacher' || isPresidentGroup`이면 현황판 아래 보드 노출 → **대통령 학생이 다른 부처를 직접 승인** 가능(기존엔 자기 모둠 폼만 보여 불가했음).
- `Phase3ExecutiveQuickPanel`: '부처별 실시간 진행 현황' 헤더에 [👑 대통령 최종 승인 보드] 버튼 추가 → 모달로 같은 보드 표시(교사 빠른제어에서 승인 가능).
- `APP_BUILD` v1.7.15.

## v1.7.14 (2026-06-15) [Claude] — 눈 아이콘(👁/👀) 전부 제거 (라벨 텍스트만 유지)
- 사용자 요청으로 앱 전체 눈 아이콘 삭제: `Phase3ExecutiveQuickPanel`(👁 내용 확인), `JudicialVerdictTab`(👀 참관팀), `CanvaCardNewsStep`(👁️ 미리보기), `MyGroupActivityPreview`(👀 미리보기), `ClassroomConfigEditor`(👁️ 학생 정보 보기). 라벨 글자는 유지.
- `APP_BUILD` v1.7.14.

## v1.7.13 (2026-06-15) [Claude] — 행정부 빠른제어: 미제출(작성중)이어도 '최종안 보기' 노출
- **증상**: 토론도구 시행령 전광판엔 부처(예: 교육부) 내용이 보이는데, 교사 빠른제어 부처 카드엔 '최종안 보기'가 안 뜸.
- **원인**: 전광판(`ExecutiveBudgetReviewBoard`)은 내용만 있으면 status 무관하게 표시하지만, 빠른제어는 '최종안 보기'를 `submitted/requested/adjusted/final` 또는 finalDoc `locked`일 때만 띄움. 부처가 `saved`/`draft`(작성중)면 누락.
- **수정**: `Phase3ExecutiveQuickPanel` 역할중심·공동작업 두 모드 모두 — `resolvedPolicyContent` 기준 내용(시행령·예산)이 있으면(`hasFinalContent`) '최종안 보기' 노출. '제출 취소'는 실제 제출/잠금(`isSubmittedFinal`)일 때만 노출.
- `APP_BUILD` v1.7.13.

## v1.7.12 (2026-06-15) [Claude] — 행정부 빠른제어: 역할별 "보기" 라벨 눈 아이콘 제거
- `Phase3ExecutiveQuickPanel` 역할 카드 우상단 `👁 보기` → `보기`로 눈 아이콘만 제거.
- `APP_BUILD` v1.7.12.

## v1.7.11 (2026-06-15) [Claude] — 국무회의: 시행령 보기 버튼을 타이머 [대본 보기] 옆으로 이동
- v1.7.10의 전폭(full-width) 링크 제거 → `DebateTimer`에 `onPolicyReview` prop 추가, 타이머 헤더 **[대본 보기] 버튼 옆**에 같은 알약(pill) 스타일의 [📜 시행령 보기 ↗] 버튼 노출(평상시 indigo, 전체화면 시 흰색계열로 대본보기와 톤 일치).
- `DebateToolPanel`은 `openExecPolicyBoard(roomCode)` 헬퍼로 정리하고, 국무회의(`session.relatedExecutiveMeeting`) 세션의 전체 타이머(일반 학생·평가단 뷰)에만 콜백 전달. 다른 토론/컴팩트 타이머엔 미노출.
- `APP_BUILD` v1.7.11.

## v1.7.10 (2026-06-15) [Claude] — 국무회의 토론도구: 다른 모둠 시행령·예산 새 창 검토 링크
- `DebateToolPanel`에 `ExecutivePolicyReviewLink` 추가. **국무회의 세션(`session.relatedExecutiveMeeting`)에서만** 토론 타이머 바로 아래에 [📜 다른 모둠 시행령·예산 보기 (새 창)] 버튼 노출.
- 클릭 시 기존 TV 전광판(`#/tv-executive-board?room=CODE` = `ExecutiveBudgetReviewBoard`)을 **새 창**으로 열어, 모든 부처의 시행령 초안·집행계획·예산 산출식을 토론과 분리된 창에서 확인. (토론도구 내부가 아님)
- 일반 학생 뷰·평가단 뷰 타이머 아래 모두 배치(의장 미니는 일반 뷰에 포함). 재판/선거 등 다른 토론에는 노출 안 됨.
- `APP_BUILD` v1.7.10.

## v1.7.9 (2026-06-15) [Claude] — 행정부 온라인 토의: 대통령실 정책 평가 잠금 해제 (역할중심)
- **진단**: 역할중심 모드에서 "대통령실 카드가 안 보인다"의 실체는 — 대통령실 정책이 `policies/{presidentGid}`에 내용까지 존재하나 status가 `saved`(발의 대기중)에 머물러, 토의 목록이 일반 부처의 평가를 잠근 것(🔒). (라이브 DEMO24 데이터로 확인: presidentGroupId=env, 정책 존재, status=saved, 타 부처는 submitted/adjusted)
- **수정**: 대통령실 카드는 `saved` 상태여도 항상 평가 가능하도록 `canEvaluate`에 `isPresident` 예외 추가(잠금 안내·폼 잠금 해제). 일반 부처는 기존대로 발의 후 평가(영향 없음).
- `APP_BUILD` v1.7.9.

## v1.7.8 (2026-06-15) [Claude] — 행정부 온라인 토의: 초안 수정 패널 안에서도 받은 의견 표시
- 의견 목록을 `PolicyCommentsList`로 분리(읽기 표시 + 답글). `ExecutivePolicyCommentBox`는 평가 입력/내 의견 관리만 담당하고 목록은 이 컴포넌트 재사용.
- "댓글 보고 수정하기"로 초안 편집 시, 편집기(`ExecutivePolicyBudgetDraft`) **위에 받은 의견을 접이식(`💬 받은 의견 보기`)으로 표시** → 의견을 보면서 바로 수정 가능. (편집기가 길어 맨 아래 목록이 멀던 문제 해결)
- `APP_BUILD` v1.7.8.

## v1.7.7 (2026-06-15) [Claude] — 행정부 온라인 토의: 의견 작성자 수정·삭제 + 초안 수정 중 기존 의견 유지
- `ExecutivePolicyCommentBox`: 제출 후 잠그던 것 → **작성자 본인이 자기 의견을 수정·삭제** 가능(`editing`/`startEdit` 배선, `updateAt`로 수정 시 replies·createdAt 보존, `removeAt`로 삭제). "수정/삭제 불가" 경고 문구 제거.
- **초안 수정 시 댓글 사라짐 해결**: 정책이 `saved`(발의 대기/수정 중) 상태일 때 기존 의견 목록을 통째로 숨기던 분기 제거. 이제 `canEvaluate`/`lockNotice` prop으로 **'새 평가 작성'만** 평가단·대통령·교사로 제한하고, **기존 의견은 상태와 무관하게 항상 표시**.
- `APP_BUILD` v1.7.7.

## v1.7.6 (2026-06-15) [Claude] — 행정부 온라인 토의: 의견(질문)에 부처 답글 기능
- `ExecutivePolicyDiscussionList.jsx`에 `PolicyReplyThread` 추가. 다른 부처가 남긴 의견(질문) 아래에 답글 스레드 표시.
- 답글 작성은 **해당 정책을 낸 모둠 구성원만** 가능(`canReply = role === 'student' && isMine`). 질문을 받은 부처만 답변. 답글은 모두에게 보임.
- 저장 경로: `executivePolicyComments/{commentId}/replies/{replyId}` (기존 댓글 구독에 포함되어 추가 구독 불필요). 작성자 본인·교사는 답글 삭제 가능.
- `APP_BUILD` v1.7.6.

## v1.7.5 (2026-06-12) [Codex] — 행정부 초안 단계 전광판·최종안·예산 소수점 표시 보정
- 초안 작성 단계에서도 전광판이 `policies`뿐 아니라 `branchDrafts/finalDoc`과 역할별 섹션 예산을 합쳐 표시하도록 보강.
- 교사 빠른제어의 최종안 보기가 정책 필드·시행령·예산안을 `policies`/`finalDoc`/섹션 저장본 순서로 폴백해 보여주도록 수정.
- 예산 계산 결과와 합계 표시를 공통 포맷터로 정리해 소수점 첫째자리까지만 표시. `APP_BUILD` v1.7.5.

## v1.7.4 (2026-06-08) [Claude] — 최종안 모달: 전체 policyFields + 진단 줄 + 섹션 원본 접기
- 모달이 4개 필드만 체크하던 것 → 비어있지 않은 모든 필드를 라벨과 함께 표시. 진단 줄(requestedBudget vs 섹션합계). 섹션 원본 접기 추가. `APP_BUILD` v1.7.4.

## v1.7.3 (2026-06-08) [Claude] — 교사 빠른제어: 최종안 보기 버튼 + 부처/역할별 예산안 표시
- 부처 카드 [제출 취소] 옆 [📄 최종안 보기] 추가. `openPolicyDetail` 섹션 예산 폴백+역할별 분리 표시, 예산 없으면 명시. `APP_BUILD` v1.7.3.

## v1.7.2 (2026-06-08) [Claude] — 전광판이 모둠원 섹션 예산(branchDrafts) 폴백 합산
- 정책에 예산 미반영 시에도 보이도록 전광판이 branchDrafts 구독→섹션 예산 합계 폴백(`budgetOf`/`unitIdOf`/`sectionBudgetOf`). `APP_BUILD` v1.7.2.

## v1.7.1 (2026-06-08) [Claude] — 역할중심 제출 예산이 전광판 0으로 잡히던 근본 원인 수정(빈배열 truthy)
- `mergedFinalDoc` 예산 병합이 `[] ? finalBudgets : merged`로 빈배열을 truthy 처리 → 대표 빈예산이 섹션예산 가림. `finalBudgets.length>0`로 수정. `APP_BUILD` v1.7.1.

## v1.7.0 (2026-06-08) [Claude] — 교사 빠른제어에서 초안/예산 작성 내용 클릭 확인
- `Phase3ExecutiveQuickPanel` 상세 모달: 역할 카드 클릭→qna·링크·예산 확인, 공동작업 카드 "내용 확인"→정책·시행령·예산 확인. `APP_BUILD` v1.7.0.

## v1.6.9 (2026-06-08) [Claude] — 예산 전광판이 제출 정책 예산 반영 안하던 문제(예산항목 합계 폴백)
- `ExecutiveBudgetReviewBoard`가 `p.draftBudget`만 읽어 일부 제출건이 0. `budgetOf`로 requestedBudget/draftBudget 없으면 budgetItems 합계 사용. `APP_BUILD` v1.6.9.

## v1.6.8 (2026-06-08) [Claude] — 대통령실 대표 최종 검토/조립을 부처와 동일하게(옛 섹션키 제거)
- `ExecutiveFinalAssembler.loadPreviewToEditor`의 대통령 전용 분기가 옛 키(cabinet_moderator 등) 읽어 빔 → 대통령 분기 제거, 부처 공통 분기(skeleton/decree/evidence/effect) 적용. `APP_BUILD` v1.6.8.

## v1.6.7 (2026-06-08) [Claude] — '작성본 모두 불러오기' 시 일부 내용 2번 들어가던 중복 수정
- 제1조 조립이 purpose·problem(둘 다 qna[1]) 이어붙여 중복 → Set 중복 제거. 조립기 txt 폴백 제거(중복 유발). `APP_BUILD` v1.6.7.

## v1.6.6 (2026-06-07) [Claude] — 대표 최종 검토 '작성본 모두 불러오기' 설명·경고·저장 개선
- `ExecutiveFinalAssembler` 불러오기 버튼명/설명 추가, 직접 다듬은 내용 있으면 confirm 후 새로 불러오기(finalDoc 병합 제거), 불러온 즉시 onSaveDraft 저장. `APP_BUILD` v1.6.6.

## v1.6.5 (2026-06-07) [Claude] — 역할중심 통합 미리보기 누락(특히 제3조 시행절차) 수정 + 원문 폴백
- decree 매핑 `content=q0`만→`q0+q1`로 합침(q1 순서 누락 수정). `renderExecutiveAssemblyDraft`/`ExecutiveFinalAssembler`에 섹션 원문(text) 폴백 추가(매핑 비어도 답 표시). `APP_BUILD` v1.6.5.

## v1.6.4 (2026-06-07) [Claude] — 역할중심 시행령 최종 조립/미리보기에서 1~5조가 비던 버그 수정
- 원인: 역할중심 섹션은 policyFields={qna,text,links}로 저장되는데 `ExecutiveFinalAssembler`가 원시 필드(purpose/content/evidence) 직접 읽어 빔. 수정: 조립기에 qna→조항필드 변환 `fieldsOf` 추가. `APP_BUILD` v1.6.4.

## v1.6.3 (2026-06-07) [Claude] — 토의화면 인라인 수정: 재제출 시 '수정 닫기' 단계 없이 자동 종료
- `ExecutivePolicyDiscussionList`: 재제출(submitted) 감지 시 editingGid 자동 해제(sawEditableRef로 경합 방지). `APP_BUILD` v1.6.3.

## v1.6.2 (2026-06-07) [Claude] — 행정부 초안 일괄 제출을 단계 전환 시 '자동' 실행으로
- 버튼만이라 안 누르면 'saved'로 남아 평가 막히던 문제. `Phase3ExecutiveQuickPanel`에 stage≥2 진입 시 `bulkSubmitDrafts` 1회 자동 실행(마커 `executiveBulkSubmitDone`). 수동 버튼 유지. `APP_BUILD` v1.6.2.

## v1.6.1 (2026-06-07) [Claude] — 행정부 토의·평가: 작성분 일괄 제출(마감) + 평가 중 토의화면 즉시 수정·재제출
- [A] `Phase3ExecutiveQuickPanel` "📥 모든 부처 초안 일괄 제출"(`bulkSubmitDrafts`, stage 2/3) — 작성분 있는 미제출 부처 모두 submitted 마감(policies→finalDoc→섹션 병합 순).
- [B] `ExecutivePolicyDiscussionList` 우리 모둠 카드 "✏️ 댓글 보고 수정하기" → 잠금 해제 후 `ExecutivePolicyBudgetDraft` 인라인 편집·재제출.
- `npm run build` 통과. `APP_BUILD` v1.6.1.

## v1.6.0 (2026-06-07) [Claude] — 4건: 공동작업 대통령실 국무회의 준비 / 토론 평가단 일괄 / 갤러리워크 / 캔바 평가목록
- #1 공동작업 대통령실에 국무회의 준비(PresidentControlPanel: 공약·업무지시·대본) + 자료 올리기(ResearchWorkspace). 대본은 토론도구로 연결.
- #2 토론도구 "나머지 전부 평가단" 버튼(`setRestAsEvaluators`, 미배정만 평가단).
- #3 갤러리워크 `ReflectionCard` 전부 펼침(캔바·마치며·댓글) + 답글은 글쓴이만(`CommentList` ownerStudentId prop).
- #4 `CanvaCardNewsStep` 평가 활동 상위4 제한 제거→별점순 전체 스크롤.
- `npm run build` 통과. `APP_BUILD` v1.6.0.

## v1.5.2 (2026-06-07) [Claude] — 공동작업 제출 후 임시저장이 제출상태를 'saved'로 강등하던 버그 수정
- 증상: 공동작업 제출했는데 교사화면 '작성중'(demo24 마음의집). 원인: 동시편집 중 제출 직후 임시/구역 저장이 로컬 상태 기준으로 status를 'saved'로 강등.
- 수정: `handleSaveDraft`/`handleSavePart`에서 `getOnce`로 DB 현재 status 확인 → 제출 상태면 저장 차단. `APP_BUILD` v1.5.2.

## v1.5.1 (2026-06-07) [Claude] — 행정부 초안 제출을 교사가 취소 → 학생 재제출 가능
- 공동작업/역할중심 공통. 빠른제어 부처 카드에 "↩️ 제출 취소" 버튼. `cancelSubmission`: finalDoc 'draft' + policies 'saved'(내용 보존). `APP_BUILD` v1.5.1.

## v1.5.0 (2026-06-07) [Claude] — 교사 제출물 열람에 "🕒 시간별 모아보기" 타임라인 탭 추가
- 신규 `SubmissionTimeline`: 여러 노드를 한번에 구독해 시간·유형·작성자·요약·본문으로 정규화, 날짜별 섹션+날짜 필터 칩, 클릭 시 본문 펼침. `SubmissionMonitor` 첫 탭. `APP_BUILD` v1.5.0.

## v1.4.8 (2026-06-07) [Claude] — ② 초안작성 자료실: 입력창 제거, 준비 요약(읽기전용)으로 교체
- 후반 단계 상단 자료실 입력창 제거. 신규 `ExecutivePrepSummary`: 수집 자료(ResearchReferencePanel) + 대표 할 일(chosenTask) + 비슷한 시행령·참고자료(읽기전용). `APP_BUILD` v1.4.8.

## v1.4.7 (2026-06-07) [Claude] — 역할중심 ② 초안작성 단계 상단에 통과 법안 확인 추가
- ② 초안작성 섹션 상단에 `PassedLawPrepPanel` 접기 패널 추가(①과 동일). `APP_BUILD` v1.4.7.

## v1.4.6 (2026-06-06) [Claude] — 교사 빠른제어에서 대표 직접 지정 추가
- 부처별 진행 현황에 "👑 대표 지정" 드롭다운 — 교사가 모둠원 중 대표를 직접 지정(기존 대표 해제 후 부여). `APP_BUILD` v1.4.6.

## v1.4.5 (2026-06-06) [Claude] — 교사 빠른제어: 역할및준비 라벨·역할배정 가독성·대표·워드클라우드/할일 표시
- 빠른제어 dot 라벨 '역할'→'역할및준비', STAGE_INFO[0] '① 역할 및 준비'.
- 역할 카드 2줄 개편(역할명+대표배지 / 학생 이름 크게+상태배지) — 이름 가림 해결.
- 대표 역할에 '대표' 배지. 잠금/초기화 버튼은 ① 단계 기존 제공.
- 부처 현황에 워드클라우드(brainstorm)+우리 부서 할 일(chosenTask) 표시(`branchDrafts/{unitId}/prep`).
- `npm run build` 통과. `APP_BUILD` v1.4.5.

## v1.4.4 (2026-06-06) [Claude] — 비슷한 시행령 참고자료: 구버전(이전 업로드) 자료도 삭제 가능
- 참고자료 소유자 판별 `ownerId = r.by || r.id`로 보강 → 구버전 단일구조 자료도 삭제 ✕ 노출. `APP_BUILD` v1.4.4.

## v1.4.3 (2026-06-06) [Claude] — 행정부 "① 역할 및 준비" 순서 재정비 + 참고자료 다중 추가
> 역할중심 모드 전용.
- 가결법령 확인+근거자료실(기사수집)을 ① 흐름 안으로 이동. 순서: 역할 나누기 → 근거기사 찾기 → 워드클라우드 → 할일(대표) → 비슷한 시행령(대표). 위쪽 별도 자료실은 역할 단계에서 숨김, ②/④에서만 참고용.
- 비슷한 시행령 참고자료 1인 1개 → 다중. 링크+메모 입력 후 [추가], 본인/교사 ✕ 삭제. `prep/references/{pushId}`.
- `npm run build` 통과. `APP_BUILD` v1.4.3.

## v1.4.2 (2026-06-06) [Claude] — 부처별 정책뉴스(korea.kr) 링크를 기사자료수집 영역으로 이동
- `ResearchWorkspace`에 `referenceLinks` prop 추가 → "📰 기사자료수집" 아래 표시. `ExecutiveTab`에서 korea.kr 전달, 자료실 맨 위 임시 링크 제거. `APP_BUILD` v1.4.2.

## v1.4.1 (2026-06-06) [Claude] — 워드클라우드 단어 2개씩 추가되던 한글 IME 이중입력 수정
- `ExecutivePrepPanel` Enter 핸들러 `isComposing` 가드 + `addingRef` 재진입 잠금. `APP_BUILD` v1.4.1.

## v1.4.0 (2026-06-06) [Claude] — 행정부 역할중심 "① 역할 및 준비" 단계 신설
> 역할중심 모드 전용. 공동작업 모드·기존 데이터 불변.
- ① 라벨 "준비"→"역할 및 준비". 역할 나누기(내가 맡을래요)를 ② 초안작성에서 ① 맨 앞으로 이동. ②는 자기 초안 작성만.
- `BranchUnitWorkspace`에 `executivePhase`('roles'/'draft'/undefined) prop — 역할 보드/초안 편집 분리. 입법·사법·대통령실 영향 없음.
- 신규 `ExecutivePrepPanel`: 워드클라우드 브레인스토밍 + 할 일 정하기(대표) + 비슷한 시행령(대표)+참고자료(각자). 새 노드 `branchDrafts/{unitId}/prep/*`.
- 자료실 상단 정책뉴스(korea.kr) 링크.
- `npm run build` 통과. `APP_BUILD` v1.4.0.

## v1.3.8 (2026-06-06) [Claude] — 역할중심 시행령 작성기에 통과 법안 보기 추가
- `ExecutiveSectionEditor` 상단에 "📜 통과된 법안 보기" 접기 패널(기본 펼침). `passedBills` 제목·본문 표시. 역할중심 모드에서 통과 법안이 안 보이던 문제 보완. `APP_BUILD` v1.3.8.

## v1.3.7 (2026-06-06) [Claude] — 기사 본문 글자수 제한 400 → 1000자
- `ArticleEditor` 본문 `maxLength` 400→1000, 카운터/문구 갱신. `APP_BUILD` v1.3.7.

## v1.3.6 (2026-06-06) [Claude] — 기사 수정 중 내용 사라짐/되돌아감 버그 수정
- 원인: `ArticleSection`이 실시간 구독본에서 `articleData`를 매번 새 객체로 내려보내 `ArticleEditor` 초기화 effect가 재실행 → 입력 중 내용이 서버 저장본으로 리셋.
- 수정: `ArticleEditor`에 `initializedFor` ref — 같은 기사 id는 1회만 초기화, 이후 실시간 갱신 무시.
- `npm run build` 통과. `APP_BUILD` v1.3.6.

## v1.3.5 (2026-06-06) [Claude] — 제출물 열람 기사 유형별 구분 + implementation_plan 수정 누적 로그 도입
- `SubmissionStatusQuickPanel` 기사 단계(article1/2/3)를 여정/토론후 2그룹으로 분리(contextType 기준), 이름·건수 표시 + 본문 펼침. 신규 `ArticleGroupBlock`.
- `implementation_plan.md` 상단에 "수정 누적 로그" 표 도입(이름·날짜·상태 ✅/🔶/⏸ 누적). 대통령실 개편·제출물 열람 항목 시드. 배포본/개발폴더 양쪽.
- `npm run build` 통과. `APP_BUILD` v1.3.5.

## v1.3.4 (2026-06-06) [Claude] — 대통령실 개편 후속 4건 (국무회의 대본 노출·업무지시 게시·호칭·제출물 열람)
- #1 신규 `CabinetScriptBox`: 국무회의 다자토론에서 대통령실 모둠 타이머 밑에 진행 대본(branchDrafts/exe-president/cabinetScript) 읽기전용 노출(`DebateToolPanel`).
- #2 `ExecutivePolicyDiscussionList`가 `branchDrafts/exe-president/directives` 구독 → 대통령실 정책 카드에 "부처별 업무지시" 블록(부처가 반응 가능).
- #3 대통령실 대표 호칭 '장관'→'비서실장'(`BranchUnitWorkspace` repLabel, `ExecutiveFinalViewer` repLabel prop).
- #4 `SubmissionMonitor`: 토론 주제(세션)별 보조 필터 + 토론 준비카드 4개 양식 항목 전체 표시(빈칸은 (빈칸)).
- `npm run build` 통과. `APP_BUILD` v1.3.4.

## v1.3.3 (2026-06-05) [Claude] — 대통령실 개편 증분 2~4: 공약 선택·부처 업무지시·국무회의 대본·예산 예약분
- 제안서: `docs/proposal_president_pledge_decree_2026-06-05.md` (rev1).
- 신규 `PresidentControlPanel.jsx`: ① 공약 선택(candidates.pledges 중 1개 + 법령 연결 한 줄) ② 부처별 업무지시(executive.units 자동 나열) ③ 국무회의 대본 자동생성·공동수정. 저장 `branchDrafts/exe-president/{selectedPledge|directives|cabinetScript}`.
- 예산 예약분: 총예산에서 대통령 공약 예산 먼저 차감 → 부처는 잔여분에서 조정. `ExecutiveBudgetReviewBoard`·`Phase3ExecutiveQuickPanel` 보정. `ExecutiveTab`에서 대통령실 유닛에 패널 연결.
- `npm run build` 통과. `APP_BUILD` v1.3.3.

## v1.3.2 (2026-06-05) [Claude] — 대통령실 개편 증분 1: "공약 연계 시행령" 역할로 전면 교체 (부처 엔진 재사용)
- 제안서: `docs/proposal_president_pledge_decree_2026-06-05.md` (rev1, 사용자 조정 반영).
- `scaffolding-data.js` `executive_president`를 일반 부처 미러 4역할(공약 목적·대상/시행절차/지원내용·예산/점검·효과 담당)로 교체. 시행령 요소 키(skeleton/decree/evidence/effect) 동일 사용 + 역할별 예산 1개. 안내문은 "공약" 프레이밍.
- `ExecutiveTab.jsx`: 대통령실을 별도 `PresidentWorkspace`(약 300줄) 제거하고 `BranchUnitWorkspace` 엔진으로 라우팅(데드코드·미사용 import 정리).
- 남은 증분: 공약 선택 / 부처별 업무지시(units 자동 나열) / 국무회의 대본 자동생성 / 예산 예약분. 미배포(증분 묶음 완성 후 배포).
- `npm run build` 통과. `APP_BUILD` v1.3.2.

## v1.3.1 (2026-06-05) [Claude] — 대통령실 지정이 학생 화면에 연결 안 되던 라우팅 버그 수정
- **[FIX]** 행정부 역할중심 모드에서 **대통령 모둠으로 지정해도 일반 부처(장관)와 같은 시행령·예산 작성 폼이 뜨던** 문제 수정.
- **원인**: `ExecutiveTab.jsx`가 대통령실 전용 화면(`PresidentWorkspace`)을 띄울지 판단할 때 `unit.unitId === 'exe-president'` 리터럴만 비교. 그러나 대통령 모둠을 지정하면 `unitId`는 `genUnitId('exe')`로 저장되어 절대 `'exe-president'`가 되지 않아 항상 일반 `BranchUnitWorkspace`로 떨어졌다.
- **수정**: 판별을 `presidentGroupId` 일치 또는 모둠명 '대통령' 포함으로 보강. 대통령 역할 데이터·전용 화면은 이미 존재했고 연결만 누락된 상태였음. `npm run build` 통과, `APP_BUILD` v1.3.1.
- (참고: 이 개발폴더 history는 배포본의 v1.3.0[Antigravity] 항목이 누락된 상태로 분기되어 있음.)

## v1.2.325 — 사법부 증거 TV 송출 + 타이머 TV 전체화면 기본화 (2026-05-31 / [Claude])
- **[기능]** `TeacherDebateControl`에 🗂️ 증거 TV 송출 패널 추가 — 모의재판 세션에서 증거 목록 버튼으로 `judicialPresentation` Firebase 경로에 송출, 같은 버튼 재클릭으로 종료.
- **[기능]** `DebateTimerTVPage` 전면 개편 — 전체화면 타이머가 기본(토글 버튼 없음), 증거 송출 시 `z-[70]` 오버레이로 타이머 위에 표시(상단에 단계명+타이머 작게 실시간 표시).
- **[버그픽스]** TV 창 새로 열 때 이전 증거 데이터 잔류 문제 — `firstSnapRef`로 첫 스냅샷 무시.
- **[기능]** `JudicialCaseRoomButton` 컴포넌트 신규 — 사법부 ②~④ 단계 및 토론 도구에서 사건 자료실 모달로 열기.
- **[기능]** `Phase3JudicialQuickPanel.startJudicialDebate()`에 `TRIAL_STAGES` 자동 초기화 추가 — 세션 생성 시 토론 단계가 비어있던 문제 해결.
- **[기능]** `DebateTimer`에 `defaultFullscreen` prop 추가 — TV 페이지에서 닫기 버튼 숨김.

## v1.2.322 — GitHub 공개 저장소 셋업 (2026-05-31 / [Claude])
- **[인프라]** `~/class_democra_dev`를 git 루트로 초기화, `https://github.com/babosam-netizen/mingook-dream` 저장소에 첫 push.
- **[보안]** `.gitignore` — `.env`, `node_modules`, `dist`, `docs/firebase-rules.json`, `.playwright-mcp`, `app/.claude` 제외.
- **[문서]** `LICENSE` (CC BY-NC-SA 4.0), `README.md` (다른 선생님 배포 안내), `app/.env.example` (키 이름만), `docs/firebase-rules-sample.json` (uid 플레이스홀더) 추가.
- **[운영]** 현재 수업은 서버 + 기존 Firebase 그대로 유지. GitHub은 백업 + 공개 공유 용도. Cloudflare 연결은 수업 종료 후로 보류.
- **[주의]** `docs/`가 서버(`<배포경로>/docs/`)와 개발폴더(`~/class_democra_dev/docs/`) 두 곳에 존재 — 문서 수정 시 개발폴더 쪽 수정해야 GitHub에 반영됨.

## v1.2.321 — Firebase Auth 도입 (교사 이메일/학생 익명) + 보안 규칙 강화 (2026-05-31 / [Claude])
- **[보안]** `firebase.js`에 `getAuth` 추가, Auth 모듈 초기화.
- **[보안]** `App.jsx`에 `onAuthStateChanged` + `signInAnonymously` 추가 — 앱 시작 시 자동 익명 로그인, `authReady` 상태로 Auth 완료 후 DB 구독 시작 (새로고침 1번 문제 해결).
- **[보안]** `EntryPage.jsx` 교사 비밀번호 제출 시 `signInWithEmailAndPassword` 연결 — Firebase 교사 계정으로 실제 로그인. Firebase 로그인 실패해도 앱은 기존처럼 동작하는 안전장치 포함.
- **[보안]** `EntryPage.jsx` 교사 버튼 클릭 시 Firebase Auth 로그인 여부 확인 — 미로그인이면 세션 초기화 후 비밀번호 화면으로 이동 (건너뜀 버그 수정).
- **[보안]** Firebase Realtime Database 보안 규칙 교사 uid(`KzRu8gDs0iW9AQRDtnvImn5t46Y2`) 포함 완성본 적용 — 미인증 외부인 차단, 교사 전용 노드(currentPhase/config 등) 보호, 투표 덮어쓰기 방지.
- **[문서]** `LICENSE` (CC BY-NC-SA 4.0), `README.md` (다른 선생님 배포 안내서) 추가.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료.

---

## v1.2.320 — 역할중심 prep에도 모둠별/개인별 팀 배정 UI 추가 (2026-05-29 / [Claude])
- **[기능]** `Phase3JudicialQuickPanel` 역할중심 준비단계에 **6팀 모둠 지정 셀렉트 그리드**(판사·검사·변호·배심원·증인·기자)를 추가 — 판결중심에서 이미 제공하던 패턴을 역할중심에도 동일 적용. `assignMode==='group'`일 때만 노출, 개인별 모드에선 기존 `JudicialMemberAssigner`로 학생별 배정.
- **[검증]** preview에서 DEMO24를 role+group으로 전환해 6팀 셀렉트 노출 + 기존 배정값(판사=마음의집/검사=그린피스/변호=내일의노동) 자동 반영 확인. 검증 후 원상태(verdict+individual) 복구.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.320.

---

## v1.2.319 — 판결중심 학생 화면 연기/참관 표시를 assignMode 모드별로 분기 (2026-05-29 / [Claude])
- **[버그픽스]** `JudicialVerdictTab` 준비단계 "🎬 연기 팀 / 참관 팀" 패널이 `judicial.{side}` 모둠 배열만 읽어, 개인별 배정으로 바꿔도 옛 모둠명이 그대로 노출되던 문제 수정.
  - `assignMode==='individual'`이면 `judicial.members.{side}` 학생 ID들을 `students`로 매핑해 "1번 김민준, 2번 이서연…" 형식으로 노출.
  - 헤더에 "개인별 배정"/"모둠별 배정" 뱃지, "그 외 모둠 → 그 외 학생들", "우리 모둠은 → 나는" 문구도 모드별 분기.
  - 안내 문구도 개인별일 땐 "모둠끼리 모여 판결문을 함께 씁니다"로 정정.
- **[검증]** preview에서 DEMO24의 개인 배정(judge=1번 김민준 / pros=2번 이서연 / def=3번 박도윤)이 정확히 노출됨 확인.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.319.

---

## v1.2.318 — 사법 빠른제어 준비단계에 판결중심/역할중심 토글 추가 (2026-05-29 / [Claude])
- **[UX]** `Phase3JudicialQuickPanel` — 준비(stage 0) 공통 영역 상단에 사법부 활동 방식 토글(🎭 역할중심 / ⚖️ 판결중심) 추가. 학급설정의 같은 토글과 즉시 동기화(`saveBranchConfig`). 모드 전환 시 학생 화면과 빠른제어 준비 영역이 즉시 갱신.
- **[검증]** preview에서 토글 노출·강조(현재 모드) 동작 확인.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.318.

---

## v1.2.317 — 브라우저 탭 제목을 역할(교사/학생)·학급별로 구분 (2026-05-29 / [Claude])
- **[UX]** `App.jsx`에 `document.title` 동기화 useEffect 추가 — 역할에 따라 접두사 `(교사)`/`(학생)`을 붙이고, 뒤에 학급 `countryName`(없으면 `className`, 둘 다 없으면 "작은 대한민국") 표시. 형식: `민국이의 꿈 (교사) - {학급}` / `민국이의 꿈 (학생) - {학급}`. 진입 전(역할 미정)은 `민국이의 꿈 - {…}`. TV 송출 창은 영향 없음.
- **[검증]** dev 서버에서 DEMO24 교사 탭 제목이 `민국이의 꿈 (교사) - 꿈꾸는 대한민국 (시연용)`으로 정확히 표기됨 확인.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.317.

---

## v1.2.316 — 사법 사건에 동화·소설풍 배경 이야기(story) 도입 (2026-05-29 / [Claude])
- **[데이터]** 사건 JSON에 신규 필드 **`story: { background, incident }`** 추가(`judicial-case-data.js`). createEmptyCase·validateCaseJson 갱신, 데모용 별빛 편의점 프리셋에 동화풍 배경 이야기 샘플 채움(인물·환경·시간 흐름이 보이도록).
- **[학생 화면]** `JudicialCaseRoom`의 ① 사건 배경 탭에 두 박스 추가 — **📖 사건 배경**(amber) + **📅 있었던 일**(sky). 모드별 노출은 기존 `hideEvidence`/`hideRoleHints` 그대로 — 판결중심=사건 배경 탭(배경+있었던 일)만, 역할중심=사건 배경+증거+증인+피고인진술+역할힌트 모두.
- **[AI 프롬프트]** `JudicialCaseSetupPanel.buildJudicialPromptText`에 story 생성 규칙(배경 3~5문장·있었던 일 4~7문장·6학년 눈높이) + JSON 스키마(`story.background`/`story.incident`) + 자가점검 항목 추가. 패널 안내·뱃지에 "배경 이야기" 명시.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.316.

---

## 문서 — 세 번째 여정 교사 가이드 패키지 (2026-05-29 / [Claude])
- **[가이드]** `docs/teacher_guide/세번째여정_교사가이드.pdf` 신규 — 옵션1 구조(전체 개요·삼권 역할·유기적 연결 → 입법 → 행정 → 사법 → 교사 빠른 참조). phase2 가이드 패턴 계승, 각 단계·빠른제어 설명 + 인포그래픽·실제 스크린샷 임베드. 사법부는 두 모드·교사 사전준비 체크리스트·역할별 할 일까지 정성 작성.
- **[인포그래픽]** `docs/teacher_guide/세번째여정_인포그래픽_{전체흐름·입법부·행정부·사법부}.png` 4종. HTML→headless chromium(2x) 렌더.
- **[스크린샷]** `docs/teacher_guide/세번째여정_빠른제어_스크린샷/` 6종(입법부·행정부·사법부 판결중심 준비/재판보기/판결문·역할중심 준비) — 시연 학급 DEMO24에 puppeteer-core로 접속, Firebase로 stepIndex·workMode를 세팅하며 실제 캡처.
- **[정리]** 산출물은 모두 `docs/teacher_guide/`에 한글 파일명(`세번째여정_…`)으로 정리. 작업용 원본(html) 폴더는 제거(재생성 가능).
- **[슬라이드]** `docs/teacher_guide/세번째여정_종합슬라이드.pptx` 신규 — 9장(표지/전체흐름/유기적연결/입법/행정/사법/사법운영/빠른참조/마무리), 인포그래픽·스크린샷 임베드. pptxgenjs 생성.
- **[Word]** `docs/teacher_guide/세번째여정_교사가이드.docx` 신규 — 가이드 PDF와 동일 내용을 **편집 가능한 네이티브 Word**로 작성(python-docx). 헤딩·표·콜아웃·이미지 10종(인포그래픽4+스크린샷6) 임베드, 한글 폰트 지정. PDF→변환이 아니라 새로 작성해 레이아웃이 깔끔.
- **[참고]** 환경에 soffice/poppler 부재로 PDF·PPTX **이미지 시각 QA는 미수행**(내용 QA·이미지 임베드는 확인). docx는 본문 텍스트런 476개·이미지 10개 확인. 앱 코드 변경 없음(문서 산출물). 캡처용 임시 스크립트 정리, DEMO24는 판결중심 준비 단계로 복구.

---

## v1.2.315 — 사법 팀 개인별 배정(진영 선택) 추가 (2026-05-29 / [Claude])
- **[기능]** 사법부 팀(판사/검사/변호/배심원/증인/기자)을 **모둠별/개인별**로 배정. 개인별은 토론도구 진영 선택처럼 학생별로 팀을 찍어 배정.
  - 데이터: `branchConfig.judicial.assignMode`('group'|'individual', 기본 group) + `members.{side} = { studentId: true }` 신규(`gameStore`).
  - 공용 헬퍼 `lib/judicial-teams.js` — `getStudentJudicialSide`/`getJudicialSideStudentIds` 등. 모둠 모드면 기존과 동일 결과(회귀 없음), 개인 모드면 members 기준.
  - 신규 컴포넌트 `JudicialMemberAssigner.jsx` — 모드 토글 + 학생별 진영 버튼 + 모둠 일괄 배정 + 전체 해제.
- **[배치]** 학급설정(`BranchConfigEditor`)에 전체 6팀 배정 추가. 교사 빠른제어(`Phase3JudicialQuickPanel`) 준비단계: 판결중심=판사·검사·변호 3팀, 역할중심=전체 6팀. 개인 모드면 모둠 셀렉트 숨김.
- **[연동]** `JudicialTab.myJudicialSide`/`JudicialVerdictTab.myActingSide`/`startJudicialDebate`(검사·변호 진영 매핑) 모두 헬퍼 사용 → 개인 배정이 학생 화면·재판 진영에 반영. 빠른제어 연기팀 현황(`actingCount`/`actingLabel`)도 양 모드 대응. 미사용 `memberMapOf` 제거.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.315.

---

## v1.2.314 — 사법 사건 생성: 법안·시행령 선택 + 판결중심 사건 자료실 간소화 (2026-05-29 / [Claude])
- **[기능]** `JudicialCaseSetupPanel` — AI 사건 생성에 포함할 **법안·시행령을 체크박스로 선택**. 기본 선택은 **결정된 것**(법안=가결 status 'passed' / 시행령=확정 status 'submitted'·'locked'·'adjusted'·'final'); 시행령 초안(saved)은 목록에 "(초안)"으로 보이되 기본 해제. 교사가 임의로 토글 가능. 프롬프트·복사 알림 카운트도 선택분 기준.
  - 구현: `classDecrees`에 `status`/`decided` 추가, `billSel`/`decreeSel` 토글 상태(미지정 시 기본값 사용), `selectedBills`/`selectedDecrees`로 프롬프트 주입.
- **[UX]** 판결중심 모드 ① 준비의 사건 자료실(`JudicialCaseRoom`)에서 **증거·내 역할 힌트 탭 숨김**(`hideEvidence`/`hideRoleHints` prop) — 학생은 사건 개요(시나리오)만 봄. 역할중심 모드는 그대로(전체 탭).
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.314.

---

## v1.2.313 — 사법 AI 사건 생성: 모드 무관 항상 재판 대본 포함 (한 사건 두 모드 공용) (2026-05-29 / [Claude])
- **[개선]** `JudicialCaseSetupPanel.buildJudicialPromptText` — `trialScript`(재판 대본) 생성 규칙·스키마·자가점검을 `isVerdict` 분기 없이 **항상 포함**. 이제 역할중심/판결중심 어느 모드에서 만들어도 JSON에 **증거·증인 세트 + 재판 대본이 모두** 들어가, 한 번 만든 사건을 두 모드에서 그대로 쓸 수 있음(모드 바꿔도 재생성 불필요).
- 안내 문구도 항상 "증거·증인 + 재판 대본 모두 포함, 두 모드 공용"으로 표시. 미사용이 된 `isVerdict` 변수 제거.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.313.

---

## v1.2.312 — 입법 토의 답글 작성 권한을 '제안 모둠'으로 제한 (2026-05-29 / [Claude])
- **[정책]** `CommentList.canReply` 조건에 `isMyGroup` 추가 — 답글(reply) **작성은 법안을 제안한 모둠(자기 모둠)만** 가능. 다른 모둠은 답글을 **볼 수만** 있음(기존엔 모든 학생 작성 가능했음). 댓글 평가는 종전대로 다른 모둠만.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.312.

---

## v1.2.311 — 입법 온라인 토의: 자기 모둠 법안에 답글(reply) 허용 (2026-05-29 / [Claude])
- **[기능]** `CommentList.jsx`에 답글(reply) 기능 신규 추가. `allowReplies` prop(기본 false)으로 스코프 — `BillCard.jsx`의 법안 댓글에만 `allowReplies` 적용(포스터·기사·정리글은 변경 없음).
- **동작**: 자기 모둠 법안에는 기존처럼 **새 댓글(top-level)·평가는 차단**하되, 친구들이 남긴 댓글에 **답글로 답변 가능**(질문에 응답). 답글은 모든 학생이 댓글당 여러 개 가능, 본인 답글 삭제 가능.
- **데이터**: 답글도 같은 `comments` 컬렉션에 저장하되 `parentId`(부모 댓글 id) + `kind:'reply'` 부여, 평점(ratings) 없음. top-level만 모아 페이지네이션, 부모별로 답글 묶어 들여쓰기 렌더.
- **집계 보정**: `BillCard.billComments`(댓글 수 표시)에서 `parentId` 항목 제외. 별점 평균(`computeBillScore`/`billScore`)은 ratings 없는 답글을 자동 skip하므로 평점 왜곡 없음.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.311.

---

## v1.2.310 — 입법 법안 글자수 제한 완화 (2026-05-29 / [Claude])
- **[콘텐츠]** `scaffolding-data.js` `DEFAULT_TEMPLATES.bill.fields` 글자수 한도 상향: 목적·정의 200→**1000**, 의무 300→**1000**, 벌칙 200→**1000**, 제목 60→100. rows도 함께 늘림. 법안 4조항(=전체 법안)이 사실상 제한 없이 작성 가능(조항당 1000자).
- **[중요]** `gameStore.js` 로드 시 `templates: data.config.templates || DEFAULT` → **항상 `DEFAULT_CONFIG.templates`** 사용으로 변경(`roles`와 동일 처리). 템플릿은 교사 편집 불가이므로, 기존 방도 Firebase에 굳어 있던 옛 한도 대신 코드 최신 한도를 즉시 적용받음. 기존 작성된 법안 데이터는 필드 id 동일해 호환.
- 참고: 역할중심 섹션 초안·최종 조립 editor(`BranchUnitWorkspace`)는 원래 maxLength가 없어 이미 무제한. 역할 메모(`GenericRoleNotes`)는 400자 유지(요청 범위 밖).
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.310.

---

## v1.2.309 — 사법부 2모드 재정의: 판결중심(verdict) 모드 신설 (2026-05-28 / [Claude])
> 제안서: `docs/proposal_사법부_2모드_재정의_2026-05-28.md` (사용자 승인 완료)
- **[설계]** 사법부 `branchConfig.judicial.workMode`를 입법·행정의 공동/역할 토글과 같은 레벨로 재정의: **`'verdict'`(판결중심) / `'role'`(역할중심)**. 구 `'collaborative'` 저장값은 로드 시 `'verdict'`로 자동 마이그레이션(`gameStore.js`).
- **[데이터]** `judicial-case-data.js` 사건 JSON에 **`trialScript`**(speaker별 대사 배열) 필드 신설. `validateCaseJson`에 trialScript 검증 추가, `createEmptyCase`에 빈 배열 추가, 대표 프리셋(별빛 편의점)에 샘플 대본 17줄 추가. speaker: judge|prosecution|defense|witness|defendant.
- **[워크플로]** `PhaseWorkflow.jsx`에 `getPhaseSteps(phase, workMode)` + `JUDICIAL_VERDICT_STEPS`(verdict-prep/issues/trial/writing/discussion + article3/poll4) 추가. 판결중심 7단계: 준비 → 쟁점파악 → 재판보기 → 판결문작성·게시 → 온라인토의(판결문 비교) → 기사 → 여론조사. 기사·여론조사는 article3/poll4 id 유지(라벨만 판결중심용). `use-workflow.js`도 workMode 반영.
- **[학생]** `JudicialTab.jsx`를 얇은 래퍼로 만들어 workMode 분기(훅 순서 안전). 기존 역할중심 흐름은 `JudicialRoleTab`으로 보존. 신규 `JudicialVerdictTab.jsx`: 사건개요+팀배정 / 모둠 쟁점 메모(`judicialIssues/{caseId}/{groupId}`) / 대본 뷰어(연기 3팀만 자기 speaker 대사 노출, 참관팀은 메모) / 전 모둠 판결문 작성·게시(VerdictTemplate 재사용) / 판결문 비교 토의(StanceComments) / 기사 / 여론조사.
- **[교사]** `Phase3JudicialQuickPanel.jsx` workMode 분기: 판결중심 progress bar(준비/쟁점/재판보기/판결문/토의/기사/여론조사), **준비 단계 빠른제어 강화**(사건·대본 만들기, 연기 3팀 지정 셀렉트, 대본 상태·전체 미리보기, 사건/대본/연기팀 체크리스트), 재판보기 대본 점검, 모둠별 판결문 게시 현황 모니터. 역할중심 블록은 `!isVerdict` 가드.
- **[교사]** `BranchConfigEditor.jsx` 사법 활동 방식 토글을 공동작업/역할중심 → **판결중심/역할중심**으로 라벨·설명 변경.
- **[AI]** `JudicialCaseSetupPanel.jsx` — verdict 모드일 때 AI 프롬프트에 `trialScript` 생성 규칙·스키마·자가점검 항목 자동 추가(법안·시행령 주입은 동일). JSON 업로드는 trialScript 검증 포함해 그대로 사용.
- **[빌드/배포]** `npm run build` 통과, 빌드·배포 완료. `APP_BUILD` v1.2.309.
- **[미검증]** 라이브 방(demo24) 학생/교사 인터랙티브 검증(verdict 모드 토글 → 7단계 진행)은 미수행 — 다음 세션/사용자 확인 필요.

---

## v1.2.308 — 총괄 검토원 메모를 '법안 배경·입법 취지·반론 대응' 중심으로 개편 (역할중심 모드 전용) (2026-05-28 / [Claude])
- **[콘텐츠]** `scaffolding-data.js` `DEFAULT_ROLES.legislative` billDrafter(총괄 검토원, `rebuttal` 섹션) 메모·미션·섹션 라벨 전면 개편.
  - 기존: '제1~4조 흐름 검토 / 반론 3가지 / 한 문장 요약' 중심.
  - 변경: **법안 배경·입법 취지 + 반론 대응** 중심 — 교사 요청 반영:
    - ① [문제 상황] 현재 상황·누가 어떤 피해/어려움·그 원인
    - ② [입법 취지] 이 법으로 누구에게 무엇을 해 주려는지
    - ③ [반론 예상·대응] 예상 반론 2~3가지 + 답변
  - `sectionLabel` '전체 검토·우려 대응' → **'제안 이유(배경·입법 취지)·반론 대응'**, `sectionPlaceholder`·`todos`·`sosWhen`도 같은 취지로 수정.
- **[일관성]** `BranchUnitWorkspace.jsx` `SECTION_META.rebuttal` 라벨·플레이스홀더도 동일 취지로 갱신(미리보기 패널 표시 일치).
- **적용 범위**: `DEFAULT_ROLES.legislative`는 **역할중심 모드 전용** — 공동작업 모드(BillTemplate 직접 사용)에는 영향 없음.
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.308.

---

## v1.2.307 — '미리보기에서 불러오기' 버튼을 미리보기 패널 → 수정 에디터 안으로 이동 (2026-05-28 / [Claude])
- **[UX]** `BranchUnitWorkspace.jsx` 3단계 A — 어두운 섹션 미리보기 패널에 있던 '미리보기에서 불러오기 ↓' 버튼 **제거**.
  - 대신 수정 중(`finalEditing`) 에디터의 버튼 줄에 **[📥 섹션 내용 다시 불러오기]** 추가 — 각 섹션 최신 내용으로 에디터를 **덮어쓰기**(`loadPreviewToEditor(silent, replace)` — `replace` 인자 신규). 덮어쓰기 전 확인창.
  - 이유: 수정하기 진입 시 이미 자동 로드되므로 미리보기 패널의 불러오기는 불필요했고, "다시 불러오기"는 수정 중에만 의미가 있어 에디터 안에 두는 것이 자연스러움.
  - 관련 placeholder 문구도 에디터 내 버튼을 가리키도록 수정.
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.307.

---

## v1.2.306 — 총괄 검토원 최종편집 UX 개선: 수정 시 섹션 자동 로드 + 제출 후 재수정 (2026-05-28 / [Claude])
- **[UX]** `BranchUnitWorkspace.jsx` 3단계 A — [✏️ 수정하기] 클릭 시 에디터가 비어 있으면 각 역할 섹션 내용을 **자동으로 불러와** 채움(`loadPreviewToEditor(true)` silent 모드). 기존엔 수정하기 → 별도로 '미리보기에서 불러오기'를 또 눌러야 했음. ('미리보기에서 불러오기 ↓' 버튼은 재로드용으로 유지)
  - `loadPreviewToEditor(silent=false)` 인자 추가 — silent면 빈 섹션 경고창 생략.
  - 관련 안내 문구(placeholder, 빈 미리보기 메시지, 경고)도 자동 로드에 맞게 수정.
- **[기능]** 제출(발의)해서 잠긴(`status:'locked'`) 최종본도 **다시 수정 가능**하도록 [✏️ 다시 수정하기] 버튼 추가(`unlockFinalDoc`):
  - 클릭 시 finalDoc status를 `'draft'`로 되돌리고(`setAt`으로 content 보존), 현재 확정본을 에디터에 채워 바로 편집 모드 진입.
  - 제출 확인 문구 "제출 후에는 수정할 수 없습니다" → "제출 후에도 [다시 수정하기]로 고칠 수 있어요"로 수정.
- **[중복 방지]** `LegislativeTab.jsx` `onPublish` — 같은 `branchUnitId`로 이미 발의된 법안이 있으면 새로 만들지 않고 **업데이트**(`updateAt`). 재발의 시 법안 중복 생성 방지. (`updateAt` import 추가)
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.306.

---

## [데이터 마이그레이션] CTS48E 반 — 입법·행정 units 배치 (코드 변경 없음) (2026-05-28 / [Claude])
- **배경**: CTS48E("6학년 9반 테스트용") 반에서 "역할별 섹션 초안"이 안 보였음. DEMO24와 비교 결과 **원인은 `branchConfig.legislative.units`(및 executive.units) 미설정** — units가 없으면 `LegislativeTab`이 옛 단일 발의 UI(`RoleWorkspace`)로 떨어져 새 워크플로(BranchUnitWorkspace) 미진입. 두 반의 `config.roles.legislative`는 동일·정상.
- **조치 (RTDB 직접 마이그레이션, REST PUT)**:
  - 백업: `<배포경로>/backups/CTS48E_{config,branchConfig,groups,FULLROOM}_20260528_144824.json` (전체 룸 418KB 포함).
  - `config/branchConfig/legislative/units`: 6개 그룹(env/home/labor/region/rights/wealth) 1:1 유닛 생성, 대표는 각 그룹 billDrafter 학생으로 지정.
  - `config/branchConfig/executive/units`: 6개 그룹 1:1 유닛 생성 (행정부 역할 미배정 상태라 대표 null — 학생이 추후 선택).
  - **`/units` 경로에만 PUT** → 형제 노드(`mode`, `useEvaluatorPanel`) 및 기존 `sessionRoles`·`bills`(6건)·멤버 전부 보존 검증 완료.
- **효과**: 학생들이 이미 고른 입법 역할이 BranchUnitWorkspace에서 즉시 인식 → 역할 선택 보드·메모 카드·역할별 섹션 초안·최종 법안 워크플로 정상 노출.
- **주의**: 이 반의 기존 6개 법안은 옛 경로(RoleWorkspace+BillTemplate)로 발의된 것 — `bills`에 그대로 보존되며, 새 워크플로에서 발의하면 신규 법안이 추가됨.
- **[2차] 학생 작성 내용 마이그레이션**: 새 워크플로 진입 후 "이전 저장 내용이 안 보임" → 옛 경로는 `groups/{gid}/roleNotes/legislative-default/{roleKey}`(3개 답변 fields + links)에 저장, 새 워크플로는 `branchDrafts/{unitId}/{memberNotes,sections}`에서 읽기 때문.
  - `/tmp/migrate_cts48e.py`로 변환: roleNotes의 fields → `sections/{assignedSection}.content`(역할별 담당 섹션) + `memberNotes/{studentId}`(qna·links·submittedAt). 역할→섹션 매핑(billDrafter→rebuttal, investigator→background, logician→clause, analyst→effect).
  - `branchDrafts`가 비어있음을 확인 후 PUT (학생 신규 작성 덮어쓰기 방지). 6개 유닛 복원, 내용 길이>20자는 status='ready'.
  - 백업: `CTS48E_branchDrafts_BEFORE_20260528_145850.json`(빈 상태) + 원본 roleNotes는 `groups`에 그대로 보존.

---

## v1.2.305 — 입법부 섹션 초안 반별 차이 방어: 섹션 배정 없는 레거시 config → 기본 역할 폴백 (2026-05-28 / [Claude])
- **[ROBUSTNESS]** `BranchUnitWorkspace.jsx` `branchRoles` — "역할별 섹션 초안이 어떤 반은 보이고 어떤 반은 안 보임" 문제 방어.
  - **원인 분석**: v1.2.304는 역할 키/라벨이 블루프린트와 매칭될 때만 `assignedSection`을 복구함. 일부 반은 저장된 `config.roles.legislative` 또는 `config.branchConfig.legislative.roles`가 **레거시/커스텀 역할(키·라벨 불일치)**이라 `findRoleBlueprint`가 base를 못 찾아 `assignedSection`이 끝까지 null → `sectionRoles` 빈 배열 → 섹션 초안 미표시.
  - **수정**: 입법부 역할중심 모드에서 `baseRoles` 중 `assignedSection`을 가진 역할이 **하나도 없으면** `DEFAULT_ROLES.legislative`(조항형 4역할)로 대체. 모든 반에서 섹션 워크플로가 일관되게 나타나도록 보장.
  - **주의**: 폴백이 트리거된 반은 학생의 기존 역할 선택(커스텀 키)이 새 기본 키와 안 맞아 역할 재선택이 필요할 수 있음 — 단, 그 반은 어차피 섹션 워크플로가 깨진 상태였으므로 개선.
  - **데이터 안전**: RTDB 저장 데이터 미변경 — 런타임 역할 계산만 폴백.
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.305.

---

## v1.2.304 — 입법부 "역할별 섹션 초안" 미표시 근본 원인 수정 (assignedSection 유실 버그) (2026-05-28 / [Claude])
- **[BUG FIX / 근본 원인]** `scaffolding-data.js` `normalizeRoleForKind()` — 역할 정규화 시 `assignedSection`이 유실되던 버그 수정.
  - **증상**: 메모 카드 Q&A는 보이는데(=`memoGuide`는 채워짐) "역할별 섹션 초안"이 안 보임. 총괄 검토원 최종 편집도 엉뚱한 위치(3단계 B)에 노출.
  - **원인**: `memoGuide`는 return문에서 명시적으로 `base.memoGuide` fallback 처리되지만, `assignedSection`/`sectionLabel`/`sectionPlaceholder`/`isRepresentative`는 `{ ...base, ...role }` spread로만 처리됨. 저장된 역할이 이 필드를 `undefined`/`null`로 덮어쓰면 유실 → `sectionRoles = branchRoles.filter(r => r.assignedSection)`가 빈 배열 → `hasSectionRoles = false`.
  - **연쇄 효과**: `hasSectionRoles = false`이면 ① 2단계 섹션 초안이 빈 헤더만 표시 ② 3단계 A(총괄 검토원 최종 편집) 숨김 ③ 3단계 B(옛 경로) 노출.
  - **수정**: return문에 4개 필드를 블루프린트(base)에서 명시적으로 보존하도록 추가:
    ```
    assignedSection: mergedRole.assignedSection || base.assignedSection || null,
    sectionLabel: mergedRole.sectionLabel || base.sectionLabel || null,
    sectionPlaceholder: mergedRole.sectionPlaceholder || base.sectionPlaceholder || null,
    isRepresentative: mergedRole.isRepresentative ?? base.isRepresentative ?? false,
    ```
  - **결과**: `sectionRoles` 정상 채워짐 → ① 역할별 섹션 초안 표시 ② 총괄 검토원 최종 편집이 맨 마지막(3단계 A)에 노출 ③ 옛 경로(3단계 B) 숨김.
  - **데이터 안전**: RTDB 저장 데이터는 건드리지 않음 — 런타임 역할 정규화 로직만 수정.
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.304.

---

## v1.2.303 — 입법부 발의 워크플로 재구성: 역할 선택 보드 상단 배치 + 메모→섹션 자동흐름 보호 (2026-05-28 / [Claude])
- **[UX 재구성]** `BranchUnitWorkspace.jsx` 입법부 1단계 — 역할 선택(우측 패널) → 메모 카드(좌측) 의존 관계가 불명확해 "메모카드 작성을 할 수 없다"는 문제 해결.
  - **원인 분석**: 역할을 선택해야 `myRoleMeta`가 잡히고 memoGuide Q&A가 나타나는데, 역할 선택 패널(`RoleSelfSelector`)이 우측 2fr 컬럼에 작게 분리돼 있어 "역할 먼저 선택" 순서가 보이지 않았음.
  - **변경**: 행정부 역할중심모드(`isExecutiveRoleMode`)처럼 **역할 선택 보드를 1단계 맨 위에 전체 폭으로 크게 배치**:
    - 역할 카드 그리드(이모지·라벨·대표 배지·담당자·진행률·"나 맡을게요"/"취소" 버튼) — 행정부 보드와 동일 스타일
    - 역할 미선택 시 "👆 위에서 역할을 먼저 선택하세요" 안내 배너 추가
    - 메모 카드는 그 아래로 이동, 우측 패널은 모둠 현황(GroupRoleSummary)만 유지
    - "👉 오른쪽 역할 배정에서..." → "👆 위 역할 선택에서..." 안내 문구 수정
  - 워크플로 순서 명확화: **① 역할 선택 → ② 메모 카드 Q&A 작성·제출 → ③ 역할별 섹션 초안 다듬기 → ④ 최종 법안 미리보기·대표 확정**
- **[BUG FIX]** `submitNote()` 메모→섹션 자동 흐름이 섹션을 **무조건 덮어쓰던** 데이터 손실 버그 수정:
  - 기존: 메모 제출 시 `sections/{mySection}`을 항상 `content: noteText`로 덮어씀 → 학생이 다듬은 섹션 내용이 메모 재제출 시 날아감
  - 수정: 섹션이 **비어 있을 때만** 메모 내용을 채움(기존 다듬은 내용 보호). 자동 채움 상태는 항상 `'draft'` — 학생이 조항 목적에 맞게 다듬고 저장해야 `'ready'`가 됨.
- **[일관성]** 대표 실시간 자동저장 useEffect 조건을 `myRoleIsRepresentative` → `canEditFinal`로 변경 (v1.2.301과 일관 — isRepresentative 플래그 없어도 billDrafter 작동).
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.303.

---

## v1.2.302 — 입법부 역할별 메모 카드 Q&A 표시 수정 (GenericRoleNotes) (2026-05-28 / [Claude])
- **[BUG FIX / UX]** `GenericRoleNotes.jsx` — `RoleWorkspace` 경로(legUnits.length === 0)에서 입법부 역할을 맡아도 memoGuide Q&A 메모 카드가 나타나지 않던 문제 수정.
  - **원인**: `GenericRoleNotes`가 `todos` 기반 폼만 렌더링하고, 역할에 `memoGuide`가 있어도 Q&A 형식이 전혀 표시되지 않았음. 행정부 역할중심모드(`isExecutiveRoleMode`)처럼 memoGuide Q&A가 embedded되어 있지 않았음.
  - **수정**: `GenericRoleNotes.jsx`에 memoGuide Q&A 섹션 추가:
    - `hasMemoGuide = (roleMeta?.memoGuide?.length || 0) > 0` 조건으로 표시 여부 결정
    - `memoQnas` 상태(idx → text) + `memoQnasDirty`/`memoQnasBusy`/`memoQnasSaved` 플래그
    - RTDB `data.memoQnas`에서 초기값 로드 (더티 상태 보호)
    - 각 memoGuide 질문별 textarea UI (행정부 역할중심모드와 동일한 형식)
    - "메모 저장" 버튼 → `roleNotes/{roleKey}/memoQnas` 저장
    - 기존 todos 기반 폼은 아래에 그대로 유지 (각 미션 개별 저장)
  - **적용 범위**: `RoleWorkspace` 경로를 통해 렌더링되는 모든 역할 — 입법부 4역할(billDrafter/investigator/logician/analyst) 모두 memoGuide가 있으므로 모두 Q&A 메모 카드 표시. 사법부·행정부도 memoGuide가 있으면 동일하게 표시됨.
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.302.

---

## v1.2.301 — 총괄 검토원 최종 법안 편집 + 법안 발의 버튼 활성화 (2026-05-28 / [Claude])
- **[BUG FIX / UX]** `BranchUnitWorkspace.jsx` — 입법부 총괄 검토원(`billDrafter`)이 최종 법안 편집·제출 UI를 볼 수 없던 문제 수정.
  - **원인**: 편집 권한 조건이 `myRoleIsRepresentative`(역할 메타의 `isRepresentative` 플래그) 하나만 사용. 입법부 역할 데이터 로딩 타이밍에 따라 `false`로 평가될 수 있었음.
  - **수정**: `canEditFinal` 상수 추가 — `myRoleIsRepresentative || (branch === 'legislative' && myRoleKey === 'billDrafter')` — isRepresentative 플래그가 없어도 billDrafter 키 확인으로 fallback.
  - 적용 범위(3단계 A 블록 4곳):
    1. `미리보기에서 불러오기 ↓` 버튼: `myRoleIsRepresentative` → `canEditFinal`
    2. `finalEditing` 수정 모드 toggle 블록: `myRoleIsRepresentative` → `canEditFinal`
    3. 읽기 전용 블록(다른 역할 학생): `!myRoleIsRepresentative` → `!canEditFinal`
    4. 최종 확정(제출) 버튼 영역: `myRoleIsRepresentative` → `canEditFinal`
- **[UX]** 제출 버튼 레이블: 입법부에서는 "🔒 제출하기" → **"🏛️ 법안 발의하기"** 표시 (`branch === 'legislative'` 조건 분기).
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.301.

---

## v1.2.300 — 입법부 작성원 메모 카드 Q&A 형식 + 섹션 초안 조항 작성 가이드 카드 추가 (2026-05-28 / [Claude])
- **[BUG FIX / UX]** `BranchUnitWorkspace.jsx` 메모 카드 텍스트 입력 형식 개선:
  - 기존: `branch === 'executive'` 조건 → 행정부만 Q&A 질문형 textarea 표시
  - 변경: `myRoleMeta?.memoGuide?.length > 0` 조건 → memoGuide가 있는 **모든 역할(입법부 포함)** Q&A 형식 표시
  - 효과: 입법부 목적·정의 작성원 등 4개 역할 모두 memoGuide 3개 질문에 각각 답변 textarea가 생성됨
  - `handleNoteQnaChange`가 Q&A 답변 → `noteText`(merged 텍스트) 자동 동기화 → 제출 버튼 활성화 조건(`noteHasText`) 정상 작동
- **[UX]** 섹션 초안 카드 — 입법부 조항 작성 가이드 블록 신규 추가 (`isMyAssigned = true` 시):
  - `branch === 'legislative' && roleDef.sectionLabel` 조건으로 표시
  - **역할 섹션 헤더**: `roleDef.emoji + roleDef.sectionLabel` (예: "✏️ 🔎 제1조 목적 · 제2조 정의·대상 작성하기")
  - **memoGuide 질문 목록**: 역할별 3개 조사 포인트를 읽기 전용으로 표시 (무엇을 써야 하는지 상기)
  - **[📥 메모 내용 불러오기] 버튼**: 메모 제출 이력(`myNote.text`)이 있을 때만 표시 — 클릭하면 textarea에 memo 텍스트 자동 추가
  - textarea placeholder를 `roleDef.sectionPlaceholder`(역할별 구체적 힌트) 우선 사용 (`SECTION_META` 대체)
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.300.

---

## v1.2.299 — 입법부 역할중심 모드를 조항 기반 역할로 전환 + 역할 전체 초기화 버튼 추가 (2026-05-28 / [Claude])
- **[기능 변경]** `scaffolding-data.js` `DEFAULT_ROLES.legislative` 전면 재작성 (조항 기반 역할 체계).
  - `billDrafter` → 총괄 검토원(👑) — `rebuttal` 섹션 담당 (제1~4조 전체 흐름 검토·우려 대응)
  - `investigator` → 목적·정의 작성원(🔎) — `background` 섹션 (제1조 목적 · 제2조 정의·대상)
  - `logician` → 의무·금지 작성원(⚖️) — `clause` 섹션 (제3조 의무·금지)
  - `analyst` → 벌칙·효과 작성원(📊) — `effect` 섹션 (제4조 벌칙·기대 효과)
  - **섹션 키(`background/clause/effect/rebuttal`) 유지** — 기존 학생 작성 데이터 보존.
  - 각 역할에 `memoGuide`(연구 메모 질문), `todos`(할 일 체크리스트), `sectionLabel/sectionPlaceholder`(섹션 헤더·힌트), `sosWhen/sosLabel` 추가.
- **[UX]** `BranchUnitWorkspace.jsx` `SECTION_META` 입법부 섹션 라벨·플레이스홀더 갱신:
  - `background` → '제1조 목적·제2조 정의·대상'
  - `clause` → '제3조 의무·금지'
  - `effect` → '제4조 벌칙·기대 효과'
  - `rebuttal` → '전체 검토·우려 대응'
- **[UX]** `Phase3LegislativeQuickPanel.jsx` Stage 0(준비) 역할 관리 블록 개선:
  - 기존 단순 역할 잠금 버튼 → "학생 역할 설정 관리" 블록으로 교체.
  - [🔄 역할 전체 초기화] 버튼 추가 — `groups/{groupId}/sessionRoles/legislative-default` 전체 null 처리(배정 취소). 역할을 잘못 배정한 반에서 재배정 가능.
  - 역할 초기화 블록은 역할중심 모드(`!isCollaborative`)일 때만 표시 (공동작업 모드에서는 숨김).
  - **공동작업 모드 코드·데이터 미변경** (isCollaborative 조건 추가만).
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.299.

---

## v1.2.298 — 사건 만들기·재판 미리 준비 버튼을 Stage 0(준비) 빠른 제어에 추가 (2026-05-28 / [Claude])
- **[UX]** `Phase3JudicialQuickPanel.jsx` Stage 0(준비) 블록을 신규 추가.
  - [🤖 ① 사건 만들기/변경]: `JudicialCaseSetupPanel` 모달 오픈 (AI/JSON/프리셋 — Stage 0에서 사전 설정)
  - [⚙️ ② 재판 미리 준비]: `TrialPrepModal` 오픈 (사회자·역할 라벨·여론조사 임시저장)
  - 현재 설정 상태 칩 2개 표시 (사건 설정 여부 / 준비안 임시저장 여부)
  - 안내: "사건과 준비안은 Stage 4(재판)에서 바로 사용됩니다. 지금 미리 설정해 두세요."
- **[UX]** Stage 4(재판) 빠른 제어 영역:
  - 기존 `🤖 사건 만들기/변경` 전체 버튼 → 적용 사건명 칩 + [변경] 소형 버튼으로 교체 (Stage 0에서 이미 설정했으면 확인·재변경 수준으로 축소)
  - 안내 텍스트도 "(사건·준비안은 ① 준비 단계에서 설정)" 문구 추가.
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.298.

---

## v1.2.297 — 사법부 세션 생성 시 '폐수방류' 등 구 NPC 사건 대신 사건만들기 설정 사건 사용 (2026-05-28 / [Claude])
- **[BUG FIX]** `Phase3JudicialQuickPanel.jsx` `startJudicialDebate()` 가 **구 NPC 이벤트 시스템(`npcActiveCase?.scenarioId`)을 branchConfig activeCase보다 우선** 읽던 버그 수정.
  - 증상: 교사가 [🤖 사건 만들기/변경]으로 새 사건을 설정해도, 구 npcEvents에 '폐수방류' 등 이전 프리셋이 남아 있으면 세션 제목이 그 이름으로 생성되었다.
  - 수정: `caseTitle = npcActiveCase?.scenarioId || activeCase?.title` → `activeCase?.title` 단독으로 변경. branchConfig(사건만들기)가 항상 우선.
- **[FIX]** `relatedCaseId: npcCaseId` → `relatedCaseId: activeCaseRelatedId` (branchConfig `activeCase?.id || storedActiveCaseId`). 배심원 투표·판결 데이터도 같은 키 사용.
- **[FIX]** 세션 생성 버튼 `disabled` 조건에서 `!npcCaseId` 제거. 사건만들기로 설정한 사건이 있으면(= 항상 기본 프리셋 이상) 바로 생성 가능.
- **[FIX]** `juryVotes`, `judgeVerdict`, `prosecutionStatements`, `defenseStatements` 구독·조회 모두 `activeCaseRelatedId` 우선 + `npcCaseId` 하위호환 폴백으로 통일.
- **[FIX]** 확인 다이얼로그 문구도 `activeCase?.title` 기준으로 수정.
- **[빌드/배포]** `npm run build` 통과, 배포 완료. `APP_BUILD` v1.2.297.

---

## v1.2.296 — 사건 설정 패널을 공용 컴포넌트로 추출 — 학급설정 + 빠른 제어 양쪽에서 사용 (2026-05-27 / [Claude])
- **[REFACTOR]** `JudicialCaseSetupPanel.jsx` 신규 컴포넌트 추출 (`app/src/components/teacher/`).
  - 이전에는 `BranchConfigEditor.jsx` 안에만 있던 사건 시나리오 설정 UI(활성 사건 미리보기 + 프리셋 선택 + 🟣🟢🔵 AI 사건 생성 + JSON 업로드)를 공용 컴포넌트로 분리.
  - 내부에 `bills`/`policies` 구독, `AI_VENDORS`, `buildJudicialPromptText`, `openWithAi`, `handleJudicialJsonUpload`, `applyUploadedCase`, `applyJudicialPreset` 모두 캡슐화.
  - props: `bc`(branchConfig) / `onChange(nextBc)` / `className` / `roomCode` / `compact`.
- **[FEATURE]** `Phase3JudicialQuickPanel.jsx` Stage 4 모의재판 빠른 제어 영역에 **[🤖 사건 만들기 / 변경]** 버튼 추가.
  - 버튼에 현재 활성 사건 제목 칩 표시(예: "현재: 별빛 24시 임…").
  - 클릭 시 모달이 열리며 학급설정과 100% 동일한 사건 설정 패널을 띄움 (`JudicialCaseSetupPanel` 재사용).
  - 모달 안에서 변경 → `updateAt(roomCode, 'config', { branchConfig })` 로 RTDB 직접 저장 → 학급설정 화면에도 즉시 반영.
- **[CLEANUP]** `BranchConfigEditor.jsx`:
  - 추출된 함수 블록(549~800번, `applyJudicialPreset` ~ `applyUploadedCase`)을 통째로 제거.
  - 사건 시나리오 UI(870~1038번)를 `<JudicialCaseSetupPanel bc={bc} onChange={onChange} className={className} roomCode={roomCode} />` 한 줄로 교체.
  - 사용되지 않게 된 `subscribe`, `normalizeBillStatus`, `validateCaseJson` import 제거.
- **[효과]** 사용자가 사법부 활동 중에 학급설정 페이지로 이동하지 않고도 빠른 제어 안에서 AI 사건 생성·JSON 업로드·프리셋 변경을 모두 처리 가능. 코드 중복 제거(이전 1개 위치 → 공용 컴포넌트 1개).
- **[빌드/배포]** `npm run build` 통과, `bash deploy.sh` 배포 완료. `APP_BUILD` v1.2.296.

---

## v1.2.295 — 사법부 모의재판 토론 type을 'trial'(국민참여재판)로 수정 (2026-05-27 / [Claude])
- **[FIX]** `Phase3JudicialQuickPanel.jsx` `startJudicialDebate()` 의 세션 `type` 값을 `'pro_con'` → `'trial'` 로 수정.
  - 기존 `'pro_con'` 은 `TeacherDebateControl.MODE_THEME` 에 정의되지 않은 값이라 fallback 인 `'general'`(🎙️ 일반 토론)로 처리되어, **통합 참가자 관리에 찬성/반대 라벨이 표시**되던 문제.
  - `'trial'` 로 바꾸면 `DEBATE_SIDE_LABELS.trial` 이 자동 적용되어 **검사 / 변호인 / 배심원 / 재판장** 라벨이 기본값으로 들어감. `sideLabelOverrides` 로 모둠별 이름(예: "검사 1팀", "변호 1팀") 이 그 위에 덮여 표시.
  - `DebatePrepCard.jsx` 의 `trial: { pro: '검사', con: '변호/피고', evaluator: '배심원' }` 자동 적용으로 준비 카드도 사법 라벨로 표시.
  - `DebateScriptEditor.jsx` 의 검사/변호인 대본 분기(`type === 'trial'`)도 함께 활성화.
  - 토론 도구 헤더 테마도 ⚖️ amber 색(국민참여재판)으로 표시.
- **[빌드/배포]** `npm run build` 통과, `bash deploy.sh` 배포 완료. `APP_BUILD` v1.2.295.

---

## v1.2.294 — 토론 세션 생성 직후 학생 화면이 '토론 전' 탭으로 시작 (2026-05-27 / [Claude])
- **[FIX]** `DebateToolPanel.jsx` (학생용) 자동 탭 전환 로직 수정.
  - 기존: `if (showTimer || activeEval) setTab('mid')` — timer **도구가 활성화만 되어 있어도** 'mid'(토론 중)로 점프해, 사법부처럼 세션 생성 시 처음부터 timer를 켜두는 흐름에서 학생이 '토론 전' 단계(논제·여론조사·준비카드)를 못 보고 바로 '토론 중'으로 넘어가는 문제.
  - 변경: `if (timerRunning || activeEval) setTab('mid')` — 타이머가 **실제로 시작(`isRunning=true`)** 되거나 평가가 열린 순간에만 자동 전환. 도구만 등록돼 있고 시작 전이면 '토론 전' 탭 유지.
- **[FIX]** `Phase3JudicialQuickPanel.jsx` `startJudicialDebate()`에 `teacherTab: 'pre'` 추가.
  - 세션 생성 시 명시적으로 '토론 전' 탭으로 시작하도록 지정. 교사·학생 양쪽 모두 '토론 전' 화면(논제·사전 여론조사·준비카드)을 먼저 본 뒤, 교사가 타이머를 시작하는 순간 '토론 중'으로 전환.
- **[효과 — 모든 토론 흐름에 동일하게 적용]**: 사법부뿐 아니라 선거·행정 토론도 timer가 시작되기 전엔 '토론 전' 탭이 유지되어, 학생들이 사전 여론조사·논제 안내·준비 카드를 충분히 살펴본 뒤 본 토론에 진입.
- **[빌드/배포]** `npm run build` 통과, `bash deploy.sh` 배포 완료. `APP_BUILD` v1.2.294.

---

## v1.2.293 — 사법부 빠른 제어에 "토론 도구 열기" 버튼 추가 (2026-05-27 / [Claude])
- **[FEATURE]** `Phase3JudicialQuickPanel.jsx` Stage 4 모의재판 빠른 제어 영역의 3-column 버튼 그리드를 **2x2 그리드로 확장**, 신규 **[🎙️ 토론 도구 열기]** 버튼 추가.
  - 기존: ⚙️ 재판 미리 준비 / 🎙️ 세션 생성 / 📺 전광판 띄우기 (3개)
  - 신규: ⚙️ 재판 미리 준비 / 🎙️ 세션 생성 / **🎙️ 토론 도구 열기** / 📺 전광판 띄우기 (4개, 2x2)
- **[UX]** `startJudicialDebate()` 함수 개선:
  - 세션 생성 직후 `onOpenDebateTool()` 콜백을 자동 호출해 토론 도구 모달을 즉시 열어줌.
  - alert 문구도 "토론 도구 패널을 열었습니다. 학생 화면에 전광판을 띄우려면 [📺 전광판 띄우기]를 누르세요." 로 변경하여 다음 행동을 명확히 안내.
- **[CODE]** `Phase3JudicialQuickPanel` 컴포넌트에 `onOpenDebateTool` props 추가 (입법부·선거부와 동일한 패턴).
- **[WIRE]** `pages/TeacherDashboard.jsx`에서 `<Phase3JudicialQuickPanel onOpenDebateTool={() => setDebateModal(true)} />` 로 연결. 이로써 사법부도 입법부·선거부와 동일하게 빠른 제어에서 토론 도구를 한 번에 열 수 있음.
- **[UX 안내]** 토론 세션 진행 중일 때 카드 아래 안내 추가: "💡 토론 도구 열기로 단계·평가·타이머를 제어하고, 전광판은 학생용 화면에 띄우세요."
- **[빌드/배포]** `npm run build` 통과, `bash deploy.sh` 배포 완료. `APP_BUILD` v1.2.293.

---

## v1.2.292 — 사법부 AI 사건 생성 — 학급 입법·시행령 자동 주입 + 3-vendor 버튼 (2026-05-27 / [Claude])
- **[FEATURE]** `BranchConfigEditor.jsx` 사법부 사건 시나리오 섹션에 **🤖 우리 반 입법·시행령 기반 AI 사건 생성** 카드 추가.
  - **자동 주입**: 학급의 `bills` 중 `status='passed'`인 법안 전체(목적·정의·의무·**벌칙**)와 `policies`의 시행령 본문·`decreeScaffold.rewardsPenalties`(상벌)·담당자·예외를 자동으로 프롬프트에 포함.
  - **AI 벤더 3개 버튼**: 🟣 Claude (`https://claude.ai/new`) / 🟢 ChatGPT (`https://chatgpt.com/`) / 🔵 Gemini (`https://gemini.google.com/app`). 클릭 시 우리 반 컨텍스트가 포함된 프롬프트가 클립보드에 복사되고 해당 AI가 새 탭으로 열림.
  - **벤더별 최적화**: 각 AI의 출력 특성(Claude=정교한 코드블록, ChatGPT=Canvas 활용, Gemini=한 번만 코드블록)에 맞춘 안내 문구를 프롬프트에 동적 삽입.
  - **클립보드 차단 시 fallback**: 자동으로 `.txt` 파일 다운로드.
  - **학급 컨텍스트 미리보기**: 카드 안에 통과 법안 ${n}건 / 시행령 ${n}건 + 상위 3건의 벌칙 요약을 표시해 어떤 데이터가 AI에 보내질지 사전 확인 가능.
- **[PROMPT]** 새 프롬프트의 [필수 작성 규칙]:
  - `charges[].law` 에 반드시 "「우리 반 법안 제목」 제3조(의무)" 형식으로 학급 법안 인용
  - `prosecutionDemand` 가 우리 반 법안의 **벌칙 조항 범위 내**여야 함 (예: 법안 벌칙이 "100만원 이하 과태료"면 검사 구형도 그 안에서)
  - 관련 시행령이 있다면 `roleHints.prosecution` 에 명시
  - 사건 시나리오는 우리 반 법안의 "의무" 조항을 명확히 위반한 행동이 핵심 쟁점이 되도록 구성
- **[DOC]** `docs/judicial-case-ai-prompt.md` 를 3-vendor 버전으로 전면 개편 — Claude/ChatGPT/Gemini별 사용 팁, 공통 스키마, 트러블슈팅 표 포함.
- **[CODE]** `BranchConfigEditor.jsx`:
  - `subscribe(roomCode, 'bills')`, `subscribe(roomCode, 'policies')` 추가하여 컨텍스트 실시간 구독.
  - `AI_VENDORS` 상수 (벤더별 URL·색·팁), `buildJudicialPromptText(vendor)` 함수 신설, `openWithAi(vendor)` 액션 함수 추가.
  - 옛 `downloadJudicialPrompt()` 본문 제거 — 새 헬퍼를 호출하는 얇은 wrapper로 축소(`.txt` 백업 다운로드 용도).
- **[빌드/배포]** `npm run build` 통과, `bash deploy.sh` 배포 완료. `APP_BUILD` v1.2.292.

---

## v1.2.291 — 평가 자동저장 + 여론판 내 문서 패널 (2026-05-27 / [Claude])
- **[UX]** `SpeechEval`: 평가 입력 중 교사가 라운드를 넘겨도 작성 내용이 사라지지 않도록 localStorage 자동저장 추가.
  - 키: `evalDraft_${evalItem.id}_${myStudentId}`, 500ms 디바운스로 저장.
  - 재진입 시 이미 제출한 결과가 없으면 localStorage 초안을 복원.
  - 제출 성공 시 초안 자동 삭제.
- **[FEATURE]** `NewsBoardPage`: 학생 화면에 "내가 작성한 문서" 패널 추가 (`MyArticlesPanel`).
  - 본인이 쓴 기사를 상태(게시/대기/반려)와 함께 목록으로 표시.
  - "이어서 작성" 버튼 클릭 시 `ArticleEditorModal`이 해당 기사 데이터를 사전 로드해서 열림.
  - `ArticleEditorModal`이 `editingArticleId`/`articleData` 프롭을 수용하도록 갱신.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.291.

---

## v1.2.285 — 평가단 서브탭 제거 + 단계 이동 시 입력값 보존 (2026-05-27 / [Claude])
- **[UX]** `DebateToolPanel`: 평가단 기조 발언 단계에서 후보가 여러 명일 때 서브탭 제거, 모두 세로로 쌓아서 표시.
- **[BUGFIX]** 단계 네비게이션 이동 후 재방문 시 미제출 입력값(점수·코멘트) 초기화되던 문제 수정.
  - 원인: `selectedEvalStage` 변경 시 SpeechEval 언마운트 → useState 리셋.
  - 수정: 모든 단계 SpeechEval을 항상 마운트 유지, CSS `hidden` 클래스로만 표시/숨김 전환.
- `selectedEvalSubIdx` state 제거 (서브탭 삭제로 불필요).
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.285.

---

## v1.2.284 — 다자간 토론 A팀/B팀 숨기기 (2026-05-27 / [Claude])
- **[UX]** `TeacherDebateControl`: 다자간(multi_party) 토론 세션 생성 시 추가 팀이 1개 이상 있으면 기본 A팀/B팀 항목을 세 곳에서 모두 숨김.
  - 팀 이름 편집 섹션 (기본 A팀/B팀 이름 편집기)
  - 학생별 배정 칩 (AssignmentChip pro/con)
  - 모둠별 일괄 배정 칩 (AssignmentChip pro/con 전체)
  - 추가 팀·평가단·의장은 그대로 유지.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.284.

---

## v1.2.283 — 평가단 라운드 단계 서브탭 분리 (2026-05-27 / [Claude])
- **[UX]** `DebateToolPanel`: 평가단이 단계 네비게이션에서 라운드 단계(후보별 순서 발언)를 선택했을 때, 여러 평가 항목이 세로로 쌓이던 문제 개선.
  - 항목이 2개 이상이면(라운드 단계) 후보별 서브 탭으로 분리해 한 번에 하나만 표시.
  - 서브 탭: ✅완료 / ○미제출 아이콘 + 후보명. 단계 이동 시 서브 인덱스 자동 리셋.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.283.

---

## v1.2.282 — 토론도구 올리기 수정 + 투표 대기 문구 + 직책 배정 UI (2026-05-27 / [Claude])
- **[BUGFIX]** `DebateToolPanel`: `electionModalSuppressed` 조건을 `vote` 단계에서만 적용하도록 수정.
  - 기존: `electionStatus==='voting'|'ended'`이면 항상 억제 → 5·6단계(debatePrep/debateEval)에서 `electionStatus` 잔류값으로 모달이 막히던 문제.
  - 수정: `wf.currentStep?.id === 'vote'` 조건 추가.
- **[수정]** `ElectionResultBoard`: 투표 완료 후 대기 화면 문구 "아직 투표 진행 중입니다" → "투표 마감 대기 중".
- **[기능]** `Phase2ElectionQuickPanel`: 본 투표 컨트롤 패널에 직책 배정 UI 추가.
  - 득표 순위별로 드롭다운 표시 (대통령 / 국회의장 / 판사 / 없음).
  - 선택 즉시 `config.electionRoles`에 저장 → `ElectionResultBoard` 실시간 반영.
  - 투표 기록이 1개 이상일 때만 표시.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.282.

---

## v1.2.281 — QuickPanel 단계 스코핑 + 여론조사 상태 분기 (2026-05-27 / [Claude])
- **[기능]** `Phase2ElectionQuickPanel`: 단계별로 관련 섹션만 노출.
  - 4단계(prepoll): "📊 사전 여론조사 제어" 섹션만
  - 5·6단계(debatePrep·debateEval): "🎙️ 선거 토론 제어" + 기자단 토글만
  - 7·8·9단계(vote·finalNews·nextJourney): "🗳️ 선거 본 투표 제어"만
  - 헤더 타이틀 단계별 동적 변경
- **[기능]** 4단계 학생 화면: `prePoll.status` 기반 화면 분기
  - `ready` 또는 여론조사 없음: "📊 여론조사 준비 중" 대기 화면
  - `voting`: 투표 가능 PollFeed
  - `ended`: 결과 표시 PollFeed
- **[수정]** `PollFeed`: `ended` 상태 여론조사도 결과(`showResults=true`)로 표시.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.281.

---

## v1.2.280 — TeacherDashboard: prepoll 단계에 선거 패널 노출 추가 (2026-05-27 / [Claude])
- **[BUGFIX]** `TeacherDashboard.jsx`: `Phase2ElectionQuickPanel` 표시 조건에 `'prepoll'` 누락 → 4단계(사전 여론조사)에서 패널 자체가 안 보이던 문제 수정.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.280.

---

## v1.2.279 — 사전 여론조사 후보 채우기 레이블 수정 (2026-05-26 / [Claude])
- **[BUGFIX]** `Phase2ElectionQuickPanel.jsx`의 `applyPrepollFromCandidates`: 선택지 레이블이 모둠명(`group.name`)으로 생성되던 문제 수정 → 후보 이름(`c.leaderNickname`)으로 변경.
  - 예: `"기호1번 민준이네모둠"` → `"기호1번 김민준"`.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.279.

---

## v1.2.278 — 평가단 토론 단계 네비게이션 바 추가 (2026-05-26 / [Claude])
- **[기능]** 평가단(`mySideId === 'evaluator'`)의 토론 중 탭에 단계 네비게이션 바 추가.
  - 타이머 바로 아래에 모든 토론 단계를 칩으로 나열.
  - 현재 토론 진행 단계: 크게 강조 + "현재단계" 뱃지.
  - 각 칩: 평가 항목 없음(—) / 미제출(○ 미제출 amber) / 완료(✅ 완료 emerald) 상태 표시.
  - 클릭하면 해당 단계의 평가 항목으로 이동 (타이머 자동진행과 무관).
- **[기능]** 평가단은 어떤 단계(이미 지난 단계 포함)의 평가도 언제든 제출·수정 가능.
- **[수정]** `SpeechEval.jsx`에 `forceInput` prop 추가:
  - `forceInput=true`일 때 `evalItem.isOpen` 상태에 관계없이 입력 폼 표시.
  - 이미 제출한 평가는 기존 값으로 폼 초기화 → 버튼 "수정 제출"로 변경.
  - "✅ 이미 제출한 평가 — 수정 가능" 안내 표시.
- **[수정]** `DebateToolPanel.jsx`: `evalItemsByStage` 메모 + `EvaluatorStageNav` 컴포넌트 추가.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.278.

---

## v1.2.277 — Phase 2 입장 대기 전광판 노출 조건 안전망 강화 (2026-05-26 / [Claude])
- **[BUGFIX 의심]** 사용자 보고: "두번째 여정 첫번째 단계에서도 '투표 준비 중' 전광판이 떠 있어요."
- **[조사]** `Phase2Page.showEntryWaiting = stepId === 'vote' && !isVoting && !isEnded && !showResult` 조건은 이미 stepId='vote'(step 7)만 노출하도록 작성됨. step 0(prep)에서는 false. 코드 로직은 올바름.
- **[가능 원인]**
  1. 브라우저 캐시 — 이전 버전 (showVote에 stepId === 'vote' 포함) 잔존
  2. Firebase `workflow.phase2.stepIndex` 가 6(vote)에 머물러 있음
- **[안전망 추가]** `wf.currentPhase === 2` 명시 체크 추가 — 다른 phase로 진입한 상황에서 절대 노출 안 되도록.
- **[조치]** 새 빌드 배포 → 학생/교사 강제 새로고침(Cmd/Ctrl+Shift+R) 권고.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.277.

---

## v1.2.276 — 사법부 ⑤ 재판 빠른제어: 미리 준비·세션 생성·전광판 3버튼 + 임시저장판 모달 (2026-05-26 / [Claude])
- **[stage 매핑 정리]** Phase3JudicialQuickPanel의 stage 분기를 v3.2 새 매핑에 맞춤:
  - stage===1(변론서 제출 현황) → stage===2 (논고초안)
  - stage===3(증거 공개) → stage===4 (재판)
  - stage===5(구형) → stage===4 (재판)
  - stage===6(배심원 평결·판결문) → stage===4 (재판에 흡수)
- **[NEW — ⑤ 재판 빠른제어]** stage===4에서 3개 버튼 그리드:
  1. `⚙️ 재판 미리 준비` — 임시저장판 모달 열기
  2. `🎙️ 세션 생성` — 임시저장된 설정으로 토론 세션 생성 (없으면 기본값)
  3. `📺 전광판 띄우기` — 새 창으로 토론 전광판 (DebateTimerTV) 띄우기
- **[NEW — TrialPrepModal 컴포넌트]** `judicialTrialDraft/{caseId}` 에 임시저장:
  - 토론 논제 (자유 입력)
  - 사회자(판사) 학생 (학생 목록 드롭다운)
  - 양측 라벨 (검사 측·변호 측·평가단·사회자)
  - 사전 여론조사 질문 + 선택지 (2개 이상)
  - [💾 임시저장] / [🗑️ 임시저장 삭제] / [취소] 버튼
- **[startJudicialDebate 임시저장 활용]** 세션 생성 시 `trialPrepDraft`가 있으면 우선 적용 (topic, chairId, sideLabelOverrides, stancePoll). 세션 생성 후 draft 자동 삭제.
- **[빠른제어 안내]** 임시저장된 준비안이 있으면 빠른제어 하단에 `💾 임시저장된 준비안이 있습니다` 알림 표시.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.276.

---

## v1.2.275 — 미완료 섹션도 대표가 임의 제출 가능 + 대필 확인 경고창 (2026-05-26 / [Claude])
- **[CHANGE]** `BranchUnitWorkspace` 3단계 제출하기 버튼 — `disabled` 조건에서 `!allSectionsDone` 제거. 이제 `!finalText.trim()`만 막음. 모든 섹션 미저장 상태에서도 대표가 강행 제출 가능.
- **[NEW 경고 다이얼로그]** 미완료 섹션이 있는 채로 제출 클릭 시:
  `⚠️ 모든 섹션이 저장되어야 제출할 수 있습니다.`
  `{대표 학생 번호·이름}님이 대신 작성하셨습니까?`
  `(확인을 누르면 미완료 섹션이 있는 상태로 그대로 제출됩니다.)`
  → 확인 시 그대로 제출, 취소 시 중단.
- **[CHANGE]** 모든 섹션 완료 시에는 기존 단순 confirm("최종 제출합니다. 제출 후에는 수정할 수 없습니다.")만 유지.
- **[안내 문구 갱신]** 미완료 섹션 경고를 "그대로 제출할 수 있어요(제출 시 확인창이 한 번 더 뜹니다)"로 톤 완화.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.275.

---

## v1.2.274 — 사법부 ① 제목 변경 + ② 팀별 자료조사 가이드 (2026-05-26 / [Claude])
- **[제목 변경]** ① 준비 단계의 우측 패널 제목 '🎭 역할 선택' → '🎭 모둠내 역할 배정'.
- **[② 자료조사 팀별 가이드]** `myJudicialSide`에 따라 `ResearchWorkspace`에 전달되는 description·defaultTargets를 분기:
  - 검사팀: 위반 법조항·유죄 판결 사례·피해 기사·통계
  - 변호팀: 정상참작 사유·무죄/감형 판결·피고인 배경·반박 근거
  - 증인 모둠: 사건 정황·증인 배경 지식·일반적 반응·진술 신뢰성
  - 배심원 모둠: 사건 통계·사회적 영향·판단 기준·여론
  - 판사 모둠: 적용 법조항·판례·양형 기준·법원 판결
  - 기자 모둠: 사회적 배경·비슷한 사건 보도·인터뷰·통계
  - 팀 미배정 시 일반 안내문 노출.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.274.

---

## v1.2.273 — 사법부 v3.2 UX 보강: 팀 필터·메모카드 제거·미리보기/수정 분리·판결문 1건 (2026-05-26 / [Claude])
- **[Item 2 — 팀 필터]** ③ 논고초안에서 학생은 본인 팀의 부서 단위(BranchUnitWorkspace)만 노출. 다른 팀(검사 vs 변호) 내용이 서로 보이지 않음. 교사는 전체 노출.
- **[Item 3 — 변론 작성자 메모카드 제거]** `BranchUnitWorkspace`의 1단계 영역(좌-메모카드 / 우-역할 패널)을 사법부에서는 통째로 숨김 (`branch !== 'judicial'` 조건). 3가지 미션과 중복되던 메모 카드 사라짐.
- **[Item 4 — 준비 단계 레이아웃]** `JudicialTab` ① 준비를 grid `[3fr_2fr]`로: 좌 사건 자료실 / 우 역할 선택(`RoleAssigner`). 팀 배치 현황은 하단.
- **[Item 5 — 모둠 현황을 ③로 이동]** `GroupRoleSummary`를 ① 준비에서 제거하고 ③ 논고초안의 3미션 RoleWorkspace 오른쪽에 배치 (`[3fr_2fr]` grid). `OtherGroupsRoleSummary`는 제거.
- **[Item 6 — 판사 판결문 1건만]** ⑤ 재판 정리에서 verdict 중 `v.decision`이 있는 것 중 가장 최신 1건만 노출. 이전 버전이나 다른 모둠 판결문 숨김.
- **[Item 7 — 미리보기/수정 분리]** `BranchUnitWorkspace` 3단계 헤더 '최종 ~ 편집' → '최종 ~ **미리보기**'. 새 state `finalEditing`로 토글:
  - **미리보기 모드 (기본)**: amber 박스에 통합 미리보기 read-only 표시. 하단에 [✏️ 수정하기] + [🔒 제출하기] 버튼.
  - **수정 모드**: 기존 textarea + [💾 저장 + 미리보기로] + [✕ 취소] 버튼.
  - 제출 시 confirm 다이얼로그 추가.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.273.

---

## v1.2.272 — 사법부 v3.2: 7단계 흐름 + 미션 출처 링크 + 불러오기 버튼 (2026-05-26 / [Claude])
- **[FLOW]** 6단계 → **7단계** 재정비. ③ 논고초안 작성을 ② 자료 조사와 ④ 온라인 토의 사이에 신규 단계로 분리.
  1. judicial-prep (사건 확인 + 역할 선택)
  2. judicial-research (자료 조사)
  3. **judicial-draft (논고초안 작성)** ← NEW
  4. judicial-discussion (온라인 토의 — 평가만)
  5. judicial-trial (국민참여재판)
  6. article3 (기사 작성)
  7. poll4 (사후 여론조사)
- **[준비 단계 통합]** 역할 선택(`RoleAssigner`) + 모둠/다른모둠 역할 현황(`GroupRoleSummary`·`OtherGroupsRoleSummary`)을 ③ 온라인 토의에서 ① 준비로 이동. 사건 확인할 때 같이 역할 정하도록.
- **[③ 논고초안]** RoleWorkspace(역할별 3미션) + BranchUnitWorkspace(섹션 초안 + 대표 최종 제출) 두 영역으로 단순화. 평가·댓글 토의 일체 제거.
- **[④ 온라인 토의]** 제출된 논고초안 모음 + `StanceComments`(찬성·반대·질문) 평가만 노출. 다른 모둠 친구들이 읽고 평가하는 단계로 명확히.
- **[NEW — 미션별 출처 링크]** `GenericRoleNotes.jsx` — 각 todo textarea 아래에 URL 입력 추가. `roleNotes/{role}/links/{idx}`에 저장. 읽기 모드에서 🔗 출처 링크 노출.
- **[NEW — 내 미션 불러오기 버튼]** `BranchUnitWorkspace.jsx` — 사법부 섹션 초안 편집 영역 상단에 `📥 내 미션 불러오기` 버튼 추가. 클릭 시 `groups/{gid}/roleNotes/{role}/fields/{0..2}` + `links/{0..2}`를 읽어 `[미션 라벨]\n내용\n🔗 출처: URL` 형식으로 섹션 textarea에 자동 채움. 기존 내용이 있으면 뒤에 추가.
- **[QuickPanel]** 7단계 progress bar로 확장. DEFAULT_STAGE_INFO 7개로 교체.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.272.

---

## v1.2.271 — 사법부 ③ 온라인 토의 4단계화 + ④ 재판 3 sub-phase 구조 (2026-05-26 / [Claude])
- **[③ 온라인 토의 — 4단계 명시]**
  1. **논고초안 작성** — 모둠 작업 공간(RoleWorkspace)에서 ② 자료조사 내용 바탕으로 초안 작성
  2. **대표 제출** — 부서 단위(BranchUnitWorkspace)에서 팀 대표가 최종 초안 제출 → `verdicts/{caseId}` 에 `kind: 'draft'` 저장
  3. **제출된 논고초안 모음** — 학급 전체가 다른 팀 논고를 펼쳐 읽을 수 있도록 모음 표시 (details/summary)
  4. **학급 평가 토의** — StanceComments(찬성/반대/질문) 사용. 좋아요 많이 받은 의견이 재판에서 중요하게 다뤄짐.
- **[④ 국민참여재판 — 3 sub-phase]**
  - **A) 재판 준비** (amber 안내 카드): 자리 배치 + 논고초안 펼쳐두기 + 발언 순서 확인 + 토론도구 시작 안내
  - **B) 재판 진행** (violet): 토론도구 + 진행 기록 댓글창 (`CommentList trial`)
  - **C) 재판 정리** (slate): 배심원 평결 투표(jury만) + 판사 판결문(judge만, `decision` 필드 기준 필터)
- **[CHANGE]** 재판 단계의 판결문 표시는 `v?.decision` 필드 기준으로만 필터 (③에서 제출된 논고초안 `kind: 'draft'`와 분리 표시).
- **[QuickPanel]** ③/④ 단계 안내 문구 새 4-step/3 sub-phase 구조 반영.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.271.

---

## v1.2.270 — 사법부 v3.1 — 6단계로 단순화 (준비-자료조사-온라인토의-재판-기사-여론조사) (2026-05-26 / [Claude])
- **[REDESIGN]** 사용자 요청에 따라 8단계 → **6단계**로 단순화. 논고작성·사전여론조사·토론카드를 모두 ③ **온라인 토의**로 통합. article3/poll4를 사법부 흐름 안으로 흡수.
- **[NEW 6단계 흐름]**
  1. **judicial-prep** — 사건 확인 (사건 자료실 풀 표시 + 팀 배정 + 역할 선택)
  2. **judicial-research** — 자료 조사 (ResearchWorkspace)
  3. **judicial-discussion** — 온라인 토의 (논고/변론서 작성 + 학급 댓글 토의)
  4. **judicial-trial** — 국민참여재판 (토론도구 자동 연결 + 배심원 평결 + 판사 판결문)
  5. **article3** — 기사 작성 (기자 모둠 + 자유 기사) — 사법부 ⑤로 흡수
  6. **poll4** — 사후 여론조사 — 사법부 ⑥으로 흡수
- **[준비 단계 변경]** 사건 자료실(JudicialCaseRoom)을 항상 상단 고정 → **준비 단계 안에 큰 영역으로 표시**. `judicial-prep` 진입 시 학생 화면이 사건 자료실로 자동 스크롤.
- **[JudicialTab.jsx]** 전면 재구조화 — 6개 섹션 (prep/research/discussion/trial/article/poll), 각각 ref + scrollIntoView. STAGE_OF_STEP에 구버전 stepId 호환 매핑 유지.
- **[Phase3JudicialQuickPanel.jsx]** progress bar 8→6, DEFAULT_STAGE_INFO 6단계로 교체. isJudStep에 article3/poll4 포함.
- **[PhaseWorkflow.jsx]** phase3 사법부 스텝 6개로 교체. article3·poll4에 `stage: 4`/`stage: 5` 부여하여 사법부 progress 인식.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.270.

---

## v1.2.269 — 사법부 v3 재정비 [Phase 3+5]: 공동작업 분기 + workMode 토글 + 8단계 progress bar (2026-05-26 / [Claude])
- **[STEP 5 — 교사 학급 설정]** `BranchConfigEditor.jsx` 사법부 섹션에 `🤝 작업 방식` 토글 추가 (`🎭 역할중심` / `🤝 공동작업`). 편성 모드(`📰 기자단/⚖️ 전원사법`) 바로 옆에 배치.
- **[STEP 3 — 공용 컴포넌트 분기]** workMode에 따라 사법부 역할 필터링:
  - `BranchUnitWorkspace.jsx branchRoles` — workMode='collaborative'면 팀별 lead 역할만 노출 (`prosecutionLead`·`defenseLead`·`witnessLead`·`pressLead`). 'role'이면 collaborativeOnly 제외 4역할.
  - **배심원은 항상 공동작업 강제** (workMode='role'이어도 `juryLead`만 노출).
  - **판사는 단독 역할** — workMode 무관 기존 그대로.
  - 동일 분기 로직을 `RoleSelfSelector.jsx`·`GroupRoleSummary.jsx`에도 적용 (학생 역할 선택·요약 UI 일관성).
- **[STEP 5 — 교사 빠른 제어]** `Phase3JudicialQuickPanel.jsx`:
  - 헤더에 작업 방식 뱃지 추가 (`🤝 공동작업 모드` / `🎭 역할중심 모드`)
  - `DEFAULT_STAGE_INFO` 7단계 → **8단계**로 교체 (준비→자료조사→논고→여론조사→토론카드→재판→평결→기사)
  - progress bar `stages` 배열 8개 dot로 확장
  - stage 범위 `0~6` → `0~7` 확장
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.269.

---

## v1.2.268 — 사법부 v3 재정비 [Phase 1/9]: 데이터 모델 + 워크플로 8단계 (2026-05-26 / [Claude])
- **[PROPOSAL]** `docs/proposal_judicial_v3.md` 사용자 승인 — 9단계 작업 순서대로 단계별 배포 시작.
- **[STEP 1 — 데이터 모델]**
  - `gameStore.js DEFAULT_CONFIG.branchConfig.judicial.workMode = 'role'` 추가 ('collaborative' | 'role').
  - `scaffolding-data.js DEFAULT_ROLES.judicial`에 공동작업 모드 전용 lead 역할 5종 추가: `prosecutionLead` / `defenseLead` / `witnessLead` / `juryLead` / `pressLead` (각 `collaborativeOnly: true`, `assignedSection: '{side}Final'`).
- **[STEP 2 — 워크플로]**
  - `PhaseWorkflow.jsx PHASE_STEPS.phase3` 사법부 6단계 → **8단계** 교체:
    1. judicial-prep (stage 0)
    2. judicial-research (stage 1) ← NEW
    3. judicial-statement (stage 2)
    4. judicial-poll (stage 3) ← NEW
    5. judicial-debate-prep (stage 4) ← NEW
    6. judicial-trial (stage 5) ← was judicial-witness
    7. judicial-verdict (stage 6)
    8. judicial-article (stage 7) ← NEW
  - `article3` / `poll4` 외부 단계 그대로 유지 (제안서대로).
- **[COMPAT 패치]** `JudicialTab.STAGE_OF_STEP`에 8개 신규 stepId 임시 매핑 (전면 재구조화 전). `Phase3JudicialQuickPanel sourceStepId: 'judicial-witness' → 'judicial-trial'`.
- **[남은 단계]**: Step 3 BranchUnitWorkspace 공동작업 분기·신규 섹션 / Step 4 JudicialTab 전면 재구조화 / Step 5 BranchConfigEditor workMode 토글 + QuickPanel 8단계 / Step 6 여론조사·토론도구·기사 연동 / Step 7 모니터링 / Step 8 검증 / Step 9 문서.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.268.

---

## v1.2.267 — 선거 전광판 표시명 fallback 개선 (countryName→className→빈문자열) (2026-05-26 / [Claude])
- **[BUGFIX]** `ElectionResultBoard` 입장 대기/결과 발표 헤더가 항상 "우리 반"으로 표시되던 문제.
- **[CHANGE]** `displayName = config.countryName.trim() || className.trim() || ''` — 학급 설정의 나라 이름(예: "비빔민국") 우선, 없으면 학급 이름("6학년 9반") 사용, 둘 다 없으면 "선거 투표소 입장 대기 중"·"선거 결과"로 깔끔 노출 ("우리 반" prefix 제거).
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.267.

---

## v1.2.266 — 선거 등수별 직책을 학급 설정에서 편집 가능 (2026-05-26 / [Claude])
- **[FEATURE]** `config.electionRoles` 추가 — `[{ rank, label, emoji }]` 배열. 기본값은 1위 대통령🇰🇷 / 2위 국회의장🏛️ / 3위 대법원장⚖️.
- **[NEW UI]** `ClassroomConfigEditor.jsx` — 시스템 활성화 섹션 아래에 `🏆 선거 등수별 직책` 편집 카드 추가. 등수별 이모지·라벨 인라인 편집, 직책 추가/삭제, 기본값 복원 버튼.
- **[election.js]** `roleForRank(rank, electionRoles)` 두 번째 인자 추가. config 우선, 없으면 RANK_ROLE fallback.
- **[ElectionResultBoard, ElectionResultPanel]** `config.electionRoles`를 읽어 `roleForRank`에 전달.
- **[gameStore]** room 리스너에서 `data.config.electionRoles`가 배열이면 그대로, 없으면 기본값으로 보충.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.266.

---

## v1.2.265 — 7단계 4상태 분리: 입장 대기 / 투표 / 진행 중 대기 / 결과 (2026-05-26 / [Claude])
- **[FEATURE]** Phase2Page 7단계(vote)를 4가지 독립 상태로 분리:
  1. **입장 대기** (`stepId='vote' && electionStatus='idle'`) — 전광판: `🚪 {countryName} 선거 투표소 입장 대기 중`
  2. **투표** (`electionStatus='voting' && !myVote`) — 컴팩트 후보 카드 + 투표하기 버튼
  3. **진행 중 대기** (`electionStatus='voting' && myVote`) — 전광판: `⏳ 아직 투표 진행 중입니다` (다른 정보 일체 없음)
  4. **결과** (`electionStatus='ended' || stepId='nextJourney'`) — 전광판: 공식 발표 + 1위 카드 + 순위
- **[REMOVED]** 대기 화면의 초록 배너(`투표를 마쳤어요 / 누굴 뽑았어요 / N명 마쳤어요`)와 중간 결과 그래프 전부 제거.
- **[ElectionResultBoard]** `entryWaiting` prop 추가, `waiting`/`entryWaiting` 모드는 early-return으로 순위 섹션 일체 건너뛰고 중앙 안내만 노출.
- **[showVote]** `stepId === 'vote' || isVoting` → `isVoting` 으로 변경. 교사 액션 없으면 학생은 투표 못 함.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.265.

---

## v1.2.264 — 투표 직후 후보 카드 숨기고 대기 전광판으로 즉시 전환 (2026-05-26 / [Claude])
- **[CHANGE]** `Phase2Page.jsx` `isWaitingForOthers = showVote && Boolean(myVote) && !isEnded` 로 변경.
- **[RATIONALE]** 기존 `isVoting && myVote` 조건은 교사가 '투표 시작'을 누르지 않은 상태(electionStatus='idle')에서 학생이 step 7에서 투표하면 대기 화면이 안 떴음. 컴팩트 카드에 '투표 완료' 라벨만 표시되어 학생이 다음 행동을 모름.
- **[결과]** showVote가 켜진 단계에서 투표만 마치면 즉시 후보 카드 숨겨지고 대기 전광판('아직 투표 진행 중입니다 / 대기해 주세요')으로 전환.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.264.

---

## v1.2.263 — 7단계 [투표하기] 즉시 기록 (확인 모달 제거) (2026-05-26 / [Claude])
- **[CHANGE]** `Phase2Page.onVote()` — 기존 `ElectionVoteModal` 확인 단계 제거. 클릭 즉시 `electionVotes/${myStudentId}` 직접 기록.
- **[RATIONALE]** 컴팩트 카드에 `[📋 자세히 보기]` 모달이 별도로 있어 사전 검토는 거기서 완료됨 → 투표 행위 자체는 한 번의 클릭으로 끝나는 게 직관적.
- **[REMOVED]** `ElectionVoteModal` 임포트·`voteTarget` state·모달 렌더 블록 삭제. `voteBusy` state로 더블클릭 가드.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.263. deploy.sh 정상 배포.

---

## v1.2.262 — 대기 화면 메시지 변경: '아직 투표 진행 중입니다 / 대기해 주세요' (2026-05-26 / [Claude])
- **[CHANGE]** `ElectionResultBoard.jsx` 대기 모드 메시지 — '투표 결과를 기다리는 중' → '아직 투표 진행 중입니다 / 대기해 주세요' (투표 진행 중 톤).
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.262.

---

## v1.2.261 — 결과/대기 보드 안 보이는 버그 수정 (HighlightBox null 반환) (2026-05-26 / [Claude])
- **[BUGFIX]** 교사 '결과 보이기' 눌러도 학생 화면에 결과 전광판 안 나오는 문제. 원인: `HighlightBox`가 `anyHighlight=true && active=false` 면 `return null` 처리. 단계 7(vote)의 highlight는 `'candidates'`인데 결과 섹션의 active는 `'result'`라 매칭 실패 → 결과 화면 통째로 null.
- **[FIX]** `Phase2Page.jsx` — `anyHL` 계산을 `isStudent && !!stepHighlight && !electionLockActive` 로 변경. 선거 잠금 모드(voting/ended) 시 highlight 시스템 우회 → 모든 섹션이 show* 플래그만으로 렌더.
- **[FIX]** 결과/대기 HighlightBox에 명시적 `anyHighlight={false}` 추가(이중 안전장치).
- **[결과]** 어느 단계(prep~nextJourney 어디서든)에서 결과 공개/투표 다시 열기 누르면 학생 화면 즉시 전광판/투표소로 전환.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.261. deploy.sh 정상 배포.

---

## v1.2.260 — 전광판 대기 모드 추가: '투표 결과를 기다리는 중입니다' (2026-05-26 / [Claude])
- **[FEATURE]** `ElectionResultBoard.jsx` — `waiting` / `waitingNote` props 추가. 대기 모드는:
  - 헤더 배지: "공식 발표" → "결과 발표 대기 중" (slate 톤)
  - 1위 자리: 카드 대신 "⏳ 투표 결과를 기다리는 중입니다" 대형 안내 카드 표시
  - 순위 그래프: 1위 강조 효과·직책 라벨 비공개 (모두 동등 슬레이트 톤)
  - 하단 문구: "선생님이 결과를 공개하기 전까지는 1위와 직책이 비공개입니다"
- **[CHANGE]** `Phase2Page.jsx` — `isWaitingForOthers && !showResult` 분기에서 기존 흰 카드 `ElectionResultPanel` 미리보기 대신 `ElectionResultBoard waiting={true}` 전광판 노출. 투표 완료 확인 배너만 위에 콤팩트하게 유지.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.260. deploy.sh 정상 배포.

---

## v1.2.259 — 7단계 투표 UI 재설계: 컴팩트 카드 + 자세히 모달 + 전광판 결과 (2026-05-26 / [Claude])
- **[FEATURE]** 7단계(vote) 진입 시 후보 자료가 줄줄이 노출되던 인터페이스 전면 교체.
- **[NEW]** `CandidateBallotList.jsx` — 컴팩트 투표 카드 (기호 + 이름 + 모둠 + 포스터 썸네일) + `[📋 자세히 보기]` 모달(전체 캠프 자료) + `[🗳️ 투표하기]` 버튼.
- **[NEW]** `ElectionResultBoard.jsx` — Phase 1 최우선과제 전광판 스타일(indigo/slate 그라데이션 + amber 강조) 적용. 1위 대형 발표 카드 + 전체 순위 그래프.
- **[CHANGE]** `Phase2Page.jsx` — `showVote=true`면 BallotList, 아니면 기존 CandidateCard 풀 카드로 분기. `showResult=true`면 ElectionResultPanel 대신 ElectionResultBoard 사용.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.259. deploy.sh 정상 배포.

---

## v1.2.258 — Phase2Page electionStatus Firebase 직접 구독 + showResult 로직 수정 (2026-05-26 / [Claude])
- **[BUGFIX]** 교사 '투표 다시 열기' 클릭해도 학생 화면 반응 없는 문제. 원인 후보: gameStore 풀룸 리스너의 electionStatus 동기 지연 + finalNews/nextJourney 단계에서 showResult가 항상 true 고정.
- **[FIX 1]** `Phase2Page.jsx` — `liveElectionStatus` 로컬 state 추가, `subscribe(roomCode, 'electionStatus', ...)`로 Firebase 직접 구독. gameStore 우회.
- **[FIX 2]** `showResult = !isVoting && (isEnded || stepId === 'finalNews' || stepId === 'nextJourney')` — voting 시 모든 단계에서 결과 패널 숨김 → 투표 다시 열기 정상 동작.

---

## v1.2.257 — DebateToolPanel relatedElectionDebate 의존 제거 + 새 선거토론 자동팝업 비활성화 (2026-05-26 / [Claude])
- **[BUGFIX]** v1.2.256까지도 학생 화면 토론 풀모달 안 닫히는 문제. 원인: `session.relatedElectionDebate` 필드 체크에 의존했으나 이전 버전 세션 데이터에는 이 필드가 없어 항상 false 처리되어 억제 실패.
- **[FIX 1]** `DebateToolPanel.jsx` — `electionModalSuppressed = electionStatus === 'voting' || 'ended'` 만으로 판단. 세션 필드 무관.
- **[FIX 2]** `Phase2ElectionQuickPanel.doCreateDebate()` — 새 선거토론 세션은 `isPopupOpen: false`로 생성. 학생 화면은 우하단 플로팅 버튼만 보이고 풀모달 자동오픈 안 함.

---

## v1.2.256 — 선거 투표 중 선거 토론 모달 electionStatus 기반 강제 억제 (2026-05-26 / [Claude])
- **[BUGFIX]** v1.2.255에도 불구하고 학생 화면에서 토론 주제만 보이는 문제 지속. 근본 원인: `closeActiveElectionDebate()`가 로컬 `debateSessions` 상태(stale 가능성)를 사용해 실패할 수 있었음.
- **[FIX 1 — 신뢰성]** `DebateToolPanel.jsx` — `electionStatus === 'voting' || 'ended'`이고 세션이 `relatedElectionDebate: true`면 `showFullModal`과 플로팅 버튼을 클라이언트 측에서 직접 억제. Firebase write 없이 즉시 동작, 가장 신뢰할 수 있는 해결책.
- **[FIX 2 — 백업]** `Phase2ElectionQuickPanel.jsx` — `closeActiveElectionDebate()`에서 로컬 `debateSessions` 대신 `getOnce(roomCode, 'debateSessions')`로 최신 Firebase 데이터 직접 읽어 stale 문제 차단.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.256. deploy.sh 정상 배포.

---

## v1.2.255 — 본 투표 액션 시 활성 선거 토론 풀모달 자동 해제 (2026-05-26 / [Claude])
- **[BUGFIX]** v1.2.254에서도 학생 화면이 토론 주제만 계속 보이는 문제. 원인: 선거 토론 세션이 `isPopupOpen: true`로 활성화돼 있으면 `DebateToolPanel`이 `fixed inset-0 z-50` 풀모달로 학생 화면 전체를 덮음. 본 투표 상태 변경해도 그 뒤의 Phase2Page는 모달에 가려서 안 보임.
- **[FIX]** `Phase2ElectionQuickPanel.jsx`에 `closeActiveElectionDebate()` 추가 — 활성 토론 세션의 `isActive:false` + `isPopupOpen:false` 일괄 설정.
- **[FIX]** `startVote`/`endVoteAndShowResult`/`showExistingResult`/`reopenVote` 모든 본 투표 액션에서 우선 `closeActiveElectionDebate()` 호출 후 `setElectionStatus()` 호출.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.255. deploy.sh 정상 배포.

---

## v1.2.254 — 학생 화면 선거 잠금 모드 (electionStatus 우선) (2026-05-26 / [Claude])
- **[BUGFIX]** 교사가 "투표 결과 보이기"·"투표 다시 열기" 눌러도 학생 화면 반응 없음 + 토론 주제만 보이는 문제. 원인: `Phase2Page.jsx`의 게이팅이 `stepId` 기반만 사용 → `stepId='debatePrep'` 등 다른 단계에서 `electionStatus` 무시.
- **[FIX]** `electionLockActive = (isVoting || isEnded)` 도입. 선거 잠금 모드일 때 다음 섹션 모두 숨김:
  - `showPrep` / `showRegister` / `showPoll` / `showDebatePrep` / `showArticle` → 잠금 시 false
  - `showCandidates` → `isVoting`일 때 stepId 무관 강제 노출, `isEnded`일 때 숨김(결과 패널에 양보)
  - `showVote` → `isVoting`일 때 노출
  - `showResult` → `isEnded`일 때 노출
- **[결과]** 교사가 어느 stepId에서든 "결과 보이기"/"투표 다시 열기" 누르면 학생 화면이 즉시 투표소 또는 결과 패널로 전환.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.254. deploy.sh 정상 배포.

---

## v1.2.253 — 기존 투표 결과 보이기 버튼 추가 (2026-05-26 / [Claude])
- **[FEATURE]** `Phase2ElectionQuickPanel.jsx` — `electionStatus='idle'`이지만 `votedCount > 0`(이전 투표 기록이 남아있는 상태)일 때:
  - **📺 결과 보이기** (primary, indigo): `setElectionStatus('ended')` 호출 → 학생 화면에 결과 패널 일괄 노출
  - **🚀 투표 다시 시작** (secondary): 새 투표 라운드 (기존 votes 유지 옵션)
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.253. deploy.sh 정상 배포.

---

## v1.2.252 — 투표 완료 학생용 실시간 결과 미리보기 (2026-05-26 / [Claude])
- **[FEATURE]** `Phase2Page.jsx` — 7단계(`vote`) 대기 화면에 `ElectionResultPanel` 추가. 이미 투표한 학생은 기다리는 동안 현재까지의 실시간 결과 확인 가능.
- **[UX]** "🔒 투표한 사람만 볼 수 있어요" 뱃지 + "최종 결과는 선생님이 공개할 때 확정됩니다" 안내. 미투표 학생은 후보 카드만 보여 결과 노출되지 않음.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.252. deploy.sh 정상 배포.

---

## v1.2.251 — 본 투표 컨트롤 박스를 7단계(vote) 이후에만 노출 (2026-05-26 / [Claude])
- **[UX FIX]** v1.2.250에서 5~9단계 모두 본 투표 컨트롤이 노출되던 문제. 투표는 7단계(`vote`)에서만 진행하는 게 수업 흐름에 맞음.
- **[FIX]** `Phase2ElectionQuickPanel.jsx` — `useWorkflow` 훅 추가 후 본 투표 박스를 `['vote', 'finalNews', 'nextJourney'].includes(currentStep.id)`일 때만 렌더. 5단계(`debatePrep`)·6단계(`debateEval`)에서는 토론·사전 여론조사 컨트롤만 표시.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.251. deploy.sh 정상 배포.

---

## v1.2.250 — 선거 빠른제어 노출 단계 확장 (2026-05-26 / [Claude])
- **[BUGFIX]** v1.2.249에서 추가한 본 투표 컨트롤이 `stepId === 'debatePrep'`(5단계)에서만 보이는 문제. 사용자가 7단계 `vote`(투표 시작 및 결과 확인)에 접근했을 때 빠른제어가 안 나옴.
- **[FIX]** `TeacherDashboard.jsx` — `Phase2ElectionQuickPanel` 노출 조건을 `['debatePrep', 'debateEval', 'vote', 'finalNews', 'nextJourney']` 5개 단계로 확장. 본 투표 컨트롤이 필요한 5~9단계 전체에서 노출.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.250. deploy.sh 정상 배포.

---

## v1.2.249 — 선거 본 투표 교사 컨트롤 + 학생 대기 화면 (2026-05-26 / [Claude])
- **[FEATURE]** `Phase2ElectionQuickPanel.jsx` — 🗳️ 선거 본 투표 컨트롤 박스 신규 추가:
  - 상태 뱃지(준비/투표 중/마감) + 투표 진행률(N/총원)
  - `🚀 투표 시작` / `🏁 결과 공개` / `⏪ 투표 다시 열기` / `♻️ 초기화` 버튼
  - 후보 2명 미만이면 시작 차단, 미투표 학생 있으면 결과 공개 시 확인 다이얼로그
  - `electionStatus`와 `electionVotes` 실시간 구독
- **[FEATURE]** `Phase2Page.jsx` — `electionStatus` 기반 게이팅:
  - `showVote`에 `electionStatus === 'voting'` OR 추가 → 교사가 직접 투표 제어 가능
  - `showResult`를 `electionStatus === 'ended'` 중심으로 명확화 (vote 단계에서 자동 노출 제거)
  - 투표 완료 학생용 🕰️ "투표를 마쳤어요" 대기 화면 신규
  - 투표소 진입 시 후보 카드 위에 "투표가 시작되었어요" 안내 박스
  - 대기 중·결과 단계엔 후보 카드 숨김
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.249. deploy.sh 정상 배포.

---

## v1.2.247~v1.2.248 — 사법부 역할 필터링 누락 핫픽스 (2026-05-26 / [Claude])
- **[BUGFIX 원인 분석]** 검사팀 학생인데도 화면 전체에 21개 역할(검사·변호·증인·배심원·판사·기자) 모두 노출되는 문제. 원인 다중:
  1. **`BranchUnitWorkspace.unitInfo`가 prosecution/defense만 검색** — witness/jury/judge/press unitId는 null 반환 → `_side` 미설정 → 필터 미작동.
  2. **`BranchUnitWorkspace.branchRoles` 필터에 `witness` 케이스 누락**.
  3. **`RoleSelfSelector`(statementMode 역할 카드)에 `filterSide` prop 미지원** — 21개 모두 노출. 이것이 사용자가 보고한 가장 두드러진 문제.
  4. **`GroupRoleSummary`(우리 모둠 현황)에도 `filterSide` 미지원** — 같은 unit 안에서도 모든 역할 카드가 노출됨.
- **[FIX v1.2.247]** `BranchUnitWorkspace.unitInfo`에 witness/jury/judge/press 케이스 추가. `branchRoles` 필터에 `witness` 추가.
- **[FIX v1.2.248]** `RoleSelfSelector`에 `filterSide` prop 추가 + judicial 필터 로직. `GroupRoleSummary`에도 `filterSide` prop 추가. BranchUnitWorkspace의 RoleSelfSelector/GroupRoleSummary 호출 시 `filterSide={unitInfo?._side}` 전달. JudicialTab prepMode의 GroupRoleSummary는 `filterSide={myJudicialSide}` 전달.
- **[검증]** demo24 방에 학생 김민준(검사팀=labor 모둠)으로 접속 → 검사팀 unit 카드에 "수석 검사·증거 검사·심문 검사·검사 보조" 4개 역할만 정상 표시 확인 (브라우저 직접 검증, Claude in Chrome 사용).
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.248 갱신. 배포(deploy.sh) 완료.

---

## (배포 핫픽스) v1.2.245~246 라이브 미반영 → deploy.sh 재실행으로 정상 반영 (2026-05-25 / [Claude])
- **[BUG]** 이전 작업에서 `rsync ... dist/ <배포경로>/app/dist/` 직접 호출로 배포를 시도. 라이브 URL이 보는 위치는 `app/` 루트인데 `app/dist/` 하위에만 새 번들이 들어가서 라이브는 v1.2.244 그대로 유지됨.
- **[FIX]** `bash ~/class_democra_dev/app/deploy.sh` 재실행. deploy.sh가 `app/` 루트를 비우고 `dist/*`를 거기 복사하여 v1.2.246이 정상 반영됨.
- **[DOCS RULE]** `dev_guidelines.md` §9에 "rsync로 `app/dist/`에 직접 복사 금지 — 반드시 `deploy.sh` 사용" 규칙 추가 + 검증 방법 명시.

---

## (문서 규칙) task.md "보류" 섹션 보존 규칙 추가 (2026-05-25 / [Claude])
- **[DOCS RULE]** `dev_guidelines.md` §10에 "🚨 task.md 보류(Deferred) 섹션 — 사용자 명시 삭제 명령 전까지 유지" 규칙 신설. 임의 삭제·축약·이동 금지.
- **[DOCS RULE]** `project_context.md` §1 상단에 동일 규칙 한 줄 요약 추가 (세션 진입 시 즉시 인지).
- **[NOTE]** 새 세션이 열리거나 토큰 만료로 컨텍스트가 끊겨도 보류 항목이 잊혀지지 않도록 컨텍스트·가이드 문서 양쪽에 명시.

---

## (문서) 사법부 — 통과된 법안 자동 선택 사건 생성 기능 "보류" 등록 (2026-05-25 / [Claude])
- **[DOCS]** `task.md` 상단에 "보류" 섹션 신설.
- **[DOCS]** 통과된 법안 자동 선택 → AI 사건 시나리오 생성 기능을 보류로 기록. 현재는 별빛 편의점 사건 사용, 입법부에서 실제 법안이 통과된 후 착수 예정.
- **[NOTE]** 현재 우회: AI 프롬프트 다운로드 후 `[관련 법]` 칸에 통과된 법안 조항을 교사가 직접 복사·붙여넣기 가능.

---

## v1.2.246 — 사법부 팀 미배정 시 역할 노출 버그 수정 (2026-05-25 / [Claude])
- **[BUGFIX 원인 분석]** 검사팀 학생에게 역할이 여러 개(전체 목록) 노출되는 문제. 원인:
  1. `myJudicialSide`에 `witness` 체크 누락 → 증인 모둠 학생은 항상 null 반환.
  2. `myJudicialSide`가 `null`이면(선생님이 학급 설정에서 팀 배정 전 상태) `filterSide=null` → `RoleAssigner`·`RoleWorkspace`가 전체 21개 역할을 필터 없이 노출.
  3. Firebase `branchConfig.judicial.prosecution`이 `[]`(기본값)이면 어느 팀도 매칭 안 됨 → `null`.
- **[BUGFIX]** `JudicialTab.jsx` — `myJudicialSide` useMemo에 `witness` 케이스 추가.
- **[UX]** `myJudicialSide`가 null인 상태에서 `RoleAssigner` 대신 "팀 배정 후 역할 선택 가능" 안내 메시지 표시. `RoleWorkspace`도 동일 처리.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.246 갱신. 배포 완료.

---

## v1.2.245 — 사법부 역할 체계 완성 (검사팀 4역할 + 기자팀 4역할, 구 중복 역할 제거) (2026-05-25 / [Claude])
- **[BUGFIX]** 검사팀 역할 선택에 판사·구 역할 중복 표시 문제. 원인: `scaffolding-data.js`에 구 역할(prosecutor/defender/juror/witness/defendant)이 새 역할과 함께 잔존해 key 중복 및 side 오류 발생.
- **[FEATURE]** `scaffolding-data.js` — 구 judicial 역할 6개(prosecutor/defender/juror/reporter/witness/defendant) 전면 삭제.
- **[FEATURE]** 검사팀(prosecution) 4역할 확정: `prosecutor`(수석 검사), `evidence_prosecutor`(증거 검사), `questioning_prosecutor`(심문 검사), `assistant_prosecutor`(검사 보조).
- **[FEATURE]** 변호팀(defense) 4역할 확정: `defender`(수석 변호인), `evidence_defender`(증거 변호인), `defendant`(피고인), `assistant_defender`(변호 보조).
- **[FEATURE]** 기자 모둠(press) 4역할 신설: `reporter_chief`(편집장), `reporter_a`(취재 기자 A), `reporter_b`(취재 기자 B), `reporter_editorial`(논설위원).
- **[FEATURE]** `BranchUnitWorkspace.jsx` — SECTION_META에 신규 섹션 추가: `prosecutionEvidence`, `questioningScript`, `prosecutionNotes`, `defenseEvidence`, `defenseNotes`.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.245 갱신. 배포 완료.

---

## v1.2.244 — 사법부 증인·배심원·판사·기자 모둠 배정 UI 추가 (2026-05-25 / [Claude])
- **[BUGFIX]** "증인 6명" = 사건 시나리오 캐릭터 수(byeolbit 프리셋 기준), 학생 모둠 배정과 별개. 설명 없이 표시되어 혼란 유발.
- **[FEATURE]** `gameStore.js` — `branchConfig.judicial`에 `witness`, `jury`, `judge`, `press` 배열 추가.
- **[FEATURE]** `BranchConfigEditor.jsx` — 사법부 설정에 증인·배심원·판사 모둠 배정 UI 추가 (기자단 모드 시 기자 모둠 포함). `assignedGroupIds`·`assignedAll`에 새 sides 추가.
- **[FEATURE]** `JudicialTab.jsx` — `judUnits`에 witness/jury/judge/press 포함. statementMode에서 팀별 SIDE_META 맵으로 색상·레이블 처리.
- **[FEATURE]** `BranchUnitWorkspace.jsx` — `docLabel` 확장 (진술 카드/평의 메모/판결문/취재 기사).
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.244 갱신. 배포 완료.

---

## v1.2.243 — 사법부 형사/민사 + 토글 UI (2026-05-25 / [Claude])
- **[BUGFIX]** `setJudicialCaseType()` 함수가 UI 없이 정의만 돼있어 민사/형사 전환 불가. 토글 버튼 추가.
- **[FEATURE]** `BranchConfigEditor.jsx` — "⚖️ 재판 종류" 토글(⛓️ 형사 / 📜 민사) 추가.
- **[BUGFIX]** `gameStore.js` — 기본값에 `caseType: 'criminal'` 명시.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.243 갱신. 배포 완료.

---

## v1.2.242 — 사법부 AI 프롬프트 초안 다운로드 기능 (2026-05-25 / [Claude])
- **[FEATURE]** `BranchConfigEditor.jsx` — 사법부 사건 시나리오 섹션에 "AI로 새 사건 만들기" 블록 추가.
  - `downloadJudicialPrompt()` 함수: 완성된 프롬프트 초안을 `.txt` 파일로 다운로드.
  - 4단계 사용 안내 UI (다운로드 → 사건 내용 수정 → AI에 붙여넣기 → JSON 업로드).
  - 프롬프트 내용: 사건 입력란·작성 요구사항·완전한 JSON 스키마(evidence/witnesses/roleHints/stageGuides 포함)·업로드 전 확인 체크리스트.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.242 갱신. 배포 완료.

---

## v1.2.241 — 사법부 팀별 역할 필터링 전범위 적용 (2026-05-25 / [Claude])
- **[BUGFIX]** v1.2.240 수정이 `BranchUnitWorkspace`(② 논고카드 단계)에만 적용되고 ① 준비 단계 미적용 문제 수정.
- **[BUGFIX]** `RoleAssigner.jsx` — `filterSide` prop 추가. `kind === 'judicial'` + `filterSide` 조건 시 해당 팀 역할만 필터링.
- **[BUGFIX]** `RoleWorkspace.jsx` — `filterSide` prop 추가. `kind === 'judicial'` + `filterSide` 조건 시 해당 팀 역할만 필터링.
- **[FEATURE]** `JudicialTab.jsx` — `myJudicialSide` 계산 추가 (prosecution/defense/jury/judge/press). `RoleAssigner`·`RoleWorkspace`에 `filterSide={myJudicialSide}` 전달.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.241 갱신. 배포 완료.

---

## v1.2.240 — 사법부 팀별 역할 필터링 (2026-05-25 / [Claude])
- **[BUGFIX]** `scaffolding-data.js` — 사법부 7개 역할에 `side` 속성 추가: `prosecutor`·`witness` → `'prosecution'`, `defender`·`defendant` → `'defense'`, `juror` → `'jury'`, `judge` → `'judge'`, `reporter` → `'press'`.
- **[BUGFIX]** `BranchUnitWorkspace.jsx` — `branchRoles` useMemo에 사법부 side 필터링 추가. 검사팀 workspace는 검사·증인만, 변호팀은 변호사·피고인만 표시. 배심원·판사·기자팀도 각각 해당 역할만 표시.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.240 갱신. 배포 완료.

---

## v1.2.236 — 사법부 사건 자료실 + AI JSON 업로드 시스템 (2026-05-25 / [Claude])
- **[FEATURE]** `judicial-case-data.js` 신규 — `validateCaseJson()`, `createEmptyCase()`, 5개 프리셋 (`PRESET_BYEOLBIT` 완전판 + 4개 경량판), `JUDICIAL_PRESETS`, `PERSONA_LABEL`, `CASE_TYPE_LABEL`.
- **[FEATURE]** `JudicialCaseRoom.jsx` 신규 — 학생용 사건 자료실. 단계별 증거 공개(`revealedAtStage`), 내 역할 힌트, 피고인·증인 진술서 탭 UI.
- **[FEATURE]** `JudicialTab.jsx` — 학생 화면 상단에 사건 자료실 블록 추가 (`currentStage` 전달).
- **[FEATURE]** `BranchConfigEditor.jsx` — 사법부 설정에 모드 토글(언론패널/전원사법) + 프리셋 선택 드롭다운 + AI 생성 JSON 파일 업로드 + 유효성 검사 UI 추가.
- **[FEATURE]** `Phase3JudicialQuickPanel.jsx` — 6단계→7단계 진행바로 전환. `activeCase.stageGuides`로 교사 안내 자동 표시. 단계별 증거·증인·구형 맥락 패널 추가. 사건 제목·요약 상단 표시.
- **[FEATURE]** `scaffolding-data.js` — 사법부 역할 4종 → 7종 확장 (judge/prosecutor/defender/juror/reporter/witness/defendant).
- **[FEATURE]** `gameStore.js` — `branchConfig.judicial`에 `activeCaseId`, `activeCase`, `currentStage` 필드 추가.
- **[BUGFIX]** `Phase3JudicialQuickPanel.jsx` 빌드 오류 수정 — 구 NPC 이벤트 `activeCase`·`activeCaseId`를 `npcActiveCase`·`npcCaseId`로 rename하여 새 `activeCase`(branchConfig 기반)와 충돌 해소.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.236 갱신. 배포 완료.

---

## docs — 사법부 AI 프롬프트 가이드 + 제안서 v7 정제 (2026-05-25 / [Claude])
- **[DOCS]** `judicial-case-ai-prompt.md` 신규 생성 — 선생님이 Claude/ChatGPT에 붙여넣는 완성 프롬프트 가이드.
  - 3단계 사용법 (복사→사건입력→업로드) 서두 정리.
  - 전체 프롬프트: ①맥락 설명 + ②[사건 내용] 입력란 + ③작성 요구사항 + ④JSON 스키마.
  - 사건 내용 작성 예시 3가지 (임금체불·환경오염·학교폭력).
  - 항목별 설명 표 (id/title/persona/side/revealedAtStage 등).
  - 업로드 전 체크리스트 (stageGuides 7개·evidence id 순서 등).
- **[DOCS]** `proposal_phase3_judicial_v2.md` §14-4 단순화 — 긴 프롬프트 본문을 `judicial-case-ai-prompt.md`로 이관하고 요약만 남김.

---

## docs — 사법부 제안서 v7: AI 생성 JSON 업로드 방식 (2026-05-25 / [Claude])
- **[DOCS]** `proposal_phase3_judicial_v2.md`를 v6 → v7로 갱신.
  - §14-1 설계 철학: "UI 폼 직접 입력" → "AI로 JSON 생성 후 파일 업로드"로 전면 전환.
  - §14-4 입력 UI: 복잡한 폼 UI 제거 → 프리셋 선택 드롭다운 + JSON 파일 업로드 단순화.
  - AI 프롬프트 템플릿 추가: [스키마 복사하기] 버튼 → AI에 붙여넣기 → JSON 저장.
  - `handleCaseJsonUpload()` 처리 로직: 브라우저 파싱 → 필수 필드 검증 → Firebase 직접 쓰기 (서버 업로드엔드포인트 불필요).
  - 유효성 검사 UI 추가: 항목별 ✅/⚠️ 체크 표시.
  - `validateCaseJson()` 함수 신규 (`judicial-case-data.js`).
- **[DOCS]** task.md v7 기준으로 다음 작업 설명 갱신.

---

## docs — 사법부 제안서 v6: 시나리오 양식 시스템 (2026-05-25 / [Claude])
- **[DOCS]** `proposal_phase3_judicial_v2.md`를 v5 → v6로 갱신. §14 시나리오 양식 시스템 추가.
  - `JudicialCaseTemplate` 스키마 전체 설계 (§14-2): 메타/당사자/죄목/쟁점/증거/증인/모둠별힌트/단계별안내 7개 구역.
  - `PRESET_BYEOLBIT` 완전한 코드 예시 (§14-3): 별빛 편의점 사건을 양식 채운 형태로 문서화.
  - 교사 입력 UI 설계 (§14-4): BranchConfigEditor에서 프리셋 선택 or 직접 입력.
  - 양식→재판 자동 구성 흐름 (§14-5): 7단계별 `activeCase` 데이터 자동 렌더링 명세.
  - Firebase RTDB 저장 구조 (§14-6): `branchConfig/judicial/activeCase` + `activeCaseId`.
  - `judicial-case-data.js` 파일 구조 (§14-7): 스키마 + 5개 프리셋 + 헬퍼.
  - 구현 순서 업데이트 (§14-8): 신규 파일 `JudicialCaseRoom.jsx` 포함.
- **[DOCS]** `task.md` v6 기준으로 다음 작업 설명 갱신.

---

## v1.2.235 — 역할 라벨 구버전 표시 근본 수정 (2026-05-25 / [Claude])
- **[BUGFIX]** 교사용 빠른제어 패널·학생 화면에서 역할명이 "정책기획자" 등 구버전으로 표시되는 문제의 근본 원인을 수정.
  - **원인**: `gameStore.js`에서 Firebase에 저장된 `config.roles`(구버전 빌드 시 저장된 구 라벨)를 그대로 읽어 Zustand state에 반영하고 있었음. `Phase3ExecutiveQuickPanel`, `BranchUnitWorkspace`, `RoleSelfSelector` 등이 이 path를 1순위로 읽으므로 `normalizeRoleList`의 in-memory 업그레이드와 관계없이 구 라벨이 우선 적용됨.
  - **수정**: `gameStore.js` config 로딩 시 `roles` 필드를 항상 `DEFAULT_CONFIG.roles`(현재 코드의 역할 정의)로 고정. Firebase에 저장된 구버전 roles 무시. 역할 템플릿은 코드에서 관리하고, 반별 커스터마이징은 `config.branchConfig.[branch].roles` 경로로만 저장하는 올바른 구조.
- **[BUGFIX]** `BranchUnitWorkspace.mapExecutiveSectionToPolicyFields()`의 `decree` 섹션 매핑 버그 수정. `q(1)` → `fields.ordinance` 쓰기 제거(시행령 최종본 전용 필드와 충돌). fallback 텍스트도 `fields.ordinance` 대신 `fields.content`로 정정.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.235 갱신. 배포 완료.

---

## v1.2.234 — 행정부 역할 시행령 기반 분리 버그 수정 (2026-05-25 / [Claude])
- **[BUGFIX]** `executiveBudgetData.js`의 `EXECUTIVE_ROLE_CARDS`에 구 이름("정책기획관", "자료조사관" 등)이 남아 역할 카드 팝업에 잘못 표시되던 문제 수정. 시행령 조항 기반 4역할(목적·대상 설계원 / 시행 절차 설계원 / 지원 내용 설계원 / 점검·보완 설계원)로 업데이트.
- **[BUGFIX]** `ExecutiveSectionEditor`의 `decree` 섹션(시행 절차 설계원)이 `fields.ordinance` 필드를 "현장 운영 조건"으로 사용하던 문제 제거. `fields.ordinance`는 최종 어셈블러의 "제1조~제5조 시행령 최종본" 전용으로 예약되어 있어 충돌이 발생하고 있었음. decree 섹션을 `fields.content` 단일 필드(제3조 시행 절차)로 단순화.
- **[BUGFIX]** `ExecutiveSectionEditor` 섹션 헤더가 모든 역할에 "📄 시행령·근거 초안 작성"으로 동일하게 표시되어 마치 모든 역할이 시행령을 쓰는 것처럼 보이던 문제 수정 → "📄 {sectionLabel} 초안 작성"으로 역할별 맞춤 표시.
- **[FEATURE]** `ExecutiveFinalAssembler.loadPreviewToEditor()`를 역할중심 모드 전용 조항 조립 로직으로 분기. 역할중심 모드에서 "모둠원 초안 불러와 병합하기" 클릭 시 skeleton(제1·2조) → decree(제3조) → evidence(제4조) → effect(제5조) 순서로 조항 텍스트를 자동 조립해 `fields.ordinance`에 채워 넣음.
- **[UX]** `ExecutiveSectionViewer`가 섹션키별 적절한 필드 레이블(제1조/제2조/제3조/제4조/제5조)을 표시하도록 개선.
- **[BUILD/DEPLOY]** `APP_BUILD` v1.2.234 갱신. 배포 완료.

---

## v1.2.233 — 행정부 역할 안내 문구 평이화 및 역할중심 최종안 수정 UI 분리 (2026-05-25 / [Claude])
- **[COPY]** `scaffolding-data.js`의 행정부 역할(`minister`, `planner`, `investigator`, `analyst`)과 추가 역할(`communicator`, `spokesperson`, `budgetAnalyst`)의 `sectionPlaceholder`, `memoGuide`, `todos`, `budgetSuggestions`, `sosWhen` 문구를 초등 6학년 눈높이로 평이하게 다듬었습니다. "수혜 대상·규제 대상", "재원", "산출", "집행" 등 한자어 표현을 "도움 받을 사람·규칙을 지켜야 할 사람", "예산", "계산", "실제로 진행" 등으로 풀어쓰고 Q1/Q2 형식 질문을 자연스러운 문장으로 바꿨습니다.
- **[FLOW]** 행정부 역할중심 모드의 [최종안 직접 수정하기] 화면이 공동작업 모드와 동일하게 시행령 작성 질문 도우미가 포함된 `ExecutiveGuidedPolicyBuilder`를 노출하던 문제를 분리했습니다. `ExecutiveFinalAssembler`에 `isCollaborative` prop을 추가하여, 역할중심 모드에서는 정책 이름 + 제1~5조 시행령 최종본 textarea + 근거·국민 눈높이·기대 효과 보조 입력 + 예산 통합 편집만 노출하도록 변경했습니다.
- **[UX]** 역할중심 최종안 수정 UI 상단 안내 문구도 "모둠원이 작성한 시행령 조항과 예산 항목을 직접 다듬어 최종안을 완성합니다."로 분리 안내합니다.
- **[BUGFIX]** 문구 일괄 수정 과정에서 발생한 `scaffolding-data.js`의 유니코드/ASCII 따옴표 충돌(JS 파싱 오류)을 Python 파서로 일괄 정리하여 모든 문자열 안 표시용 따옴표를 `\'`로 이스케이프 처리.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.233 갱신.

---

## v1.2.232 — 구버전 역할명 마이그레이션 예외 처리 보완 및 실제 배포 완료 (2026-05-25 / [Antigravity])
- **[BUGFIX]** `scaffolding-data.js`의 `normalizeRoleForKind`에서 1세대 예전 역할명(`총괄 검토원`, `시행령 작성원`, `근거 조사원`, `효과 예측원`)이 새 역할 체계로 자동 보정되지 않던 결함을 발견하고, `LEGACY_EXECUTIVE_DEFAULT_LABELS`에 복수 라벨 배열을 지원하도록 수정하여 마이그레이션 예외 처리를 보완했습니다.
- **[DEPLOY]** Codex 작업본과 신규 패치 내용이 빌드는 되었으나 배포 폴더로 복사되지 않았던 문제를 확인하고, `deploy.sh`를 수동 재실행하여 배포 서버에 실제 반영을 완료했습니다.
- **[BUILD]** `npm run build` 검증 완료. `APP_BUILD` v1.2.232 갱신.

---

## v1.2.231 — 다른 모둠 정책안 제출·예산 청구액 통합 표시 (2026-05-25 / [Codex])
- **[UX]** 행정부 역할중심 오른쪽 패널에서 다른 모둠의 정책안 제출 상태와 예산 청구액을 한 카드 안에 함께 표시하도록 수정했습니다.
- **[DATA]** `OtherGroupsRoleSummary.jsx`의 행정부 정책 요약이 `budgetItems`, 구버전 `budget`, `requestedBudget/draftBudget/finalBudget`을 모두 읽어 총 청구액을 계산하도록 보강했습니다.
- **[LAYOUT]** `BranchUnitWorkspace.jsx`의 별도 `다른 부처 예산 청구 소계` 목록을 제거하여 같은 정보를 두 번 확인하지 않게 했습니다.
- **[PERF]** 중복 표시 제거에 따라 `BranchUnitWorkspace`의 불필요한 `policies` 구독도 정리했습니다.
- **[BUILD]** `npm run build` 검증 완료. `APP_BUILD` v1.2.231 갱신.

---

## v1.2.230 — 행정부 초안 작성 안내 문구 모드별 분리 (2026-05-25 / [Codex])
- **[COPY/UX]** 행정부 ② 초안 작성 영역의 제목과 설명을 공동작업 모드와 역할중심 모드에 맞게 분리했습니다.
- **[COLLAB]** 공동작업 모드에서는 역할 분담 없이 하나의 정책·시행령·예산 템플릿을 함께 읽고 수정하며 완성한다는 안내가 표시됩니다.
- **[ROLE]** 역할중심 모드에서는 각 학생이 맡은 정책 파트와 관련 예산 항목을 저장하고, 저장본이 초안 작업판에 모인 뒤 대표가 최종 정책보고서를 정리한다는 안내가 표시됩니다.
- **[GUIDE]** 상단 행정부 진행 가이드의 ② 단계 설명도 같은 기준으로 함께 정리했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.230 갱신.

---

## v1.2.229 — 행정부 역할중심 역할 선택 보드 상단 배치 (2026-05-25 / [Codex])
- **[LAYOUT]** 행정부 역할중심 모드에서 `역할 선택 및 모둠 현황`을 왼쪽 컬럼에서 빼내어 상단 전체폭 보드로 이동했습니다.
- **[UX]** 역할 카드는 화면 폭에 따라 4개 한 줄 또는 2x2 형태로 정렬되며, 담당자·진행률·역할 선택 버튼을 한 카드 안에서 확인할 수 있게 유지했습니다.
- **[BALANCE]** 하단 좌우 컬럼은 왼쪽 `역할별 섹션 초안`, 오른쪽 `예산 청구 및 편성/다른 모둠 현황` 중심으로 남겨 좌우 높이와 기능 균형을 맞췄습니다.
- **[SAFE]** 공동작업모드는 수정하지 않았고, 행정부 역할중심 화면 배치만 조정했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.229 갱신.

---

## v1.2.228 — 행정부 역할별 정책 파트·예산 동시 작성 구조 반영 (2026-05-25 / [Codex])
- **[FLOW]** 행정부 역할중심 기본 4역할을 `배경·필요성 작성원`, `시행령·집행계획 작성원`, `시민영향·대응 작성원`, `기대효과·점검 작성원`으로 정리했습니다.
- **[PEDAGOGY]** 예산을 한 명이 몰아서 작성하지 않고, 4명 모두 자기 정책 파트와 연결된 예산 항목을 1개 이상 작성하도록 역할 안내와 할 일 문구를 수정했습니다.
- **[OPTIONAL ROLE]** 5명 이상 모둠에서 활용할 수 있는 `예산 조율원`은 `예산 검토원`으로 바꾸어, 예산 작성자가 아니라 중복·산출식·총액을 점검하는 보조 역할로 명확히 했습니다.
- **[UX]** `우리 부처 통합 정책·예산안 초안 미리보기`는 최종 보고서처럼 정리된 카드가 아니라, `1. 배경과 필요성 → 2. 시행령과 집행계획 → 3. 국민 눈높이 반영 → 4. 기대효과와 점검` 순서로 초안 내용을 펼쳐 보여주는 작업판으로 변경했습니다. 정리된 정책보고서 형태는 대표 최종 검토 창에서만 유지됩니다.
- **[SAFE]** 확정된 공동작업모드는 수정하지 않았고, 행정부 역할중심 모드의 역할 안내·자동 조립 미리보기 표현만 조정했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.228 갱신.

---

## v1.2.227 — 행정부 역할중심 통합 정책·예산안 미리보기판 개선 (2026-05-25 / [Codex])
- **[FLOW]** 행정부 역할중심 모드에서 학생 개인의 원문 초안만 보이던 하단 미리보기를 제거하고, 같은 부처의 모든 역할 저장본을 정책보고서 양식으로 자동 조립하는 `우리 부처 통합 정책·예산안 초안 미리보기`로 교체했습니다.
- **[DATA]** 역할별 Q&A 저장본(`skeleton`, `decree`, `evidence`, `effect`, `discussion`, `risks`, `budget`)을 정책명·문제/목적·대상 시민·시행령·근거·국민 눈높이 반영·기대효과·토론 대비책·예산 항목으로 매핑하는 변환 로직을 `BranchUnitWorkspace.jsx`에 추가했습니다.
- **[REAL-TIME]** 같은 부처 학생에게는 역할 저장본과 대표 최종 검토본이 실시간으로 보이되, 대표 편집 자동 저장 디바운스를 1초로 조정해 Firebase 쓰기량을 줄였습니다. 다른 부처는 저장/제출 후 결과만 보는 기존 흐름을 유지합니다.
- **[UX]** 통합 미리보기판에 역할별 반영 상태 카드를 추가해 어느 역할의 초안이 정책·예산안에 들어왔는지 즉시 확인할 수 있게 했습니다.
- **[SAFE]** 사용자가 확정한 행정부 공동작업모드는 수정하지 않았고, 이번 변경은 행정부 역할중심 모드의 조립·미리보기·대표 검토 흐름에만 적용했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.227 갱신.

---

## v1.2.226 — 교사용 행정부 역할중심 현황판 policyFields 타입 오류 수정 (2026-05-24 / [Codex])
- **[BUGFIX]** 교사용 행정부 빠른 제어 패널에서 역할별 초안 진행 상태를 계산할 때 `policyFields` 값을 모두 문자열로 가정해 `.trim()`을 호출하던 문제를 수정했습니다.
- **[SAFE]** 역할중심 모드의 섹션 저장 데이터에는 `qna`, `links`, 예산 관련 객체처럼 배열/객체 값이 들어갈 수 있으므로, 문자열·숫자·배열·객체를 모두 안전하게 검사하는 `hasMeaningfulValue` 헬퍼를 추가했습니다.
- **[SCOPE]** 공동작업모드에는 변경을 넣지 않았고, 교사용 역할중심 현황 표시가 저장 데이터 타입 때문에 깨지지 않도록 방어했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.226 갱신.

---

## v1.2.225 — 행정부 역할중심 모드 TDZ 런타임 오류 핫픽스 (2026-05-24 / [Codex])
- **[BUGFIX]** `BranchUnitWorkspace.jsx` 역할중심 화면에서 대표 최종 편집/미리보기 영역 렌더링 시 빌드 번들의 초기화 순서가 꼬이며 발생하던 `ReferenceError: Cannot access 'ze' before initialization` 계열 오류를 최신 소스 기준으로 재빌드해 차단했습니다.
- **[BUGFIX]** 역할별 진행률 계산(`statusProgressByRole`)이 내부 객체를 만들고도 반환하지 않아 역할 카드 진행률과 현황판이 빈 값으로 흐를 수 있던 문제를 `return byRole`로 수정했습니다.
- **[SAFE]** 사용자가 확정한 행정부 공동작업모드는 건드리지 않았고, 역할중심 모드의 런타임 안정성과 진행률 표시만 보강했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.225 갱신.

---

## v1.2.224 — 전역 상수 및 헬퍼 함수 컴포넌트 내 인라인 이전 (2026-05-24 / [Antigravity])
- **[BUGFIX]** `BranchUnitWorkspace.jsx`에서 `STEP_LABELS`, `COLLAB_STEP_LABELS`, `SECTION_META`, `isValidUrl`, `getText`, `contentReadinessScore` 등이 모듈 전역 상수로 선언되어 있어 빌드 과정에서 최적화 재정렬 시 호이스팅 순서가 뒤틀려 발생했던 `ReferenceError: Cannot access 'Pe' before initialization` 에러를 완전히 해결했습니다.
- **[SAFE]** 이 상수들과 헬퍼 함수들을 `BranchUnitWorkspace` 컴포넌트 내부 최상단 스코프로 인라인 이전함으로써, 번들링 압축 시 발생하던 TDZ(Temporal Dead Zone) 참조 오류를 원천 차단했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.224 갱신.

## v1.2.223 — 번들러 호이스팅 TDZ ReferenceError 핫픽스 (2026-05-24 / [Antigravity])
- **[BUGFIX]** `BranchUnitWorkspace.jsx`에서 `emptyPolicyFields`가 모듈 전역 스코프에 선언되어 있어, Vite/Rolldown 번들러가 컴포넌트 렌더링 코드를 난독화 및 정렬할 때 호이스팅 순서가 뒤틀려 발생했던 `ReferenceError: Cannot access 'Ne' before initialization` 런타임 차단 에러를 해결했습니다.
- **[SAFE]** `emptyPolicyFields` 정의를 `mergedFinalDoc` `useMemo` 내부의 로컬 상수로 봉인하여, 모듈 로딩 및 번들링 배치 순서와 무관하게 렌더링 시점에 항상 안전하게 초기화되고 참조될 수 있도록 조치했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.223 갱신.

## v1.2.222 — 대표 수정 상황 실시간 자동 중계 구현 (2026-05-24 / [Antigravity])
- **[FLOW/REAL-TIME]** 대표가 최종안 직접 수정기(`ExecutiveFinalAssembler` 또는 기본 법안 편집기)에서 텍스트를 고치거나 예산안을 조율할 때, 대표의 키보드 타이핑이 400ms 멈추면 조용히 DB에 임시 저장(Auto-save)되도록 디바운스 및 딥 이퀄(Deep Equality) 비교 로직을 추가했습니다.
- **[UX]** 이로써 대표가 수동으로 [임시 저장] 버튼을 매번 누르지 않더라도, 다른 부서원들에게 대표가 실시간으로 문서를 작성하고 고치는 모습이 읽기 전용 뷰어에 실시간으로 전파되는 완벽한 상호작용 흐름을 보장했습니다.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.222 갱신.

## v1.2.221 — 대표 최종 검토 실시간 모둠원 초안 자동 머지 및 동기화 개선 (2026-05-24 / [Antigravity])
- **[FLOW/REAL-TIME]** 행정부 역할중심 모드에서 대표가 임시저장하기 전이거나 수정하지 않은 필드가 있을 때, 다른 모둠원들이 작성한 실시간 초안(`sections`)이 자동으로 병합되어 "실시간 반영본"에 표시되도록 개선.
- **[FLOW]** 대표가 최종 조립기(`ExecutiveFinalAssembler`)를 미리보기 모드로 볼 때도 모둠원들의 실시간 저장 내용이 병합되어 보이며, 편집 모드(`isEditing`)가 아닐 때는 모둠원들의 저장 시 실시간 동기화되도록 연동.
- **[COMPAT]** 일반/입법부/사법부 역할중심 모드에서도 대표가 병합하기 전의 텍스트 필드를 실시간 병합하여 보여줄 수 있도록 `mergedFinalDoc` 공통 로직을 `BranchUnitWorkspace`에 통합 연동.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.221 갱신.

## v1.2.220 — 학생용 내 역할 정책안 초안 미리보기 카드 추가 (2026-05-24 / [Antigravity])
- **[UX/UI]** 역할중심 모드에서 비대표(일반 모둠원) 학생 화면 하단에 **[내 역할 정책안 초안 미리보기]** 카드를 신설.
- **[FLOW]** 자신이 미션을 완료하여 [내 역할 초안 및 예산 저장]을 누르면, 최종 보고서(정책안) 포맷으로 변형된 자신의 담당 섹션 내용(Q&A 답변 병합 텍스트, 등록한 참고 자료, 내 역할 청구 예산 명세서 및 소계액)을 대표 최종 검토 카드 바로 위에서 실시간으로 확인 가능하도록 구현.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.220 갱신.

## v1.2.219 — 행정부 대표 최종 검토 실시간 읽기 전용 뷰 연동 (2026-05-24 / [Antigravity])
- **[FLOW/UX]** 행정부 역할중심 모드에서 장관(대표)이 최종안을 수정할 때, 부서원 학생들에게 노출되던 기존의 불투명한 대기 상태 카드 대신 **실시간 읽기 전용 뷰어(`ExecutiveFinalViewer`)**를 노출하도록 개편.
- **[REAL-TIME]** 장관이 최종 템플릿을 수정하고 임시 저장할 때마다 다른 모둠원 화면에서 "장관 검토 중 (실시간)" 배지와 안내 문구가 활성화되며 실시간으로 수정안을 읽기 전용으로 추적할 수 있도록 동기화.
- **[BUILD/DEPLOY]** `npm run build` 검증 및 빌드·배포 완료. `APP_BUILD` v1.2.219 갱신.

## v1.2.218 — 행정부 역할중심 모드 역할선택 & 모둠현황 UI/UX 통합 (2026-05-24 / [Antigravity])
- **[UX/UI]** 역할 선택(`RoleSelfSelector`)과 모둠 역할 현황(`GroupRoleSummary`) 카드를 하나의 유기적인 카드 목록 UI로 통합 개편.
- **[FLOW]** 역할별 카드 내부에서 각 역할의 세부 가이드, 실시간 작성 진행률(%) 및 진행 바, 담당 학생 배정 정보(`claimedBy`)를 함께 보여주고, 바로 `[나 맡을게요] / [취소]` 버튼을 노출하여 단일 공간에서 배정 현황 확인과 역할 선택이 가능하도록 구현.
- **[COMPAT]** 비행정부 역할 모드 및 공동작업 모드의 구조에 악영향을 주지 않도록 완벽 분리 적용.
- **[BUILD]** `npm run build` 검증 및 `APP_BUILD` v1.2.218 갱신 후 배포 완료.

## v1.2.217 — 행정부 역할중심 모드 2컬럼 레이아웃 전면 개편 및 2단계 간소화 (2026-05-24 / [Antigravity])
- **[FLOW]** 기존 분리되어 있던 '메모 제출'과 '역할 섹션 다듬기' 단계를 하나로 단일화하여 2단계 흐름(1단계 초안/예산 청구 작성 -> 2단계 대표 최종 확정)으로 간소화.
- **[LAYOUT]** 행정부 역할중심 모드일 때 좌/우 2컬럼 및 하단 조립기 형태의 전용 화면 배치 설계 적용:
  - **좌측**: 역할 선택기 + 우리 모둠 역할 배정 현황판 + Q&A 형식 초안 작성 폼 + 출처 링크 등록기 통합 배치.
  - **우측**: 예산 청구 및 편성 매니저 + 다른 모둠 역할/예산 정책 현황 요약판 배치.
  - **하단**: 장관(대표)용 최종 조립기(`ExecutiveFinalAssembler`) 및 일반 부서원 검토 알림창/최종본 뷰어 배치.
- **[DATA]** `sections/{mySection}` 데이터에 질문 답변(`qna`), 병합된 text, 출처 links, 그리고 예산 항목(`budgetItems`)이 한 번에 묶여 저장되도록 `saveExecutiveSection` 동기화 및 2단계 삭제에 따른 병합 프로세스 검증 완료.
- **[BUILD]** `npm run build` 성공 및 `app/deploy.sh`를 통한 배포 완료. `APP_BUILD` v1.2.217 갱신.

## v1.2.216 — 행정부 역할중심 모드 사용자 요청 워크플로우 완벽 이식 (2026-05-24 / [Antigravity])
- **[FLOW]** 행정부 역할중심 모드 1단계 메모 작성을 건너뛰지 않고 거치도록 복구.
- **[UX]** 메모 작성란을 역할별 개별 질문 답변(Q&A) 양식으로 고도화하고, 2단계 초안 에디터에서 [내 메모 가져오기] 클릭 시 각 답변들이 알맞은 초안 필드로 자동 매핑되어 채워지는 지능형 연동(Mapping) 구현.
- **[UX]** 3단계 최종 조립기(`ExecutiveFinalAssembler`)를 미리보기와 수정 모드로 이중화하여, 미리보기를 하다가 [수정하기]를 누르면 공동작업모드와 완벽히 호환되는 빌더 및 예산 매니저 폼에서 직접 편집하고 [완료] 시 미리보기로 회귀하는 흐름 구현.
- **[DATA]** 최종 제출 시 `policies/{groupId}`에 저장되는 데이터 포맷을 공동작업모드의 정책예산 템플릿과 완벽히 동일하게 일치시켜 후속 평가/토론 탭과 정합성 연동 완료.
- **[BUILD]** `npm run build` 성공 및 `app/deploy.sh`를 통한 배포 완료. `APP_BUILD` v1.2.216 갱신.

## v1.2.215 — 행정부 역할중심 모드 워크플로우 개편 제안서 작성 (2026-05-24 / [Antigravity])
- **[DOCS]** `docs/proposal_executive_workflow.md` 문서를 생성하여 역할중심 모드의 미션 중심 단일 편집기 통합, 총괄 검토원 최종 조립/편집 활성화, 교사 현황판 등 주요 개편 내용과 데이터 연동 로직을 문서로 요약.

## v1.2.214 — 예산 입력창 너비 확장 및 공동작업 모드 전환 오류 수정 (2026-05-24 / [Antigravity])
- 예산 계산 및 편성 시 '억' 단위 결과값 칸 너비를 늘려 큰 금액도 잘 보이도록 수정 (`grid-cols` 및 `w-16` 조정)
- 행정부 교사용/학생용 `ExecutiveTab`에서 공동작업/역할중심 모드 전환 시, 중복되거나 분절된 렌더링 로직(`roleBasedDraftUnits`, `collaborativeDraftUnits`)을 하나로 통합하여 공동작업 모드로 스위칭할 때 올바르게 `BranchUnitWorkspace`가 나오도록 수정

## v1.2.213 — 예산 계산기 버그 수정 및 내 메모 가져오기 버튼 추가 (2026-05-24 / [Antigravity])
- 예산 계산기 적용 시 새 예산 항목이 목록에 반영되지 않던 버그 수정
- 역할별 섹션(근거/효과/토의/부작용) 초안 작성 시 본인이 작성한 메모 카드의 내용을 바로 불러올 수 있는 [내 메모 가져오기] 버튼 추가

## v1.2.212 — 교사 패널 행정부 역할중심 현황판 컴팩트(가로) 뷰 적용 (2026-05-24 / [Antigravity])
- 부처별 역할 목록을 가로 한줄(grid)로 보여주도록 변경하여 스크롤 압박 해소

## v1.2.211 — 교사 패널에 부처/역할별 실시간 진행 현황판 추가 및 옛 역할 꼬임 방어 (2026-05-24 / [Antigravity])

- **[DASHBOARD]** `Phase3ExecutiveQuickPanel.jsx`: 공동작업모드와 역할중심모드별로 부처의 실시간 작성 현황을 모니터링할 수 있는 현황판 영역을 추가. 공동작업모드에서는 4대 섹션 및 예산청구 상태를, 역할중심모드에서는 각 역할별 배정된 학생 이름과 1단계 메모 및 2단계 초안 저장 완료 여부를 실시간 배지로 모니터링 가능.
- **[BUGFIX]** `RoleSelfSelector.jsx`, `BranchUnitWorkspace.jsx`: `myRoleKey` 및 역매핑(`claimedBy`) 처리 시, DB에 예전 버전 역할 키(예: `minister` 등)가 남아있어 현재 역할 정의(`roles`)와 매치되지 않을 때 역할 변경(취소) 및 초안 편집이 차단되던 문제를 방지하기 위해, 현재 목록에 정의된 역할인 경우만 유효한 `myRoleKey`로 필터링하도록 수정하여 정상 변경 가능하도록 보정.
- **[UX]** `BranchUnitWorkspace.jsx`: 교사가 역할을 잠갔을 때 학생 화면 역할 선택 패널 상단에 역할 잠금 상태를 직관적으로 알려주는 경고 배너 렌더링 추가.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.211 갱신.

## v1.2.210 — 행정부 역할 할일 노출 버그 수정 및 교사 역할 잠금/초기화 기능 추가 (2026-05-24 / [Antigravity])

- **[BUGFIX]** `BranchUnitWorkspace.jsx` L140~150: 내 역할 키(`myRoleKey`)를 학생의 소속 모둠(`myGroupId`) 기준으로 찾던 로직을 역할 선택 정보가 저장되는 `unitGroupId` 기준으로 조회하도록 버그 수정. 이로써 역할 배정 완료 시 왼쪽에 역할별 할 일 목록(todos)이 정상 노출됨.
- **[FEATURE]** `Phase3ExecutiveQuickPanel.jsx`: 준비 단계(stage 0) 및 역할중심 모드에서 학생들의 역할 선택을 강제 잠금할 수 있는 '역할 잠금/해제' 기능과 배정된 모둠원 역할을 일괄 취소하는 '역할 전체 초기화' 버튼 기능 추가.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.210 갱신.

## v1.2.209 — 교사 학급설정 오류 3건 수정 (2026-05-24 / [Antigravity])

- **[BUGFIX]** `BranchConfigEditor.jsx` L262, L322: 역할 예시 자료 패널과 역할 칩 툴팁 두 곳에서 `todos` 항목이 `{ label, hint }` 객체인데 `{t}` 직접 렌더링으로 React `Objects are not valid as a React child` 오류 발생하던 문제 수정. `typeof t === 'object' ? t?.label : t` 분기 처리.
- **[BUGFIX]** `ExecutivePolicyBudgetDraft.jsx` `ExecutiveFinalAssembler`: `patchFields` 함수가 선언되지 않아 역할중심 최종 조립 단계에서 법령 선택 시 `TypeError: patchFields is not a function` 오류 발생하던 문제 수정. `patchField`와 함께 `patchFields(updates)` 함수 추가.
- **[BUGFIX]** `ExecutivePolicyBudgetDraft.jsx` `ExecutiveBudgetEditor`: `useMemo` 내부에서 `useGameStore.getState()` 직접 호출로 `branchConfig` 변경 시 `unitId` 재계산이 되지 않던 비반응형 버그 수정. `useGameStore((s) => s.config?.branchConfig?.executive?.units)` selector로 교체.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.209 갱신.

## v1.2.208 — 행정부 기대효과를 국민 눈높이 반영에 통합 (2026-05-24 / [Codex])

- **[FLOW]** `ExecutivePolicyBudgetDraft.jsx`: 독립 `기대 효과/홍보 대책` 입력칸을 제거하고 `ExecutivePublicEyeSection` 안에 `기대 효과 및 홍보에 쓸 표현` 입력칸을 추가. 근거·피해/대응·기대효과/홍보를 국민 눈높이 반영으로 한 묶음 처리.
- **[DISPLAY]** `ExecutivePolicyDiscussionList.jsx`, `ExecutiveBudgetReviewBoard.jsx`, 최종 제출 뷰에서 기대효과가 별도 카드가 아니라 `국민 눈높이 반영` 안에 표시되도록 보정.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.208 갱신.

## v1.2.207 — 행정부 통계/근거 배치 조정 (2026-05-24 / [Codex])

- **[LAYOUT]** `ExecutivePolicyBudgetDraft.jsx`: `~국 통계` 영역을 정책·시행령 질문 도우미 위에서 제거하고 예산안 작성 영역으로 이동. 통계는 예산 산출과 대상 규모 판단에 쓰이도록 예산안 초안 작성란에서 보이게 정리.
- **[FLOW]** `필요 근거 및 사례` 입력칸을 독립 칸에서 `국민 눈높이 반영` 섹션 내부로 이동. 시행령의 구체적 근거이자 국민 설득 자료로 함께 작성하도록 구조화.
- **[DISPLAY]** `ExecutivePolicyDiscussionList.jsx`, `ExecutiveBudgetReviewBoard.jsx`, 최종 제출 뷰에서 `필요 근거 및 사례`가 `국민 눈높이 반영` 안에 함께 표시되도록 보정.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.207 갱신.

## v1.2.206 — 행정부 통계 영역 countryName ReferenceError 핫픽스 (2026-05-24 / [Codex])

- **[BUGFIX]** `ExecutivePolicyBudgetDraft.jsx`: `ExecutiveGuidedPolicyBuilder` 내부에서 `countryName`을 사용하지만 props destructuring에 선언하지 않아 발생한 `ReferenceError: countryName is not defined`를 수정. 기본값 `축소국`을 추가해 부모가 값을 넘기지 않아도 안전하게 렌더링되도록 처리.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.206 갱신.

## v1.2.205 — 행정부 축소국 통계와 국민 눈높이 반영 칸 추가 (2026-05-24 / [Codex])

- **[STATS]** `ExecutivePolicyBudgetDraft.jsx`: 정책·시행령 작성 템플릿 위에 `~국 통계` 접기 영역 추가. `BIBIM_STATS`를 카드로 보여주고 새창 통계 보기 버튼을 제공.
- **[COPY/FLOW]** 초안 단계의 `온라인 정책토의 의견 반영` 칸 제거. 온라인 정책토의와 국무회의 반영은 기존 `ExecutivePolicyFinalEdit` 최종 수정 페이지에서 작성하도록 역할 분리.
- **[UX]** `ExecutivePublicEyeSection` 추가: `예상되는 피해나 손해보는 시민·분야`, `그 걱정에 대한 대응 방법` 입력칸으로 국민 눈높이 반영을 작성.
- **[SAVE]** `국민 눈높이 반영 저장` 버튼 추가. 공동작업 모드에서는 기존 구역별 중간 저장 구조를 사용해 `publicEye` 파트로 저장하고, 평가단/대통령 모둠이 중간 공개 내용을 볼 수 있게 함.
- **[DISPLAY]** `ExecutivePolicyDiscussionList.jsx`, `ExecutiveBudgetReviewBoard.jsx`: 정책토의 목록과 예산 초안 검토 전광판에 `국민 눈높이 반영` 내용을 표시.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.205 갱신. 사용자 요청에 따라 브라우저 검토는 수행하지 않음.

## v1.2.204 — 행정부 시행령 3단 접기 및 중간 저장 복구 (2026-05-24 / [Codex])

- **[UX]** `ExecutivePolicyBudgetDraft.jsx`: 시행령 작성 도우미를 `1. 입법내용 확인`, `2. 질문에 답하며 시행령 재료 만들기`, `3. 시행령 초안 미리보기와 최종안 다듬기`의 3개 접기 구역으로 재구성.
- **[SAVE]** 각 구역에 `입법내용 확인 저장`, `질문 답변 저장`, `시행령 초안 저장` 버튼 추가. 공동작업 모드에서는 구역 저장 시 `branchDrafts/{unitId}/finalDoc`와 `policies/{groupId}`를 함께 갱신.
- **[EVALUATOR]** 구역별 저장본은 `policies/{groupId}`에 `status: saved`로 공개되어 평가단/대통령 모둠이 발의 전 중간 내용을 읽고 기사·브리핑을 준비할 수 있음.
- **[SAFE]** 이미 `submitted`, `requested`, `adjusted`, `final` 상태인 정책은 구역 저장으로 `saved` 상태로 강등하지 않도록 보존.
- **[ROLE]** 역할중심 최종 조립 폼도 동일한 3단 접기 UI를 사용하며, `savedSections`와 `lastSavedPart`로 어느 구역이 저장되었는지 남김.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.204 갱신. 사용자 요청에 따라 브라우저 검토는 수행하지 않음.

## v1.2.203 — 행정부 시행령 질문형 자동 조립 도우미 복구 (2026-05-24 / [Codex])

- **[UX]** `ExecutivePolicyBudgetDraft.jsx`: 공동작업 최종 템플릿과 역할중심 최종 조립 폼에 `ExecutiveGuidedPolicyBuilder`를 추가. 학생이 빈 시행령 칸에 바로 쓰지 않고 `입법내용 확인 → 질문 답변 → 시행령 초안 자동 조립 미리보기 → 최종안 반영` 순서로 작성하도록 복구.
- **[LAW]** 가결 법령(`bills` 중 `status === 'passed'`) 선택 UI를 추가하고, 선택한 법령의 제목과 본문을 `policyFields.linkedBillId/linkedBillTitle/linkedBillBody`에 연결.
- **[RESEARCH]** 정책·시행령 작성 폼 내부에 `ResearchReferencePanel(contextKey="phase3_executive")`를 배치해 준비 단계에서 모은 자료와 떠오른 아이디어를 보면서 질문에 답할 수 있도록 보강.
- **[SAFE]** 자동 조립 미리보기는 `ordinance`를 즉시 덮어쓰지 않는다. 학생이 `미리보기를 최종안에 반영`을 눌러야 들어가며, 기존 최종안이 있으면 확인 후 덮어쓴다.
- **[DATA]** 새 저장 경로를 만들지 않고 기존 `policyFields` 및 `budgetItems` 구조를 유지해 기존 방 데이터와 호환.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.203 갱신.

## v1.2.202 — 행정부 공동작업/역할중심 작성 시스템 분리 및 기존 저장본 복구 (2026-05-24 / [Codex])

- **[FLOW]** `ExecutiveTab.jsx`: 행정부 공동작업 모드에서는 학생이 최종 정책·시행령·예산 템플릿을 직접 작성하고, 역할중심 모드에서는 `BranchUnitWorkspace`로 역할별 섹션 초안을 작성하도록 화면 분기를 명확히 분리. 두 작업공간이 같은 단계에 동시에 노출되지 않도록 정리.
- **[COMPAT]** `ExecutivePolicyBudgetDraft.jsx`: 기존 반 데이터가 `policies/{groupId}`에만 남아 있어도 공동작업 템플릿에 정책명, 시행령, 집행계획, 기대효과, 예산 항목을 복구해 보여주도록 정규화 함수 추가.
- **[SAFETY]** 빈 `branchDrafts/{unitId}/finalDoc`가 `locked` 상태로 남아 있어도 실제 내용이 없으면 제출완료 화면으로 막지 않고, 의미 있는 `policies/{groupId}` 저장본을 우선 사용하도록 방어.
- **[ROLE]** `BranchUnitWorkspace.jsx`: 역할중심 섹션 저장 완료 판정을 단순 `data.text` 길이가 아니라 구조화 필드와 예산 항목까지 포함해 계산하도록 보완.
- **[VERIFY]** `demo24` 실제 학생 화면(4번 최지우/함께마을)에서 `청년주거안정정책`, 시행령, 예산 항목 30억이 공동작업 폼에 복구되는 것을 확인. 검증 중 저장/제출/삭제는 수행하지 않음.
- **[BUILD]** `npm run build` 통과 및 `app/deploy.sh`로 배포 완료. `APP_BUILD` v1.2.202 갱신.

## v1.2.201 — 행정부 역할중심 4역할 작성 체계 및 역할 스키마 정규화 (2026-05-24 / [Codex])

- **[ROLE]** `scaffolding-data.js`: 행정부 기본 역할을 입법부와 같은 `~원` 작성 중심 체계로 재정렬. 기본 4역할은 `총괄 검토원`, `시행령 작성원`, `근거 조사원`, `효과 예측원`이며, 네 역할 모두 정책 문단과 예산 항목을 함께 작성하도록 역할 설명·todo·메모 가이드를 보강.
- **[CONFIG]** `DEFAULT_ROLE_EXAMPLES.executive` 신설: `의견 수렴원`, `부작용 예측원`, `예산 조율원`을 기본 학생 역할에서 제외하고, 학급설정의 `역할 예시 자료`에서 교사가 필요할 때 추가할 수 있는 확장 역할로 분리.
- **[SAFETY]** `normalizeRoleForKind`, `normalizeRoleList` 추가 및 `BranchUnitWorkspace`, `RoleSelfSelector`, `RoleAssigner`, `RoleWorkspace`, `GroupRoleSummary`, `RoleCard`에 적용. 교사 편집 저장 과정에서 `key/label/assignedSection/isRepresentative` 필드가 일부 빠진 기존 역할 데이터도 기본 스키마에서 복원되도록 안정화.
- **[FLOW]** `ExecutiveTab.jsx`: 역할중심 행정부 학생 화면에서는 자기 부처 `BranchUnitWorkspace`만 `executive-roles`/`executive-budget` 단계에 표시하고, 기존 통합 정책 폼은 공동작업 모드 학생 화면에만 노출되도록 분리해 현재 단계 게이팅을 복구.
- **[BUILD]** `npm run build` 통과 및 `bash deploy.sh`로 배포 완료. `APP_BUILD` v1.2.201 갱신.

## v1.2.200 — 사법부 6단계 워크플로 확장 및 교사/학생 UI 통합 (2026-05-23 / [Antigravity])

- **[NEW]** `Phase3JudicialQuickPanel.jsx` 신설: Pattern C Rose/Crimson 테마 dot progress bar, NPC 사건 프리셋 투입, 모의재판 토론 세션 자동 생성, 실시간 배심원 평결 바, 판결문 조회 기능 포함.
- **[MODIFY]** `PhaseWorkflow.jsx`: 사법 단계를 6개 하위 단계(`judicial-prep`~`judicial-verdict`)로 세분화, `⚖️ 사법부 활동 진행` 그룹 렌더링 추가.
- **[MODIFY]** `TeacherDashboard.jsx`: `Phase3JudicialQuickPanel` 임포트 및 judicial step 조건부 렌더링 추가.
- **[MODIFY]** `JudicialTab.jsx`: `useWorkflow` 기반 6단계 게이팅(`STAGE_OF_STEP` + `modeFor`) 및 `scrollIntoView` 자동 스크롤 이식. LegislativeTab 대칭 구조.
- **[BUILD]** 빌드 및 배포 완료. `APP_BUILD` v1.2.200 갱신.

## v1.2.199 — 행정부 컴포넌트 변수 참조 순서 에러(ReferenceError) 해결 (2026-05-23 / [Antigravity])

- **[BUGFIX]** `BranchUnitWorkspace.jsx`: `unitGroupId` 변수가 `branchRoles` `useMemo` 내부에서 선언 및 초기화되기 전에 사용되어 런타임에서 `ReferenceError: Cannot access 'E' before initialization` 에러를 유발하던 현상을 해결하기 위해 `unitGroupId` 선언 위치를 `branchRoles` `useMemo`보다 앞서 정의하도록 이동.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.199 갱신.

## v1.2.198 — 행정부 4인 모둠 기준 역할 목록 동적 필터링 구현 (2026-05-22 / [Antigravity])

- **[FLOW/COLLAB]** `BranchUnitWorkspace.jsx`, `RoleSelfSelector.jsx`, `RoleAssigner.jsx`: 행정부(`executive`) 모둠에서 멤버 수(최소 4명)에 따라 역할 목록을 동적으로 슬라이싱하는 `useMemo` 로직을 추가. 이를 통해 4인 기본 모둠일 때 5~6인용 역할(부작용 예측원, 예산 조율원)이 배정 셀렉터 및 섹션 초안 단계에서 깔끔하게 노출 제외되어 4인 배정이 완성도 있게 굴러가도록 보완.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.198 갱신.

## v1.2.197 — 평가단 별점 입력 컴팩트 레이아웃 퍼짐 현상 개선 (2026-05-22 / [Antigravity])

- **[UI/COMPACT]** `SpeechEval.jsx`: 평가 대상이 2명 등 소수일 때 카드의 가로폭이 넓어짐에 따라 별 다섯 개 입력창이 과도하게 벌어지던 레이아웃(`justify-between`)을 `justify-center gap-1`로 수정. 이로써 카드의 넓이에 상관없이 별점 버튼들이 중앙에 콤팩트하게 모여 미려한 디자인을 유지하도록 개선.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.197 갱신.

## v1.2.196 — 교사 대시보드 대상 편집 실시간 전파 보완 (2026-05-22 / [Antigravity])

- **[FLOW/SYNC]** `TeacherDebateControl.jsx`: 교사가 설정창에서 평가 대상 수(`evalCount`)나 대상 이름(`evalNames`/`roundEvalTargets`)을 편집하는 즉시, 이미 노출 중인 활성 평가 데이터(`speechEvals/{evalId}`)의 `targets` 및 `targetLabel`도 Firebase RTDB에 실시간 반영하도록 `updateStageField` 로직을 보완. 이로써 학생창 새로고침 없이 교사의 설정 변경이 실시간으로 별점 카드 수에 즉각 전달됨.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.196 갱신.

## v1.2.195 — 토론도구 평가 대상 실시간 동기화 개선 및 리마운트 처리 (2026-05-22 / [Antigravity])

- **[FLOW/SYNC]** `DebateToolPanel.jsx`: 학생 화면의 토론 도구 실시간 평가 입력부 및 누적 결과 컴포넌트 호출부에 대상 정보가 포함된 고유 `key`(`key={`${item.id}_${JSON.stringify(item.targets || [])}`}`)를 적용. 교사가 평가 대상을 실시간으로 편집했을 때 학생창 새로고침 없이 React 컴포넌트가 강제 리마운트(Remount)되어 즉시 동기화되도록 개선.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.195 갱신.

## v1.2.194 — 토론도구 평가단 별점 크기 전면 소형화 및 컴팩트 디자인 매칭 (2026-05-22 / [Antigravity])

- **[UI/COMPACT]** `SpeechEval.jsx`: 4열 배치 카드에 맞추어 `StarInput` 내의 별 크기를 `text-xs sm:text-sm`로, 버튼 내 패딩을 `p-0.5`로 대폭 축소하여 컴팩트한 비주얼 톤을 완성.
- **[UI/LAYOUT]** `SpeechEval.jsx`: 별 크기가 줄어듦에 따라 `isCompact` 내부 간격을 촘촘히 조율하고, `MultiTargetInputCard` 내부 패딩 및 textarea 텍스트 크기 조정을 고도화하여 전체 요소의 크기 밸런스를 통일감 있게 보정.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.194 갱신.

## v1.2.193 — 토론도구 평가단 다중 대상 실질 4열 배치 보장 및 터치 친화적 세로 컴팩트 별점 적용 (2026-05-22 / [Antigravity])

- **[UI/LAYOUT]** `SpeechEval.jsx`: 다중 평가 대상 4열 배치 활성화 시점을 기존 `md` 브레이크포인트에서 `sm`(`sm:grid-cols-4`, 640px 이상)으로 낮추어 태블릿 세로/가로 모드 및 일반 줌 브라우저에서 실질적 4열 레이아웃(가로로 4개 나란히)을 보장.
- **[COMPACT]** `SpeechEval.jsx`: 좁아지는 4열 카드 너비(약 150px~170px)에 대응하기 위해 `StarInput`에 `isCompact` 세로 누적형 레이아웃을 전면 적용. 라벨과 점수를 위아래로 쌓아 가로폭 깨짐을 방지하고, 별점 크기를 모바일 터치에 대응하여 큼직하게 유지하되 `justify-between` 배치로 가독성 확보.
- **[UI/TEXTAREA]** `SpeechEval.jsx`: 다중 입력 카드 내 textarea 배경에 연한 그레이 톤을 적용하고, 코멘트 미작성 시 "필수 입력" 시각적 힌트를 붉은색으로 표기하여 미입력 카드가 있음을 한눈에 알아볼 수 있도록 보완.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.193 갱신.

## v1.2.192 — 토론도구 평가단 다중 대상 반응형 4열 배치 적용 및 내부 요소 컴팩트화 (2026-05-22 / [Antigravity])

- **[UI/LAYOUT]** `SpeechEval.jsx`: 평가단 다중 대상 입력 및 결과 화면을 2x2 또는 1열 고정이 아닌, 대상 수에 맞춰 반응형 4열(`grid-cols-1 sm:grid-cols-2 md:grid-cols-4` 등)로 자동 배치하는 `targetGridClass`를 연동.
- **[COMPACT]** `SpeechEval.jsx`: 4열로 좁아진 카드 폭에 맞게 `StarInput` 내의 별점 크기(`text-sm sm:text-base`) 및 라벨 너비(`w-[3.3rem] truncate`), 패딩을 동적 축소하여 화면 깨짐/넘침을 방지.
- **[UI/TEXTAREA]** `SpeechEval.jsx`: 200자 평가 이유를 편하게 작성할 수 있도록 입력창의 높이를 `rows={2}`로 확장하고 텍스트 폰트를 소형화.
- **[RESULTS]** `SpeechEval.jsx`: 결과 카드 내의 `MiniRadar` 차트 사이즈를 `110`으로 조율하고 내부 진행 바 두께(`h-1`)를 가늘게 하여 4열 공간에 레이아웃이 미려하게 나타나도록 최적화.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.192 갱신.

## v1.2.191 — 토론도구 평가단 학생 입력 UI 1열 배치 및 글자 수 제한 확대 (2026-05-22 / [Antigravity])


- **[UI/LAYOUT]** `SpeechEval.jsx`: 평가 대상이 4명 등 다수일 때 태블릿/PC 등 넓은 화면에서도 2x2 열배치 대신 4x1 등 세로 1열로만 렌더링되도록 `grid-cols-1`로 강제 고정.
- **[LIMIT]** `SpeechEval.jsx`: 평가 이유 입력란(textarea)의 글자 수 한도를 80자에서 200자로 확대하고, 관련 자리 수 인디케이터(`{length}/200`) 및 placeholders ("평가 이유" / "평가 이유 (필수)")를 반영.
- **[VALIDATION]** `SpeechEval.jsx`: 평가 제출을 위한 단일/다중 유효성 검사에서 코멘트 최대 길이를 200자로 상향 조정.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.191 갱신.

## v1.2.190 — 선거 교사용 안내서 기자단 등록 활동 보강 (2026-05-22 / [Antigravity])


- **[DOCS]** `docs/phase2_teacher_guide.md`: 후보 등록 및 지지 선언문 작성 단계 안내에 '선거 기자단 (후보 미등록 모둠) 활동 안내' 영역 추가.
- **[COPY]** 선거 기자단 활동으로 이름 가리기를 활용한 생생한 취재 및 5W1H 리포트 작성, 선거 관련 쉽고 빠르고 정확한 정보 전달, 기자 직업 윤리 강조 내용을 명시.

## v1.2.189 — 평가단 학생 입력 카드 초미니 조정 (2026-05-22 / [Codex])

- **[UI]** `SpeechEval.jsx`: 평가단 학생 입력 카드의 별점 행, 제목줄, 코멘트 칸, 제출 버튼 높이를 한 단계 더 줄여 `미니 카드` 형태로 조정.
- **[TABLET]** 태블릿에서 타이머 위 평가 패널이 화면을 과하게 차지하지 않도록 바깥 카드 그림자·둥근 정도·간격을 축소.
- **[SAFE]** 별점 선택, 코멘트 필수, 80자 제한, 다중 대상 저장 구조는 그대로 유지.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.189 갱신.

## v1.2.188 — 평가단 학생 입력 카드 컴팩트 디자인 (2026-05-22 / [Codex])

- **[UI]** `SpeechEval.jsx`: 평가단 학생이 작성하는 평가 입력 카드를 태블릿 화면에 맞게 컴팩트하게 조정. 카드 여백, 별점 크기, 코멘트 입력 높이를 줄여 시각적 부담을 낮춤.
- **[RESPONSIVE]** 평가 대상이 여러 명일 때 태블릿 폭에서는 2열, 좁은 화면에서는 1열로 자동 배치되도록 보정.
- **[SAFE]** 평가 저장 구조와 제출 조건은 변경하지 않고 입력 UI만 축소해 기존 `targets` 기반 평가 흐름 유지.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.188 갱신.

## v1.2.187 — 평가단 평가 노출 스위치와 순서 자동 전환 (2026-05-22 / [Codex])

- **[FLOW]** `TeacherDebateControl.jsx`: 교사가 `평가단 평가 노출`을 켜면 현재 단계 평가를 즉시 열고, 다음 단계/다음 라운드 팀으로 이동할 때 현재 순서의 평가 항목을 자동 노출하도록 변경.
- **[UI]** 기존 `이 단계 평가 열기` 버튼을 타이머 노출과 같은 체크박스형 `평가단 평가 노출` 스위치로 교체.
- **[LIFECYCLE]** 평가단 평가 노출이 켜져 있는 동안에는 평가단 전원 제출 후에도 평가가 자동으로 닫히지 않음. 교사가 체크를 끄거나 `평가 닫기`를 눌러야 노출 종료.
- **[CLEANUP]** 새로 생성되는 다자토론/선거토론 단계에서 더 이상 사용하지 않는 `autoEval` 필드를 넣지 않도록 정리.
- **[DOCS]** `docs/debate_eval_architecture.md`에 `evalExposureEnabled` 기준, 종료 조건, 점검 절차 추가.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.187 갱신.

## v1.2.186 — 토론 평가 생성 흐름 단순화 및 기준 문서 추가 (2026-05-22 / [Codex])

- **[REFACTOR]** `TeacherDebateControl.jsx`: 예전 라벨 기반 평가 생성 함수와 별도 다중 평가 버튼을 제거하고, 모든 평가 생성을 `openStageEval(targets, options)` 단일 함수로 통합.
- **[ARCH]** 평가 대상 계산은 `getStageEvalTargets(stage, roundInfo)` 하나로 통일. 일반 단계는 `evalCount/evalNames`, 라운드 단계는 `roundEvalTargets` 또는 현재 라운드 팀 기본값을 이 함수에서만 해석.
- **[SAFE]** 자동 평가와 수동 `이 단계 평가 열기`가 같은 함수 흐름을 쓰도록 정리해 다음 수정 시 단일/다중/라운드 평가 로직이 다시 갈라지지 않게 함.
- **[DOCS]** `docs/debate_eval_architecture.md` 추가. 저장 필드, 단일 진입점, 의존성 주의, 앞으로 하지 말 것, 빠른 점검 절차를 명시.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.186 갱신.

## v1.2.185 — 토론 평가 대상을 일반/라운드 공통 구조로 정리 (2026-05-22 / [Codex])

- **[UI]** `TeacherDebateControl.jsx`: 일반 단계도 평가 대상 입력칸을 기본 1개부터 항상 표시하도록 변경하고, `발언자` 문구를 `평가 대상`으로 정리.
- **[FLOW]** 라운드 여부와 상관없이 단계 평가를 `targets` 기반으로 생성하도록 통일해, 1명 평가부터 여러 명 평가까지 같은 구조로 저장.
- **[ROUND]** 라운드 단계의 `평가 대상`도 기본 1개를 보여주고 `+대상`/`-대상`으로 수정할 수 있게 보정. 상호질문처럼 발언 팀과 평가 대상이 다른 경우를 명확히 기록 가능.
- **[COPY]** 학생 평가창과 결과 영역의 `발언자/발언 평가` 표현을 `평가 대상/단계 평가` 중심으로 수정.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.185 갱신.

## v1.2.184 — 라운드 평가 대상 분리 및 다음 팀 평가 전환 보정 (2026-05-22 / [Codex])

- **[FIX]** `DebateToolPanel.jsx`: 라운드에서 `다음 팀`으로 넘어갔을 때 새 팀 평가가 아직 없으면 직전 팀의 `activeEval`이 남아 보이던 문제를 차단.
- **[FEATURE]** `TeacherDebateControl.jsx`: 라운드 단계 편집 UI에 `평가 대상` 입력줄을 추가해 발언 팀과 실제 평가 대상이 다를 수 있는 상호질문/응답형 라운드를 지원.
- **[FLOW]** 라운드 평가 대상이 비어 있으면 기존처럼 현재 발언 팀을 평가하고, 대상이 있으면 `발언: 현재 팀 / 평가: 대상들` 형태의 평가 항목을 자동·수동 평가 열기에 사용.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.184 갱신.

## v1.2.183 — 토론 중 평가 패널을 타이머 흐름에 통합 (2026-05-22 / [Codex])

- **[UI]** `DebateToolPanel.jsx`: 학생창의 활성 발언 평가를 모든 탭 상단 sticky 영역에서 제거하고, 토론 중 탭의 타이머 바로 위 `현재 단계 평가` 패널로 이동.
- **[FLOW]** 평가가 열리면 학생창은 토론 중 탭으로 이동하며, 현재 단계/현재 라운드 팀에 해당하는 평가 항목만 모아 표시.
- **[STATUS]** 각 평가 항목에 평가단 총원과 제출 인원(`제출/평가단 명수`) 및 진행 막대를 표시해 라운드에서도 평가자 수를 확인 가능.
- **[COPY]** 다자토론/협의 토론의 평가자 명칭을 `판정단`에서 `평가단`으로 정리하고, 기본 평가 대본/타이머 문구도 평가단 표현으로 보정.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.183 갱신.

## v1.2.182 — 토론 단계 빠른 추가 도우미 제거 (2026-05-22 / [Codex])

- **[UI]** `TeacherDebateControl.jsx`: 단계 설정의 `+ 단계 추가` 아래에 있던 `소견발표`와 `라운드 발언` 빠른 추가 영역을 제거해 화면을 단순화.
- **[CLEANUP]** 두 도우미에서만 쓰이던 state와 `addOpinionStages`, `addTeamStages` 함수를 함께 삭제해 미사용 로직 정리.
- **[SAFE]** 기존 라운드 단계 표시, 라운드 팀 편집, `다음 팀` 진행, 팀별 자동 평가는 유지해 이미 생성된 라운드 토론과 기본 다자토론 흐름은 계속 동작.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.182 갱신.

## v1.2.181 — 토론도구 다자토론 라운드 단계 지원 (2026-05-21 / [Codex])

- **[FEATURE]** `DebateTimer.jsx`: 다자토론 단계에 `isRound`/`teams` 구조를 지원해 한 단계 안에서 팀별 발언 순서를 진행할 수 있게 함.
- **[UI]** 학생 타이머와 의장 미니 타이머에 현재 라운드 팀명, 진행 점(`●○`), `n/전체` 표시를 추가.
- **[TEACHER]** `TeacherDebateControl.jsx`: 다음 버튼이 라운드 안에서는 `다음 팀`, 마지막 팀에서는 `다음 단계`로 동작하도록 보정하고, 단계 편집 UI에 라운드 토글·팀명 편집을 추가.
- **[EVAL]** 라운드 단계의 자동 발언 평가는 팀이 바뀔 때 현재 팀 이름으로 별도 평가 항목을 열도록 `roundTeamIdx`/`roundTeamLabel`을 저장.
- **[FLOW]** 선거 후보 토론과 행정부 국무회의 토론 자동 생성 시 참여 후보/부처 이름을 라운드 팀 목록으로 연결.
- **[BUILD]** 빌드 완료. 배포 완료. `APP_BUILD` v1.2.181 갱신.

## v1.2.180 — 입법부 역할별 섹션 직접 편집 + 총괄 검토원 불러오기 (2026-05-21 / [Claude])

- **[FEATURE]** `BranchUnitWorkspace.jsx`: 2단계 역할별 섹션 초안에서 담당 섹션은 직접 textarea로 작성/저장 가능. 다른 섹션은 읽기 전용 + 저장됨/작성중/미작성 상태 배지 표시.
- **[FEATURE]** `BranchUnitWorkspace.jsx`: 3단계 총괄 검토원 전용 최종 편집 패널 추가. 어두운 배경 미리보기에 4개 섹션 내용과 상태를 표시하고 "미리보기에서 불러오기" 버튼 클릭 시 최종 편집 textarea에 덧붙여 넣음(append). 빈 섹션이 있으면 경고 confirm 표시.
- **[FEATURE]** `BranchUnitWorkspace.jsx`: 총괄 검토원 "최종 확정" 시 `finalDoc.content.mergedBody`에 편집한 내용 저장 후 `onPublish` 호출. 섹션 내용도 함께 전달.
- **[FEATURE]** `LegislativeTab.jsx`: `buildBillBodyFromTemplateData`가 `mergedBody`가 있으면 이를 최우선으로 사용해 법안 본문 생성.
- **[ARCH]** 역할 중심 + 섹션 배정 모드(`hasSectionRoles`)일 때 3단계 A(새 편집)가 활성화되고, 공동작업 또는 섹션 없는 모드에서는 기존 3단계 B(children + 최종 확정)가 유지됨.
- **[BUILD]** 빌드 완료 (421ms). 배포 완료.

## v1.2.179 — 교사용 기자단 신문 이름·저장 순서 표시 보강 (2026-05-20 / [Codex])
- **[TEACHER]** `SubmissionStatusQuickPanel.jsx`: 2-2 후보등록 제출 확인 카드에서 기자단 모둠은 `모둠명 기자단-신문이름` 형태로 표시.
- **[TEACHER]** 기자단 카드 하단에 후보등록 체크리스트처럼 `1. 신문이름`, `2. 편집회의`, `3. 캔바작업`, `4. 최종제출` 저장 순서와 완료 여부를 표시.
- **[COPY]** 상세 모달 단계명도 `신문 이름 저장`, `신문편집회의 저장`, `캔바 작업 저장`, `최종제출`로 정리.
- **[BUILD]** 빌드 완료. `APP_BUILD` v1.2.179 갱신.

## v1.2.178 — 신문 총 면수 선택 흐름으로 보정 (2026-05-20 / [Codex])
- **[FLOW]** `JournalistNewspaper.jsx`: 기사별 면 선결정 UI를 제거하고, 편집회의에서 신문의 총 면수(`1면 신문`/`2면 신문`)를 먼저 정하도록 보정.
- **[DATA]** `journalistNewspapers/{groupId}`에 `totalPages` 저장. 총 1면 신문은 모든 기사를 1면으로 정규화하고, 총 2면 신문일 때만 미리보기 창에서 기사별 1면/2면 선택 가능.
- **[UX]** 총 2면 신문으로 정하면 아직 기사가 없어도 미리보기에 빈 2면이 표시되도록 개선.
- **[TEACHER]** 교사용 제출 확인 모달도 `totalPages`를 반영해 1면/2면 배치안을 표시.
- **[BUILD]** 빌드 완료. `APP_BUILD` v1.2.178 갱신.

## v1.2.177 — 신문편집 미리보기 전 1·2면 선택 추가 (2026-05-20 / [Codex])
- **[UX]** `JournalistNewspaper.jsx`: 선택한 기사 목록에 `먼저 어느 면에 넣을지 정하세요` 영역 추가.
- **[FEATURE]** 기사마다 `1면`, `2면` 버튼을 바로 눌러 미리보기 창을 열기 전에 면 배치를 정할 수 있게 함.
- **[REALTIME]** 면 선택도 `journalistNewspapers/{groupId}`에 즉시 반영되어 같은 기자단 친구 화면에 실시간 동기화.
- **[BUILD]** 빌드 완료. `APP_BUILD` v1.2.177 갱신.

## v1.2.176 — 신문편집 기사 종류 안내 추가 (2026-05-20 / [Codex])
- **[UX]** `JournalistNewspaper.jsx`: 신문편집 미리보기의 기사별 배치 선택 위에 `기사 종류 안내` 박스를 추가.
- **[COPY]** 머리기사, 보조기사, 분석기사, 인터뷰/의견, 짧은 기사, 제외의 의미를 바로 읽고 선택할 수 있도록 설명 표시.
- **[BUILD]** 빌드 완료. `APP_BUILD` v1.2.176 갱신.

## v1.2.175 — 기자단 신문편집 실시간 공동 배치 및 1·2면 분리 (2026-05-20 / [Codex])
- **[FEATURE]** `JournalistNewspaper.jsx`: 신문편집 미리보기에서 기사 배치를 `몇 면인가(1면/2면)`와 `기사 종류(머리기사/보조기사/분석기사/인터뷰·의견/짧은 기사/제외)`로 분리.
- **[REALTIME]** 기사 선택 및 배치 변경 시 `journalistNewspapers/{groupId}`의 `selectedArticleIds`, `layoutAssignments`, `layoutItems`를 즉시 갱신해 같은 기자단 친구들이 변화를 실시간으로 볼 수 있게 함.
- **[UX]** 미리보기는 1면을 먼저 보여주고, 2면에 배치한 기사가 있으면 아래에 2면까지 자동 표시.
- **[COMPAT]** 기존 `lead/support/analysis/interview/brief/unused` 문자열 배치값도 새 `page + slot` 구조로 읽히도록 호환 처리.
- **[TEACHER]** 교사용 제출 확인 모달의 신문편집 배치안도 1면/2면 구조로 표시.
- **[BUILD]** 빌드 완료. `APP_BUILD` v1.2.175 갱신.

## v1.2.174 — 최우선 과제 확정 전광판 문구 한글화 (2026-05-20 / [Codex])
- **[COPY]** `Phase1Page.jsx`: 최우선 과제 잠금 화면의 `OFFICIAL ANNOUNCEMENT`를 `공식 발표`, `WAITING FOR SELECTION`을 `선정 대기 중`으로 변경.
- **[COPY]** 하단 `NEXT PHASE: ELECTION` 문구를 `다음 여정: 선거`로 변경.
- **[UX]** 이미 상단에 최우선 과제가 표시되므로 이모지 옆 `TOPIC:` 배지를 제거해 화면 중복을 줄임.
- **[BUILD]** 빌드 완료. `APP_BUILD` v1.2.174 갱신.

## v1.2.173 — 기자단 신문편집 미리보기 배치판 추가 (2026-05-20 / [Codex])
- **[FEATURE]** `JournalistNewspaper.jsx`: 선택한 기사별로 `1면 머리기사`, `1면 보조기사`, `2면 분석기사`, `2면 인터뷰/의견`, `짧은 소식`, `이번 신문에는 제외` 배치를 정하는 신문편집 미리보기 창 추가.
- **[DATA]** 기자단 신문 저장 데이터에 `layoutAssignments`, `layoutItems`를 추가해 기존 자유서술형 배치 계획과 함께 구조화된 배치안을 저장.
- **[UX]** 학생 신문 갤러리와 교사용 후보등록 제출 확인 모달에서 저장된 신문편집 배치안을 확인할 수 있도록 표시.
- **[BUILD]** 빌드 완료. `APP_BUILD` v1.2.173 갱신.

## v1.2.172 — 교사용 제출 현황에 기자단 신문 상태 표시 (2026-05-20 / [Codex])
- **[TEACHER]** `SubmissionStatusQuickPanel.jsx`: 후보등록 제출 확인 패널에서 기자단 모둠의 신문 제출 상태를 함께 표시하도록 `journalistNewspapers` 구독 추가.
- **[TEACHER]** 기자단 카드는 `기자단 등록 완료`과 함께 `신문 미시작/신문 작성중/신문 제출` 배지를 표시한다.
- **[TEACHER]** 기자단 모둠을 클릭하면 신문 이름, 편집회의, 캔바 신문, 최종제출 단계별 상태와 제출 내역을 확인할 수 있다.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.172 갱신.

## v1.2.171 — 선거 기자단 신문 편집·제출·평가 흐름 추가 (2026-05-20 / [Codex])
- **[FEATURE]** `JournalistNewspaper.jsx` 신규 추가: 기자단 마무리 활동으로 신문 이름 저장, 신문편집회의 결과 저장, Canva 임베드 저장, 최종 제출 흐름 구현.
- **[FEATURE]** `ElectionJournalistWorkspace.jsx`: 기자단 탭에 `신문 마무리`를 추가하고 우리 모둠 기사 목록을 보며 신문에 배치할 기사를 선택하도록 연결.
- **[FEATURE]** `Phase2Page.jsx`: 후보 비교/아고라 단계에서 제출된 기자단 신문을 모든 학생이 읽고 질문·의견·평점을 남길 수 있는 신문 갤러리 추가. 찬반 선택은 넣지 않음.
- **[DATA]** 신문 제출 데이터는 `journalistNewspapers/{groupId}`, 신문 피드백은 `journalistNewspaperFeedback` 경로 사용.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.171 갱신.

## v1.2.170 — 선거 기자단 할 일 기자 직업 윤리 항목 추가 (2026-05-18 / [Antigravity])
- **[COPY]** `Phase2Page.jsx`, `CandidateRegister.jsx`: 후보를 내지 않은 모둠(선거 기자단) 활동 안내 목록에 기자의 직업 윤리를 생각하며 여러 사람에게 두루 도움이 되는 기사를 작성한다는 항목 1개 추가.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.170 갱신.

## v1.2.169 — 선거 기자단 할 일 안내 항목 보강 (2026-05-18 / [Antigravity])
- **[COPY]** `Phase2Page.jsx`, `CandidateRegister.jsx`: 후보를 내지 않은 모둠(선거 기자단)에게 안내되는 할 일 목록에 생생한 취재(이름가리기 사용) 및 쉽고 빠르고 정확한 정보 전달 2가지 항목 추가.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.169 갱신.

## v1.2.168 — 사전 자료 찾기 카테고리 삭제 권한 보강 (2026-05-18 / [Codex])
- **[FEATURE]** `ResearchWorkspace.jsx`: 학생이 직접 만든 자료수집 카테고리는 삭제할 수 있도록 버튼 추가.
- **[GUARD]** 해당 카테고리에 연결된 기사가 있으면 삭제를 막고, 기사 자료를 먼저 삭제해야 한다는 안내 표시.
- **[UX]** 내가 올린 기사 자료 삭제 흐름을 유지하면서, 카테고리 목록과 자료 카드 양쪽에서 비어 있는 내 카테고리 삭제 가능.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.168 갱신.

## v1.2.167 — 사전 자료 찾기 아이디어 메모 표시 보강 (2026-05-18 / [Codex])
- **[FEATURE]** `ResearchWorkspace.jsx`: 기사 자동 추출 요약(`summary`)과 학생이 적는 떠오른 아이디어(`idea`)를 분리 저장하도록 정리.
- **[UX]** `ResearchReferencePanel.jsx`: 후보등록·입법·행정·사법 작성 화면의 참고자료 카드에서 기사 요약과 `떠오른 아이디어`를 함께 표시.
- **[FIX]** 기존 저장 자료는 `idea/memo/note/summary` 중 있는 값을 아이디어 메모로 보여주도록 호환 처리.
- **[TEACHER]** `SubmissionStatusQuickPanel.jsx`: 교사용 자료수집 제출 상세에서도 떠오른 아이디어를 확인할 수 있게 표시.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.167 갱신.

## v1.2.166 — 선거본부 후보·기자 등록 흐름 통합 (2026-05-18 / [Codex])
- **[FLOW]** `Phase2Page.jsx`: 예전 `후보 캠프 등록 / 선거 기자로 활동` 역할 선택 카드를 제거하고, 모든 모둠이 후보자 등록 화면으로 진입하도록 변경.
- **[FEATURE]** `CandidateRegister.jsx`: 모둠원 이름명패 마지막에 `없음` 선택지를 추가. 모둠원을 저장하면 후보 캠프, `없음`을 저장하면 선거 기자단으로 등록된다.
- **[FEATURE]** 후보 등록을 `후보 이름 저장`과 `후보 소개 및 출마 선언서 저장`으로 분리하고, 공약·홍보자료·선관위 최종 제출 흐름은 유지.
- **[UX]** 기자단 등록 후 후보등록 칸은 사라지고 기자단 역할 안내와 기존 선거 기자 활동 워크스페이스가 이어서 보이도록 정리.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.166 갱신.

## v1.2.165 — 두 번째 여정 선거본부 단계 잠금/블러 흐름 보정 (2026-05-18 / [Codex])
- **[FIX]** `Phase2Page.jsx`: 선거 기자 활동 영역과 후보 비교/아고라 영역이 워크플로 잠금 규칙을 우회하던 `anyHighlight={false}` 설정 제거.
- **[UX]** 두 번째 여정에서도 현재 단계가 아닌 활동은 보이지 않도록 다른 여정과 동일한 단계 잠금 흐름 적용.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.165 갱신.

## v1.2.164 — 후보등록 3단계 저장·선관위 제출 및 기자 자료실 연결 (2026-05-18 / [Codex])
- **[FEATURE]** `CandidateRegister.jsx`: 후보등록을 ① 후보자·출마선언 저장 ② 공약 저장 ③ 홍보자료 저장 → 미리보기 확인 후 `선관위에 제출하기` 흐름으로 개편.
- **[FEATURE]** 후보 데이터에 `status`, `introSavedAt`, `pledgesSavedAt`, `mediaSavedAt`, `submittedAt`, `videoCanvaUrl` 필드 추가. 기존 `pledges`, `pamphlet`, `posterCanvaUrl`, `canvaUrl` 필드는 호환 유지.
- **[COPY/UI]** `카드뉴스 캔바 링크`를 `공약 카드뉴스 캔바 링크`로 수정하고, `홍보영상 캔바 링크` 입력 추가.
- **[FEATURE]** 후보 미리보기 아래 `온라인 토론용 미리보기 제출 상태` 체크리스트 추가: 후보소개·공약·홍보자료·선관위 제출 각각 제출/미제출 표시.
- **[FEATURE]** `ElectionJournalistWorkspace.jsx`: 기자단 기사 작성 화면과 후보 비교 화면에서 이전 공약 자료실(`phase2_election`) 내용을 확인할 수 있게 연결.
- **[FEATURE]** `CandidateCard.jsx`: 공약 카드뉴스 문구 반영, 홍보영상 Canva 표시, 선관위 미제출 후보에는 작성 중 배지 표시.
- **[FIX]** `SubmissionStatusQuickPanel.jsx`: 후보등록 제출 확인은 선관위 제출 완료(`status: submitted` 또는 기존 `registeredAt`) 후보만 제출로 집계.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.164 갱신.

## v1.2.163 — 자료조사 결과 작성 화면 참고자료 연결 정리 (2026-05-18 / [Codex])
- **[FEATURE]** `ResearchReferencePanel.jsx` 신규 추가: 자료수집 단계에서 모은 자료 목록과 기사 자료를 작성 화면에서 공통 참고자료 패널로 표시.
- **[FIX]** `CandidateRegister.jsx`: 선거캠프 공약 자료실을 후보등록 폼 안에 항상 표시하도록 정리. 자료가 없어도 안내가 보임.
- **[FIX]** `BillTemplate.jsx`: 입법 전 자료조사(`phase3_legislative`)를 법안 템플릿 작성 화면에 연결.
- **[FIX]** `ExecutivePolicyBudgetDraft.jsx`: 행정 전 자료조사(`phase3_executive`)를 정책·예산안 초안 도움 영역에 공통 패널로 정리.
- **[FIX]** `VerdictTemplate.jsx`: 사법 전 자료조사(`phase3_judicial`)를 판결문 템플릿 작성 화면에 연결.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.163 갱신.

## v1.2.162 — 교사용 빠른제어 아래 제출 확인 현황판 추가 (2026-05-18 / [Codex])
- **[FEATURE]** `SubmissionStatusQuickPanel.jsx` 신규 추가: 현재 워크플로 단계가 제출 활동일 때 빠른제어 아래에 모둠/개인 제출 현황을 표시.
- **[FEATURE]** 지원 단계: 1-4 캠페인 포스터·주장글·자료, 1-7 기사, 2-1 공약 자료수집, 2-2 후보등록, 2-8 선거 결과 기사, 3-2 입법 발의, 3-8/3-17/3-20 기사, 3-10 정책·예산안, 4-1 정리글.
- **[FEATURE]** 제출자 카드를 클릭하면 `SubmissionDetailModal`로 제출 내용을 즉시 확인. 모둠 제출은 모둠 단위, 개인 제출은 학생 단위로 집계.
- **[INTEGRATION]** `TeacherDashboard.jsx`: 기존 빠른제어 패널 아래에 제출 확인 현황판 연결.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.162 갱신.

## v1.2.161 — 선거 토론 준비 단계 안내 문구 정정 (2026-05-18 / [Codex])
- **[COPY]** `PhaseWorkflow.jsx`: 두 번째 여정 `토론 준비 (다자토론 — 전 후보)` 문구를 `토론 준비 — 아래 선거토론 빠른제어에서 토론 설정`으로 변경.
- **[COPY]** `Phase2Page.jsx`: 학생/교사 화면의 토론 준비 안내를 “바로 열리지 않고, 아래 선거토론 빠른제어에서 토론 세션을 생성해야 시작”되는 흐름으로 정리.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.161 갱신.

## v1.2.160 — 여론조사 수정 시 보기 삭제 기능 추가 (2026-05-18 / [Codex])
- **[FEATURE]** `PollManager.jsx`: 교사용 여론조사 관리에서 기존 여론조사 `수정` 중 각 보기 입력칸 오른쪽에 `삭제` 버튼 추가.
- **[UX]** 보기 삭제 후에도 저장 시 기존 검증을 유지해 질문과 보기 2개 이상이 있어야 저장되도록 함.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.160 갱신.

## v1.2.159 — 토론 중 타이머 단계 다중 선택 이동 (2026-05-18 / [Codex])
- **[FEATURE]** `TeacherDebateControl.jsx`: 토론 중 타이머 단계 목록에 체크박스를 추가해 여러 단계를 동시에 선택할 수 있게 함.
- **[FEATURE]** 선택한 단계들을 `선택 ▲` / `선택 ▼` 버튼으로 한 칸씩 함께 이동하도록 구현. 선택된 단계들의 상대 순서는 유지하고, 현재 진행 중인 단계 인덱스도 새 위치로 보정.
- **[UI]** 선택 개수 표시와 `해제` 버튼 추가. 기존 개별 단계 ▲/▼ 이동, 번호 클릭 이동, 단계 삭제 기능은 그대로 유지.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.159 갱신.

## v1.2.158 — 기사 작성자 삭제·교사 관리 기능·신고 기능 (2026-05-18 / [Claude])
- **[FEATURE]** `ArticleCard.jsx`: 학생 본인이 작성한 기사에 신고 버튼(🚩) 노출. 신고 이유 5종 선택 후 `articles/{id}/reports/{studentId}` 경로에 저장. 이미 신고한 경우 "신고됨" 표시.
- **[FEATURE]** `ArticleCard.jsx`: 기사 성격(articleNature) 배지 헤더에 추가 표시.
- **[FEATURE]** `ArticleCard.jsx`: 교사 화면에서 신고 건수 배지(🚩 N건) 표시.
- **[FEATURE]** `ArticleSection.jsx` / `ElectionJournalistWorkspace.jsx`: `status === 'deleted'` 기사 목록에서 제외.
- **[FEATURE]** `ElectionJournalistWorkspace.jsx`: 기사 작성자 본인은 🗑️ 버튼으로 기사 직접 삭제 가능.
- **[FEATURE]** `ArticleApprovalQueue.jsx` 전면 재작성 — 교사 기사 관리 기능 대폭 강화:
  - 인라인 수정 (헤드라인+본문 직접 편집)
  - 소프트 삭제 (이유 입력 필수, `status: 'deleted'` + `deletionReason` 저장)
  - 삭제된 기사 복원 / 완전 삭제
  - 신고 건수 배지 + `reported` 필터 탭 (신고 이유 목록 포함)
  - 필터: 대기·승인·신고·삭제·전체
  - ⌘+Enter 승인 / ⌘+R 반려 단축키
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.158 갱신.

## v1.2.157 — 기사 성격 필드 추가 + 자료수집 목록 UI 개선 (2026-05-18 / [Claude])
- **[FEATURE]** `ArticleEditor.jsx`: `기사 성격` 선택 필드 추가 (뉴스 보도·사설/논평·현장 취재·심층 분석) — 2×2 버튼 그룹으로 관점 아래에 표시. `articleNature` 필드로 저장.
- **[FEATURE]** `ArticleEditor.jsx`: `대상 차시` → `관련 영역` 으로 레이블 변경, `선거 관련` 옵션 추가.
- **[UI]** `ResearchWorkspace.jsx`: 자료 목록 입력을 2칸 → 1칸으로 축소. 입력+추가 버튼을 같은 행에 배치, Enter 키 지원.
- **[UI]** `ResearchWorkspace.jsx`: 현재 목록을 입력 칸 바로 위에 인라인으로 표시 (수집 진행도 배지 + × 삭제 버튼). 힌트 클릭 시 입력 칸에 바로 채워짐.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.157 갱신.

## v1.2.156 — 선거 기자단 역할 추가 (2026-05-18 / [Claude])
- **[FEATURE]** `ElectionJournalistWorkspace.jsx` 신규 생성 — 선거 기자단 전용 워크스페이스. 탭 3개: 기사 작성(에디터+내 기사 목록), 후보 비교(CandidateCard 읽기 전용), 다른 모둠 기사(승인된 기사 피드).
- **[FEATURE]** `Phase2Page.jsx` — `electionJournalists` 구독 추가. 역할 미선택 모둠에게 "후보 캠프 등록" / "선거 기자로 활동" 선택 UI 표시. 기자 등록 시 `setAt(electionJournalists/{groupId})`, 취소 시 `removeAt`.
- **[FEATURE]** 기자단 모둠은 Phase 2 전 단계에서 `ElectionJournalistWorkspace` 상시 표시. `debateEval`/`finalNews`/`nextJourney` 단계 `ArticleSection`은 비기자 모둠에만 표시(`!isJournalist`).
- **[DATA]** `electionJournalists/{groupId}` 경로로 기자단 등록 저장.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.156 갱신.

## v1.2.155 — 기사 페이즈 필터링 버그 수정 (2026-05-18 / [Claude])
- **[BUG FIX]** `ArticleEditor.jsx`: 기사 저장 시 `phase: currentPhase` 필드 추가 — 이후 페이즈 필터링의 기준값으로 사용.
- **[BUG FIX]** `ArticleSection.jsx`: `myGroupArticles` 계산 시 현재 `currentPhase`와 일치하는 기사만 표시하도록 필터 추가. `phase` 필드 없는 레거시 기사는 1페이즈로 취급. Phase 2 기사 작성 섹션에 Phase 1 기사가 섞여 보이던 문제 해결.
- **[BUILD]** 빌드·배포 완료. `APP_BUILD` v1.2.155 갱신.

## v1.2.154 — 지지 선언문 전면 개편: 임의 후보 지지 + Phase2Page 연결 (2026-05-18 / [Claude])
- **[FEATURE]** `CandidateSupportStatements.jsx` 전면 재작성 — props를 `{ groupId, allCandidates, allSupportByGroup, editable }`로 변경. 학생이 자기 모둠 여부에 관계없이 등록된 후보 중 하나를 선택해 지지 선언문 작성 가능.
- **[FEATURE]** 후보 선택 버튼 UI 추가. `myStatement`를 전체 후보 선언문에서 탐색해 중복 작성 방지.
- **[FIX]** `Phase2Page.jsx`: `CandidateSupportStatements`에 `allCandidates={candidatesList}`, `allSupportByGroup={supportByGroup}` 전달로 새 인터페이스 연결.
- **[BUILD]** 빌드·배포 완료.

## v1.2.153 — StancePoll 토론 후 전/후 비교 + 이유 입력 (2026-05-18 / [Claude])
- **[FEATURE]** `StancePoll.jsx`: 토론 후(`pollId === 'post'`) 전/후 입장 비교 카드 추가 — 토론 전 선택(`prePoll.votes`) vs 토론 후 선택을 나란히 표시, 변화 여부에 따른 메시지.
- **[FEATURE]** 이유 입력 텍스트에어리어 추가 — 생각이 바뀐 경우 "바뀐 이유", 변화 없으면 "바뀌지 않은 이유" 입력, `updateAt`으로 저장.
- **[FIX]** `DebateToolPanel.jsx`: post StancePoll에 `prePoll={stancePolls.pre}` 전달.
- **[BUILD]** 빌드·배포 완료.

## v1.2.152 — TeacherDebateControl useRef 추가 및 탭 자동전환 + 토론 단계/제목 수정 (2026-05-18 / [Claude])
- **[BUG FIX]** `TeacherDebateControl.jsx`: `useRef` import 누락으로 인한 `ReferenceError` 수정.
- **[BUG FIX]** `TeacherDebateControl.jsx`: 탭 자동전환 effect가 마운트 시 `teacherTab: pre`를 덮어쓰던 문제 — `prevToolsRef`로 신규 추가된 도구만 트리거하도록 수정.
- **[FIX]** `Phase2ElectionQuickPanel.jsx`: 토론 단계 "각 팀별 기조 발언" → "각 후보별 기조 발언"으로 수정.
- **[FIX]** 토론 세션 제목 `{countryName} 대통령 후보 토론회`, 논제 `최우선 과제를 가장 잘 해결할 후보는 누구인가?`로 고정.
- **[BUILD]** 빌드·배포 완료.

## v1.2.151 — Phase2ElectionQuickPanel 재설계: 수동 topN 선택 + 토론 세션 수동 생성 (2026-05-18 / [Claude])
- **[REDESIGN]** `Phase2ElectionQuickPanel.jsx`: 자동 세션 생성 useEffect 제거. 교사가 "모두" 또는 "1~N위"를 선택한 뒤 "토론 세션 생성" 버튼을 눌러야 생성되도록 변경.
- **[FEATURE]** 선택한 topN 기준으로 후보 모둠은 토론 팀, 나머지 모둠은 평가단으로 배치 미리보기 표시.
- **[FEATURE]** 세션 생성 후 "토론 도구 열기" + "종료" 버튼 분리 표시.
- **[BUILD]** 빌드·배포 완료.

## v1.2.150 — 선거 토론 다자토론 전환 + 사전 여론조사 순위 반영 (2026-05-18 / [Claude])
- **[FEATURE]** `Phase2Page.jsx`: `polls` 구독 추가, `prePollRanks` 계산 — 사전 여론조사 결과(prepoll)로 후보 순위 산정
- **[FEATURE]** `Phase2Page.jsx`: `debatePrep` 단계 → 전 후보 다자토론으로 전환. 사전 여론조사 순위 막대 + 전 후보 카드 표시
- **[FEATURE]** `Phase2ElectionQuickPanel.jsx` 신규 생성 — debatePrep 단계 진입 시 자동으로 다자토론 세션 생성·토론 도구 창 오픈
- **[FEATURE]** `TeacherDashboard.jsx`: phase2 debatePrep 단계에서 Phase2ElectionQuickPanel 표시
- **[FEATURE]** `PhaseWorkflow.jsx`: debatePrep step 라벨/힌트 다자토론으로 업데이트
- **[BUILD]** 빌드·배포 완료.

## v1.2.149 — 지지 선언문 수정 불가 버그 수정 (2026-05-18 / [Claude])
- **[BUG FIX]** `Phase2Page.jsx`: `supportByGroup` 생성 시 `Object.values()` → `Object.entries()`로 변경 — Firebase 키(id)가 누락되어 `myStatement.id`가 `undefined`가 되면서 수정 폼이 열리지 않던 문제 해결.
- **[BUILD]** 빌드·배포 완료.

## v1.2.148 — StancePoll 논제 표시 제거·여론조사 옵션 제출부처만 필터·정책+예산 원자저장 (2026-05-18 / [Claude])
- **[BUG FIX]** `StancePoll.jsx`: 학생 화면에서 `session.topic`(국무회의 논제 전문)이 여론조사 질문처럼 크게 표시되던 버그 수정 — 논제 표시 줄 제거, `poll.question`을 굵게 표시.
- **[BUG FIX]** `Phase3ExecutiveQuickPanel.jsx` 사전/사후 여론조사 옵션: 'saved' 상태 포함 → `submitted` 이상 부처만 표시(`submittedEntries` 필터 추가).
- **[BUG FIX]** `ExecutivePolicyBudgetDraft.jsx` 제출 함수: Firebase 타이밍 경쟁 조건 제거 — `isBudgetSaved`/`isPolicySaved` 체크 삭제, 저장+제출 `setAt` 단일 원자 호출로 전환.
- **[BUILD]** 빌드·배포 완료 (`https://<배포주소>/class_democra/app/`).

## v1.2.147 — 행정부 예산 항목 삭제 버튼 및 저장 문구 정리 (2026-05-17 / [Codex])
- **[UI]** 예산 항목 행의 삭제 버튼을 행 끝 작은 `x` 버튼으로 변경.
- **[COPY]** 정책 영역 버튼 문구를 `정책 임시저장/정책 저장`에서 `임시저장/저장`으로 간결화.
- **[COPY]** 정책 저장 누락 경고도 새 버튼명에 맞게 `[저장]` 안내로 수정.
- **[BUILD]** `APP_BUILD` v1.2.147 갱신.

## v1.2.146 — 행정부 예산 항목 입력 행 압축 및 버튼 배치 정리 (2026-05-17 / [Codex])
- **[UI]** 예산 영역 상단 버튼을 1행 `예산 항목 / 임시저장 / 저장`, 2행 `예산 계산기 / 항목 추가` 구조로 재배치.
- **[BUDGET]** 예산 항목 목록을 `번호 / 항목명 / 산출내역 / 금액` 한 줄 편집 구조로 압축.
- **[SUMMARY]** 하단 예산 요약을 `항목 합계 N억 (정부예산 100억 중 N%)` 한 줄로 정리하고 중복 예산 표시칸을 제거.
- **[BUILD]** `APP_BUILD` v1.2.146 갱신.

## v1.2.145 — 행정부 저장 완료 후 단일 제출 및 500만 명 통계 기준 적용 (2026-05-17 / [Codex])
- **[FLOW]** `정책 저장`과 `예산안 저장`이 모두 완료되어야 `정책·예산안 제출`이 진행되도록 단일 제출 흐름으로 재정리.
- **[ALERT]** 제출 시 정책안 저장 또는 예산안 저장이 누락되면 각각 `아직 정책안 저장이 안되었습니다`, `아직 예산안 저장이 안되었습니다` 경고를 띄우도록 수정.
- **[LOCK]** 제출 후에는 수정이 잠기고, `제출취소` 후 다시 수정할 수 있도록 흐름 보정.
- **[STATS]** 비빔민국/학급 설정 국가 통계 기준을 전체 인구 500만 명으로 조정하고 성별·연령·도시/농촌·학교 수 통계를 재산정.
- **[UI]** 단계 강조 중 비활성 섹션을 흐릿하게 보여주지 않고 아예 숨기도록 `HighlightBox` 동작 변경.
- **[BUILD]** `APP_BUILD` v1.2.145 갱신.

## v1.2.144 — 행정부 정책/예산안 저장·제출 분리 및 제출 잠금 (2026-05-17 / [Codex])
- **[FLOW]** 정책 초안과 예산안을 각각 저장·제출할 수 있도록 `정책 저장`, `예산안 저장`, `정책 제출`, `예산안 제출` 버튼으로 분리.
- **[LOCK]** 정책 또는 예산안 중 하나라도 제출하면 수정 입력을 잠그고, `제출취소`를 눌러야 다시 `수정` 버튼이 나타나도록 변경.
- **[STATE]** `policySubmittedAt`, `budgetSubmittedAt`을 저장하고, 두 항목이 모두 제출되었을 때 기존 `status: submitted`로 전환해 일반 토의가 열리도록 정리.
- **[EVALUATOR]** 한쪽만 저장/제출된 상태는 `saved`로 유지해 평가단·대통령 모둠이 사전 확인할 수 있도록 호환 유지.
- **[BUILD]** `APP_BUILD` v1.2.144 갱신.

## v1.2.143 — 행정부 초안 단계 발의 흐름 및 예산안 저장 버튼 정리 (2026-05-17 / [Codex])
- **[FLOW]** 정책 초안 작성 폼에서 `토의 및 평가 반영·예산 조정` 칸과 `공식 예산 청구 확정` 버튼을 제거해, 조정은 ⑥ 정책 및 예산안 최종 수정 단계에서만 하도록 분리.
- **[LABEL]** 초안 하단의 `온라인 토의에 공개` 버튼을 `정책과 예산안 발의`로 변경하고, 토의 목록 안내 문구도 발의 흐름에 맞게 수정.
- **[BUDGET]** 예산 항목 영역에 `예산안 임시저장`과 `예산안 저장` 버튼을 추가해 예산안만 먼저 저장할 수 있도록 보강.
- **[CHECK]** 예산 조정 전용 창은 ⑥ `ExecutivePolicyFinalEdit`로 이미 연결되어 있음을 확인.
- **[BUILD]** `APP_BUILD` v1.2.143 갱신.

## v1.2.142 — 행정부 정책 저장 후 토의 목록 role 참조 오류 수정 (2026-05-17 / [Codex])
- **[FIX]** 정책 초안 저장 후 `saved` 상태 정책이 온라인 토의 목록에 렌더링될 때 `role is not defined` 오류가 발생하던 문제 수정.
- **[CAUSE]** `ExecutivePolicyDiscussionList` 본문에서 평가단/대통령 사전 열람 여부를 판단하며 `role`을 참조했지만, 해당 컴포넌트에 `role` 구독이 누락되어 있었음.
- **[BUILD]** `APP_BUILD` v1.2.142 갱신.

## v1.2.141 — 행정부 예산 항목 산출식 기반 청구 UI 정리 (2026-05-17 / [Codex])
- **[BUDGET]** 행정부 정책 초안 예산 영역을 `예산 항목 / 산출내역 / 금액` 한 줄 구조로 정리하고, 항목 합계가 정책 초안 예산과 공식 청구액에 자동 반영되도록 보강.
- **[CALC]** 예산 계산기를 `대상 수 x 단가 x 횟수` 방식으로 단순화해 계산 결과와 산출내역을 현재 예산 항목에 자동 입력하도록 수정.
- **[UX]** 운영비·홍보비도 별도 예산 항목으로 추가해 각각 산출식을 남기도록 안내 문구 추가.
- **[FINAL]** 국무회의 후 최종 수정 폼도 같은 `항목명 / 산출내역 / 금액` 구조와 자동 합계 방식으로 맞춤.
- **[BOARD]** 행정부 예산 초안 검토 전광판의 예산 산출식 표시를 새 항목 구조에 맞게 수정.
- **[BUILD]** `APP_BUILD` v1.2.141 갱신.

## v1.2.140 — 행정부 국무회의 토론 도구 자동 연결 (2026-05-17 / [Codex])
- **[EXECUTIVE]** 교사조정화면 행정부 ⑤ 다자간 토론(국무회의) 단계에 `토론 시작`, `토론 전광판`, `결과 발표` 버튼을 추가.
- **[DEBATE]** `토론 시작` 시 정책·예산 초안, 정부 총예산 대비 초과/잔여액, 온라인 토의 댓글·3축 평가 요약을 다자토론 논제로 자동 조립.
- **[DEBATE]** 부처 모둠을 다자토론 참여 팀으로 자동 배정하고, 행정부 평가단 모둠은 평가단으로 연결. 대통령 모둠은 의장명으로 표시.
- **[POLL]** 국무회의 전 사전 입장조사와 토론 후 결과 발표용 사후 여론조사를 자동 생성하도록 연결.
- **[BUILD]** `APP_BUILD` v1.2.140 갱신.

## v1.2.139 — 행정부 ③ 예산 검토 단계 연결 및 문서 정합성 복구 (2026-05-17 / [Codex])
- **[FIX]** 워크플로에는 추가되어 있었지만 행정부 탭 본문에서 누락된 `executive-review` 단계를 실제 `ExecutiveBudgetReviewBoard` 섹션으로 연결.
- **[SYNC]** 행정부 탭의 표시 번호를 7단계 흐름에 맞게 `③ 예산 초안 검토 → ④ 토의 및 평가 → ⑤ 다자간 토론 → ⑥ 최종 수정 → ⑦ 발표`로 보정.
- **[COPY]** 행정부 정책 초안 작성 도구의 남아 있던 `서버에 저장` 버튼 문구를 `저장`으로 정리하고, `saved` 상태 칩을 `저장됨`으로 표시.
- **[DOCS]** 깨진 `project_context.md`를 최신 코드 상태 기준으로 재작성하고, `task.md` 최신 완료 항목을 v1.2.139로 동기화.
- **[BUILD]** `APP_BUILD` v1.2.139 갱신.

## v1.2.138 — 행정부 예산 초안 검토 전광판 및 6단계 최종 수정 폼 고도화 (2026-05-17 / [Antigravity])
- **[EXECUTIVE]** 행정부 3단계 예산 초안 검토 전용 전광판(`ExecutiveBudgetReviewBoard.jsx`) 및 TV 송출용 라우팅(`TVExecutiveBoardPage.jsx`) 신설. 교사 제어 패널에서 `[🎬 전광판 띄우기 (새 창)]` 버튼으로 즉시 실행 가능.
- **[EXECUTIVE]** 행정부 4단계 온라인 토의 화면(`ExecutivePolicyDiscussionList.jsx`) 상단에 실시간 정부 총예산 대비 청구액 합계 및 초과/잔여액 현황을 표시하는 띠배너 고정 노출.
- **[EXECUTIVE]** 행정부 6단계 정책 및 예산안 최종 수정 전용 폼(`ExecutivePolicyFinalEdit.jsx`) 신설. 상단에 정책 뼈대(집행계획)를 고정 노출하고, 하단에서 시행령과 예산 항목(계산기 연동)을 집중 수정하며 대통령 최종 승인 워크플로 지원.
- **[PERMISSION]** `saved` 상태인 정책에 대해 평가단 및 대통령 모둠이 사전 열람하고 의견을 제시할 수 있도록 권한 및 안내문구 동기화.
- **[BUILD]** `APP_BUILD` v1.2.138 갱신 및 배포 완료.

## v1.2.137 — 공통 자료수집 양식 입장 선택(긍정/부정/중립) 및 행정부 저장 분리 고도화 (2026-05-17 / [Antigravity])
- **[RESEARCH]** 선거, 입법, 사법, 행정의 사전조사 자료실 기사자료수집 폼에 자료 성격 태그 아래 `우리 주장과의 관계 (입장: 긍정적/부정적/중립적)` 선택 버튼을 추가.
- **[UI]** 기사자료수집 폼에서 `이 자료의 성격`과 `우리 주장과 관계` 라벨 및 버튼들이 각각 가로 한 줄에 깔끔하게 정렬되도록 레이아웃 최적화.
- **[EXECUTIVE]** 행정부 정책·시행령 작성 도구에서 `저장` 버튼 클릭 시 `status`를 `saved`로 설정하여 장관이 토의에 공개하기 전 중간 상태를 보존할 수 있도록 개선.
- **[EXECUTIVE]** `ExecutivePolicyDiscussionList`에서 `saved` 상태인 정책을 목록에 표출하되, 의견 작성 대신 토의 공개 대기 중임을 알리는 전용 안내문구를 노출.
- **[BUILD]** `APP_BUILD` v1.2.137 갱신 및 배포.

## v1.2.136 — 행정부 시행령 작성 조항별 안내 문구 상시 노출 (2026-05-17 / [Antigravity])
- **[UX]** 행정부 시행령 초안 작성 카드에서 조항별 입력칸에 타이핑할 때 플레이스홀더가 지워져 참고하기 어렵던 문제를 개선.
- **[UI]** `제1조 (목적)` 등 각 조항 라벨 옆에 기본 템플릿 안내 문구를 상시 표시하여, 학생이 입력 중에도 언제든 참고하며 문장을 완성할 수 있도록 보강.
- **[BUILD]** `APP_BUILD` v1.2.136 갱신 및 배포.

## v1.2.135 — 교사관리 Phase 3 단계 전환 스크롤 고정 보강 (2026-05-17 / [Codex])
- **[FIX]** 교사관리화면에서 입법 마지막 여론조사(`poll2`) 후 행정 ① 준비로 넘어갈 때 페이지가 학생 미리보기/행정 영역 쪽으로 스크롤되는 현상을 줄이도록 보정.
- **[SCROLL]** 공통 `preserveWindowScrollAfter` 복원 타이밍을 80ms·220ms에서 600ms·1000ms까지 늘려 늦게 시작되는 smooth scroll에도 원래 위치를 다시 잡도록 강화.
- **[CONTROL]** 입법부/행정부 내부 진행 가이드의 이전·다음 버튼도 직접 `updateAt` 대신 스크롤 보존 유틸로 감싸 교사 진행 버튼들과 동작을 통일.
- **[BUILD]** `APP_BUILD` v1.2.135 갱신.

## v1.2.134 — 행정부 정책 초안 3단계 조립형 UI (2026-05-16 / [Codex])
- **[EXECUTIVE]** 행정부 정책 초안 작성 영역을 `정책 뼈대 정하기 → 시행령 문장 만들기 → 국민 설득하기` 3단계 접이식 카드로 재구성.
- **[UX]** 긴 세로 입력 양식을 줄이고, 근거 법령·정책명·문제·대상 국민·집행계획을 1단계 카드 안에서 먼저 정하도록 정리.
- **[ORDINANCE]** 시행령 조항별 짧은 입력을 유지하면서, 입력값과 정책 뼈대가 `제1조~제5조` 시행령 문장으로 자동 조립되는 미리보기를 추가.
- **[COPY]** `템플릿을 초안에 반영` 버튼을 `내 답변으로 시행령 만들기` 흐름으로 바꿔 학생이 직접 조립하는 느낌을 강화.
- **[BUILD]** `APP_BUILD` v1.2.134 갱신.

## v1.2.133 — 자료수집 공약 문구 국민 관점 보정 (2026-05-16 / [Codex])
- **[LABEL]** 공약 준비자료 힌트에서 `친구들의 불편사항`, `우리 반이 바라는 점` 표현을 `국민들의 불편사항`, `국민들이 바라는 점`으로 변경.
- **[COPY]** 공약 준비자료 목적 문구도 `친구들의 요구`가 아니라 `국민들의 요구`를 찾는 흐름으로 보정.
- **[BUILD]** `APP_BUILD` v1.2.133 갱신.

## v1.2.132 — 공통 자료수집 양식 역할별 고도화 (2026-05-16 / [Codex])
- **[RESEARCH]** 공통 `ResearchWorkspace`에 공약·입법·정책·재판 준비자료 프리셋을 추가해 `contextKey`별 역할 관점과 목적을 표시.
- **[GUIDE]** 자료수집목록 입력 아래에 역할별 추천 자료 힌트 버튼을 항상 제공하도록 변경.
- **[THINKING]** 기사 메모 placeholder를 맥락별 분석 질문으로 전환: 공약 설득력, 입법 원인/심각성, 정책 실행 장애물, 재판 판단 근거.
- **[TAG]** 기사 자료 저장 시 `사실·통계`, `사례·인터뷰`, `전문가 의견`, `찬반 주장`, `법·제도 사례` 중 자료 성격을 태그로 남길 수 있게 추가.
- **[CONNECT]** 행정부 정책 초안 도움자료 목록에서도 수집 자료의 성격 태그가 함께 보이도록 연결.
- **[BUILD]** `APP_BUILD` v1.2.132 갱신.

## v1.2.131 — 행정부 6단계 정리 및 준비 자료 연결 (2026-05-16 / [Codex])
- **[EXECUTIVE]** 행정부 순서에서 별도 `종료` 단계를 제거해 `준비 → 정책 초안 → 토의 및 평가 → 국무회의(토론) → 예산 조정 → 발표` 6단계로 정리.
- **[LABEL]** 행정부 진행바와 미리보기 안내에서 `초안` 단독 표기를 `정책 초안`으로 보정.
- **[PREP]** 행정부 준비 단계의 자료실 위에 `가결 법령 확인` 카드를 추가해, 정책을 준비할 때 집행해야 할 법령을 먼저 볼 수 있도록 수정.
- **[DRAFT]** 정책 초안 작성 도움칸에 준비 단계에서 모은 자료수집목록과 기사 자료를 읽기 전용으로 표시하도록 연결.
- **[BUILD]** `APP_BUILD` v1.2.131 갱신.

## v1.2.130 — Phase 3 입법·행정 활동 순서 재정리 (2026-05-16 / [Codex])
- **[LEGISLATIVE]** 입법부 순서를 `준비 → 발의 → 토의 및 평가 → 상정 토론 → 표결 → 발표`로 재정리하고, 별도 `종료` 단계는 제거.
- **[LEGISLATIVE]** 발표 단계에서 표결 결과와 의결 종료 법안을 함께 확인하도록 학생 화면·교사 빠른 제어·진행 가이드의 단계명과 단계 번호를 동기화.
- **[EXECUTIVE]** 행정부 순서를 `준비 → 정책 초안 → 토의 및 평가 → 국무회의(토론) → 예산 조정 → 발표 → 종료`로 재정리.
- **[EXECUTIVE]** 브리핑 단계와 기사 단계를 행정부 진행바에서 제거하고, 예산 청구/조정 및 반영/발표 흐름을 각각 한 단계로 합침.
- **[UI]** 브리핑 문구를 `토의 결과·예산 조정 메모`로 바꿔 새 흐름과 맞추고, 행정 결과 기사는 다음 별도 활동에서 작성하도록 안내.
- **[BUILD]** `APP_BUILD` v1.2.130 갱신.

## v1.2.129 — 교사용 미리보기 Phase 3 탭 고정 (2026-05-16 / [Codex])
- **[FIX]** 교사 조정 화면에서 입법 표결 단계로 넘어갈 때 학생 미리보기창이 행정부 `예산 청구 확정`처럼 잘못 보일 수 있는 문제를 보정.
- **[CAUSE]** `StudentScreenPreview`가 `phase3Tab`을 계산만 하고 실제 `Phase3Page`에 전달하지 않아, 미리보기 내부 `Phase3Page`의 자체 탭 상태가 이전 라운드 상태와 섞일 여지가 있었음.
- **[PREVIEW]** `getPhase3PreviewTab`을 추가해 `stepId` 기준으로 입법/행정/사법 미리보기 탭을 판정. `article1/poll2`, `article2/poll3`, `article3/poll4`도 각 라운드로 명시 매핑.
- **[SYNC]** `Phase3Page`에 `forcedTab` prop을 추가해 교사용 미리보기에서는 계산된 라운드 탭을 강제로 사용하도록 수정.
- **[BUILD]** `APP_BUILD` v1.2.129 갱신.

## v1.2.128 — 교사 진행 순서 변경 시 페이지 스크롤 고정 (2026-05-16 / [Codex])
- **[FIX]** 교사용 대시보드에서 행정부 등 다음 순서로 넘길 때 브라우저가 학생 미리보기창 쪽으로 스크롤되는 문제를 보정.
- **[SCROLL]** `preserveWindowScrollAfter` 유틸을 추가해 워크플로 단계 업데이트 전 교사 페이지의 `window.scrollY`를 저장하고, 업데이트 직후 여러 프레임에 걸쳐 원래 위치로 복원.
- **[SCOPE]** 공통 `PhaseWorkflow` 이전/다음 버튼과 Phase 3 입법·행정 빠른 제어 패널의 이전/다음 버튼에 적용.
- **[BUILD]** `APP_BUILD` v1.2.128 갱신.

## v1.2.127 — 기사작성 후 여론조사 이동 보정 (2026-05-16 / [Codex])
- **[FIX]** 입법부에서 이전 단계로 돌아가 기사작성 후 다시 `poll2` 여론조사로 진행할 때, 기사작성 카드만 블러되고 아래 여론조사로 이동하지 않던 문제 수정.
- **[CAUSE]** 여론조사 단계에서도 기사작성 `HighlightBox`가 비활성 블러 카드로 계속 렌더링되고, 새 여론조사 전용 섹션에는 자동 스크롤 트리거가 없었음.
- **[UX]** `lockToPoll` 단계에서는 기사작성 카드를 완전히 접고, `pollSectionRef`로 여론조사/활동요약 카드에 직접 스크롤되도록 보정.
- **[BUILD]** `APP_BUILD` v1.2.127 갱신.

## v1.2.126 — 행정부 준비/집행계획 스크롤 앵커 분리 (2026-05-16 / [Codex])
- **[FIX]** 행정부로 넘어갈 때 학생 화면이 준비 자료실을 건너뛰고 초안/작성 영역으로 내려가는 문제를 보정.
- **[ANCHOR]** `executive-roles` 준비 단계는 `집행계획 근거 자료실` 앵커로 이동하고, `executive-budget` 작성 단계는 실제 집행계획·시행령·예산 작성 폼 앵커로 이동하도록 분리.
- **[COLLAB]** 공동작업 모드에서 작성 폼이 ① 영역 안에 들어 있어도, 별도 `collaborativeDraftRef`로 초안 작성 단계 위치를 정확히 잡도록 수정.
- **[BUILD]** `APP_BUILD` v1.2.126 갱신.

## v1.2.125 — Phase 3 학생 화면 견인 강화 (2026-05-16 / [Codex])
- **[FIX]** `poll2/poll3/poll4` 여론조사 단계에서 학생 화면이 이전 기관 탭 본문(입법 의결 결과·행정 초안 등)에 머무르는 문제를 줄이기 위해, 학생 화면에서는 여론조사 단계 동안 기관 탭 본문을 접고 여론조사/활동요약만 주 화면으로 표시.
- **[SYNC]** 학생 화면의 현재 라운드 계산을 `tab` 상태보다 교사 워크플로에서 추론한 `expectedTab` 우선으로 보정해, 단계 전환 직후에도 헤더·역할카드·요약이 같은 라운드를 가리키도록 수정.
- **[EXEC]** 행정부 `executive-roles` 준비 단계에서 공동작업 모드 학생에게 집행계획 초안 폼이 바로 보이지 않도록 하고, 자료수집·준비 안내를 먼저 표시.
- **[EXEC]** 역할중심 모드에서도 학생이 `executive-roles` 단계에 있을 때 하단 집행계획·예산 초안 작성 섹션이 앞서 보이지 않도록 숨김.
- **[BUILD]** `APP_BUILD` v1.2.125 갱신.

## v1.2.124 — 행정부 미리보기 스크롤이 교사 페이지 전체를 끌어가던 문제 수정 (2026-05-16 / [Claude])
- **[FIX]** v1.2.122 에서 `previewMode` early-return 을 제거했더니, 미리보기 안의 ref 에 `scrollIntoView` 가 호출되어 브라우저가 모든 scrollable ancestor 를 스크롤 — 결과적으로 **교사 대시보드 윈도우 전체가 미리보기 컨테이너 위치로 스크롤** 되던 문제 수정.
- **[REVERT]** `ExecutiveTab.jsx` scroll useEffect 에 `if (previewMode || !isKnown) return` 복원. 미리보기 내부 스크롤은 `HighlightBox` 의 `data-preview-container` 전용 로직(`container.scrollTo`) 이 담당.
- **[BUILD]** `APP_BUILD` v1.2.124 갱신.

## v1.2.123 — poll2/article1 의결종료 펼치기 + 행정 collaborative 모드 budget 스크롤 (2026-05-16 / [Claude])
- **[FIX-LEG]** `LegislativeTab.jsx` 의결 종료 섹션 펼치기 조건 확장: `legislative-result` 만 펼침 → `legislative-result || article1 || poll2` 모두 펼침. 이전엔 poll2 에서 `<details>` 접힌 상태로 그려져 스크롤이 "입법 중간"에 떨어진 듯한 현상.
- **[FIX-EXEC]** 행정 collaborative 모드에서 `budgetRef` wrapper 가 빈 div 라 스크롤이 ① 다음(=draft 끝부분 아래)으로 떨어지던 문제 수정.
- **[ROUTE]** `ExecutiveTab.jsx` budget 스크롤 타겟 분기: collaborative 모드 → `rolesRef` (작성 폼이 ① 안에 있음), 역할중심 모드 → `budgetRef` (별도 ② 섹션).
- **[BUILD]** `APP_BUILD` v1.2.123 갱신.

## v1.2.122 — 행정부 ref 부착 위치 수정 (교사·미리보기에서도 단계 스크롤 동작) (2026-05-16 / [Claude])
- **[FIX]** v1.2.121 에서 추가한 `rolesRef`/`budgetRef` 가 학생-with-group 블록 / role_based 블록 내부에만 부착돼 있어, 교사 보기·미리보기 모드에서는 ref 가 `null` 이 돼 자동 스크롤이 안 되던 문제 수정.
- **[STRUCTURE]** `ExecutiveTab.jsx` ① 영역(역할 배정)과 ② 영역(집행계획·예산) 을 **항상 렌더링되는 wrapper `<div ref={...}>`** 로 감싸 모든 모드(student/teacher/preview) 에서 ref attach 보장.
- **[PREVIEW]** 미리보기 모드에서 ① /② 단계일 때 빈 안내 박스를 표시해 ref 위치 안정성 확보 + 어느 단계인지 시각 표시.
- **[EFFECT]** scroll useEffect 의 `previewMode` early-return 제거 — 학생 미리보기도 단계 전환 시 활성 섹션으로 스크롤되도록.
- **[BUILD]** `APP_BUILD` v1.2.122 갱신.

## v1.2.121 — 입법 종료 후 탭 표시 수정 + 행정부 단계 자동 스크롤 (2026-05-16 / [Claude])
- **[FIX]** poll2/article1 에서 학생이 legislative 탭에 머무를 때 모든 섹션이 노출돼 "입법 준비(발의)" 처럼 보이던 문제 수정.
- **[STAGE-MAP]** `LegislativeTab.jsx` `STAGE_OF_STEP` 에 `article1: 5, poll2: 5` 추가 — 입법 종료 후 단계로 인식해 closed 섹션만 active, 나머지(발의·토의·상정·표결·발표)는 past 로 블러 처리.
- **[FIX]** 행정부에서 다음/이전 단계 누를 때 활성 섹션으로 자동 스크롤이 안 되던 문제 수정 (특히 ② 초안 → ① 역할 뒤로 가기에서 화면이 멈춰 있는 듯한 현상).
- **[SCROLL]** `ExecutiveTab.jsx` 에 입법부 동일 패턴의 스크롤 useEffect 추가 — stepId 변경 시 해당 단계 ref(`rolesRef`/`budgetRef`/`discussRef`/`briefingRef`/`meetingRef`) 로 `scrollIntoView({block:'start'})` 200ms 지연 실행.
- **[ANCHOR]** 행정부 4개 HighlightBox 모두 `scrollBlock="start"` 명시 — 큰 폼(`ExecutivePolicyBudgetDraft` 750줄) 가운데 정렬 시 "초안 중간" 으로 떨어지던 문제 해결.
- **[BUILD]** `APP_BUILD` v1.2.121 갱신.

## v1.2.120 — Phase 3 학생 탭 자동 전환 — poll 단계 매칭 추가 (왔다갔다 시 꼬임 수정) (2026-05-16 / [Claude])
- **[FIX]** 입법→행정 이행 중 `poll2/poll3/poll4` 단계에서 학생 탭이 이전 round 잔류해 다른 단계와 시각적으로 어긋나던 문제 수정.
- **[CAUSE]** `expectedTab` 매칭에서 poll 단계가 어느 round 에도 묶이지 않아 `expectedTab = null` → 탭이 그대로 머무름. 처음 forward 진행 땐 자연스럽게 이전 탭(legislative) 잔류해 OK 였지만, executive→poll2 등 뒤로 가면 executive 탭에 잔류해 잘못된 탭에 머묾.
- **[ROUNDS]** 각 ROUND 에 `pollStepIds` 배열 추가:
  - `legislative.pollStepIds = ['poll2']`
  - `executive.pollStepIds = ['poll3']`
  - `judicial.pollStepIds = ['poll4']`
- **[MATCH]** `expectedTab` 우선순위 재정렬: ①articleStepId → ②pollStepIds(신규) → ③stepId prefix → ④highlight.
- **[BUILD]** `APP_BUILD` v1.2.120 갱신.

## v1.2.119 — 행정부 단계 표시 폴백 수정 (poll2→executive-roles 이행 표시 버그) (2026-05-16 / [Claude])
- **[FIX]** 입법 마지막 여론조사(`poll2`)에서 행정부 첫 단계(`executive-roles`) 로 이동했을 때 QuickPanel/ProgressGuide 가 시각적으로 변화하지 않던 문제 수정.
- **[CAUSE]** 기존 `let stage = wfStage !== undefined ? wfStage : 0` 폴백이 비행정 step(legislative/article/poll)에서도 stage=0 으로 떨어져 행정부 ① 과 동일하게 보였음.
- **[FIX-EXEC]** `stepId.startsWith('executive-') || stepId === 'article2'` 일 때만 실제 stage 사용. 그 외에는 `stage=-1` 로 '⏳ 행정부 시작 전 대기' 상태 표시.
- **[BAR]** 단계 진행 바도 `stage=-1` 일 때는 어떤 점도 done/current 로 표시 안 함 — 행정부 진입 전임을 명확히.
- **[GUIDE]** `ExecutiveProgressGuide.jsx` 의 `WAITING_INFO` 객체 추가 — 대기 상태에서 학생/교사 별 안내 문구 분리.
- **[BUILD]** `APP_BUILD` v1.2.119 갱신.

## v1.2.118 — 행정부 ProgressGuide 이전·다음 라벨 명시 (2026-05-16 / [Claude])
- **[NAV]** `ExecutiveProgressGuide.jsx` 교사용 이전/다음 단계 버튼에 이동 대상 step studentLabel 표기 추가 — QuickPanel·입법부와 동일한 UX 패턴.
- **[GUARD]** 첫·끝 step 에서는 버튼 자동 비활성화 (`disabled={!prevStep}` / `disabled={!nextStep}`).
- **[BUILD]** `APP_BUILD` v1.2.118 갱신.

## v1.2.117 — 행정부 워크플로 stage 중복 제거 + QuickPanel 이전·다음 라벨 명시 (2026-05-16 / [Claude])
- **[FIX]** 행정부 `executive-draft`(stage 0)와 `executive-roles`(stage 0)가 둘 다 stage 0 으로 중복돼 다음 단계를 눌러도 단계 표시가 변하지 않던 문제 수정. `executive-draft` 헤더 step 제거 후 `executive-roles` 가 직접 ① 단계로 동작.
- **[GROUP]** `PhaseWorkflow.jsx` 그룹 마커를 `executive-draft` → `executive-roles` 로 변경. 사이드바 그룹 카드는 그대로 유지.
- **[CLEAN]** `ExecutiveTab.jsx` `KNOWN_EXEC_STEPS` 에서 `executive-draft` 제거. `isRoleStep` 판정도 `executive-roles` 단일 매칭으로 정리.
- **[NAV]** `Phase3ExecutiveQuickPanel.jsx` 의 이전/다음 단계 버튼에 이동 대상 step 라벨 추가 — 입법부 QuickPanel 과 동일한 패턴. 첫·끝 step 에서는 버튼 비활성화.
- **[BUILD]** `APP_BUILD` v1.2.117 갱신.

## v1.2.116 — Phase 3 학생 탭 자동 전환·잠금 강화 + 행정부 자료실 노출 보완 (2026-05-16 / [Claude])
- **[FIX]** 학생 탭이 교사 워크플로 진행을 따라가지 못해 `교사는 행정 / 학생은 입법` 상태로 어긋나던 문제 수정. `Phase3Page.jsx` 의 두 개로 나뉜 자동 전환 useEffect 를 `expectedTab` useMemo + 단일 sync 효과로 통합.
- **[MATCH]** 자동 전환 매칭 우선순위: ①기사 단계(articleStepId) → ②stepId prefix(`executive-roles` → `executive`) → ③currentStep.highlight. 어느 한 가지라도 맞으면 탭 강제 동기화.
- **[LOCK]** 탭 잠금 판정도 `expectedTab` 기준으로 통일 — 입법/행정 모두 동일하게 동작. 잠긴 탭은 `🔒` + 회색 배경 + `cursor-not-allowed` + tooltip(`지금은 다른 라운드 진행 중이라 잠겨 있어요`).
- **[GUARD]** 잠긴 탭 클릭 시 `e.preventDefault()` 로 한 번 더 차단해 disabled 우회 방지.
- **[RESEARCH]** `ExecutiveTab.jsx` 의 ResearchWorkspace(집행계획 근거 자료실)를 학생에게 항상 표시(접이식). 준비/작성/토의 단계는 기본 펼침, 그 외 단계는 접힘. 자료를 후반에도 볼 수 있도록 보완.
- **[BUILD]** `APP_BUILD` v1.2.116 갱신.

## v1.2.115 — 공통 근거 자료실 1차 적용 (2026-05-16 / [Codex])
- **[FEATURE]** 선거 공약 준비폼을 `자료수집목록 작성 → 기사자료수집` 흐름의 공통 `ResearchWorkspace`로 교체.
- **[COMMON]** 같은 자료실 컴포넌트를 선거, 입법, 행정, 사법 준비/초안 영역에 적용해 각 활동별 근거 자료가 별도 맥락으로 저장되도록 구성.
- **[CHECKLIST]** 모둠이 찾을 자료 목록을 2개씩 추가하고, 기사 자료 저장 시 해당 목록을 선택해 `수집 개수/목표 2개`가 표시되도록 구현.
- **[SYNC]** 데이터는 `researchPlans/{contextKey}/{groupId}` 아래 `targets`와 `items`로 분리 저장해 다음 작업자가 작성 도움칸·브리핑 기능과 연결하기 쉽게 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.115`로 갱신.

## v1.2.114 — 입법부 공동작업 대표 미지정 표시 제거 (2026-05-16 / [Codex])
- **[FIX]** 입법부 공동작업 모드에서도 대표/법안 작성자 지정이 필수가 아니므로 공통 부서 배너의 대표 미지정 경고를 숨기도록 수정.
- **[SETTINGS]** 학급설정의 입법부/행정부 공동작업 모드에서는 대표 선택칸을 숨기고, 역할중심 모드에서만 대표를 지정하도록 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.114`로 갱신.

## v1.2.113 — 행정부 공동작업 대표 미지정 표시 제거 (2026-05-16 / [Codex])
- **[FIX]** 행정부 공동작업 모드에서 학생 화면의 부처 카드에 `장관: 미지정`이 표시되던 문제 수정.
- **[MODE]** 행정부 공동작업 모드에서는 대표/장관 지정이 필요하지 않으므로 공통 부서 배너의 대표 미지정 경고도 표시하지 않도록 분기.
- **[BUILD]** `APP_BUILD`를 `v1.2.113`으로 갱신.

## v1.2.112 — 행정부 시행령 템플릿·새창 blank 표시 보정 (2026-05-16 / [Codex])
- **[FORM]** 시행령 초안에 법률안 초안처럼 조항별 템플릿을 추가. 목적, 대상, 시행 절차, 지원 및 예산, 점검 및 예외를 나눠 작성한 뒤 초안에 반영할 수 있게 수정.
- **[UX]** 예산 계산기/통계자료/역할·임무 카드 새창을 `about:blank` 문서 쓰기 방식 대신 Blob HTML로 열어 `blank` 표시가 뜨는 현상을 줄임.
- **[BUILD]** `APP_BUILD`를 `v1.2.112`로 갱신.

## v1.2.111 — 행정부 작성 도구 브라우저 새창 전환 (2026-05-16 / [Codex])
- **[WINDOW]** 통계자료, 예산 계산기, 역할·임무 카드를 앱 내부 레이어가 아니라 브라우저 새창으로 열도록 변경.
- **[BUDGET]** 예산 계산기 새창에서 계산한 값을 `계산 결과를 현재 예산 항목에 반영`으로 원래 작성 화면에 되돌려 저장할 수 있게 연결.
- **[MODE]** 역할·임무 카드는 행정부 `역할중심` 모드에서만 표시하고, `공동작업` 모드에서는 숨김.
- **[CLEANUP]** 이전 내부 레이어/드래그 상태 코드를 제거해 작성 화면을 덜 가리도록 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.111`로 갱신.

## v1.2.110 — 행정부 작성 도구창 드래그 이동 지원 (2026-05-16 / [Codex])
- **[UX]** 통계자료, 예산 계산기, 역할·임무 카드 도구창을 제목줄 드래그로 이동할 수 있게 수정.
- **[WINDOW]** 도구창을 열 때 화면 우측 상단에 배치하고, 드래그 중 화면 밖으로 크게 벗어나지 않도록 위치를 제한.
- **[TOUCH]** 태블릿 환경에서도 제목줄 드래그가 스크롤 제스처로 빼앗기지 않도록 드래그 핸들에 터치 처리를 보강.
- **[BUILD]** `APP_BUILD`를 `v1.2.110`으로 갱신.

## v1.2.109 — 행정부 작성 도구 배치 정리 (2026-05-16 / [Codex])
- **[UX]** `가결 법령 보기`는 근거 법령 영역과 중복되므로 상단 작성 도구에서 제거.
- **[UX]** `예산 계산기`는 예산 항목 카드 안으로 이동해 예산 작성 맥락에서 바로 열리도록 정리.
- **[UX]** 상단 `작성 중 도움` 영역에는 `{국가명} 통계자료`와 `역할·임무 카드`만 가지런히 표시.
- **[WINDOW]** 도구 모달은 화면 전체를 어둡게 덮지 않고, 우측 상단에 적당한 크기의 떠 있는 창처럼 열리도록 변경.
- **[BUILD]** `APP_BUILD`를 `v1.2.109`로 갱신.

## v1.2.108 — 행정부 집행계획·시행령·다중 예산 항목 개편 (2026-05-16 / [Codex])
- **[CONCEPT]** 행정부 초안을 `정책` 중심에서 `가결 법령을 바탕으로 한 집행계획·시행령·예산안` 흐름으로 보정.
- **[LAW]** 입법부에서 가결된 법안(`status: passed`)을 행정부 작성 화면에서 `근거 법령`으로 선택하고 법령 본문을 함께 기록할 수 있게 추가.
- **[FORM]** `시행령 초안` 입력칸 추가. 기존 `정책 내용`은 데이터 호환을 위해 유지하되 화면에서는 `집행계획`으로 표시.
- **[BUDGET]** 예산을 단일 금액에서 여러 `예산 항목`으로 확장. 항목별 제목, 산출 근거, 금액을 관리하고 합계를 초안/청구 예산으로 반영.
- **[TOOLS]** 작성 영역 앞에 `가결 법령 보기`, `통계자료`, `예산 계산기`, `역할·임무 카드` 버튼을 추가하고, 각 도구를 모달 레이어로 열도록 정리.
- **[SYNC]** 온라인 정책토의와 국무회의 패널에서도 근거 법령, 시행령 초안, 예산 항목 목록이 보이도록 반영.
- **[BUILD]** `APP_BUILD`를 `v1.2.108`로 갱신.

## v1.2.107 — 행정부 공동작업 모드 교사용 안내 문구 보정 (2026-05-16 / [Codex])
- **[FIX]** 행정부 공동작업 모드인데 교사 빠른 제어 패널에 `역할카드와 도움카드` 확인 안내가 남던 문제 수정.
- **[UX]** 공동작업 모드에서는 1단계 라벨을 `공동 작업 준비`로 표시하고, 학생들이 함께 정책·예산안을 작성하도록 안내.
- **[MODE]** 역할중심 모드에서는 기존처럼 `역할 배정·임무 확인`, `역할카드와 도움카드` 안내를 유지해 두 모드의 교사용 안내를 분리.
- **[BUILD]** `APP_BUILD`를 `v1.2.107`로 갱신.

## v1.2.106 — 행정부 공동작업 모드 역할 UI 숨김 보정 (2026-05-16 / [Codex])
- **[FIX]** 행정부를 공동작업 모드로 선택해도 학생 화면 상단 공통 영역에 `아직 이 차시 역할이 정해지지 않았어요`, `모둠 4역할 배정/변경`이 남던 문제 수정.
- **[CAUSE]** `ExecutiveTab` 내부는 공동작업 분기가 적용됐지만, 바깥 `Phase3Page` 공통 역할 카드/배정 버튼이 행정부 탭에도 무조건 렌더링되고 있었음.
- **[UX]** 행정부 공동작업 모드에서는 학생 화면의 공통 `RoleCard`와 `RoleAssigner` 버튼을 숨기고, 공동 정책·예산 작성 화면만 보이도록 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.106`으로 갱신하고 재배포.

## v1.2.105 — 행정부 정책·예산 국무회의 1차 구현 (2026-05-16 / [Codex])
- **[FLOW]** 행정부 활동을 `정책·예산 초안 → 온라인 정책토의 → 평가단/교사 브리핑 → 예산 청구 확정 → 국무회의 조정 → 조정안 반영 → 최종 예산안 발표` 흐름으로 확장.
- **[FORM]** 기존 시행령·4분류 예산 중심 폼 대신 부처별 정책 1개와 예산안 1개를 작성하는 `ExecutivePolicyBudgetDraft` 추가.
- **[CALC]** 비빔민국 10만 명 축소 통계와 예산 계산기 추가 — 대상 통계, 대상 비율, 1인당 비용, 횟수, 운영비/홍보비/기타비로 요청 예산 산출.
- **[DISCUSS]** 온라인 정책토의를 찬성/반대/중립 + 예산 의견(유지/증액/감액/재검토) + 3축 평가(과제관련성·실행가능성·공익성) 구조로 구현.
- **[BRIEFING]** 평가단을 운영하지 않는 경우에도 교사가 브리핑을 작성할 수 있는 `ExecutiveCabinetPanel` 추가.
- **[CABINET]** 정부 전체 예산, 총 청구액, 초과/잔여액, 최종 배정 합계를 자동 표시하고 교사가 최종 배정 예산을 조정·확정할 수 있게 구현.
- **[CONFIG]** 학급 설정의 행정부 부처 배치에 국가명·전체 예산·인구·평가단 운영 여부·비빔민국 통계·과제 유형별 추천 부처 템플릿 추가.
- **[ROLE]** 행정부 역할카드를 장관, 정책기획관, 예산담당관, 자료조사관, 시민소통관, 대변인 중심으로 보강.
- **[BUILD]** `APP_BUILD`를 `v1.2.105`로 갱신하고 재배포.

## v1.2.104 — 토론 준비카드 500자·출처 입력 확장 (2026-05-15 / [Codex])
- **[UX]** 학생 토론 전 준비카드의 4개 작성 칸 글자 수 제한을 모두 **500자**로 확대.
- **[FEAT]** 준비카드에 `출처` 입력 영역 추가 — 간략한 제목과 링크를 최대 5개까지 추가 가능.
- **[SAVE]** 임시저장과 제출 데이터에 출처 배열을 포함해 작성 중인 출처도 이어서 불러올 수 있도록 연결.
- **[SYNC]** 학생 카드 목록, 교사 카드 상세 열람, 과거 제출물 상세 보기에서 출처 링크를 함께 표시.
- **[COMPAT]** 기존 준비카드는 출처가 없어도 그대로 표시되도록 호환 처리.
- **[BUILD]** `APP_BUILD`를 `v1.2.104`로 갱신.

## v1.2.103 — 입법부 워크플로 6단계로 확장 — 표결 발표를 정식 단계로 (2026-05-14 / [Claude])
- **[FLOW]** 입법부 5단계(발의·토의·상정+토론·표결·종료) → **6단계**(발의·토의·상정+토론·표결·**발표**·종료) 확장.
- **[STEP]** `PhaseWorkflow.jsx` 에 `legislative-announce` (stage 4) 단계 신규 추가. 기존 `legislative-result` 는 stage 5 로 이동.
- **[QUICKPANEL]** 가로 progress bar 6개 점으로 확장. STAGE_INFO 메시지 6개로 재정렬. 자동 stage 감지 로직 — voteResult 존재 여부로 ④표결 vs ⑤발표 vs ⑥종료 구분.
- **[STUDENT]** `LegislativeTab.jsx` STAGE_OF_STEP 매핑·tabledMode·scrollIntoView 타겟 모두 6단계 기준으로 재조정. tabled 카드 영역이 stage 2·3·4(상정+토론·표결·발표) 동안 노출되도록 확장.
- **[LABEL]** 학생 페이지 정식 상정 카드 헤더가 ⑤ 표결 발표 단계일 때 `📢 결과 발표` 배지 + ⑤ 라벨로 전환.
- **[BUILD]** `APP_BUILD` v1.2.103 갱신.

## v1.2.102 — 표결 발표 단계 BillCard 적용 누락 보완 (2026-05-14 / [Claude])
- **[FIX]** `BillCard.jsx` 에도 표결 발표/마감 2단계 적용 — v1.2.101 에서 QuickPanel·TVBoard·Modal 만 수정해 main Phase 3 페이지의 BillCard에는 반영되지 않은 문제 보완.
- **[BUTTON]** BillCard 의 "표결 마감 + 결과 확정" → 컨텍스트 전환:
  - 발표 전: 🗳️ 표결 발표 (결과 전광판에)
  - 발표 후: ✓ 표결 마감 (전광판 끄기) — emerald + pulse
- **[RENDER]** BillCard 정식 상정 블록 렌더 조건 확장: `status === 'tabled' || (voteResult && billBoardActive)` — 발표 후에도 카드가 사라지지 않아 마감 버튼 접근 가능.
- **[FILTER]** `LegislativeTab.jsx` tabledBills 필터도 동일 확장.
- **[BUILD]** `APP_BUILD` v1.2.102 갱신.

## v1.2.101 — 표결 발표 단계 분리 + 전광판 결과 화면 (2026-05-14 / [Claude])
- **[FLOW]** 표결 흐름을 2단계로 분리: **표결 발표**(결과 확정 + 전광판 결과 모드) → **표결 마감**(전광판 끄기).
- **[STATE]** `billBoard.resultShown` 플래그 신설 — `true` 이면 전광판이 라이브 집계 대신 결과 화면을 표시.
- **[QUICKPANEL]** `Phase3LegislativeQuickPanel.jsx`:
  - `finalizeFinal` → `announceResult` 로 변경 (bill 확정 + billBoard.resultShown=true, active 유지)
  - `closeBoard` 신규 — 전광판 끄기 전용 액션
  - 액션 그리드 3번째 버튼이 컨텍스트 전환: 발표 전 = 🗳️ 표결 발표 / 발표 후 = ✓ 표결 마감(emerald, pulse 강조)
  - tabledBills 필터 확장 — 발표 후에도 전광판 켜 있는 동안은 tabled 카드 영역에 유지
- **[TV]** `TVBoardPage.jsx` 결과 모드 화면 추가 — 찬·반·기권 3열 큼지막 수치, 가결/부결 그라데이션 배너 (재석·찬성 수 명시).
- **[MODAL]** `LegislativeBoardModal.jsx` (학생 풀스크린) 도 동일한 결과 화면 분기 추가 — 발표 직후 학생 태블릿에서도 결과 확인 가능.
- **[BUILD]** `APP_BUILD` v1.2.101 갱신.

## v1.2.100 — 입법부 학생 페이지 단계 전환 자동 스크롤 + 과거 단계 블러 (2026-05-14 / [Claude])
- **[UX]** `LegislativeTab.jsx` 에 단계 전환 시 활성 섹션으로 자동 스크롤 추가 (smooth, block:start).
- **[VISUAL]** 지나간 단계 섹션을 숨김 → 블러+흐림(`opacity-50` + `filter:blur(1.8px) grayscale(40%)` + `pointer-events-none`)으로 변경. 학생이 직전에 한 일을 흐릿하게 인식 가능.
- **[STAGE]** show* boolean 4개를 `STAGE_OF_STEP` 매핑 + `modeFor(stages)` 함수로 재구성 — 'active'/'past'/'hidden' tri-state.
- **[STAGE]** 발의(legUnits + 단일 발의 UI), 토의, 상정+표결, 종료 4개 섹션 각각 ref 부여(`draftRef`, `discussRef`, `tabledRef`, `closedRef`). stepId 변경 시 useEffect 으로 해당 ref 로 scrollIntoView.
- **[BUILD]** `APP_BUILD` v1.2.100 갱신.

## v1.2.99 — 입법부 QuickPanel 패턴 C 리팩토링 (2026-05-14 / [Claude])
- **[UX]** `Phase3LegislativeQuickPanel.jsx` 를 패턴 C(가로 progress bar + 액션 그리드 + 이전·다음 단계 라벨)로 재구성.
- **[STAGE]** 5단계 진행 바를 dot+label 스타일로 업그레이드 — `①발의 → ②토의 → ③상정+토론 → ④표결 → ⑤종료` 시각 강화.
- **[NAV]** 이전/다음 단계 버튼에 이동 대상 step 라벨을 함께 표시 — 어디로 가는지 명확.
- **[RANK]** 토의 중 법안에 명시적 등수 배지(🥇1등 / 🥈2등 / 🥉3등 / 4등...) 표시. 슬라이스(5) 제거 — 전체 순위 노출.
- **[ACTION]** 상정 버튼 라벨에 등수 명시(`✓ 1등 법안 정식 상정 (추천)` / `✓ 2등 법안 정식 상정` 등). `tableThisBill` 함수에 `rankNote` 인자 추가.
- **[REJECT]** 부결 → 다음 후보 안내 배너 신설: `tabledBills` 비어있고 직전 closed 가 `rejected` 이면 빨간 배너 + "② 토의 단계로 돌아가기" 액션. `goReviewNext` 핸들러 추가.
- **[CLOSED]** 의결 종료 법안을 단일 라인 안내문 → ✅ 가결 / ❌ 부결 카드 리스트로 노출 (찬/반/기권 수치 포함).
- **[TABLED]** 정식 상정 법안 카드의 액션(토론 시작·전광판·표결 마감)을 3열 그리드로 정렬, 아이콘+라벨 세로 배치로 누르기 좋게 개선.
- **[BUILD]** `APP_BUILD` v1.2.99 갱신. 제안서: `docs/proposal_phase3_quickpanel_v2.md`.

## v1.2.98 — 토론 준비카드 유형별 입장·문항 전환 (2026-05-14 / [Codex])
- **[UX]** 토론 전 `준비 카드`의 입장 선택지를 토론 종류별로 변경하도록 수정.
- **[TYPE]** 일반 토론은 `찬성/반대/중립`, 국민참여재판은 `검사 측/변호·피고 측/배심원 관점/판단 유보`, 다자간 토론은 A·B팀과 추가 팀명·판정단·중립 관찰, 협의 토론은 `제안측/조율측/수정 제안/합의 가능/보류·우려`를 표시.
- **[FORM]** 국민참여재판은 `사건 판단/증거와 법적 근거/상대 진술의 허점/예상 질문과 답변`, 다자간 토론은 `팀 입장/팀 근거/타팀 반박/대응 전략`, 협의 토론은 `요구·제안/필요 이유/우려 쟁점/조정안` 중심으로 준비카드 문항을 전환.
- **[SYNC]** 학생 카드 목록과 교사 상세 열람에도 같은 문항 라벨을 적용하고, 새 입장 배지 색상을 보강.
- **[BUILD]** `APP_BUILD`를 `v1.2.98`로 갱신하고 재배포.
 
## v1.2.97 — 국민청원 도구 링크 레이아웃 최적화 (2026-05-14 / [Antigravity])

- [x] **레이아웃 재배치**: '네이버뉴스'는 상단 라벨 옆에, 나머지 자료(사과나무당선생님자료, 한국부정적이슈)는 입력창 아래 우측 정렬로 배치하여 가독성을 높였습니다.
- [x] **배포**: v1.2.97 빌드 및 배포 완료.

---

## v1.2.96 — 국민청원 도구 링크 이름 간소화 (2026-05-14 / [Antigravity])

- [x] **링크 이름 단축**: `PetitionForm.jsx`의 참고 자료 링크 이름을 '사과나무당', '한국문제'로 간소화했습니다.
- [x] **배포**: v1.2.96 빌드 및 배포 완료.

---

## v1.2.95 — 행정부 정책 초안 작성 도구 오류 수정 (2026-05-14 / [Antigravity])

- [x] **ReferenceError 수정**: `MinisterPolicyDraft.jsx`에서 `role` 변수가 정의되지 않아 행정부 활동 시 화면이 멈추던 문제를 해결했습니다.
- [x] **배포**: v1.2.95 빌드 및 배포 완료.

---

## v1.2.94 — 국민청원 도구 학습 자료 링크 추가 (2026-05-14 / [Antigravity])

- [x] **추가 링크 연결**: `PetitionForm.jsx`에 '한국부정적이슈' 학습 자료 링크(`triplelight.co/...`)를 추가로 연결했습니다.
- [x] **배포**: v1.2.94 빌드 및 배포 완료.

---
 
## v1.2.93 — 국민청원 도구 학습 자료 링크 업데이트 (2026-05-14 / [Antigravity])

- [x] **청원 도우미 링크 교체**: `PetitionForm.jsx`에서 구글 뉴스 링크를 삭제하고, 사과나무당 선생님의 패들렛 자료 링크(`padlet.com/appletree128909/...`)로 교체했습니다. 라벨 명칭도 '사과나무당선생님자료'로 수정했습니다.
- [x] **배포**: v1.2.93 빌드 및 배포 완료.

---

## v1.2.92 — Phase 1 기사 작성 참고자료 위치 조정 (2026-05-14 / [Codex])
- **[UX]** 첫 번째 여정 기사 작성 활동에서 `실시간 사회적 신뢰도`와 `지지율/나의 선택` 참고자료를 기사 작성 폼 위로 이동.
- **[FLOW]** 학생이 자료를 먼저 확인한 뒤 `나의 여론조사 선택과 이유`를 정리하고, 이어서 기사를 작성하도록 순서 재배치.
- **[CLEANUP]** 기사 아래 참고자료 영역은 `우리 모둠 활동 참고`로 정리해 포스터·글·기사·링크 미리보기만 남김.
- **[BUILD]** `APP_BUILD`를 `v1.2.92`로 갱신하고 재배포.

## v1.2.91 — Phase 1 기사 작성 전 여론조사 이유 정리 배치 (2026-05-14 / [Codex])
- **[UX]** 첫 번째 여정 `기사 작성` 활동에서 기사 작성 칸 위에 `나의 여론조사 선택과 이유` 정리 카드를 배치.
- **[FLOW]** 학생 흐름을 `사후 여론조사 결과 확인 → 선택 이유 저장/수정 → 기사 작성` 순서로 정리.
- **[SAFE]** 기존 `polls/reasons/phase1_poll1/{studentId}` 저장 경로를 그대로 사용해 기존 작성 내용과 호환 유지.
- **[CLEANUP]** 작성 참고 자료 하단에 있던 중복 이유 입력칸은 제거하고, 참고자료에는 지지율·나의 선택 요약만 남김.
- **[BUILD]** `APP_BUILD`를 `v1.2.91`로 갱신하고 재배포.

## v1.2.90 — 여론판 복귀 버튼 문구 정정 (2026-05-14 / [Codex])
- **[UX]** 여론판 상단 복귀 버튼 문구를 `한눈에 여론으로 복귀하기`에서 `이전으로 복귀하기`로 정정.
- **[CLARIFY]** 이 버튼은 `한눈에 여론` 배너 자체가 아니라, 학생이 현재 진행 중인 단계 화면으로 돌아가는 동선임을 문구에 맞게 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.90`으로 갱신하고 재배포.

## v1.2.89 — 여론판에서 한눈에 여론 복귀 버튼 추가 (2026-05-14 / [Codex])
- **[UX]** 학생이 여론판에 들어온 뒤 현재 수업 단계 화면으로 돌아가기 쉽도록 상단에 큰 복귀 버튼 추가.
- **[SAFE]** 현재 페이즈에 따라 `/phase1`, `/phase2`, `/phase3`, `/reflection`으로 돌아가도록 경로를 매핑해 잘못된 `/phase4` 이동을 방지.
- **[BUILD]** `APP_BUILD`를 `v1.2.89`로 갱신하고 재배포.

## v1.2.88 — 여론판 이후 차시 여론조사 사전 노출 차단 (2026-05-14 / [Codex])
- **[FIX]** 여론판 여론조사 아카이브에서 아직 수업 워크플로가 도달하지 않은 이후 차시의 계획 여론조사가 미리 보이던 문제 수정.
- **[RULE]** 여론판에는 `published` 상태이면서 현재 페이즈·단계까지 도달한 계획 여론조사 결과만 표시하고, 미래 단계의 결과는 게시 상태여도 숨김.
- **[SAFE]** 수시 여론조사는 기존처럼 게시된 결과만 표시하되, 계획 여론조사는 `phaseStep`과 `workflow/phaseN.stepIndex`를 비교해 공개 가능 여부를 판단.
- **[SYNC]** 여론판 아카이브, 기사 섹션 내 여론 브리핑, 학생 우측 여론 배너가 같은 공개 가능 판정 규칙을 사용하도록 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.88`로 갱신하고 재배포.

## v1.2.87 — Phase 1 포스터 Canva 탭 선택 유지 수정 (2026-05-14 / [Codex])
- **[FIX]** 캠페인 포스터 등록에서 `Canva 붙여넣기` 탭을 누르면 곧바로 `사진 올리기` 탭으로 되돌아가던 문제 수정.
- **[CAUSE]** 기존 포스터 정보를 폼에 불러오는 초기화 로직이 부모 화면 재렌더링 때마다 실행되어 사용자의 탭 선택을 덮어쓰던 것이 원인.
- **[SAFE]** 초기화 기준을 포스터 ID와 실제 저장 시각(`createdAt/updatedAt`) 변화로 제한해, 데이터가 실제로 바뀐 경우에만 폼을 다시 맞추도록 조정.
- **[BUILD]** `APP_BUILD`를 `v1.2.87`로 갱신하고 재배포.

## v1.2.86 — Phase 1 캠페인 포스터 사진·Canva 선택 등록 (2026-05-14 / [Codex])
- **[FEAT]** 첫 번째 여정 캠페인 포스터 등록을 `사진 올리기`와 `Canva 붙여넣기` 중 선택할 수 있도록 확장.
- **[FEAT]** 후보 등록 화면의 Canva 임베드 코드/링크 처리 방식을 공통 유틸로 분리하고, Phase 1 포스터에도 같은 방식으로 임베드 URL을 추출·표시.
- **[UX]** Canva 포스터 입력 시 임베드 코드나 공유 링크를 붙여넣으면 즉시 미리보기를 보여주고, 기존 사진 업로드 흐름은 그대로 유지.
- **[SYNC]** 모둠 활동 미리보기, 캠페인 광장, 포스터 갤러리, 교사/학생 제출물 확인 화면에서 사진 포스터와 Canva 포스터를 모두 표시하도록 정리.
- **[SAFE]** 기존 `imageUrl` 포스터 데이터는 그대로 지원하고, 새 Canva 포스터는 `canvaUrl`/`posterType` 필드로 저장해 과거 데이터와 호환 유지.
- **[BUILD]** `APP_BUILD`를 `v1.2.86`으로 갱신하고 재배포.

## v1.2.85 — <배포주소> 포스터 업로드 경로 고정 (2026-05-14 / [Codex])
- **[FIX]** `<배포주소>`으로 접속해도 포스터 업로드가 `https://<배포주소>/class_democra/업로드엔드포인트` 원본 서버 엔드포인트로 전송되도록 클라이언트 업로드 경로를 고정.
- **[SAFE]** `<배포주소>`, `<배포주소>`, `<배포주소>`, 로컬 개발 주소가 모두 같은 업로드 엔드포인트를 사용하도록 정리해 도메인별 파일 위치 차이로 인한 실패를 방지.
- **[VERIFY]** `Origin: https://<배포주소>` 조건에서 `업로드엔드포인트` CORS preflight 성공 확인.
- **[BUILD]** `APP_BUILD`를 `v1.2.85`로 갱신하고 재배포.

## v1.2.84 — 포스터 업로드 CORS 복구 및 배포 버전 정렬 (2026-05-14 / [Codex])
- **[FIX]** `업로드엔드포인트`의 CORS 허용 조건을 확장해 `localhost`뿐 아니라 로컬 IP, `.local`, `<배포주소>`, `<배포주소>` 접속에서도 포스터 업로드가 막히지 않도록 수정.
- **[FIX]** 클라이언트 업로드 URL 계산을 `new URL()` 기반으로 정리해 `/class_democra/app`, `/class_democra/app/index.html` 등 접속 경로 차이에 흔들리지 않도록 보강.
- **[VERIFY]** 작은 PNG 파일로 `https://<배포주소>/class_democra/업로드엔드포인트` 직접 업로드 성공 확인.
- **[VERIFY]** `Origin: http://192.168.0.20:5173` 조건에서 CORS preflight와 실제 POST 업로드 모두 성공 확인.
- **[BUILD]** `APP_BUILD`를 `v1.2.84`로 갱신하고 재배포.

## v1.2.83 — 포스터 업로드 오류 수정 및 안정화 (2026-05-14 / [Antigravity])

- [x] **업로드 URL 로직 개선**: 접속 경로(index.html 포함 여부 등)에 상관없이 서버의 `업로드엔드포인트`를 정확히 찾도록 URL 생성 로직을 `split('/app')[0]` 방식으로 개선했습니다. (기존 정규식 매칭 오류 수정)
- [x] **로컬 개발 환경 감지 확장**: IP 주소나 `.local` 호스트네임으로 접속한 경우에도 로컬 개발 환경으로 인식하여 서버 서버로 업로드가 정상 진행되도록 수정했습니다.
- [x] **업로드 UX 개선**: 포스터 미리보기 메모리 해제 로직 추가, 상세 에러 로깅 추가 및 에러 UI 가독성을 높였습니다.

---
 
## v1.2.82 — 교사용 제출물 통합 열람 UX 고도화 (2026-05-14 / [Antigravity])

- [x] **클릭형 모니터링**: 학생 활동 모니터, 과거 토론 기록 등의 모든 '숫자' 지표를 클릭 가능하게 변경했습니다. 클릭 시 해당 제출물의 실제 내용을 팝업으로 즉시 확인할 수 있습니다.
- [x] **학급 설정 통합 열람**: 학급 설정의 번호별 명찰을 클릭하여 해당 학생의 전체 제출물(기사, 포스터, 소감문 등)을 즉시 조회할 수 있습니다.
- [x] **모둠 포스터 확대**: 모둠 구성 현황에서 모둠 이름을 클릭하면 캠페인 포스터를 큰 창으로 즉시 열람할 수 있습니다.
- [x] **토론 대본 줌**: 토론 관리 도구에서 작성 중인 대본을 '확대' 버튼을 통해 큰 창으로 시원하게 읽을 수 있습니다.
- [x] **공통 모달 컴포넌트**: 모든 제출물 유형에 대응하는 `SubmissionDetailModal`을 구축하여 일관된 열람 경험을 제공합니다.

---
 
## v1.2.81 — 교사용 학생 제출물 통합 모니터링 시스템 구축 (2026-05-14 / [Antigravity])

- [x] **통합 제출물 열람**: 교사 대시보드 상단에 '🔍 제출물 열람' 도구를 추가했습니다. 기사, 후보 등록, 지지 선언, 법안, 소송, 정리글 등을 한곳에서 모아볼 수 있습니다.
- [x] **토론 도구 고도화**: 교사가 토론 준비 카드(Prep Card)의 상세 내용을 클릭하여 즉시 확인할 수 있는 기능을 추가했습니다.
- [x] **실시간 대본 모니터링**: 팀별로 작성 중인 토론 대본을 교사가 실시간으로 열람할 수 있는 섹션을 추가했습니다.

---
 
## v1.2.80 — 모든 대본 양식 말투 통일 및 격식 보강 (2026-05-14 / [Antigravity])

- [x] **말투 통일**: 모든 토론 모드의 대본 양식을 선생님이 제공하신 격식 있는 말투('습니다/합니다')로 통일했습니다.
- [x] **학습 효과 강화**: 격식을 갖추면서도 초등학생 수준의 쉬운 어휘를 유지하여 교육적 효과를 높였습니다.

---
 
## v1.2.79 — 초등 4학년 수준 어휘 조정 및 양식 레이아웃 정돈 (2026-05-14 / [Antigravity])

- [x] **어휘 수준 최적화**: 다자간·재판·협의 토론의 대본 양식을 초등학교 4학년 학생들이 이해하기 쉬운 쉬운 우리말로 전면 수정했습니다.
- [x] **찬반 양식 레이아웃 개선**: 찬반 토론 양식의 원문은 유지하되, 작성하기 편하도록 간결하고 깔끔하게 레이아웃을 다듬었습니다.

---
 
## v1.2.78 — 토론 모드별 맞춤형 대본 양식 적용 (2026-05-14 / [Antigravity])

- [x] **모드별 양식 세분화**: 다자간 토론, 국민참여재판, 협의 토론 등 각 토론 모드의 특성에 맞는 전문적인 대본 양식을 추가했습니다.
- [x] **재판 및 협의 전용 템플릿**: 검사/변호인 모두진술, 배심원 평결문, 조정위원 합의 권고안 등 역할에 특화된 문구를 제공합니다.

---
 
## v1.2.77 — 토론 대본 학습용 양식 고도화 (2026-05-14 / [Antigravity])

- [x] **대본 양식 고도화**: 국어 수업 모델(1~3단계: 주장-반론-다지기)에 맞춘 정교한 대본 양식을 적용했습니다.
- [x] **평가단 양식 최적화**: 판정단 대표가 토론 결과를 요약하고 승자를 발표할 때 사용할 수 있는 전용 양식을 추가했습니다.

---
 
## v1.2.76 — 토론 준비 카드 항목 세분화 (2026-05-14 / [Antigravity])

- [x] **반론 항목 분리**: 토론 준비 카드의 '반론 및 대응' 칸을 '상대측 주장에 대한 반론'과 '상대측 반론 예상 및 대응'의 두 가지 구체적인 항목으로 나누었습니다.
- [x] **글자 수 한도 상향**: 항목이 세분화됨에 따라 각 칸의 글자 수 제한을 150자에서 200자로 늘려 더 풍부한 내용을 담을 수 있게 했습니다.

---
 
## v1.2.75 — 평가단 대본 작성 기능 추가 (2026-05-14 / [Antigravity])

- [x] **평가단 대본 지원**: 이제 평가단 학생들도 최종 판정 결과를 정리할 수 있는 대본 작성 기능을 사용할 수 있습니다.
- [x] **판정 양식 제공**: 인사, 평가 기준, 판정 근거, 마무리로 구성된 평가단 전용 대본 양식을 추가했습니다.
- [x] **평가단 프롬프트**: 토론 중 또는 판정 시 평가단이 작성한 내용을 뉴스 프롬프트 화면에서 확인할 수 있습니다.

---
 
## v1.2.74 — 토론 대본 도구 노출 버그 수정 (2026-05-14 / [Antigravity])

- [x] **대본 도구 가시성 수정**: '대본 작성' 도구만 단독으로 켜졌을 때 학생 화면에서 대기 문구에 가려지거나 플로팅 버튼이 활성화되지 않던 문제를 해결했습니다.
- [x] **탭 노출 조건 최적화**: 토론 전 단계에서 대본 작성 도구가 활성화되면 '토론 전' 탭이 정상적으로 나타나도록 로직을 보강했습니다.

---
 
## v1.2.73 — 토론 대본(프롬프트) 기능 및 토론 카드 전체 공개 (2026-05-14 / [Antigravity])

- [x] **공동 대본 작성 도구**: 토론 전 진영별로 공동 대본을 작성하고 실시간으로 공유할 수 있는 '대본 작성' 기능을 추가했습니다. (빈칸 채우기 양식 포함)
- [x] **뉴스 앵커 프롬프트**: 토론 중 타이머 아래에 '뉴스 프롬프트'를 배치하여, 학생들이 작성한 대본을 보며 자연스럽게 발언할 수 있도록 지원합니다. (글자 크기 조절 기능 포함)
- [x] **토론 카드 전체 펼침**: 토론 중에는 우리 진영 친구들이 작성한 토론 준비 카드를 페이징 없이 한눈에 볼 수 있도록 레이아웃을 개선했습니다.
- [x] **교사 대본 관리**: 교사 대시보드에서 대본 도구의 노출을 제어하고, 각 진영의 대본 작성 완료 여부를 실시간으로 확인할 수 있습니다.

---

## v1.2.69 — Phase 2 선거 9단계 학생 페이지 재구성 및 PollFeed 버그 수정 (2026-05-14 / [Claude])

- [x] **PollFeed.jsx `isSelected` scope 버그 수정**: `sortedOptions.map` 내부 변수를 외부에서 참조하던 ReferenceError 위험을 `!!tempSelections[poll.id]` 로 교체. `allowReason: true` 여론조사 활성화 시 화면 크래시 방지.
- [x] **Phase2Page.jsx 9단계 학생 페이지 재구성** (`Phase2Page.jsx`): 모든 섹션에 ①~⑨ 번호 표기 및 단계별 노출 로직 정비.
  - **1단계 자료수집**: `prep` 또는 `register` 스텝에서 노출.
  - **2단계 후보등록/지지선언**: `register` 스텝에서만 노출, 섹션 헤더 번호 추가.
  - **3단계 후보비교/아고라**: `agora~vote` 스텝 (debatePrep 제외). 아고라 단계에서 투표 버튼 없음을 명시 안내 문구 추가 ("⚠️ 이 단계에서는 투표하지 않습니다").
  - **4단계 사전여론조사**: `prepoll` 스텝만 노출 + "아직 투표가 아닙니다" 안내.
  - **5단계 토론준비** (신규): `debatePrep` 스텝에서만 노출. 1·2위 후보 카드만 상단에 배지(`🥇 1위/🥈 2위`)로 강조, 지지모둠·평가단 역할 안내 박스 포함. 여론조사 결과 미집계 시 안내 문구.
  - **6단계 토론평가/기사작성**: `debateEval` 스텝에서만 ArticleSection 노출.
  - **7단계 투표소/결과**: `vote` 스텝에서 투표 버튼 활성 + 결과 패널.
  - **8단계 결과 기사**: `finalNews` 스텝에서 ArticleSection 노출.
  - **9단계 다음여정 안내**: `nextJourney` 스텝에서 결과 패널 + 국정 포털 안내.

---

## v1.2.72 — 선생님용 여론판 표시 최적화 (2026-05-14 / [Antigravity])

- [x] **종료된 결과만 표시**: 선생님이 여론판(NewsBoard)에 접근할 때, 진행 중인 여론조사는 숨기고 이미 결과가 게시된(status='published') 항목들만 보이도록 수정했습니다.

---

## v1.2.71 — 찬반 의견 레이아웃 개선 (2026-05-14 / [Antigravity])

- [x] **찬반 의견 한 줄 레이아웃 적용**: `StanceComments.jsx`의 의견 목록을 게시판 방명록 스타일로 개선했습니다. 의견, 작성자 번호, 삭제 버튼(x)이 한 줄에 자연스럽게 이어지도록 레이아웃을 최적화했습니다.
- [x] **작성자 표시 간소화**: 닉네임을 제외하고 번호만 표시하여 가독성을 높였습니다.

---

## v1.2.70 — 여론판 상시 접근 및 국정 브리핑 기능 (2026-05-14 / [Antigravity])

- [x] **학생 여론판 접근 허용**: `StudentAutoNavigator.jsx`에서 `/news` 및 `/gallery` 경로를 허용하여, 학생들이 활동 중에도 자유롭게 여론판에 들어가 기사를 읽고 작성할 수 있도록 수정했습니다.
- [x] **국정 브리핑(누적 아카이브) 추가**: `NewsBoardPage.jsx` 상단에 `OpinionBriefing` 컴포넌트를 추가하여 최우선 과제, 선거 결과, 통과된 법안 등 지금까지의 주요 국정 흐름을 한눈에 볼 수 있게 했습니다.

---

## v1.2.69 — 미리보기 안정화 및 후보 등록 기능 개선 (2026-05-14 / [Antigravity])

- [x] **미리보기 스크롤 방지**: `Phase2Page.jsx`에서 `HighlightBox`에 `previewMode`를 누락하여 발생하던 교사용 페이지의 스크롤 점프 현상을 해결했습니다.
- [x] **후보자 선택 기능 추가**: `CandidateRegister.jsx`에서 모둠원 중 한 명을 후보로 선택할 수 있는 기능을 추가했습니다. (기존은 본인 고정)

---

## v1.2.68 — 긴급 오류 수정 (2026-05-14 / [Antigravity])

- [x] **ReferenceError 수정**: `CandidateRegister.jsx` 및 `DebatePrepCard.jsx`에서 `useEffect` 임포트 누락으로 인해 발생하던 런타임 오류를 해결했습니다.

---

## v1.2.67 — Phase 3 입법 역할 4인 재편, 역할 표시 버그 수정, 빌드 오류 일괄 수정 (2026-05-14 / [Claude])

- [x] **입법 역할 4인 구조로 재편** (`scaffolding-data.js`): 기존 5역할(billDrafter/researcher/speaker/recorder/rebuttal)을 4인 모둠에 맞게 재설계.
  - `대표(billDrafter)` — `isRepresentative: true` + `assignedSection: 'rebuttal'` (우려 대응 초안 + 전 섹션 검토·최종 확정)
  - `조사역(investigator)` — `assignedSection: 'background'` (입법 배경 섹션 작성)
  - `논리역(logician)` — `assignedSection: 'clause'` (핵심 조항 섹션 작성)
  - `분석역(analyst)` → `assignedSection: 'effect'` (예상 효과 섹션 작성)
- [x] **SECTION_META 갱신** (`BranchUnitWorkspace.jsx`): `background/clause/effect/rebuttal` 섹션 라벨·플레이스홀더 정비.
- [x] **섹션 필터 수정** (`BranchUnitWorkspace.jsx`): `r.assignedSection && !r.isRepresentative` → `r.assignedSection`으로 변경하여 대표가 담당하는 rebuttal 섹션도 목록에 포함.
- [x] **역할 표시 안 되는 버그 수정** (`RoleAssigner.jsx`, `GroupRoleSummary.jsx`): Firebase config에 `roles` 키가 없을 때 역할 목록이 비어 배지가 안 보이던 문제. `DEFAULT_ROLES[kind]` fallback 추가로 해결.
- [x] **메모카드 헤더 분기** (`BranchUnitWorkspace.jsx`): branch에 따라 "법안/정책/변론 작성자 메모 카드"로 표시.
- [x] **Antigravity 임시저장 기능 빌드 오류 수정** (4개 파일): 임시저장 추가 시 `useEffect(() => {` 오프닝 블록이 누락되어 발생한 구문 오류를 복구.
  - `WritingEditor.jsx` — editing 시 폼 초기화 useEffect 재삽입
  - `ArticleEditor.jsx` — 동일 패턴 복구
  - `BillTemplate.jsx` — editing 시 값 로드 useEffect 재삽입 + 중복 `</div>` 제거
  - `MinisterPolicyDraft.jsx` — `try` 블록 내 중복 `}` 제거

---

## v1.2.66 — 오류 수정 및 임시저장/여론판 고도화 (2026-05-14 / [Antigravity])

- [x] **ReferenceError 수정**: `PollFeed.jsx`에서 `isEditing` 변수 스코프 문제로 발생하던 런타임 오류를 해결하여 투표 화면 안정성을 확보함.
- [x] **글쓰기 임시저장 기능**: 후보등록, 기사, 지지선언, 토론준비, 입법, 정책 등 모든 주요 글쓰기 폼에 **로컬 임시저장(Draft Save)** 기능을 추가하여 네트워크 환경 불안정 등에 대비함.
- [x] **여론판 접근성 강화**: Phase 2의 모든 단계에서 여론판(기사 작성 및 확인)에 상시 접근할 수 있도록 노출 조건을 완화함.
- [x] **실시간 여론 브리핑**: 여론판 상단에 종료된 여론조사 1위 결과와 토론 활동 요약을 누적해서 보여주는 브리핑 영역을 신설함.

---

## v1.2.65 — 선거 페이즈(Phase 2) 9단계 워크플로 및 여론조사 고도화 (2026-05-14 / [Antigravity])

- [x] **9단계 워크플로 정립**: 선거 준비부터 다음 여정 안내까지 총 9개 단계로 세분화하고, 각 단계별로 필요한 학생 화면 UI(자료실, 등록, 아고라, 투표 등)만 노출되도록 제어함.
- [x] **여론조사 '이유 쓰기' 기능**: 여론조사 참여 시 선택 근거를 작성할 수 있는 칸을 추가함. 교사가 [학급 설정]에서 이유 쓰기 여부를 토글할 수 있으며, 결과 화면에서 이유 목록을 함께 확인할 수 있음.
- [x] **투표 시점 제어 및 안내 강화**: 실제 투표 단계(7단계)에서만 투표 버튼이 활성화되도록 개선하고, 투표 모달에 '선거 4원칙(보통·평등·직접·비밀)' 안내 문구를 삽입함.
- [x] **이미지 업로드 기능 완전 제거**: 캔바(Canva) 활용을 통한 고화질 홍보물 운영에 집중하기 위해 기존의 사진 업로드 로직과 버튼을 모두 삭제하여 인터페이스를 간결화함.

---

## v1.2.64 — 선거 페이즈(Phase 2) 레이아웃 전면 개편 (2026-05-14 / [Antigravity])

- [x] **포스터 캔바 대체**: 선거 포스터를 이미지 업로드 대신 캔바 임베드 링크로 등록할 수 있도록 개선하여 고화질 홍보물을 지원함.
- [x] **등록 실시간 미리보기**: 후보 캠프 등록 및 수정 폼 하단에 실제 후보 카드가 어떻게 보일지 실시간으로 렌더링하는 미리보기 섹션 추가.
- [x] **정보 노출 순서 최적화**: [이름 → 출마 선언 → 포스터 → 공약 → 카드뉴스 → 지지 선언 → 토론 의견] 순으로 레이아웃을 재배치함.
- [x] **아고라 방명록 스타일 개편**: 찬반 한줄 의견의 테두리와 박스를 제거하고, 얇은 구분선만 사용한 깔끔한 방명록/게시판 스타일로 디자인 변경.

---

## v1.2.63 — 캔바 임베드 코드 자동 추출 기능 추가 (2026-05-14 / [Antigravity])

- [x] **캔바 연동 편의성**: 캔바에서 복사한 '임베드 HTML 코드'를 통째로 붙여넣으면, 자동으로 `iframe`의 `src` 주소만 추출하여 저장하는 기능을 추가함.

---

## v1.2.62 — 서버 응답 상세 진단 기능 추가 (2026-05-14 / [Antigravity])

- [x] **고급 디버깅**: 서버가 HTML 응답을 보낼 경우 `<title>` 태그를 추출하여 에러 메시지(예: 404, 500, 413)에 포함하도록 개선.

---

## v1.2.61 — 업로드 서버 보안 및 CORS 호환성 강화 (2026-05-14 / [Antigravity])

- [x] **CORS 허용 범위 확대**: `localhost`의 모든 포트에서 업로드 서버에 접근할 수 있도록 정규표현식 기반 CORS 처리를 적용함.
- [x] **업로드 디버깅 고도화**: 클라이언트(`upload-helper.js`)에서 서버 응답 텍스트를 더 명확히 파악할 수 있도록 에러 메시지 보강.
- [x] **코드 안정화 및 배포**: `Phase2Page.jsx`의 JSX 문법 오류를 수정하고 **v1.2.61** 정식 배포를 완료함.

---

## v1.2.60 — 이미지 업로드 안정화 및 후보 수정 기능 추가 (2026-05-14 / [Antigravity])

- [x] **업로드 서버 보호**: `업로드엔드포인트`에서 PHP 경고/오류가 JSON 응답을 오염시키지 않도록 출력 버퍼(`ob_clean`) 및 오류 억제 로직을 강화함.
- [x] **업로드 디버깅 강화**: `upload-helper.js`에서 JSON 파싱 실패 시 서버 응답 텍스트 일부를 에러 메시지에 노출하여 원인 파악이 용이하도록 개선함.
- [x] **후보 수정 기능 도입**: 이미 등록된 후보 캠프 정보(공약, 캔바 링크 등)를 다시 수정할 수 있도록 `[⚙️ 수정하기]` 버튼 및 수정 모드 UI를 추가함.

---

## v1.2.59 — 선거 페이즈(Phase 2) 고도화: 캔바 연동 및 아고라 개편 (2026-05-14 / [Antigravity])

- [x] **공약 개발용 자료실 통합**: 후보 등록 전 공약 근거를 수집할 수 있도록 Phase 2 상단에 `LinkBoard` 및 `LinkSubmit` 섹션을 추가함.
- [x] **캔바(Canva) 카드뉴스 연동**: 후보 등록 시 캔바 링크를 입력받아 저장하고, 후보 카드 및 투표 모달에서 임베드(iframe) 형식으로 미리보기를 제공함.
- [x] **캔바 임베드 가이드 추가**: `CandidateRegister`에 캔바의 '임베드(</>)' 공유 기능을 사용하도록 안내하는 상세 힌트 박스 추가.
- [x] **아고라(찬반 토론) 레이아웃 최적화**: 의견 입력폼을 하단으로 이동하고, 찬성/반대 의견이 좌우 병렬로 배치되어 비교가 용이하도록 UI를 전면 개편함.

---

## v1.2.58 — 예시 법안 상태값 호환 및 수정 잠금 해제 (2026-05-14 / [Codex])
- **[FIX]** demo24의 그린피스(환경) 예시 법안처럼 `status: approved`로 미리 생성된 구버전 법안을 토의 중 법안으로 호환 처리해 `우리 모둠 법안` 수정·삭제·상정 요청이 가능하도록 수정.
- **[SAFE]** 법안 상태 정규화 유틸을 추가해 `approved`, `voting`, 누락 상태값 등 비최종 상태는 `discussion`으로 다루고, `tabled/passed/rejected`만 수정 잠금 상태로 유지.
- **[UX]** `templateData`가 없는 예전 본문형 법안도 수정 모드 진입 시 제목과 기존 본문을 최대한 불러오도록 보강.
- **[SYNC]** 학생 법안 카드, 입법 탭 토의 목록, 교사 Phase 3 빠른 제어 패널, 본회의 진행 가이드가 같은 법안 상태 판정 규칙을 사용하도록 정리.
- **[DATA]** demo24의 그린피스(환경) `bill_1` 상태값을 `approved`에서 `discussion`으로 정리해 현재 접속 중인 화면에서도 수정 버튼이 열리도록 보정.
- **[BUILD]** `APP_BUILD`를 `v1.2.58`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-CzB-bw-8.js` 기준 `APP_BUILD v1.2.58`, 예전 `approved` 법안 상태 호환 로직 반영 확인.

## v1.2.57 — 입법부 정식 상정 취소 시 온라인 토의 단계 복귀 (2026-05-13 / [Codex])
- **[FIX]** 교사가 법안을 정식 상정한 뒤 다음 단계로 넘어가도 `상정 취소`를 누르면 법안 상태와 수업 워크플로가 함께 `입법 ② 온라인 법안 토의`로 되돌아가도록 수정.
- **[SAFE]** 상정 취소 시 전광판을 끄고, 진행 중이던 표결 데이터(`finalVotes`, `voteResult`, `finalizedAt`)를 초기화해 재상정 시 이전 표결이 남지 않도록 처리.
- **[UX]** Phase 3 입법부 빠른 제어 패널의 되돌리기 버튼을 작은 `↩`에서 명확한 `상정 취소` 버튼으로 변경.
- **[UX]** 교사 워크플로 안내의 법안 평가 기준 문구를 `공익성·실행가능성·법적 타당성`으로 최신화.
- **[BUILD]** `APP_BUILD`를 `v1.2.57`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-CGAlOufM.js` 기준 `APP_BUILD v1.2.57`, `온라인 법안 토의 단계로 되돌릴까요`, `진행 중이던 표결 데이터`, `상정 취소` 문구 반영 확인.

## v1.2.56 — 입법부 법안 평가 기준 분리 및 교사용 온라인 평가 확인 강화 (2026-05-13 / [Codex])
- **[UX]** 법안 댓글평가 기준을 주장/포스터 평가형 `주제·실현·설득`에서 법안 검토형 `공익성·실행가능성·법적 타당성`으로 분리.
- **[SAFE]** 기존 `ratings.relevance/feasibility/logic` 데이터 키는 유지하고 화면 라벨만 분리해 과거 평가 데이터와 평균 계산 호환성 유지.
- **[FEAT]** 교사 Phase 3 입법부 빠른 제어 패널에서 각 법안의 `상정 검토 내용`과 온라인 댓글평가 전체 목록을 펼쳐 볼 수 있도록 추가.
- **[UX]** 빠른 제어 패널의 토의 중 법안 카드에 댓글평가 건수를 표시하고, 각 댓글의 학생 번호·닉네임·공익/실행/타당 점수·본문을 함께 노출.
- **[BUILD]** `APP_BUILD`를 `v1.2.56`으로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-1WQWGilU.js` 기준 `APP_BUILD v1.2.56`, `공익성`, `법적 타당성`, `상정 검토 내용`, `온라인 댓글평가` 문구 반영 확인.

## v1.2.55 — 입법부 법안 상정 요청·교사 추천·학생 수정 흐름 정리 (2026-05-13 / [Codex])
- **[FEAT]** 입법부 토의 중 법안에 학생용 `상정 요청` / `상정 요청 취소` 흐름을 추가.
- **[FEAT]** 상정 요청 전에는 자기 모둠 법안을 수정·삭제할 수 있고, 요청 후에는 먼저 취소해야 수정·삭제할 수 있도록 안전 잠금 적용.
- **[FEAT]** 교사가 토의 중 법안에 `교사 추천`을 표시하거나 추천을 취소할 수 있도록 법안 카드와 교사 빠른 제어 패널에 버튼 추가.
- **[UX]** 교사 추천·학생 상정 요청 배지를 법안 카드와 빠른 제어 패널에 표시하고, 추천/요청 법안이 토의 목록 상단에 오도록 정렬 기준 개선.
- **[SAFE]** 정식 상정 시 학생 상정 요청 플래그를 자동 정리하고, 정식 상정 취소 버튼 문구를 명확하게 조정.
- **[BUILD]** `APP_BUILD`를 `v1.2.55`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-pbOKAu-_.js` 기준 `APP_BUILD v1.2.55`, `상정 요청 취소`, `교사 추천` 문구 반영 확인.

## v1.2.54 — Phase 3 최우선 과제 확인 후 학생 대기 화면 유지 (2026-05-13 / [Codex])
- **[FIX]** 세 번째 여정 `최우선 과제 다시 보여주기` 단계에서 학생이 `내용을 확인했습니다`를 누르면 입법 화면으로 바로 들어가던 흐름을 차단.
- **[UX]** 확인 버튼을 누르면 버튼 문구가 `입장 준비중입니다`로 바뀌고, 선생님이 다음 단계로 넘길 때까지 현재 최우선 과제 보고서 화면에 머물도록 수정.
- **[SAFE]** 교사 워크플로가 `입법 ① 법안 발의` 등 다음 단계로 이동할 때만 브리핑 모달이 사라지도록 로컬 확인 상태를 재정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.54`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-DXEYyEYk.js` 기준 `입장 준비중입니다` 문구와 `APP_BUILD v1.2.54` 반영 확인.

## v1.2.53 — Phase 3 부서별 모둠 중복 배치 제한 정리 (2026-05-13 / [Codex])
- **[FIX]** 학급설정 > Phase 3 부서 배치에서 같은 부서 안에 이미 선택된 시민단체가 같은 부서의 다른 역할 드롭다운에 다시 나오지 않도록 수정.
- **[RULE]** 입법부는 법안 모둠/평가단 전체, 행정부는 부처 모둠/평가단 전체, 사법부는 검사·변호/원고·피고/평가단 전체를 각각 하나의 부서로 보고 부서 내부 중복을 차단.
- **[SAFE]** 다른 부서 간 교차 배치는 기존처럼 허용하고, 이미 중복 저장된 기존 데이터는 드롭다운에 경고 옵션으로 남겨 교사가 직접 정리할 수 있게 유지.
- **[BUILD]** `APP_BUILD`를 `v1.2.53`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-ePOo0Qk9.js` 기준 `APP_BUILD v1.2.53` 반영 확인.

## v1.2.52 — 토론 참가자 시민단체별 일괄 배정 탭 추가 (2026-05-13 / [Codex])
- **[FEAT]** 토론 도구 > 토론 전 > 통합 참가자 관리에 `학생별 배정` / `시민단체별 배정` 전환 탭을 추가.
- **[FEAT]** 시민단체별 배정 탭에서 각 시민단체 카드 안에 모둠원 이름을 표시하고, 모둠원 전체를 찬성/반대/평가단/추가 팀으로 한 번에 배정할 수 있도록 개선.
- **[SAFE]** 기존 학생별 개별 배정 데이터 경로(`proStudents`, `conStudents`, `evaluators`, `extraSides/{sideId}/students`)를 그대로 사용해 기존 토론 준비 카드·평가단 로직과 호환되도록 처리.
- **[BUILD]** `APP_BUILD`를 `v1.2.52`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-CkD4Q37n.js` 기준 `학생별 배정` / `시민단체별 배정` 문구와 `APP_BUILD v1.2.52` 반영 확인.

## v1.2.51 — 학급 설정 사법부 모드 전환 시 스크롤 점프 현상 해결 (2026-05-13 / [Antigravity])
- **[FIX]** 모달 스크롤 점프 해결: `TeacherDashboard.jsx`의 학급 설정 모달에서 `animate-in` 애니메이션 클래스를 제거하여 리렌더링 시 브라우저가 스크롤 위치를 초기화하는 근본 원인 제거.
- **[STABILITY]** DOM 안정성 확보: `BranchConfigEditor.jsx`의 사법부 및 요약 섹션에 고유 `key`를 부여하고, 버튼 클릭 시 `blur()`를 처리하여 포커스 및 레이아웃 재계산에 의한 스크롤 튀는 현상 방지.
- **[BUILD]** `APP_BUILD`를 `v1.2.51`로 갱신 및 배포 완료.


## v1.2.49 — 학급설정 사법부 모드 전환 시 스크롤 튀는 현상 해결 (2026-05-13 / [Antigravity])
- **[FIX]** 스크롤 점프 해결: `BranchConfigEditor` 내부에서 하위 컴포넌트(UnitRow, BranchSection 등)를 정의하여 렌더링 시마다 리마운트되던 구조를 개선. 하위 컴포넌트를 외부로 추출하여 DOM 노드 안정성을 확보함.
- **[UI]** 이벤트 전파 차단: 사법부 민사/형사 전환 버튼에 `e.stopPropagation()`을 추가하여 의도치 않은 상위 레이아웃 간섭 방지.
- **[BUILD]** `APP_BUILD`를 `v1.2.49`로 갱신.


## v1.2.48 — 사법부 사건 유형 통합 및 동적 역할 명칭 적용 (2026-05-13 / [Antigravity])
- **[UI/UX]** 사법부 사건 유형 통합: 개별 유닛 단위가 아닌 사법부 전체 헤더에 '민사/형사' 선택 버튼을 배치하여 일관성 있는 재판 모드 설정 가능.
- **[FEAT]** 동적 명칭 변경: 선택한 모드에 따라 역할 명칭 자동 전환.
    - 민사: 검사팀 → **변호사(원고)**, 변호팀 → **변호사(피고)**
    - 형사: 검사팀 → **검사**, 변호팀 → **변호사**
- **[SYNC]** 요약 표 연동: 하단 배치 현황 요약 표의 컬럼명과 셀 내용도 선택된 재판 모드(민사/형사)에 맞춰 자동으로 업데이트.
- **[BUILD]** `APP_BUILD`를 `v1.2.48`로 갱신.


## v1.2.46 — 배치 현황 4대 기관 확장 및 사법부 민사/형사 선택 도입 (2026-05-13 / [Antigravity])
- **[UI]** 배치 현황 표 5열 확장: 요약 표를 [모둠 / 입법부 / 행정부 / 사법(검사) / 사법(변호)]의 5열 체제로 확장하여 4대 국가기관 역할을 한눈에 확인 가능하도록 개선.
- **[FEAT]** 사법부 민사/형사 선택: 사법부 모둠 설정 시 '민사' 또는 '형사' 사건 유형을 선택할 수 있는 토글 버튼을 추가하고, 요약 표에도 해당 유형이 표시되도록 연동.
- **[BUILD]** `APP_BUILD`를 `v1.2.46`로 갱신.


## v1.2.45 — 부서 간 교차 중복 배치 허용 (2026-05-13 / [Antigravity])
- **[LOGIC]** 중복 배치 제한 완화: 한 시민단체(모둠)가 입법부와 행정부에 동시에 소속되는 등 '다른 부서' 간의 중복 배치를 허용하도록 로직 개선. 드롭다운 목록에서 이미 다른 부서에 소속된 모둠도 선택 가능하도록 변경.
- **[LOGIC]** 부서 내 중복 방지: 동일 부서(예: 입법부 내의 두 유닛)에 같은 모둠이 중복 배정되는 것만 방지하여 운영 안정성 유지.
- **[BUILD]** `APP_BUILD`를 `v1.2.45`로 갱신.


## v1.2.44 — 시민단체-국가기관 배치 현황 표 개편 및 UI 정리 (2026-05-13 / [Antigravity])
- **[UI]** 배치 현황 표 개편: [학급 설정] 하단의 '국가기관 배치 현황' 섹션을 리스트 형태에서 깔끔한 표(Table) 형식으로 개편. (시민단체/국가기관 2열 구성)
- **[CLEANUP]** 불필요 섹션 제거: 이전 버전에서 ClassroomConfigEditor 하단에 잘못 추가되었던 중복 요약 섹션을 삭제하고, BranchConfigEditor 내의 요약 섹션으로 통합.
- **[BUILD]** `APP_BUILD`를 `v1.2.44`로 갱신.


## v1.2.43 — 세 번째 여정(국정포털) 부처별 배치 현황 섹션 도입 (2026-05-13 / [Antigravity])
- **[UI/UX]** 부처별 3열 그리드 요약: 일반적인 학생 배치 현황 대신, 세 번째 여정의 핵심인 입법부, 행정부, 사법부(검사/변호팀 포함) 소속 학생들을 한눈에 비교할 수 있는 전용 요약 섹션으로 전면 개편.
- **[LOGIC]** 부처 키워드 매칭: 단체 이름에 '입법', '행정', '사법'이 포함된 경우 해당 열에 자동으로 분류하여 표시되도록 지능형 필터링 적용.
- **[BUILD]** `APP_BUILD`를 `v1.2.43`로 갱신.


## v1.2.42 — 단체 이름 및 정보의 전역 동기화 로직 강화 (2026-05-13 / [Antigravity])
- **[SYNC]** 단체 정보 즉시 반영: [학급 설정]에서 시민단체(부처)의 이름이나 이모지를 변경할 때, `config` 뿐만 아니라 실제 `groups` 데이터 트리에도 즉시 쓰기를 수행하여 교사 대시보드 및 모든 컴포넌트에서 실시간으로 변경된 이름이 보이도록 개선.
- **[FIX]** 새 단체 추가 시 초기화: 새 단체를 추가할 때 `groups` 경로에 초기 데이터(이름, 이모지, 신뢰도 등)를 즉시 생성하여 데이터 불일치 방지.
- **[BUILD]** `APP_BUILD`를 `v1.2.42`로 갱신.


## v1.2.41 — 배치 현황 요약 표 추가 및 가시성 개선 (2026-05-13 / [Antigravity])
- **[UI]** 배치 현황 요약 표 도입: 화면 하단에 모든 단체/부처별 인원 및 소속 학생 명단을 표 형식으로 정리하여 보여주는 섹션 추가.
- **[UX]** 중복 배정 시각화: 요약 표에서도 한 학생이 여러 곳에 소속된 현황을 한눈에 파악할 수 있도록 리스트 최적화.
- **[BUILD]** `APP_BUILD`를 `v1.2.41`로 갱신.


## v1.2.40 — 학생 중복 배정 허용 및 다중 멤버십 시스템 구축 (2026-05-13 / [Antigravity])
- **[FEAT]** 중복 배정 허용: 한 학생이 여러 시민단체 또는 기관(입법/행정/사법 등)에 동시에 소속될 수 있도록 DND 로직 개편.
- **[UI]** 다중 이모지 표시: 학생 명찰 리스트에서 해당 학생이 배정된 모든 단체의 이모지가 동시에 나타나도록 UI 보강.
- **[SYNC]** 다중 멤버십 동기화: 저장 시 `groups/{groupId}/members` 트리에 모든 배정된 그룹의 멤버십이 실시간으로 반영되도록 강화.
- **[BUILD]** `APP_BUILD`를 `v1.2.40`로 갱신.


## v1.2.39 — 배정 작업 로컬 편집 보호 및 초기화 방지 로직 강화 (2026-05-13 / [Antigravity])
- **[FIX]** 로컬 편집 보호: 사용자가 드래그 앤 드롭으로 배정을 시작하면 `isDirty` 플래그를 활성화하여, 배경에서 서버 데이터가 동기화되어 작업 내용이 날아가는(초기화되는) 현상을 방지.
- **[STABILITY]** 동기화 시점 제어: 사용자가 [저장] 또는 [초기화] 버튼을 눌러 작업을 명시적으로 마친 경우에만 다시 서버 데이터와 동기화되도록 로직을 보강하여 편집 안정성 확보.
- **[BUILD]** `APP_BUILD`를 `v1.2.39`로 갱신.


## v1.2.38 — 학생 명찰 UI 슬림화 및 불필요한 상태 표시 제거 (2026-05-13 / [Antigravity])


## v1.2.37 — 학급 설정 워크플로 최적화 및 DND 배정 시스템 완성 (2026-05-13 / [Antigravity])


## v1.2.35 — 토론 준비 카드 진영별 실시간 공유 및 페이징 적용 (2026-05-13 / [Antigravity])
- **[FEAT]** 토론 준비 카드 가시성 로직 개선: 교사가 '공개'를 누르기 전에도 같은 진영(찬성/반대/평가단 등)의 친구들이 쓴 카드를 실시간으로 볼 수 있도록 변경하여 팀별 토론 준비 효율성 증대.
- **[UX]** 카드 목록 페이징(Pagination) 도입: 목록이 길어질 때의 스크롤 부담을 줄이기 위해 페이지당 4개씩 표시하고 이전/다음 버튼으로 탐색 가능하도록 개선.
- **[DESIGN]** 준비 카드 입력 폼 및 목록 UI 리뉴얼: 그라데이션 헤더, 둥근 모서리, 진영별 강조 색상을 적용하여 프리미엄 테마에 맞게 디자인 보강.
- **[BUILD]** `APP_BUILD`를 `v1.2.35`로 갱신하고 `bash deploy.sh`로 재배포.


## v1.2.34 — 후보자 카드 정보 상시 노출 및 찬반 의견 2열 레이아웃 (2026-05-13 / [Antigravity])
- **[UI]** 후보자 카드에서 선거 포스터, 출마 선언(선거 책자), 지지 선언문을 `details` 태그 없이 상시 노출되도록 변경하여 접근성 강화.
- **[UX]** 후보 찬반 한줄 의견(아고라)을 '찬성'과 '반대' 2개 컬럼으로 나누어 한눈에 비교할 수 있도록 레이아웃 개편.
- **[CONSISTENCY]** 투표 확정 모달에서도 포스터와 2열 찬반 의견을 노출하여 투표 전 최종 확인이 가능하도록 보강.
- **[DESIGN]** 정보 밀도가 높아짐에 따라 각 섹션에 프리미엄 스타일의 소제목과 배경색(emerald/rose/gray 계열)을 적용하여 시각적 질서 확보.
- **[BUILD]** `APP_BUILD`를 `v1.2.34`로 갱신하고 `bash deploy.sh`로 재배포.


## v1.2.33 — 후보 찬반 의견 입력창 자동 확장 (2026-05-13 / [Codex])
- **[UX]** 후보 찬반 한줄 의견 입력을 `input`에서 자동 높이 조절 `textarea`로 변경해 긴 근거도 1~4줄 범위에서 편하게 작성 가능하도록 개선.
- **[FLOW]** `Enter`는 등록, `Shift+Enter`는 줄바꿈으로 동작하도록 설정. 수정 기능은 넣지 않고 기존 삭제 후 재작성 흐름 유지.
- **[BUILD]** `APP_BUILD`를 `v1.2.33`으로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index--ujpKZA8.js` 기준 자동 확장 관련 코드 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.32 — 두 번째 여정 후보 캠프 흐름 정리 (2026-05-13 / [Codex])
- **[FLOW]** 두 번째 여정 안내를 `시민단체 → 후보 캠프 → 후보 비교·아고라 의견 → 선택 이유 이야기 → 투표` 흐름으로 정리.
- **[UI]** 후보 등록 폼을 `최우선과제 해결 공약` 중심으로 바꾸고 후보 사진 입력을 제거, 선거 포스터만 유지.
- **[STEP]** 교사 워크플로에 `나의 선택 이유 이야기` 단계를 추가하고 후보등록 단계명에 지지 선언문을 반영.
- **[DISCUSSION]** 후보 카드에 짧은 `후보 찬반 한줄 의견` 입력을 상시 표시하고, 본인 의견 삭제 버튼이 긴 글에 밀리지 않도록 정렬 보강.
- **[COPY]** 사전 여론조사 질문을 `최우선과제를 가장 잘 해결할 대통령 후보는 누구인가요?`로 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.32`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-BjfGOuxA.js` 기준 새 흐름 문구 반영, 후보 사진/photoUrl 흔적 0개 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.31 — 후보 지지 선언문 폼 노출 조건 보강 (2026-05-13 / [Codex])
- **[FIX]** 지지 선언문 폼이 후보 등록 완료 후에만 보이던 조건을 보강해, 후보 등록 전에도 우리 모둠 박스에서 작성 가능하도록 수정.
- **[FLOW]** 선거 종료 전까지 학생이 후보 지지 선언문을 작성·수정할 수 있도록 `supportWritingOpen` 조건을 분리.
- **[BUILD]** `APP_BUILD`를 `v1.2.31`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-BIcEb36U.js` 기준 지지 선언문 문구 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.30 — 후보 지지 선언문 작성·투표 노출 추가 (2026-05-13 / [Codex])
- **[REUSE]** 첫 번째 여정 `EssayEditor`의 저장 필드(`title/claim/evidence/impact`)를 보존하면서 `WritingEditor` 공용 글쓰기 엔진으로 분리.
- **[FEATURE]** 두 번째 여정 후보 등록 후 모둠원이 당사자 관점으로 `후보 지지 선언문`을 개인별 작성·수정·삭제할 수 있도록 추가.
- **[DATA]** 지지 선언문은 `candidateSupportStatements/{id}`에 저장하며 `candidateGroupId/groupId`로 후보별 묶음 표시.
- **[VIEW]** 후보 카드와 투표 확인 모달에서 후보 등록 내용(공약·선거 책자)과 지지 선언문 전체를 함께 확인 가능.
- **[SAFE]** 선거 결과 패널의 Zustand selector fallback을 모듈 상수 방식으로 정리해 무한 렌더 위험을 줄임.
- **[BUILD]** `APP_BUILD`를 `v1.2.30`으로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-DErhy8Bw.js` 기준 지지 선언문 기능 문구 반영, `useMemo` 오류 패턴 0개 확인.


## v1.2.29 — 보상권/가중치 내부 집계 비활성화 및 복원 메모 추가 (2026-05-13 / [Codex])
- **[SAFE]** 예전 데이터에 `weighted: true`가 남아 있어도 본회의 표결 집계가 항상 1인 1표로 계산되도록 `tallyBill`을 정리.
- **[STATS]** 학생 활동 통계와 CSV에서 가중 사용 항목/타임라인 표시를 제거해 보류 기능 흔적이 분석 화면에 노출되지 않도록 수정.
- **[LOGIC]** `defaultDistribution`은 보류 중 0장 분배로 고정하고, `consumeWeightedCard`는 복원 전 실수 호출 시 명시적으로 보류 오류를 내도록 안전화.
- **[RESTORE]** 복원 시 되살릴 위치를 문서에 기록: `BenefitCardInventory`, `defaultDistribution`, `consumeWeightedCard`, `tallyBill`, 학생 통계/CSV weighted 항목.
- **[BUILD]** `APP_BUILD`를 `v1.2.29`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-zcHzylXe.js` 기준 보류 대상 UI/통계 문구 0개 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.28 — 특권 카드·가중치 UI 보류 처리 (2026-05-13 / [Codex])
- **[UI]** 두 번째 여정 학생 화면의 `우리 모둠 저장소` 영역과 특권 카드/가중치 관련 표시를 제거.
- **[UI]** 선거 진행 문구를 `후보자 등록 → 캠페인·아고라 토론 → 1인1표 투표 → 결과 발표` 흐름으로 정리하고, 종료 버튼을 `결과 확정`으로 변경.
- **[UI]** 선거 결과 패널, 교사 대시보드, 입법 표결 모달/가이드에서 특권 카드·가중치 사용 안내를 숨김.
- **[LOGIC]** 선거 종료 시 순위만 확정하고 보상 카드 인벤토리는 더 이상 자동 분배하지 않도록 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.28`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-D6ukRFcl.js` 기준 보류 대상 문구 0개 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.27 — 두 번째 여정 후보등록 노출 조건 보강 (2026-05-13 / [Codex])
- **[FIX]** 두 번째 여정 `후보 등록` 단계에서 학생 화면의 후보등록 영역이 선거 상태값 때문에 숨을 수 있던 조건을 보강.
- **[DATA]** 학생의 모둠 찾기 로직에 `students/{studentId}/groupId` fallback을 추가해, 모둠 members 기록이 누락된 경우에도 후보등록 박스가 표시되도록 개선.
- **[PREVIEW]** 교사용 학생 화면 미리보기에서도 후보등록 위치가 확인되도록 preview 전용 안내 카드를 표시.
- **[BUILD]** `APP_BUILD`를 `v1.2.27`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-1847i-mR.js` 기준 후보등록 미리보기 문구/버전 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.26 — 기존 주장글 표시 가독성 개선 (2026-05-13 / [Codex])
- **[UX]** 첫 번째 여정 주장글 미리보기/캠페인 광장에서 기존에 길게 작성한 내용이 줄임표로 잘리지 않도록 표시 제한을 완화.
- **[TEXT]** 수정 모드에서 기존 작성 내용이 그대로 불러와졌음을 안내해, 새 문제 제기형 양식에 맞춰 필요한 부분만 다듬을 수 있도록 보강.
- **[COMPAT]** 저장 데이터 구조는 변경하지 않아 기존 `claim/evidence/impact` 내용이 그대로 유지되도록 처리.
- **[BUILD]** `APP_BUILD`를 `v1.2.26`으로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-Cbtfapi2.js` 기준 기존 작성 내용 안내/전체 표시 클래스 반영 및 `useMemo` 오류 패턴 0개 확인.

## v1.2.25 — 첫 번째 여정 주장글 양식 문제 제기형 전환 (2026-05-13 / [Codex])
- **[UX]** 주장하는 글 쓰기 양식을 해결책 제안형에서 문제 제기형으로 최소 수정.
- **[TEXT]** 기존 `claim/evidence/impact` 데이터 구조는 유지하면서 화면 라벨을 `[문제 제기]`, `[문제 근거]`, `[실제 상황/피해]`로 변경.
- **[FLOW]** 해결 방안 제안은 다음 여정으로 남기고, 첫 번째 여정에서는 실제로 어떤 문제가 벌어지고 있는지 설득하는 글이 되도록 안내 문구와 placeholder를 수정.
- **[BUILD]** `APP_BUILD`를 `v1.2.25`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-DJWKsdfC.js` 기준 문제 제기형 라벨/안내 문구 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.24 — 첫 번째 여정 주장하는 글 전체 표시 개선 (2026-05-13 / [Codex])
- **[FIX]** 첫 번째 여정 미리보기와 캠페인 광장에서 모둠 주장글이 최신 1개만 보이던 구조를 수정.
- **[UI]** 모둠원이 여러 명 작성한 주장글을 모두 목록으로 표시하고, 각 글에 제목·작성자·주장·근거가 보이도록 확장.
- **[UI]** 우리 모둠 카드에서는 내 글을 강조하고 수정/삭제 버튼을 각 글 카드에 제공하도록 개선.
- **[BUILD]** `APP_BUILD`를 `v1.2.24`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-B8wss4Hc.js` 기준 주장글 목록/내 글 표시 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.23 — 첫 번째 여정 주장하는 글 수정 흐름 개선 (2026-05-13 / [Codex])
- **[FIX]** 우리 모둠 활동 미리보기에서 최신 주장글이 다른 학생 글이면 내가 쓴 글 수정 버튼이 보이지 않던 문제 수정.
- **[UI]** 최신 글과 내 글이 다를 때 `내가 쓴 주장글은 따로 있어요. 클릭해서 수정하기` 안내 버튼을 표시하도록 개선.
- **[DATA]** 주장글 수정 저장을 전체 덮어쓰기(`setAt`) 대신 부분 업데이트(`updateAt`)로 변경해 기존 `createdAt` 등 메타데이터가 보존되도록 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.23`으로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-DNAzsTS7.js` 기준 내 글 수정 안내/부분 업데이트 로직 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.22 — 토론 타이머 단계별 대본 보기 창 추가 (2026-05-13 / [Codex])
- **[FEAT]** 토론 타이머에 `대본 보기` 버튼과 현재 단계 대본 모달을 추가.
- **[CONTENT]** 제공받은 토론 대본을 도입/주장 펼치기, 반론하기, 주장 다지기, 판정하기 절차로 나누어 현재 타이머 단계에 맞게 자동 표시.
- **[SYNC]** 학생 토론 패널, 교사 타이머 미리보기, TV 송출용 타이머 페이지에 세션 논제(`topic`)를 전달해 대본 첫 문장과 찬반 문장에 논제가 들어가도록 연결.
- **[BUILD]** `APP_BUILD`를 `v1.2.22`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-Cf-36wrX.js` 기준 대본 보기/현재 단계 대본/대본 문구 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.21 — 다자토론 추가 팀 삭제 버튼 정렬 개선 (2026-05-13 / [Codex])
- **[UI]** 다자토론 통합 참가자 관리의 추가 팀 이름 편집 행에서 삭제 버튼이 입력칸 라인과 맞지 않던 문제를 수정.
- **[UI]** 삭제 버튼에 `self-end` 및 입력칸과 같은 세로 패딩을 적용해 라벨 아래 입력줄 기준으로 정렬.
- **[BUILD]** `APP_BUILD`를 `v1.2.21`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-_lQNg-i5.js` 기준 정렬 클래스 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.20 — 다자토론 팀 이름 편집 기능 (2026-05-13 / [Codex])
- **[FEAT]** 다자토론 통합 참가자 관리에서 기본 A팀/B팀 이름을 세션별로 수정할 수 있도록 `sideLabelOverrides` 기반 편집 기능 추가.
- **[FEAT]** 추가한 팀(`extraSides`)도 삭제뿐 아니라 이름을 추후 수정할 수 있도록 인라인 편집 UI 추가.
- **[SYNC]** 교사 제어판에서 바꾼 기본/추가 팀 이름이 학생 토론 패널에도 즉시 반영되도록 `DebateToolPanel` 라벨 병합 로직 확장.
- **[BUILD]** `APP_BUILD`를 `v1.2.20`으로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-BhlZdKfc.js` 기준 팀 이름 편집 UI 및 `sideLabelOverrides` 마커 반영, `useMemo` 오류 패턴 0개 확인.


## v1.2.19 — 다자토론 통합 참가자 관리 팀 추가 기능 (2026-05-13 / [Codex])
- **[FEAT]** 다자토론(`multi_party`)의 토론 전 통합 참가자 관리에서 C팀·전문가팀 등 추가 팀을 생성할 수 있는 입력 UI 추가.
- **[LOGIC]** 추가 팀은 `debateSessions/{sessionId}/extraSides/{teamId}`에 저장되며, 학생을 추가 팀에 배정하면 A팀/B팀/평가단/다른 추가 팀에서 자동 해제되도록 정리.
- **[UI]** 추가 팀 상태 배지, 학생별 추가 팀 배정 칩, 하단 추가 팀별 명단 카드를 표시하도록 확장.
- **[BUILD]** `APP_BUILD`를 `v1.2.19`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-DFiR_kpG.js` 기준 팀 추가 UI 및 `extraSides` 마커 반영, `useMemo` 오류 패턴 0개 확인.


## v1.2.18 — 토론 타이머 단계 제목 표시 및 전체화면 폭 개선 (2026-05-13 / [Codex])
- **[UI]** 토론 타이머 하단 단계 진행 영역에 번호뿐 아니라 각 단계 제목을 함께 표시하도록 개선. 현재 단계는 카드형 강조, 지난 단계는 완료 색상으로 구분.
- **[UI]** 전체화면 모드에서 좌우 여백을 줄이고 `w-screen` 기반으로 넓게 표시되도록 조정하여 TV 송출 가독성 개선.
- **[BUILD]** `APP_BUILD`를 `v1.2.18`로 갱신하고 `bash deploy.sh`로 재배포.
- **[VERIFY]** 배포 번들 `index-Bs7hF2ff.js` 기준 단계 제목 grid/전체화면 폭 조정 반영 및 `useMemo` 오류 패턴 0개 확인.


## v1.2.17 — 토론 도구 소스 재동기화 및 정식 재배포 (2026-05-13 / [Codex])
- **[FIX]** `DebateToolPanel.jsx`에 `useMemo` import를 복구하고 세션별 추가 진영(`extraSides`) 라벨·학생 배정 판정을 소스 레벨에 반영.
- **[SYNC]** 긴급 번들 패치로만 복구되어 있던 상태를 정식 로컬 소스 기준으로 재현 가능하게 정리.
- **[BUILD]** `APP_BUILD`를 `v1.2.17`로 갱신하고 `bash deploy.sh`로 앱을 재빌드·재배포.
- **[VERIFY]** 배포 번들 `index-CMvv7fX_.js` 기준 `M=useMemo(`/`I=useMemo(` 오류 패턴 0개, 토론 v2 주요 기능 마커 유지 확인.


## v1.2.16 — 긴급 패치: 토론 도구 useMemo 참조 오류 수정 (2026-05-13 / [Codex])
- **[FIX]** 배포 번들의 학생 토론 도구(`DebateToolPanel`)에서 `useMemo`가 React import 별칭 없이 직접 호출되어 `ReferenceError: useMemo is not defined`가 발생하던 문제를 긴급 수정.
- **[HOTFIX]** 최신 원본 소스와 로컬 개발 소스가 불일치하는 상태라, 화면 복구를 우선해 배포 번들(`index-CbaVSUpz.js`)의 `useMemo` 참조를 `(0,v.useMemo)` 형태로 직접 패치.
- **[NOTE]** 후속 작업 시 최신 JSX 원본 확보 또는 재동기화 후 `DebateToolPanel.jsx`의 React hook import/사용 상태를 소스 레벨에서 정리해야 함.

## v1.2.15 — 토론 타이머 전체화면 레이아웃 일원화 및 스케일링 (2026-05-12 / [Antigravity])
- **[UI]** 타이머 레이아웃 통일: 전체화면 모드에서도 일반 모드와 동일한 구성(헤더, 단계명, 힌트, 게이지 바)을 유지하도록 개편.
- **[UI]** 시각적 강화: 전체화면 시 폰트 크기(단계명 8xl, 타이머 25vh, 힌트 3xl) 및 여백(p-12)을 대폭 확대하여 일관성 있는 가독성 확보.
- **[DEPLOY]** 최신 빌드 서버 배포 완료.

## v1.2.14 — TV 송출용 UI 정교화 및 타이머 가독성 개선 (2026-05-12 / [Antigravity])
- **[UI]** 교사용 제어판: 커다란 '새 창 열기' 버튼 대신 '학생에게 노출' 옆에 컴팩트한 '🖥️ TV 송출용' 버튼 배치.
- **[UI]** 타이머 전체화면: 현재 단계명 글씨 크기 대폭 확대(font-black, 7xl) 및 드롭 섀도우 적용.
- **[UI]** 타이머 전체화면: 단계 진행 상태를 보여주는 게이지 바(Progress Bar)를 전체화면에서도 노출하도록 개선.
- **[DEPLOY]** 최신 빌드 서버 배포 완료.

## v1.2.13 — 토론 타이머 TV 송출용 새 창 기능 추가 (2026-05-12 / [Antigravity])
- **[FEAT]** 토론 타이머 전용 페이지(`DebateTimerTVPage.jsx`) 및 라우트 추가.
- **[UI]** 교사용 토론 제어판에 '교실 TV 송출용 타이머 새 창 열기' 버튼 추가 (실시간 동기화).
- **[DEPLOY]** 최신 빌드 서버 배포 완료.

## v1.2.12 — 발언 평가 단계별 통합 및 중복 방지 (2026-05-12 / [Antigravity])
- **[LOGIC]** 동일한 단계(`debateStage`)에서 평가를 여러 번 열 경우, 새로운 항목을 생성하지 않고 기존 항목을 재사용하도록 개선.
- **[FIX]** 토론 후 탭에서 같은 단계의 평가 결과가 여러 개로 쪼개져 보이던 문제 해결.
- **[DEPLOY]** 최신 빌드 서버 배포 완료.

## v1.2.11 — 발언 평가 자동화 및 실시간 결과 노출 (2026-05-12 / [Antigravity])
- **[FEAT]** 발언 평가 자동 종료: 지정된 평가단 전원이 제출하면 1초 후 자동으로 평가가 닫히고 결과가 공개됨.
- **[FEAT]** 실시간 결과 노출 옵션: 평가가 진행 중이더라도 '실시간 결과 미리 노출' 체크 시, 미제출 평가자를 제외한 모든 학생에게 결과 통계가 즉시 보임.
- **[DEPLOY]** 최신 빌드 서버 배포 완료.

## v1.2.10 — 토론 도구 명칭 고도화 및 UI 순서 조정 (2026-05-12 / [Antigravity])
- **[UI]** 국민참여재판(trial) 모드에서 '배심원' 명칭을 '평가단(배심원)'으로 변경.
- **[UI]** 토론 전 탭 섹션 순서 변경: '통합 참가자 관리'를 상단으로, '준비 카드'를 하단으로 배치.
- **[FIX]** 토론 후 탭에서 발생하던 `ReferenceError: pollCompare is not defined` 수정 및 데이터 복구.
- **[DEPLOY]** 최신 빌드 서버 배포 완료.

## v1.2.52 — 선거 페이즈(Phase 2) 고도화: 캔바 연동 및 아고라 개편 (2026-05-14 / [Antigravity])

- [x] **공약 개발용 자료실 통합**: 후보 등록 전 공약 근거를 수집할 수 있도록 Phase 2 상단에 `LinkBoard` 및 `LinkSubmit` 섹션을 추가함.
- [x] **캔바(Canva) 카드뉴스 연동**: 후보 등록 시 캔바 링크를 입력받아 저장하고, 후보 카드 및 투표 모달에서 임베드(iframe) 형식으로 미리보기를 제공함.
- [x] **캔바 임베드 가이드 추가**: `CandidateRegister`에 캔바의 '임베드(</>)' 공유 기능을 사용하도록 안내하는 상세 힌트 박스 추가.
- [x] **아고라(찬반 토론) 레이아웃 최적화**: 의견 입력폼을 하단으로 이동하고, 찬성/반대 의견이 좌우 병렬로 배치되어 비교가 용이하도록 UI를 전면 개편함.

## v1.2.9 — 토론 도구 안정화 및 전역 상수화 (2026-05-12 / [Antigravity])

## v1.2.8 — 토론 도구 ReferenceError 수정 및 구조 안정화 (2026-05-12 / [Antigravity])
- `TeacherDebateControl.jsx` 및 `DebateToolPanel.jsx`에서 `sideLabels` 미정의로 인한 `ReferenceError` 해결.
- 진영 라벨링 로직을 상단 상수(`DEBATE_SIDE_LABELS`)로 분리하여 스코프 안전성 확보.

## v1.2.7 — 토론 준비 카드 노출 및 진영 식별 로직 수정 (2026-05-12 / [Antigravity])
- 학생 화면(`DebateToolPanel.jsx`)에서 진영(찬성/반대/평가단)을 식별할 때 잘못된 데이터 경로(`studentSides`)를 참조하던 문제 수정.
- 교사 제어판에 '평가단도 작성 허용' 옵션 추가 및 평가단 학생의 준비 카드 노출 로직 정교화.

## v1.2.6 — 긴급 복구: 토론 제어판 구조 손상 및 렌더링 오류 수정 (2026-05-12 / [Antigravity])
- `TeacherDebateControl.jsx`의 깨진 JSX 구조 및 누락된 `return` 문 긴급 복구.
- 스코프 외부 이탈로 인한 `ReferenceError: sideLabels is not defined` 해결 및 컴포넌트 무결성 확보.

## v1.2.5 — 토론 도구 노출 버그 및 코드 오염 정리 (2026-05-12 / [Antigravity])
- 토론 준비 카드(prepCard)가 교사 제어판에서 노출 설정 시 학생 화면에 나타나지 않던 현상 수정.
- `TeacherDebateControl.jsx`의 중복 블록 및 Corrupted JSX를 제거하여 UI 안정성 및 유지보수성 개선.

## v1.2.4 — 긴급 패치: 국민청원 단계 자동 모둠 합류 방지 (2026-05-12 / [Antigravity])
 
 - [x] **Phase 1 접근 제어 강화**:
   - [x] `Phase1Page`에서 국민청원 단계 시 '시민단체 활동' 탭 접근 차단 및 안내 메시지(alert) 추가.
   - [x] `GroupJoinPanel`에 워크플로 단계 가드를 추가하여 국민청원/오프닝 단계에서의 자동 합류 및 수동 합류 원천 차단.
   - [x] '시민단체 활동' 탭에 잠금 아이콘(🔒) 표시 및 비활성화 시각 효과 적용.
 
 ---
 
 ## v1.2.3 — 토론 v2.0 완성, 공동 작업 모드 UI 정밀화 및 관리 권한 강화 (2026-05-11 / [Antigravity])

- [x] **토론 v2.0 아키텍처 완성**: `TeacherDebateControl`과 `DebateToolPanel`을 모드 중심(Mode-first) 설계로 전면 개편. 4가지 토론 테마(일반/재판/다자/협의)에 맞춰 UI 색상, 아이콘, 역할 명칭이 실시간 동기화됨.
- [x] **공동 작업 모드 UX 최적화**: 입법/행정부 '공동 작업 모드' 시 `BranchUnitWorkspace`에서 역할 배정 및 요약 패널을 자동으로 숨겨 협동 작업에 집중할 수 있는 간결한 레이아웃 제공.
- [x] **교사 관리 권한(삭제) 강화**: 잘못된 데이터나 테스트 데이터를 정리할 수 있도록 법안(`BillCard`), 정책 보고서(`MinisterPolicyDraft`), 정책 게시판(`PolicyDiscussionList`)에 교사용 [삭제] 버튼 추가.
- [x] **실시간 학생 미리보기 개선**: 교사가 '학생 미리보기' 중일 때도 토론 테마와 역할 레이블이 실제 학생 화면과 100% 동일하게 보이도록 로직 정교화.

---

## v1.2.2 — 다자간·협의 토론 모드 추가 및 전환 기능 (2026-05-11 / [Antigravity])

- [x] **다양한 토론 형식 지원**: '다자간 토론' 및 '협의 토론' 모드를 추가하여 총 4가지 토론 형식을 지원함.
- [x] **실시간 모드 전환 기능**: 진행 중인 토론 세션에서도 상단 버튼을 통해 즉시 모드(일반/재판/다자/협의)를 전환할 수 있음.
- [x] **형식별 맞춤형 절차**: 다자간 토론(기조발언-Q&A-자유토론) 및 협의 토론(해결방안-실현검토-의견조율) 전용 타이머 단계가 자동 적용됨.
- [x] **역할 명칭 최적화**: 다자간 토론(A팀/B팀), 협의 토론(제안측/조율측) 등 각 형식에 맞는 역할 명칭이 자동 적용됨.

---

## v1.2.1 — 국민참여재판 토론 모드 추가 (2026-05-11 / [Antigravity])

- [x] **국민참여재판 지원**: 토론 도구에 '국민참여재판' 형식을 추가함. 세션 생성 시 '일반 토론'과 '국민참여재판' 중 선택 가능.
- [x] **재판 절차 자동화**: 재판 모드 선택 시 법교육 테마에 맞춘 9단계 절차(모두진술, 증거조사, 배심원 평의 등)가 자동으로 구성됨.
- [x] **법적 역할 명칭 적용**: 재판 모드에서는 찬성/반대/평가단/의장 명칭이 검사/변호인/배심원/재판장으로 자동 변경되어 몰입감을 높임.
- [x] **여론조사 연동**: 재판 모드 초기 여론조사 선택지가 '유죄/무죄/기타'로 자동 설정됨.

---

## v1.2.0 — 행정부 공동 작업 모드 구현 (2026-05-11 / [Antigravity])

- [x] **행정부 공동 정책 보고서**: 행정부 활동에 '공동 작업 모드'를 지원함. 모든 모둠원이 예산 편성 및 시행령 작성을 실시간으로 함께 수행하고 제출할 수 있음.
- [x] **역할 UI 최적화**: 공동 작업 시 역할 배정 및 개별 역할 작업 공간을 숨겨 화면을 간결하게 구성하고, 안내 문구를 협력 작업에 맞게 자동 조정함.
- [x] **가이드 업데이트**: `ExecutiveProgressGuide`의 단계별 지침을 운영 모드에 맞춰 다변화함.

---


---

## 📁 과거 히스토리 아카이브

v1.1.9 이전의 모든 변경 내역은 아래 아카이브 문서에서 확인할 수 있습니다.

- [과거 히스토리 아카이브 (v1) - v0.0.0 ~ v1.1.9](./history_archive_v1.md)
