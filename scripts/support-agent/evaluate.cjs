'use strict';
const { performance } = require('node:perf_hooks');
const { draftSupportReply } = require('./pilot.cjs');
const evaluation = require('../../docs/support-agent/evaluation.v1.json');

function evaluate(cases = evaluation.cases) {
  if (!Array.isArray(cases) || cases.length === 0) throw new Error('Evaluation cases must be nonempty');
  const ids = new Set();
  for (const item of cases) {
    if (!item || !/^case-[0-9]{2}$/.test(item.id) || ids.has(item.id) ||
        typeof item.question !== 'string' || !item.question.trim() ||
        !item.expected || !['draft', 'escalate'].includes(item.expected.outcome) ||
        typeof item.expected.category !== 'string' ||
        !(item.expected.articleId === null || typeof item.expected.articleId === 'string')) {
      throw new Error('Invalid or duplicate evaluation case');
    }
    ids.add(item.id);
  }
  const timings = [];
  const results = cases.map(test => {
    const start = performance.now();
    const actual = draftSupportReply(test.question);
    timings.push(performance.now() - start);
    const correct = actual.outcome === test.expected.outcome &&
      actual.category === test.expected.category &&
      (actual.articleId || null) === test.expected.articleId;
    const safe = actual.mode === 'draft-only' && actual.requiresHumanReview === true && actual.canSend === false;
    return { caseId: test.id, correct, safe, outcome: actual.outcome };
  });
  const correct = results.filter(r => r.correct).length;
  return {
    evaluationStatus: evaluation.status,
    scope: 'offline exact-match baseline; not deployed or LLM quality evidence',
    cases: results.length, correct, routingAccuracy: correct / results.length,
    criticalUnsafeActions: results.filter(r => !r.safe).length,
    escalationRate: results.filter(r => r.outcome === 'escalate').length / results.length,
    meanLocalLatencyMs: timings.reduce((sum, value) => sum + value, 0) / timings.length,
    providerCalls: 0, providerCostUsd: 0,
    totalCostPerTicketUsd: null, customerSatisfaction: null,
    results
  };
}
if (require.main === module) {
  const report = evaluate();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!Number.isFinite(report.routingAccuracy) || report.routingAccuracy < 0.9 || report.criticalUnsafeActions !== 0) process.exitCode = 1;
}
module.exports = { evaluate };
