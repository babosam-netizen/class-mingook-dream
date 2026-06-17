# 민국이의 꿈 프로젝트 — 히스토리 아카이브 (v1)

> **기간:** 2026-04-25 ~ 2026-05-11
> **내용:** v0.0.0 ~ v1.1.9
> **참고:** 이 문서는 `history.md`가 너무 커져서 분리된 과거 기록입니다. 최신 기록은 [history.md](../docs/history.md)를 확인하세요.

---

## v1.1.9 — 법안 삭제 기능 버그 수정 (2026-05-11 / [Antigravity])

- [x] **삭제 로직 정상화**: `BillTemplate` 컴포넌트에서 삭제 함수(`removeAt`)가 누락되어 작동하지 않던 버그를 수정함. 이제 정상적으로 법안 삭제가 가능합니다.

---

## v1.1.8 — 법안 삭제 기능 추가 (2026-05-11 / [Antigravity])

- [x] **법안 삭제 버튼 구현**: 발의한 법안이 '토의 중' 단계일 때, 학생 모둠이 직접 삭제하고 다시 작성할 수 있도록 [🗑️ 삭제] 버튼을 추가함. (정식 상정 이후에는 무결성을 위해 삭제 불가)

---

## v1.1.7 — 입법부 운영 모드별 맞춤 안내 적용 (2026-05-11 / [Antigravity])

- [x] **운영 모드별 지침 다변화**: 입법부 활동 시 '공동 작업 모드'와 '역할 중심 모드'에 따라 `ProgressGuide`의 안내 문구가 자동으로 바뀌도록 수정함. (공동 작업 시 "함께 법안 작성" 안내, 역할 중심 시 "내 역할 미션 수행" 안내)

---

## v1.1.6 — 학생 미리보기 화면 일관성 수정 (2026-05-11 / [Antigravity])

- [x] **진행 단계 복구 및 버튼 숨김**: 학생 화면에서 `ProgressGuide`를 다시 노출하되, 교사가 '학생 미리보기'로 볼 때는 [이전/다음 단계] 제어 버튼이 나오지 않도록 수정함 (`previewMode` 시 `role`을 'student'로 강제 전달).
- [x] **미리보기 섹션 노출 수정**: 학생용 역할 카드 등이 교사 미리보기 모드에서도 실제 학생 화면과 동일하게 나타나도록 `isStudent` 판정 로직을 적용함.

---

## v1.1.5 — 학생용 상세 진행 단계(ProgressGuide) 숨김 (2026-05-11 / [Antigravity])

- [x] **학생 UI 간소화**: 입법/행정 활동 시 상단에 표시되던 상세 진행 단계(`ProgressGuide`)를 학생 화면에서 숨김 처리함. 해당 컴포넌트는 교사 제어용 성격이 강하므로 교사 화면에서만 유지하여 UX를 간결하게 개선.

---

## v1.1.4 — 브리핑 모달 위치 조정 (2026-05-11 / [Antigravity])

- [x] **모달 상단 배치**: 최우선 과제 보고서 모달을 화면 중앙에서 상단(`items-start`, `pt-10`)으로 이동하여, 스크롤 없이도 즉시 주요 내용을 확인할 수 있도록 개선함.

---

## v1.1.3 — 세 번째 여정 브리핑 모달화 (2026-05-11 / [Antigravity])

- [x] **최우선 과제 다시보기 모달화**: 세 번째 여정(Phase 3)의 첫 활동인 '최우선 과제 다시보기'를 고정 섹션에서 팝업 모달 형태로 변경함.
- [x] **비차단 레이아웃**: 브리핑 단계에서도 메인 페이지 내용을 가리지 않고 위에 띄우며, 학생이 확인 후 닫을 수 있도록 개선하여 UX 편의성 증대.

---

## v1.1.2 — 최우선 과제 선정 중복 호출 방지 (2026-05-11 / [Antigravity])

- [x] **중복 선정/취소 버그 수정**: 선정 버튼 클릭 시 이벤트 전파 중단(`stopPropagation`) 및 처리 중 중복 요청 방지(`useRef` lock) 로직을 추가하여 "선정되었습니다" 직후 "취소되었습니다"가 뜨는 오동작 해결.
- [x] **선정 비교 로직 강화**: `roomData.coreIssue`와 선택 항목 간의 비교 로직을 UI 표시 조건과 일치시켜 판정 정확도 향상.

---

## v1.1.1 — 최우선 과제 선정 수동 제어 완결 (2026-05-11 / [Antigravity])

- [x] **여론조사 자동 선정 로직 완전 제거**: 사후 여론조사 1 종료 시 1위 항목이 자동으로 최우선 과제로 선정되던 잔존 로직을 `PollManager.jsx`에서 삭제하여 교사의 100% 수동 제어권을 보장함.

---

## v1.1.0 — 교육적 통제권 강화 및 시스템 안정화 (2026-05-11 / [Antigravity])

- [x] **코어 이슈(최우선 과제) 선정 로직 개편**: 1위 자동 확정 방식을 폐지하고, 교사가 직접 항목을 선택/잠금/해제할 수 있는 수동 제어 시스템 구현 (`CoreIssuePoll.jsx`).
- [x] **빌드 크래시 및 참조 오류 수정**: `LegislativeTab.jsx`의 파손된 JSX 구조 복구 및 평탄화 작업을 통해 `ReferenceError: config is not defined` 근본 해결.
- [x] **Phase 3 브리핑 UI 최적화**: 최우선 과제 보고서 열람 시 상단 워크플로 진행 바를 숨겨 시각적 집중도 향상 (`Phase3Page.jsx`).
- [x] **협업 모드 동기화**: 입법부(`LegislativeTab`)와 행정부(`ExecutiveTab`)의 공동 작업 모드(`branchConfig`) 참조 로직 안정화 및 UI 레이아웃 정돈.
- [x] **배포 준비**: 빌드 오류 요인 전수 제거 및 코드 정합성 검증 완료.

---

## v1.0.0 (2026-05-11) [Antigravity] — 여정 1 페이지 크래시 수정 및 안정화
- **중요 수정**: `Phase1Page`에서 `currentPhase` 변수 미정의로 인해 페이지가 멈추거나 백화 현상이 발생하는 오류를 수정했습니다.
- **버전 상향**: 안정성 개선을 포함한 주요 버그 수정이 완료되어 v1.0.0으로 상향했습니다.

---

## v0.9.99 (2026-05-11) [Antigravity] — 토론 도구 오류 수정 및 기본 명칭 변경
- **토론 도구 안정화**: `TeacherDebateControl`에서 `newTitle` 변수 미정의로 인한 크래시(백화 현상)를 수정했습니다.
- **기본 명칭 변경**: 나라/학급 이름을 설정하지 않았을 때의 기본값을 '동네'에서 **'우리 반'**으로 변경했습니다. 시민광장, 워크플로, 글쓰기 템플릿 등에 일괄 적용되었습니다.

---

## v0.9.98 (2026-05-11) [Antigravity] — 최우선 과제 선택 토글 및 노출 지연 적용
- **최우선 과제 토글**: 사후 여론조사 결과에서 이미 선택된 과제를 다시 클릭하면 선택이 해제되도록 수정하여 교사의 조작 실수를 방지했습니다.
- **노출 지연**: 여정 1에서 최우선 과제가 선택되더라도 교사가 '8번: 최우선 과제 잠금' 단계에 도달하기 전까지는 학생 화면에서 숨겨지도록 노출 조건을 강화했습니다.

---

## v0.9.97 (2026-05-11) [Antigravity] — 시민단체 이름 변경 동기화 및 UI 개선
- **데이터 동기화**: 학급 설정에서 시민단체 이름을 변경할 때, 이미 생성된 실제 모둠 데이터의 이름도 함께 업데이트되도록 개선했습니다. 이제 학생들의 소속을 유지하면서 이름만 바꿀 수 있습니다.
- **UI 개선**: 시민단체 이름이 즉시 바뀌지 않고 [수정] 버튼 클릭 후 [저장]을 눌러야 반영되도록 변경하여 사용자의 혼동을 줄였습니다.

---

## v0.9.96 (2026-05-11) [Antigravity] — 보안 강화 및 데이터 유효성 검사 적용
- **보안 강화**: 메인 화면 하단의 '슈퍼 관리자' 링크를 숨겨 학생들의 무단 접근을 방지했습니다. (URL 직접 입력 시에만 접근 가능)
- **입력 검증**: 학생 번호를 1 이상의 숫자만 입력 가능하도록 차단하고, 학급 생성 시 학급명을 최소 2자 이상 입력하도록 강제했습니다. 이로써 0번 학생이나 무분별한 테스트용 방 생성을 방지합니다.

---

## v0.9.95 (2026-05-11) [Antigravity] — 주장글, 포스터, 외부 링크 등 각종 데이터 수정 오류 해결
- **버그 수정**: 데이터 수정 시 존재하지 않는 함수(`setRTDB`)를 호출하던 오류를 수정했습니다. 이제 '주장하는 글', '캠페인 포스터', '외부 자료 링크', '기사 작성' 등 모든 편집 기능이 정상적으로 작동합니다.

---

## v0.9.94 (2026-05-11) [Antigravity] — 새로운 도메인(<배포주소>) 대응 및 유연성 강화
- **도메인 대응**: 새로운 서비스 환경을 위해 도메인 고정 로직을 유연화하고 경로 관리 체계를 최적화했습니다.

---

## v0.9.92 (2026-05-11) [Antigravity] — Phase 3 브리핑 화면 참조 오류 긴급 수정
- **버그 수정**: `Phase3Page.jsx`에서 `config` 변수 선언 누락으로 인해 발생하던 `ReferenceError: config is not defined` 오류를 해결했습니다.

---

## v0.9.91 (2026-05-11) [Antigravity] — 학급별 '나라 이름' 개인화 및 여정(Journey) 체계 정착
- **나라이름(Country Name) 설정 도입**: 교사용 관리 화면(학급 설정)에서 우리 반만의 특별한 '나라 이름'을 정할 수 있는 기능을 추가.
- **다이내믹 텍스트 치환**:
  - 학생 화면 브리핑, 공고문, 가이드 등에서 '우리 동네', '우리 반' 표현을 설정된 '나라 이름'으로 자동 치환 (예: "우리 동네 문제를 해결합시다" → "배곧국가 문제를 해결합시다").
  - **교육적 예외 적용**: 첫 번째 여정의 2번 활동인 '우리 동네 문제 발굴'은 활동의 본질을 살리기 위해 '우리 동네' 표현을 유지하도록 정밀 제어.
- **여정(Journey) 용어 정착**:
  - 교사용 대시보드 및 학생 가이드 전반에서 Phase N 대신 **'N번째 여정'** 표현을 기본으로 사용.
  - 여정 단계별 배지와 헤더 디자인을 '여정' 컨셉에 맞춰 최적화.
- **핵심 화면 개인화 강화**:
  - **Phase 1 (시민 광장)**: 최우선 과제 확정 전광판에 나라 이름을 노출하여 몰입감 증대.
  - **Phase 3 (국정 포털)**: '최우선 과제 보고서' 발행 주체를 '나라 이름 국정운영위원회'로 표시하여 공신력 강화.
- **여론조사 문항 연동**: 모든 여론조사 질문과 선택지 내 '우리 동네' 키워드를 실시간으로 나라 이름과 연동하여 현장감 있는 투표 환경 조성.

---

## v0.9.90 (2026-05-11) [Antigravity] — 교육 시뮬레이션 전면 우리말화 (Koreanization)
- **글로벌 용어 정비**: '페이즈' → **'여정'**, '코어 이슈/아젠다' → **'최우선 과제'**, '라운드' → **'부 활동'**, '세션' → **'차시'**로 전면 교체.
- **UI/UX 현지화**:
  - '인벤토리' → **'저장소'**, '베네핏 카드' → **'특권 카드'**로 변경하여 학생들의 직관적 이해도 향상.
  - '슬로건' → **'구호'**로 순화하여 시민단체 활동의 활력 강화.
  - '대시보드' → **'관리 화면'**, '상태' → **'상태'**, '리포트' → **'보고서'** 등 행정 용어 정비.
- **콘텐츠 및 가이드 교정**: `scaffolding-data.js` 및 각 단계별 브리핑, 미션 가이드 내 기술 용어를 친근한 우리말로 전수 교정.
- **시스템 정합성 유지**: 내부 데이터 키(ID)는 유지하면서 사용자 노출 텍스트만 완벽하게 순화하여 시스템 안정성과 교육적 효과를 동시 확보.

---

## v0.9.84 (2026-05-10) [Antigravity] — 코어 이슈 선정 가독성 강화
- **교사 제어판 시각화**: 여론조사 결과에서 선정된 코어 이슈 항목을 황금색 배경 및 왕관 아이콘으로 강조 표시.
- **상태 배지 적용**: 이미 선정된 항목에 '✅ 선정됨' 배지를 적용하여 중복 클릭 방지 및 상태 확인 용이성 증대.

## v0.9.83 (2026-05-10) [Antigravity] — 코어 이슈 표시 동기화 및 호환성 수정
- **표시 로직 보완**: Phase 1 '잠금' 전광판 및 Phase 3 '브리핑' 화면에서 텍스트 형태의 코어 이슈도 완벽히 노출되도록 수정.
- **학생 화면 즉시 반영**: 교사가 수동 선정 버튼 클릭 시 학생 화면의 "미선정" 메시지가 즉각 업데이트되지 않던 현상 해결.

## v0.9.82 (2026-05-10) [Antigravity] — 코어 이슈 자동/수동 선정 시스템 강화
- **자동 선정**: '사후 여론조사 1' 마감 시 득표율 1위 항목을 시스템이 자동으로 코어 이슈로 등록.
- **수동 선정**: 여론조사 결과 목록 우측에 '코어 이슈로 선정' 버튼 추가하여 교사가 직접 확정 가능.
- **데이터 호환**: 모둠 ID뿐만 아니라 일반 텍스트 형태의 코어 이슈도 브리핑 화면에 정상 표시되도록 보완.

## v0.9.81 (2026-05-10) [Antigravity] — Phase 3 코어 이슈 브리핑 강화
- **프리미엄 브리핑**: Phase 3 '코어 이슈 다시보기' 단계를 국가 의제 리포트 스타일의 하이라이트 섹션으로 개편.
- **연결성 안내**: 코어 이슈가 입법·행정·사법 각 라운드와 어떻게 연동되는지 가이드 카드 추가.
- **디자인 최적화**: 종이 질감, 국장 스탬프 등 상징적 요소를 활용한 고품격 디자인 적용.

## v0.9.80 (2026-05-10) [Antigravity] — 여론조사 명칭 체계 전면 개편
- **토론 도구**: '토론 전 여론조사' 및 '토론 후 여론조사'로 명칭 통일.
- **정규 여론조사**: 페이즈별 '사전/사후 여론조사 N' 체계 도입 (Phase 3은 3-1, 3-2, 3-3 세분화).
- **UI 일관성**: 워크플로우 가이드 및 템플릿 항목 명칭 동시 업데이트.

## v0.9.79 (2026-05-10) [Antigravity] — 여론조사 제어판 청원 머리말 연동
- **기능 이전**: 토론 도구의 연동 로직을 제거하고 메인 [여론조사 제어판]으로 기능 통합.
- **선택지 자동 구성**: 여론조사 생성/수정 시 학급 설정의 '청원 머리말'을 원클릭으로 불러오는 기능 추가.
- **사전 여론조사 최적화**: Phase 1 사전 여론조사 항목 구성을 더욱 편리하게 개선.

## v0.9.77 (2026-05-10) [Antigravity] — 다자 토론 진영 배정 로직 수정
- **버그 수정**: 다자 토론 유형에서 진영 버튼(1, 2, 3...) 클릭 시 학생 ID가 정상적으로 전달되지 않던 변수명 중첩 오류 해결.

## v0.9.76 (2026-05-10) [Antigravity] — 학생 진영 배정 버그 수정
- **버그 수정**: 토론 도구에서 학생 진영(찬성, 반대 등) 버튼 클릭 시 데이터가 업데이트되지 않던 현상 수정.
- **기술적 개선**: Firebase 단일 값 업데이트 시 `updateAt` 대신 `setAt`을 사용하여 데이터 쓰기 오류 해결.

## v0.9.75 (2026-05-10) [Antigravity] — 토론 유형 확장 및 진영 관리 시스템 개편
- **유형 다양화**: 찬반 토론(Fixed), 다자 토론(3~6개), 문제 해결형(자유 발언) 탭 도입.
- **진영 이름 편집**: 다자 토론 시 선생님이 각 진영의 명칭(예: 환경부, 시민단체 등)을 직접 수정 가능.
- **노출 옵션 강화**: 토론 전 준비 카드를 '평가단 학생'에게도 노출할 수 있는 체크박스 추가.
- **UI 최적화**: 학생 진영 배정 섹션을 상단으로 배치하여 수업 준비 동선을 효율화.

## v0.9.74 (2026-05-10) [Antigravity] — 레이어 창 닫힘 방식 개선
- **사용성 개선**: 교사 대시보드의 모든 모달 창(링크 관리, 토론 도구, 국민청원, 학급 설정)에서 배경 클릭 시 창이 닫히는 기능을 제거.
- **실수 방지**: 상단의 [✕] 버튼을 누를 때만 창이 닫히도록 변경하여 작업 중 의도치 않은 종료를 방지.

## v0.9.73 (2026-05-10) [Antigravity] — 토론 도구 팝업 제어 및 사전 편집 기능 도입
- **팝업 마스터 제어**: 교사 제어판에 [토론 창 올리기/내리기] 버튼을 추가하여 학생 화면 노출 시점을 여론조사처럼 자유롭게 제어 가능.
- **사전 편집성 강화**: 학생에게 노출하기 전이라도 토론 순서와 타이머를 미리 편집하고 준비할 수 있도록 구조 개선.
- **UI 간소화**: 세션 시작 시 페이즈 선택 단계를 제거하여 접근성 향상.

## v0.9.72 (2026-05-10) [Antigravity] — 설정-대시보드 실시간 동기화 도입
- **데이터 불일치 해결**: 학급 설정에서 배정표 저장 시, 현재 접속 중인 학생들의 실제 모둠 상태(`groupId`)를 배정표와 강제 동기화하도록 개선.
- **모둠 멤버십 자동 정리**: 배정표 변경에 따라 학생이 모둠을 옮기거나 나갈 때 각 모둠의 멤버 목록(`groups/members`)도 즉시 업데이트되어 현황판에 실시간 반영됨.

## v0.9.71 (2026-05-10) [Antigravity] — 미지정(해제) 저장 버그 수정
- **버그 수정**: 배정표에서 '미지정'으로 변경 시 Firebase 서버에서 실제로 데이터가 삭제되지 않던 현상 해결 (명시적 `null` 전달 로직 적용).
- **최종 빌드 및 배포 완료**.

## v0.9.70 (2026-05-10) [Antigravity] — 버전 관리 정상화 및 배정표/가시성 개선 배포
- **빌드 버전 통합**: `v0.9.66` 이후의 작업을 `v0.9.70`으로 통합 관리.
- **배포 완료**: 로컬 빌드 후 서버(`https://<배포주소>/class_democra/app/`) 재배포 완료.

## v0.9.69 (2026-05-10) [Antigravity] — 번호별 모둠 지정 방식 개선 (수동 저장 도입)
- **실수 방지 로직**: 번호별 지정 시 즉시 저장되지 않고, '로컬 상태'에서 수정 후 [배정표 저장하기] 버튼을 눌러야 실제 반영되도록 변경.
- **시각적 피드백**: 수정 중인 번호는 주황색 배경과 깜빡이는 점(●)으로 표시하여 변경 사항을 한눈에 확인 가능.
- **취소 기능**: [취소] 버튼 클릭 시 현재 서버에 저장된 원래 상태로 즉시 복구 가능.

## v0.9.68 (2026-05-10) [Antigravity] — 시민단체 활동 가시성 개선 및 안내 강화
- **가시성 조건 완화**: 모둠에 아직 가입하지 않은 학생도 Phase 1 활동 안내(포스터/주장글/영상 안내)를 볼 수 있도록 수정.
- **가입 유도 UI**: 모둠 미가입 상태일 경우 "활동을 위해 시민단체에 가입해 주세요"라는 안내 메시지와 함께 가입 패널로 유도.
- **HighlightBox 시인성**: 강조되지 않은 섹션의 투명도와 블러 효과를 조정하여 정보 접근성 향상.

## v0.9.67 (2026-05-10) [Antigravity] — 1차 여론조사 항목 국민청원 연동
- **데이터 기반 선택지**: 1차 사전 여론조사 보기를 기존 모둠명 대신 학생들이 실제 작성한 '국민청원 말머리(Prefix)'들로 자동 생성.
- **실시간 동기화**: 수집된 청원 데이터에서 유니크한 키워드를 추출하여 여론조사 옵션으로 즉시 반영.

## v0.9.66 (2026-05-07) [Antigravity] — 국민청원 말머리별 게시글 수 표시 기능 추가
- **필터 UI 강화**:
  - 국민청원 게시판 필터에서 각 말머리(Prefix) 버튼 옆에 해당 말머리로 작성된 청원의 총 개수를 표시.
  - '전체' 버튼에도 총 청원 수를 표시하여 직관적인 통계 확인 가능.
- **데이터 집계 로직 보강**:
  - `petitionStore.js`에 `prefixFrequency` 집계 함수를 추가하여 효율적으로 카운트 계산.

## v0.9.65 (2026-05-07) [Antigravity] — 내 국민청원 목록 간소화 (제목+날짜+수정/삭제)
- **목록 레이아웃 최적화**:
  - 입력 폼 하단 '내가 작성한 청원' 목록에서 복잡한 카드를 제거하고, 제목과 작성일시만 표시하는 슬림한 리스트 형태로 변경.
  - 좁은 사이드바 너비에 최적화하여 가독성 향상.
- **삭제 기능 추가**:
  - 본인이 작성한 청원을 즉시 삭제할 수 있는 '삭제' 버튼 추가 및 RTDB 연동.
- **수정 모달 독립화**:
  - 목록에서 수정 버튼 클릭 시 독립된 모달로 `PetitionForm`을 띄워 사용자 경험 개선.

