'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflowsDir = path.resolve(__dirname, '../../workflows');
const externalUses = [];

for (const file of fs.readdirSync(workflowsDir).filter(name => name.endsWith('.yml'))) {
  const contents = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
  for (const [lineNumber, line] of contents.split(/\r?\n/).entries()) {
    const match = line.match(/\buses:\s+([^\s#]+)\s*(?:#\s*(v\d+))?/);
    if (!match || match[1].startsWith('./')) continue;
    externalUses.push({file, lineNumber: lineNumber + 1, reference: match[1], version: match[2]});
  }
}

test('every external workflow action is pinned to a full commit SHA with a version comment', () => {
  assert.ok(externalUses.length > 0);
  for (const use of externalUses) {
    assert.match(use.reference, /^[^@]+@[0-9a-f]{40}$/, `${use.file}:${use.lineNumber}`);
    assert.match(use.version || '', /^v\d+$/, `${use.file}:${use.lineNumber} should retain its upstream version comment`);
  }
});
