'use strict';

// ---------- 기본 도구 ----------

const $app = document.getElementById('app');
let META = null;
let cleanup = null; // 페이지를 떠날 때 실행할 정리 함수 (자동 저장 마무리 등)
let isDirty = () => false;

function el(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'value' || k === 'checked') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

// 선 아이콘 (고정 문자열만 사용)
const ICONS = {
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  close: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  performance: '<path d="M3 5h18v4a3 3 0 0 0 0 6v4H3v-4a3 3 0 0 0 0-6V5z"/><path d="M14 5v14" stroke-dasharray="2 2"/>',
  exhibition: '<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M3 15l5-5 4 4 3-3 6 6"/><path d="M8 21h8"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  fair: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
};

function icon(name, size = 20, stroke = 'currentColor', width = 2) {
  const span = document.createElement('span');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return span.firstChild;
}

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2400);
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dotted = (date) => (date ? date.replace(/-/g, '. ') : '');

function category(id) {
  return META.CATEGORIES.find((c) => c.id === id) || META.CATEGORIES[META.CATEGORIES.length - 1];
}

function stageLabel(id) {
  return (META.STAGES.find((s) => s.id === id) || META.STAGES[0]).label;
}

function vagueWord(text) {
  return META.VAGUE_WORDS.find((w) => text.includes(w)) || null;
}

function body(review) {
  return META.COMPOSE_SECTIONS.map((s) => review.compose[s.key].trim()).filter(Boolean).join('\n\n');
}

function autoGrow(textarea) {
  const fit = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  textarea.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return textarea;
}

function textArea(value, attrs = {}) {
  return autoGrow(el('textarea', { class: 'text', rows: 2, value, ...attrs }));
}

// 막연한 표현을 쓰면 한 걸음 더 구체적으로 적도록 안내한다.
function nudgeFor(textarea) {
  const box = el('div', { class: 'nudge', hidden: true });
  const update = () => {
    const w = vagueWord(textarea.value);
    box.hidden = !w;
    if (w) box.textContent = `‘${w}’에서 한 걸음만 더. 무엇이, 어느 부분이 그랬나요?`;
  };
  textarea.addEventListener('input', update);
  update();
  return box;
}

// 입력이 멈추면 저장하고 상태를 표시한다.
function autosaver(save, statusEl) {
  let timer = null;
  let dirty = false;
  let chain = Promise.resolve();
  function flush() {
    clearTimeout(timer);
    if (!dirty) return chain;
    dirty = false;
    statusEl.textContent = '저장 중…';
    statusEl.classList.remove('error');
    chain = chain.then(save).then(
      () => { if (!dirty) statusEl.textContent = '저장됨'; },
      (err) => { dirty = true; statusEl.textContent = '저장 실패'; statusEl.classList.add('error'); toast(err.message); },
    );
    return chain;
  }
  return {
    touch() {
      dirty = true;
      statusEl.textContent = '입력 중…';
      clearTimeout(timer);
      timer = setTimeout(flush, 700);
    },
    flush,
    get dirty() { return dirty; },
  };
}

// ---------- 라우터 ----------

const routes = [
  [/^\/?$/, renderHome],
  [/^\/new$/, renderNew],
  [/^\/r\/([a-f0-9]{12})$/, (m) => renderDetail(m[1])],
  [/^\/r\/([a-f0-9]{12})\/(capture|question|compose)$/, (m) => renderWrite(m[1], m[2])],
];

async function route() {
  if (cleanup) {
    const fn = cleanup;
    cleanup = null;
    isDirty = () => false;
    await Promise.resolve(fn()).catch(() => {});
  }
  const path = location.hash.replace(/^#/, '');
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const node = await fn(m);
      $app.replaceChildren(node);
      window.scrollTo(0, 0);
    } catch (err) {
      $app.replaceChildren(el('div', { class: 'narrow' },
        el('h1', { class: 'page-title' }, '찾을 수 없어요'),
        el('p', { class: 'page-desc' }, err.message),
        el('a', { class: 'btn-primary', href: '#/' }, '홈으로')));
    }
    return;
  }
  location.replace('#/');
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
});

// ---------- 홈 ----------

