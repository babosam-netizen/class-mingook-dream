const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/BranchUnitWorkspace.jsx';
let code = fs.readFileSync(path, 'utf8');

// We want to hide the memo section for executive role-based.
// It starts with:
// {/* ══════════════════════════════════════════
//     1단계: 작성자 메모 카드 & 참고 자료 (lg:col-span-1)
// ══════════════════════════════════════════ */}
// {!isCollaborative && (
//   <div className="lg:col-span-1 space-y-4">

// We change `{!isCollaborative && (` to `{!isCollaborative && branch !== 'executive' && (`

code = code.replace(
  "{/* ══════════════════════════════════════════\n          1단계: 작성자 메모 카드 & 참고 자료 (lg:col-span-1)\n      ══════════════════════════════════════════ */}\n      {!isCollaborative && (",
  "{/* ══════════════════════════════════════════\n          1단계: 작성자 메모 카드 & 참고 자료 (lg:col-span-1)\n      ══════════════════════════════════════════ */}\n      {!isCollaborative && branch !== 'executive' && ("
);

// We need to change the grid layout so the rest takes full width if memo is hidden.
// <div className="lg:col-span-3 space-y-4"> -> <div className={`space-y-4 ${!isCollaborative && branch !== 'executive' ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
code = code.replace(
  '<div className="lg:col-span-3 space-y-4">',
  '<div className={`space-y-4 ${!isCollaborative && branch !== \'executive\' ? \'lg:col-span-3\' : \'lg:col-span-4\'}`}>'
);

// We need to pass `roleDef` to the custom renderers.
// renderCustomSectionEditor(key, sec, (data) => saveSection(key, data), sectionSaving[key], myNote.text)
// -> renderCustomSectionEditor(key, sec, (data) => saveSection(key, data), sectionSaving[key], myNote.text, roleDef)

code = code.replace(
  'renderCustomSectionEditor(key, sec, (data) => saveSection(key, data), sectionSaving[key], myNote.text)',
  'renderCustomSectionEditor(key, sec, (data) => saveSection(key, data), sectionSaving[key], myNote.text, roleDef)'
);

// renderCustomSectionViewer(key, sec)
// -> renderCustomSectionViewer(key, sec, roleDef)
code = code.replace(
  'renderCustomSectionViewer(key, sec)',
  'renderCustomSectionViewer(key, sec, roleDef)'
);

fs.writeFileSync(path, code);
console.log("Successfully patched BranchUnitWorkspace.jsx");
