'use strict';

const {readFileSync} = require('node:fs');

const destructivePatterns = [
  /\bdrop\s+(?:table|column|index|schema|database)\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\balter\s+table\b[\s\S]*?\bdrop\s+column\b/i,
  /\balter\s+column\b/i,
];

function analyzeMigrationSql(sql) {
  if (typeof sql !== 'string' || !sql.trim()) {
    throw new Error('Migration SQL is empty');
  }
  const matches = destructivePatterns
    .filter((pattern) => pattern.test(sql))
    .map((pattern) => pattern.source);
  return {destructive: matches.length > 0, matches};
}

function validateAuthorization({sha, digest, authorization}) {
  if (!authorization) return {authorized: false, reason: 'missing database authorization'};
  if (!/^[a-f0-9]{40}:sha256:[a-f0-9]{64}$/.test(authorization)) {
    return {authorized: false, reason: 'database authorization must be <sha>:sha256:<digest>'};
  }
  if (authorization !== `${sha}:${digest}`) {
    return {authorized: false, reason: 'database authorization does not match the approved SHA and migration digest'};
  }
  return {authorized: true};
}

function evaluateMigration({sha, digest, sql, authorization}) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Approved SHA must be a full lowercase commit SHA');
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Migration digest must be sha256:<64 hex characters>');
  const risk = analyzeMigrationSql(sql);
  const approval = validateAuthorization({sha, digest, authorization});
  if (!approval.authorized) {
    throw new Error(`Migration approval required: ${approval.reason}`);
  }
  return {sha, digest, destructive: risk.destructive, matches: risk.matches, authorized: true};
}

if (require.main === module) {
  const [sqlPath, sha, digest, authorization = ''] = process.argv.slice(2);
  const sql = readFileSync(sqlPath, 'utf8');
  const result = evaluateMigration({sha, digest, sql, authorization});
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

module.exports = {analyzeMigrationSql, validateAuthorization, evaluateMigration};
