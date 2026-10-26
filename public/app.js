'use strict';

// ---------- 기본 도구 ----------

const $app = document.getElementById('app');
let META = null;
let cleanup = null; // 페이지를 떠날 때 실행할 정리 함수 (자동 저장 마무리, 타이머 해제 등)

function el(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'value' || k === 'checked' || k === 'selected') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body instanceof Blob) {
    opts.body = body;
    opts.headers['Content-Type'] = body.type;
  } else if (body !== undefined) {
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
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shortDate(iso) {
  return iso ? iso.slice(0, 10) : '';
}

function hhmm() {
  return new Date().toTimeString().slice(0, 5);
}

function mondayOf(d) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function typeLabel(type) {
  return (META.workTypes.find((t) => t.id === type) || { label: '기타' }).label;
}

function exerciseById(id) {
  return META.exercises.find((e) => e.id === id);
}

function vagueHits(text) {
  return META.vagueWords.filter((w) => text.includes(w));
}

function sentenceCount(text) {
  return text.split(/[.!?。…]+["'”’)\]]*\s*|\n+/).filter((s) => s.trim()).length;
}

function charCount(text) {
  return { withSpace: text.replace(/\n/g, '').length, noSpace: text.replace(/\s/g, '').length };
}

function preview(text, n = 80) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

function noteSummary(note) {
  const ex = exerciseById(note.exercise);
  if (!ex) return '';
  const first = ex.fields.map((f) => note.answers[f.key]).find((v) => v && v.trim());
  return preview(first || '(비어 있음)');
}

function essayBody(essay) {
  return META.essaySections.map((s) => (essay.sections?.[s.key] || '').trim()).filter(Boolean).join('\n\n');
}

// 입력이 멈추면 저장하고, 저장 상태를 표시한다.
function autosaver(save, statusEl) {
  let timer = null;
  let dirty = false;
  let chain = Promise.resolve();
  function flush() {
    clearTimeout(timer);
    if (!dirty) return chain;
    dirty = false;
    statusEl.textContent = '저장 중…';
    statusEl.className = 'status';
    chain = chain.then(save).then(
      () => { statusEl.textContent = `저장됨 ${hhmm()}`; statusEl.className = 'status ok'; },
      (err) => { dirty = true; statusEl.textContent = `저장 실패: ${err.message}`; statusEl.className = 'status'; },
    );
    return chain;
  }
  return {
    touch() {
      dirty = true;
      statusEl.textContent = '입력 중…';
      statusEl.className = 'status';
      clearTimeout(timer);
      timer = setTimeout(flush, 800);
    },
    flush,
    get dirty() { return dirty; },
  };
}

function vagueBox(textarea) {
  const box = el('div', { class: 'vague', hidden: true });
  const update = () => {
    const hits = vagueHits(textarea.value);
    box.hidden = !hits.length;
    box.textContent = hits.length
      ? `“${hits.join('”, “')}” — 무엇이, 어느 장면의 무엇이 그랬나요? 한 걸음만 더 구체적으로 적어보세요.`
      : '';
  };
  textarea.addEventListener('input', update);
  update();
  return box;
}

function autoGrow(textarea) {
  const fit = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  };
  textarea.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return textarea;
}

function insertText(textarea, text) {
  textarea.value = textarea.value.trim() ? `${textarea.value.trimEnd()}\n${text}` : text;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

function timerWidget(minutes) {
  const label = el('span', { class: 'timer muted small' });
  let left = 0;
  let iv = null;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const btn = el('button', {
    class: 'btn small',
    type: 'button',
    onclick: () => {
      if (iv) { clearInterval(iv); iv = null; btn.textContent = `${minutes}분 타이머`; label.textContent = ''; return; }
      left = minutes * 60;
      label.textContent = fmt(left);
      btn.textContent = '타이머 끄기';
      iv = setInterval(() => {
        left -= 1;
        label.textContent = left > 0 ? fmt(left) : '시간 끝! 마무리해 보세요.';
        if (left <= 0) { clearInterval(iv); iv = null; btn.textContent = `${minutes}분 타이머`; }
      }, 1000);
    },
  }, `${minutes}분 타이머`);
  return { node: el('span', { class: 'row' }, btn, label), stop: () => clearInterval(iv) };
}

// ---------- 라우터 ----------

const routes = [
  [/^\/?$/, renderHome],
  [/^\/works$/, renderWorks],
  [/^\/works\/new$/, () => renderWorkForm(null)],
  [/^\/w\/([a-z0-9]+)$/, (m) => renderWork(m[1])],
  [/^\/w\/([a-z0-9]+)\/edit$/, (m) => renderWorkForm(m[1])],
  [/^\/w\/([a-z0-9]+)\/practice\/([a-z-]+)$/, (m) => renderNote(m[1], m[2], null)],
  [/^\/w\/([a-z0-9]+)\/note\/([a-z0-9]+)$/, (m) => renderNote(m[1], null, m[2])],
  [/^\/w\/([a-z0-9]+)\/essay\/new$/, (m) => renderEssay(m[1], null)],
  [/^\/w\/([a-z0-9]+)\/essay\/([a-z0-9]+)$/, (m) => renderEssay(m[1], m[2])],
  [/^\/practice$/, renderPractice],
  [/^\/questions$/, renderQuestions],
  [/^\/guide$/, renderGuide],
];

function currentQuery() {
  const q = location.hash.split('?')[1] || '';
  return new URLSearchParams(q);
}

async function route() {
  if (cleanup) {
    const fn = cleanup;
    cleanup = null;
    await Promise.resolve(fn()).catch(() => {});
  }
  const path = location.hash.replace(/^#/, '').split('?')[0];
  const top = path.split('/')[1] || 'home';
  const navKey = { w: 'works', works: 'works' }[top] || top;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === navKey));

  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const node = await fn(m);
      $app.replaceChildren(node);
      window.scrollTo(0, 0);
    } catch (err) {
      $app.replaceChildren(el('div', { class: 'card' }, el('p', {}, err.message), el('a', { href: '#/' }, '처음으로')));
    }
    return;
  }
  $app.replaceChildren(el('p', {}, '페이지를 찾을 수 없습니다. ', el('a', { href: '#/' }, '처음으로')));
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => {
  if (window.__dirty && window.__dirty()) { e.preventDefault(); e.returnValue = ''; }
});

