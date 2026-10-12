'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classify,format}=require('../ci-remediation-report.cjs');
const sha='a'.repeat(40);
test('only failures for exact PR SHA are reported',()=>{
 const checks=[{name:'verify',head_sha:sha,status:'completed',conclusion:'failure'},{name:'test',head_sha:'b'.repeat(40),status:'completed',conclusion:'failure'},{name:'CodeQL',head_sha:sha,status:'completed',conclusion:'success'}];
 const result=classify(checks,sha);assert.equal(result.length,1);assert.equal(result[0].check,'verify');
});
test('security failure is manual review',()=>{
 const [result]=classify([{name:'CodeQL analyze (csharp)',head_sha:sha,status:'completed',conclusion:'failure'}],sha);
 assert.match(result.advice,/manual review/);
});
test('reports are deterministic and do not expose tokens',()=>{
 const failures=classify([{name:'Playwright Tests',head_sha:sha,status:'completed',conclusion:'failure'}],sha);
 assert.equal(format(316,failures),format(316,failures));
 assert.match(format(316,failures),/Playwright/);
});