async function renderHome() {
  const reviews = await api('GET', '/api/reviews');
  const today = new Date();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];
  const drafts = reviews.filter((r) => r.status === 'draft').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const resume = drafts[0];

  let filter = '';
  const listBox = el('div', { class: 'records' });
  const filterBox = el('div', { class: 'filters', role: 'group', 'aria-label': '분류 필터' });

  const row = (r) => {
    const date = r.date || r.createdAt.slice(0, 10);
    const excerpt = r.status === 'draft'
      ? el('span', { class: 'record-excerpt draft' }, `작성 중 · ${stageLabel(r.stage)}`)
      : el('span', { class: 'record-excerpt' }, (body(r).split('\n')[0] || r.compose.title || ''));
    return el('a', { class: 'record', href: r.status === 'draft' ? `#/r/${r.id}/${r.stage}` : `#/r/${r.id}` },
      el('span', { class: 'record-date' },
        el('span', { class: 'record-day' }, date.slice(8, 10)),
        el('span', { class: 'record-month' }, date.slice(0, 7).replace('-', '.'))),
      el('span', { class: 'record-body' },
        el('span', { class: 'record-title-row' },
          el('span', { class: 'badge' }, category(r.category).shortLabel || category(r.category).label),
          el('span', { class: 'record-title' }, r.title)),
        excerpt),
      icon('chevron'));
  };

  const draw = () => {
    const shown = reviews.filter((r) => !filter || r.category === filter);
    listBox.replaceChildren(...(shown.length
      ? shown.map(row)
      : [el('p', { class: 'empty' }, reviews.length ? '이 분류에는 아직 감상이 없어요.' : '아직 남긴 감상이 없어요. 최근에 본 공연이나 전시 하나부터 시작해 보세요.')]));
    filterBox.replaceChildren(...[{ id: '', label: '전체' }, ...META.CATEGORIES].map((c) =>
      el('button', { type: 'button', class: 'filter', 'aria-pressed': String(filter === c.id), onclick: () => { filter = c.id; draw(); } }, c.label)));
  };
  draw();

  return el('div', { class: 'wrap' },
    el('header', { class: 'topbar' },
      el('a', { class: 'logo', href: '#/' }, el('span', { class: 'logo-mark' }, icon('pen', 16, '#FFFFFF')), '감상 연습장'),
      el('span', { class: 'meta-text' }, `기록 ${reviews.length}편`)),
    el('main', {},
      el('p', { class: 'today' }, `${today.getMonth() + 1}월 ${today.getDate()}일 ${weekday}요일`),
      el('h1', { class: 'hero-title' }, '오늘 본 것을', el('br'), '잊기 전에 남겨볼까요?'),
      el('a', { class: 'cta', href: '#/new' },
        el('span', { class: 'cta-text' },
          el('span', { class: 'cta-title' }, '감상 남기기'),
          el('span', { class: 'cta-sub' }, '질문을 따라 포착 · 질문 · 정리 세 단계로, 5분이면 충분해요')),
        el('span', { class: 'cta-arrow' }, icon('arrow', 24, '#FFFFFF'))),
      resume ? el('a', { class: 'resume', href: `#/r/${resume.id}/${resume.stage}` },
        el('span', { class: 'resume-text' },
          el('span', { class: 'resume-dot' }),
          el('span', {}, el('strong', {}, resume.title), el('span', { class: 'meta-text' }, ` · ${stageLabel(resume.stage)} 단계에서 멈췄어요`))),
        el('span', { class: 'resume-go' }, '이어 쓰기')) : null,
      el('section', {},
        el('div', { class: 'list-head' }, el('h2', {}, '나의 감상'), filterBox),
        listBox)));
}

// ---------- 새 감상 ----------

