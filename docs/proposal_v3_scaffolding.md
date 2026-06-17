# v3 업그레이드 제안서 — 전문성 스캐폴딩 4종

작성일: 2026-04-26
원본: `<원본 기획서 경로> 꿈/버전3/민국이의_꿈_프로젝트_통합기획보고서_v3.docx`
대상 버전: 현재 v0.7.x → 적용 시 v0.8.0 ~ v0.9.0대

---

## 1. 추가 핵심

| 비계 | 장치 |
|---|---|
| ① | **5분 브리핑 카드** (입법·행정·사법 첫 차시 도입 5분 ‘약도’) |
| ② | **모둠 내 4역할 분화** (입법: 작성자/조사원/발언자/기록자, 행정: 장관/분석가/기획자/홍보, 사법: 판사/검사/변호사/법정기자) |
| ③ | **단계별 템플릿** (BillTemplate·BudgetReportTemplate·VerdictTemplate, 회색 placeholder) |
| ④ | **전문가 호출 SOS** (모둠당 페이즈3 누적 3회 한도) |

## 2. 의존성·중복 분석

**기존 강화:**
- BillEditor → BillTemplate (4 필드)
- BudgetPanel → BudgetReportTemplate (4 카테고리 강제)
- JudicialTab 판결문 → VerdictTemplate (4단 구조)
- PhaseWorkflow에 5분 브리핑 단계 추가

**완전 신규:**
- BriefingLibrary + 3종 markdown
- RoleAssigner + RoleCard + 12종
- PlaceholderField 공통 블록
- ExpertCallButton + ExpertCallNotifier
- 데이터: expertCalls / sessionRoles / students.briefingsRead
- config: briefings / roles / templates / expertCallQuotaPerGroup

**기획서 권장에서 단순화:**
- v3 권장 ‘템플릿 별도 라우트(`/legislative/template/:billId` 등)’는 채택 X — Phase3 탭 안에 인라인 통합
- v3 권장 ‘studentProgress’ 별도 컬렉션은 채택 X — `students/{sid}/briefingsRead` 필드로 통합
- v3 권장 Playwright e2e 채택 X — 수동 시연으로 대체

## 3. 단계별 패키지 (의존성 순)

```
V3-1 기반        config 확장 + PlaceholderField + 데이터 스키마
   ↓
   ├─→ V3-2 브리핑    BriefingLibrary + 3종 markdown + Phase3 자동 모달
   │
   ├─→ V3-3 역할분화  RoleAssigner + RoleCard + 12종 역할 본문
   │
   └─→ V3-4 템플릿     기존 컴포넌트 → 템플릿 3종 교체

V3-5 SOS        ExpertCallButton + Notifier + 한도 검증 (독립)

V3-6 보안+배포  RTDB 규칙 + 빌드 + 배포 + 문서 갱신
```

## 4. 파일 단위 영향

**신규:**
- `src/lib/scaffolding-data.js`
- `src/components/scaffolding/`
  - `BriefingLibrary.jsx`, `BriefingModal.jsx`
  - `RoleAssigner.jsx`, `RoleCard.jsx`
  - `PlaceholderField.jsx`
  - `BillTemplate.jsx`, `BudgetReportTemplate.jsx`, `VerdictTemplate.jsx`
  - `ExpertCallButton.jsx`, `ExpertCallNotifier.jsx`

**변경:**
- `src/store/gameStore.js` — config 4키, sessionRoles·expertCalls 액션
- `src/pages/Phase3Page.jsx` — RoleCard 상단, 자동 브리핑 모달, ExpertCallButton 부착
- `src/components/phase3/LegislativeTab.jsx` — BillEditor → BillTemplate
- `src/components/phase3/ExecutiveTab.jsx` — BudgetPanel → BudgetReportTemplate
- `src/components/phase3/JudicialTab.jsx` — 판결문 → VerdictTemplate
- `src/pages/TeacherDashboard.jsx` — ExpertCallNotifier 패널
- `docs/firebase_rules.json` — expertCalls 규칙 추가

## 5. 운영 원칙

- 4역할 배정 UI는 **드래그가 아닌 셀렉터** (학생 태블릿 안정성)
- PlaceholderField 빈칸은 **제출 차단**
- 전문가 호출 한도 = **페이즈 3 전체 누적 3회** (sessionId 무관)
- 4역할 배정은 모둠장 자율(교사 직접 지시 X — 다큐 페르소나 유지)

## 6. 진행 방식

자동 모드 — 사용자 GO 사인 받은 후 V3-1부터 V3-6까지 자동 진행. 각 패키지 끝마다 HMR 검증 + history.md 기록. V3-6에서 배포 후 사용자 최종 시연.
