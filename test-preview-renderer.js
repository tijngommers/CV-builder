#!/usr/bin/env node
/**
 * Test script for preview renderer endpoint
 * Usage: node test-preview-renderer.js
 */

import { startServer } from './server/index.js';
import http from 'node:http';

const TEST_PORT = 3002;
const TEST_DATA = {
  personalInfo: {
    name: 'John Doe',
    Birthdate: '1990-01-01'
  },
  contact: {
    email: 'john@example.com',
    phonenumber: '+1 (234) 567-8900',
    adress: '123 Main Street, City, State'
  },
  Profile: 'Full-stack developer with 5+ years of experience.',
  Work_experience: {
    'Senior Developer': {
      company: 'Tech Corp',
      period: '2021 - Present',
      description: 'Led development of microservices'
    }
  },
  Education: {
    '2018': {
      institution: 'University Name',
      degree: 'B.S. Computer Science',
      period: '2014 - 2018'
    }
  },
  skills: {
    programmingLanguages: ['JavaScript', 'Python', 'Java'],
    frameworks: ['React', 'Node.js', 'Express']
  },
  languages: {
    English: 'Native',
    Spanish: 'Fluent'
  },
  Hackathons: {},
  Prizes: {},
  Hobbies: ['Open source', 'Tech blogging']
};

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = Buffer.alloc(0);

      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data.toString('utf8', 0, Math.min(data.length, 500)) // First 500 chars for preview
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('Starting server on port', TEST_PORT);
  startServer(TEST_PORT);

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    // Test health endpoint
    console.log('\n✓ Testing /api/health...');
    const healthRes = await makeRequest('GET', '/api/health');
    console.log(`  Status: ${healthRes.statusCode}`);
    console.log(`  Body: ${healthRes.body}`);

    // Test queue stats (should be empty initially)
    console.log('\n✓ Testing /api/queue-stats...');
    const statsRes = await makeRequest('GET', '/api/queue-stats');
    console.log(`  Status: ${statsRes.statusCode}`);
    console.log(`  Body: ${statsRes.body}`);

    // Test render preview
    console.log('\n✓ Testing /api/render-preview...');
    const previewRes = await makeRequest('POST', '/api/render-preview', TEST_DATA);
    console.log(`  Status: ${previewRes.statusCode}`);
    console.log(`  Content-Type: ${previewRes.headers['content-type']}`);
    console.log(`  Content-Disposition: ${previewRes.headers['content-disposition']}`);
    console.log(`  Cache-Key: ${previewRes.headers['x-cache-key']?.slice(0, 16)}...`);
    console.log(`  Cache-Hit: ${previewRes.headers['x-cache-hit']}`);
    console.log(`  Compilation Exit Code: ${previewRes.headers['x-compilation-exit-code']}`);
    console.log(`  Body (first 100 chars): ${previewRes.body.slice(0, 100)}...`);

    // Test cache hit - same data should hit cache
    console.log('\n✓ Testing cache hit (same data)...');
    const cachedRes = await makeRequest('POST', '/api/render-preview', TEST_DATA);
    console.log(`  Status: ${cachedRes.statusCode}`);
    console.log(`  Cache-Hit: ${cachedRes.headers['x-cache-hit']}`);

    // Test invalid data
    console.log('\n✓ Testing invalid request...');
    const invalidRes = await makeRequest('POST', '/api/render-preview', null);
    console.log(`  Status: ${invalidRes.statusCode}`);
    console.log(`  Error: ${invalidRes.body.slice(0, 100)}...`);

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exitCode = 1;
  }

  process.exit(0);
}

runTests();