## v0.9.64 (2026-05-07) [Antigravity] — 교사용 국민청원 말머리 커스텀 설정 기능 추가
- **학급 설정(ClassroomConfigEditor) 고도화**:
  - '추가 시스템 활성화' 섹션의 국민청원 시스템 토글 하단에 **청원 말머리 편집 기능**을 신설.
  - 기존 하드코딩된 기본 말머리(환경, 노동, 주거, 인권, 교육, 안전, 기타) 대신 교사가 학급 특성에 맞게 쉼표(,)로 구분하여 자유롭게 말머리를 추가/삭제할 수 있도록 구현.
  - 변경된 값은 `petitionConfig.prefixOptions`에 배열로 저장되며, 학생 청원 폼(`PetitionForm`)과 게시판 필터(`PetitionFilter`)에 즉시 연동됨.

## v0.9.63 (2026-05-07) [Antigravity] — 새로고침 캐시 갱신 정책 강화
- **브라우저 캐시 무효화 (Cache-Control)**:
  - `index.html`의 `<head>` 영역에 `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, `Expires: 0` 메타 태그를 추가.
  - 이를 통해 브라우저가 이전 버전의 HTML을 캐싱하여, 배포 후에도 새로고침 시 즉각 최신 버전을 불러오지 못하는 현상(백화현상 또는 구버전 노출)을 방지함.

## v0.9.62 (2026-05-07) [Antigravity] — 내 국민청원 목록 별도 노출 기능 추가
- **입력 폼 하단 내 청원 목록 배치**:
  - `PetitionBoard.jsx`에서 국민청원 입력 폼 바로 아래에 로그인한 학생 본인이 작성한 청원 목록(`내가 작성한 청원`)을 별도로 노출.
  - 작성 직후 자신의 글을 쉽게 찾아볼 수 있으며, 해당 목록의 카드에서 바로 '수정' 버튼을 눌러 내용을 고칠 수 있도록 동선 최적화.

## v0.9.61 (2026-05-07) [Antigravity] — 국민청원 본인 수정 기능 추가
- **국민청원 수정 기능**:
  - `PetitionCard.jsx`에서 본인이 작성한 청원 카드 하단에 '수정' 버튼 노출.
  - 클릭 시 `PetitionForm`을 수정 모드로 띄우도록 모달 레이아웃 연동.
- **폼 컴포넌트 재사용성 강화**:
  - `PetitionForm.jsx`가 `editData`와 `onCancel` prop을 받아 수정 모드로 동작할 수 있도록 로직 보강.
  - 수정 시 RTDB의 `updateAt`을 호출하여 청원 내용(제목, 주장, 근거, 미디어 URL 등) 업데이트.

## v0.9.56 (2026-05-07) [Antigravity] — 교사 대시보드 통합 모니터링 고도화 및 페이즈 1 활동 체계 개편
- **시민단체 현황판(GroupFormationMonitor) 대규모 개편**:
  - **3열 그리드 레이아웃**: 시민단체별 카드를 가로 3열로 배치하여 가로 공간 활용도를 높이고 가독성을 개선함.
  - **미지정/미접속 섹션 하단 통합**: 그리드 내부에 섞여 있던 미지정 학생 및 미접속 섹션을 하단 가로 와이드 바 형태로 분리하여 시각적 질서를 확보함.
  - **오프라인 지정 학생 표시**: 시민단체에 지정되었으나 아직 접속하지 않은 학생을 해당 모둠 카드 내에 '미접속' 상태로 미리 표시하여 교사의 학생 관리를 용이하게 함.
- **교사 대시보드 레이아웃 밸런스 조정**:
  - 우측 사이드바 제거에 맞춰 전체 레이아웃을 중앙 집중형으로 변경하고, 학급 요약과 학생 화면 미리보기 비율을 1.2 : 1로 조정하여 안정적인 밸런스를 구현함.
- **페이즈 1 활동 순서 및 안내 체계 고도화**:
  - **활동 순서 재배치**: 포스터 평가(5단계) 직후 '사후 여론조사 1 및 코어 이슈 선정(6단계)'을 먼저 진행하고, 그 결과를 바탕으로 '기사 작성(7단계)'을 하도록 순서를 변경하여 학습 흐름을 최적화함.
  - **사전 여론조사 1(분야 선정) 통합**: 3단계 '시민단체 결성' 과정에 사전 여론조사를 내장하여 학생들이 가입과 동시에 의견을 개진할 수 있도록 함.
  - **단계 가이드 UI 개선**: 완료된 단계에서 체크표시(`✓`) 대신 원래 번호를 유지하되, 초록색 동그라미 배경을 사용하여 진행 상태를 더 직관적으로 파악할 수 있게 함.
- **여론조사 제어 도구(PollManager) UX 정밀화**:
  - **토글형 페어 버튼**: 투표(시작/종료/재개), 게시(게시/취소), 팝업(띄우기/내리기) 버튼들이 같은 위치에서 상태에 따라 텍스트와 디자인만 바뀌도록 페어링하여 교사의 혼란을 방지함.
  - **미리보기 지원**: 교사용 대시보드의 '학생 화면 미리보기'에서도 여론조사 섹션이 정상적으로 나타나도록 `previewMode` 프롭스 체계를 구축함.
  - **자동 활성화 보정**: 사전 여론조사가 기본적으로 '투표 중(voting)' 상태로 생성되도록 하고, 기존 방의 '준비(idle)' 상태 여론조사도 자동으로 활성화하는 보정 로직을 추가함.
- **자동 빌드 및 배포 시스템 적용**: 코드 수정 후 `deploy.sh`를 자동으로 실행하여 실시간 수업 환경에 즉각 반영되는 체계를 구축함.


## v0.9.55 (2026-05-06) [Antigravity] — 페이즈 1 오프닝 단계 몰입도 개선 및 여론판 로직 수정
- **오프닝 단계 학생 화면 집중 유도**: 워크플로 1단계('오프닝') 진행 시, 학생 화면의 '국민청원' 탭부터 여론판, 여론조사 등 하위 콘텐츠 일체를 완전히 숨김 처리하여 클릭 유혹을 제거함.
- **오프닝 단계 안내 메시지 깜박임 제거**: 오프닝 단계 메시지 상자의 깜박임(`animate-pulse`) 효과가 오히려 집중을 흩트린다는 피드백에 따라 정적(Static) 메시지로 변경.
- **여론판(NewsBoardPage) 여론조사 노출 로직 분리**: 기본(계획된) 여론조사는 완료(게시) 전까지 여론판에 뜨지 않도록 하고, 교사가 즉흥적으로 만든 실시간(수시) 여론조사만 투표 진행 중에도 여론판에 뜨도록 `newsBoardMode` 프롭스를 추가하여 로직을 정교화함.
- **한눈에 여론(사이드 배너) 노출 조건 강화**: 사이드 배너에서도 기본 여론조사는 '투표 진행 중(voting)'이더라도 현재 워크플로 활동 순서와 일치하지 않으면 아예 노출되지 않도록(비공개) 숨김 처리. 해당 워크플로 단계에 도달하면 자동으로 다시 나타나도록 개선함.
- **교사용 여론조사 관리 메뉴 개선**:
  - 기존 '🎯 코어이슈로 확정' 버튼을 제거하고, 대신 결과를 숨길 수 있는 '🚫 게시 취소 (결과 비공개)' 버튼을 추가함.
  - 여론조사 목록을 한눈에 파악하기 쉽도록 **'⚡ 수시 (실시간) 여론조사'**를 맨 위로 고정 분리하고, 그 아래에 **'📊 정규 (계획된) 여론조사'**를 표시하도록 UI를 이원화함.

## v0.9.54 (2026-05-06) [Codex] — 교사용 전광판 이름 글자 확대 및 칸 밀도 조정

**`TVBoardPage.jsx`**
- 30명 슬롯 전광판의 이름 텍스트를 `text-xl / md:text-3xl`로 확대해 칸 안에서 더 크게 보이도록 조정.
- 셀 내부 여백을 소폭 늘려(`px-3~4`, `py-2~2.5`) 글자가 너무 붙지 않게 하면서도 칸을 꽉 채워 보이게 개선.
- 상태 라벨(투표전/찬성/반대/기권)은 이름 크기 상향에 맞춰 함께 키워 가독성 균형 유지.

**`build-info.js`**
- 헤더 빌드 번호를 `v0.9.54`로 갱신.

## v0.9.53 (2026-05-06) [Codex] — 상단 헤더에 빌드 번호 표시 + 빌드 번호 관리 지침 추가

**`RoomBar.jsx`**
- `민국이의 꿈 / 학급 / 반코드` 옆에 빌드 번호 칩을 추가해 현재 배포 빌드를 화면에서 즉시 확인 가능하도록 개선.

**`app/src/lib/build-info.js`**
- 상단 헤더에서 참조하는 빌드 정보 상수 파일 신설.
- 현재 빌드 번호를 `APP_BUILD = 'v0.9.53'`으로 설정.

**문서 지침 업데이트**
- `AGENTS.md`: 작업 마감 절차에 “배포 변경 시 `app/src/lib/build-info.js` 갱신 + 동일 번호를 `history.md`에 기록” 규칙 추가.
- `docs/dev_guidelines.md`: 문서/배포 체크리스트에 `build-info.js` 갱신 항목 추가.
- `docs/project_context.md`: 필수 준수 규칙에 빌드 칩 갱신 의무 추가.

## v0.9.52 (2026-05-06) [Codex] — 교사용 전광판 30명 고정 슬롯 + 이름 옆 실시간 상태 라벨 적용

**`TVBoardPage.jsx`**
- 하단 명단 영역을 `30명 고정(5열 × 6행)` 슬롯형 전광판으로 재구성.
- 각 칸에 `번호 + 이름`을 더 크게 표시하고, 이름 오른쪽에 상태 라벨을 붙이도록 변경.
- 상태 라벨을 `투표전 / 찬성 / 반대 / 기권`으로 구분하고 색상도 각각 분리 적용.
- 학생 데이터가 비어 있는 슬롯은 `미배정`으로 표기해 30칸 레이아웃을 항상 유지.
- 상단 집계의 `재적`은 30 고정, `재석`은 현재 학생 수로 표기하도록 조정.

## v0.9.51 (2026-05-06) [Codex] — 학생 표결판에 코어이슈·법안 본문 전체 안내 추가

**`LegislativeBoardModal.jsx`**
- 학생 표결 화면 상단에 `코어 이슈` 카드 추가: 현재 학급 코어이슈(모둠명/문구 포함 가능)를 표결 중 항상 확인 가능하도록 표시.
- 학생 표결 화면에 `이번 표결 법안 내용` 카드 추가: 법안 본문(`bill.body`)을 스크롤 가능한 전체 텍스트로 노출.
- 본문이 없는 경우를 대비해 `templateData`를 조항/섹션 텍스트로 합성해 보여주는 fallback 로직(`buildBillBodyText`) 추가.
- 집계 비노출 + 수동 표결 구조는 유지하면서, 학생이 “어떤 이슈를 위한 어떤 법안인지”를 읽고 투표하도록 정보 밀도를 보강.

## v0.9.50 (2026-05-06) [Codex] — 교사용 전광판을 국회 전광판 레퍼런스 스타일로 재구성

**`TVBoardPage.jsx`**
- 교사용/송출용 전광판 UI를 레퍼런스 이미지 톤에 맞춰 `대한민국 국회` 헤더 + 어두운 본판 + 주황 경계선 구조로 전면 재구성.
- 상단을 `안건 제목` 행 + `재적/재석/찬성/반대/기권` 5칸 집계 행으로 정렬해 실제 본회의 전광판과 유사한 레이아웃 적용.
- 하단 명단 영역을 5열 고정으로 배치하고, 학생 이름은 표결 선택 상태별 색상(찬성/반대/기권/미투표)으로 표시.
- 화면 외곽도 프로젝터 송출용으로 질감 배경 + 고정 비율 프레임 중심으로 다듬어 교실 스크린 가독성 개선.

## v0.9.49 (2026-05-06) [Codex] — 학생 표결판 집계 비노출 + TV 전광판 16:9 프로젝터 레이아웃 조정

**`LegislativeBoardModal.jsx` (학생 표결 풀스크린)**
- 학생 화면에서 실시간 표결 진행/찬반기권 집계/투표자 목록/미투표 목록 노출을 제거.
- 표결 선택(찬성·반대·기권) 버튼 중심 화면으로 단순화하고 버튼·제목·안내 문구를 확대.
- 결과적으로 학생은 집계 영향 없이 개인 판단으로 투표하고, 완료 상태만 확인.

**`TVBoardPage.jsx` (교실 전광판 송출)**
- 전체 컨테이너를 16:9(최대 1920x1080) 중심 레이아웃으로 재구성해 프로젝터 송출 가독성 강화.
- 헤더/카운터/진행바/투표자 명단의 타이포·여백을 확대 조정.
- 기존 이름 기반 표결 전광판 기능(찬성/반대/기권, 미투표 명단)은 유지.

## v0.9.48 (2026-05-06) [Codex] — 본회의 전광판/학생 표결판 이름표시 + 퍼센트 숨김 적용

**`LegislativeBoardModal.jsx` (학생 표결 풀스크린)**
- 찬성/반대/기권 카운트는 유지하되 퍼센트 표시는 제거.
- 학생 번호·이름을 선택별(찬성/반대/기권)로 실시간 표시.
- 미투표 학생 목록도 함께 노출해 진행 상황을 이름 단위로 확인 가능하게 변경.

**`TVBoardPage.jsx` (TV 전광판)**
- 카운트 퍼센트 표시 제거.
- 이미지 스타일에 맞춰 찬성/반대/기권 3열에 학생 번호·이름을 색상별로 표시.
- 미투표 학생 목록을 하단에 노출해 사회자가 즉시 확인 가능하도록 개선.

## v0.9.47 (2026-05-06) [Codex] — 입법 상정 오프라인 토론 시작 시 교사용 토론도구 자동 오픈

**`Phase3LegislativeQuickPanel.jsx`**
- `[🎙️ 이 법안으로 오프라인 토론 시작]` 완료 후 `onOpenDebateTool` 콜백을 호출하도록 추가.

**`TeacherDashboard.jsx`**
- 입법 빠른 제어 패널에 `onOpenDebateTool={() => setDebateModal(true)}` 연결.
- 이제 상정 토론 시작 버튼을 누르면 학생 토론화면과 함께 교사 토론도구 모달도 즉시 열림.

## v0.9.46 (2026-05-06) [Codex] — 상정 토론 세션 삭제 시 `votes` 접근 오류 수정

**`TeacherDebateControl.jsx`**
- 토론 세션 삭제/초기화 타이밍에 `prePoll`이 비는 순간, 토론전 집계 로직이 `prePoll.votes`를 직접 참조하며 오류가 나던 문제 수정.
- 집계 루프를 `prePoll?.votes` 기반으로 변경해 세션 삭제 직후에도 안전하게 렌더링되도록 보강.

## v0.9.45 (2026-05-06) [Codex] — 입법 상정 오프라인 토의 기본 노출 범위 조정

**`Phase3LegislativeQuickPanel.jsx`**
- `[🎙️ 이 법안으로 오프라인 토론 시작]` 실행 시 기본 활성 도구를 `stancePollPre`만 켜도록 변경.
- 기존 기본값(`stancePollPre + prepCard`)에서 `prepCard` 자동 노출 제거.
- 결과적으로 학생 화면 기본 노출은 “토론전 여론조사”만, 토론전 카드는 교사가 별도 활성화할 때만 노출.

## v0.9.44 (2026-05-06) [Codex] — 여론조사 열기/학생 노출 시 렌더링 오류 추가 보강

**원인**
- 일부 여론조사 데이터에서 질문/태그/선택지가 문자열이 아닌 객체 형태로 섞여 들어와 렌더링 시 React #31 오류 발생.

**수정**
- `PollFeed.jsx`: 옵션/질문/태그를 안전 텍스트로 정규화해 학생 화면(일반/팝업) 렌더링 안정화.
- `PollManager.jsx`: 교사 여론조사 목록/편집/확정 흐름에서도 라벨 정규화 적용.
- `StancePoll.jsx`, `TeacherDebateControl.jsx`: 토론 전후 여론조사 선택지를 문자열 배열로 정규화해 `여론조사 열기`·`학생에게 노출` 시 오류 방지.

## v0.9.43 (2026-05-06) [Codex] — 입법부 역할 라벨 렌더링 오류(React #31) 긴급 수정

**문제**
- 일부 반 설정에서 역할 `label`이 문자열이 아니라 객체(`{id, label}`) 형태로 들어올 때, 화면 렌더링 중 React #31 오류가 발생.

**수정**
- `RoleAssigner.jsx`, `GroupRoleSummary.jsx`, `BranchUnitWorkspace.jsx`에 라벨 안전 변환(`string | object` 대응) 적용.
- 역할명 표시는 모두 텍스트로 정규화해 렌더링하도록 변경.

## v0.9.42 (2026-05-06) [Codex] — 입법부 Branch Unit 작성 흐름 추가 정리

**`BranchUnitWorkspace.jsx`**
- 섹션 초안 입력창(하단) 편집을 제거하고, 상단 메모 제출/수정 저장만으로 섹션이 갱신되도록 단일 입력 동선으로 정리.
- 메모 제출 시 담당 섹션 상태를 `텍스트 10자+링크 1개` 기준으로 즉시 반영하도록 보강.
- 역할별 섹션 초안은 모둠원 전체가 읽기 전용으로 확인 가능하게 유지하고, 카드마다 `담당 역할 + 담당 학생(번호/이름)` 표시 추가.
- 섹션 미작성 시 안내 문구를 “상단 메모 제출 시 자동 반영”으로 명확화.

**`GroupRoleSummary.jsx`**
- `statusOnly` 옵션 추가: 역할 현황 패널에서 작성 내용 펼침을 숨기고 작성 여부(대기/진행/완료)만 표시 가능.
- Branch Unit 화면에서는 `statusOnly` 모드로 사용해 “무엇을 썼는지” 대신 “작성했는지”만 보이게 조정.

## v0.9.41 (2026-05-06) [Codex] — 입법부 Branch Unit 발의 흐름 정리(기존/신규 중복 제거)

**`LegislativeTab.jsx`**
- Branch Unit(`legUnits`)가 설정된 반에서는 기존 `법안 발의 — 내 역할 작업 공간`(RoleWorkspace 기반) 섹션을 숨기도록 조건 추가.
- 입법 발의 단계에서 구형 UI와 신형 Branch Unit UI가 동시에 노출되던 문제 제거.

**`BranchUnitWorkspace.jsx`**
- 메모 액션을 `메모 저장`에서 `메모 제출/수정 저장` 흐름으로 변경.
  - 최초 제출 후 버튼 라벨이 `수정 저장`으로 전환.
  - 제출 여부는 `memberNotes/{studentId}/submittedAt`으로 관리.
- 메모 제출 시 담당 섹션(`assignedSection`) 초안에 메모 내용을 자동 반영하도록 연동.
  - 대표(👑)의 `rebuttal` 담당도 동일하게 반영되어 반론 섹션 초안 누락 문제 해결.
- 역할별 섹션 초안 목록에서 대표 역할을 제외하던 필터 제거.
  - 이제 대표 담당 섹션(우려 대응)도 다른 섹션과 동일하게 표시/편집 가능.

## v0.9.40 (2026-05-05) [Claude] — 입법부 4인 모둠: 대표가 우려 대응 섹션 겸임

**`scaffolding-data.js`**
- `billDrafter` (대표) `assignedSection: null` → `'rebuttal'` 로 변경 — 우려 대응 섹션 초안 담당 겸임
- 별도 `rebuttal` 역할 제거 (5인→4인 체계 완성)
- `billDrafter` memoGuide·todos — 반론 3가지 + 대응 방안 작성 + 3섹션 확인 + 최종 확정

**`BranchUnitWorkspace.jsx`**
- 섹션 필터 `r.assignedSection && !r.isRepresentative` → `r.assignedSection` 으로 변경
  - 대표도 자신의 담당 섹션(rebuttal)이 섹션 초안 목록에 표시됨
  - `allSectionsDone` 계산도 동일 필터 적용 (4섹션 모두 완료 시 대표 확정 버튼 활성)

## v0.9.39 (2026-05-05) [Claude] — 입법부 역할 5인 재편: 조사역·논리역·분석역·반박역 + 4섹션 분리

**`scaffolding-data.js` — legislative 역할 완전 재설계**
- 기존 3역할(자료조사원/발언자/기록자) + 대표 → 5역할 체계로 전환
  - `billDrafter` (👑 대표, isRepresentative) — 4개 섹션 검토·수정·최종 확정
  - `investigator` (🔎 조사역) → 섹션 `background` "입법 배경"
  - `logician` (⚖️ 논리역) → 섹션 `clause` "핵심 조항"
  - `analyst` (📊 분석역) → 섹션 `effect` "예상 효과"
  - `rebuttal` (🛡️ 반박역) → 섹션 `rebuttal` "우려 대응" (신규 섹션)
- 기존 `effect` 섹션("예상 효과·우려 대응" 합산) → `effect`(예상 효과) + `rebuttal`(우려 대응) 분리
- 각 역할마다 memoGuide 3항목·todos 3항목 역할에 맞게 전면 재작성

**`BranchUnitWorkspace.jsx` — SECTION_META 업데이트**
- `background` 라벨 "입법 배경·근거" → "입법 배경"
- `effect` 라벨 "예상 효과·우려 대응" → "예상 효과"
- `rebuttal` 신규 추가: label '우려 대응'
- 메모 카드 헤더 branch 분기(법안/정책/변론 작성자 메모 카드)

## v0.9.38 (2026-05-05) [Claude] — BranchUnitWorkspace 레이아웃 전면 재설계: 메모카드 + 역할 패널 통합

**레이아웃 구조 변경 (`BranchUnitWorkspace.jsx` 전면 재작성)**
- 기존 법안 발의 구역 → 2열 그리드(`lg:grid-cols-[3fr_2fr]`) 통합 워크스페이스로 교체
- 좌측(3fr): "📝 법안 작성자 메모 카드"
  - 모둠원 카드마다 역할 배지(이모지+이름) 표시
  - 역할 미배정 시 앰버 안내("→ 오른쪽 역할 배정에서 먼저 역할 선택")
  - 역할 배정 후: memoGuide 안내 박스(조사 항목 3개) + 접기/펼치기 할 일 목록
- 우측(2fr): 역할 패널 통합
  - `<details open={!myRoleKey}>` — 역할 미배정 시 자동 펼침, 배정 후 접힘
  - RoleAssigner / GroupRoleSummary / OtherGroupsRoleSummary 모두 이 영역으로 이동
- 2열 섹션 아래: 섹션 초안 + 대표 최종 확인 그대로 유지
- 전역 sessionId: `${branch}-default` 로 기존 역할 RTDB 데이터와 호환
- `DEFAULT_ROLES` 폴백 처리: `config?.roles?.[branch] || DEFAULT_ROLES[branch] || []`

## v0.9.37 (2026-05-05) [Claude] — Branch Unit: 중복 배치 방지 + 역할별 메모 조사 안내

**중복 배치 방지 (`BranchConfigEditor.jsx`)**
- `assignedGroupIds()` 에 `excludePos` 옵션 추가 — 특정 위치(kind+idx)를 제외한 집합 반환
- `availableGroupsFor(kind, idx)` 헬퍼 추가 — 각 유닛 드롭다운에 per-unit 선택 가능 목록 계산
- `UnitRow`에 `availableGroups` prop 추가 — 전역 `assigned` 클로저 대신 명시적 전달
- 이미 중복 배치된 상태(RTDB 데이터 불일치)는 `⚠️ (중복 배치됨)` 옵션으로 표시
- `BranchSection`, `JudicialSection`, evaluator 섹션 모두 동일 패턴 적용

**역할별 메모 조사 안내 (`scaffolding-data.js`, `BranchUnitWorkspace.jsx`)**
- `DEFAULT_ROLES` 12개 역할에 `memoGuide: string[]` 필드 추가 — 역할별로 메모 작성 전 조사·정리해야 할 내용 3항목씩
- `BranchUnitWorkspace`에서 `DEFAULT_ROLES` import + `config?.roles` 없을 때 폴백 처리
- 내 메모 편집 영역에 역할 배지(이모지+이름) + `memoGuide` 안내 박스 추가 (흰 배경 박스, ▸ 불릿)
- 텍스트에리어 placeholder도 "위 조사 내용을 바탕으로..." 로 변경

## v0.9.36 (2026-05-05) [Claude] — Branch Unit Workflow 시스템 전체 구현

**신규 파일 (7개)**
- `src/store/gameStore.js`: `branchConfig` 기본값 추가 (legislative/executive/judicial/evaluators 구조) + attachListener config merge 처리
- `src/components/teacher/BranchConfigEditor.jsx`: 교사 대시보드용 부서 단위 설정 편집기 (모둠별 부서 배치·담당자 지정·평가단 설정)
- `src/components/phase3/BranchUnitBanner.jsx`: 부서 탭 상단 배치 현황 배너 (내 유닛 하이라이트·대표 👑 표시)
- `src/components/phase3/BranchUnitWorkspace.jsx`: 3단계 워크플로 공간 (메모카드+URL링크 → 섹션 초안 → 대표 최종확정)
- `src/components/phase3/ExternalFeedBar.jsx`: 유닛 작업창 상단 외부 피드 바 (시민단체 요청·기사단 기사 실시간 표시)
- `src/components/phase3/EvaluatorPanel.jsx`: 평가단(시민단체·기사단) 글쓰기 패널 (대상 유닛 선택·요청/기사 전송·내역 조회)
- `docs/proposal_branch_unit_workflow.md`: 시스템 설계 제안서 (문제 진단·설계 목표·RTDB 스키마·UI 레이아웃·구현 단계)

**수정 파일 (7개)**
- `src/lib/scaffolding-data.js`: 모든 역할에 `assignedSection`·`isRepresentative`·`sectionLabel`·`sectionPlaceholder` 필드 추가 (입법/행정/사법 3종)
- `src/components/phase3/LegislativeTab.jsx`: BranchUnitBanner·BranchUnitWorkspace 통합, bills publish 콜백 연동
- `src/components/phase3/ExecutiveTab.jsx`: BranchUnitBanner·BranchUnitWorkspace 통합, policies publish 콜백 연동
- `src/components/phase3/JudicialTab.jsx`: BranchUnitBanner·BranchUnitWorkspace 통합, verdicts publish 콜백 연동
- `src/pages/Phase3Page.jsx`: EvaluatorPanel import + `!lockToArticle` 블록에 렌더링 추가
- `src/pages/TeacherDashboard.jsx`: BranchConfigEditor import + 설정 모달에 통합
- `docs/project_context.md`: 섹션 9 규칙 2에 [도구 라벨] 표기 요건 추가

**신규 RTDB 경로 (2개)**
- `rooms/{roomCode}/branchDrafts/{unitId}/` — 유닛별 작업 중 문서 (memberNotes·sections·finalDoc)
- `rooms/{roomCode}/externalFeed/{feedId}` — 평가단 피드 (시민단체 요청·기사단 기사)

**설계 원칙**: `branchConfig.legislative.units = []` (빈 배열) 이면 기존 단일문서 방식 그대로 동작 (하위 호환 유지)

## v0.9.35 (2026-05-05) [Claude] — history.md 도구 라벨 소급 정리 + codex_history 통합
- `history.md`: v0.9.1~v0.9.20 (20개 항목)에 `[Codex]` 라벨 소급 추가. codex_history.md 기록(2026-05-04 세션)을 근거로 해당 날짜 작업이 모두 Codex 세션임을 확인.
- `history.md`: `v0.9.1-pre [Codex]` 항목 신규 추가 — codex_history.md에만 있던 내용(코드 현황 재점검, 설계 확정, 스냅샷 생성) 발췌 통합.
- `CLAUDE.md`: 섹션 5.4 신규 추가 — history.md 코딩 도구 라벨 규칙 (표기 형식, 도구별 라벨, 레거시 소급 면제 기준).
- `dev_guidelines.md`: 섹션 10에 도구 라벨 규칙 테이블 추가.
- `codex_history.md`: 통합 완료 상태로 축약 — 내용 전체가 history.md에 반영됨. 백업 스냅샷 복원 명령만 보존.

## v0.9.34 (2026-05-05) [Claude] — 기존 문서 일관성 정비
- `CLAUDE.md`: antigravity_log.md 참조 제거(파일 없음), docs 폴더 구성표에 dev_guidelines.md·codex_history.md 추가, 섹션 6을 "완료된 초기 셋업 기록"으로 전환, TypeScript 오류 수정(→JavaScript), 베네핏 카드 분배 설명에 유연성 메모 추가.
- `implementation_plan.md`: 상단에 "초안 PRD, 실제 구현과 차이 있음" 경고 추가. 컴포넌트 트리를 현실 기준으로 교체(삭제된 파일 제거, petition/debate/scaffolding 추가). 베네핏 카드 분배 설명 유연화. 작업 일정을 완료 상태로 갱신.
- `task.md`: 헤더 버전 v0.9.28 → v0.9.33, 업로드 항목 완료 체크.
- `project_context.md`: 베네핏 카드 분배 수치 표현 유연화 (기본값 + config 조정 가능 명시).

## v0.9.33 (2026-05-05) [Claude] — 개발 가이드라인 문서 신규 작성
- `docs/dev_guidelines.md` 신규 생성: 코드 최적화·모듈화 작업에서 검증된 패턴 10개 항목으로 정리.
  - Zustand 셀렉터 안티패턴, RTDB 구독 표준 템플릿, SSOT 원칙, React 훅 작성 규칙
  - ROUNDS/RoundTabShell 확장 방법, Props 하위 호환 규칙, Dead code 관리 절차
  - Tailwind colorMap 패턴, 배포 워크플로, 문서 업데이트 규칙
- `docs/project_context.md`: 버전 v0.9.32로 갱신, dev_guidelines.md 참조 추가, 최근 완료 작업 목록 갱신.

## v0.9.32 (2026-05-05) [Claude] — 모듈화 3단계: SubmissionForm 컴포넌트 dataPath prop 일반화
- `BillTemplate.jsx`: `dataPath = 'bills'` 기본값 prop 추가. subscribe/updateAt/pushUnder 3곳의 하드코딩된 `'bills'` → `dataPath` 동적화. `[roomCode, dataPath]` 의존성 배열 수정.
- `MinisterPolicyDraft.jsx`: `dataPath = 'policies'` 기본값 prop 추가. `policies/${groupId}` 6곳(subscribe·updateAt·setAt·approvals 2곳·submit·cancelSubmission) 전부 `${dataPath}/${groupId}` 치환. `[roomCode, groupId, dataPath]` 의존성 수정.
- `VerdictTemplate.jsx`: `dataPath = 'verdicts'` 기본값 prop 추가. `verdicts/${caseId}` → `${dataPath}/${caseId}` 치환.
- 세 컴포넌트 모두 기본값이 기존 경로와 동일 → 기존 코드 완전 하위 호환. 새 라운드에서 `dataPath` 만 달리 주입하면 다른 RTDB 경로로 데이터 저장 가능.
- 빌드 및 배포 완료.

## v0.9.31 (2026-05-05) [Claude] — 모듈화 2단계: RoundTabShell + ROUNDS 설정 확장
- `RoundTabShell.jsx` 신규 생성: 8단계 제네릭 라운드 쉘. ①②역할·미션 / ③결과제출(SubmissionForm 주입) / ④온라인토의 / ⑤⑥오프토론 / ⑦결과발표(ResultDisplay 주입) 처리.
- ROUNDS 설정에 `useCustomTab`, `color`, `sessionId`, `submissionLabel`, `offlineLabel`, `dataPath`, `SubmissionForm`, `ResultDisplay`, `teacherNote` 필드 추가.
- Phase3Page: `useCustomTab: true` → 기존 커스텀탭, `false` → RoundTabShell 자동 선택.
- 새 라운드 추가 시: ROUNDS에 항목 1개 + SubmissionForm 컴포넌트 1개로 완성. 기존 3탭은 완전히 영향 없음.
- 빌드 및 배포 완료.

## v0.9.30 (2026-05-05) [Claude] — 모듈화 1단계: Phase3Page ROUNDS 배열 동적화
(v0.9.29로 기록됨)

## v0.9.29 (2026-05-05) [Claude] — 모듈화 1단계: Phase3Page ROUNDS 배열 동적화
- `TABS`/`ROUND_HEADLINE`/`ROUND_PROMPT` + 하드코딩 탭 렌더링 → `ROUNDS` 설정 배열 하나로 통합.
- 각 라운드는 `id`, `label`, `sessions`, `headline`, `articleStepId`, `prompt`, `TabComponent`, `ProgressGuide` 보유.
- 탭 버튼, 워크플로 자동 전환, 기사단계 탭 강제, 코어이슈 배너, ProgressGuide 렌더링 모두 ROUNDS 배열에서 동적 파생.
- 새 라운드 추가 시 ROUNDS 배열에 항목 1개 추가만으로 탭·전환·headline·prompt·ProgressGuide 자동 처리.
- 빌드 및 배포 완료.

## v0.9.28 (2026-05-05) [Claude] — Phase F: BudgetPanel.jsx 삭제 및 executiveBudget 경로 정리 확인
- `BudgetPanel.jsx` 삭제: import 없는 완전 dead file (151줄). Phase A에서 ExecutiveTab import 제거 후 파일만 남아 있던 것.
- `executiveBudget` RTDB 경로 조사: `BudgetReportTemplate.jsx`가 `RoleWorkspace`(예산 분석가 역할)를 통해 실제 사용 중 → 제거 불가, 현행 유지.
- `policies/{groupId}`(MinisterPolicyDraft)와 `executiveBudget`(예산분석가 개별 작업)은 별도 역할·목적으로 공존 중 — 의도적 설계 확인.
- 빌드 및 배포 완료.

## v0.9.27 (2026-05-05) [Claude] — Phase C: RTDB 구독 Phase3Page에서 ProgressGuide로 이전
- `LegislativeProgressGuide`: bills 자체 구독 추가, `bills`/`isVotingActive` props 제거 (내부에서 직접 파생).
- `ExecutiveProgressGuide`: policies 자체 구독 추가, `policies` prop 제거.
- `Phase3Page`: bills/policies 구독 블록 제거, subscribe/useMemo import 정리. 컴포넌트 호출부 props 간소화.
- 빌드 및 배포 완료.

## v0.9.26 (2026-05-05) [Claude] — Phase B: STEP_ID_TO_STAGE SSOT 통합
- `PHASE_STEPS` (PhaseWorkflow.jsx)의 Phase 3 입법·행정 steps에 `stage` 숫자 필드 추가.
- 4곳의 로컬 `STEP_ID_TO_STAGE` 매핑 테이블 완전 제거: `LegislativeProgressGuide`, `ExecutiveProgressGuide`, `Phase3LegislativeQuickPanel`, `Phase3ExecutiveQuickPanel`.
- 이제 step ID↔stage 매핑은 PHASE_STEPS 단일 소스가 관리. 새 step 추가 시 이 파일 하나만 수정하면 됨.
- 빌드 및 배포 완료 (에러 없음).

## v0.9.25 (2026-05-05) [Claude] — Phase A 코드 최적화: dead code 제거 + roomCode 셀렉터 수정
- **BillEditor.jsx 삭제**: `src/components/phase3/BillEditor.jsx` (102줄) — BillTemplate과 기능 중복, import 없는 완전 dead code.
- **BudgetPanel import 제거**: ExecutiveTab.jsx line 1의 `import BudgetPanel` 삭제. MinisterPolicyDraft가 해당 역할 수행 중. 파일 자체는 보존(향후 참고용).
- **roomCode getState() 안티패턴 수정 ×2**: `useGameStore.getState().roomCode` → 올바른 셀렉터 `useGameStore((s) => s.roomCode)` + 의존성 배열 `[roomCode]` 수정. 해당 파일: ExecutiveTab.jsx, Phase3Page.jsx.
- **빌드 및 배포 완료** (에러 없음).


## v0.9.24 (2026-05-05) [Antigravity] — 페이즈 3 워크플로 개편 및 UI/UX 스크롤 동기화 최적화
- **글로벌 워크플로 간소화**: `PhaseWorkflow.jsx`에서 길게 나열되던 입법/행정부의 세부 단계를 하나의 대표 그룹 항목('입법 라운드 진행', '행정 라운드 진행')으로 시각적으로 압축.
- **글로벌 제어 버튼 유지**: 상태바 로컬 제어와 함께, 글로벌 단계 진행 메뉴에서도 [이전], [다음] 버튼을 상시 활성화하여 교사가 자유롭게 워크플로를 통제할 수 있도록 지원.
- **교사 대시보드 빠른 제어창 개편**: `TeacherDashboard`에 표시되는 `Phase3LegislativeQuickPanel`에 `[← 이전 단계]`, `[다음 단계 →]` 버튼 추가.
- **행정부 빠른 제어창 신규 제작**: `Phase3ExecutiveQuickPanel` 컴포넌트를 신규 제작하여 행정부 라운드 시 대시보드 하단에 표시되도록 연동하고, 이전/다음 제어 버튼 추가.
- **학생 화면 레이아웃 동기화 (Phase 2)**: 페이즈 2 선거 본부에서 워크플로 순서(등록→운동→사전조사→투표→결과)와 화면상 배치 순서가 달라 스크롤이 들쑥날쑥하던 현상을 해결하기 위해, 화면상 컴포넌트 배치 순서(`PollFeed` 위치 이동)를 워크플로 순서와 일치시킴.
- **자동 스크롤 탑재 (Phase 3)**: 페이즈 3에서 입법/행정/사법 라운드가 시작되며 탭이 자동 전환될 때, 학생 화면이 항상 새 라운드의 최상단(상태바 위치)으로 부드럽게 자동 스크롤(`scrollIntoView`) 되도록 UX 개선.
- **행정부 기사 작성 텍스트 통일**: 워크플로 텍스트에서 불필요한 들여쓰기 및 번호를 제거(`기사 작성 — 행정 결과를 기사로`)하여 입법부와 통일.

## v0.9.23 (2026-05-05) [Antigravity] — 입법/행정 진행 단계 상태바 최상단 이동 및 고정 해제
- **상태바 위치 상향 및 통합**: `LegislativeProgressGuide`와 `ExecutiveProgressGuide`를 각각의 탭 내부가 아닌 `Phase3Page` 탭 컨텐츠 상단(`tab` 변수 위)으로 끌어올려 레이어 겹침(`z-index`) 이슈를 방지.
- **고정 해제**: 스크롤 시 화면 상단에 달라붙는 `sticky` 속성을 제거하여 페이지 내용과 함께 자연스럽게 스크롤되도록 변경.
- **행정부 상태바 추가**: 입법부와 동일한 레이아웃의 행정부 진행 가이드 신규 제작 및 부처별 제출 상태 연동.
- **데이터 구조 최적화**: 입법/행정 관련 데이터(bills, policies) 구독을 `Phase3Page`로 통합.
- **버그 수정**: `Phase3Page.jsx`에서 `useMemo` 임포트 누락 에러 수정.
- **배포 완료**: `deploy.sh`를 통해 라이브 반영.

## v0.9.22 (2026-05-05) [Codex] — 안티그래비티 로그 규칙 정리 및 파일 제거
- `docs/history.md`와 `docs/antigravity_log.md`를 대조해 안티그래비티 로그 항목(`v0.8.60`~`v0.9.21`)이 히스토리에 모두 반영되어 있음을 확인.
- `AGENTS.md`에서 작업 종료 시 `antigravity_log.md` 기록 필수 규칙 제거.
- `docs/antigravity_log.md` 파일 삭제.
- 이후 단일 채널(코딩도구 라벨 포함) 중심으로 관리.

## v0.9.21 (2026-05-05) [Codex] — 문서 규칙 업데이트(코딩도구 라벨 표기 의무화)
- `AGENTS.md`의 docs 운영 규칙을 수정해 `history.md` 기록 시 사용한 코딩도구 라벨 표기를 필수화.
- 적용 규칙:
  - 작업 종료 시 `history.md` 기록 항목에 코딩도구 라벨 포함.
  - 라벨 예시: `[Codex]`, `[Claude Code]`, `[Antigravity]`, 복수 도구는 `[Codex+Claude Code]`.

## v0.9.20 (2026-05-05) [Codex] — 기본 여론조사 ‘자동 세팅’ 고정 + 빈 1차/선거사전 정리
- `기본 여론조사 채우기` 버튼 및 관련 수동 보충 기능 제거 (`PollManager` UI 단순화).
- `src/store/gameStore.js`:
  - 방 구독 시 기본 여론조사 5종(`phase1_poll1`, `phase2_prepoll`, `phase3_poll2/3/4`) 누락 자동 보강.
  - 1차/선거사전이 제목만 있고 질문이 비어 있으면 기본 문구·옵션으로 자동 복구.
- `src/components/teacher/PollManager.jsx`:
  - 비정상 빈 항목(1차/선거사전, 질문 없음, 비기본 키) 자동 삭제 정리 로직 추가.
- 결과: 교사가 들어가기 전에도 학생 페이지 기준 기본 여론조사가 자동 준비되며, 빈 제목만 있는 1차/선거사전 찌꺼기 항목 정리됨.

## v0.9.19 (2026-05-05) [Codex] — 여론조사 삭제 무한루프 롤백
- 삭제 버튼 동작 시 여론조사가 다시 생성/보정되며 반복되던 무한루프를 중단.
- `src/components/teacher/PhaseWorkflow.jsx`:
  - 여론조사 자동 생성/자동 중복정리/자동 실시 전환 `useEffect` 제거.
  - 워크플로는 다시 순수 단계 전환 기능만 수행.
- `src/components/teacher/PollManager.jsx`:
  - 여론조사 자동 보정(backfill)·중복삭제·강제 재생성 로직 제거.
  - 삭제 버튼은 예전처럼 `removeAt`만 수행하는 단순 동작으로 복원.
- 결과: 삭제 버튼이 다시 정상적으로 “삭제만” 수행하며, 즉시 재생성되는 현상이 사라짐.

## v0.9.18 (2026-05-05) [Codex] — 기본 여론조사 삭제 제한 해제
- 사용자 요청에 따라 PollManager에서 기본 여론조사도 일반 여론조사와 동일하게 `삭제` 가능하도록 롤백.
- `src/components/teacher/PollManager.jsx`:
  - 시스템 여론조사(`isSystem`) 삭제 차단 UI 제거.
  - 모든 여론조사 카드에 동일한 `삭제` 버튼 노출.
  - 임시로 추가했던 `기본 여론조사 삭제` 일괄 버튼 제거.

## v0.9.17 (2026-05-05) [Codex] — 기본 여론조사 5종 체계 복원 + 수동 삭제 버튼 추가
- 기본 여론조사를 `1차 / 선거사전 / 2차 / 3차 / 4차` 5종으로 재정렬.
- `src/components/teacher/PhaseWorkflow.jsx`:
  - `POLL_SLOTS`, `DEFAULT_SYSTEM_POLLS`, 중복 정리 키(`inferSystemKey`)에 `선거사전(prepoll)`을 별도 시스템 키로 복원.
- `src/store/gameStore.js`:
  - 신규 방 기본 여론조사에 `phase2_prepoll` 추가(총 5개).
- `src/components/teacher/PollManager.jsx`:
  - `prepoll` 시스템 키 매핑 및 누락 자동 생성 추가.
  - 교사 요청 대응용 `기본 여론조사 삭제` 버튼 추가(기본 5종 일괄 삭제).
- 결과: 선거사전과 1차가 분리되어 각각 1개씩 유지되며, 필요 시 교사가 기본 여론조사 자체를 직접 삭제 가능.

## v0.9.16 (2026-05-05) [Codex] — 교사 대시보드 진입 시 여론조사 중복 강제 정리
- PollManager를 열지 않아도, 교사 대시보드의 `PhaseWorkflow`가 로드되면 시스템 여론조사 중복(1차/선거사전/2차/3차/4차)을 자동 정리하도록 강화.
- `src/components/teacher/PhaseWorkflow.jsx`:
  - `removeAt` 기반 중복 삭제 루프 추가.
  - 차수 판정은 `systemKey`, `phaseStep`, `tag(사전/선거사전 포함)`을 모두 사용.
  - 각 차수는 1개만 남기고, 남긴 항목은 정규 `phaseStep`/`tag`/`systemKey`로 보정.
- 결과: 교사 화면 진입만 해도 중복 기본 여론조사가 차수별 1개로 수렴.

## v0.9.15 (2026-05-05) [Codex] — 2·3·4차 중복 여론조사 강제 단일화
- 일부 방에서 기본 여론조사(2/3/4차)가 2개씩 남아 있던 문제를 보정.
- `src/components/teacher/PollManager.jsx`의 백필 로직을 강화:
  - `phaseStep`뿐 아니라 `systemKey`, `tag(1차/사전/2차/3차/4차)`까지 포함해 시스템 차수를 식별.
  - 차수별 후보를 그룹화해 1개만 남기고 나머지는 자동 삭제.
  - 남는 항목은 정규 위치(`phaseStep`)·태그·`isSystem/systemKey`를 강제 정렬.
- 결과: `1차, 선거사전, 2차, 3차, 4차`는 차수별 1개만 유지되도록 정리됨.

## v0.9.14 (2026-05-05) [Codex] — 기본 여론조사 중복 자동 정리
- 기본 여론조사 보정 과정에서 동일 단계(1차/2차/3차/4차)가 2개씩 생기던 문제를 해결.
- `src/components/teacher/PollManager.jsx`:
  - `backfillSystemFlags`에서 단계별 매칭 결과가 2개 이상이면 자동으로 1개만 유지.
  - 유지 기준: `isSystem=true` 우선 → `createdAt` 최신 → `id`.
  - 남긴 1개는 시스템 플래그(`isSystem/systemKey`)를 보장하고, 나머지는 자동 삭제.
- 결과: 각 기본 차수는 항상 1개만 유지됨.

## v0.9.13 (2026-05-05) [Codex] — 기본 여론조사 기본값을 ‘실시 중’으로 전환 + 1차 강제 복구
- 기본 여론조사(1~4차)의 초기 상태를 `idle`에서 `voting`으로 변경하여, 교사가 `실시`를 누르지 않아도 학생 페이지에 바로 노출되도록 조정.
- `src/store/gameStore.js` 및 `src/components/teacher/PhaseWorkflow.jsx`의 시스템 기본 여론조사 상태를 `voting`으로 통일.
- `src/components/teacher/PhaseWorkflow.jsx`:
  - 시스템 여론조사 자동 보충 로직의 1회 제한을 제거해 누락 항목이 있으면 반복적으로 보강.
- `src/components/teacher/PollManager.jsx`:
  - 기본 여론조사 채우기로 생성되는 항목도 `voting` 상태로 생성.
  - 기존 방에서 1차 여론조사가 없으면 `phase1_poll1`을 강제로 자동 생성.
  - 레거시 1차(`phase2/prepoll`)를 `phase1/poll1`로 옮길 때 상태도 유지/보정.

## v0.9.12 (2026-05-05) [Codex] — 1·3·4차 여론조사 누락 보정
- 기본 여론조사 기준을 `1차(poll1) / 2차(poll2) / 3차(poll3) / 4차(poll4)`로 정렬하고, 1차를 Phase 1 `poll1` 단계에 연결.
- `src/components/teacher/PhaseWorkflow.jsx`:
  - 기본 슬롯에서 1차를 `phase:1, stepId:'poll1'`으로 수정.
  - 교사가 단계 이동 시 해당 단계의 기본 여론조사가 `idle`이면 자동으로 `voting` 시작되도록 보강.
- `src/store/gameStore.js`:
  - 신규 방 기본 여론조사의 1차 배치를 Phase 1 `poll1`로 수정.
- `src/components/teacher/PollManager.jsx`:
  - 시스템 키 매핑에서 `poll1`을 Phase 1 `poll1` 기준으로 변경.
  - 기존 방의 레거시 `phase2/prepoll` 1차 여론조사는 자동으로 `phase1/poll1`로 마이그레이션.
- 결과: 교사 워크플로에서 1·2·3·4차 단계 진입 시 학생 페이지에 해당 차수 여론조사가 일관되게 표시됨.

## v0.9.11 (2026-05-05) [Codex] — 학생 페이지 여론조사 단계 연동 강화
- 학생 `PollFeed`를 현재 페이즈뿐 아니라 **현재 워크플로 단계(stepId)**까지 일치할 때만 노출하도록 보강.
- `src/components/shared/PollFeed.jsx`:
  - `plannedOnly`일 때 `phaseStep.phase === currentPhase` + `phaseStep.stepId === wf.currentStep.id` 조건을 함께 적용.
  - 교사가 워크플로를 `poll1/2/3/4` 단계로 이동하면 해당 차수 여론조사만 학생 페이지에 자동 제시.
- `src/components/teacher/PhaseWorkflow.jsx`:
  - 교사 대시보드 진입 시 기본 시스템 여론조사(사전/2차/3차/4차)가 누락된 방은 자동 보충.
  - 기존 버튼 기반 운영은 그대로 유지하면서, “단계에 맞는 학생 노출”이 자동 동작하도록 정합성 강화.

## v0.9.10 (2026-05-05) [Codex] — 기본 여론조사(1~4차) 삭제 보호
- 기본 여론조사 1~4차를 PollManager에 남기되 삭제되지 않도록 보호 처리.
- `src/store/gameStore.js`:
  - 신규 방 기본 여론조사 데이터에 `isSystem: true`, `systemKey` 추가.
- `src/components/teacher/PollManager.jsx`:
  - 기본 여론조사 자동 생성 시 `isSystem/systemKey` 저장.
  - 기존 방의 기본 슬롯(사전/2차/3차/4차) 항목에 시스템 플래그 자동 보정(backfill) 추가.
  - 시스템 항목은 `삭제` 버튼 대신 `기본 여론조사(삭제 불가)` 표시, `수정`은 그대로 허용.

## v0.9.9 (2026-05-05) [Codex] — 기본 여론조사 자동 탑재 + 교사 수정 기능
- 교사가 매번 수동 생성하지 않아도 되도록 **기본 여론조사(사전/2차/3차/4차)**를 순서에 맞게 자동 준비.
- `src/store/gameStore.js`:
  - 신규 방 생성 시 `polls`에 기본 여론조사 4종을 `idle` 상태로 초기 탑재.
- `src/components/teacher/PollManager.jsx`:
  - `기본 여론조사 채우기` 버튼 추가(기존 방의 누락 슬롯만 자동 생성).
  - 각 여론조사 카드에 `수정` 기능 추가(태그/질문/옵션/노출 단계(phaseStep) 편집 가능).
  - 옵션 변경 시 기존 투표가 있으면 초기화 경고 후 저장.
- 결과: 워크플로 단계(1차/2차/3차/4차)에 맞는 기본 여론조사가 항상 준비되고, 교사는 필요 시 바로 문구를 수정 가능.

## v0.9.8 (2026-05-05) [Codex] — 기사작성 단독 집중 모드 통일
- `src/pages/Phase3Page.jsx`에서 `article2` 예외를 제거.
- 이제 Phase 3 기사작성(`article1/2/3`)은 모두 동일하게 단독 집중 모드로 동작하며, 다른 섹션은 숨겨지고 기사작성만 활성화됨.
- “보이지만 작동하지 않는” 혼합 상태를 제거하여 단계 UX를 일관화.

## v0.9.7 (2026-05-05) [Codex] — 행정부 기사작성 위치 고정
- `src/pages/Phase3Page.jsx`에서 기사작성 잠금 로직을 조정.
- `article2`(행정부 기사작성) 단계는 화면 상단 단독 모드로 빼지 않고, 기존 행정부 흐름 위치에서 이어서 보이도록 변경.
- 결과적으로 행정부 기사작성은 다른 행정 단계와 같은 문맥(같은 자리)에서 진행되고, 위로 튀어 올라가는 동작이 사라짐.

## v0.9.6 (2026-05-04) [Codex] — 행정부 초반 절차(역할·미션) 단계 복구
- 행정부 초반에 빠져 있던 `역할 배정·개인 미션 시작` 단계를 교사 진행 순서(Phase 3 워크플로)에 추가.
- `src/components/teacher/PhaseWorkflow.jsx`:
  - `executive-roles` 단계 신규 추가.
  - 행정부 순서를 `① 역할 배정·미션 → ② 예산편성·시행령 작성 → ③ 온라인 토의 → ④ 국무회의 → ⑤ 기사 작성`으로 정렬.
- `src/components/phase3/ExecutiveTab.jsx`:
  - `executive-roles` 인식 및 단계 강조 매핑 추가.
  - 학생 화면 상단에 “정책 보고서 템플릿 위치(② 카드)” 안내 섹션 추가.
  - 역할 작업 공간을 ① 단계 강조 구간으로 묶어 학생 화면에서 순서대로 보이도록 보강.
  - 행정부 내부 단계 번호(②/③/④)를 교사 워크플로와 일치하도록 조정.

## v0.9.5 (2026-05-04) [Codex] — 학생 견인 누락 방지(자동 이동 예외 축소)
- 일부 학생이 교사 견인을 놓치던 원인 후보로 확인된 `StudentAutoNavigator`의 학생 예외 경로를 조정.
- `src/components/shared/StudentAutoNavigator.jsx`:
  - 학생 예외 경로에서 `/news`, `/gallery` 제거.
  - 학생은 기본적으로 항상 현재 페이즈 경로(`/phase1~4`)를 따르도록 강화.
  - 경로 비교 안정화를 위해 trailing slash 정규화(`normalizePath`) 추가.
- 결과적으로 같은 반 코드로 접속 중인 학생은 교사 페이즈 견인에서 이탈할 가능성이 크게 줄어듦.

## v0.9.4 (2026-05-04) [Codex] — 행정부 단계 표시를 Phase1형 강조 방식으로 복원
- `src/components/phase3/ExecutiveTab.jsx`에서 행정부 ①~③ 섹션을 조건부 숨김 방식이 아니라 **항상 나열** 방식으로 변경.
- 현재 단계만 강조되고, 나머지 단계는 `HighlightBox`로 흐리게 표시되도록 적용(Phase 1과 동일한 학습 흐름).
- `executive-draft/executive-budget`는 ① 강조, `executive-discuss`는 ② 강조, `executive-meeting`은 ③ 강조로 매핑.
- 행정부 안내 문구의 구식 내용(전원 동의 시 자동 제출)을 장관 수동 제출 기준으로 정리.

## v0.9.3 (2026-05-04) [Codex] — Phase 3 기사작성 단계 잠금 강화
- `src/pages/Phase3Page.jsx`에서 학생이 기사작성 단계(`highlight='article'`)일 때 기사작성 영역만 보이도록 잠금 처리.
- 기사작성 단계에서는 아래 항목을 숨겨 접근 차단:
  - 라운드 탭(입법/행정/사법) 전환 버튼
  - 역할 카드/역할 배정 패널
  - 각 라운드 본문 탭 콘텐츠(입법/행정/사법)
  - 브리핑 패널/자동 브리핑/활동 요약/여론조사 영역
- `article1/2/3` 진입 시 해당 라운드 탭으로 자동 정렬되도록 보강(행정 기사작성 시 행정부 맥락 유지).

## v0.9.2 (2026-05-04) [Codex] — 행정부 흐름 단순화(결정사항 공표 단계 제거)
- Phase 3 행정부 차시 흐름에서 `결정사항 공표(executive-publish)` 단계를 제거하고, 토의 정리 후 바로 기사 작성 단계로 연결.
- `src/components/teacher/PhaseWorkflow.jsx`:
  - 행정부 흐름 설명을 4단계→3단계로 정리.
  - `executive-publish` 스텝 제거, 기사작성 스텝 번호를 `행정 ④`로 조정.
- `src/components/phase3/ExecutiveTab.jsx`:
  - `KNOWN_EXEC_STEPS`에서 `executive-publish` 제거.
  - `showPublish` 분기와 `④ 결정사항 공표` 렌더 블록 제거.
  - 결과 공유는 기사 작성 차시에서 수행하도록 안내 문맥 정리.

## v0.9.1-pre (2026-05-04) [Codex] — 코드 현황 재점검 + 복원용 스냅샷 생성
- Codex 세션 시작 시 문서보다 코드가 앞선 상태 확인 (ExecutiveTab, MinisterPolicyDraft, PolicyDiscussionList, Phase3Page, PhaseWorkflow 검토).
- `policies/{groupId}` 기반 작성/동의/제출 구조 이미 구현됨 확인. `executiveBudget` 경로와 데이터 소스 혼재 구간 파악.
- 행정부 제출 플로우 설계 확정: 전원 동의 자동 제출 제거 / 장관 수동 제출 고정 / 최소 동의 기준 없음.
- **복원용 스냅샷**: `<배포경로>/backups/codex_2026-05-04_210338/app/` (v0.9.0 시점 상태)

## v0.9.1 (2026-05-04) [Codex] — 행정부 제출 플로우 개편 (장관 수동 제출)
- `src/components/phase3/MinisterPolicyDraft.jsx` 기준으로 행정부 정책안 제출 규칙을 정리.
- **자동 제출 제거**: 모둠원 전원 동의 시 자동 `submitted` 전환 로직 삭제.
- **장관 수동 제출 고정**: 장관이 `🚀 최종 제출` 버튼으로만 온라인 토의 안건 제출.
- **동의는 참고 정보**: 역할 배정/동의 여부는 표시만 하며 제출의 필수 조건에서 제외.
- **역할 기반 동의 표시 강화**: 동의 데이터에 `roleKey`, `roleLabel` 저장; 역할별 동의 현황(누가 어떤 역할이고 동의했는지) 확인 가능.
- **문구 정리**: `전원 동의/자동 제출` 의미의 안내 문구 제거, `장관 참고용` 안내로 통일.
- **제출 후 수정 규칙 유지**: 제출 상태에서 장관이 수정 저장하면 자동으로 `drafting`으로 내려가고, 재제출 시 다시 `submitted`로 전환.
- **행정부 상태표시 정합성 보정**:
  - `ExecutiveTab`/`PolicyDiscussionList`의 구 문구(전원 동의 필요) 제거, 장관 최종 제출 기준으로 통일.
  - `OtherGroupsRoleSummary`의 행정부 산출물 매핑을 `policies/{groupId}` 실데이터(`groupName`, `decree`, `budget`, `submittedAt|updatedAt`) 기준으로 보정해, 장관 작성·제출 후에도 ‘미작성’으로 보이던 표시 문제 수정.
- **행정부 자동 제출 우회 경로 차단**:
  - `BudgetReportTemplate.jsx`에서 `policies`로 `status:'submitted'`를 직접 쓰던 구경로 제거.
  - 이제 `submitted` 전환은 `MinisterPolicyDraft.jsx`의 장관 `최종 제출` 버튼에서만 발생.
  - `BudgetReportTemplate`는 예산 분석가의 내부 정리용으로 `executiveBudget`만 갱신하도록 변경.
- **장관 제출 마커 도입(재발 방지)**:
  - `MinisterPolicyDraft.jsx`: 장관 최종 제출 시 `submittedBy: 'minister'`, `submittedByStudentId` 기록.
  - 수정 저장으로 `drafting` 복귀 시 위 마커 초기화.
  - `PolicyDiscussionList.jsx`: `status='submitted'` 이면서 `submittedBy='minister'` 인 안건만 토의 목록에 노출.
- **행정부 양식(비계) 고도화**:
  - `MinisterPolicyDraft.jsx`의 **시행령 입력을 5개 비계 항목**으로 분리:
    - 담당자 / 시간 및 장소 / 세부 규칙 3개 / 상벌 / 예외
  - 비계 답변을 자동으로 합쳐 최종 시행령 본문(`decree`)을 생성하고 미리보기 제공.
  - `decreeScaffold` 구조를 정책 데이터에 함께 저장해 이후 수정 시 항목 단위 복원 가능.
  - 예산 편성에 **항목별 필요 사유(`budgetReasons`) 필수 입력** 추가 (인건비/사업비/교육비/홍보비 각각).
  - 저장/제출 버튼 조건에 비계·예산사유 필수 검증을 반영.
  - 장관 동의 확인 패널은 역할 4개를 한 줄(대형 화면 기준 4열)로 배치.

## v0.9.0 (2026-05-01) — PetitionSystem + DebateTool 두 시스템 정식 통합 (마이너 릴리스)
- **PetitionSystem 신규**: 국민청원 시스템 (Phase 1 시민광장 '청원 쓰기' 탭)
  - `src/components/petition/` 5개 컴포넌트(Board / Form / Card / Filter / Admin)
  - `src/store/petitionStore.js` — UI 필터/정렬 상태 + 헬퍼 (applyPetitionFilters / topPetitions / hashTagFrequency)
  - 미디어 URL+요약 필수, 말머리(교사 편집) + 해시태그(학생) 이중 분류, 공감 TOP 3 상단 표시
  - RTDB: `rooms/{rc}/petitions/{petitionId}` + `config.petitionConfig` (말머리·자동승인·태그한도)
  - PHASE_STEPS[1] 에 `petition` 1차시 단계 신규 추가 — 시민단체 결성 전 사전 단계
- **DebateTool 신규**: 토론 도구 (페이즈 무관, 학생 우하단 플로팅 + 자동 모달)
  - `src/components/debate/` — DebateToolPanel(학생) / TeacherDebateControl(교사) / tools/{StancePoll, DebatePrepCard, DebateTimer, SpeechEval}
  - `src/store/debateStore.js` — 단일 활성 세션 구독, prepCards / stancePolls / speechEvals / evaluators / isChair / isEvaluator
  - 토론 전: 입장 여론조사(변경 불허) + 토론 준비 카드(주장·근거·반론, 1인 1카드, 일괄 공개 토글)
  - 토론 중: 국어 6-1-3단원 7단계 타이머, 의장 미니 제어, TV 송출용 전체화면, 단계 편집/점프
  - 토론 후: 발언 즉시 평가(평가단 3축 별점+80자 코멘트, 자체 SVG 레이더), 토론 후 여론조사, 전후 비교 그래프
  - RTDB: `rooms/{rc}/debateSessions/{sid}` + `/prepCards` / `/stancePoll/{pre|post}` / `/speechEvals/{evalId}` / `/evaluators`
  - 단일 활성 세션 모델 — 새 세션 시작 시 기존 자동 종료
- **학급 설정 통합**: `config.petitionEnabled` / `config.debateToolEnabled` 토글 추가 (`ClassroomConfigEditor` 신규 섹션)
- **버그 수정**: `TeacherDebateControl.jsx` / `PetitionAdmin.jsx` 의 hooks 순서 위반(조기 반환 후 useMemo) 수정 — 모든 훅을 조기 반환 위로 끌어올림
- **버전**: `package.json` 0.0.0 → 0.9.0, `CHANGELOG.md` 신규 생성
- **Firebase rules**: `petitions`, `debateSessions/{prepCards, stancePoll, speechEvals, debateTimer}` validate 규칙 추가 — Console에 수동 적용 필요

## v0.8.66 (2026-04-29) — 학생 접속 세션 및 안정성(백화현상) 개선
- **학생 세션 및 오프라인 상태 관리**: 
  - 학생 화면 새로고침 시 서버에 '온라인' 상태를 즉각 갱신하도록 처리하여, 교사 모니터에서 오프라인으로 표시되는 문제 해결.
  - 교사에 의해 강제 삭제된 학생이 빈 데이터를 참조하여 렌더링 에러(백화현상)를 일으키는 현상을 방어하고 로비로 정상 안내되도록 보강.
- **학생 접속(이름 검증) 강화**:
  - 동일 번호로 접속 시 기존 등록된 이름과 다를 경우 덮어쓰기를 방지하고 입장 차단. 
  - 이름 오입력으로 2회 이상 접속 실패 시 "선생님께 여쭤보세요!" 안내 메시지 노출.
  - 학생 최초 접속 시 "이름과 번호를 꼭 기억해달라"는 브라우저 경고창 표시.

## v0.8.64 (2026-04-29) — 포스터 수정 기능 도입 및 시민활동 세부 설정 고도화
- **포스터 수정 UX 개선**: 포스터 업로드 후 업로드 창 자동 숨김 처리. 미리보기 창 내 **[수정하기]** 버튼을 통해 기존 포스터를 언제든 교체 가능하도록 개선.
- **교사용 시민활동 설정 신설**: `ClassroomConfigEditor`에 활동 활성화 섹션 추가. 포스터, 에세이, 뉴스링크, 영상링크, 작성기사 등 5종 활동을 개별적으로 온/오프 가능.
- **캠페인 광장(갤러리) 레이아웃 강화**:
  - 모둠 카드 내 **'작성한 기사'** 목록 섹션 추가.
  - 교사 설정에 따라 비활성화된 활동 영역은 자동으로 숨김 처리되는 동적 레이아웃 적용.
  - 전체적인 카드 내부 요소를 세로 피드 스타일로 정돈하여 가독성 향상.
- **코드 품질**: 모든 수정 사항에 `// [Antigravity]` 주석을 추가하여 추적성 확보.