async function renderNew() {
  let picked = 'performance';
  const tiles = META.CATEGORIES.map((c) => el('button', {
    type: 'button',
    class: 'category',
    'aria-pressed': String(c.id === picked),
    onclick: () => {
      picked = c.id;
      tiles.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.id === picked)));
    },
    'data-id': c.id,
  }, icon(c.id, 28, '#111113', 1.6), el('span', { class: 'category-name' }, c.label), el('span', { class: 'category-examples' }, c.examples)));

  const title = el('input', { class: 'input lg', type: 'text', name: 'title', autocomplete: 'off', placeholder: '예: 갈매기' });
  const date = el('input', { class: 'input', type: 'date', name: 'date', value: ymd(new Date()) });
  const venue = el('input', { class: 'input', type: 'text', name: 'venue', autocomplete: 'off', placeholder: '공연장, 미술관 등' });

  const form = el('form', {
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (!title.value.trim()) { toast('작품명을 적어주세요.'); title.focus(); return; }
      try {
        const r = await api('POST', '/api/reviews', { category: picked, title: title.value, date: date.value, venue: venue.value });
        location.hash = `#/r/${r.id}/capture`;
      } catch (err) { toast(err.message); }
    },
  },
  el('fieldset', { style: 'border:0;padding:0;margin:0' },
    el('legend', { class: 'sr-only' }, '분류'),
    el('div', { class: 'categories' }, tiles)),
  el('div', { class: 'form-fields' },
    el('label', { class: 'field' }, el('span', { class: 'field-label' }, '작품명'), title),
    el('div', { class: 'form-row' },
      el('label', { class: 'field' }, el('span', { class: 'field-label' }, '관람일'), date),
      el('label', { class: 'field' }, el('span', { class: 'field-label' }, '장소 ', el('small', {}, '(선택)')), venue))),
  el('button', { type: 'submit', class: 'btn-primary block' }, '작성 시작', icon('arrow', 20, '#FFFFFF')));

  return el('div', {},
    el('div', { class: 'wrap' },
      el('header', { class: 'new-header' },
        el('a', { class: 'icon-btn outlined', href: '#/', 'aria-label': '홈으로' }, icon('close')),
        el('span', { class: 'meta-text' }, '새 감상'),
        el('span'))),
    el('main', { class: 'new-main' },
      el('h1', {}, '무엇을 보고 왔나요?'),
      el('p', {}, '고른 분류에 맞춰 질문과 힌트가 달라져요.'),
      form));
}

// ---------- 작성: 포착 · 질문 · 정리 ----------

async function renderWrite(id, stage) {
  const review = await api('GET', `/api/reviews/${id}`);
  const cat = category(review.category);
  const status = el('span', { class: 'save-state', role: 'status' }, '저장됨');
  const data = { capture: { ...review.capture }, question: { ...review.question, whys: [...review.question.whys] }, compose: { ...review.compose } };

  const saver = autosaver(async () => {
    const patch = { stage };
    patch[stage] = data[stage];
    await api('PATCH', `/api/reviews/${id}`, patch);
  }, status);
  isDirty = () => saver.dirty;
  cleanup = () => saver.flush();

  // 단계를 연 것만으로도 '멈춘 단계'를 기록한다.
  if (review.stage !== stage) api('PATCH', `/api/reviews/${id}`, { stage }).catch(() => {});

  const bind = (textarea, obj, key) => {
    textarea.addEventListener('input', () => { obj[key] = textarea.value; saver.touch(); });
    return textarea;
  };

  const header = el('header', { class: 'write-header' },
    el('div', { class: 'write-header-row' },
      el('a', { class: 'icon-btn', href: '#/', 'aria-label': '닫기' }, icon('close')),
      el('span', { class: 'write-work' }, el('span', { class: 'badge' }, cat.shortLabel || cat.label), el('strong', {}, review.title)),
      status),
    el('nav', { class: 'steps', 'aria-label': '작성 단계' }, META.STAGES.map((s, i) =>
      el('a', { class: 'step', href: `#/r/${id}/${s.id}`, 'aria-current': s.id === stage ? 'step' : null }, `${i + 1} ${s.label}`))));

  const pages = { capture: writeCapture, question: writeQuestion, compose: writeCompose };
  const main = pages[stage]({ id, review, cat, data, bind, saver });
  return el('div', {}, header, main);
}

