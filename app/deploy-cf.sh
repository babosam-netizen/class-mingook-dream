#!/bin/bash
# 민국이의 꿈 — Cloudflare Pages 직접 배포 스크립트 (Git 불필요)
# 사용: ~/class_democra_dev/app/deploy-cf.sh
#
# 흐름:
#   1) 로컬에서 Vite 빌드 (dist/ 생성)
#   2) Wrangler로 dist/ 를 Cloudflare Pages에 직접 업로드(direct upload)
#   3) 끝나면 배포 URL(...pages.dev) 출력
#
# ── 최초 1회 준비 (둘 중 하나) ─────────────────────────────────────
#   A) 브라우저 로그인:  npx wrangler login   (한 번만, 브라우저로 인증)
#   B) API 토큰 사용:    export CLOUDFLARE_API_TOKEN=xxxx  (Pages:Edit 권한 토큰)
# ────────────────────────────────────────────────────────────────
#
# 데이터는 Firebase RTDB라 호스팅과 무관 — 같은 .env.local 값을 쓰면 동일 데이터에 접속.

set -e

cd "$(dirname "$0")"

PROJECT_NAME="${CF_PAGES_PROJECT:-class-democra}"

echo "🔨 빌드 시작..."
npm run build

echo ""
echo "☁️  Cloudflare Pages 업로드 (project: $PROJECT_NAME)"
# 프로젝트가 없으면 최초 1회 생성 (이미 있으면 무시)
npx wrangler pages project create "$PROJECT_NAME" --production-branch main 2>/dev/null || true

npx wrangler pages deploy dist --project-name "$PROJECT_NAME" --branch=main --commit-dirty=true

echo ""
echo "✅ Cloudflare 배포 완료!"
echo "👉 위에 출력된 https://<...>.pages.dev 주소에서 확인"