// ---------- 홈 ----------

async function renderHome() {
  const today = new Date();
  const monday = mondayOf(today);
  const [works, settings, activity] = await Promise.all([
    api('GET', '/api/works'),
    api('GET', '/api/settings'),
    api('GET', `/api/activity?from=${encodeURIComponent(monday.toISOString())}`),
  ]);

  const todayRoutine = META.weeklyRoutine.find((r) => r.day === today.getDay());
  const nextRoutine = todayRoutine || META.weeklyRoutine.find((r) => r.day > today.getDay()) || META.weeklyRoutine[0];

  // 이번 주 달력: 요일별 활동 여부
  const activeDays = new Set(activity.map((a) => ymd(new Date(a.createdAt))));
  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const week = el('div', { class: 'week' }, dayNames.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const routine = META.weeklyRoutine.find((r) => r.day === d.getDay());
    const done = activeDays.has(ymd(d));
    const cls = ['day', routine && 'routine', done && 'done', ymd(d) === ymd(today) && 'today'].filter(Boolean).join(' ');
    return el('div', { class: cls, title: routine ? routine.goal : '' },
      name,
      el('span', { class: 'mark' }, done ? '●' : routine ? '○' : '·'),
      routine ? el('span', { class: 'stage' }, exerciseById(routine.exercise).stage) : null);
  }));

  const routineCard = el('div', { class: 'card' },
    el('div', { class: 'spread' },
      el('h3', {}, todayRoutine ? `오늘(${todayRoutine.label})의 연습` : `다음 연습: ${nextRoutine.label}`),
      el('span', { class: 'muted small' }, `이번 주 기록 ${activity.length}개`)),
    el('p', {}, el('strong', {}, exerciseById(nextRoutine.exercise).title), ` — ${nextRoutine.goal}`),
    el('p', { class: 'muted small' }, exerciseById(nextRoutine.exercise).summary),
    week,
    el('div', { class: 'row', style: 'margin-top:12px' },
      el('a', { class: 'btn primary', href: `#/practice?ex=${nextRoutine.exercise}` }, '연습 시작'),
      el('span', { class: 'muted small' }, '예전에 봤던 작품이나 읽었던 책의 한 장면으로도 충분합니다.')));

  // 4주 루틴
  const planCard = el('div', { class: 'card' });
  const drawPlan = (start) => {
    planCard.replaceChildren();
    planCard.append(el('h3', {}, '4주 감상 아카이빙 루틴'));
    let current = 0;
    if (start) {
      const days = Math.floor((new Date(ymd(today)) - new Date(start)) / 86400000);
      current = days < 0 ? 0 : Math.floor(days / 7) + 1;
    }
    const startInput = el('input', { type: 'date', value: start || ymd(today), style: 'max-width:180px' });
    planCard.append(el('div', { class: 'row', style: 'margin-bottom:10px' },
      el('span', { class: 'muted small' }, '시작일'),
      startInput,
      el('button', {
        class: 'btn small',
        onclick: async () => {
          const s = await api('PUT', '/api/settings', { routineStart: startInput.value });
          drawPlan(s.routineStart);
          toast(s.routineStart ? '루틴 시작일을 저장했습니다.' : '루틴을 초기화했습니다.');
        },
      }, start ? '변경' : '시작하기')));
    if (current > 4) planCard.append(el('p', { class: 'muted small' }, '4주 루틴을 마쳤습니다. 처음 쓴 글과 최근 글을 비교해 보세요.'));
    planCard.append(el('ul', { class: 'list' }, META.fourWeekPlan.map((w) => el('li', {},
      el('div', { class: 'spread' },
        el('strong', {}, `${w.week}주 차 — ${w.title}`),
        w.week === current ? el('span', { class: 'badge' }, '이번 주') : null),
      el('div', { class: 'muted small' }, w.detail),
      w.week === current && w.exercise ? el('a', { class: 'btn small', style: 'margin-top:6px', href: `#/practice?ex=${w.exercise}` }, '이 연습 하러 가기') : null,
      w.week === current && w.essayTarget ? el('a', { class: 'btn small', style: 'margin-top:6px', href: `#/practice?essay=${w.essayTarget}` }, `${w.essayTarget}자 감상문 쓰기`) : null))));
  };
  drawPlan(settings.routineStart);

  const recent = works.slice(0, 6);
  return el('div', {},
    el('h1', {}, '오늘의 감상 연습'),
    el('p', { class: 'lead' }, '처음에는 문장을 잘 쓰는 것보다 기억을 잃지 않는 것이 중요합니다.'),
    el('div', { class: 'card', style: 'margin-bottom:12px' },
      el('div', { class: 'spread' },
        el('div', {}, el('h3', {}, '방금 보고 왔나요?'), el('p', { class: 'muted small' }, '작품 정보를 적고 바로 5분 기록을 시작합니다.')),
        el('a', { class: 'btn primary', href: '#/works/new?then=five-minute' }, '관람 직후 5분 기록'))),
    el('div', { class: 'grid two' }, routineCard, planCard),
    el('div', { class: 'spread' }, el('h2', {}, '최근 기록'), el('a', { href: '#/works' }, '전체 보기')),
    recent.length
      ? el('div', { class: 'grid' }, recent.map(workCard))
      : el('div', { class: 'card muted' }, '아직 기록이 없습니다. 최근에 본 공연, 전시, 책 하나부터 등록해 보세요.'));
}

