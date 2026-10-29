'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
 validateReadiness,classifyRisk,requiredCodeQLChecks,requiredCheckState,parseOwnerCommand,
 createAuthorizationRecord,formatAuthorizationComment,validateOwnerAuthorization
} = require('../pr-readiness.cjs');
const sha = 'abc123';
const names = ['verify','test','codeql required gate','analyze (javascript-typescript)','analyze (csharp)'];
function valid() {
 return {pr:{draft:false,labels:[{name:'automation-ready'}],head:{sha},body:'## Implementation evidence\nCommit abc123 and test verification workflow succeeded.\n\n## Acceptance criteria\n- [x] Implemented\n- [x] Tested\n'},checks:names.map(name=>({name,head_sha:sha,status:'completed',conclusion:'success'})),reviews:[],threads:[],dependenciesMerged:true,changedFiles:['README.md']};
}
test('complete PR eligible',()=>assert.equal(validateReadiness(valid()).eligible,true));
test('frontend-only changes require only JavaScript CodeQL',()=>assert.deepEqual(
 requiredCodeQLChecks([{filename:'frontend/src/App.tsx',status:'modified'}]),
 ['analyze (javascript-typescript)']
));
test('backend-only changes require only C# CodeQL',()=>assert.deepEqual(
 requiredCodeQLChecks([{filename:'backend/Services/ReplyService.cs',status:'modified'}]),
 ['analyze (csharp)']
));
test('cross-stack changes require both CodeQL analyses',()=>assert.deepEqual(
 requiredCodeQLChecks([{filename:'frontend/src/App.tsx',status:'modified'},{filename:'backend/Services/ReplyService.cs',status:'modified'}]),
 ['analyze (javascript-typescript)','analyze (csharp)']
));
test('shared or uncertain changes fail closed to both CodeQL analyses',()=>{
 assert.deepEqual(requiredCodeQLChecks([{filename:'.github/workflows/codeql.yml',status:'modified'}]), ['analyze (javascript-typescript)','analyze (csharp)']);
 assert.deepEqual(requiredCodeQLChecks([]), ['analyze (javascript-typescript)','analyze (csharp)']);
});
for (const [name,mutate] of [
 ['draft',x=>x.pr.draft=true],
 ['missing label',x=>x.pr.labels=[]],
 ['unchecked criterion',x=>x.pr.body+='- [ ] Pending\n'],
 ['missing evidence',x=>x.pr.body=x.pr.body.replace('Commit abc123 and test verification workflow succeeded.','none')],
 ['missing check',x=>x.checks.pop()],
 ['stale SHA',x=>x.checks[0].head_sha='old'],
 ['failed check',x=>x.checks[0].conclusion='failure'],
 ['dependency',x=>x.dependenciesMerged=false],
 ['changes requested',x=>x.reviews=[{user:{login:'reviewer'},state:'CHANGES_REQUESTED'}]],
 ['unresolved thread',x=>x.threads=[{isResolved:false,isOutdated:false}]]
]) test('blocks '+name,()=>{const x=valid();mutate(x);assert.equal(validateReadiness(x).eligible,false);});

test('documentation-only files are low risk',()=>assert.equal(classifyRisk(['README.md','docs/guide.md']),'low'));
for(const files of [['.github/workflows/build.yml'],['backend/Migrations/a.cs'],['terraform/main.tf'],['frontend/src/auth/Login.tsx'],[],['../docs/README.md']]) {
 test('unknown or sensitive paths require manual merge: '+files.join(','),()=>{
  const x=valid();x.changedFiles=files;assert.equal(validateReadiness(x).eligible,false);
 });
}

test('ordinary application source is medium risk',()=>assert.equal(classifyRisk(['frontend/src/App.tsx']),'medium'));

test('required checks distinguish pending, failed and missing current-SHA checks',()=>{
 const x=valid();
 x.checks=x.checks.filter(c=>c.name!=='test').map(c=>c.name==='verify'?{...c,status:'in_progress',conclusion:null}:c.name==='codeql required gate'?{...c,conclusion:'failure'}:c);
 assert.deepEqual(requiredCheckState({checks:x.checks,headSha:sha,changedFiles:x.changedFiles}),{
  ready:false,required:names,pending:['verify'],failed:['codeql required gate'],missing:['test']
 });
});

test('owner command must exactly match the linked issue',()=>{
 assert.equal(parseOwnerCommand('/execute-dev 537',537),'execute-dev');
 assert.equal(parseOwnerCommand('/revoke-execute-dev 537',537),'revoke-execute-dev');
 assert.equal(parseOwnerCommand('/execute-dev 538',537),null);
 assert.equal(parseOwnerCommand('please /execute-dev 537',537),null);
});

function authorizationFixture(overrides={}) {
 const issuedAt='2026-10-28T12:00:00.000Z';
 const record=createAuthorizationRecord({repository:'moojjoo/recruiterreply',issueNumber:537,pullNumber:600,headSha:sha,actor:'moojjoo',issuedAt,...overrides});
 return {record,comment:{user:{login:'github-actions[bot]'},body:formatAuthorizationComment(record),created_at:record.issuedAt}};
}

test('trusted authorization is scoped to repository, issue, PR, owner and current SHA',()=>{
 const {comment}=authorizationFixture();
 const input={comments:[comment],repository:'moojjoo/recruiterreply',issueNumber:537,pullNumber:600,headSha:sha,ownerLogin:'moojjoo',now:Date.parse('2026-10-28T13:00:00.000Z')};
 assert.equal(validateOwnerAuthorization(input).authorized,true);
 assert.match(validateOwnerAuthorization({...input,headSha:'new'}).reason,/head changed/);
 assert.match(validateOwnerAuthorization({...input,pullNumber:601}).reason,/scope/);
});

test('untrusted marker, expired marker and owner revocation fail closed',()=>{
 const {comment}=authorizationFixture();
 const input={comments:[comment],repository:'moojjoo/recruiterreply',issueNumber:537,pullNumber:600,headSha:sha,ownerLogin:'moojjoo',now:Date.parse('2026-10-28T13:00:00.000Z')};
 assert.equal(validateOwnerAuthorization({...input,comments:[{...comment,user:{login:'contributor'}}]}).authorized,false);
 assert.match(validateOwnerAuthorization({...input,now:Date.parse('2026-10-30T13:00:00.000Z')}).reason,/expired/);
 const revocation={user:{login:'moojjoo'},body:'/revoke-execute-dev 537',created_at:'2026-10-28T12:01:00.000Z'};
 assert.match(validateOwnerAuthorization({...input,comments:[comment,revocation]}).reason,/revoked/);
});

test('high-risk readiness requires valid owner authorization in addition to every normal gate',()=>{
 const x=valid();x.changedFiles=['.github/workflows/build.yml'];
 assert.equal(validateReadiness(x).eligible,false);
 assert.equal(validateReadiness({...x,ownerAuthorization:true}).eligible,true);
});
