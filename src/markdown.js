// 작품 하나의 기록을 Markdown 문서로 내보낸다.

const { getExercise, WORK_TYPES, SELF_CHECKS } = require('./exercises');
const { essayText } = require('./store');

function typeLabel(type) {
  return (WORK_TYPES.find((t) => t.id === type) || { label: '기타' }).label;
}

function day(iso) {
  return (iso || '').slice(0, 10);
}

function workToMarkdown(work) {
  const lines = [`# ${work.title}`, ''];
  const meta = [
    ['종류', typeLabel(work.type)],
    ['관람일', work.date],
    ['장소', work.venue],
    ['작가·제작진', work.creators],
    ['태그', (work.tags || []).join(', ')],
  ].filter(([, v]) => v);
  for (const [k, v] of meta) lines.push(`- **${k}**: ${v}`);
  if (work.poster) lines.push('', `![포스터·티켓](../uploads/${work.poster})`);
  if (work.memo) lines.push('', '## 메모', '', work.memo);

  if (work.essays.length) {
    lines.push('', '## 감상문');
    for (const e of work.essays) {
      const body = essayText(e);
      lines.push('', `### ${e.title || '제목 없음'} (${day(e.createdAt)}, ${body.length}자)`, '', body || '_(비어 있음)_');
      const checked = SELF_CHECKS.filter((c) => e.checks?.[c.key]).map((c) => c.label);
      if (checked.length) lines.push('', `> 자기 점검: ${checked.join(' · ')}`);
    }
  }

  if (work.notes.length) {
    lines.push('', '## 연습 기록');
    for (const n of work.notes) {
      const ex = getExercise(n.exercise);
      if (!ex) continue;
      lines.push('', `### ${ex.title} (${day(n.createdAt)})`, '');
      for (const f of ex.fields) {
        const v = (n.answers[f.key] || '').trim();
        if (v) lines.push(`- **${f.label}** ${v.replace(/\n/g, '\n  ')}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

module.exports = { workToMarkdown };