function workCard(w) {
  return el('a', { class: 'card', href: `#/w/${w.id}` },
    el('div', { class: 'row', style: 'margin-bottom:4px' },
      el('span', { class: 'badge' }, typeLabel(w.type)),
      el('span', { class: 'muted small' }, w.date || '날짜 없음')),
    el('h3', {}, w.title),
    el('div', { class: 'muted small' }, [w.venue, w.creators].filter(Boolean).join(' · ') || ' '),
    el('div', { class: 'muted small' }, `연습 ${w.notes.length} · 감상문 ${w.essays.length}`));
}

// ---------- 기록 목록 ----------

async function renderWorks() {
  const works = await api('GET', '/api/works');
  const q = currentQuery();
  let type = q.get('type') || '';
  const search = el('input', { type: 'search', placeholder: '작품명, 장소, 작가, 태그, 메모 검색', value: q.get('q') || '' });
  const listBox = el('div', { class: 'grid' });
  const chips = el('div', { class: 'chips' });

  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const shown = works.filter((w) => (!type || w.type === type) &&
      (!term || [w.title, w.venue, w.creators, w.memo, ...(w.tags || [])].join(' ').toLowerCase().includes(term)));
    listBox.replaceChildren(...(shown.length ? shown.map(workCard) : [el('p', { class: 'muted' }, '해당하는 기록이 없습니다.')]));
    chips.replaceChildren(
      ...[{ id: '', label: '전체' }, ...META.workTypes].map((t) => el('button', {
        class: `chip${type === t.id ? ' on' : ''}`,
        onclick: () => { type = t.id; draw(); },
      }, t.label, ` ${t.id ? works.filter((w) => w.type === t.id).length : works.length}`)));
  };
  search.addEventListener('input', draw);
  draw();

  return el('div', {},
    el('div', { class: 'spread' }, el('h1', {}, '관람 기록'), el('a', { class: 'btn primary', href: '#/works/new' }, '+ 새 기록')),
    el('p', { class: 'lead' }, '작품명 · 관람일 · 장소 · 작가 또는 제작진 · 기억에 남는 장면 · 감상문 · 당시의 질문 · 포스터나 티켓'),
    search, chips, listBox);
}

// ---------- 작품 등록/편집 ----------

async function renderWorkForm(id) {
  const work = id ? await api('GET', `/api/works/${id}`) : { type: 'performance', title: '', date: ymd(new Date()), venue: '', creators: '', tags: [], memo: '' };
  const then = currentQuery().get('then');
  const f = {
    type: el('select', {}, META.workTypes.map((t) => el('option', { value: t.id, selected: t.id === work.type }, t.label))),
    title: el('input', { type: 'text', value: work.title, required: true, placeholder: '예: 갈매기' }),
    date: el('input', { type: 'date', value: work.date }),
    venue: el('input', { type: 'text', value: work.venue, placeholder: '공연장, 미술관, 박람회장 등' }),
    creators: el('input', { type: 'text', value: work.creators, placeholder: '작가, 연출, 출연, 큐레이터 등' }),
    tags: el('input', { type: 'text', value: (work.tags || []).join(', '), placeholder: '쉼표로 구분' }),
    memo: autoGrow(el('textarea', { placeholder: '기억에 남는 장면, 함께 간 사람, 그날의 상황 등 자유 메모', value: work.memo })),
  };
  f.type.value = work.type;
  const field = (label, input, hint) => el('label', { class: 'field' }, el('span', {}, label), hint ? el('span', { class: 'hint' }, hint) : null, input);

  const form = el('form', {
    class: 'card',
    onsubmit: async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(Object.entries(f).map(([k, inp]) => [k, inp.value]));
      try {
        const saved = id ? await api('PUT', `/api/works/${id}`, body) : await api('POST', '/api/works', body);
        toast('저장했습니다.');
        location.hash = then && exerciseById(then) ? `#/w/${saved.id}/practice/${then}` : `#/w/${saved.id}`;
      } catch (err) {
        toast(err.message);
      }
    },
  },
  el('div', { class: 'grid' }, field('종류', f.type), field('관람일', f.date)),
  field('작품명', f.title),
  el('div', { class: 'grid' }, field('장소', f.venue), field('작가·제작진', f.creators)),
  field('태그', f.tags),
  field('메모', f.memo),
  el('div', { class: 'row' },
    el('button', { class: 'btn primary', type: 'submit' }, id ? '저장' : then ? '등록하고 기록 시작' : '등록'),
    el('a', { class: 'btn', href: id ? `#/w/${id}` : '#/works' }, '취소')));

  return el('div', {}, el('h1', {}, id ? '기록 편집' : '새 관람 기록'), el('p', { class: 'lead' }, '기본 정보는 짧게 적고 넘어가도 됩니다.'), form);
}