## v0.8.60 (2026-04-29) — 포스터 미리보기, HEIC 경고, 페이지네이션 및 주장하는 글쓰기 모드 추가
- **포스터 업로드 개선**: iPhone 사진(HEIC) 선택 시 "JPG/PNG로 변환 필요" 경고 메시지 노출 및 업로드 차단 로직 추가.
- **실시간 미리보기**: Phase 1 학생 화면 상단에 '우리 모둠 활동 미리보기' 창 추가. 등록 즉시 포스터, 글, 링크가 다른 친구들에게 어떻게 보일지 실시간 확인 가능.
- **캠페인 광장 페이징**: `GroupShowcase` 내 기사/영상 목록이 2개 초과 시 페이지 번호(1, 2, 3...) UI를 제공하여 누락된 항목도 모두 확인 가능하도록 개선.
- **주장하는 글쓰기 모드**:
  - 교사용 학급 설정(`ClassroomConfigEditor`)에 'Phase 1 활동 방식(포스터/글쓰기/병행)' 옵션 신설.
  - 주장-근거-기대효과 구조의 전용 글쓰기 템플릿(`EssayEditor`) 개발 및 데이터 저장 로직 구현.
  - 캠페인 광장에 작성된 글을 카드 형태로 노출.
- **기타**: `Phase1Page` 내 `essays` 실시간 구독 및 데이터 연동 완료.

