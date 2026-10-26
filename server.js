const path = require('path');
const express = require('express');
const { createStore, NotFoundError, ValidationError } = require('./src/store');
const exercises = require('./src/exercises');
const resources = require('./src/resources');
const { workToMarkdown } = require('./src/markdown');

function createApp({ dataDir }) {
  const store = createStore(dataDir);
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/uploads', express.static(store.uploadsDir));

  // async 핸들러의 오류를 공통 처리기로 넘긴다.
  const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  app.get('/api/meta', (req, res) => {
    res.json({
      exercises: exercises.EXERCISES,
      typeHints: exercises.TYPE_HINTS,
      workTypes: exercises.WORK_TYPES,
      essaySections: exercises.ESSAY_SECTIONS,
      essayTargets: exercises.ESSAY_TARGETS,
      vagueWords: exercises.VAGUE_WORDS,
      selfChecks: exercises.SELF_CHECKS,
      weeklyRoutine: exercises.WEEKLY_ROUTINE,
      fourWeekPlan: exercises.FOUR_WEEK_PLAN,
      resources,
    });
  });

  app.get('/api/works', h(async (req, res) => res.json(await store.listWorks())));
  app.post('/api/works', h(async (req, res) => res.status(201).json(await store.createWork(req.body || {}))));
  app.get('/api/works/:id', h(async (req, res) => res.json(await store.getWork(req.params.id))));
  app.put('/api/works/:id', h(async (req, res) => res.json(await store.updateWork(req.params.id, req.body || {}))));
  app.delete('/api/works/:id', h(async (req, res) => {
    await store.deleteWork(req.params.id);
    res.status(204).end();
  }));

  app.put(
    '/api/works/:id/poster',
    express.raw({ type: 'image/*', limit: '10mb' }),
    h(async (req, res) => res.json(await store.setPoster(req.params.id, req.get('content-type'), req.body))),
  );

  app.get('/api/works/:id/export.md', h(async (req, res) => {
    const work = await store.getWork(req.params.id);
    const name = encodeURIComponent(`${work.date || 'undated'}-${work.title}.md`);
    res.type('text/markdown; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${name}`);
    res.send(workToMarkdown(work));
  }));

  app.post('/api/works/:id/notes', h(async (req, res) => res.status(201).json(await store.addNote(req.params.id, req.body || {}))));
  app.put('/api/works/:id/notes/:noteId', h(async (req, res) => res.json(await store.updateNote(req.params.id, req.params.noteId, req.body || {}))));
  app.delete('/api/works/:id/notes/:noteId', h(async (req, res) => {
    await store.deleteNote(req.params.id, req.params.noteId);
    res.status(204).end();
  }));

  app.post('/api/works/:id/essays', h(async (req, res) => res.status(201).json(await store.addEssay(req.params.id, req.body || {}))));
  app.put('/api/works/:id/essays/:essayId', h(async (req, res) => res.json(await store.updateEssay(req.params.id, req.params.essayId, req.body || {}))));
  app.delete('/api/works/:id/essays/:essayId', h(async (req, res) => {
    await store.deleteEssay(req.params.id, req.params.essayId);
    res.status(204).end();
  }));

  app.get('/api/questions', h(async (req, res) => res.json(await store.listQuestions())));
  app.get('/api/activity', h(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    res.json(await store.listActivity(from));
  }));
  app.get('/api/settings', h(async (req, res) => res.json(await store.getSettings())));
  app.put('/api/settings', h(async (req, res) => res.json(await store.updateSettings(req.body || {}))));

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof NotFoundError) return res.status(404).json({ error: '찾을 수 없습니다.' });
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: '파일이 너무 큽니다.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' });
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
  createApp({ dataDir }).listen(port, host, () => {
    console.log(`감상 연습장: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`데이터 폴더: ${dataDir}`);
  });
}

module.exports = { createApp };