// ---------- 작품 상세 ----------

async function renderWork(id) {
  const [work, all] = await Promise.all([api('GET', `/api/works/${id}`), api('GET', '/api/works')]);

  // 같은 작가·제작진 또는 같은 작품명의 다른 기록 (예전 감상과 비교하기)
  const norm = (s) => (s || '').trim().toLowerCase();
  const related = all.filter((w) => w.id !== work.id && (
    norm(w.title) === norm(work.title) ||
    (norm(work.creators) && norm(w.creators) && (norm(w.creators).includes(norm(work.creators)) || norm(work.creators).includes(norm(w.creators))))));

  const posterInput = el('input', {
    type: 'file',
    accept: 'image/png,image/jpeg,image/webp,image/gif',
    hidden: true,
    onchange: async () => {
      const file = posterInput.files[0];
      if (!file) return;
      try {
        await api('PUT', `/api/works/${id}/poster`, file);
        toast('이미지를 올렸습니다.');
        route();
      } catch (err) { toast(err.message); }
    },
  });

  const meta = [['관람일', work.date], ['장소', work.venue], ['작가·제작진', work.creators], ['태그', (work.tags || []).join(', ')]].filter(([, v]) => v);

  const head = el('div', { class: 'card' },
    el('div', { class: 'row', style: 'align-items:flex-start;gap:20px' },
      work.poster ? el('img', { class: 'poster', src: `/uploads/${encodeURIComponent(work.poster)}`, alt: '포스터·티켓' }) : null,
      el('div', { style: 'flex:1;min-width:220px' },
        el('span', { class: 'badge' }, typeLabel(work.type)),
        el('h1', { style: 'margin-top:6px' }, work.title),
        el('table', {}, meta.map(([k, v]) => el('tr', {}, el('th', { style: 'width:110px' }, k), el('td', {}, v)))),
        work.memo ? el('p', { class: 'preview', style: 'margin-top:10px' }, work.memo) : null,
        el('div', { class: 'row', style: 'margin-top:12px' },
          el('a', { class: 'btn', href: `#/w/${id}/edit` }, '편집'),
          el('button', { class: 'btn', onclick: () => posterInput.click() }, work.poster ? '포스터·티켓 바꾸기' : '포스터·티켓 올리기'),
          el('a', { class: 'btn', href: `/api/works/${id}/export.md` }, 'Markdown 내보내기'),
          el('button', {
            class: 'btn danger',
            onclick: async () => {
              if (!confirm(`'${work.title}' 기록과 연습·감상문을 모두 삭제할까요?`)) return;
              await api('DELETE', `/api/works/${id}`);
              toast('삭제했습니다.');
              location.hash = '#/works';
            },
          }, '삭제'),
          posterInput))));

  const stageOrder = ['포착하기', '질문하기', '발전시키기', '기본기'];
  const exerciseButtons = el('div', { class: 'chips' }, [...META.exercises]
    .sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage))
    .map((ex) => el('a', { class: 'chip', href: `#/w/${id}/practice/${ex.id}`, style: 'text-decoration:none' }, `${ex.stage} · ${ex.title}`)));

  const notes = [...work.notes].reverse();
  const essays = [...work.essays].reverse();

  return el('div', {},
    head,
    el('h2', {}, '연습하기'),
    el('div', { class: 'card' },
      el('p', { class: 'muted small' }, '포착하기 → 질문하기 → 발전시키기 순서를 추천합니다. 단계별로 한 문장씩만 적어도 됩니다.'),
      exerciseButtons),
    el('div', { class: 'spread' },
      el('h2', {}, `감상문 ${essays.length}`),
      el('a', { class: 'btn primary', href: `#/w/${id}/essay/new` }, '+ 감상문 쓰기')),
    essays.length
      ? el('div', { class: 'card' }, el('ul', { class: 'list' }, essays.map((e) => {
        const body = essayBody(e);
        return el('li', {},
          el('div', { class: 'spread' },
            el('a', { href: `#/w/${id}/essay/${e.id}` }, el('strong', {}, e.title || '제목 없음')),
            el('span', { class: 'muted small' }, `${shortDate(e.createdAt)} · ${body.length}자`)),
          el('div', { class: 'muted small' }, preview(body, 120) || '(비어 있음)'));
      })))
      : el('div', { class: 'card muted' }, '연습 기록이 쌓이면 그 내용을 바탕으로 200~400자 정도의 짧은 감상문을 써보세요.'),
    el('h2', {}, `연습 기록 ${notes.length}`),
    notes.length
      ? el('div', { class: 'card' }, el('ul', { class: 'list' }, notes.map((n) => el('li', {},
        el('div', { class: 'spread' },
          el('a', { href: `#/w/${id}/note/${n.id}` }, el('strong', {}, exerciseById(n.exercise)?.title || n.exercise)),
          el('span', { class: 'muted small' }, shortDate(n.createdAt))),
        el('div', { class: 'muted small' }, noteSummary(n))))))
      : el('div', { class: 'card muted' }, '아직 연습 기록이 없습니다.'),
    related.length ? el('h2', {}, '같은 작품·작가의 다른 기록') : null,
    related.length ? el('div', { class: 'grid' }, related.map(workCard)) : null);
}

// ---------- 연습 기록 작성 ----------

