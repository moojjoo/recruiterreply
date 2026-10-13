'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {classifyRisk,validateReadiness} = require('./pr-readiness.cjs');

test('docs and styles are low risk',()=>assert.equal(classifyRisk(['README.md','frontend/src/App.css']),'low'));
test('ordinary app and unit test code is medium',()=>assert.equal(classifyRisk(['frontend/src/components/Card.tsx','backend/Features/Report.cs']),'medium'));
test('mixed sensitive changes escalate to high',()=>assert.equal(classifyRisk(['frontend/src/App.tsx','infra/aws/terraform/main.tf']),'high'));
for(const path of ['.github/workflows/execute-pr-automation.yml','frontend/src/auth/Login.tsx','backend/Payments/StripeWebhook.cs','frontend/package-lock.json','backend/Program.cs','backend/Migrations/AddUser.cs','unknown/feature.ts','frontend/src/config.ts']) {
  test('sensitive or unknown path blocked: '+path,()=>assert.equal(classifyRisk([path]),'high'));
}
test('deleted file requires review',()=>assert.equal(classifyRisk([{filename:'frontend/src/App.tsx',status:'removed'}]),'high'));
test('rename from sensitive path requires review',()=>assert.equal(classifyRisk([{filename:'frontend/src/App.tsx',previous_filename:'backend/Payments/Stripe.cs',status:'renamed'}]),'high'));
test('malformed paths fail closed',()=>assert.equal(classifyRisk(['../frontend/src/App.tsx']),'high'));
test('empty change list fails closed',()=>assert.equal(classifyRisk([]),'high'));
const sha='a'.repeat(40);
const checks=['verify','test','analyze (javascript-typescript)','analyze (csharp)'].map(name=>({name,head_sha:sha,status:'completed',conclusion:'success'}));
const pr={draft:false,head:{sha},labels:[{name:'automation-ready'}],body:'## Implementation evidence\nCommit abc passed verification workflow tests.\n## Acceptance criteria\n- [x] Feature implemented'};
test('medium code with complete checks is eligible',()=>assert.equal(validateReadiness({pr,checks,changedFiles:[{filename:'frontend/src/App.tsx',status:'modified'}]}).eligible,true));
test('high-risk code cannot auto-merge even with labels and checks',()=>assert.equal(validateReadiness({pr,checks,changedFiles:[{filename:'infra/aws/terraform/main.tf',status:'modified'}]}).eligible,false));
test('missing required check blocks medium PR',()=>assert.equal(validateReadiness({pr,checks:checks.slice(1),changedFiles:['frontend/src/App.tsx']}).eligible,false));
test('changed head SHA blocks stale checks',()=>assert.equal(validateReadiness({pr:{...pr,head:{sha:'b'.repeat(40)}},checks,changedFiles:['frontend/src/App.tsx']}).eligible,false));
test('unresolved thread blocks',()=>assert.equal(validateReadiness({pr,checks,threads:[{isResolved:false,isOutdated:false}],changedFiles:['frontend/src/App.tsx']}).eligible,false));
