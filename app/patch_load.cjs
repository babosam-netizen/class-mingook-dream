const fs = require('fs');
const path = '/Users/babostudio/class_democra_dev/app/src/components/phase3/ExecutivePolicyBudgetDraft.jsx';
let code = fs.readFileSync(path, 'utf8');

const oldFunc = `  const loadPreviewToEditor = () => {
    const skeletonData = sections.skeleton?.content
    const decreeText = sections.decree?.content?.text || sections.decree?.content || ''
    const evidenceText = sections.evidence?.content?.text || sections.evidence?.content || ''
    const effectText = sections.effect?.content?.text || sections.effect?.content || ''
    const discussionText = sections.discussion?.content?.text || sections.discussion?.content || ''
    const risksText = sections.risks?.content?.text || sections.risks?.content || ''
    const budgetText = sections.budget?.content?.text || sections.budget?.content || ''

    // 텍스트 매핑
    const baseFields = skeletonData?.policyFields || { ...emptyPolicyFields }
    const mergedFields = {
      ...emptyPolicyFields,
      ...baseFields,
      ordinance: decreeText,
      evidence: evidenceText,
      discussionReflection: discussionText,
      expectedEffect: effectText || risksText,
      finalScale: budgetText,
    }
    setFields(mergedFields)

    // 예산 목록 병합 (중복 방지를 위해 ID 기준으로 병합)
    const allBudgets = []
    const idSet = new Set()
    Object.values(sections).forEach((sec) => {
      const items = sec?.content?.budgetItems || []
      items.forEach((item) => {
        if (!idSet.has(item.id)) {
          idSet.add(item.id)
          allBudgets.push({ ...item })
        }
      })
    })

    setBudgetItems(allBudgets)
    alert('부서원들이 작성한 모든 초안 텍스트와 예산 항목을 성공적으로 취합하였습니다.')
  }`;

const newFunc = `  const loadPreviewToEditor = () => {
    const allFields = { ...emptyPolicyFields }
    
    // 각 역할의 policyFields 병합
    Object.values(sections).forEach(sec => {
      const fields = sec?.content?.policyFields
      if (fields) {
        Object.keys(fields).forEach(k => {
          if (fields[k]) allFields[k] = fields[k]
        })
      }
    })
    
    setFields(allFields)

    // 예산 목록 병합 (중복 방지를 위해 ID 기준으로 병합)
    const allBudgets = []
    const idSet = new Set()
    Object.values(sections).forEach((sec) => {
      const items = sec?.content?.budgetItems || []
      items.forEach((item) => {
        if (!idSet.has(item.id)) {
          idSet.add(item.id)
          allBudgets.push({ ...item })
        }
      })
    })

    setBudgetItems(allBudgets)
    alert('부서원들이 작성한 모든 초안 텍스트와 예산 항목을 성공적으로 취합하였습니다.')
  }`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync(path, code);
console.log("Successfully updated loadPreviewToEditor");