async function renderNote(workId, exerciseId, noteId) {
  const work = await api('GET', `/api/works/${workId}`);
  let note = noteId ? work.notes.find((n) => n.id === noteId) : null;
  if (noteId && !note) throw new Error('연습 기록을 찾을 수 없습니다.');
  const ex = exerciseById(note ? note.exercise : exerciseId);
  if (!ex) throw new Error('알 수 없는 연습 유형입니다.');

  const status = el('span', { class: 'status' }, note ? `마지막 저장 ${shortDate(note.updatedAt)}` : '입력하면 자동 저장됩니다.');
  const inputs = {};
  const collect = () => Object.fromEntries(Object.entries(inputs).map(([k, t]) => [k, t.value]));

  const saver = autosaver(async () => {
    if (!note) {
      note = await api('POST', `/api/works/${workId}/notes`, { exercise: ex.id, answers: collect() });
      history.replaceState(null, '', `#/w/${workId}/note/${note.id}`);
    } else {
      note = await api('PUT', `/api/works/${workId}/notes/${note.id}`, { answers: collect() });
    }
  }, status);

  // 같은 작품의 다른 연습에서 적은 내용을 출발점으로 가져올 수 있게 한다.
  const priorSnippets = [];
  for (const n of work.notes) {
    if (note && n.id === note.id) continue;
    const pex = exerciseById(n.exercise);
    if (!pex) continue;
    for (const f of pex.fields) {
      const v = (n.answers[f.key] || '').trim();
      if (v && !priorSnippets.includes(v)) priorSnippets.push(v);
    }
  }

  const timer = timerWidget(ex.minutes);
  const showExample = el('input', { type: 'checkbox' });
  const examples = [];

  const fields = ex.fields.map((f, i) => {
    const ta = autoGrow(el('textarea', { value: note?.answers[f.key] || '', placeholder: '생각나는 대로 짧게' }));
    ta.addEventListener('input', () => saver.touch());
    inputs[f.key] = ta;
    const hint = i === 0 && META.typeHints[work.type] && !f.hint.startsWith('예:') ? `${f.hint}${f.hint ? ' · ' : ''}${META.typeHints[work.type]}` : f.hint;
    const exampleBox = ex.example?.[f.key] ? el('div', { class: 'example', hidden: true }, `예) ${ex.example[f.key]}`) : null;
    if (exampleBox) examples.push(exampleBox);
    const chips = i === 0 && priorSnippets.length
      ? el('details', {}, el('summary', { class: 'small' }, '앞서 적은 내용에서 가져오기'),
        el('div', { class: 'chips' }, priorSnippets.slice(0, 12).map((s) => el('button', { class: 'chip', type: 'button', title: s, onclick: () => insertText(ta, s) }, preview(s, 40)))))
      : null;
    return el('div', { class: 'field' },
      el('span', {}, f.label),
      hint ? el('span', { class: 'hint' }, hint) : null,
      chips, ta, vagueBox(ta), exampleBox);
  });
  showExample.addEventListener('change', () => examples.forEach((x) => { x.hidden = !showExample.checked; }));

  window.__dirty = () => saver.dirty;
  cleanup = async () => { timer.stop(); window.__dirty = null; await saver.flush(); };

  const actions = el('div', { class: 'row' },
    el('button', { class: 'btn primary', type: 'button', onclick: async () => { saver.touch(); await saver.flush(); location.hash = `#/w/${workId}`; } }, '저장하고 돌아가기'),
    el('a', { class: 'btn', href: `#/w/${workId}/essay/new` }, '이 내용으로 감상문 쓰기'),
    note || noteId ? el('button', {
      class: 'btn danger',
      type: 'button',
      onclick: async () => {
        if (!note || !confirm('이 연습 기록을 삭제할까요?')) return;
        await api('DELETE', `/api/works/${workId}/notes/${note.id}`);
        window.__dirty = null;
        cleanup = null;
        location.hash = `#/w/${workId}`;
      },
    }, '삭제') : null,
    status);

  return el('div', {},
    el('p', { class: 'muted small' }, el('a', { href: `#/w/${workId}` }, `← ${work.title}`), ` · ${ex.stage}`),
    el('h1', {}, ex.title),
    el('p', { class: 'lead' }, ex.summary),
    el('div', { class: 'row', style: 'margin-bottom:14px' },
      timer.node,
      ex.example ? el('label', { class: 'row small' }, showExample, '예시 보기 (연극 〈갈매기〉)') : null),
    el('div', { class: 'card' }, fields, actions));
}

// ---------- 감상문 작성 ----------

const SECTION_SOURCES = {
  intro: ['memorable', 'scene1', 'pick', 'topic', 'start'],
  describe: ['scene1', 'scene2', 'scene3', 'scene', 'observe', 'memorable', 'target', 's1', 's2', 's3', 's4', 's5', 'unexpected'],
  reflect: ['feel', 'interpret', 'emotion', 'reason', 'q1', 'q2', 'q3', 'q4', 'why1', 'why2', 'why3'],
  closing: ['q5', 'pick', 'topic', 'newThought', 'topics'],
};

