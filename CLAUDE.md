# 민국이의 꿈 프로젝트 — 개발 명세 (CLAUDE.md)

> 초등 6-1 주제통합(국어+사회) 20차시 수업용 시뮬레이션 웹앱.
> 교실을 ‘작은 대한민국’으로 만들어 시민단체 → 선거 → 입법·행정·사법 → 여론 형성을 학생들이 직접 굴리도록 한다.

이 문서는 Claude Code가 작업 시작 시 가장 먼저 읽는 진입 문서다. **상세 PRD·시스템 설계·진행 상황은 `docs/` 폴더에 분리되어 있다.** 본 문서는 ‘어디를 봐야 하는지’와 ‘반드시 지켜야 할 작업 규칙’만 담는다.


---

## 1. 디렉토리 구조 (개발/배포 분리)

> **⚠️ 배포 방식 변경(2026-07-10):** 앱 배포는 더 이상 NAS(`deploy.sh` + `dist/` 수동 복사) 방식을 쓰지 않는다. **이 GitHub 저장소(main 브랜치)에 `git push`하면 연결된 정적 호스팅(Cloudflare Pages 등)에서 자동으로 빌드·배포된다.** 즉 코드 변경 완료 → 커밋 → `git push`까지만 하면 배포가 끝나며, `npm run build`를 로컬에서 수동 실행하거나 NAS `app/` 폴더에 산출물을 복사할 필요가 없다. `uploads/`(레거시 이미지)와 `fetch_meta.php`(PHP 필요)만 여전히 NAS에서 서비스된다.

economy_stock에서 검증된 패턴을 그대로 따른다. **배포 폴더에서 직접 npm install 금지** — node_modules 병목과 심볼릭 링크 에러가 발생한다.

| 경로 | 역할 |
|---|---|
| `~/class_democra_dev/app/` (또는 이 저장소의 `app/`) | **로컬 개발 환경**. Vite 개발 서버·`npm install`·코드 편집·git 커밋/푸시 모두 여기서 |
| GitHub 저장소 main 브랜치 | **배포 트리거**. `git push` 시 연결된 정적 호스팅이 자동으로 빌드·배포 (수동 `dist/` 복사 불필요) |
| `<배포경로>/uploads/` | **레거시 이미지 보관 폴더(NAS)**. 과거 업로드된 포스터·증거 사진 표시용으로만 유지(신규 업로드 없음). ⚠️ 삭제 금지 |
| ~~`업로드엔드포인트`~~ | **제거됨**(v1.7.33). 이미지 업로드 기능 폐지 — 포스터·증거는 Canva 임베드/이미지 URL로 처리 |
| `<배포경로>/fetch_meta.php` | 링크 미리보기 메타 추출 PHP(선택, NAS에서 계속 서비스). 실패 시 microlink로 자동 fallback |
| `<배포경로>/docs/` | **문서 저장소**. PRD, 컨텍스트, 변경 히스토리, 작업 큐 |
| `<배포경로>/CLAUDE.md` | 본 문서. 작업 진입점 |

옛 `deploy.sh`(빌드 → `dist/` 복사) 스크립트는 더 이상 사용하지 않는다(과거 기록은 6절 참조).

## 2. 기술 스택 (확정)

- React 19 + Vite + Tailwind CSS + Zustand + React Router
- **Firebase Realtime Database**(데이터)
- **이미지 업로드 서버 없음**(v1.7.33~). 포스터·사법부 증거는 **Canva 임베드 또는 이미지 직접 주소(URL) 붙여넣기**로 처리 → 업로드 백엔드 불필요(정적 호스팅·포크 배포에서 그대로 작동). 과거 `업로드엔드포인트`(서버 PHP)는 폐지.
- Firebase Auth·Storage는 **사용 안 함** — 데이터는 RTDB, 이미지는 Canva/URL
- 학생 인증: 반 코드 + 번호 + 이름으로 자체 식별
- 호스팅: **Cloudflare Pages 등 정적 호스팅에 이 GitHub 저장소를 연결 — main 브랜치 `git push` 시 자동 빌드·배포**(2026-07-10부터, NAS 수동 배포는 더 이상 사용 안 함). 포크본도 동일한 방식으로 각자 호스팅에 연결하면 됨

economy_stock의 `package.json`·`src/lib/firebase.js`·`src/store/gameStore.js` 패턴을 베이스로 시작한다.

## 3. 핵심 데이터 구조 (반별 격리)

