'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {validateReadiness,classifyRisk} = require('../pr-readiness.cjs');
const sha = 'abc123';
const names = ['verify','test','analyze (javascript-typescript)','analyze (csharp)'];
function valid() {
 return {pr:{draft:false,labels:[{name:'automation-ready'}],head:{sha},body:'## Implementation evidence\nCommit abc123 and test verification workflow succeeded.\n\n## Acceptance criteria\n- [x] Implemented\n- [x] Tested\n'},checks:names.map(name=>({name,head_sha:sha,status:'completed',conclusion:'success'})),reviews:[],threads:[],dependenciesMerged:true,changedFiles:['README.md']};
}
test('complete PR eligible',()=>assert.equal(validateReadiness(valid()).eligible,true));
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
for(const files of [['.github/workflows/build.yml'],['backend/Migrations/a.cs'],['terraform/main.tf'],['frontend/src/App.tsx'],[],['../docs/README.md']]) {
 test('unknown or sensitive paths require manual merge: '+files.join(','),()=>{
  const x=valid();x.changedFiles=files;assert.equal(validateReadiness(x).eligible,false);
 });
}