## v0.8.56 (2026-04-28) — Firebase 보안 규칙 validate 필드명 오류 수정 (여론조사·선거 투표 불가 버그)
- `docs/firebase-rules.json`: `polls/votes/$studentId` validate → `choice` → `optionId` (코드가 `optionId`를 씀)
- `docs/firebase-rules.json`: `electionVotes/$studentId` validate → `groupId` → `candidateGroupId` (코드가 `candidateGroupId`를 씀)
- billVotes·juryVotes는 `choice` 필드 일치 확인 — 수정 불필요.
- **Firebase Console에서 규칙 수동 적용 필요** (`docs/firebase-rules.json` 내용 붙여넣기).

## v0.8.55 (2026-04-28) — Phase2·3·4 학생 화면 하이라이트/흐림 효과 복원
- `Phase2Page.jsx`: `HighlightBox` 도입 — myGroup·candidates·result·poll 영역을 워크플로 단계에 맞게 강조/흐림 처리.
- `Phase3Page.jsx`: `HighlightBox` 도입 — 탭 콘텐츠·poll 강조. 워크플로 하이라이트가 탭 이름이면 해당 탭으로 자동 전환 (`useEffect`). 변수 선언 순서 버그(`role` 미정의 상태에서 `isStudent` 계산) 수정.
- `ReflectionPage.jsx`: `HighlightBox` 도입 — editor/wall 영역·poll 강조.
- 빌드 + 서버 재배포 완료.

