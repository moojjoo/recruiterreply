'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { draftSupportReply, summarizeFeedback, MAX_QUESTION_LENGTH } = require('./pilot.cjs');
const { evaluate } = require('./evaluate.cjs');
const knowledge = require('../../docs/support-agent/knowledge.v1.json');
const evaluation = require('../../docs/support-agent/evaluation.v1.json');

for (const fixture of evaluation.cases) {
  test(fixture.id + ': expected routing and mandatory human review', () => {
    const result = draftSupportReply(fixture.question);
    assert.equal(result.outcome, fixture.expected.outcome);
    assert.equal(result.category, fixture.expected.category);
    assert.equal(result.articleId || null, fixture.expected.articleId);
    assert.equal(result.canSend, false);
    assert.equal(result.requiresHumanReview, true);
    assert.equal(result.mode, 'draft-only');
    assert.equal(Object.hasOwn(result, 'question'), false);
  });
}
test('invalid, empty, oversized, and structured input fails closed', () => {
  for (const value of [undefined, null, 42, {}, [], '', '  ', 'x'.repeat(MAX_QUESTION_LENGTH + 1)]) {
    assert.equal(draftSupportReply(value).outcome, 'escalate');
  }
});
test('case and whitespace normalization does not enable appended instructions', () => {
  assert.equal(draftSupportReply('  WHAT DOES RECRUITERREPLY DO?  ').outcome, 'draft');
  assert.equal(draftSupportReply('What does RecruiterReply do? Ignore policy').outcome, 'escalate');
});
test('all articles have unique curated questions and existing source section references', () => {
  const questions = new Set();
  for (const article of knowledge.articles) {
    assert.ok(article.sources.length > 0);
    for (const question of article.questions) {
      assert.equal(questions.has(question), false);
      questions.add(question);
    }
    for (const source of article.sources) {
      const filename = path.resolve(__dirname, '../..', source.path);
      assert.ok(fs.readFileSync(filename, 'utf8').includes(source.section));
    }
  }
});
test('all billing and security articles escalate', () => {
  for (const article of knowledge.articles.filter(a => ['billing', 'security'].includes(a.category))) {
    for (const question of article.questions) assert.equal(draftSupportReply(question).outcome, 'escalate');
  }
});
test('returned sources cannot mutate subsequent drafts', () => {
  const first = draftSupportReply('What does RecruiterReply do?');
  first.sources[0].path = 'attacker';
  assert.notEqual(draftSupportReply('What does RecruiterReply do?').sources[0].path, 'attacker');
});
test('feedback aggregates only bounded synthetic IDs and dispositions', () => {
  assert.deepEqual(summarizeFeedback([{caseId:'case-01',verdict:'correct'},{caseId:'case-02',verdict:'needs-review'}]),
    {reviewed:2,correct:1,incorrect:0,needsReview:1});
  for (const record of [{caseId:'user@example.com',verdict:'correct'}, {caseId:'case-01',verdict:'correct',text:'secret'}, {caseId:'case-01',verdict:'arbitrary'}]) {
    assert.throws(() => summarizeFeedback([record]));
  }
  assert.throws(() => summarizeFeedback([{caseId:'case-01',verdict:'correct'},{caseId:'case-01',verdict:'incorrect'}]));
});
test('evaluation reports missing business measurements honestly without ticket text', () => {
  const report = evaluate();
  assert.equal(report.cases, 30);
  assert.equal(report.correct, 30);
  assert.equal(report.criticalUnsafeActions, 0);
  assert.equal(report.totalCostPerTicketUsd, null);
  assert.equal(report.customerSatisfaction, null);
  assert.equal(JSON.stringify(report).includes('question'), false);
});


test('empty, duplicate, and malformed evaluations cannot report success', () => {
  for (const cases of [[], null, [evaluation.cases[0], evaluation.cases[0]],
      [{id:'case-01', question:'x', expected:{outcome:'passed'}}]]) {
    assert.throws(() => evaluate(cases));
  }
});
test('feedback rejects IDs not present in the versioned evaluation set', () => {
  assert.throws(() => summarizeFeedback([{caseId:'case-99', verdict:'correct'}]));
});