function writeCapture({ id, cat, data, bind }) {
  const examples = [];
  const cards = META.CAPTURE_FIELDS.map((f) => {
    const ta = bind(textArea(data.capture[f.key], { placeholder: f.placeholder || '기억나는 장면을 그대로', rows: 3 }), data.capture, f.key);
    const ex = el('div', { class: 'example', hidden: true }, el('b', {}, '예'), META.EXAMPLE[f.key]);
    examples.push(ex);
    return el('div', { class: 'card' },
      el('label', {},
        el('span', { class: 'card-label' }, f.label, f.optional ? el('small', {}, ' (선택)') : null),
        ta),
      nudgeFor(ta), ex);
  });

  const exampleBtn = el('button', {
    type: 'button',
    class: 'link-btn',
    'aria-expanded': 'false',
    onclick: () => {
      const show = exampleBtn.getAttribute('aria-expanded') !== 'true';
      exampleBtn.setAttribute('aria-expanded', String(show));
      exampleBtn.textContent = show ? '예시 숨기기' : '예시 보기';
      examples.forEach((x) => { x.hidden = !show; });
    },
  }, '예시 보기');

  return el('main', { class: 'narrow' },
    el('h1', { class: 'page-title' }, '무엇이 남았나요?'),
    el('p', { class: 'page-desc' }, '해석하거나 평가하지 말고, 기억나는 장면을 있는 그대로 적어보세요.'),
    el('div', { class: 'hints', 'aria-label': '힌트' }, cat.hints.map((h) => el('span', { class: 'hint' }, h))),
    el('div', { class: 'cards' }, cards),
    el('div', { class: 'actions' },
      exampleBtn,
      el('a', { class: 'btn-primary', href: `#/r/${id}/question` }, '다음 · 질문하기', icon('arrow', 18, '#FFFFFF'))));
}

function writeQuestion({ id, data, bind, saver }) {
  const q = data.question;
  const scenes = META.CAPTURE_FIELDS.filter((f) => data.capture[f.key].trim());
  if (scenes.length && !scenes.some((f) => f.key === q.scene)) q.scene = scenes[0].key;

  const scenePicker = scenes.length
    ? el('fieldset', { class: 'scenes' },
      el('legend', { class: 'sr-only' }, '질문할 장면'),
      scenes.map((f) => el('label', { class: 'scene' },
        el('input', {
          type: 'radio',
          name: 'scene',
          value: f.key,
          checked: q.scene === f.key,
          onchange: () => { q.scene = f.key; saver.touch(); },
        }),
        el('span', {}, data.capture[f.key]))))
    : el('p', { class: 'notice' }, '아직 포착한 장면이 없어요. ', el('a', { href: `#/r/${id}/capture` }, '포착하기'), '에서 기억나는 장면을 먼저 적어보세요.');

  // 감정 카드: 막연한 표현이면 '왜?'를 한 번 더 묻는 칸을 덧붙인다.
  const emotionField = META.QUESTION_FIELDS.find((f) => f.key === 'emotion');
  const emotionCard = el('div', { class: 'card' });
  const drawEmotion = (focusLast) => {
    const fields = [];
    const emotionTa = bind(textArea(q.emotion, { class: 'text sm', placeholder: emotionField.placeholder, rows: 1 }), q, 'emotion');
    fields.push(emotionTa);
    const whyBlocks = q.whys.map((w, i) => {
      const ta = textArea(w, { class: 'text sm', rows: 1, placeholder: '떠오르는 대로' });
      ta.addEventListener('input', () => { q.whys[i] = ta.value; saver.touch(); });
      fields.push(ta);
      return el('label', { class: 'why' }, el('span', { class: 'card-label q' }, META.WHY_LABEL), ta);
    });
    const nudge = el('div', { class: 'nudge', hidden: true });
    const updateNudge = () => {
      const last = [...fields].reverse().find((t) => t.value.trim());
      const w = last ? vagueWord(last.value) : null;
      nudge.hidden = !w;
      if (!w) return;
      nudge.replaceChildren(el('span', {}, `‘${w}’에서 한 걸음만 더. 무엇이 그랬나요?`),
        q.whys.length < META.MAX_WHYS
          ? el('button', { type: 'button', onclick: () => { q.whys.push(''); saver.touch(); drawEmotion(true); } }, '‘왜?’ 한 번 더 묻기')
          : null);
    };
    fields.forEach((t) => t.addEventListener('input', updateNudge));
    updateNudge();
    emotionCard.replaceChildren(
      el('label', {}, el('span', { class: 'card-label q' }, emotionField.label), emotionTa),
      ...whyBlocks, nudge);
    if (focusLast) fields[fields.length - 1].focus();
  };
  drawEmotion(false);

  const cards = META.QUESTION_FIELDS.map((f) => {
    if (f.key === 'emotion') return emotionCard;
    const ta = bind(textArea(q[f.key], { class: 'text sm', placeholder: f.placeholder || '' }), q, f.key);
    return el('div', { class: 'card' }, el('label', {}, el('span', { class: 'card-label q' }, f.label), ta), nudgeFor(ta));
  });

  return el('main', { class: 'narrow' },
    el('h1', { class: 'page-title' }, '왜 그 장면이 남았을까요?'),
    el('p', { class: 'page-desc' }, '장면 하나를 골라 질문을 던져보세요. 모두 답하지 않아도 괜찮아요.'),
    scenePicker,
    el('div', { class: 'cards tight' }, cards),
    el('div', { class: 'actions' },
      el('a', { class: 'btn-secondary', href: `#/r/${id}/capture` }, '이전'),
      el('a', { class: 'btn-primary', href: `#/r/${id}/compose` }, '다음 · 정리하기', icon('arrow', 18, '#FFFFFF'))));
}

