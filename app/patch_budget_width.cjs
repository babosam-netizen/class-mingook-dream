const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/ExecutivePolicyBudgetDraft.jsx';
let code = fs.readFileSync(path, 'utf8');

// The line is: <input id="unitCost" type="text" inputmode="numeric" value="${initUnitCostVal ? initUnitCostVal.toLocaleString() : '0'}" ${canApply ? '' : 'disabled'} style="text-align:right;width:100%;box-sizing:border-box;" />
code = code.replace(
  `style="text-align:right;width:100%;box-sizing:border-box;"`,
  `style="text-align:right;width:100%;box-sizing:border-box;font-size:16px;padding:6px;font-weight:bold;letter-spacing:1px;border:1px solid #cbd5e1;border-radius:4px;"`
);

// also for targetCount: style="flex:1;min-width:0;"
code = code.replace(
  `style="flex:1;min-width:0;"`,
  `style="flex:1;min-width:0;font-size:14px;padding:6px;border:1px solid #cbd5e1;border-radius:4px;"`
);

// totalKorean styling
code = code.replace(
  `style="font-size:12px;color:#888;"`,
  `style="font-size:14px;color:#059669;font-weight:bold;"`
);

// totalWon styling
code = code.replace(
  `id="totalWon"`,
  `id="totalWon" style="font-size:18px;color:#059669;"`
);

fs.writeFileSync(path, code);
console.log("Successfully patched budget input widths and styles.");
