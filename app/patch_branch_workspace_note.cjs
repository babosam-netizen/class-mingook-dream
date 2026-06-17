const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/BranchUnitWorkspace.jsx';
let code = fs.readFileSync(path, 'utf8');

// remove note-related stuff for Executive
const noteStart = `                {/* === 메모 쓰기 컴포넌트 === */}`;
const noteEnd = `                  </div>
                )}
              </div>
            )}
          </div>`;

// we will hide the whole Note component for executive
code = code.replace(
  `{myRoleKey && !isCollaborative && (`,
  `{myRoleKey && !isCollaborative && branch !== 'executive' && (`
);

// make sure noteComplete is bypassed for executive
code = code.replace(
  `const currentStep = isLocked ? 2 : noteComplete ? 1 : 0`,
  `const currentStep = isLocked ? 2 : (branch === 'executive' || noteComplete) ? 1 : 0`
);

fs.writeFileSync(path, code);
console.log("Patched BranchUnitWorkspace.jsx to hide note section for executive");
