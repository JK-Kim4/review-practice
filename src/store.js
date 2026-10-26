// 파일 기반 저장소. 작품(관람 기록) 하나당 JSON 파일 하나를 data/works/ 에 저장한다.
// 쓰기는 임시 파일에 먼저 기록한 뒤 rename 해서 중간에 끊겨도 파일이 깨지지 않게 한다.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { getExercise, WORK_TYPES, SELF_CHECKS, ESSAY_SECTIONS } = require('./exercises');

const ID_RE = /^[a-z0-9-]{1,64}$/;
const WORK_FIELDS = ['type', 'title', 'date', 'venue', 'creators', 'tags', 'memo'];
const IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

class NotFoundError extends Error {}
class ValidationError extends Error {}

function newId() {
  return crypto.randomBytes(6).toString('hex');
}

function now() {
  return new Date().toISOString();
}

function assertId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new NotFoundError('not found');
}

function str(v, max = 20000) {
  if (v === undefined || v === null) return '';
  return String(v).slice(0, max);
}

function cleanWork(input, base = {}) {
  const out = { ...base };
  for (const key of WORK_FIELDS) {
    if (!(key in input)) continue;
    if (key === 'tags') {
      const tags = Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',');
      out.tags = tags.map((t) => str(t, 50).trim()).filter(Boolean).slice(0, 20);
    } else {
      out[key] = str(input[key], key === 'memo' ? 5000 : 300).trim();
    }
  }
  if (!out.title) throw new ValidationError('작품명을 입력해 주세요.');
  if (!WORK_TYPES.some((t) => t.id === out.type)) out.type = 'etc';
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new ValidationError('관람일 형식은 YYYY-MM-DD 입니다.');
  return out;
}

function cleanAnswers(exercise, answers = {}) {
  const out = {};
  for (const f of exercise.fields) out[f.key] = str(answers[f.key]);
  return out;
}

function cleanEssay(input, base = {}) {
  const out = { ...base };
  if ('title' in input) out.title = str(input.title, 200).trim();
  if ('target' in input) out.target = Math.max(0, Math.min(5000, parseInt(input.target, 10) || 0));
  if ('sections' in input) {
    out.sections = {};
    for (const s of ESSAY_SECTIONS) out.sections[s.key] = str(input.sections?.[s.key]);
  }
  if ('checks' in input) {
    out.checks = {};
    for (const c of SELF_CHECKS) out.checks[c.key] = Boolean(input.checks?.[c.key]);
  }
  if ('sourceNoteIds' in input && Array.isArray(input.sourceNoteIds)) {
    out.sourceNoteIds = input.sourceNoteIds.filter((x) => typeof x === 'string' && ID_RE.test(x));
  }
  return out;
}

function essayText(essay) {
  return ESSAY_SECTIONS.map((s) => (essay.sections?.[s.key] || '').trim()).filter(Boolean).join('\n\n');
}