async function renderEssay(workId, essayId) {
  const work = await api('GET', `/api/works/${workId}`);
  let essay = essayId ? work.essays.find((e) => e.id === essayId) : null;
  if (essayId && !essay) throw new Error('감상문을 찾을 수 없습니다.');
  const presetTarget = Number(currentQuery().get('target')) || 300;

  const status = el('span', { class: 'status' }, essay ? `마지막 저장 ${shortDate(essay.updatedAt)}` : '입력하면 자동 저장됩니다.');
  const title = el('input', { type: 'text', value: essay?.title || '', placeholder: '제목 (나중에 정해도 됩니다)' });
  const target = el('select', {}, META.essayTargets.map((n) => el('option', { value: n, selected: n === (essay?.target || presetTarget) }, `${n}자 목표`)));
  target.value = String(essay?.target || presetTarget);
  const sectionInputs = {};
  const checkInputs = {};

  const collect = () => ({
    title: title.value,
    target: Number(target.value),
    sections: Object.fromEntries(Object.entries(sectionInputs).map(([k, t]) => [k, t.value])),
    checks: Object.fromEntries(Object.entries(checkInputs).map(([k, c]) => [k, c.checked])),
  });

  const saver = autosaver(async () => {
    if (!essay) {
      essay = await api('POST', `/api/works/${workId}/essays`, collect());
      history.replaceState(null, '', `#/w/${workId}/essay/${essay.id}`);
    } else {
      essay = await api('PUT', `/api/works/${workId}/essays/${essay.id}`, collect());
    }
  }, status);

  // 연습 기록에서 가져올 수 있는 재료
  const material = (keys) => {
    const out = [];
    for (const n of work.notes) {
      for (const k of keys) {
        const v = (n.answers[k] || '').trim();
        if (v && !out.includes(v)) out.push(v);
      }
    }
    return out;
  };

  const totalBox = el('div', { class: 'small' });
  const bar = el('div', { class: 'progress' }, el('div', { style: 'width:0' }));
  const previewBox = el('div', { class: 'preview' });
  const vagueAll = el('div', { class: 'vague', hidden: true });

  const refresh = () => {
    const body = META.essaySections.map((s) => sectionInputs[s.key].value.trim()).filter(Boolean).join('\n\n');
    const c = charCount(body);
    const goal = Number(target.value);
    totalBox.textContent = `${c.withSpace}자 (공백 제외 ${c.noSpace}자) / 목표 ${goal}자`;
    bar.firstChild.style.width = `${Math.min(100, (c.withSpace / goal) * 100)}%`;
    bar.classList.toggle('done', c.withSpace >= goal);
    previewBox.textContent = body || '네 부분을 채우면 여기에 한 편의 글로 이어져 보입니다.';
    const hits = vagueHits(body);
    vagueAll.hidden = !hits.length;
    vagueAll.textContent = hits.length ? `피상적으로 끝나는 표현: ${hits.join(', ')}` : '';
  };

  const sections = META.essaySections.map((s) => {
    const ta = autoGrow(el('textarea', { value: essay?.sections?.[s.key] || '', placeholder: s.guide }));
    sectionInputs[s.key] = ta;
    const counter = el('span', { class: 'counter' });
    const updateCounter = () => { counter.textContent = `${sentenceCount(ta.value)}문장 · ${ta.value.length}자 (권장 ${s.sentences})`; };
    ta.addEventListener('input', () => { updateCounter(); refresh(); saver.touch(); });
    updateCounter();
    const mats = material(SECTION_SOURCES[s.key] || []);
    return el('div', { class: 'field', style: 'margin-bottom:18px' },
      el('div', { class: 'section-head' }, el('strong', {}, s.label), counter),
      el('span', { class: 'hint' }, s.guide),
      mats.length ? el('div', { class: 'chips' }, mats.slice(0, 8).map((m) => el('button', { class: 'chip', type: 'button', title: m, onclick: () => insertText(ta, m) }, `+ ${preview(m, 36)}`))) : null,
      ta, vagueBox(ta));
  });

  const checks = el('div', {}, META.selfChecks.map((c) => {
    const cb = el('input', { type: 'checkbox', checked: Boolean(essay?.checks?.[c.key]), onchange: () => saver.touch() });
    checkInputs[c.key] = cb;
    return el('label', { class: 'row small', style: 'align-items:flex-start;margin-bottom:6px;flex-wrap:nowrap' }, cb, el('span', {}, el('strong', {}, c.label), ` — ${c.question}`));
  }));

  title.addEventListener('input', () => saver.touch());
  target.addEventListener('change', () => { refresh(); saver.touch(); });
  refresh();

  // 참고 패널: 이 작품의 연습 기록과 지난 감상문
  const otherEssays = work.essays.filter((e) => !essay || e.id !== essay.id);
  const aside = el('aside', {},
    el('div', { class: 'card' },
      el('h3', {}, '연습 기록'),
      work.notes.length
        ? work.notes.map((n) => {
          const ex = exerciseById(n.exercise);
          if (!ex) return null;
          return el('details', { style: 'margin-bottom:8px' },
            el('summary', { class: 'small' }, `${ex.title} · ${shortDate(n.createdAt)}`),
            el('ul', { class: 'list small' }, ex.fields.filter((f) => (n.answers[f.key] || '').trim()).map((f) =>
              el('li', {}, el('div', { class: 'muted' }, f.label), el('div', { class: 'preview', style: 'font-size:14px' }, n.answers[f.key])))));
        })
        : el('p', { class: 'muted small' }, '아직 연습 기록이 없습니다. ', el('a', { href: `#/w/${workId}/practice/discovery` }, '감상 발견 연습장'), '부터 채워보면 쓸 거리가 생깁니다.')),
    otherEssays.length ? el('div', { class: 'card' },
      el('h3', {}, '지난 감상문과 비교'),
      otherEssays.map((e) => el('details', { style: 'margin-bottom:8px' },
        el('summary', { class: 'small' }, `${e.title || '제목 없음'} · ${essayBody(e).length}자`),
        el('div', { class: 'preview', style: 'font-size:14px' }, essayBody(e))))) : null);

  window.__dirty = () => saver.dirty;
  cleanup = async () => { window.__dirty = null; await saver.flush(); };

  return el('div', {},
    el('p', { class: 'muted small' }, el('a', { href: `#/w/${workId}` }, `← ${work.title}`)),
    el('h1', {}, essay ? '감상문 다듬기' : '짧은 감상문 쓰기'),
    el('p', { class: 'lead' }, '줄거리 전체나 배경 설명은 없어도 됩니다. 하나의 장면에서 출발해 나의 생각으로 넓혀 보세요.'),
    el('div', { class: 'editor' },
      el('div', {},
        el('div', { class: 'card' },
          el('div', { class: 'row', style: 'margin-bottom:14px;flex-wrap:nowrap' }, title, el('div', { style: 'width:140px;flex:none' }, target)),
          sections,
          el('div', { style: 'margin:8px 0 4px' }, totalBox),
          bar,
          vagueAll),
        el('div', { class: 'card' }, el('h3', {}, '이어 읽기'), previewBox),
        el('div', { class: 'card' }, el('h3', {}, '자기 점검'), checks),
        el('div', { class: 'row', style: 'margin-top:12px' },
          el('button', { class: 'btn primary', type: 'button', onclick: async () => { saver.touch(); await saver.flush(); location.hash = `#/w/${workId}`; } }, '저장하고 돌아가기'),
          el('button', {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              const body = META.essaySections.map((s) => sectionInputs[s.key].value.trim()).filter(Boolean).join('\n\n');
              await navigator.clipboard.writeText(title.value ? `${title.value}\n\n${body}` : body);
              toast('클립보드에 복사했습니다.');
            },
          }, '본문 복사'),
          essayId ? el('button', {
            class: 'btn danger',
            type: 'button',
            onclick: async () => {
              if (!essay || !confirm('이 감상문을 삭제할까요?')) return;
              await api('DELETE', `/api/works/${workId}/essays/${essay.id}`);
              window.__dirty = null;
              cleanup = null;
              location.hash = `#/w/${workId}`;
            },
          }, '삭제') : null,
          status)),
      aside));
}

