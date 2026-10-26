const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

let server;
let base;
let dataDir;

async function call(method, url, body, headers = {}) {
  const opts = { method, headers: { ...headers } };
  if (body !== undefined) {
    if (Buffer.isBuffer(body)) opts.body = body;
    else {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
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

test('메타 정보에 연습 유형과 자료가 포함된다', async () => {
  const { status, data } = await call('GET', '/api/meta');
  assert.equal(status, 200);
  assert.ok(data.exercises.some((e) => e.id === 'five-questions'));
  assert.equal(data.essaySections.length, 4);
  assert.equal(data.resources.BOOKS.length, 4);
});

test('작품 등록 → 연습 기록 → 감상문 → 내보내기 흐름', async () => {
  const created = await call('POST', '/api/works', {
    type: 'performance', title: '갈매기', date: '2026-10-20', venue: '명동예술극장', creators: '체호프', tags: '연극, 고전',
  });
  assert.equal(created.status, 201);
  const work = created.data;
  assert.deepEqual(work.tags, ['연극', '고전']);
  assert.ok(fs.existsSync(path.join(dataDir, 'works', `${work.id}.json`)), '작품은 JSON 파일로 저장된다');

  const note = await call('POST', `/api/works/${work.id}/notes`, {
    exercise: 'five-questions',
    answers: { scene: '니나의 마지막 장면', q5: '고통을 받아들이는 건 체념일까 성숙일까?', unknownKey: 'x' },
  });
  assert.equal(note.status, 201);
  assert.equal(note.data.answers.q5, '고통을 받아들이는 건 체념일까 성숙일까?');
  assert.equal(note.data.answers.unknownKey, undefined, '정의되지 않은 칸은 버린다');
  assert.equal(note.data.answers.q1, '');

  const upd = await call('PUT', `/api/works/${work.id}/notes/${note.data.id}`, { answers: { scene: '니나가 떠난 뒤의 적막', q5: '체념일까 성숙일까?' } });
  assert.equal(upd.data.answers.scene, '니나가 떠난 뒤의 적막');

  const essay = await call('POST', `/api/works/${work.id}/essays`, {
    title: '적막',
    target: 200,
    sections: { intro: '가장 오래 남은 것은 적막이었다.', closing: '우리는 꼭 행복해져야 할까?' },
    checks: { concrete: true },
  });
  assert.equal(essay.status, 201);
  assert.equal(essay.data.sections.describe, '');
  assert.equal(essay.data.checks.concrete, true);
  assert.equal(essay.data.checks.newQuestion, false);

  const questions = await call('GET', '/api/questions');
  assert.deepEqual(questions.data.map((q) => q.text), ['체념일까 성숙일까?']);

  const md = await call('GET', `/api/works/${work.id}/export.md`);
  assert.equal(md.status, 200);
  assert.match(md.headers.get('content-type'), /text\/markdown/);
  assert.match(md.data, /^# 갈매기/);
  assert.match(md.data, /가장 오래 남은 것은 적막이었다\.\n\n우리는 꼭 행복해져야 할까\?/);
  assert.match(md.data, /한 장면에 질문 다섯 개/);

  const activity = await call('GET', `/api/activity?from=${encodeURIComponent('2000-01-01T00:00:00.000Z')}`);
  assert.equal(activity.data.length, 2);

  const list = await call('GET', '/api/works');
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].essays.length, 1);
});

test('잘못된 입력과 경로', async () => {
  assert.equal((await call('POST', '/api/works', { title: '  ' })).status, 400);
  assert.equal((await call('POST', '/api/works', { title: 'x', date: '20261020' })).status, 400);
  assert.equal((await call('GET', '/api/works/..%2F..%2Fpackage')).status, 404);
  assert.equal((await call('GET', '/api/works/abcdef123456')).status, 404);
  const w = (await call('POST', '/api/works', { title: '전시', type: 'nope' })).data;
  assert.equal(w.type, 'etc');
  assert.equal((await call('POST', `/api/works/${w.id}/notes`, { exercise: 'nope' })).status, 400);
  assert.equal((await call('PUT', `/api/works/${w.id}/essays/ffffffffffff`, { title: 'x' })).status, 404);
});

test('포스터 업로드와 작품 삭제 시 파일 정리', async () => {
  const w = (await call('POST', '/api/works', { title: '포스터 테스트', type: 'exhibition' })).data;
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const up = await call('PUT', `/api/works/${w.id}/poster`, png, { 'Content-Type': 'image/png' });
  assert.equal(up.status, 200);
  const posterPath = path.join(dataDir, 'uploads', up.data.poster);
  assert.ok(fs.existsSync(posterPath));
  assert.equal((await call('GET', `/uploads/${up.data.poster}`)).status, 200);

  const bad = await call('PUT', `/api/works/${w.id}/poster`, Buffer.from('hi'), { 'Content-Type': 'image/svg+xml' });
  assert.equal(bad.status, 400);

  assert.equal((await call('DELETE', `/api/works/${w.id}`)).status, 204);
  assert.ok(!fs.existsSync(posterPath));
  assert.equal((await call('GET', `/api/works/${w.id}`)).status, 404);
});

test('동시에 여러 연습을 추가해도 기록이 사라지지 않는다', async () => {
  const w = (await call('POST', '/api/works', { title: '동시성' })).data;
  await Promise.all(Array.from({ length: 10 }, (_, i) =>
    call('POST', `/api/works/${w.id}/notes`, { exercise: 'capture', answers: { scene1: `장면 ${i}` } })));
  const got = (await call('GET', `/api/works/${w.id}`)).data;
  assert.equal(got.notes.length, 10);
});

test('루틴 시작일 설정', async () => {
  assert.equal((await call('GET', '/api/settings')).data.routineStart, '');
  assert.equal((await call('PUT', '/api/settings', { routineStart: '2026-10-26' })).data.routineStart, '2026-10-26');
  assert.equal((await call('PUT', '/api/settings', { routineStart: 'tomorrow' })).status, 400);
});