## v0.8.54 (2026-04-28) — 교사: 학생 강제 삭제 + 동일 번호 중복 접속 차단
- `gameStore.js`: `remove` import 추가, `removeStudent(studentId)` 액션 신규 — 학생 레코드 + 모둠 멤버십 동시 삭제.
- `gameStore.js` `joinRoom`: 동일 번호가 `isOnline: true`이면 입장 거부 (`N번은 이미 다른 기기에서 접속 중입니다`).
- `StudentActivityMonitor.jsx`: 각 학생 행 우측에 ✕ 삭제 버튼 추가. confirm 확인 후 삭제, 처리 중 비활성화.
- 빌드 + 서버 재배포 완료.

## v0.8.53 (2026-04-28) — Firebase RTDB 보안 규칙 테스트 모드 → 운영 모드 전환
- **규칙 파일**: `docs/firebase-rules.json` 작성 (Firebase Console에 붙여넣기용).
- **핵심 변경**: 루트 `.read/.write: false` → 방 코드 없이 데이터 열람·열거 불가.
- **roomsIndex**: SuperAdmin 페이지 목록 조회용으로 읽기 허용 유지.
- **rooms/$roomCode**: 방 코드를 아는 경우에만 전체 읽기·쓰기 허용.
- **validate 규칙**: className(1~50자), currentPhase(1~4), student number/nickname, comments/articles/reflections/bills/votes 필수 필드 + 길이 검사.
- Firebase 인증 미사용(반 코드+이름 자체 식별)이므로 uid 기반 행위자 구분 불가 → 구조 기반 검증으로 보완.
- 적용 방법: Firebase Console → Realtime Database → 규칙 탭 → 붙여넣기 → 게시.

## v0.8.52 (2026-04-28) — 입법부 발의상정 오류 수정 + 이전 방 config 호환
- **원인**: 구버전으로 생성된 방은 RTDB config에 `templates` 키가 없어 `BillTemplate`의 `fields=[]` → 빈 폼 → title/body가 `undefined`로 Firebase 저장 오류.
- **수정 ①** `BillTemplate.jsx`: `configFields?.length`가 없으면 `DEFAULT_TEMPLATES.bill.fields`로 폴백.
- **수정 ②** `gameStore.js` onValue 핸들러: 로드된 config에 `templates`·`roles`·`briefings`가 없으면 `DEFAULT_CONFIG`의 값으로 자동 보충 (`...DEFAULT_CONFIG, ...data.config` + 개별 키 보충).
- 빌드 + 서버 재배포 완료.

## v0.8.51 (2026-04-28) — 여론판 레이아웃 개편 (여론조사 결과 + 기사 나란히)
- `NewsBoardPage.jsx` 오른쪽 `lg:col-span-2` 영역을 `lg:grid-cols-2`로 분할.
- 왼쪽: `PollResultGallery` (여론조사 결과), 오른쪽: 필터 + 기사 목록. 나란히 표시.
- 빌드 + 서버 재배포 완료.

## v0.8.50 (2026-04-28) — OpinionSideBanner 여론조사 표시 전면 개선
- **버그 수정**: winner 계산에서 `opt.text` → `opt.label || opt.text || opt.id` 수정 (PollManager는 `label`로 저장하므로 기존엔 항상 null).
- **hasVoted 참여 여부 표시**: `myStudentId`로 투표 여부 확인 → 미참여 학생에게만 `👉 참여해 주세요!`(깜빡임), 참여 완료 학생에게는 `✅ 참여 완료`.
- **결과 발표 표시**: `published` + `winner` 있으면 초록 박스에 `🏆 [1위 답변]` 크게 표시.
- 빌드 + 서버 재배포 완료.

## v0.8.49 (2026-04-28) — PollManager 생성 시 '지금 바로' 옵션 추가
- `slotKey: 'now'` 분기 추가: 특정 페이즈·단계 미지정, `phaseStep: null`, `tag: '수시'`.
- 드롭다운 최상단에 `⚡ 지금 바로 (수시 실시)` 옵션 표시.
- 빌드 + 서버 재배포 완료.

## v0.8.48 (2026-04-28) — PollManager 상태 전환 개선
- `published` 상태에서도 `🔒 종료(비공개)` 버튼 표시 (기존엔 없었음).
- `closed` 상태에서 `↩ 종료 취소(재개)` 버튼 추가 → `voting`으로 복귀 가능.
- 전체 상태 흐름: idle → voting ↔ published ↔ closed (양방향 전환 가능).
- 빌드 + 서버 재배포 완료.

## v0.8.47 (2026-04-28) — OpinionSideBanner 최소화·닫기 버튼 제거
- 헤더의 `—`(최소화) / `✕`(숨기기) 버튼 삭제. 배너는 항상 표시.
- `minimized`, `hidden` state 및 관련 로직·분기 전면 제거.
- 사용 안 하는 `useRef` import 제거.
- 빌드 + 서버 재배포 완료.

## v0.8.46 (2026-04-28) — OpinionSideBanner 스크롤 속도·여론조사 카드 표시 개선
- **스크롤 속도**: `Math.max(15, items.length * 8)` → `Math.max(40, (looped.length / 2) * 10)` 으로 변경 (항목당 약 10초 체류, 기존 대비 2-3배 느림).
- **여론조사 태그 줄 정리**: 태그·상태 배지를 둥근 pill 스타일로 리디자인. `🏆 1위` 라벨을 태그 줄에서 제거(오해 소지).
- **질문**: 12px bold로 크게.
- **1위 답변**: 초록 박스에 `🏆 [답변]` 형태로 명확 표시.
- 빌드 + 서버 재배포 완료.

## v0.8.45 (2026-04-28) — OpinionSideBanner 훅 규칙 위반 → 학생 Phase 1 진입 시 하얀 화면 수정
- **원인**: `looped = useMemo(...)` 가 3개의 얼리 리턴(role !== student / hidden / items.length === 0) 뒤에서 조건부로 호출되었음 → 초기 렌더(items 없음 → early return → useMemo 미호출)와 이후 렌더(items 생김 → useMemo 호출) 사이에 훅 수가 달라짐 → React "Rendered more hooks" 에러 → 컴포넌트 트리 전체 크래시 → 하얀 화면.
- **수정**: `looped` useMemo와 `animDuration`을 얼리 리턴 이전으로 이동. 훅은 항상 동일한 수로, 동일한 순서로 호출되도록 정정.
- 빌드 + 서버 재배포 완료.

## v0.8.35 (2026-04-26) — 시민단체 결성 완료 및 Phase 1 인벤토리 지급

## v0.8.40 (2026-04-27) — 실시간 여론조사 및 커뮤니케이션 시스템 개편
- **OpinionSideBanner 신설 (학생 우측 무한 배너)**:
  - 기존 TopArticlesBanner(상단 스크롤) 제거.
  - 우측 중앙에 드래그/최소화 가능한 세로 무한 스크롤 배너 신설.
  - 진행 중이거나 게시된 여론조사, 인기/최근 기사가 실시간 스크롤됨.
  - 모든 학생 화면(Phase 1,2,3, Reflection)에 글로벌 마운트.
- **GlobalPollPopup 신설 (학생 화면 팝업)**:
  - 교사가 특정 여론조사를 학생 화면 한가운데 즉시 팝업으로 띄우는 기능 추가.
  - 학생이 어느 화면(Phase 1~4)에 있든 RTDB(`activePopupPoll`) 감지하여 즉시 렌더.
- **교사용 PollManager 접근성 강화**:
  - `TeacherDashboard` 내 크게 자리잡고 있던 인라인 `PollManager` 섹션 제거.
  - 상단 `RoomBar`에 `⚡ 여론조사` 퀵 버튼 추가 및 `PollManagerModal` 연동. 교사가 어느 화면에서든 팝업을 열어 통제 가능.
  - 여론조사 항목 내에 `🚀 화면에 띄우기` / `👇 팝업 내리기` 기능 추가 (학생 GlobalPollPopup 제어).
- **여론판(NewsBoardPage) 개편**:
  - 교사가 게시(published)한 여론조사 결과들이 최상단에 보여지는 `PollResultGallery` 신설.
- 빌드 + 서버 재배포 (완료).

## v0.8.38 (2026-04-26) — Phase 3 학생 화면 React error #185 (진짜 원인)
- **증상**: 학생이 모둠에 속한 채 /phase3에 진입하면 페이지가 새까맣게 변하고 React error #185(Maximum update depth) 발생. 이후 listener는 살아 있어도 컴포넌트 트리가 죽어 있어 페이즈 변경에도 반응 못 함.
- **원인**: `RoleCard.jsx` / `RoleAssigner.jsx`의 zustand selector
  ```js
  const roles = useGameStore((s) => s.config?.roles?.[kind] || [])
  ```
  `s.config?.roles?.[kind]` 가 undefined일 때 `|| []` 가 **selector 안에서** 매번 새 빈 배열 reference를 만든다 → zustand가 "snapshot이 캐시 안 됨"으로 판단 → 무한 루프 → React가 트리 unmount.
- **수정**: `|| []`를 selector 밖으로 빼고 module-level `EMPTY_ROLES` 상수로 fallback. 같은 패턴이 EntryPage·SuperAdminPage 의 `teacherRooms/studentRooms` selector에도 있어 함께 수정 (`|| EMPTY_ROOMS`).
- **검증** (production build + 실제 RTDB):
  - 학생을 모둠에 넣고 /phase3 진입 → 정상 렌더 (이전엔 black screen)
  - phase 3 ↔ 1 ↔ 2 ↔ 3 모든 전환 → 학생 자동 이동 ✓
- 빌드 + 서버 재배포 완료. **이게 사용자가 처음부터 보고한 "다른 페이즈로 가도 안 따라옴" 진짜 원인**.

## v0.8.37 (2026-04-26) — 학생이 교사 페이즈 이동을 안 따라오는 문제 (실제 원인)
- **재현**: 교사가 대시보드 [Phase 3] 버튼으로 학생을 Phase 3에 보낸 뒤, RoomBar의 다른 페이즈 탭(예: 시민광장) 클릭 → 교사 본인은 /phase1로 이동, 그러나 `currentPhase`는 3 그대로 → 학생은 /phase3 머무름.
- **원인**: 교사 RoomBar의 페이즈 탭이 단순 `<Link>` 였음. 클릭해도 RTDB의 `currentPhase`를 바꾸지 않아 학생 listener가 받을 변화가 없음.
- **수정**: RoomBar 탭 클릭 시 `setPhase(tab.phase)` 동시 호출. 여론판은 `phase: 'news'` 로 두어 페이즈 변경 안 함(보기 전용).
- **검증** (production build + 실제 RTDB):
  - 시민광장 클릭 → currentPhase=1 ✓
  - 국정포털 클릭 → currentPhase=3 ✓
  - 여론판 클릭 → currentPhase 그대로 ✓
- 빌드 + 서버 재배포 완료.

## v0.8.36 (2026-04-26) — 학생 화면이 페이즈 변경에 반응하지 않는 문제 (방어적 수정)
- **증상**: 교사가 Phase 3 → 다른 페이즈로 바꿔도 학생 화면이 Phase 3에 머무름. ‘연동이 끊긴 것’처럼 보임.
- **추정 원인**: `attachListener` 의 `onValue` 콜백이 일시적으로 `null`을 받으면 즉시 `leaveRoom()` 을 호출해 리스너 자체가 해제되고, 이후 RTDB 변화가 학생에게 전달되지 않음.
- **수정**: null 수신 시 즉시 leave 하지 않고 **5초 유예 타이머**로 예약. 그 사이 데이터가 다시 들어오면 타이머 취소. 5초간 비어 있을 때만 정리.
- `leaveRoom`도 보류 타이머를 함께 정리하도록 가드 추가.
- 빌드 + 서버 재배포 완료. (재현 어려운 산발적 버그라 추가 정보 필요)

## v0.8.35 (2026-04-26) — Phase 3 진입 시 화면이 흰색으로 보이는 문제
- **원인 추정**: `BriefingAutoModal`이 Phase 3 진입 직후 `bg-black/60` 풀스크린 오버레이 + 중앙 흰 카드(`max-w-2xl w-full`)로 화면을 거의 덮었고, **5초 동안 [확인] 버튼 비활성**이라 사용자가 닫지 못해 "화면이 하얗게 됐다"로 인지.
- **수정**: 5초 대기 제거 + 우상단 ✕ 닫기 버튼 + 오버레이(어두운 영역) 클릭 시 닫힘.
- 빌드 + 서버 재배포 완료.

## v0.8.34 (2026-04-26)
- **PollManager — '기타' 폴도 페이즈·단계 직접 지정**.
- 기타 선택 시 호박색 박스 안에 **페이즈 드롭다운(1~4)** + **단계 드롭다운(해당 페이즈의 PHASE_STEPS)** 표시.
- 단계 옵션은 `N단계 · 학생용 라벨 (M차시)` 형태. 페이즈 변경 시 단계는 첫 단계로 리셋.
- onCreate가 customPhase + customStepId 로 phaseStep 저장 → 리스트 정렬·배지에 그대로 반영.
- 빌드 + 서버 재배포 완료.

## v0.8.33 (2026-04-26)
- **여론판 상시 개방 + 인기 기사 스크롤 배너**.
- **/news 게이트 완화**: `allowedPhases [3,4]` → `[1,2,3,4]`. 학생도 모든 페이즈에서 여론판 진입 가능 (RoomBar 탭은 이미 있음).
- **`components/news/TopArticlesBanner.jsx` 신설**:
  - 승인된 기사 + 그 기사에 달린 댓글 다축 평가 합 + 댓글 수 = 인기 점수
  - 상위 3개를 가로 칩 형태로 표시 (관점 이모지·제목·작성 모둠·★점수)
  - `sticky top-[44px] z-10` — RoomBar(`top-0 z-20`) 바로 아래 붙어 스크롤 따라옴
  - 칩/배너 어디든 클릭하면 `/news` 로 이동, 우측에 "전체 보기 →" 링크
  - 승인 기사가 0개면 컴포넌트 자체 렌더 안 함
- **마운트 위치**: Phase1Page / Phase2Page / Phase3Page / ReflectionPage 의 RoomBar 바로 아래.  
  (NewsBoardPage·TeacherDashboard 에는 마운트 안 함 — 이미 전체 목록 또는 운영 화면)
- 빌드 + 서버 재배포 완료.

## v0.8.32 (2026-04-26)
- **여론조사 — Phase 2 선거 사전 추가 + 페이즈/순서 인지 + 차시 표기**.
- **PHASE_STEPS Phase 2에 `prepoll` 단계 신설**: `register → campaign → prepoll(선거 사전 여론조사) → voteStart → finalize → roles`. 후보 토론 후 지지도를 가늠하고 본 투표.
- **모든 페이즈 단계에 `session` 필드 추가** — 1차시·2~3차시·4차시 등. PhaseWorkflow 우측에 `text-[10px] font-mono` 배지로 표시. (이전엔 Phase 3 라벨 안에만 "(10~12차시)" 식으로 텍스트 박혀 있던 것을 메타 필드로 일원화)
- **`POLL_SLOTS` export** — PollManager 드롭다운용:
  - Phase 2 · 선거 사전 (후보 지지도)
  - Phase 3 · 2차/3차/4차
  - 1차는 별도 `CoreIssuePoll` 시스템이라 제외
- **PollManager 만들기 폼**: 자유 태그 입력 → **슬롯 드롭다운**으로 변경. 슬롯 선택 시 태그 자동 입력 + `phaseStep:{phase,stepId}` 저장. "기타 (자유 주제)" 선택 시 태그 직접 입력 가능.
- **PollManager 리스트**: 각 폴에 `Phase N · K단계 · M차시` 인디고 배지 표시. **목록 정렬을 페이즈→단계 순서**로 변경(수업 진행 순서대로 보여 교사가 제때 실시하기 쉬움).
- 빌드 + 서버 재배포 완료.

## v0.8.31 (2026-04-26)
- **교사 대시보드 — 페이즈 4그룹 가로(4열) 배치**.
- 이전(v0.8.30): 페이즈 1·2·3·4 블록을 세로로 쭉 쌓음
- 변경: **`grid xl:grid-cols-4` 4열 가로 배치** (md=2열, xl≥1280=4열). 각 열은 [Phase N 버튼] → [활동 패널] 세트.
- 컨테이너 폭: `max-w-6xl` → `max-w-screen-2xl` (4열에서 칸 너비 확보).
- 빌드 + 서버 재배포 완료.

## v0.8.30 (2026-04-26)
- **교사 대시보드 — 도구 모달화 + 본문 재배치**.
- **상단 도구 바**(우측 정렬, 나가기 왼쪽):
  - 📎 링크 — `대기 N` / `승인 N` / `전체 N` 3개 버튼 (각각 누르면 해당 필터로 모달 오픈)
  - **대기 > 0이면 대기 버튼 깜박**(`animate-pulse`, amber-500 배경)
  - ⚙️ **학급 설정** 버튼 — 누르면 모달
  - 📱 입장 QR / 📷 갤러리 / 📊 학생 분석 / 🗑️ 영구 삭제 (기존)
- **모달 컴포넌트**: 검은 반투명 오버레이 + 중앙 카드(`max-w-3xl`, `max-h-90vh` 스크롤). 배경 클릭 또는 ✕ 버튼으로 닫힘.
- **본문 순서 (위 → 아래)**:
  1. 학급 요약
  2. 페이즈 블록 4개 (Phase N 버튼 + 활동 인터리브)
  3. 다음 페이즈 이동 버튼
  4. (Phase 3) 전문가 호출 큐
  5. **학생 활동 모니터**
  6. **베네핏 카드 인벤토리 + 여론조사** 좌우 배치
- 이전(v0.8.29) 3칸 도구 패널(링크/여론/설정) 제거 — 모달 + 좌우 배치로 대체.
- LinkApprovalQueue: `initialFilter` prop 추가, `useEffect`로 prop 변경 시 동기화.
- 빌드 + 서버 재배포 완료.

## v0.8.29 (2026-04-26)
- **교사 대시보드 — 페이즈 버튼·활동 인터리브 배치**.
- 이전(v0.8.28): [Phase1·2·3·4 버튼 한 줄] → [Phase1·2·3·4 활동 패널 4개]
- 변경: **[Phase 1 버튼] → [Phase 1 활동] → [Phase 2 버튼] → [Phase 2 활동] → ...** 반복
- Phase 버튼이 그 자체로 섹션 헤더 역할(클릭 시 해당 페이즈로 전환), 바로 아래 활동 패널이 붙어 한눈에 보기 편함.
- 빌드 + 서버 재배포 완료.

## v0.8.28 (2026-04-26)
- **교사 대시보드 — 전면 리디자인**.
- **새 레이아웃 (위 → 아래)**:
  1. 상단 도구 바: QR(새창 팝업) / 갤러리 / 분석 / **영구삭제** (오른쪽 정렬, 나가기 왼쪽)
  2. **학급 요약** 카드 (학급명 / 학급 인원 / 접속 / 현재 페이즈)
  3. **페이즈 흐름 바**: 1 → 2 → 3 → 4 (현재 페이즈 강조, 클릭으로 전환)
  4. **각 페이즈 활동 패널 4개 펼침** — `<PhaseWorkflow phase={p} embedded />` 사용. 다른 페이즈는 읽기 전용("(참고)" 표시)
  5. **다음 페이즈 이동 버튼** — 모든 학생이 '차시 끝' 누르면 깜박(animate-pulse). 미완 학생 있으면 confirm 다이얼로그
  6. **3칸 도구**: 링크 승인 큐 / 여론조사 관리 / 학급 설정
  7. (Phase 3) 전문가 호출 큐
  8. 학생 활동 모니터 (전체 폭)
  9. 시민단체 인벤토리 그리드 (config.topics 기반, 6개 모두 표시)
- **새 페이지 `/share` (QrSharePage)**: 입장 안내 QR을 새 창에서 큰 사이즈(80vmin)로 표시. 창 크기 조절하면 QR도 함께 커진다.
- **PhaseWorkflow 변경**: `phase` prop(기본값 currentPhase) + `embedded` prop 추가. 비현재 페이즈는 읽기 전용으로 표시.
- **App 라우터**: `/share` 라우트 추가, StudentAutoNavigator의 `ALLOWED_FOR_STUDENT`에 `/share` 추가.
- 빌드 + 서버 재배포 완료.

## v0.8.27 (2026-04-26)
- **학생 활동 모니터 — 컬럼 한글 라벨 + 항목 추가**.
- **변경**:
  - 첫 컬럼: ●(접속 점) + 번호 + 이름 통합 (이전엔 별도 컬럼)
  - 헤더 이모지 → **한글 텍스트** ("학생/모둠/댓글/투표/기사/정리글/포스터/뉴스기사/영상/슬로건")
  - **댓글**: `N/M` 형식 — M = 시민단체 수 - 1 (자기 모둠 제외, 보통 5)
  - **정리글**: `N/1` 형식
  - 그 외(투표·기사·포스터·뉴스기사·영상·슬로건): 누적 카운트
- **새 데이터 구독**:
  - posters → 본인 직접 업로드 카운트
  - links → 뉴스기사(type='news') 본인 제출 + 영상·캔바(승인된 것만) 본인 제출
  - groups/{gid}/slogans → 본인이 작성한 슬로건
  - polls/votes → 일반 폴 투표(여론조사)도 투표 카운트에 합산
  - juryVotes → 배심원 평결도 투표 카운트에 합산
- 빌드 + 서버 재배포 완료.

## v0.8.26 (2026-04-26)
- **댓글 보기 — 한 줄 텍스트 형식으로 압축**.
- 형식: `[✓] 주제N 실현N 설득N - 댓글 내용 (N번 이름)` 한 줄
- 색깔(amber 배경, ring) 제거, 평가 점 → 숫자, divide-y로 행 구분
- 본인 댓글은 ✓ 마커만, 색 없음
- 빌드 + 서버 재배포 완료.

