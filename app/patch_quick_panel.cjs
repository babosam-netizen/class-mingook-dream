const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/teacher/Phase3ExecutiveQuickPanel.jsx';
let code = fs.readFileSync(path, 'utf8');

const oldCards = `                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {branchRoles.map((roleDef) => {
                      const studentId = Object.entries(sessionRoles).find(([, rkey]) => rkey === roleDef.key)?.[0]
                      const student = studentId ? students?.[studentId] : null
                      
                      // 1단계 메모 진척도
                      const note = studentId ? memberNotes[studentId] : null
                      const isNoteDone = note && (note.text || '').trim().length >= 10
                      const isNoteWriting = note && (note.text || '').trim().length > 0 && !isNoteDone
                      
                      // 2단계 섹션 진척도
                      const section = roleDef.assignedSection ? sections[roleDef.assignedSection] : null
                      const isSecDone = section && (section.status === 'ready' || (section.content || '').trim().length >= 20)
                      const isSecWriting = section && (section.content || '').trim().length > 0 && !isSecDone

                      return (
                        <div key={roleDef.key} className="flex flex-col bg-white border border-slate-200 rounded p-1.5 shadow-sm">
                          <div className="flex items-center gap-1 mb-1 border-b border-slate-100 pb-1">
                            <span className="text-xs">{roleDef.emoji}</span>
                            <span className="font-bold text-slate-700 text-[10px] truncate leading-tight flex-1" title={roleDef.label}>
                              {roleDef.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 truncate mb-1 text-center font-medium" title={student ? \`\${student.number}번 \${student.nickname}\` : '미배정'}>
                            {student ? \`\${student.nickname}\` : '❌ 미배정'}
                          </div>
                          {student && (
                            <div className="flex flex-col gap-0.5 text-[9px] text-center mt-auto">
                              <span className={\`px-1 py-0.5 rounded font-medium \${
                                isNoteDone ? 'bg-emerald-50 text-emerald-700' :
                                isNoteWriting ? 'bg-amber-50 text-amber-700' :
                                'bg-gray-100 text-gray-400'
                              }\`}>
                                {isNoteDone ? '메모완료' : isNoteWriting ? '메모중' : '메모대기'}
                              </span>
                              {roleDef.assignedSection && (
                                <span className={\`px-1 py-0.5 rounded font-medium \${
                                  isSecDone ? 'bg-emerald-50 text-emerald-700' :
                                  isSecWriting ? 'bg-amber-50 text-amber-700' :
                                  'bg-gray-100 text-gray-400'
                                }\`}>
                                  {isSecDone ? '초안완료' : isSecWriting ? '초안중' : '초안대기'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>`;

const newCards = `                  <div className="flex flex-wrap gap-1 mt-1">
                    {branchRoles.map((roleDef) => {
                      const studentId = Object.entries(sessionRoles).find(([, rkey]) => rkey === roleDef.key)?.[0]
                      const student = studentId ? students?.[studentId] : null
                      
                      // 통합 섹션 진척도 (이제 1단계 메모가 없으므로 2단계 초안/예산으로 통일)
                      const section = roleDef.assignedSection ? sections[roleDef.assignedSection] : null
                      // policyFields 나 budgetItems 중 하나라도 있으면 진행중으로 간주
                      const hasFields = section && typeof section.content === 'object' && Object.keys(section.content.policyFields || {}).some(k => section.content.policyFields[k].trim() !== '')
                      const hasBudgets = section && Array.isArray(section.content?.budgetItems) && section.content.budgetItems.length > 0
                      const isSecDone = section && section.status === 'ready'
                      const isSecWriting = (hasFields || hasBudgets) && !isSecDone

                      return (
                        <div key={roleDef.key} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2 py-1 flex-1 min-w-[120px]">
                          <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                            {roleDef.emoji} {roleDef.label}
                          </span>
                          <span className="text-[10px] text-gray-600 truncate flex-1">
                            {student ? \`\${student.nickname}\` : '❌ 미배정'}
                          </span>
                          {student && roleDef.assignedSection && (
                            <span className={\`text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 \${
                              isSecDone ? 'bg-emerald-100 text-emerald-700' :
                              isSecWriting ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-400'
                            }\`}>
                              {isSecDone ? '초안완료' : isSecWriting ? '작성중' : '작성대기'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>`;

code = code.replace(oldCards, newCards);
fs.writeFileSync(path, code);
console.log("Successfully patched Phase3ExecutiveQuickPanel.jsx");