// ---------- 연습 고르기 ----------

async function renderPractice() {
  const works = await api('GET', '/api/works');
  const q = currentQuery();
  const pre = q.get('ex');
  const essayTarget = q.get('essay');

  const select = el('select', {}, works.length
    ? works.map((w) => el('option', { value: w.id }, `[${typeLabel(w.type)}] ${w.title}${w.date ? ` · ${w.date}` : ''}`))
    : el('option', { value: '' }, '등록된 작품이 없습니다'));

  const go = (path) => {
    if (!select.value) { toast('먼저 작품을 등록해 주세요.'); return; }
    location.hash = `#/w/${select.value}/${path}`;
  };

  const stageOrder = ['포착하기', '질문하기', '발전시키기', '기본기'];
  const stages = stageOrder.map((stage) => {
    const list = META.exercises.filter((e) => e.stage === stage);
    return el('div', {},
      el('h2', {}, stage),
      el('div', { class: 'grid' }, list.map((ex) => el('button', {
        class: 'card',
        style: `text-align:left;cursor:pointer;font:inherit;color:inherit;${ex.id === pre ? 'border-color:var(--accent);outline:2px solid var(--accent-soft)' : ''}`,
        onclick: () => go(`practice/${ex.id}`),
      }, el('div', { class: 'spread' }, el('h3', {}, ex.title), el('span', { class: 'badge gray' }, `${ex.minutes}분`)),
      el('p', { class: 'muted small' }, ex.summary)))));
  });

  return el('div', {},
    el('h1', {}, '연습하기'),
    el('p', { class: 'lead' }, '감상의 소재를 발견하고 붙잡아 두는 연습입니다. 처음 2주는 감상문을 완성하려 하지 않아도 됩니다.'),
    el('div', { class: 'card' },
      el('label', { class: 'field', style: 'margin-bottom:8px' }, el('span', {}, '어떤 작품으로 연습할까요?'), select),
      el('div', { class: 'row' },
        el('a', { class: 'btn small', href: `#/works/new${pre ? `?then=${pre}` : ''}` }, '+ 새 작품 등록'),
        el('button', { class: 'btn small', onclick: () => go(`essay/new?target=${essayTarget || 300}`) }, `${essayTarget || ''}${essayTarget ? '자 ' : ''}감상문 쓰기`))),
    stages);
}

// ---------- 남은 질문 ----------

async function renderQuestions() {
  const qs = await api('GET', '/api/questions');
  return el('div', {},
    el('h1', {}, '남은 질문'),
    el('p', { class: 'lead' }, '결론을 내리지 않아도 됩니다. 공연이나 전시를 보고 생긴 의문을 기록하는 것만으로도 가치 있는 아카이빙이 됩니다.'),
    qs.length
      ? el('div', { class: 'card' }, el('ul', { class: 'list' }, qs.map((q) => el('li', {},
        el('div', { class: 'preview' }, q.text),
        el('div', { class: 'muted small' },
          el('a', { href: `#/w/${q.workId}/note/${q.noteId}` }, q.workTitle), ` · ${q.exercise} · ${shortDate(q.createdAt)}`)))))
      : el('div', { class: 'card muted' }, "'질문 다섯 개', \"'왜?' 세 번\", '5분 기록' 연습에서 적은 질문이 여기에 모입니다."));
}