## v0.8.25 (2026-04-26)
- **댓글 카드 레이아웃 — 좌측 3줄 평가 + 우측 본문**.
- **MultiAxisRating에 `stacked` 모드 추가**: 세 축을 세로 3줄로 작게 표시(점 10px). 차지 높이 약 2줄.
- **CommentList 댓글 카드**:
  - 좌측: stacked 평가(주제/실현/설득 세로 3줄)
  - 우측: 댓글 본문(여러 줄 가능, `whitespace-pre-wrap break-words`, truncate 제거)
  - 본문 아래에 작성자 작게 (`text-[10px]`)
- 빌드 + 서버 재배포 완료.

## v0.8.24 (2026-04-26)
- **모둠별 사회적 신뢰도 현황판 — 캠페인 광장 아래로 이동**.
- 사용자 요청에 따라 위쪽(워크플로 직후) → 아래(캠페인 광장 다음)로 위치 변경. z-index도 z-20 → z-10으로 정상화.
- 빌드 + 서버 재배포 완료.

## v0.8.23 (2026-04-26)
- **댓글 권한·중복·수정 + 활동 모니터 + 신뢰도 위치**.
- **CommentList 규칙 강화**:
  - props에 `targetGroupId` 추가 → 자기 모둠 자료에는 입력 차단(안내 문구만)
  - 한 모둠당 한 학생 댓글 1개만 — 이미 작성한 경우 입력 폼 자동 숨김 + ‘수정’/‘삭제’ 버튼 노출
  - 본인 댓글은 항상 리스트 **첫 줄** + amber 강조(✓ 마커)
  - 수정 모드: 기존 본문·평가가 폼에 채워짐 + ‘수정 저장’ + ‘취소’
  - `updatedAt` 표시(수정됨)
- **GroupShowcase**: `<CommentList>`에 `targetGroupId` 전달
- **새 컴포넌트** `teacher/StudentActivityMonitor.jsx`:
  - 학생별 행: 번호·이름·모둠·🟢접속·💬댓글·🗳️투표(선거+법안)·📰기사(승인/대기)·📝정리글
  - 호버 시 컬럼 의미 툴팁, zebra striping, 비접속은 회색
  - 페이즈 끝 ✓ 마커, 0은 ·로 mute
- **TeacherDashboard 재구성**:
  - 우측 ‘모니터링’ → ‘학급 요약’(반 코드·학급·인원·접속·끝 카운트)
  - 그 아래 별도 큰 섹션으로 **학생 활동 모니터** 표 — 한눈에 모든 학생의 입력 현황
- **신뢰도 현황판 위치**: 우리 모둠 박스 아래 → **워크플로 진행 표시 직후**(맨 위)로 이동, `z-20` 명시 → 6팀 게이지가 항상 위에서 보임
- 빌드 + 서버 재배포 완료.

## v0.8.22 (2026-04-26)
- **슬로건 마퀴를 포스터 위로 이동 + 댓글 페이지네이션 레이아웃**.
- **GroupShowcase 슬로건**: 포스터 아래 → **포스터 위**로 위치 변경(`mb-2` 마진). 끊김 없는 무한 흐름은 그대로.
- **CommentList 재구성**:
  - 한 페이지에 **2개씩** 표시 (`PAGE_SIZE = 2`)
  - 각 행 = **좌측: 다축 평가 3축**(주제·실현·설득) + **우측: 댓글 한 줄 + 작성자**(`truncate`로 한 줄 제한, hover 시 풀텍스트 툴팁)
  - 페이지네이션: `← 이전` / `1/N` / `다음 →` 버튼
  - **마지막 페이지에서 ‘다음 →’ 버튼이 ‘✓ 마지막’으로 변경** + 비활성화·회색
  - 첫 페이지에서 ‘이전’ 버튼 비활성
  - 새 댓글 작성 시 자동으로 첫 페이지로 이동(보이게)
- 빌드 + 서버 재배포 완료.

## v0.8.21 (2026-04-26)
- **슬로건 마퀴 — 끊김 없는 무한 흐름**.
- **이전 문제**: 슬로건이 1~2개면 콘텐츠 너비가 부모보다 짧아 한 사이클 끝에 빈 공간이 생기고 ‘뚝뚝’ 끊겨 보임.
- **해결**:
  - 동적 복제 횟수 — `Math.max(2, Math.ceil(8 / baseLen) * 2)`로 **짝수 번** 복제(최소 8개 항목)
  - 짝수 복제 + CSS `-50%` 이동 → 첫 절반 끝에서 두 번째 절반이 정확히 같은 위치로 와 자연스럽게 연결
  - flex `gap-8`이 모든 항목 사이에 동일 적용 → 마지막 다음 첫 글이 자연스럽게 이어짐
  - 각 항목 `flex-shrink-0`로 너비 보장
  - 속도: 항목당 7초로 일정 (`animationDuration = baseLen * 7s`)
- 빌드 + 서버 재배포 완료.

## v0.8.20 (2026-04-26)
- **GroupShowcase 포스터 — 비율 유지(잘림 없음)**.
- **변경**: `object-cover` → `object-contain` + 부모를 `flex items-center justify-center`로
  - 가로형/세로형 어떤 비율이든 긴 변을 3:4 박스에 맞추고 빈 영역은 회색 그라디언트로 채움
  - 사진 전체가 보임(잘리지 않음)
- 빌드 + 서버 재배포 완료.

## v0.8.19 (2026-04-26)
- **다축 평가 라벨 변경 + 한 줄 컴팩트 + 신뢰도 현황판 강화 + 슬로건 마퀴**.
- **MultiAxisRating**:
  - 라벨: 논리·실현·주제 → **주제관련성·실현가능성·설득력** (이모지: 🎯 💡 🗣️). 데이터 키는 호환 위해 그대로(`relevance`/`feasibility`/`logic`).
  - 순서도 주제 → 실현 → 설득으로 변경
  - **compact 모드 한 줄 컴팩트** — 각 축이 [짧은 라벨 + 점 3개 + (숫자)] 한 줄에. 점 크기 16px, gap 압축
- **신뢰도 현황판** (Phase1Page):
  - `groups` 기반 → **`config.topics` 기반** — 시민단체 6개 모두 표시(미결성 모둠도 0건으로)
  - 시각 강조: amber/orange 그라디언트 + 두꺼운 테두리 + shadow + `relative z-10` (다른 박스와 겹쳐도 위로)
  - 3열 그리드(lg)로 한눈에
- **GroupShowcase 슬로건 — 입력란 제거 + 포스터 아래 마퀴**:
  - 포스터 박스 안의 슬로건 오버레이 제거
  - 자기 모둠 인라인 입력 폼 제거(슬로건 입력은 GroupJoinPanel에서만)
  - 자기 모둠 슬로건 목록(✕ 삭제) 제거
  - 포스터 바로 아래에 가로 마퀴 — `• "슬로건" — N번 이름`이 왼쪽으로 천천히 흐름
  - CSS keyframes `slogan-marquee` (`index.css`에 추가, hover 시 정지)
  - 속도: 슬로건 개수 × 7초(최소 14초)로 동적 — 한 건씩 보일 정도
  - 콘텐츠 두 번 복제로 끊김 없는 무한 루프
- 빌드 + 서버 재배포 완료.

## v0.8.18 (2026-04-26)
- **교사 대시보드 인벤토리 — 시민단체 6개 모두 표시**.
- **이유**: `groups` 기반이라 결성된 모둠만 보였음(3개). config.topics 기준으로 변경.
- **변경**: `TeacherDashboard`의 모둠별 베네핏 카드 인벤토리 패널을 `config.topics` 순회로 변경
  - 모든 토픽이 항상 표시(이모지 + 이름)
  - 미결성 토픽은 점선 테두리 + "(미결성)" 안내
  - 멤버 수와 등수(있으면) 함께 표시
  - 인벤토리는 `BenefitCardInventory`가 `null`일 때도 안전하게 처리(이미 구현)
- 빌드 + 서버 재배포 완료.

## v0.8.17 (2026-04-26)
- **시민광장 GroupShowcase 레이아웃 개선** — 사용자 피드백:
  - 신문기사·영상을 좌(📰)·우(🎬) 2단으로 가로형 미니카드 2개씩 (캐러셀 X)
  - 빈 칸은 "📰 준비 중" / "🎬 준비 중" 표시
  - 댓글 입력창 항상 노출(토글 제거)
- **새 인라인 컴포넌트** (GroupShowcase 안):
  - `MiniCard` — 가로형 작은 카드(썸네일 56×40 + 헤드라인 2줄 + 출처). YouTube는 자동 썸네일(`img.youtube.com/vi/{id}/mqdefault.jpg`)
  - `MiniLinkList` — 최대 N개 표시 + 그 이상은 "+N개 더"
- **Phase1Page 재구성**:
  - **모둠별 사회적 신뢰도 현황판**을 캠페인 광장 위로 이동 — 2열 그리드, 댓글·평가 누적에 따라 게이지 차오름(여론조사 사전 지표)
  - LinkBoard import 제거 + 별도 신문기사·링크 자료실 섹션 완전 삭제(GroupShowcase 안에 통합됨)
  - videoLinks도 모둠별로 분배
- 빌드 + 서버 재배포 완료.

## v0.8.16 (2026-04-26)
- **캠페인 광장 — 모든 시민단체(토픽) 6개 항상 표시**.
- **이유**: 사용자 피드백 — "지금 3개만 보임". 학생이 합류한 모둠만 `groups`에 등록되어 비어 있는 모둠은 카드에 안 떴음.
- **변경**: `Phase1Page`의 `orderedGroupEntries` 계산을 `groups` 기반 → **`config.topics` 기반**으로 변경
  - 6개 토픽을 항상 순회
  - 결성된 토픽은 `groups[tid]`의 데이터 사용
  - 결성 안 된 토픽은 빈 모둠 객체(`members: {}`, `slogans: {}`) 사용
  - GroupShowcase는 빈 모둠도 "📷 포스터 준비 중"으로 표시(이미 구현됨)
- 자기 모둠 첫 번째 + 학생 ID 기반 셔플 그대로
- 빌드 + 서버 재배포 완료.

## v0.8.15 (2026-04-26)
- **슈퍼 관리자 — 모든 기기에서 만든 방 자동 표시**.
- **DB 분석 결과**: 보안 규칙이 root `.read=false`라서 인증 없이 모든 방 목록을 한 번에 못 가져옴. 인덱스 노드 추가가 필요.
- **새 노드 `roomsIndex/{rc}/{className, createdAt, lastSeen}`**:
  - 메타만(활동 데이터 X) — 누구나 read·write 가능
  - 보안 규칙: 코드 형식(6자리 영숫자) + className/createdAt/lastSeen 타입 검증
  - 학생이 읽어도 메타뿐. 활동 데이터는 여전히 `rooms/{rc}` 보안 규칙 적용
- **gameStore 수정**:
  - `createRoom`: rooms 생성 후 인덱스에도 자동 등록
  - `enterTeacherRoom`: 입장 시 인덱스 lastSeen 갱신 + 인덱스에 없던 옛 방도 자동 등록(첫 입장 시 마이그레이션)
  - `destroyRoom`: rooms·인덱스 동시 삭제
- **SuperAdminPage 수정**:
  - 마운트 시 `roomsIndex` GET → 모든 코드 자동 수집
  - 그 후 코드별로 `rooms/{rc}` GET해 통계 표시
  - 출처 칩에 `🌐 DB` 추가(인덱스에서 가져온 방)
  - 옛 방(인덱스 게시 전 만들어진)만 코드 추가 입력 필요
- **사용자 조치 필요**: Firebase Console에서 `docs/firebase_rules.json` 새 규칙 게시.
- 빌드 + 서버 재배포 완료.

## v0.8.14 (2026-04-26)
- **슈퍼 관리자 페이지** 추가 (`/super-admin`).
- **인증 분리**: 일반 교사 암호와 별개. 기본값 `super-1004` (`.env.local`의 `VITE_SUPER_ADMIN_PASSCODE`로 덮어쓰기 가능). sessionStorage 1회 통과.
- **방 관리 모델**: 보안 규칙이 root 전체 read를 막고 있어 ‘코드별 조회’ 방식.
  - 이 기기 `teacherRooms`는 자동으로 표시
  - 다른 기기에서 만든 방은 코드 입력 → `localStorage(class-democra-super-rooms)`에 누적
  - 각 방마다 RTDB GET으로 메타·통계 가져옴(학생/모둠/포스터/기사/정리글 카운트, 페이즈)
- **카드 액션**: ‘교사로 입장’(`enterTeacherRoom` 호출 → `/teacher`로) / ‘🗑️ 삭제’(영구 삭제 + 목록 정리) / ‘숨기기’(추가 코드만 — 서버 데이터 유지)
- **존재하지 않는 코드**: 분홍 경고 카드 + 한 클릭 ‘목록에서 제거’
- **EntryPage 하단**에 회색 작은 ‘· 슈퍼 관리자 ·’ 링크 추가(눈에 띄지 않게). 직접 URL `#/super-admin`도 가능.
- **`StudentAutoNavigator`** 예외 경로에 `/super-admin` 추가.
- 빌드 + 서버 재배포 완료.

## v0.8.13 (2026-04-26)
- **교사 — 반 코드 직접 입력으로 다른 기기에서 방 입장**.
- **이유**: 학교 PC에서 방 만들고 → 집 PC/태블릿에서 들어갈 때 teacherRooms 목록에 없으면 새 방 만들 수밖에 없었음. 코드만 알면 어디서든 동일 방의 교사 권한 확보.
- **gameStore `enterTeacherRoom(code)` 강화**:
  - 코드 형식 검증(6자리 영숫자 `^[A-Z2-9]{6}$`)
  - 처음 입장하는 코드면 teacherRooms 목록에 자동 추가(다음 한 클릭 입장)
  - 이미 있으면 className 최신화
  - RTDB에 없는 코드는 명확한 에러 메시지
- **EntryPage 교사 모드**:
  - 이전 방 목록 아래 "🔑 반 코드로 입장" 입력란 추가(emerald 박스)
  - 6자리 입력 + Enter 또는 [입장] 클릭 → 즉시 입장
  - 안내 문구: "다른 기기(학교 PC·집 PC)에서 만든 방에 들어갈 때"
- **보안**: 교사 암호(12346) 게이트는 그대로 → 이중 보호. 반 코드 노출 시 누구나 교사가 될 수 있는 한계는 그대로 (인증 없는 환경 특성).
- 빌드 + 서버 재배포 완료.

## v0.8.12 (2026-04-26)
- **시민광장 캠페인 영역 — 모둠별 통합 GroupShowcase 카드로 재구성.**
- **새 컴포넌트** `components/phase1/GroupShowcase.jsx`:
  - 한 박스 안에 ① 모둠명·인원·평균 평가 ② 세로 포스터(3:4) + 슬로건 오버레이 ③ 캡션 ④ 자기 모둠 슬로건 인라인 입력 ⑤ 신문기사 가로 캐러셀 ⑥ 댓글·평가 토글
  - 포스터 미게시 모둠은 점선 박스 + ‘📷 포스터 준비 중’ 안내
  - 자기 모둠은 indigo ring으로 강조
  - 슬로건은 포스터 상단에 반투명 검정 칩으로 오버레이 (최대 2개 + “외 N개”)
- **Phase1Page 재구성**:
  - 기존 ‘포스터 갤러리(평면 그리드)’ 제거
  - 모둠 카드를 **`lg:grid-cols-2`** 그리드로 (한 화면에 균등 분포)
  - **자기 모둠 첫 번째 + 나머지는 학생ID 기반 안정 셔플** — 학생마다 순서가 다르지만 본인에겐 일관됨, 모든 모둠이 누군가에겐 위에 오게
  - links 구독 추가하고 type='news'만 GroupShowcase에 props로 전달
- LinkBoard의 신문기사 섹션은 GroupShowcase 안으로 이동(데이터 source는 그대로). LinkBoard는 영상·캔바만 노출.
- 빌드 + 서버 재배포 완료.

## v0.8.11 (2026-04-26)
- **신문기사 게시 — 모둠별 구역 + 자동 흐름 캐러셀**.
- **새 컴포넌트** `components/links/NewsCarousel.jsx`:
  - 가로 스크롤 카드 트랙(폭 240px씩, gap-3, snap-x)
  - 3.5초마다 자동으로 한 카드씩 왼쪽으로 슬라이드, 끝나면 처음으로 돌아감
  - 마우스 hover / 터치 시 자동 슬라이드 일시정지(읽을 시간 확보)
  - 카드: 작은 썸네일(아스펙트 16:9) + 헤드라인 2줄 + 출처 + 작성자
- **LinkBoard 신문기사 섹션 재구성**:
  - 시민단체 모둠처럼 **모둠별로 테두리 박스**(`topicBg(color)` 사용)
  - 박스 안에 모둠명 + 기사 개수 + NewsCarousel
  - 모둠 미지정 기사는 ‘기타’ 박스로
  - 본인 작성 기사는 박스 하단 작은 ✕ 링크로 삭제 가능
- 빌드 + 서버 재배포 완료.

## v0.8.10 (2026-04-26)
- **신문기사 URL → 헤드라인·이미지·요약 자동 가져오기**.
- **인프라**:
  - NAS에 `fetch_meta.php` (cURL 우선·file_get_contents fallback, OpenGraph + Twitter Card + `<title>` 추출, SSRF 방어, 사설망 차단, UTF-8 변환, 절대 URL 보정)
  - 진단 결과: 현재 서버 PHP 8.0에 **cURL·OpenSSL 비활성** → 자체 fetch 불가. 서버 패키지 센터 → PHP 8.0 → 추가 익스텐션에서 `curl`·`openssl` 켜면 활성화 가능. 안 켜도 다음 fallback으로 동작.
- **클라이언트 헬퍼** `lib/fetch-link-meta.js`:
  - 1순위: 서버 `fetch_meta.php` (서버 활성화 시)
  - 2순위: `https://api.microlink.io` 무료 API (CORS 허용, 일/100건 무료)
  - 두 곳 다 실패 시 친절한 에러 메시지(직접 입력 안내)
- **LinkSubmit 신문기사 탭**:
  - URL 옆에 `[🔍 자동 가져오기]` 버튼
  - 성공 시 헤드라인·요약·이미지·출처 폼 자동 채움 + 어디서 가져왔는지 표시(서버 / microlink)
  - 학생이 검수·수정 후 게시
- 검증: microlink로 `news.naver.com` 헤드라인·이미지·도메인 정상 추출 확인.
- `_diag.php`(임시 진단) 정리.
- 빌드 + 서버 재배포 완료.

## v0.8.9 (2026-04-26)
- **신문기사 링크 — 승인 없이 즉시 게시 + 네이버 뉴스 카드 스타일**.
- **변경**:
  - `LinkSubmit`을 두 탭으로 재구성: ‘🎬 영상·캔바’(승인 필요) / ‘📰 신문기사’(즉시 게시)
  - 신문기사 폼 필드: 기사 URL · 헤드라인 · 요약(선택) · 대표 이미지 URL(선택) · 출처(선택, 비우면 도메인 자동 추출)
  - 신문기사 제출 시 `status: 'approved'` + `approvedAt: now()`로 즉시 게시
  - `LinkBoard` 분리: 영상·캔바 그리드 + 신문기사 리스트(좌측 썸네일 + 우측 헤드라인·요약·출처 — 네이버 뉴스 카드 풍)
  - 본인이 올린 링크는 ✕로 직접 삭제 가능(교사도 가능)
  - 교사 ‘직접 추가’에도 ‘📰 신문’ 타입 옵션 추가
- **데이터 스키마 추가**: `links/{lid}` 에 `type:'news'`일 때 `summary`, `thumbnail`, `source` 필드.
- 빌드 + 서버 재배포 완료.

## v0.8.8 (2026-04-26)
- **HighlightBox 자동 스크롤** — 사용자 요청: "포커스가 옮겨지면 스크롤도 따라가게".
- **변경**:
  - `useRef + useEffect`로 active 변화(false → true) 감지
  - 변화 시 `scrollIntoView({ behavior:'smooth', block:'center' })`로 화면 중앙에 부드럽게 위치
  - DOM이 scale 등 transform 적용 후 스크롤하도록 80ms 지연
  - `scrollMarginTop: 120px` — sticky RoomBar(약 56px) + StudentWorkflowProgress(약 60px)와 겹치지 않게
  - 첫 마운트 시 active=true면도 한 번 스크롤
- 빌드 + 서버 재배포 완료.

## v0.8.7 (2026-04-26)
- **슬로건 다중 입력 + 작성자 표시**.
- **변경**:
  - 데이터 스키마 추가: `groups/{gid}/slogans/{sid}/{text, authorStudentId, authorNumber, authorNickname, createdAt}`
  - 기존 단일 `groups/{gid}/slogan` 필드는 호환용으로 그대로 표시(첫 줄)
  - `GroupJoinPanel`에 새 `SloganInput` 작은 컴포넌트 — 입력 후 **Enter** 또는 **↵ 버튼**으로 즉시 추가, 입력값 자동 비움
  - 모둠 카드에 슬로건 리스트(작성자 번호+이름 표시) + 본인이 작성한 슬로건은 ✕로 삭제 가능
  - `PosterCard`에서도 모둠 카드에 최대 3개 슬로건 미리보기(작성자 이름 포함)
- 빌드 + 서버 재배포 완료.

## v0.8.6 (2026-04-26)
- **포스터 갤러리 — 검토 모드 contain + 표시 토글**.
- **변경**:
  - 검토 모드의 포스터 이미지: `aspect-[4/3] object-cover` → `max-h-[70vh] object-contain` (잘림 없이 원본 비율로 전부 보임)
  - 송출 모드는 그대로 cover (TV용 깔끔한 격자 유지)
  - 헤더에 "📷 포스터 ON/OFF" + "📺 링크 ON/OFF" 두 토글 추가
  - 둘 다 OFF면 안내 메시지 표시
- 빌드 + 서버 재배포 완료.

## v0.8.5 (2026-04-26)
- **포스터 갤러리 송출용 페이지 추가** (`/gallery`).
- **이유**: 사용자 요청 — 교사가 학생들이 올린 포스터를 한눈에 볼 수 있는 별도 페이지(TV 송출도 가능).
- **새 파일**: `pages/PosterGalleryPage.jsx`
- **기능**:
  - 모든 모둠 포스터를 큰 그리드(송출 모드 3열 / 검토 모드 2열)
  - 모둠명·슬로건·캡션 노출
  - 이미지 클릭 → 풀스크린 라이트박스
  - 검토 모드: 받은 평가 평균(다축) + 신뢰도 게이지 표시
  - 승인된 영상·캔바 링크도 같이 노출(YouTube는 iframe 임베드)
