# 디자인 리뉴얼 v4.1 구현 계획 (Antigravity)

이 계획은 `docs/proposal_design_v4.md`에 정의된 '디자인 v4.1' 명세를 바탕으로, 현재의 Tailwind 기반 MVP를 '브루탈리스트/갱지' 스타일로 리뉴얼하는 과정을 담습니다.

## ⚠️ 현재 상태: 보류 (On Hold)
사용자 요청에 의해 작업 착수 전 대기 중입니다. 반응형 전략 보강 후 재승인이 필요합니다.

## 사용자 검토 필요 항목

> [!IMPORTANT]
> **전략 선택**: `proposal_design_v4.md`에서 제안된 **옵션 B(단계적 적용)**를 따릅니다. 
> 1단계에서는 디자인 시스템(토큰, 폰트, 전역 스타일)을 구축하고, 2단계부터 화면별로 레이아웃을 교체합니다.

> [!CAUTION]
> **반응형 브루탈리스트 전략**: 디자인 미감은 유지하되, 레이아웃 깨짐을 방지하기 위해 다음 규칙을 강제합니다.
> 1. **Fluid Layout**: 1280px 고정 대신 `max-w-screen-xl`과 `w-full` 조합 사용.
> 2. **Adaptive Shadow**: 화면 크기에 따라 그림자 두께(`shadow-[offset]`) 동적 조절 (sm/md/lg 분기).
> 3. **Conditional Nav**: 모바일 환경에서 Sidenav를 하단바(Bottom Nav)로 전환하거나 햄버거 메뉴로 숨김.
> 4. **Safe Rotation**: 요소 회전(`-0.5deg`~`0.5deg`) 적용 시 주변 `padding` 가드 확보 및 `overflow-visible` 설정.

## 제안된 변경 사항

### 1. 디자인 시스템 구축 (Foundation)

#### [MODIFY] [tokens.js](app/src/styles/tokens.js)
- 새로운 컬러 팔레트 추가: `paper` (#f3ecd8), `ink` (#1b1a16), `brand-red` (#c0362c).
- 포스트잇 6종 색상 정의 (`postit-yellow`, `postit-green` 등).
- `CARD` 스타일을 브루탈리스트(단단한 그림자, 먹선 테두리) 스타일로 갱신.

#### [MODIFY] [index.css](app/src/index.css)
- Google Fonts 5종 임포트.
- CSS 변수(`--paper`, `--ink` 등) 정의.
- 전역 브루탈리스트 유틸리티 클래스 추가 (예: `.brutal-shadow`, `.pts-card`).

### 2. 컴포넌트 리뉴얼 (Step-by-Step)

#### [MODIFY] [EntryPage.jsx](app/src/pages/EntryPage.jsx)
- 첫 진입 화면에 새 디자인 시스템 적용 (PoC).
- 갱지 배경, 손글씨체 제목, 도장 효과 적용.

#### [NEW] [Statusbar.jsx](app/src/components/shared/Statusbar.jsx)
- 새로운 상단 정보 바 구현 (기존 RoomBar 대체 준비).

---

## 검증 계획

### 수동 검증
- 브라우저에서 `EntryPage`가 설계된 와이어프레임(`wireframes_civsq_v4_1.html`)과 유사한 미감을 내는지 확인.
- 폰트 로딩 및 텍스트 가독성 점검.
- 반응형(태블릿 1024px) 환경에서 레이아웃 깨짐 확인.
