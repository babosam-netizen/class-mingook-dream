const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/ExecutivePolicyBudgetDraft.jsx';
let code = fs.readFileSync(path, 'utf8');

const bridgeStart = "// ────────────────────────────────────────────────────────────────────────\n// 기존 공동작업 모드 하이브리드 지원 및 단일 에디터 브릿지\n// ────────────────────────────────────────────────────────────────────────\nexport function ExecutiveSectionEditor({ sectionKey, sec, onSave, saving, groupId, passedBills, myNoteText }) {";
const bridgeEnd = "\n}\n\nexport function ExecutivePolicyBudgetDraft({ groupId }) {";

const startIndex = code.indexOf(bridgeStart);
if (startIndex !== -1) {
  const endIndex = code.indexOf(bridgeEnd, startIndex);
  if (endIndex !== -1) {
    code = code.slice(0, startIndex) + code.slice(endIndex + 2); // Keep the newline before export
    fs.writeFileSync(path, code);
    console.log("Successfully removed old bridge.");
  } else {
    console.log("Could not find bridge end.");
  }
} else {
  console.log("Could not find bridge start.");
}
