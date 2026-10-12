'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {actionable}=require('../ci-remediation-comment.cjs');
test('failed lint check produces actionable diagnostic, no retry request',()=>{
 const pr={number:316,head:{sha:'abc'}};
 const checks=[{name:'verify',head_sha:'abc',status:'completed',conclusion:'failure'}];
 const result=actionable({pr,checks});
 assert.equal(result.failures.length,1);
 assert.match(result.body,/Inspect.*CI logs|Investigate CI logs/i);
 assert.ok(result.pending.includes('verify'));
});
test('old SHA failures do not contaminate current SHA',()=>{
 const pr={number:314,head:{sha:'new'}};
 const result=actionable({pr,checks:[{name:'verify',head_sha:'old',status:'completed',conclusion:'failure'}]});
 assert.equal(result.failures.length,0);
 assert.ok(result.pending.includes('verify'));
});
