const path = require('path');
const express = require('express');
const { createStore, NotFoundError, ValidationError } = require('./src/store');
const content = require('./src/content');
const { reviewToMarkdown } = require('./src/markdown');

function createApp({ dataDir }) {
  const store = createStore(dataDir);
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  // async 핸들러의 오류를 공통 처리기로 넘긴다.
  const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  app.get('/api/meta', (req, res) => res.json(content));

  app.get('/api/reviews', h(async (req, res) => res.json(await store.list())));
  app.post('/api/reviews', h(async (req, res) => res.status(201).json(await store.create(req.body || {}))));
  app.get('/api/reviews/:id', h(async (req, res) => res.json(await store.get(req.params.id))));
  app.patch('/api/reviews/:id', h(async (req, res) => res.json(await store.update(req.params.id, req.body || {}))));
  app.delete('/api/reviews/:id', h(async (req, res) => {
    await store.remove(req.params.id);
    res.status(204).end();
  }));

  app.get('/api/reviews/:id/export.md', h(async (req, res) => {
    const review = await store.get(req.params.id);
    const name = encodeURIComponent(`${review.date || 'undated'}-${review.title}.md`);
    res.type('text/markdown; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${name}`);
    res.send(reviewToMarkdown(review));
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof NotFoundError) return res.status(404).json({ error: '찾을 수 없습니다.' });
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: '내용이 너무 깁니다.' });
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
