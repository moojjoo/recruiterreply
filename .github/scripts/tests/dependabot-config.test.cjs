'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const config = fs.readFileSync(path.resolve(__dirname, '../../dependabot.yml'), 'utf8');

test('ecosystem schedules are staggered in an explicit timezone', () => {
  for (const [ecosystem, day] of [
    ['nuget', 'monday'],
    ['npm', 'tuesday'],
    ['github-actions', 'wednesday'],
    ['terraform', 'thursday'],
  ]) {
    const start = config.indexOf(`package-ecosystem: "${ecosystem}"`);
    assert.notEqual(start, -1);
    const next = config.indexOf('package-ecosystem:', start + 1);
    const block = config.slice(start, next === -1 ? undefined : next);
    assert.match(block, new RegExp(`day: "${day}"`));
    assert.match(block, /timezone: "America\/New_York"/);
    assert.match(block, /open-pull-requests-limit: [1-9]/);
  }
});

test('only npm and NuGet group patch and minor version updates', () => {
  for (const ecosystem of ['nuget', 'npm']) {
    const start = config.indexOf(`package-ecosystem: "${ecosystem}"`);
    const next = config.indexOf('package-ecosystem:', start + 1);
    const block = config.slice(start, next);
    assert.match(block, /groups:/);
    assert.match(block, /update-types:[\s\S]*- "minor"[\s\S]*- "patch"/);
  }
  for (const ecosystem of ['github-actions', 'terraform']) {
    const start = config.indexOf(`package-ecosystem: "${ecosystem}"`);
    const next = config.indexOf('package-ecosystem:', start + 1);
    const block = config.slice(start, next === -1 ? undefined : next);
    assert.doesNotMatch(block, /groups:/);
  }
});

test('version-update cooldowns and bounded queues are explicit', () => {
  assert.equal((config.match(/cooldown:/g) || []).length, 4);
  assert.equal((config.match(/open-pull-requests-limit:/g) || []).length, 4);
});