```
rooms/
  {roomCode}/                        ← 6자리 영숫자 반 코드 (예: AB3C5)
    className: "6학년 9반"
    currentPhase: 1                  ← 1~4
    currentSession: 1                ← 1~20
    coreIssue: "플라스틱 쓰레기"     ← Phase 1 종료 시 잠금
    config: { ... }                  ← 학급 인원·카드 분배 등
    students/{studentId}/ { number, nickname, groupId, isOnline }
    groups/{groupId}/ { name, topic, members, inventory, trustScore, rank }
    posters/{posterId}/ { groupId, imageUrl, slogan, createdAt }
    bills/{billId}/ { title, body, proposerGroupId, status, voteResult }
    articles/{articleId}/ { headline, body, perspective, targetSession,
                             authorGroupId, status, ratings, comments/{} }
    reflections/{reflectionId}/ { authorStudentId, body, status, empathyCount, comments/{} }
    votes/{voteId}/ { voterStudentId, targetType, targetId, choice, weightedCardUsed }
    alliances/{allianceId}/ { groupA, groupB, formedAt, expiresAt, isActive }
    timers/oppositionAlliance: { active, endsAt }
    activityLog/{logId}/ { type, actorId, payload, timestamp }
```

**베네핏 카드 인벤토리는 4종 슬롯**으로 만들되 현재는 `weighted`만 분배한다(나중에 4종 확장 시 코드 수정 없이 config만 바꿔서 활성화):
```
inventory: { super: 0, priority: 0, weighted: 6, veto: 0 }   ← 데이터 구조 예시 (분배 수치는 config로 조정)
```
분배 방식(순위 기반·전 모둠 동등 등)은 수업 진행에 따라 달라질 수 있다. `config.benefitCardDistribution`으로 주입하므로 코드 변경 없이 수업 방식에 맞게 조정한다.

## 4. 슬림 MVP 범위 (이번 빌드)

상세는 `docs/implementation_plan.md` 참조. 여기는 요약만.

**포함:**
- 4페이즈 게이팅(시민광장 → 선거 → 국정포털[입법·행정·사법] → 시사회)
- 시민광장: 포스터(Canva 임베드/이미지 링크) + 댓글 + 다축 별점(논리·실현·주제)
- 선거: 후보 카드 + 1인1표 투표 + 결과 발표 + 카드 분배 애니메이션
- **베네핏 카드(가중 투표권만 활성)** + 4종 슬롯 데이터 구조
- **야당 연합**: 1분 타이머 + [연합 선언] 버튼 + 카드 합산 + 띠배너
- 본회의: 법안 + 토론 댓글 + 의결 투표(+ 카드 사용 모달)
- 여론판: 헤드라인 + 본문 + 관점(비판/옹호/중립) + 교사 승인 → 게시
- 댓글: 텍스트 + 다축 평가
- 정리글 벽: 패들렛 스타일 카드 + 공감 이모지
- 교사 대시보드: 페이즈 전환 + 승인 큐 + config 편집 + 모니터링
- **반별 격리**: `rooms/{roomCode}/` 트리

**제외(지금은):**
- 영상·다큐멘터리 플레이어 (영상은 교사가 따로 TV로 송출)
- NotebookLM AI 피고인 영상 임베드
- 블라인드 프리미엄 (그냥 일반 투표)
- 베네핏 카드 4종 중 3종(super/priority/veto) — 슬롯만 두고 분배 0
- Firebase Auth (반 코드+이름·번호로 자체 처리)

## 5. docs/ 운영 규칙 (필수 — 모든 작업·수정 시 적용)

**왜:** 토큰 한도로 새 세션이 열려도 즉시 컨텍스트를 회복하고, 변경 내역을 잃지 않으며, 다음 작업자(또는 다음 세션의 자신)에게 충분한 정보를 전달하기 위해. economy_stock에서 검증된 패턴.

### 5.1 docs/ 폴더 구성