function writeCompose({ id, review, data, bind, saver }) {
  const c = data.compose;
  const sectionInputs = {};
  let lastFocused = META.COMPOSE_SECTIONS[0].key;

  const count = el('span', { class: 'count' });
  const bar = el('div', {});
  const refresh = () => {
    const n = META.COMPOSE_SECTIONS.map((s) => c[s.key].trim()).filter(Boolean).join('\n\n').replace(/\n/g, '').length;
    count.textContent = `${n} / ${META.TARGET_LENGTH}자`;
    bar.style.width = `${Math.min(100, (n / META.TARGET_LENGTH) * 100)}%`;
  };

  const titleInput = el('input', { class: 'paper-title', type: 'text', 'aria-label': '제목', placeholder: '제목', value: c.title });
  titleInput.addEventListener('input', () => { c.title = titleInput.value; saver.touch(); });

  const sections = META.COMPOSE_SECTIONS.map((s) => {
    const ta = bind(textArea(c[s.key], { placeholder: s.placeholder }), c, s.key);
    ta.addEventListener('input', refresh);
    ta.addEventListener('focus', () => { lastFocused = s.key; });
    sectionInputs[s.key] = ta;
    return el('div', { class: 'section' },
      el('label', { class: 'section-label', for: `sec-${s.key}` }, el('b', {}, s.label), el('span', {}, s.guide)),
      Object.assign(ta, { id: `sec-${s.key}` }),
      nudgeFor(ta));
  });
  refresh();

  // 포착·질문 단계에서 적은 재료
  const materials = [];
  for (const f of META.CAPTURE_FIELDS) {
    if (data.capture[f.key].trim()) materials.push({ from: `포착 · ${f.label}`, text: data.capture[f.key].trim() });
  }
  for (const f of META.QUESTION_FIELDS) {
    if (data.question[f.key].trim()) materials.push({ from: `질문 · ${f.short}`, text: data.question[f.key].trim() });
    if (f.key === 'emotion') {
      for (const w of data.question.whys) if (w.trim()) materials.push({ from: `질문 · ${META.WHY_LABEL}`, text: w.trim() });
    }
  }

  const insert = (text) => {
    const ta = sectionInputs[lastFocused];
    ta.value = ta.value.trim() ? `${ta.value.trimEnd()} ${text}` : text;
    ta.dispatchEvent(new Event('input'));
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  };

  const finish = async () => {
    if (!META.COMPOSE_SECTIONS.some((s) => c[s.key].trim())) { toast('한 칸이라도 채워야 완료할 수 있어요.'); return; }
    await saver.flush();
    if (saver.dirty) return;
    try {
      await api('PATCH', `/api/reviews/${id}`, { status: 'done', stage: 'compose' });
      location.hash = `#/r/${id}`;
    } catch (err) { toast(err.message); }
  };

  return el('main', { class: 'compose-layout' },
    el('section', { class: 'compose-main' },
      el('h1', { class: 'page-title' }, '한 편으로 정리하기'),
      el('p', { class: 'page-desc' }, '줄거리나 배경 설명은 없어도 돼요. 하나의 장면에서 내 생각으로 넓혀보세요.'),
      el('div', { class: 'paper' },
        titleInput,
        sections,
        el('div', { class: 'progress-row' }, el('div', { class: 'progress' }, bar), count)),
      el('div', { class: 'actions', style: 'margin-top:32px' },
        el('a', { class: 'btn-secondary', href: `#/r/${id}/question` }, '이전'),
        el('button', { type: 'button', class: 'btn-primary', onclick: finish },
          review.status === 'done' ? '수정 완료' : '감상 완료', icon('check', 18, '#FFFFFF')))),
    el('aside', { class: 'compose-side' },
      el('div', { class: 'materials' },
        el('h2', {}, '내가 적은 재료'),
        el('p', {}, materials.length ? '누르면 지금 쓰는 칸에 들어가요.' : '포착 · 질문 단계에서 적은 내용이 여기에 모여요.'),
        el('div', { class: 'material-list' }, materials.map((m) =>
          el('button', { type: 'button', class: 'material', onmousedown: (e) => e.preventDefault(), onclick: () => insert(m.text) },
            el('small', {}, m.from), el('span', {}, m.text)))))));
}

