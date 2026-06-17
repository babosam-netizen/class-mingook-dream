const fs = require('fs');
const historyPath = '/Volumes/web/class_democra/docs/history.md';
let history = fs.readFileSync(historyPath, 'utf8');

const newEntry = `
## v1.2.215 — 행정부 역할중심 모드 워크플로우 개편 제안서 작성 (2026-05-24 / [Antigravity])
- **[DOCS]** \`docs/proposal_executive_workflow.md\` 문서를 생성하여 역할중심 모드의 미션 중심 단일 편집기 통합, 총괄 검토원 최종 조립/편집 활성화, 교사 현황판 등 주요 개편 내용과 데이터 연동 로직을 문서로 요약.
`;

history = history.replace('## v1.2.214', newEntry.trim() + '\n\n## v1.2.214');
fs.writeFileSync(historyPath, history);

const taskPath = '/Volumes/web/class_democra/docs/task.md';
let task = fs.readFileSync(taskPath, 'utf8');
task = task.replace('- `[ ]` 행정부 워크플로우 문서화', '- `[x]` 행정부 워크플로우 문서화');
fs.writeFileSync(taskPath, task);

console.log("Docs updated.");