| 파일 | 용도 | 갱신 시점 |
|---|---|---|
| `project_context.md` | **세션 진입 시 가장 먼저 읽는 컨텍스트 회복 문서.** 현재 버전·진행 상황·필수 규칙·최근 결정 요약 | 의미 있는 작업 단위가 끝날 때마다 |
| `dev_guidelines.md` | **코딩 패턴·구조 규칙.** Zustand 셀렉터·RTDB 구독·모듈화 패턴·배포·Dead code 등 실전 검증 가이드 | 패턴 추가·변경 시 |
| `implementation_plan.md` | 초기 설계 PRD. 의도·제약·결정 배경 보존용 (실제 구현과 차이 있을 수 있음) | 설계 의도 자체가 바뀔 때만 |
| `history.md` | 변경 내역(changelog). 버전·날짜·변경 요약 | **모든 의미 있는 변경 후 즉시** |
| `task.md` | 진행 중 작업 큐. 다음에 할 일·블로커·결정 대기 항목 | 작업 시작·완료 시점마다 |
| `proposal_*.md` | 큰 시스템 변경 제안서 (현재: proposal_design_v4.md, proposal_v3_scaffolding.md) | 새 제안 시 새 파일 |

### 5.2 작업 시 반드시 따르는 절차

**작업을 시작할 때:**
1. `docs/project_context.md`를 먼저 읽는다 (현재 상태·규칙 회복).
2. `docs/task.md`에서 다음에 할 작업을 확인한다.
3. PRD 관련 작업이라면 `docs/implementation_plan.md`의 해당 섹션도 확인.

**작업을 마칠 때:**
1. `docs/history.md`에 변경 내역 1줄 이상 추가 — **반드시 `[도구]` 라벨 포함** (예: `## v0.9.xx (날짜) [Claude] — 요약`). 규칙은 섹션 5.4 참조.
2. 의미 있는 진척이 있었다면 `docs/project_context.md`의 ‘진행 상황 요약’ 갱신.
3. 다음에 할 일이 명확해졌다면 `docs/task.md`에 기록.
4. 새로운 시스템 변경 제안이 있다면 `docs/proposal_*.md`로 별도 작성 후 `task.md`에서 참조.
5. 새로운 코딩 패턴을 확립했다면 `docs/dev_guidelines.md`에 추가.

**큰 변경(데이터 스키마·페이즈 구조·인증 방식 등) 시:**
1. 먼저 `docs/proposal_*.md`로 변경 의도·영향·대안을 작성.
2. 사용자 확인 후 코드 변경.
3. 변경 완료 후 `implementation_plan.md`·`history.md`·`project_context.md` 모두 갱신.

### 5.3 문서 작성 원칙

- **모든 문서는 한글로 작성**(코드 주석·변수명·커밋 메시지 제외).
- 각 문서 상단에 마지막 갱신 일자와 현재 버전 명시.
- `history.md`는 **시간 역순**(최신이 위).
- 토큰을 아끼기 위해 ‘무엇을 했는지’보다 ‘왜 그렇게 했는지’와 ‘다음 세션이 알아야 할 것’을 우선 기록.

### 5.4 history.md 코딩 도구 라벨 규칙 (필수)

`history.md` 항목 헤더에 반드시 사용한 코딩 도구를 라벨로 표기한다.

```
## v버전 (날짜) [도구] — 변경 요약
```

| 라벨 | 의미 |
|---|---|
| `[Claude]` | Claude Code (CLI) 세션 |
| `[Codex]` | OpenAI Codex 세션 |
| `[Antigravity]` | Anthropic Antigravity 세션 |
| `[Codex+Claude]` | 두 도구가 같은 버전에서 함께 작업 |

- 도구를 알 수 없는 레거시 항목은 라벨 없이 그대로 둔다 (강제 소급 불필요).
- 별도 도구 히스토리 파일(codex_history.md 등)의 내용은 작업 완료 후 이 파일에 통합하고, 원본은 간략하게 정리 보존한다.

## 6. 초기 셋업 기록 (✅ 완료)

> **이 섹션은 역사 기록용입니다.** 초기 설정은 2026-04-25에 완료되었습니다.
> 새 세션에서는 `docs/project_context.md`부터 읽으세요.

초기 셋업에서 확정된 주요 결정:
- TypeScript 대신 **JavaScript** 선택 (economy_stock과 동일)
- Firebase Storage 대신 **서버 업로드** 선택 (Blaze 카드 등록 불필요) → **이후 폐지(v1.7.33)**: 업로드 기능 제거, 포스터·증거를 Canva/이미지 URL로 전환
- Vite + React 19 + Tailwind v4 + Zustand persist + HashRouter
- `deploy.sh`: 로컬 빌드 → 배포 폴더 `dist/` 복사 (서버 직접 npm install 금지)

---

**참고 자료:**
- 원본 기획서(상세 v2): `<원본 기획서 경로>`
- 유사 프로젝트(스택·구조 참조): `<유사 프로젝트 경로>`