function createStore(dataDir) {
  const worksDir = path.join(dataDir, 'works');
  const uploadsDir = path.join(dataDir, 'uploads');
  const settingsFile = path.join(dataDir, 'settings.json');

  async function ensureDirs() {
    await fs.mkdir(worksDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });
  }

  async function writeJson(file, data) {
    await ensureDirs();
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, file);
  }

  async function readJson(file) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  const workFile = (id) => path.join(worksDir, `${id}.json`);

  // 같은 작품 파일에 대한 읽기-수정-쓰기를 순서대로 처리한다.
  const locks = new Map();
  function withLock(id, fn) {
    const prev = locks.get(id) || Promise.resolve();
    const next = prev.then(fn, fn);
    locks.set(id, next.catch(() => {}));
    return next;
  }

  async function getWork(id) {
    assertId(id);
    const work = await readJson(workFile(id));
    if (!work) throw new NotFoundError('not found');
    return work;
  }

  function mutate(id, fn) {
    return withLock(id, async () => {
      const work = await getWork(id);
      const result = fn(work);
      work.updatedAt = now();
      await writeJson(workFile(id), work);
      return result === undefined ? work : result;
    });
  }

  async function listWorks() {
    await ensureDirs();
    const files = (await fs.readdir(worksDir)).filter((f) => f.endsWith('.json'));
    const works = [];
    for (const f of files) {
      const w = await readJson(path.join(worksDir, f)).catch(() => null);
      if (w && w.id) works.push(w);
    }
    // 관람일(없으면 작성일) 최신순
    works.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
    return works;
  }

  async function createWork(input) {
    const ts = now();
    const work = {
      id: newId(),
      ...cleanWork(input, { type: 'etc', title: '', date: '', venue: '', creators: '', tags: [], memo: '' }),
      poster: null,
      notes: [],
      essays: [],
      createdAt: ts,
      updatedAt: ts,
    };
    await writeJson(workFile(work.id), work);
    return work;
  }

  function updateWork(id, input) {
    return mutate(id, (work) => {
      Object.assign(work, cleanWork(input, work));
    });
  }

  async function deleteWork(id) {
    const work = await getWork(id);
    await fs.rm(workFile(id), { force: true });
    if (work.poster) await fs.rm(path.join(uploadsDir, work.poster), { force: true });
  }

  async function setPoster(id, contentType, buffer) {
    const ext = IMAGE_EXT[contentType];
    if (!ext) throw new ValidationError('png, jpg, webp, gif 이미지만 올릴 수 있습니다.');
    if (!buffer || !buffer.length) throw new ValidationError('이미지가 비어 있습니다.');
    await getWork(id);
    await ensureDirs();
    const name = `${id}-${Date.now()}.${ext}`;
    await fs.writeFile(path.join(uploadsDir, name), buffer);
    let old = null;
    const work = await mutate(id, (w) => {
      old = w.poster;
      w.poster = name;
    });
    if (old) await fs.rm(path.join(uploadsDir, old), { force: true });
    return work;
  }

  // --- 연습 기록(notes) ---

  function addNote(workId, { exercise: exerciseId, answers }) {
    const exercise = getExercise(exerciseId);
    if (!exercise) throw new ValidationError('알 수 없는 연습 유형입니다.');
    return mutate(workId, (work) => {
      const ts = now();
      const note = { id: newId(), exercise: exercise.id, answers: cleanAnswers(exercise, answers), createdAt: ts, updatedAt: ts };
      work.notes.push(note);
      return note;
    });
  }

  function updateNote(workId, noteId, { answers }) {
    return mutate(workId, (work) => {
      const note = work.notes.find((n) => n.id === noteId);
      if (!note) throw new NotFoundError('not found');
      note.answers = cleanAnswers(getExercise(note.exercise), answers);
      note.updatedAt = now();
      return note;
    });
  }

  function deleteNote(workId, noteId) {
    return mutate(workId, (work) => {
      const before = work.notes.length;
      work.notes = work.notes.filter((n) => n.id !== noteId);
      if (work.notes.length === before) throw new NotFoundError('not found');
      return { ok: true };
    });
  }

  // --- 감상문(essays) ---

  function addEssay(workId, input) {
    return mutate(workId, (work) => {
      const ts = now();
      const essay = cleanEssay(
        { title: '', target: 300, sections: {}, checks: {}, sourceNoteIds: [], ...input },
        { id: newId(), createdAt: ts, updatedAt: ts },
      );
      work.essays.push(essay);
      return essay;
    });
  }

  function updateEssay(workId, essayId, input) {
    return mutate(workId, (work) => {
      const idx = work.essays.findIndex((e) => e.id === essayId);
      if (idx < 0) throw new NotFoundError('not found');
      const essay = cleanEssay(input, work.essays[idx]);
      essay.updatedAt = now();
      work.essays[idx] = essay;
      return essay;
    });
  }

  function deleteEssay(workId, essayId) {
    return mutate(workId, (work) => {
      const before = work.essays.length;
      work.essays = work.essays.filter((e) => e.id !== essayId);
      if (work.essays.length === before) throw new NotFoundError('not found');
      return { ok: true };
    });
  }

  // --- 모아보기 ---

  async function listQuestions() {
    const works = await listWorks();
    const out = [];
    for (const w of works) {
      for (const n of w.notes) {
        const ex = getExercise(n.exercise);
        if (!ex) continue;
        for (const f of ex.fields) {
          const text = (n.answers[f.key] || '').trim();
          if (f.question && text) {
            out.push({ workId: w.id, workTitle: w.title, workDate: w.date, noteId: n.id, exercise: ex.title, label: f.label, text, createdAt: n.createdAt });
          }
        }
      }
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return out;
  }

  // 지정한 기간에 한 연습/감상문 활동 목록 (루틴 진행 확인용)
  async function listActivity(fromIso) {
    const works = await listWorks();
    const out = [];
    for (const w of works) {
      for (const n of w.notes) if (n.createdAt >= fromIso) out.push({ kind: 'note', exercise: n.exercise, workId: w.id, workTitle: w.title, createdAt: n.createdAt });
      for (const e of w.essays) if (e.createdAt >= fromIso) out.push({ kind: 'essay', length: essayText(e).length, workId: w.id, workTitle: w.title, createdAt: e.createdAt });
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return out;
  }

  async function getSettings() {
    return (await readJson(settingsFile)) || { routineStart: '' };
  }

  async function updateSettings(input) {
    const settings = await getSettings();
    if ('routineStart' in input) {
      const v = str(input.routineStart, 10);
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ValidationError('날짜 형식은 YYYY-MM-DD 입니다.');
      settings.routineStart = v;
    }
    await writeJson(settingsFile, settings);
    return settings;
  }

  return {
    dataDir,
    uploadsDir,
    listWorks,
    getWork,
    createWork,
    updateWork,
    deleteWork,
    setPoster,
    addNote,
    updateNote,
    deleteNote,
    addEssay,
    updateEssay,
    deleteEssay,
    listQuestions,
    listActivity,
    getSettings,
    updateSettings,
  };
}

module.exports = { createStore, essayText, NotFoundError, ValidationError };
