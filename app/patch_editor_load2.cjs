const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/ExecutivePolicyBudgetDraft.jsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const isLoaded = React.useRef(false)",
  "const isLoaded = useRef(false)"
);

fs.writeFileSync(path, code);
console.log("Patched useEffect in ExecutiveSectionEditor to use useRef");
