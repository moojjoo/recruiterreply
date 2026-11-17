'use strict';

const knowledge = require('../../docs/support-agent/knowledge.v1.json');
const evaluation = require('../../docs/support-agent/evaluation.v1.json');
const validCaseIds = new Set(evaluation.cases.map(item => item.id));
const MAX_QUESTION_LENGTH = 500;
const fallback = 'A human support reviewer must check this request. Do not share passwords, tokens, payment details, or private recruiting content.';
const normalize = value => value.trim().toLowerCase().replace(/[?!.]+$/g, '').replace(/\s+/g, ' ');

/**
 * Offline synthetic-only baseline. Exact curated questions are deliberately
 * required: an untrusted question cannot select tools, change policy, or become
 * an instruction. There is no model, network, account access, or send capability.
 */
function draftSupportReply(question) {
  const base = { mode: 'draft-only', requiresHumanReview: true, canSend: false, knowledgeVersion: knowledge.version };
  if (typeof question !== 'string' || !question.trim() || question.length > MAX_QUESTION_LENGTH) {
    return { ...base, outcome: 'escalate', reason: 'invalid-input', category: 'unknown', text: fallback, sources: [] };
  }
  const query = normalize(question);
  const article = knowledge.articles.find(item => item.questions.some(q => normalize(q) === query));
  if (!article) {
    return { ...base, outcome: 'escalate', reason: 'unsupported-question', category: 'unknown', text: fallback, sources: [] };
  }
  return {
    ...base, outcome: article.escalate ? 'escalate' : 'draft',
    reason: article.escalate ? 'human-only-policy' : 'exact-curated-question',
    category: article.category, articleId: article.id,
    text: article.answer, sources: article.sources.map(source => ({ ...source }))
  };
}

// Feedback retains only bounded, synthetic evaluation identifiers and enums.
// Raw tickets, answers, user identifiers and free-text feedback are never logged.
function summarizeFeedback(records) {
  const result = { reviewed: 0, correct: 0, incorrect: 0, needsReview: 0 };
  const seen = new Set();
  for (const record of records) {
    if (!record || !validCaseIds.has(record.caseId) ||
        !['correct', 'incorrect', 'needs-review'].includes(record.verdict) ||
        Object.keys(record).some(key => !['caseId', 'verdict'].includes(key)) ||
        seen.has(record.caseId)) throw new Error('Invalid or duplicate synthetic feedback record');
    seen.add(record.caseId);
    result.reviewed++;
    if (record.verdict === 'correct') result.correct++;
    else if (record.verdict === 'incorrect') result.incorrect++;
    else result.needsReview++;
  }
  return result;
}

module.exports = { draftSupportReply, summarizeFeedback, MAX_QUESTION_LENGTH };
