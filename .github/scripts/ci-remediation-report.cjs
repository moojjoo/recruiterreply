'use strict';
// Read-only classification of CI failures; never modifies PR code, secrets or IAM.
const SAFE_HINTS=[
  [/lint|eslint/i,'Inspect frontend lint errors and fix source locally; rerun npm run lint.'],
  [/playwright|browser/i,'Inspect Playwright trace and screenshot artifacts; rerun browser tests.'],
  [/codeql|analy[sz]e/i,'Review CodeQL findings; security changes require manual review.'],
  [/dotnet|\.net|backend|build/i,'Inspect .NET build/test logs and reproduce with dotnet test.'],
  [/seo|sitemap|robots/i,'Run the static SEO validator and inspect generated public assets.']
];
function classify(checks,sha) {
 const failures=(checks||[]).filter(c=>c.head_sha===sha&&c.status==='completed'&&!['success','skipped'].includes(c.conclusion));
 return failures.map(c=>({check:c.name,conclusion:c.conclusion,advice:(SAFE_HINTS.find(([re])=>re.test(c.name))||[null,'Investigate CI logs; no automatic code modification permitted.'])[1]}));
}
function format(pr,failures) {
 return ['## CI remediation report for PR #'+pr,'','Read-only diagnostic; no fixes, approvals, or merges were performed.','',...failures.map(f=>'- **'+f.check+'** ('+f.conclusion+'): '+f.advice)].join('\n');
}
module.exports={classify,format};