// ---------- 가이드 ----------

async function renderGuide() {
  const r = META.resources;
  const ex = (id) => exerciseById(id);
  return el('div', {},
    el('h1', {}, '가이드'),
    el('p', { class: 'lead' }, '감상을 발견하는 훈련 → 구체적인 언어로 표현하는 훈련 → 짧은 글로 구성하는 훈련 순서를 추천합니다.'),

    el('h2', {}, '세 단계'),
    el('div', { class: 'grid' },
      [['포착하기', '무엇이 남았나?', 'capture'], ['질문하기', '왜 남았나?', 'five-questions'], ['발전시키기', '무슨 생각이 드나?', 'why-three']].map(([s, q, id]) =>
        el('a', { class: 'card', href: `#/practice?ex=${id}` }, el('span', { class: 'badge' }, s), el('h3', { style: 'margin-top:6px' }, q), el('p', { class: 'muted small' }, ex(id).summary)))),

    el('h2', {}, '관찰 · 감정 · 해석'),
    el('div', { class: 'card' },
      el('table', {}, ex('oei').fields.map((f) => el('tr', {}, el('th', { style: 'width:220px' }, f.label), el('td', {}, ex('oei').example[f.key])))),
      el('p', { class: 'muted small', style: 'margin-top:10px' }, '이렇게 세 문장만 적어도 하나의 작은 감상문이 만들어집니다.')),

    el('h2', {}, '짧은 감상문의 순서'),
    el('div', { class: 'card' },
      el('table', {}, el('tr', {}, el('th', {}, '순서'), el('th', {}, '내용'), el('th', {}, '권장 분량')),
        META.essaySections.map((s) => el('tr', {}, el('td', {}, s.label), el('td', {}, s.guide), el('td', {}, s.sentences)))),
      el('p', { class: 'muted small', style: 'margin-top:10px' }, '이 구조로 200~400자 정도만 작성해도 충분합니다.'),
      el('details', {}, el('summary', {}, '예시: 연극 〈갈매기〉 감상문'),
        el('div', { class: 'preview', style: 'margin-top:8px' },
          '공연이 끝나고 가장 오래 남은 것은 니나가 떠난 뒤의 적막이었다.\n\n' +
          '트레플레프와 니나의 마지막 대화에서 니나는 고통스러운 삶을 이야기하면서도 여전히 배우로 살아가겠다는 의지를 드러냈다. 그런데 나는 그 모습이 희망차기보다는 오히려 쓸쓸하게 느껴졌다.\n\n' +
          '어쩌면 내가 생각하는 성장은 고통을 극복하는 일이었기 때문일 것이다. 하지만 니나는 고통이 사라지지 않더라도 자신의 삶을 계속 살아갈 수 있다는 것을 보여준 것 같았다.\n\n' +
          '극장을 나서며 한 가지 질문이 남았다. 우리는 꼭 행복해져야만 자신의 삶을 잘 살아냈다고 말할 수 있을까?'))),

    el('h2', {}, '일주일 루틴 (10분씩 세 번)'),
    el('div', { class: 'card' },
      el('table', {}, el('tr', {}, el('th', {}, '요일'), el('th', {}, '훈련'), el('th', {}, '목표')),
        META.weeklyRoutine.map((w) => el('tr', {}, el('td', {}, w.label), el('td', {}, el('a', { href: `#/practice?ex=${w.exercise}` }, ex(w.exercise).title)), el('td', {}, w.goal)))),
      el('p', { class: 'muted small', style: 'margin-top:10px' }, '3주 차부터는 모아둔 기록 중 가장 흥미로운 질문을 골라 200~300자 글을 써보세요.')),

    el('h2', {}, '훈련이 잘 되고 있는지 확인하기'),
    el('div', { class: 'card' }, el('ul', { class: 'list' }, META.selfChecks.map((c) => el('li', {}, el('strong', {}, c.label), ` — ${c.question}`)))),
    el('p', { class: 'muted small', style: 'margin-top:10px' }, '감상은 반드시 긍정적일 필요가 없습니다. 지루하거나 불쾌했던 이유를 탐구하면 나만의 취향과 관점이 더 분명해집니다.'),

    el('h2', {}, '추천 도서'),
    el('div', { class: 'grid' }, r.BOOKS.map((b) => el('div', { class: 'card' },
      b.badge ? el('span', { class: 'badge' }, b.badge) : el('span', { class: 'badge gray' }, `${b.order}번째`),
      el('h3', { style: 'margin-top:6px' }, b.title),
      el('div', { class: 'muted small' }, `${b.author} · ${b.publisher}`),
      el('p', { class: 'small', style: 'margin-top:6px' }, b.note)))),

    el('h2', {}, '영상과 무료 자료'),
    el('div', { class: 'grid' }, r.MEDIA.map((m) => el('a', { class: 'card', href: m.url, target: '_blank', rel: 'noopener' },
      el('h3', {}, m.title),
      el('div', { class: 'muted small' }, m.by),
      el('p', { class: 'small', style: 'margin-top:6px' }, m.note)))));
}

// ---------- 시작 ----------

api('GET', '/api/meta').then((meta) => {
  META = meta;
  route();
}).catch((err) => {
  $app.replaceChildren(el('p', {}, `서버에 연결할 수 없습니다: ${err.message}`));
});