// ---------- 감상 읽기 ----------

async function renderDetail(id) {
  const r = await api('GET', `/api/reviews/${id}`);
  const cat = category(r.category);
  const paragraphs = META.COMPOSE_SECTIONS.map((s) => r.compose[s.key].trim()).filter(Boolean);

  const sources = [];
  for (const f of META.CAPTURE_FIELDS) if (r.capture[f.key].trim()) sources.push({ from: `포착 · ${f.label}`, text: r.capture[f.key] });
  for (const f of META.QUESTION_FIELDS) {
    if (f.key === 'remaining') continue;
    if (r.question[f.key].trim()) sources.push({ from: `질문 · ${f.short}`, text: r.question[f.key] });
    if (f.key === 'emotion') for (const w of r.question.whys) if (w.trim()) sources.push({ from: `질문 · ${META.WHY_LABEL}`, text: w });
  }
  const captureCount = sources.filter((s) => s.from.startsWith('포착')).length;

  const remove = async () => {
    if (!confirm(`‘${r.compose.title || r.title}’ 감상을 삭제할까요? 되돌릴 수 없어요.`)) return;
    await api('DELETE', `/api/reviews/${id}`);
    toast('삭제했어요.');
    location.hash = '#/';
  };

  const heading = r.compose.title.trim();
  return el('div', {},
    el('div', { class: 'wrap' },
      el('header', { class: 'topbar' },
        el('a', { class: 'icon-btn outlined', href: '#/', 'aria-label': '목록으로' }, icon('back')),
        el('div', { class: 'header-actions' },
          el('a', { class: 'pill-btn', href: `#/r/${id}/compose` }, '수정'),
          el('a', { class: 'pill-btn', href: `/api/reviews/${id}/export.md`, download: '' }, '내보내기'),
          el('button', { type: 'button', class: 'pill-btn danger', onclick: remove }, '삭제')))),
    el('article', { class: 'reading' },
      el('div', { class: 'detail-meta' },
        el('span', { class: 'badge' }, cat.shortLabel || cat.label),
        el('span', { class: 'meta-text' }, [dotted(r.date), r.venue].filter(Boolean).join(' · ')),
        r.status === 'draft' ? el('a', { class: 'meta-text', style: 'color:var(--accent);font-weight:600', href: `#/r/${id}/${r.stage}` }, '작성 중 · 이어 쓰기') : null),
      heading ? el('p', { class: 'detail-work' }, r.title) : null,
      el('h1', { class: 'detail-title' }, heading || r.title),
      paragraphs.length
        ? el('div', { class: 'detail-body' }, paragraphs.map((p) => el('p', {}, p)))
        : el('p', { class: 'notice' }, '아직 정리된 글이 없어요. ', el('a', { href: `#/r/${id}/compose` }, '정리하기'), '에서 한 편으로 이어 보세요.'),
      r.question.remaining.trim()
        ? el('section', { class: 'remaining' }, el('h2', {}, '남은 질문'), el('p', {}, r.question.remaining.trim()))
        : null,
      sources.length
        ? el('details', { class: 'source' },
          el('summary', {}, `이 감상의 재료 보기 · 포착 ${captureCount} · 질문 ${sources.length - captureCount}`),
          el('ul', {}, sources.map((s) => el('li', {}, el('small', {}, s.from), s.text))))
        : null));
}

// ---------- 시작 ----------

api('GET', '/api/meta').then((meta) => {
  META = meta;
  route();
}).catch((err) => {
  $app.replaceChildren(el('p', { class: 'narrow' }, `서버에 연결할 수 없습니다: ${err.message}`));
});
