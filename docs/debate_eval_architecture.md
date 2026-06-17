# 토론 단계 평가 구조 기준서

마지막 갱신: 2026-05-22 12:35  
현재 기준 버전: v1.2.189

## 목적

토론 도구의 `토론 중` 평가 기능은 라운드 여부와 관계없이 같은 구조로 동작해야 한다. 앞으로 수정할 때는 예전 단일 평가 함수와 새 다중 평가 함수를 나누지 말고, 아래 기준을 유지한다.

## 핵심 원칙

1. 평가 생성은 항상 `targets` 배열 기반으로 한다.
2. 평가 대상이 1개여도 `targets: [{ id, label }]` 형태로 저장한다.
3. 교사 화면의 단계 설정 UI에서 보이는 이름은 모두 `평가 대상`으로 통일한다.
4. `라운드 팀`은 발언 순서이고, `평가 대상`은 실제 평가할 대상이다. 둘은 다를 수 있다.
5. 교사가 `평가단 평가 노출`을 켜면 다음 단계/다음 라운드 팀에서 현재 순서 평가가 자동으로 노출된다.
6. 자동 노출과 수동 노출은 같은 `openStageEval` 함수 흐름을 사용한다.

## 현재 코드의 단일 진입점

파일: `app/src/components/debate/TeacherDebateControl.jsx`

- `getStageEvalTargets(stage, roundInfo)`: 단계 설정값을 읽어 평가 대상 배열을 만든다.
- `openStageEval(targets, options)`: 평가 항목을 열거나 기존 평가 항목을 재사용한다.
- `openCurrentStageEval()`: 현재 타이머 단계의 평가 대상을 계산한 뒤 `openStageEval`을 호출한다.
- `toggleEvalExposure(checked)`: 세션 단위 `evalExposureEnabled`를 켜고 끄며, 켤 때 현재 순서 평가를 즉시 노출한다.
- 자동 노출 `useEffect`: `evalExposureEnabled`가 켜진 동안 단계 또는 라운드 팀이 바뀌면 `getStageEvalTargets` → `openStageEval`만 사용한다.


## 학생 평가 입력 UI 기준

- `SpeechEval.jsx`의 학생 평가단 입력 카드는 태블릿 사용을 기준으로 컴팩트하게 유지한다.
- 별점은 3축 x 5점 구조를 유지하되, 카드 여백과 별 크기를 과하게 키우지 않는다. 현재 입력 카드는 미니 카드 기준이므로, 더 줄일 때도 별점 터치 가능성은 유지한다.
- 코멘트는 필수·80자 제한을 유지한다. 단, 입력칸은 1줄 높이로 시작해 타이머 위 영역을 덜 차지하게 한다.
- 다중 평가 대상은 `targets` 배열을 그대로 사용하며, 태블릿 폭에서는 2열, 좁은 화면에서는 1열로 표시한다.
- UI를 줄이더라도 `results/{studentId}`와 `perTarget/{targetId}` 저장 구조는 변경하지 않는다.

## 저장 필드

### 세션 단위 노출 상태

- `evalExposureEnabled`: 교사가 `평가단 평가 노출`을 켰는지 여부.
- `true`이면 타이머가 다음 단계/다음 라운드 팀으로 넘어갈 때 현재 순서의 평가가 자동으로 열린다.
- `false`이면 평가 노출을 멈추고 열린 평가도 닫는다.
- 교사가 `평가 닫기`를 누르면 이 값도 `false`로 바뀐다.


### 일반 단계

- `evalCount`: 평가 대상 수. 기본 1.
- `evalNames`: 평가 대상 이름 배열.
- 예: `evalCount: 2`, `evalNames: ['찬성 측 입론', '반대 측 입론']`

### 라운드 단계

- `isRound: true`: 라운드 단계 여부.
- `teams`: 라운드 발언 순서.
- `roundEvalTargets`: 실제 평가 대상 이름 배열.
- `roundEvalTargets`가 비어 있으면 현재 라운드 팀 1개를 기본 평가 대상으로 본다.
- 예: `teams: ['1팀', '2팀']`, `roundEvalTargets: ['2팀 답변']`이면 1팀 발언 라운드에서도 2팀 답변을 평가 대상으로 열 수 있다.

### 생성된 평가 항목

경로: `debateSessions/{sessionId}/speechEvals/{evalId}`

- `targetLabel`: 화면에 보이는 평가 제목.
- `targets`: 실제 평가 대상 배열. 단일 평가도 항상 이 배열을 가진다.
- `debateStage`: 타이머 단계 인덱스.
- `roundTeamIdx`, `roundTeamLabel`: 라운드 단계일 때만 저장한다.
- `isOpen`, `openedAt`, `evaluatorRole`, `results`: 기존 구조 유지.

## 의존성 주의

- `SpeechEval.jsx`는 `targets`가 있으면 다중 대상 UI를 사용한다. 이제 새 평가는 단일 대상도 `targets`가 있으므로, 이 경로가 기본이다.
- 과거 데이터에는 `targets`가 없는 평가 항목이 있을 수 있다. `SpeechEval.jsx`의 단일 평가 호환 경로는 삭제하지 않는다.
- `DebateToolPanel.jsx`는 현재 타이머 단계와 `roundTeamIdx`를 기준으로 보여줄 평가를 필터링한다. 라운드의 `다음 팀` 문제를 막기 위해, 타이머가 있을 때는 이전 `activeEval`로 fallback하지 않는다.
- 자동 노출 `useEffect`는 `timer.currentStage`, `timer.currentTeamIdx`, `evalExposureEnabled` 변화에 반응한다. 단계 편집 중 오작동을 피하기 위해 `stages` 전체를 dependency에 넣지 않는다.
- `evalExposureEnabled`가 켜져 있으면 평가단 전원 제출 후에도 평가가 자동으로 닫히지 않는다. 교사가 체크를 끄거나 `평가 닫기`를 눌러야 노출이 끝난다.

## 앞으로 수정할 때 하지 말 것

- `openStageEval`과 별도로 라벨만 받는 새 평가 생성 함수를 다시 만들지 않는다.
- 단계별 `autoEval` 토글을 다시 UI 기준으로 쓰지 않는다. 현재 기준은 세션 단위 `evalExposureEnabled`이다.
- `발언자`라는 UI 용어를 다시 쓰지 않는다. 필요하면 `라운드 팀` 또는 `평가 대상`으로 구분한다.
- 일반 단계와 라운드 단계의 평가 생성 로직을 분기된 별도 함수로 늘리지 않는다. 분기는 `getStageEvalTargets` 안에서만 처리한다.

## 빠른 점검 절차

1. 일반 단계에서 평가 대상 1개로 평가 열기.
2. 일반 단계에서 평가 대상 2개 이상으로 평가 열기.
3. `평가단 평가 노출` 체크를 켠 뒤 다음 단계로 이동하면 새 단계 평가가 자동으로 보이는지 확인.
4. 라운드 단계에서 평가 대상 미입력 상태로 다음 팀 이동.
5. 라운드 단계에서 평가 대상 별도 입력 후 다음 팀 이동.
6. 학생 화면 타이머 위의 현재 단계 평가가 이전 팀 평가로 남지 않는지 확인.
7. `평가단 평가 노출` 체크를 끄거나 `평가 닫기`를 누르면 열린 평가가 닫히는지 확인.
