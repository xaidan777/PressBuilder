import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';

test('local Vite HTTP API handles scene tasks, conflicts and bounded JSON', {timeout: 45000}, async () => {
  const id = 'pr-tasks-smoke-' + process.pid;
  const root = path.join(process.cwd(), 'src', 'decks', id);
  const vite = await createServer({
    configFile: 'vite.config.ts',
    logLevel: 'error',
    server: {host: '127.0.0.1', port: 0, open: false, strictPort: false},
  });
  try {
    await vite.listen();
    const address = vite.httpServer?.address();
    assert.ok(address && typeof address !== 'string');
    const base = 'http://127.0.0.1:' + address.port;
    const request = async (method, route, payload) => {
      const response = await fetch(base + route, {
        method,
        headers: payload === undefined ? {} : {'Content-Type': 'application/json'},
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      return {status: response.status, text: await response.text()};
    };
    let response = await request('POST', '/api/decks', {
      id, title: 'Scene assignment API smoke', slides: [
        {id: 's01', label: 'Intro'}, {id: 's02', label: 'Outro'},
      ],
    });
    assert.equal(response.status, 200, response.text);

    response = await request('GET', '/api/decks/' + id + '/tasks');
    assert.equal(response.status, 200, response.text);
    assert.equal(JSON.parse(response.text).length, 2);

    response = await request('PUT', '/api/decks/' + id + '/tasks/s01', {
      expected_revision: 0, title: 'Animation', assignee: 'agent-01',
      checkpoints: [{id: 'preview', title: 'Preview reviewed', done: false}],
    });
    assert.equal(response.status, 200, response.text);
    assert.equal(JSON.parse(response.text).revision, 1);

    response = await request('PUT', '/api/decks/' + id + '/tasks/s01', {
      expected_revision: 0, title: 'Stale writer',
    });
    assert.equal(response.status, 409, response.text);

    response = await request('PATCH', '/api/decks/' + id + '/tasks/s01/checkpoints/preview', {
      expected_revision: 1, done: true, note: 'Frame checked',
    });
    assert.equal(response.status, 200, response.text);
    assert.equal(JSON.parse(response.text).revision, 2);

    response = await request('PATCH', '/api/decks/' + id + '/tasks/s01/checkpoints/preview', {
      expected_revision: 1, done: false, note: 'Stale update',
    });
    assert.equal(response.status, 409, response.text);

    response = await request('GET', '/api/decks/' + id + '/tasks/s01');
    assert.equal(JSON.parse(response.text).checkpoints[0].done, true);

    response = await request('GET', '/api/decks/' + id + '/tasks/s02');
    assert.equal(JSON.parse(response.text).revision, 0);

    // Independent clients submitting the same revision must not both succeed.
    const race = await Promise.all([
      request('PUT', '/api/decks/' + id + '/tasks/s02', {
        expected_revision: 0, title: 'Agent A',
      }),
      request('PUT', '/api/decks/' + id + '/tasks/s02', {
        expected_revision: 0, title: 'Agent B',
      }),
    ]);
    assert.deepEqual(race.map(x => x.status).sort(), [200, 409]);
    response = await request('GET', '/api/decks/' + id + '/tasks/s02');
    assert.equal(JSON.parse(response.text).revision, 1);

    // Malformed JSON must not become a generic 500 or change the task.
    const invalid = await fetch(base + '/api/decks/' + id + '/tasks/s01', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: '{not-json',
    });
    assert.equal(invalid.status, 400);
    response = await request('GET', '/api/decks/' + id + '/tasks/s01');
    assert.equal(JSON.parse(response.text).revision, 2);

    response = await request('PUT', '/api/decks/' + id + '/tasks/s01', {
      expected_revision: 2, brief: 'x'.repeat(140_000),
    });
    assert.equal(response.status, 413, response.text);
  } finally {
    await vite.close();
    fs.rmSync(root, {recursive: true, force: true});
  }
});
