// 파일 기반 저장소. 감상 한 편당 JSON 파일 하나를 data/reviews/ 에 저장한다.
// 쓰기는 임시 파일에 먼저 기록한 뒤 rename 해서 중간에 끊겨도 파일이 깨지지 않게 한다.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { CATEGORIES, STAGES, CAPTURE_FIELDS, QUESTION_FIELDS, COMPOSE_SECTIONS, MAX_WHYS } = require('./content');

const ID_RE = /^[a-f0-9]{12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class NotFoundError extends Error {}
class ValidationError extends Error {}

const now = () => new Date().toISOString();

function str(v, max = 20000) {
  if (v === undefined || v === null) return '';
  return String(v).slice(0, max);
}

function pickText(input, keys, base) {
  const out = { ...base };
  if (!input || typeof input !== 'object') return out;
  for (const k of keys) if (k in input) out[k] = str(input[k]);
  return out;
}

function emptyReview() {
  return {
    capture: Object.fromEntries(CAPTURE_FIELDS.map((f) => [f.key, ''])),
    question: { scene: '', whys: [], ...Object.fromEntries(QUESTION_FIELDS.map((f) => [f.key, ''])) },
    compose: { title: '', ...Object.fromEntries(COMPOSE_SECTIONS.map((s) => [s.key, ''])) },
  };
}

// 입력 중 허용된 칸만 골라 기존 값에 병합한다.
function applyPatch(review, input) {
  if ('category' in input) {
    if (!CATEGORIES.some((c) => c.id === input.category)) throw new ValidationError('알 수 없는 분류입니다.');
    review.category = input.category;
  }
  if ('title' in input) {
    const title = str(input.title, 200).trim();
    if (!title) throw new ValidationError('작품명을 입력해 주세요.');
    review.title = title;
  }
  if ('date' in input) {
    const date = str(input.date, 10);
    if (date && !DATE_RE.test(date)) throw new ValidationError('관람일 형식은 YYYY-MM-DD 입니다.');
    review.date = date;
  }
  if ('venue' in input) review.venue = str(input.venue, 200).trim();
  if ('stage' in input) {
    if (!STAGES.some((s) => s.id === input.stage)) throw new ValidationError('알 수 없는 단계입니다.');
    review.stage = input.stage;
  }
  if ('status' in input) {
    if (!['draft', 'done'].includes(input.status)) throw new ValidationError('알 수 없는 상태입니다.');
    if (input.status === 'done' && review.status !== 'done') review.completedAt = now();
    review.status = input.status;
  }
  if ('capture' in input) review.capture = pickText(input.capture, CAPTURE_FIELDS.map((f) => f.key), review.capture);
  if ('question' in input) {
    const q = input.question || {};
    review.question = pickText(q, ['scene', ...QUESTION_FIELDS.map((f) => f.key)], review.question);
    if ('whys' in q) {
      review.question.whys = (Array.isArray(q.whys) ? q.whys : []).slice(0, MAX_WHYS).map((w) => str(w));
    }
  }
  if ('compose' in input) {
    review.compose = pickText(input.compose, ['title', ...COMPOSE_SECTIONS.map((s) => s.key)], review.compose);
    review.compose.title = review.compose.title.slice(0, 200);
  }
  return review;
}

function composeBody(review) {
  return COMPOSE_SECTIONS.map((s) => (review.compose?.[s.key] || '').trim()).filter(Boolean).join('\n\n');
}

function createStore(dataDir) {
  const dir = path.join(dataDir, 'reviews');
  const fileOf = (id) => path.join(dir, `${id}.json`);

  async function writeJson(file, data) {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, file);
  }

  // 같은 감상 파일에 대한 읽기-수정-쓰기를 순서대로 처리한다.
  const locks = new Map();
  function withLock(id, fn) {
    const next = (locks.get(id) || Promise.resolve()).then(fn, fn);
    locks.set(id, next.catch(() => {}));
    return next;
  }

  async function get(id) {
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new NotFoundError('not found');
    try {
      return JSON.parse(await fs.readFile(fileOf(id), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') throw new NotFoundError('not found');
      throw err;
    }
  }

  async function list() {
    let files;
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    const reviews = [];
    for (const f of files) {
      try {
        const r = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
        if (r && r.id) reviews.push(r);
      } catch { /* 깨진 파일은 건너뛴다 */ }
    }
    // 관람일(없으면 작성일) 최신순, 같으면 최근 수정순
    reviews.sort((a, b) =>
      (b.date || b.createdAt.slice(0, 10)).localeCompare(a.date || a.createdAt.slice(0, 10)) ||
      b.updatedAt.localeCompare(a.updatedAt));
    return reviews;
  }

  async function create(input) {
    const ts = now();
    const review = {
      id: crypto.randomBytes(6).toString('hex'),
      category: 'performance',
      title: '',
      date: '',
      venue: '',
      status: 'draft',
      stage: 'capture',
      ...emptyReview(),
      createdAt: ts,
      updatedAt: ts,
      completedAt: null,
    };
    applyPatch(review, { title: '', ...pick(input, ['category', 'title', 'date', 'venue']) });
    await writeJson(fileOf(review.id), review);
    return review;
  }

  function update(id, input) {
    return withLock(id, async () => {
      const review = await get(id);
      applyPatch(review, input || {});
      review.updatedAt = now();
      await writeJson(fileOf(id), review);
      return review;
    });
  }

  function remove(id) {
    return withLock(id, async () => {
      await get(id);
      await fs.rm(fileOf(id), { force: true });
    });
  }

  return { list, get, create, update, remove };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && k in obj) out[k] = obj[k];
  return out;
}

module.exports = { createStore, composeBody, NotFoundError, ValidationError };
