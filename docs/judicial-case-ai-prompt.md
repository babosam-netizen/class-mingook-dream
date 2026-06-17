# 사법부 사건 시나리오 — AI 생성 가이드 (Claude · ChatGPT · Gemini)

> **대상**: 다른 사건으로 재판을 열고 싶은 선생님
> **소요 시간**: 약 3~5분 (AI가 30초 안에 JSON 생성)
> **작성일**: 2026-05-27 (v1.2.292 — 학급 입법·시행령 자동 주입 기능 추가)

---

## 1. 가장 빠른 방법 (앱 안에서 한 번에)

학급설정 → 사법부 → 사건 시나리오 섹션 안에 있는 **🤖 우리 반 입법·시행령 기반 AI 사건 생성** 카드를 사용하면 다음이 자동으로 됩니다:

1. 우리 반에서 가결된 법안 전체(목적·정의·의무·**벌칙**)
2. 행정부에서 작성한 시행령 전체(시행령 본문·**상벌·처분**·담당자·예외)

이 두 가지가 **자동으로 프롬프트에 주입**되어 클립보드에 복사됩니다. 그다음 새 탭으로 열린 AI에 붙여넣기만 하면 됩니다.

| 버튼 | 새 탭으로 이동 | 추천 상황 |
|---|---|---|
| 🟣 **Claude로 만들기** | https://claude.ai/new | 가장 정교한 JSON. 사고 과정과 함께 코드블록 출력. |
| 🟢 **ChatGPT로 만들기** | https://chatgpt.com/ | Canvas 기능으로 JSON을 깔끔하게 다듬을 수 있음. |
| 🔵 **Gemini로 만들기** | https://gemini.google.com/app | Google 계정만 있으면 빠르게 사용 가능. |

> 클립보드 접근이 차단된 경우 자동으로 `.txt` 파일이 다운로드됩니다. 파일을 열어 전체 복사 후 AI에 붙여넣으세요.

---

## 2. 직접 프롬프트를 만들고 싶을 때 (수동 모드)

앱 안 버튼이 아닌 별도 AI 채팅창에서 사용하려면 아래 3-vendor 버전 프롬프트를 활용하세요.

### 2-1. 공통 — 우리 반 컨텍스트 채우기

프롬프트 앞부분에 **반드시** 우리 반 데이터를 채워 넣어야 합니다. 학급설정 → 사법부 안에서 "📄 .txt로 받기" 버튼을 누르면 우리 반 법안·시행령이 자동 채워진 프롬프트가 .txt로 다운로드됩니다. 이 파일을 텍스트 편집기로 열어 [사건 내용] 부분만 수정한 뒤 AI에게 보내면 됩니다.

### 2-2. Claude 버전 (https://claude.ai/new)

**Claude 사용 팁**:
- 답변 마지막에 ```json 코드블록 안에 JSON 전체를 **한 번에** 출력하라고 명확히 지시
- 사고 과정 설명은 코드블록 위쪽에 짧게만
- "Claude는 자기 검증에 능하다" 점을 활용 — 출력 후 자가 점검 체크리스트를 함께 요청

프롬프트 마지막에 추가 권장:
```
출력 형식은 ```json 코드블록 안에 한 번만 작성해 주세요.
JSON 출력 후 아래 자가 점검을 한 줄씩 ✅로 표시해 주세요:
- [ ] charges[].law 에 우리 반 법안 제목이 정확히 인용되어 있는가?
- [ ] prosecutionDemand 가 우리 반 법안의 벌칙 조항 범위 내인가?
- [ ] stageGuides 1~7 모두 있는가?
```

### 2-3. ChatGPT 버전 (https://chatgpt.com/)

