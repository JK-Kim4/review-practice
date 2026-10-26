// 감상 한 편을 Markdown 문서로 내보낸다.

const { CATEGORIES, CAPTURE_FIELDS, QUESTION_FIELDS, WHY_LABEL } = require('./content');
const { composeBody } = require('./store');

function reviewToMarkdown(r) {
  const category = (CATEGORIES.find((c) => c.id === r.category) || { label: '기타' }).label;
  const lines = [`# ${r.compose.title || r.title}`, ''];
  const meta = [['작품', r.title], ['분류', category], ['관람일', r.date], ['장소', r.venue]].filter(([, v]) => v);
  for (const [k, v] of meta) lines.push(`- **${k}**: ${v}`);

  const body = composeBody(r);
  if (body) lines.push('', body);

  if (r.question.remaining.trim()) lines.push('', `> 남은 질문: ${r.question.remaining.trim()}`);

  const materials = [];
  for (const f of CAPTURE_FIELDS) {
    const v = r.capture[f.key].trim();
    if (v) materials.push(`- **포착 · ${f.label}** ${v}`);
  }
  for (const f of QUESTION_FIELDS) {
    if (f.key === 'remaining') continue;
    const v = r.question[f.key].trim();
    if (v) materials.push(`- **질문 · ${f.short}** ${v}`);
    if (f.key === 'emotion') {
      for (const w of r.question.whys) if (w.trim()) materials.push(`- **질문 · ${WHY_LABEL}** ${w.trim()}`);
    }
  }
  if (materials.length) lines.push('', '## 재료', '', ...materials.map((m) => m.replace(/\n/g, '\n  ')));
  return lines.join('\n') + '\n';
}

module.exports = { reviewToMarkdown };
