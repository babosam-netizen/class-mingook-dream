const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/ExecutiveTab.jsx';
let code = fs.readFileSync(path, 'utf8');

// (key, sec, onSave, saving, myNoteText) => (...)
// We need to add `roleDef` at the end
code = code.replace(
  '(key, sec, onSave, saving, myNoteText) => (',
  '(key, sec, onSave, saving, myNoteText, roleDef) => ('
);

// <ExecutiveSectionEditor sectionKey={key} sec={sec} onSave={onSave} saving={saving} groupId={unit.groupId} passedBills={passedBills} myNoteText={myNoteText} />
// We need to pass `roleDef={roleDef}`
code = code.replace(
  '<ExecutiveSectionEditor\n            sectionKey={key}\n            sec={sec}\n            onSave={onSave}\n            saving={saving}\n            groupId={unit.groupId}\n            passedBills={passedBills}\n            myNoteText={myNoteText}\n          />',
  '<ExecutiveSectionEditor\n            roleDef={roleDef}\n            sectionKey={key}\n            sec={sec}\n            onSave={onSave}\n            saving={saving}\n            groupId={unit.groupId}\n            passedBills={passedBills}\n            myNoteText={myNoteText}\n          />'
);

// (key, sec) => <ExecutiveSectionViewer sectionKey={key} sec={sec} />
// We need to add `roleDef`
code = code.replace(
  '(key, sec) => <ExecutiveSectionViewer sectionKey={key} sec={sec} />',
  '(key, sec, roleDef) => <ExecutiveSectionViewer sectionKey={key} sec={sec} roleDef={roleDef} />'
);

fs.writeFileSync(path, code);
console.log("Successfully patched ExecutiveTab.jsx");