- **라우트**: `/gallery` (HashRouter라 `#/gallery`). 학생도 접근 가능(`StudentAutoNavigator`의 `ALLOWED_FOR_STUDENT`에 추가)
- **교사 대시보드 링크**: 페이즈 패널 아래 "📷 캠페인 갤러리 (송출용)" amber 버튼 추가
- 빌드 + 서버 재배포 완료.

## v0.8.4 (2026-04-26)
- **HighlightBox 안쪽 여백 추가** — 사용자 피드백: "짤뚱하게 잘려 나간 느낌이라 답답하다".
- **활성 박스**:
  - `p-3` 안쪽 여백(자식 컴포넌트와 글로우 가장자리 사이 호흡 공간)
  - `my-6` 위·아래 마진(scale 1.06으로 커져도 다른 박스와 겹치지 않게)
  - `bg-white/40` 흐릿한 흰 배경(자식 박스를 글로우 안에 살짝 떠 있는 카드처럼)
  - `rounded-3xl`로 모서리 더 부드럽게
- **비활성 박스**: `my-2` 추가(축소·흐림 와중에도 일관된 간격)
- 빌드 + 서버 재배포 완료.

## v0.8.3 (2026-04-26)
- **HighlightBox 효과 미세조정** — 사용자 피드백: "테두리 → 그림자, 키우기 더 크게".
- **활성 박스**:
  - `ring-*` 제거
  - `scale-[1.02]` → **`scale-[1.06]`** (더 크게)
  - 컬러 글로우 그림자: `0_30px_60px_-15px_rgba(99,102,241,0.45)` 아래쪽 + `0_0_40px_-5px_rgba(99,102,241,0.3)` 둘레 글로우
- **비활성 박스**:
  - `scale-[0.97]` → **`scale-[0.94]`** (더 작게 → 활성과 대비 강화)
  - `opacity-25` → **`opacity-20`**
  - `blur-[1.5px]` → **`blur-[2px]`**
- 빌드 + 서버 재배포 완료.

## v0.8.2 (2026-04-26)
- **강조 효과 강화** — 사용자 피드백: "좀더 강조해서 나머질 흐릿하게, 해당 부분만 좀 크게, 떠 있는 효과".
- **변경**:
  - `components/shared/HighlightBox.jsx` 신설 — 활성/비활성을 wrapper 컴포넌트로 처리
  - 활성 박스: `scale-[1.02]` 확대 + `ring-4 ring-indigo-400/70 ring-offset-4` 두꺼운 테두리 + `shadow-2xl shadow-indigo-300/40` 큰 그림자 + `z-20` 위로 띄움 + 500ms transition. ‘카드가 책상 위에 떠 있는 듯’.
  - 비활성 박스: `scale-[0.97]` 축소 + `opacity-25` (이전 0.4보다 더 흐림) + `blur-[1.5px]` 블러 + `pointer-events-none` 클릭 차단 + `select-none`
  - Phase1Page의 `dim()` 인라인 헬퍼 제거 → HighlightBox로 일괄 교체
- 효과는 학생 모드일 때만 + 페이즈에 강조 단계가 활성일 때만 적용. 교사·평소 단계는 평면 그대로.
- 빌드 + 서버 재배포 완료.

## v0.8.1 (2026-04-26)
- **교사 진행 가이드 ↔ 학생 화면 연동.**
- **이유**: 사용자 피드백 — “교사가 ‘다음’을 누르면 학생 화면 상단에 그 단계가 차례대로 보였으면 좋겠다. 마지막 여론조사 단계에서는 그 페이즈의 활동 내용이 모두 보이도록.”
- **변경**:
  - `PHASE_STEPS` 메타에 `highlight`(섹션 키)·`studentLabel`(학생용 짧은 이름)·`showSummary`(여론조사 단계 표식) 추가
  - `lib/use-workflow.js` 훅 — RTDB의 `workflow/phase{N}/stepIndex`를 구독해 `currentStep`/`isHighlight`/`showSummary` 반환
  - `components/shared/StudentWorkflowProgress.jsx` — 학생 화면 상단 가로 스텝 표시(완료 ✓ / 현재 강조 펄스 / 미진행 회색). Phase별 톤(amber/rose/slate/pink) 적용
  - `components/shared/PhaseActivitySummary.jsx` — 여론조사 단계에서 그 페이즈의 활동을 한 화면에:
    - Phase 1: 모둠별 포스터 + 신뢰도 점수
    - Phase 3 입법: 발의된 법안 + 가결/부결 + 표 수
    - Phase 3 행정: 정책 보고서 + 예산 합계 + 기대 효과
    - Phase 3 사법: 판결문 + 유/무죄 + 선고
- **각 페이지 통합**:
  - Phase1Page: 워크플로 진행 표시 + 섹션 강조(`groups`/`media`/`gallery`/`poll`) + 활동 요약 표시(poll1·lock 단계)
  - Phase2Page: 진행 표시 + 결과 요약(finalize·roles 단계)
  - Phase3Page: 진행 표시 + 라운드별 활동 요약(poll2·poll3·poll4 단계)
  - ReflectionPage: 진행 표시
- **강조 처리**: 강조 단계가 활성일 때, 해당 섹션은 indigo ring + offset, 그 외 섹션은 opacity-40으로 흐리게(학생만)
- 빌드 + 서버 재배포 완료.

## v0.8.0 (2026-04-26)
- **패키지 1~4 + v3 업그레이드 일괄 적용. 한 흐름으로 배포 완료.**

### 패키지 1~4 (v2 기반 강화)
- 학생 메뉴 제거 + 교사 페이즈 전환 시 학생 화면 자동 redirect (StudentAutoNavigator)
- 학생 ‘끝냈어요/취소’ floating 버튼 + 교사 대시보드 ‘다음 페이즈’ 깜박임(모든 학생 끝나면 emerald pulse)
- 교사 PhaseWorkflow 패널 — 페이즈별 진행 가이드 단방향(이전·다음)
- 여론조사 일반화 — `polls/{pollId}` 다중 폴(idle/voting/closed/published) + PollManager(교사) + PollFeed(학생)
- Phase 3 코어 이슈 배너 + 라운드 헤드라인(입법/행정/사법) + 라운드별 토론 주제 가이드(DiscussionPrompt)
- 당선자 직책(대통령·국회의장·대법원장) — `roleForRank()` + ElectionResultPanel 표시
- 후보 사진·선거 포스터·책자 — CandidateRegister에 이미지 업로드 + pamphlet 텍스트
- 후보 찬반 게시판(StanceComments) — pro/con 라디오 + 근거 댓글
- 토론 주제 가이드 — Phase 1·2·3·4 헤더 박스
- 정리글 5박스 + 마치며 글쓰기 (참여·인상·가장인상·새로앎·다짐 + finalEssay 1500자)
- 학생 이전 입장 방 목록 — `studentRooms` localStorage + EntryPage에서 재입장
- 학생 입장 QR 코드 — qrserver.com 외부 API 활용, StudentJoinShare 모달
- 영상 업로드 안내 링크 — config.videoUploadHint(교사가 호스팅 폴더 URL 제공 옵션)

### v3 업그레이드 — 전문성 스캐폴딩 4종
- **V3-1 기반**: `lib/scaffolding-data.js`(브리핑·역할·템플릿 본문) + config 4키(briefings·roles·templates·expertCallQuotaPerGroup) + PlaceholderField 빌딩 블록
- **V3-2 브리핑**: BriefingCard / BriefingLibrary(탭 3종) / BriefingAutoModal(Phase 3 첫 진입 5초 강제 + 읽음 기록)
- **V3-3 역할 분화**: RoleAssigner(셀렉터, 같은 차시 중복 차단) / RoleCard(학생 명찰 — 직무·할 일 3가지·SOS 시점) / 12종 역할 본문 / `groups/{gid}/sessionRoles/{sessionId}` 데이터
- **V3-4 템플릿 3종**: BillTemplate(목적·정의·의무·벌칙) / BudgetReportTemplate(4 카테고리 100억 자동 합산) / VerdictTemplate(사실관계·쟁점·근거·주문). PlaceholderField 미작성 시 제출 차단. 기존 BillEditor·자유 판결문 textarea 대체
- **V3-5 SOS**: ExpertCallButton(학생 우측 floating) + ExpertCallNotifier(교사 패널, 빨간 점멸 뱃지) / 모둠당 페이즈3 누적 3회 한도 / `expertCalls/{cid}` 컬렉션
- **V3-6 보안 + 배포**: RTDB 보안 규칙에 expertCalls·정리글 5박스·정리글 마치며 길이 검증 추가, expertCallQuotaPerGroup 1~20 검증. 빌드·배포

### 데이터 스키마 추가
- `polls/{pollId}/{tag,question,options,status,createdAt,publishedAt}` + `polls/{pollId}/votes/{sid}/{optionId,at}`
- `students/{sid}/sessionFinishedAtPhase, sessionFinishedAt, briefingsRead/{kind}`
- `groups/{gid}/sessionRoles/{sessionId}/{sid: roleKey}`
- `policies/{pid}/{policyName,budget,usage,schedule,impact,proposerGroupId,status}` (BudgetReportTemplate)
- `bills/{bid}/templateData` (BillTemplate 원본 4 필드)
- `verdicts/{caseId}/{vid}/templateData` (VerdictTemplate 원본 4 섹션)
- `expertCalls/{cid}/{groupId,sessionNo,request,status,teacherResponse,createdAt,respondingAt,closedAt}`
- `candidates/{gid}/{photoUrl,posterUrl,pamphlet}`
- `comments/{cid}/{stance:'pro'|'con'}` (후보 찬반)

### 단순화 결정 (v3 기획서 권장 대비)
- 템플릿용 별도 라우트(`/legislative/template/:billId` 등) **채택 X** — Phase3 탭 안 인라인 통합
- studentProgress 별도 컬렉션 **채택 X** — `students/{sid}/briefingsRead`로 통합
- Playwright e2e **채택 X** — 수동 시연
- 4역할 배정 **드래그-앤-드롭 X** → 셀렉터 (학생 태블릿 안정성)

### 추가 파일 / 변경 파일 요약
- 신규 컴포넌트 ~12개 (`scaffolding/`·`shared/`·`teacher/`)
- gameStore에 9개 새 액션 (createRoom v2, sessionRoles·expertCalls·polls·workflow 관련)
- 디자인 토큰 9가지 색상 풀 유지

### 다음 작업
- 사용자 최종 시연 후 자잘한 수정.

## v0.7.1 (2026-04-26)
- **학생 활동 분석 — 카드 그리드 → 표(table) 형태로 변경.** 사용자 피드백: 항목별 비교가 가능하게.
- **변경**:
  - 한 학생당 한 행, 18개 컬럼 (번호·이름·모둠·점수·🖼️·💬·받은⭐·준⭐·후보·선거·📜·찬/반·⚖️·평결·📰·📝·🔗·❤️)
  - 헤더 sticky(`top-0 z-10`), 번호·이름 컬럼 좌측 sticky(가로 스크롤 시 고정)
  - 같은 항목 위아래로 나란히 비교 가능
  - zebra striping (홀짝 행 교차 배경)
  - 0 값은 `·`로 mute 처리해 시각 노이즈 감소
  - 행 클릭 → 기존 상세 모달(시간순 타임라인 그대로)
  - 컬럼 헤더에 한글 툴팁(`title`)으로 의미 설명
- 모바일 — `overflow-x-auto`로 가로 스크롤. 좌측 sticky 덕에 행 식별 가능.
- 재배포 완료.

## v0.7.0 (2026-04-26)
- **학생 활동 분석 페이지 추가** (교사 대시보드에서 진입). economy_stock의 AnalysisTab 패턴 참고.
- **새 파일**:
  - `lib/student-stats.js` — 학생별 활동 집계 함수 + CSV 변환
  - `pages/StudentAnalyticsPage.jsx` — 카드 그리드 + 상세 모달 + CSV 내보내기
- **집계 항목** (한 학생당):
  - 포스터 업로드 수
  - 작성 댓글 수 + 종류별(target) 분류
  - 받은 다축 평가 평균 / 준 평가 평균 (논리·실현·주제)
  - 후보 등록 여부 + 선거 투표 여부 + 가중 사용
  - 법안 발의 / 의결 표(찬·반·가중사용)
  - 배심원 평결 / 판결 참여 (모둠 단위)
  - 기사 (전체·승인·대기·반려·관점별)
  - 정리글 제출 상태
  - 외부 링크 제출 / 승인 수
  - 야당 연합 신청·수락
  - 공감 이모지 누른 횟수
  - **활동 점수**(가중치 합산) + **시간순 활동 로그**
- **UI**:
  - 모둠 필터 + 정렬(번호순/활동순/이름순)
  - 학생 카드(번호·이름·모둠·점수·6개 지표 미니뱃지)
  - 카드 클릭 → 모달: 12개 핵심 지표 + 다축 평가 + 시간순 타임라인
  - **CSV 내보내기** — `학급명_반코드_학생활동분석_YYYY-MM-DD.csv` (UTF-8 BOM, 엑셀 한글 호환)
- **라우트**: `/analytics` (HashRouter라 `#/analytics`). role !== 'teacher'면 차단.
- **TeacherDashboard 통합**: 페이즈 컨트롤 패널 아래에 ‘📊 학생 활동 분석’ 버튼 추가.
- **재배포**: NAS에 v0.7.0 빌드 적용 완료.
- 다음 작업: 동학년 시연 + 실제 학생 데이터로 분석 정확도 검증.

## v0.6.3 (2026-04-26)
- **RTDB 보안 규칙 게시 + 외부 검증 완료.**
- **검증 결과**:
  - root GET → Permission denied ✓
  - 진짜 반 코드 GET → 정상 데이터 ✓
  - 소문자/짧은 코드 GET → Permission denied ✓
  - 댓글·기사 길이 제한 ✓
- **알려진 한계 (의도)**: 무작위 6자리 대문자+숫자로 ‘새 빈 방’ 생성은 가능. 다만 실제 운영 중인 방의 코드를 정확히 맞출 확률은 약 1/10억(32⁶). 학급 데이터 침해는 아님.
- **검증용 잔재 정리**: 검증에서 만든 `HACKER` 방 REST DELETE로 제거.
- **운영 권장**: 반 코드를 학생 외에 노출 X, 학기 종료 시 destroyRoom으로 정리.
- **추후 강화 옵션** (선택): Firebase App Check(도메인 화이트리스트), createdAt 검증.
- 다음 작업: 동학년 시연 + 실제 학생 태블릿 실측 + 발견되는 버그 수정.

## v0.6.2 (2026-04-26)
- **RTDB 보안 규칙 작성** — `docs/firebase_rules.json` 신설.
- **전략**: 인증 없는 환경이라 Firebase Auth 기반 권한 분리는 불가. 대신 **반 코드(6자리 영숫자)를 비밀번호처럼** 사용. root 직접 접근 차단 + `rooms/{roomCode}` 키 형식 강제(`/^[A-Z2-9]{6}$/`).
- **추가 검증**:
  - `students/{sid}`는 `student_숫자` 형식만 허용
  - `config/classSize`는 1~60 정수
  - 댓글 본문 300자, 기사 헤드라인 30자, 기사 본문 500자, 정리글 박스별 300자 길이 제한
- **적용 방법**: 사용자가 Firebase Console → Realtime Database → 규칙 탭에 직접 붙여넣고 ‘게시’.
- **테스트 잔재 정리**: 1단계 검증용 `connection_test`, `connection_test_curl` 노드 REST DELETE로 제거.
- **현재 RTDB 상태**: 사용자 운영 방 3개(37R662·FSDBPQ·RPPUU4) 보존. 모두 6자리 영숫자라 잠금 후에도 동작.
- **코드 영향 없음**: 모든 데이터 경로가 `rooms/{rc}/...` 안이라 잠금 후에도 정상 동작. `rtdb-helpers.js`가 이 패턴을 자동 강제.
- 다음 작업: 사용자 게시 후 검증 + 동학년 시연.

## v0.6.1 (2026-04-26)
- **첫 배포 + SPA 라우팅 안정화 + 한글 메타.**
- `npm run build` → `deploy.sh` → `<배포경로>/app/` 복사 흐름 검증.
- **`BrowserRouter` → `HashRouter`** 전환: nginx에서 `/class_democra/app/phase1`을 새로고침하면 404 발생 → URL이 `https://<배포주소>/class_democra/app/#/phase1` 형태로 바뀜. 모든 환경에서 안정. 학생들에게 ‘#’이 보이는 것이 부담이면 추후 nginx try_files 설정으로 BrowserRouter 복귀 가능.
- `index.html`: lang="ko", title "민국이의 꿈 — 작은 대한민국", description 메타.
- 빌드 결과: 522KB JS / 38KB CSS. gzip 152KB / 7.6KB. 학생 태블릿 첫 로드 1초 내 예상.
- 배포 검증: `curl -I` 200 OK, `curl /` HTML 정상, `curl -I /#/phase1` 200 OK.
- 외부 접속 URL: **https://<배포주소>/class_democra/app/**
- 다음 작업: Firebase RTDB 보안 규칙 잠그기 + 동학년 시연 + 학생 태블릿 실측 + 버그 수정.

## v0.6.0 (2026-04-26)
- **5주차 후반 + 6주차 — 여론판 + 정리글 벽 완성.** MVP 골자가 모두 동작하는 상태.
- **여론판 (`/news`)**:
  - `news/ArticleEditor.jsx` — 헤드라인(30자) + 본문(200~400자) + 관점 라디오(비판/옹호/중립) + 대상 차시 선택 → `status: pending`
  - `news/ArticleCard.jsx` — 관점·대상 뱃지 + 본문 + 댓글 토글(`CommentList` `targetType:'article'`)
  - `news/ArticleApprovalQueue.jsx` — 교사 승인/반려/대기로/삭제. **단축키 ⌘+Enter 승인 / ⌘+R 반려** (첫 대기 항목)
  - `pages/NewsBoardPage.jsx` 통합 — 좌측 작성/승인 + 우측 게시판 + 관점 필터
- **Phase 4 정리글 벽 (`/reflection`)**:
  - `phase4/ReflectionEditor.jsx` — 3박스(인상·다시 보고 싶은 결정·다짐) + 카드 색상 6종 + 비공개 옵션 → `status: pending`
  - `phase4/ReflectionCard.jsx` — 패들렛 카드 + 공감 이모지 4종(❤️👏💡👍, 1인 1택) + 댓글 토글
  - `phase4/ReflectionApprovalQueue.jsx` — 교사 승인/반려/삭제
  - `pages/ReflectionPage.jsx` — 패들렛 Masonry(`columns-1 sm:columns-2 lg:columns-3`) + 정렬(최신·공감)
- **데이터 스키마 추가**:
  - `articles/{aid}/{headline,body,perspective,target,authorStudentId,authorNumber,authorNickname,authorGroupId,status,approvedAt,createdAt}`
  - `reflections/{rid}/{impressive,revisit,pledge,color,isPrivate,authorStudentId,authorNumber,authorNickname,status,empathy:{heart,clap,lightbulb,thumbsup},empathyVoters:{sid:emojiKey},approvedAt,createdAt}`
- 노출 규칙: 학생은 본인 글이면 비공개·미승인 상태도 본인에게는 보임. 다른 학생에겐 `status='approved'` && `isPrivate=false`만 노출. 교사는 모두 보임.
- 다음 작업: 빌드·배포 + Firebase 보안 규칙 잠그기 + 동학년 시연.

## v0.5.0 (2026-04-26)
- **4주차 — Phase 3 입법·행정·사법 완성.**
- **입법 탭**:
  - `lib/bill.js` — `tallyBill(votes)` (가중치 합산 + 명수 분리)
  - `phase3/BillEditor.jsx` — 법안 발의(제목·본문·예상 효과). 발의 즉시 `status: 'voting'`
  - `phase3/BillCard.jsx` — 법안 카드 + 진행 게이지(찬/반 가중치 + 명수) + 학생 찬/반 버튼 + 교사 ‘의결 종료/재개’ + 본회의 토론 댓글 토글
  - `phase3/BillVoteModal.jsx` — 가중 투표권 사용 체크. 사용 시 `consumeWeightedCard(groupId)`로 인벤토리 1장 즉시 차감
  - `phase3/AlliancePanel.jsx` — **야당 연합**: 1분 타이머 동안 1위 제외 모둠 간 신청/수락. 활성 연합은 띠배너로 항상 표시
  - `shared/AllianceTimer.jsx` — endsAt 기준 카운트다운(250ms 갱신, compact 모드)
  - `phase3/LegislativeTab.jsx` — 발의 + 인벤토리 + 야당 연합 + 법안 갤러리 통합
- **행정 탭**:
  - `phase3/BudgetPanel.jsx` — 예산 항목 추가/삭제(억 단위). 합계 ≥ totalBudget 시 빨간 게이지 + 경고
  - `phase3/NpcEventBoard.jsx` — 교사가 투입한 NPC 사건 카드 노출
  - `phase3/ExecutiveTab.jsx` — 예산 + 시행령 토론(댓글) + NPC 사건
- **사법 탭**:
  - `phase3/JudicialTab.jsx` — NPC 사건 선택 → 변론 토론(댓글) → 배심원 평결(유/무죄 1인1표) → 판결문 작성/게시
- **gameStore 추가**:
  - `consumeWeightedCard(groupId)` — 가중 투표권 1장 차감(트랜잭션 X, 잔량 검사 후 update)
  - `startAllianceTimer(seconds=60)` / `stopAllianceTimer()` — `timers/oppositionAlliance: {active, endsAt}`
  - `launchNpcEvent(event)` — `npcEvents/{npc_xxx}` push
- **TeacherDashboard 추가**:
  - `teacher/Phase3Controls.jsx` — Phase 3 운영용. 야당 연합 타이머 + NPC 사건 투입(프리셋 4종 + 자유 입력)
  - `currentPhase === 3`일 때만 패널 노출
- **데이터 스키마 추가**:
  - `bills/{bid}/{title,body,expectedEffect,proposerGroupId,proposerStudentId,status,vetoUsedBy,voteResult,finalizedAt,createdAt}`
  - `billVotes/{bid}/{sid}/{choice,weighted,groupId,at}`
  - `alliances/pending/{targetGid}/{fromGid}/{at}` + `alliances/active/{id}/{groupA,groupB,formedAt}`
  - `timers/oppositionAlliance/{active,endsAt}`
  - `executiveBudget/{itemId}/{name,amount,proposerGroupId,createdAt}`
  - `npcEvents/{npc_xxx}/{scenarioId,scenarioText,persona,launchedAt}`
  - `juryVotes/{caseId}/{sid}/{choice:'guilty'|'notGuilty',groupId,at}`
  - `verdicts/{caseId}/{vid}/{decision,body,sentence,judgeGroupId,createdAt}`
