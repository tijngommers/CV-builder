import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from './index.js';

const minimalCompleteCv = {
  personalInfo: {
    name: 'Tijn Gommers',
    Birthdate: '16/07/2005'
  },
  contact: {
    phonenumber: '+32123456789',
    email: 'tijn@example.com',
    adress: 'Leuven'
  },
  Profile: 'Computer science student focused on AI and product building.',
  Work_experience: {
    'PAL tutor': {
      company: 'VTK Leuven',
      period: '2025',
      description: 'Tutored first-year students.'
    }
  },
  Education: {
    '2023-2026': {
      institution: 'KU Leuven',
      degree: 'Bachelor in Computer Science'
    }
  }
};

test('POST /api/sessions initializes strict missing field state', async () => {
  const response = await request(app)
    .post('/api/sessions')
    .send({ cvData: { personalInfo: { name: 'Tijn' } } });

  assert.equal(response.status, 201);
  assert.ok(response.body.sessionId);
  assert.ok(Array.isArray(response.body.missingRequiredFields));
  assert.equal(response.body.requiredFieldsComplete, false);
  assert.ok(response.body.missingRequiredFields.includes('contact.email'));
});

test('SSE chat returns contract events and completion status', async () => {
  const sessionResponse = await request(app)
    .post('/api/sessions')
    .send({ cvData: {} });

  const sessionId = sessionResponse.body.sessionId;

  const response = await request(app)
    .post(`/api/sessions/${sessionId}/chat`)
    .set('Accept', 'text/event-stream')
    .send({
      message: 'Here are my details',
      updates: minimalCompleteCv
    });

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/event-stream/);
  assert.match(response.text, /event: user_message/);
  assert.match(response.text, /event: cv_data_updated/);
  assert.match(response.text, /event: assistant_message/);
  assert.match(response.text, /event: done/);
  assert.match(response.text, /"requiredFieldsComplete":true/);
});

test('POST /api/latex-source returns latex payload and required field state', async () => {
  const response = await request(app)
    .post('/api/latex-source')
    .send({ cvData: minimalCompleteCv });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.latexSource, 'string');
  assert.match(response.body.latexSource, /\\documentclass/);
  assert.equal(response.body.requiredFieldsComplete, true);
  assert.deepEqual(response.body.missingRequiredFields, []);
});
