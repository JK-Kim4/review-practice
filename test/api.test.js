const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

let server;
let base;
let dataDir;

async function call(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(base + url, opts);
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* 텍스트 응답 */ }
  return { status: res.status, data, headers: res.headers };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-practice-'));
  server = createApp({ dataDir }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('메타 정보에 분류와 작성 단계가 포함된다', async () => {
  const { status, data } = await call('GET', '/api/meta');
  assert.equal(status, 200);
  assert.deepEqual(data.CATEGORIES.map((c) => c.id), ['performance', 'exhibition', 'book', 'fair']);
  assert.deepEqual(data.STAGES.map((s) => s.id), ['capture', 'question', 'compose']);
  assert.equal(data.COMPOSE_SECTIONS.length, 4);
});

test('감상 남기기: 만들기 → 포착 → 질문 → 정리 → 완료 → 내보내기', async () => {
  const created = await call('POST', '/api/reviews', { category: 'performance', title: ' 갈매기 ', date: '2026-10-20', venue: '명동예술극장' });
  assert.equal(created.status, 201);
  const r = created.data;
  assert.equal(r.title, '갈매기');
  assert.equal(r.status, 'draft');
  assert.equal(r.stage, 'capture');
  assert.ok(fs.existsSync(path.join(dataDir, 'reviews', `${r.id}.json`)), '감상은 JSON 파일로 저장된다');

  let res = await call('PATCH', `/api/reviews/${r.id}`, { stage: 'capture', capture: { scene1: '니나의 마지막 장면', bogus: 'x' } });
  assert.equal(res.status, 200);
  assert.equal(res.data.capture.scene1, '니나의 마지막 장면');
  assert.equal(res.data.capture.bogus, undefined, '정의되지 않은 칸은 버린다');

  // 다른 단계의 내용을 저장해도 앞 단계 내용은 그대로 남는다
  res = await call('PATCH', `/api/reviews/${r.id}`, {
    stage: 'question',
    question: { scene: 'scene1', emotion: '슬펐다', whys: ['노력에는 보상이 따라야 한다고 믿어서', '2', '3', '4'], remaining: '체념일까 성숙일까?' },
  });
  assert.equal(res.data.capture.scene1, '니나의 마지막 장면');
  assert.equal(res.data.question.whys.length, 3, '왜? 칸은 최대 3개');
  assert.equal(res.data.stage, 'question');

  res = await call('PATCH', `/api/reviews/${r.id}`, { compose: { title: '적막', intro: '가장 오래 남은 것은 적막이었다.', closing: '우리는 꼭 행복해져야 할까?' } });
  assert.equal(res.data.compose.describe, '');
  assert.equal(res.data.question.emotion, '슬펐다');

  res = await call('PATCH', `/api/reviews/${r.id}`, { status: 'done' });
  assert.equal(res.data.status, 'done');
  assert.ok(res.data.completedAt);

  const md = await call('GET', `/api/reviews/${r.id}/export.md`);
  assert.equal(md.status, 200);
  assert.match(md.headers.get('content-type'), /text\/markdown/);
  assert.match(md.data, /^# 적막/);
  assert.match(md.data, /가장 오래 남은 것은 적막이었다\.\n\n우리는 꼭 행복해져야 할까\?/);
  assert.match(md.data, /> 남은 질문: 체념일까 성숙일까\?/);
  assert.match(md.data, /포착 · 장면 1\*\* 니나의 마지막 장면/);
});

test('목록은 관람일 최신순', async () => {
  await call('POST', '/api/reviews', { category: 'book', title: '옛날 책', date: '2025-01-01' });
  await call('POST', '/api/reviews', { category: 'exhibition', title: '최근 전시', date: '2026-10-25' });
  const list = (await call('GET', '/api/reviews')).data;
  assert.deepEqual(list.map((r) => r.title), ['최근 전시', '갈매기', '옛날 책']);
});

test('잘못된 입력과 경로', async () => {
  assert.equal((await call('POST', '/api/reviews', { title: '  ' })).status, 400);
  assert.equal((await call('POST', '/api/reviews', { title: 'x', category: 'movie' })).status, 400);
  assert.equal((await call('POST', '/api/reviews', { title: 'x', date: '20261020' })).status, 400);
  assert.equal((await call('GET', '/api/reviews/..%2F..%2Fpackage')).status, 404);
  assert.equal((await call('GET', '/api/reviews/abcdef123456')).status, 404);
  const r = (await call('POST', '/api/reviews', { title: '검증' })).data;
  assert.equal(r.category, 'performance');
  assert.equal((await call('PATCH', `/api/reviews/${r.id}`, { stage: 'done' })).status, 400);
  assert.equal((await call('PATCH', `/api/reviews/${r.id}`, { status: 'published' })).status, 400);
  assert.equal((await call('PATCH', `/api/reviews/${r.id}`, { title: '' })).status, 400);
  assert.equal((await call('GET', '/api/nope')).status, 404);
});

test('동시에 여러 칸을 저장해도 내용이 사라지지 않는다', async () => {
  const r = (await call('POST', '/api/reviews', { title: '동시성' })).data;
  await Promise.all([
    call('PATCH', `/api/reviews/${r.id}`, { capture: { scene1: 'a' } }),
    call('PATCH', `/api/reviews/${r.id}`, { question: { reason: 'b' } }),
    call('PATCH', `/api/reviews/${r.id}`, { compose: { intro: 'c' } }),
    call('PATCH', `/api/reviews/${r.id}`, { stage: 'compose' }),
  ]);
  const got = (await call('GET', `/api/reviews/${r.id}`)).data;
  assert.equal(got.capture.scene1, 'a');
  assert.equal(got.question.reason, 'b');
  assert.equal(got.compose.intro, 'c');
  assert.equal(got.stage, 'compose');
});

test('삭제', async () => {
  const r = (await call('POST', '/api/reviews', { title: '지울 것' })).data;
  assert.equal((await call('DELETE', `/api/reviews/${r.id}`)).status, 204);
  assert.equal((await call('GET', `/api/reviews/${r.id}`)).status, 404);
  assert.ok(!fs.existsSync(path.join(dataDir, 'reviews', `${r.id}.json`)));
});