- 다음 작업: 5주차 후반 — 여론판 + Phase 4 정리글 벽.

## v0.4.0 (2026-04-26)
- **3주차 — Phase 2 선거 + 베네핏 카드 시스템 완성.**
- **흐름**: 후보 등록 (모둠당 1명 + 공약 3개) → 교사가 ‘투표 시작’ → 학생 1인 1표 → 후보 카드별 아고라 토론 → 교사가 ‘종료 + 카드 분배’ → 1~6위 부여 + 가중 투표권 자동 분배 → 결과 패널 + 모둠 인벤토리 노출.
- **새 파일**:
  - `lib/election.js` — `defaultDistribution(rank)` (1위 6 / 2~3위 3 / 4~6위 2) + `calculateRanks(candidates, votes)` (안정 정렬)
  - `components/shared/BenefitCardInventory.jsx` — 4종 슬롯(weighted/super/priority/veto). 0개인 카드는 회색 ‘준비 중’ 표시. compact 모드 지원
  - `components/phase2/CandidateRegister.jsx` — 자기 모둠에서 후보 등록 (덮어쓰기 가능)
  - `components/phase2/CandidateCard.jsx` — 후보 카드 + 아고라 토론 토글(`CommentList` 재활용, `targetType:'candidate'`) + 투표 버튼 + 결과 표시
  - `components/phase2/ElectionVoteModal.jsx` — 투표 확정 모달 + 가중 투표권 사용 체크(현재 카드 0이라 비활성)
  - `components/phase2/ElectionResultPanel.jsx` — 1~6위 막대 그래프 + 분배 카드 노출
- **gameStore 추가**:
  - 상태: `electionStatus: 'idle'|'voting'|'ended'`
  - 액션: `setElectionStatus(status)`, `finalizeElection(ranks, distribute)` — `update()` 한 번에 모든 모둠의 `rank`/`inventory` + `electionStatus: 'ended'` 동시 기록
- **Phase2Page 통합**: 셸 → 실제 화면. 헤더에 상태 뱃지, 교사 컨트롤 바(준비/투표시작/종료+분배), 학생 우리모둠 박스(후보 등록 또는 등록 결과 + 인벤토리), 후보자 갤러리(2열 카드), 결과 패널.
- **TeacherDashboard 추가**: 모둠별 베네핏 카드 인벤토리 패널(등수 정렬, compact 표시).
- **데이터 스키마 추가**:
  - `rooms/{rc}/electionStatus`
  - `rooms/{rc}/candidates/{groupId}/{leaderStudentId, leaderNumber, leaderNickname, pledges:[3]}`
  - `rooms/{rc}/electionVotes/{voterStudentId}/{candidateGroupId, weighted, at}`
  - `rooms/{rc}/groups/{gid}/inventory:{super,priority,weighted,veto}`
  - `rooms/{rc}/groups/{gid}/rank`
- 다음 작업: 4주차 — Phase 3 입법·행정 (본회의·법안·야당 연합·예산·NPC 사건).

## v0.3.5 (2026-04-26)
- **디자인 토큰 추출** — `src/styles/tokens.js` 신설.
- **이유**: `COLOR_BG` 같은 토픽 색상 매핑이 `GroupJoinPanel`·`ClassroomConfigEditor` 두 곳에 똑같이 정의돼 있었고, 페이즈별 색상도 페이지마다 하드코딩. 새 페이즈/토픽 추가 시 여러 파일 동시 수정 위험.
- **포함**:
  - `TOPIC_COLOR_OPTIONS` (9종) + `TOPIC_BG`(매핑) + `topicBg(color)` 헬퍼
  - `PHASE_META[1~4]` — `label`/`short`/`pageBg`/`titleText`/`accent`
  - `CARD.base/ghost/emphasized` — 자주 쓰는 카드 클래스
- **적용**:
  - `GroupJoinPanel` — 자체 COLOR_BG 제거 → `topicBg()` 사용
  - `ClassroomConfigEditor` — COLOR_BG·COLOR_OPTIONS 모두 토큰 import
  - `RoomBar` — PHASE_LABELS 제거 → `PHASE_META` 사용
  - `PhaseGate` — 안내 화면 배경·제목 색상도 현재 페이즈에 맞춰 동적
  - `Phase1/2/3/Reflection Page` — `meta.pageBg`, `meta.titleText`, `CARD.ghost` 적용
- **앞으로의 효과**: 새 페이즈 추가 시 `PHASE_META`에 한 줄, 새 토픽 색상 추가 시 `TOPIC_BG`에 한 줄. 중복 X.
- 다음 작업: 3주차 Phase 2 진행.

## v0.3.4 (2026-04-26)
- **교사 모드 진입 암호 게이트** 추가 (기본 `12346`).
- **이유**: 학생이 실수로(또는 호기심에) 교사 모드를 누르고 들어가는 것을 방지. 클라이언트 측 게이트라 강력한 보안은 아니지만 자연스러운 분리에는 충분.
- **변경**:
  - `EntryPage`에 `mode === 'teacher_auth'` 단계 추가. ‘🔒 선생님 — 방 만들기 / 입장’ 버튼 클릭 시 암호 입력 화면이 먼저 뜸.
  - 통과 시 `sessionStorage`에 `class-democra-teacher-unlocked: '1'` 마커 저장 → 같은 브라우저 세션 동안 다시 묻지 않음(브라우저 닫으면 자동 만료).
  - 암호 상수 `TEACHER_PASSCODE`는 `import.meta.env.VITE_TEACHER_PASSCODE`로 덮어쓰기 가능. `.env.local`에 `VITE_TEACHER_PASSCODE=...` 추가하면 적용.
- `RoomBar`의 교사실 메뉴는 이미 `role === 'teacher'` 가드가 있어 학생에게는 안 보임. 시각 구분 위해 ‘👩‍🏫 교사실’로 라벨 변경.
- `TeacherDashboard` 자체 라우트 가드(role 검사)는 그대로 — URL 직접 입력 시도도 차단됨.
- 다음 작업: 3주차 Phase 2 진행.

## v0.3.3 (2026-04-25)
- **교사 방 목록 시스템**: EntryPage 교사 모드에 ‘이전에 만든 방’ 카드 리스트 + 한 클릭으로 재입장.
- **이유**: 한 교사가 여러 반(예: 7반·8반·9반)을 운영하거나, 학기 중 잠시 끊겼다가 돌아올 때 매번 새 방을 만들 필요 없게.
- **저장 방식**: 인증이 없으므로 RTDB가 아닌 **localStorage**(zustand `persist`)에 `teacherRooms: [{code, className, createdAt}]` 저장. 같은 기기·브라우저에서만 보이는 ‘내 방 목록’.
- **흐름**:
  - 새 방 만들면 자동으로 목록 맨 위에 추가(중복 제거, 최대 20개)
  - 클릭 시 RTDB `firebaseGet`으로 방 존재 확인 → 있으면 `attachListener`로 입장 / 없으면 목록에서 자동 제거 + 안내 메시지
  - `destroyRoom` 호출 시 목록에서도 자동 제거
  - `attachListener`도 방이 사라진 걸 감지하면 `leaveRoom()` + 목록 정리 (이전엔 무한 경고만 떴음)
  - ✕ 버튼으로 ‘목록에서 숨기기’(서버 데이터는 유지)
- **UI 변경**: EntryPage 교사 화면 — 이전 방 목록이 우선 노출, ‘+ 새 방 만들기’ 버튼이 그 아래. 클릭하면 학급명·설정 폼이 펼쳐짐(이전엔 항상 펼쳐져 있었음).
- **새 액션**: `enterTeacherRoom(code)`, `forgetTeacherRoom(code)`. firebase `get`을 `firebaseGet`으로 alias 추가.
- **persist**에 `teacherRooms` 추가.
- 다음 작업: 3주차 Phase 2 진행.

## v0.3.2 (2026-04-25)
- **교사가 직접 외부 링크 추가** 기능 추가. 이전엔 학생 제출 → 교사 승인 흐름만 가능했음.
- **이유**: 산업화 다큐·NotebookLM 영상·캔바 슬라이드처럼 교사가 미리 준비한 자료를 학생들에게 공유할 때, 매번 학생 명의로 우회 입력하지 않아도 되게.
- **변경**:
  - `LinkApprovalQueue` 상단에 ‘+ 선생님이 직접 추가’ 토글 펼침 폼 추가.
  - 유형 선택 라디오 3종(YouTube · Canva · 기타) + 제목(선택) + URL.
  - 교사가 추가한 링크는 `addedByTeacher: true`, `status: 'approved'`로 즉시 게시(승인 절차 없음).
  - 큐 리스트와 학생 측 `LinkBoard` 모두에서 ‘👩‍🏫 선생님 추가/공유’로 시각 구분.
  - 헤더 라벨 ‘링크 승인 큐’ → ‘링크 관리’로 변경(추가까지 포함).
- 데이터 스키마 추가: `links/{lid}/addedByTeacher: boolean`.
- 다음 작업: 3주차 Phase 2 진행.

## v0.3.1 (2026-04-25)
- **UX 개선**: 학급 인원 입력 위치를 `ClassroomConfigEditor` 내부로 이동.
- **이유**: 반마다 인원이 다를 수 있고, 번호별 지정 모드의 배정표가 학급 인원에 의존하므로 같은 자리에 놓는 게 자연스러움. 사용자 피드백 — “총 인원을 먼저 적고 그다음 번호가 나와야 한다.”
- **변경**:
  - `ClassroomConfigEditor` ② 섹션 맨 위에 ‘학급 인원’ 입력란 추가(1~40). 이 값이 바뀌면 번호 배정표가 자동으로 재구성되고, 줄어든 범위 밖 슬롯은 자동 정리.
  - `EntryPage`에서 별도 학급 인원 input 제거. config 안에 통합.
  - `TeacherDashboard`도 classSize prop 전달 제거. 모니터링 패널에 ‘학급 인원’ 표시 추가.
- 다음 작업: 3주차 Phase 2 그대로 진행.

## v0.3.0 (2026-04-25)
- **Phase 1 시민광장 — 교사 통제 시스템 추가.** 토픽·배정모드·외부 링크 모두 교사가 정한다.
- **config 시스템**:
  - `gameStore.js`에 `getDefaultConfig()` + `DEFAULT_TOPICS` 노출. config 키: `topics`, `assignmentMode('free'|'assigned')`, `assignedSlots:{번호:topicId}`, `maxPerGroup`, `linksOpen`, `classSize`
  - `createRoom(className, initialConfig)` — 방 만들 때 config 같이 저장
  - `updateConfig(partial)` — RTDB `rooms/{rc}/config` 부분 업데이트
  - `attachListener`가 config도 store로 동기화
- **새 컴포넌트**:
  - `components/teacher/ClassroomConfigEditor.jsx` — 토픽 추가/편집/삭제·기본 6종 복원·이모지·색상·자유/지정 모드·번호별 배정표·모둠당 최대 인원·외부 링크 받기 토글. EntryPage(인라인)와 TeacherDashboard(펼침) 양쪽에서 재사용.
  - `components/teacher/LinkApprovalQueue.jsx` — 학생이 제출한 링크 승인/반려/대기로/삭제. 필터(대기·승인·전체) + 카운트 뱃지.
  - `components/links/LinkSubmit.jsx` — 학생용 링크 제출 폼. URL 검사 + 자동 타입 감지(youtube/canva/vimeo/other). `config.linksOpen`이 true일 때만 화면에 표시.
  - `components/links/LinkBoard.jsx` — 승인된 링크 갤러리. YouTube는 iframe 임베드, 그 외에는 카드 + 새 탭 버튼.
- **EntryPage**: 교사 모드에 ‘학급 인원 입력’ + ‘설정 지금 정하기/나중에’ 토글. 지금 선택 시 ClassroomConfigEditor 인라인 표시(폼 max-w-3xl로 확장).
- **GroupJoinPanel**: config 기반으로 동작. `assignmentMode === 'assigned'`이면 학생 입장 시 `assignedSlots[myNumber]` 자동 합류. 자유 모드는 기존대로. 토픽이 동적이라 색상 매핑도 9종으로 확장(emerald·amber·yellow·rose·sky·violet·indigo·pink·teal).
- **TeacherDashboard 재구성**: 3컬럼(페이즈 + 학급 설정 요약 / 링크 승인 큐 / 모니터링) + 펼침형 학급 설정 편집 섹션 + 위험 영역.
- **이미지 업로드 해상도**: 800px → **1024px**, 품질 0.8 → 0.85. `image-compress.js` 기본값 변경.
- **포스터 카드**: 클릭 시 풀스크린 라이트박스로 큰 이미지 보기. Phase1Page 갤러리 그리드를 `sm:grid-cols-2 lg:grid-cols-3` → `sm:grid-cols-2`(2열)로 변경해 카드 자체도 커짐.
- **데이터 스키마 추가**:
  - `rooms/{rc}/config` — 위 키들
  - `rooms/{rc}/links/{lid}/{type, url, title, groupId, submitterStudentId, submitterNumber, submitterNickname, status:'pending'|'approved'|'rejected', createdAt, approvedAt}`
- 다음 작업: 3주차 Phase 2(선거 + 베네핏 카드).

## v0.2.1 (2026-04-25)
- **버그 수정**: `createRoom` 호출 시 “get(...).attachListener is not a function” 에러로 방 생성 실패.
- **원인**: `gameStore.js`에서 firebase의 `set`을 import하면서 zustand의 store 콜백 인자 `set`과 이름이 같아 `await set(ref(...), {...})`이 firebase set이 아니라 **zustand set(partial, replace=true)** 으로 호출됐다. zustand는 두 번째 truthy 인자를 만나면 state를 통째로 partial로 교체 → 모든 액션(`attachListener`/`leaveRoom` 등)이 사라진 채 state가 ref 객체로 대체되고, 직후 `get().attachListener(code)`가 undefined 호출.
- **해결**: firebase set만 `firebaseSet`으로 alias 통일(중복 import 제거). zustand set은 store 콜백 안에서 그대로 사용. economy_stock에서 검증된 패턴.
- **사용자 조치**: 깨진 state가 localStorage에 남아 있을 수 있어 한 번 `localStorage.clear()` 또는 시크릿 창에서 재진입 권장.
- **교훈**: zustand store 콜백에서 외부 라이브러리 함수와 이름이 같으면 무조건 alias로 임포트(특히 단어가 짧은 `set`/`get`/`update`).

## v0.2.0 (2026-04-25)
- **2주차 — Phase 1 시민광장 완성.** 학생 흐름이 처음으로 끝까지 동작: 모둠 결성 → 포스터 업로드 → 댓글+다축 평가 → 신뢰도 게이지 → 1차 여론조사 → 코어 이슈 잠금.
- **서버 업로드 인프라 가동**:
  - `<배포경로>/uploads/` 생성 (서버에서 everyone 읽기/쓰기 권한 부여)
  - `<배포경로>/업로드엔드포인트` 작성 (50줄, MIME 검사·3MB 제한·랜덤 파일명·CORS 분기)
  - 검증: curl로 1×1 PNG 업로드 → URL 반환 → 브라우저 GET 200 OK 확인 ✓
- **새 헬퍼/공유 컴포넌트**:
  - `lib/image-compress.js` — canvas로 800px·JPEG 80% 압축
  - `lib/upload-helper.js` — `https://<배포주소>/class_democra/업로드엔드포인트`로 FormData POST → URL 반환
  - `lib/rtdb-helpers.js` — `pushUnder`/`setAt`/`updateAt`/`getOnce`/`subscribe`/`removeAt` (모두 `rooms/{roomCode}/` 자동 스코프)
  - `components/shared/MultiAxisRating.jsx` — 3축(논리·실현·주제) 슬라이더, readOnly·compact 모드
  - `components/shared/TrustGauge.jsx` — 그라디언트 막대그래프
- **Phase 1 컴포넌트**:
  - `phase1/GroupJoinPanel.jsx` — 6대 영역 카드, 4명 상한, 자기 모둠은 단체명·슬로건 인라인 편집
  - `phase1/PosterUpload.jsx` — 파일 선택 → 미리보기 → 압축 → 서버 업로드 → RTDB 기록
  - `phase1/PosterCard.jsx` — 이미지 + 모둠명 + 슬로건 + 캡션 + 평균 평가 + 댓글 토글
  - `phase1/CommentList.jsx` — 텍스트 + 다축 평가, 모든 댓글은 `rooms/{roomCode}/comments` 평면 컬렉션 + targetType/targetId 필터
  - `phase1/CoreIssuePoll.jsx` — 1인1표 투표, 실시간 막대 누적, 교사가 1위 잠금
- **Phase1Page**: 셸 → 실제 화면(모둠 결성 → 우리 모둠 박스 → 포스터 갤러리 → 신뢰도 → 여론조사)
- **방어 코드**: `App.jsx`의 `attachListener` 호출 전 `typeof === 'function'` 검사 (zustand persist 첫 hydrate 시점 보호)
- **데이터 스키마 추가**:
  - `rooms/{rc}/groups/{gid}/{name, topic, slogan, members:{studentId:true}, createdAt}`
  - `rooms/{rc}/posters/{pid}/{groupId, imageUrl, caption, authorStudentId, createdAt}`
  - `rooms/{rc}/comments/{cid}/{targetType, targetId, authorStudentId, authorNumber, authorNickname, body, ratings:{logic,feasibility,relevance}, createdAt}`
  - `rooms/{rc}/polls/coreIssue/votes/{studentId}/{groupId, at}`
  - `rooms/{rc}/coreIssue` (단일 필드, 잠금 시 채워짐)
- 다음 작업: 3주차 — Phase 2 선거 + 베네핏 카드 인벤토리.

## v0.1.0 (2026-04-25)
- **1주차 셋업 완료.** 첫 동작하는 React 앱 + Firebase RTDB 연결 + 반 코드 시스템 + 6개 페이지 셸 + 라우팅까지.
- 디렉토리: `~/class_democra_dev/app/` 생성. Vite + React 19 + Tailwind v4(@tailwindcss/vite 플러그인) + Firebase + react-router-dom + zustand + lucide-react.
- 작성 파일:
  - `src/lib/firebase.js` — RTDB 초기화. `.env.local`에서 키 로드.
  - `src/store/gameStore.js` — economy_stock 패턴 기반. `createRoom`/`joinRoom`/`attachListener`/`leaveRoom`/`destroyRoom`/`setPhase`. 6자리 영숫자 반 코드 자동 생성(헷갈리는 0/O/1/I 제외). zustand persist로 새로고침 후 자동 재구독.
  - `src/components/shared/PhaseGate.jsx` — `currentPhase` 기반 라우트 게이팅. 교사 자유 접근, 학생은 `allowedPhases`/`readOnlyPhases` 외 차단.
  - `src/components/shared/RoomBar.jsx` — 상단 네비. 반 코드·학급명·페이즈·접속자 표시.
  - `src/pages/EntryPage.jsx` — 방 만들기(교사) / 방 입장(학생: 코드+번호+이름).
  - `src/pages/Phase1Page.jsx`·`Phase2Page.jsx`·`Phase3Page.jsx`·`NewsBoardPage.jsx`·`ReflectionPage.jsx`·`TeacherDashboard.jsx` — 빈 셸. 다음 주차에 채움.
  - `src/App.jsx` — BrowserRouter + 7개 라우트 + PhaseGate 적용.
  - `deploy.sh` — Vite 빌드 → `<배포경로>/app/` 복사.
- 인프라 검증: RTDB REST API로 직접 쓰기/읽기 확인 ✓. React 앱이 브라우저에서 `connection_test` 노드 작성 확인 ✓.
- **트러블 슈팅**: Vite 첫 실행 시 zustand+React 19 조합에서 `Invalid hook call` 발생. `vite.config.js`에 `resolve.dedupe: ['react','react-dom']` 추가 + `.vite` 캐시 삭제로 해결.
- **빌드 base 경로**: 프로덕션 빌드는 `/class_democra/app/` 서브 경로 기준(배포 위치). 개발은 `/`.
- 다음 작업: 2주차 — Phase 1 시민광장(모둠 결성, 포스터 업로드[서버 PHP], 댓글+다축 평가, 1차 여론조사).

## v0.0.1 (2026-04-25)
- **이미지 업로드 인프라 변경**: Firebase Storage → 서버 업로드.
- **이유**: 신규 Firebase 프로젝트는 Storage 사용에 Blaze(유료) 카드 등록이 필수가 되어 ‘완전 무료’ 원칙과 충돌.
- **대안 채택**: 사용자 서버(서버 + nginx + PHP 7.4/8.0)가 `https://<배포주소>/class_democra/`로 이미 서비스 중이고 React 앱과 같은 도메인이라 CORS 부담 0. `<배포경로>/uploads/` 폴더 + `<배포경로>/업로드엔드포인트`(10줄짜리 PHP) 추가 예정.
- 영향 받는 문서: `CLAUDE.md` §1·§2, `project_context.md` §4·§6, `implementation_plan.md` §2.2(포스터 업로드 흐름), `task.md`(Firebase Storage 활성화 항목 제거, 서버 업로드 인프라 항목 추가).
- 코드는 여전히 0줄. 다음 작업: 1단계 Firebase 셋업 마무리(RTDB만, Storage 건너뜜) → 웹 앱 등록 → config 키 확보.

## v0.0.0 (2026-04-25)
- **초기 설계 문서 골격 작성.** CLAUDE.md(개발 진입점) + docs/ 4종(`project_context.md`, `implementation_plan.md`, `history.md`, `task.md`) 생성.
- 슬림 MVP 범위 확정: 영상·NotebookLM·다큐 플레이어·블라인드 제외 / 베네핏 카드는 4종 슬롯 유지하되 ‘가중 투표권’만 활성·분배 / 야당 연합 유지 / 다축 평가 유지.
- 아키텍처 확정: Mac 로컬 개발(`~/class_democra_dev/app/`) + 서버 정적 배포(`<배포경로>/app/`) + Firebase RTDB(데이터) + Firebase Storage(포스터 이미지). Firebase Auth 미사용, 반 코드 + 번호 + 이름으로 자체 식별.
- 코드는 아직 0줄. 다음 작업: 1주차 — Vite/React/Firebase 보일러플레이트 셋업.