**ChatGPT 사용 팁**:
- Canvas 기능이 활성화되어 있다면 "JSON을 Canvas에 작성해 주세요"라고 지시
- 그렇지 않다면 ```json 코드블록 안에 한 번만 출력하도록 요청
- GPT-4o는 JSON 출력이 안정적이지만, 가끔 코드블록 시작/끝을 빼먹으므로 명확한 지시 필요

프롬프트 마지막에 추가 권장:
```
출력은 반드시 ```json 으로 시작하고 ``` 로 닫는 코드블록 안에 한 번만 작성해 주세요.
Canvas 기능이 사용 가능하다면 Canvas에 JSON을 작성해 주세요.
```

### 2-4. Gemini 버전 (https://gemini.google.com/app)

**Gemini 사용 팁**:
- Gemini는 가끔 추가 설명을 붙이는 경향이 있으니 "추가 설명 금지" 명시
- ```json 코드블록을 정확히 **한 번만** 사용하라고 강조
- Gemini의 JSON 출력은 안정적이지만, 한글 따옴표를 영문 따옴표로 잘 바꾸므로 주의

프롬프트 마지막에 추가 권장:
```
응답에 ```json 코드블록을 정확히 한 번만 포함시키고, 그 안에 완전한 JSON만 작성해 주세요.
JSON 외의 추가 설명, 추천사항, 결론 문장은 절대 작성하지 마세요.
모든 따옴표는 영문 큰따옴표 (")를 사용해 주세요.
```

---

## 3. JSON 스키마 (모든 AI 공통)

```json
{
  "id": "사건id_영문숫자_언더바만사용",
  "title": "사건 전체 이름",
  "subtitle": "짧은 부제 — 「우리 반 법안 제목」 위반 등",
  "caseType": "criminal",
  "trialType": "national_participation",
  "period": "20XX년",
  "summary": "사건 개요 2~3문장. 우리 반 법안의 어떤 의무를 어떻게 어겼는지가 드러나도록.",
  "defendant": {
    "name": "피고인 이름",
    "age": 0,
    "occupation": "직업",
    "persona": "evader",
    "script": "피고인이 재판정에서 할 1인칭 진술 3~5문장.",
    "scriptHint": "교사용 답변 전략 안내 한 줄"
  },
  "victims": [
    { "name": "", "age": 0, "role": "", "experience": "", "statementSummary": "" }
  ],
  "charges": [
    { "law": "「우리 반 법안 제목」 제3조(의무)", "description": "구체적 위반 내용" }
  ],
  "prosecutionDemand": "우리 반 법안의 벌칙 조항 범위 내 (예: 벌금 80만원)",
  "keyIssues": [
    "우리 반 법안의 의무를 정말 어겼는가?",
    "고의였는가 과실이었는가?",
    "피해 규모와 정상참작 사유"
  ],
  "evidence": [
    { "id": "e1", "title": "", "side": "prosecution", "description": "", "revealedAtStage": 4, "imageHint": "" }
  ],
  "witnesses": [
    { "id": "w1", "name": "", "role": "", "side": "prosecution", "statement": "1인칭 3~5문장", "keyPoint": "" }
  ],
  "roleHints": {
    "judges": "재판 진행 + 우리 반 법안의 의무 조항 따지기",
    "prosecution": "어떤 증거에 집중 + (있다면) ○○시행령 처분 절차 인용",
    "defense": "무죄/감형 주장 + 우리 반 법안 예외 조항 활용",
    "jury": "유무죄 판단 기준",
    "witness": "진술 준비",
    "defendant": "방어 전략",
    "press": "보도 시각"
  },
  "stageGuides": [
    { "stage": 1, "teacherNote": "", "studentNote": "", "timerMinutes": 10 },
    { "stage": 2, "teacherNote": "", "studentNote": "", "timerMinutes": 15 },
    { "stage": 3, "teacherNote": "", "studentNote": "", "timerMinutes": 8 },
    { "stage": 4, "teacherNote": "", "studentNote": "", "timerMinutes": 15 },
    { "stage": 5, "teacherNote": "", "studentNote": "", "timerMinutes": 12 },
    { "stage": 6, "teacherNote": "", "studentNote": "", "timerMinutes": 8 },
    { "stage": 7, "teacherNote": "", "studentNote": "", "timerMinutes": 15 }
  ]
}
```

---

## 4. 필수 작성 규칙 (모든 AI 동일)

1. **charges[].law 에는 반드시 [우리 반 입법 결과] 목록의 법안 제목을 정확히 인용**
   - 예: `"「깨끗한 학교 만들기법」 제3조(의무)"`
2. **prosecutionDemand 는 반드시 우리 반 법안의 "벌칙" 조항 범위 내**
   - 우리 반 벌칙이 "100만원 이하 과태료"면 → "과태료 80만원" 정도 적절
   - 우리 반 벌칙을 넘어선 형량을 부르면 안 됨
3. 관련 시행령이 있다면 **roleHints.prosecution 에 "○○시행령 처분 절차에 따라" 명시**
4. **사건 시나리오는 우리 반 법안의 "의무" 조항을 명확히 위반한 행동이 핵심 쟁점**이 되도록 구성
5. 초등 6학년이 이해할 수 있는 쉬운 언어
6. roleHints: judges/prosecution/defense/jury/witness/defendant/press 7개 모두
7. 증거: 검사측 4개 이상 + 변호측 2개 이상
8. 증인: 검사측 3명 이상 + 변호측 2명 이상
9. stageGuides: 1~7단계 7개 (timerMinutes 포함)
10. persona: villain/evader/righteous/victim 중 택1
11. revealedAtStage: 검사측 증거 4, 변호측 증거 5

---

## 5. AI 출력 후 자가 점검 체크리스트

- [ ] charges[].law 에 우리 반 법안 제목이 정확히 인용되어 있는가?
- [ ] prosecutionDemand 가 우리 반 법안의 벌칙 조항 범위 내인가?
- [ ] 관련 시행령이 있다면 roleHints.prosecution 에 인용되어 있는가?
- [ ] stageGuides 1~7 모두 있는가?
- [ ] evidence/witnesses id 가 e1,e2,... w1,w2,... 순서로 있는가?
- [ ] defendant.script 가 비어있지 않은가?
- [ ] roleHints 7개 키 모두 채워져 있는가?
- [ ] JSON이 ```json 코드블록 안에 완전한 형태로 한 번만 있는가?

---

## 6. 파일 저장 및 업로드

1. AI 출력의 ```json 코드블록 내용만 복사
2. 메모장·텍스트 편집기에 붙여넣기
3. `우리반_xxx_사건.json` 으로 저장 (확장자 반드시 `.json`)
4. 앱 → 학급설정 → 사법부 → 사건 시나리오 → [📥 파일 선택...] → 업로드
5. ✅ 검증 통과 후 [이 사건으로 재판 열기] 클릭

---

## 7. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 업로드 시 "필수 항목 누락: stageGuides" | AI가 6단계만 만들었음 | AI에게 "stageGuides 배열에 stage:1~stage:7 모두 7개를 작성해 주세요"라고 재요청 |
| `JSON 형식 오류: 파일을 파싱할 수 없습니다` | 한글 따옴표(`"`)가 들어감 | 메모장에서 모든 `"`·`"` 를 `"`로 치환 |
| charges[].law 가 "근로기준법 제43조" 같이 우리 반 법안이 아님 | AI가 학급 컨텍스트를 무시함 | 프롬프트 앞부분의 [우리 반 입법 결과] 목록이 비어 있지 않은지 확인. 비어있으면 입법부 단계에서 가결된 법안이 있어야 함 |
| 클립보드 복사가 안 됨 | 브라우저 권한 차단 | 자동으로 .txt 다운로드됨. 파일 열어 복사 |

---

> **tip**: 같은 우리 반 법안이라도 AI마다 다른 사건 시나리오가 나옵니다.
> 3개 AI로 각각 만들어 보고 가장 마음에 드는 것을 고르거나, 서로 다른 AI 결과를 섞어서 편집해도 좋습니다.
