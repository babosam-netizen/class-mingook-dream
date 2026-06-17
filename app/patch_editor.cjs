const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/ExecutivePolicyBudgetDraft.jsx';
let code = fs.readFileSync(path, 'utf8');

const startStr = "function ExecutiveSkeletonEditor({ sec, onSave, saving, groupId, passedBills }) {";
const endStr = "// 3단계: 정책 총괄원 최종 취합 및 병합 에디터 (대표 조립기)\n// ────────────────────────────────────────────────────────────────────────\nexport function ExecutiveFinalAssembler";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end bounds.");
  process.exit(1);
}

const newEditorCode = `// ────────────────────────────────────────────────────────────────────────
// 2단계: 개별 역할별 임무 완수 에디터 (통합형)
// ────────────────────────────────────────────────────────────────────────
export function ExecutiveSectionEditor({ roleDef, sectionKey, sec, onSave, saving, groupId, passedBills, myNoteText }) {
  const [fields, setFields] = useState(() => sec?.content?.policyFields || {
    title: '', problem: '', purpose: '', targetCitizens: '',
    ordinance: '', content: '',
    evidence: '', publicConcern: '', publicResponse: '',
    expectedEffect: '', discussionReflection: ''
  })
  const [budgetItems, setBudgetItems] = useState(() => sec?.content?.budgetItems || [])

  const patchField = (key, value) => setFields(p => ({ ...p, [key]: value }))

  const handleSave = () => {
    onSave({
      policyFields: fields,
      budgetItems,
    })
  }

  return (
    <div className="space-y-4">
      {/* 1. 미션 가이드 및 이전 메모 */}
      <div className="bg-white p-3 border border-indigo-100 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b pb-1">
          <h4 className="text-sm font-black text-indigo-900">🎯 내 역할 임무 가이드</h4>
        </div>
        {myNoteText && (
          <div className="p-2 bg-slate-50 border rounded-lg text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
            <span className="font-bold text-slate-900">📝 내 조사 메모:</span><br/>{myNoteText}
          </div>
        )}
        <div className="space-y-1.5">
          {roleDef?.memoGuide?.map((q, idx) => (
            <p key={idx} className="text-xs text-indigo-800 font-bold bg-indigo-50 px-2 py-1.5 rounded-lg">
              {q}
            </p>
          ))}
        </div>
      </div>

      {/* 2. 할당된 정책 필드 입력 */}
      <div className="bg-white p-3 border border-slate-200 rounded-xl space-y-3">
        <h4 className="text-sm font-black text-slate-800 border-b pb-1">📄 정책 초안 작성 ({roleDef?.sectionLabel})</h4>
        
        {sectionKey === 'skeleton' && (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">정책명</span>
              <input type="text" value={fields.title} onChange={e => patchField('title', e.target.value)} placeholder="정책의 정확한 명칭" className="w-full rounded border px-2 py-1.5 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">해결할 문제</span>
              <textarea value={fields.problem} onChange={e => patchField('problem', e.target.value)} placeholder="정책이 해결하고자 하는 구체적 문제 상황" rows={2} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">정책 목적</span>
              <textarea value={fields.purpose} onChange={e => patchField('purpose', e.target.value)} placeholder="문제 해결을 통해 달성하려는 최종 목적" rows={2} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">대상 시민 (수혜/규제 대상)</span>
              <input type="text" value={fields.targetCitizens} onChange={e => patchField('targetCitizens', e.target.value)} placeholder="정책의 적용 대상 (누가 이익/제한을 받는가?)" className="w-full rounded border px-2 py-1.5 text-xs" />
            </label>
          </div>
        )}

        {sectionKey === 'decree' && (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">정책 집행 절차 (계획)</span>
              <textarea value={fields.content} onChange={e => patchField('content', e.target.value)} placeholder="누가(담당 기관), 언제, 무엇을 하는지 구체적인 절차 요약" rows={4} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">제1조~제5조 시행령 초안</span>
              <textarea value={fields.ordinance} onChange={e => patchField('ordinance', e.target.value)} placeholder="제1조(목적), 제2조(대상), 제3조(시행 절차), 제4조(지원 및 예산), 제5조(점검 및 예외) 형식으로 작성" rows={5} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
          </div>
        )}

        {sectionKey === 'evidence' && (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">타당성 근거 및 사례</span>
              <textarea value={fields.evidence} onChange={e => patchField('evidence', e.target.value)} placeholder="통계, 뉴스, 모범 시행 사례 등 객관적 증명 자료 (출처 포함)" rows={4} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">시민 예상 반응 및 우려 사항</span>
              <textarea value={fields.publicConcern} onChange={e => patchField('publicConcern', e.target.value)} placeholder="이 정책에 대해 반대하거나 우려하는 시민들의 의견 예상" rows={2} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">정부의 우려 대응 계획</span>
              <textarea value={fields.publicResponse} onChange={e => patchField('publicResponse', e.target.value)} placeholder="반대 의견에 대해 정부가 제시할 보완책이나 설득 논리" rows={2} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
          </div>
        )}

        {sectionKey === 'effect' && (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">기대 효과</span>
              <textarea value={fields.expectedEffect} onChange={e => patchField('expectedEffect', e.target.value)} placeholder="정책 시행 후 시민들의 삶이 어떻게 변화하는지 구체적 수치/체감으로 예측" rows={4} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">오프라인 토론 쟁점 대비책</span>
              <textarea value={fields.discussionReflection} onChange={e => patchField('discussionReflection', e.target.value)} placeholder="예산 삭감 주장 등 타 부처나 의회의 공격에 대한 방어 논리" rows={3} className="w-full resize-none rounded border px-2 py-1 text-xs" />
            </label>
          </div>
        )}
      </div>

      {/* 3. 할당된 예산 편성 */}
      <div className="bg-white p-3 border border-emerald-200 rounded-xl space-y-3">
        <h4 className="text-sm font-black text-emerald-900 border-b border-emerald-100 pb-1">💰 예산 편성 ({roleDef?.sectionLabel} 관련)</h4>
        <ExecutiveSectionBudgetManager budgetItems={budgetItems} setBudgetItems={setBudgetItems} groupId={groupId} />
      </div>

      <div className="pt-2 text-right">
        <button type="button" onClick={handleSave} disabled={saving} className="px-5 py-2 text-xs font-black rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {saving ? '저장 중…' : '✅ 내 역할 임무 완료 및 임시저장'}
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// 2단계: 읽기 전용 뷰어
// ────────────────────────────────────────────────────────────────────────
export function ExecutiveSectionViewer({ sectionKey, sec, roleDef }) {
  const content = sec?.content
  const fields = content?.policyFields || {}
  const budgetItems = content?.budgetItems || []
  
  const textBlocks = []
  if (fields.title) textBlocks.push(\`[정책명]\n\${fields.title}\`)
  if (fields.problem) textBlocks.push(\`[해결할 문제]\n\${fields.problem}\`)
  if (fields.purpose) textBlocks.push(\`[정책 목적]\n\${fields.purpose}\`)
  if (fields.targetCitizens) textBlocks.push(\`[대상 시민]\n\${fields.targetCitizens}\`)
  if (fields.content) textBlocks.push(\`[정책 집행 절차]\n\${fields.content}\`)
  if (fields.ordinance) textBlocks.push(\`[시행령]\n\${fields.ordinance}\`)
  if (fields.evidence) textBlocks.push(\`[근거와 사례]\n\${fields.evidence}\`)
  if (fields.publicConcern) textBlocks.push(\`[우려 사항]\n\${fields.publicConcern}\`)
  if (fields.publicResponse) textBlocks.push(\`[대응 계획]\n\${fields.publicResponse}\`)
  if (fields.expectedEffect) textBlocks.push(\`[기대 효과]\n\${fields.expectedEffect}\`)
  if (fields.discussionReflection) textBlocks.push(\`[토론 대비책]\n\${fields.discussionReflection}\`)

  const text = textBlocks.join('\\n\\n')

  return (
    <div className="space-y-2">
      {text ? (
        <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed bg-white p-2 border rounded">
          {text}
        </p>
      ) : (
        <p className="text-xs text-gray-400 italic">아직 작성되지 않았습니다.</p>
      )}

      {budgetItems.length > 0 && (
        <div className="space-y-1 bg-emerald-50/50 p-2 rounded border border-emerald-100 mt-2">
          <p className="text-[10px] font-bold text-emerald-800">💰 편성 예산 항목 ({budgetItemTotal(budgetItems)}억)</p>
          <div className="space-y-1">
            {budgetItems.map((item, idx) => (
              <div key={item.id || idx} className="text-[10px] flex items-center justify-between text-slate-700 bg-white px-2 py-0.5 rounded border border-emerald-100/50">
                <span>{idx + 1}. {item.title || '(무제)'} ({item.note || '산출식 미입력'})</span>
                <span className="font-bold text-emerald-800 shrink-0">{item.amount || 0}억</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

`;

const finalCode = code.slice(0, startIndex) + newEditorCode + code.slice(endIndex);
fs.writeFileSync(path, finalCode);
console.log("Successfully replaced ExecutiveSectionEditor blocks.");
