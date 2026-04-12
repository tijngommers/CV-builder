import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from './index.js';

test('GET /api/health returns service status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, 'cv-pdf-service');
});

test('POST /api/sessions creates a new session with latexSource', async () => {
  const response = await request(app).post('/api/sessions').send({});

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.sessionId, 'string');
  assert.equal(typeof response.body.createdAt, 'string');
  assert.equal(response.body.latexSource, '');
});

test('GET /api/sessions/:sessionId returns session state', async () => {
  const created = await request(app).post('/api/sessions').send({});
  const sessionId = created.body.sessionId;

  const response = await request(app).get(`/api/sessions/${sessionId}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.sessionId, sessionId);
  assert.equal(Array.isArray(response.body.messages), true);
  assert.equal(Array.isArray(response.body.latexHistory), true);
  assert.equal(typeof response.body.latexSource, 'string');
});

test('SSE chat returns user_message, assistant_message, and done events', async () => {
  const created = await request(app).post('/api/sessions').send({});
  const sessionId = created.body.sessionId;

  const response = await request(app)
    .post(`/api/sessions/${sessionId}/chat`)
    .set('Accept', 'text/event-stream')
    .send({ message: 'Create a minimal software engineer resume in LaTeX.' });

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/event-stream/);
  assert.match(response.text, /event: user_message/);
  assert.match(response.text, /event: assistant_message/);
  assert.match(response.text, /event: done/);
});

test('chat turn persists message history and latex source in session', async () => {
  const created = await request(app).post('/api/sessions').send({});
  const sessionId = created.body.sessionId;

  await request(app)
    .post(`/api/sessions/${sessionId}/chat`)
    .set('Accept', 'text/event-stream')
    .send({ message: 'Add contact section with email and phone.' });

  const sessionResponse = await request(app).get(`/api/sessions/${sessionId}`);
  assert.equal(sessionResponse.status, 200);

  const { messages, latexSource } = sessionResponse.body;
  assert.equal(Array.isArray(messages), true);
  assert.equal(messages.length >= 2, true);
  assert.equal(messages[0].role, 'user');
  assert.equal(messages[1].role, 'assistant');
  assert.equal(typeof latexSource, 'string');
  assert.equal(latexSource.length > 0, true);
});

test('multi-turn updates preserve LaTeX header and document anchors', async () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = '';

  try {
    const created = await request(app).post('/api/sessions').send({});
    const sessionId = created.body.sessionId;

    await request(app)
      .post(`/api/sessions/${sessionId}/chat`)
      .set('Accept', 'text/event-stream')
      .send({ message: 'Mijn naam is Tijn Gommers.' });

    await request(app)
      .post(`/api/sessions/${sessionId}/chat`)
      .set('Accept', 'text/event-stream')
      .send({ message: 'Voeg ook mijn opleiding toe.' });

    const sessionResponse = await request(app).get(`/api/sessions/${sessionId}`);
    assert.equal(sessionResponse.status, 200);

    const { latexSource } = sessionResponse.body;
    assert.equal(typeof latexSource, 'string');
    assert.match(latexSource, /\\documentclass/);
    assert.match(latexSource, /\\begin\{document\}/);
    assert.match(latexSource, /\\end\{document\}/);
    assert.match(latexSource, /CONTACT|Resume Draft|Full Name/);
  } finally {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  }
});

test('DELETE /api/sessions/:sessionId/history/:index reverts previous version', async () => {
  const created = await request(app).post('/api/sessions').send({});
  const sessionId = created.body.sessionId;

  await request(app)
    .post(`/api/sessions/${sessionId}/chat`)
    .set('Accept', 'text/event-stream')
    .send({ message: 'Add summary section.' });

  await request(app)
    .post(`/api/sessions/${sessionId}/chat`)
    .set('Accept', 'text/event-stream')
    .send({ message: 'Now add skills section.' });

  const beforeRevert = await request(app).get(`/api/sessions/${sessionId}`);
  assert.equal(beforeRevert.status, 200);
  assert.equal(beforeRevert.body.latexHistory.length >= 1, true);

  const revertResponse = await request(app).delete(`/api/sessions/${sessionId}/history/0`);
  assert.equal(revertResponse.status, 200);
  assert.equal(revertResponse.body.sessionId, sessionId);
  assert.equal(typeof revertResponse.body.latexSource, 'string');
  assert.equal(Array.isArray(revertResponse.body.latexHistory), true);
});

test('DELETE /api/sessions/:sessionId/history/:index returns 400 for invalid index', async () => {
  const created = await request(app).post('/api/sessions').send({});
  const sessionId = created.body.sessionId;

  const response = await request(app).delete(`/api/sessions/${sessionId}/history/99`);

  assert.equal(response.status, 400);
  assert.match(response.body.error, /Invalid history index/);
});
