const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/ExecutivePolicyBudgetDraft.jsx';
let code = fs.readFileSync(path, 'utf8');

const oldEffect = `  // 초기화 시 sec 데이터 적용 (최초 한 번 또는 sec가 없을 때 들어온 경우)
  useEffect(() => {
    if (sec?.content) {
      if (sec.content.policyFields) {
        setFields(sec.content.policyFields)
      }
      if (Array.isArray(sec.content.budgetItems)) {
        setBudgetItems(sec.content.budgetItems)
      }
    }
  }, [sec])`;

const newEffect = `  // 초기화 시 sec 데이터 적용
  const isLoaded = React.useRef(false)
  useEffect(() => {
    if (sec?.content && !isLoaded.current) {
      if (sec.content.policyFields) {
        setFields(sec.content.policyFields)
      }
      if (Array.isArray(sec.content.budgetItems)) {
        setBudgetItems(sec.content.budgetItems)
      }
      isLoaded.current = true
    }
  }, [sec])`;

code = code.replace(oldEffect, newEffect);
fs.writeFileSync(path, code);
console.log("Patched useEffect in ExecutiveSectionEditor");
