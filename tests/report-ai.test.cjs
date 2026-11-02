const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const html = fs.readFileSync('sales-analysis.html', 'utf8');
const common = fs.readFileSync('common.js', 'utf8');
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  if (match[1].trim()) new Function(match[1]);
}
new Function(common);
function source(name) {
  let start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  if (html.slice(start - 6, start) === 'async ') start -= 6;
  return html.slice(start, html.indexOf('\n}', start) + 2);
}
const insight = { title: 'Title', finding: 'Change', meaning: 'Meaning', check: 'Check', productIds: ['123'] };
let response;
const ctx = { fetchAiChat: async (messages, options) => {
  assert.equal(options.reportMode, true);
  assert.equal(options.timeoutMs, 140000);
  const result = JSON.parse(JSON.stringify(response));
  if (result.data?.reportInput?.characters === 4) result.data.reportInput.characters = messages[0].parts[0].text.length;
  return result;
}, reportVerifyInsights: () => [] };
vm.createContext(ctx);
vm.runInContext(source('reportNormalizeInsights') + source('reportRequestInsights'), ctx);
const success = data => ({ ok: true, status: 200, data: { reportInput: { complete: true, characters: 4 }, ...data } });
async function run() {
  response = success({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ insights: [insight] }) }] } }] });
  assert.equal((await ctx.reportRequestInsights('test', [])).insights[0].check, 'Check');
  for (const [value, pattern] of [
    [{ok:false,status:429,data:{error:'Daily quota exceeded'}}, /429.*Daily quota/],
    [success({candidates:[{finishReason:'MAX_TOKENS'}]}), /MAX_TOKENS/],
    [success({candidates:[{content:{parts:[{text:'{"insights":[]}'}]}}]}), /누락/],
    [success({candidates:[{content:{parts:[{text:'not json'}]}}]}), /JSON/],
    [{ok:true,data:{}}, /업데이트/],
    [success({reportInput:{complete:true,characters:3}}), /업데이트/]
  ]) {
    response = value;
    await assert.rejects(ctx.reportRequestInsights('test', []), pattern);
  }
  await assert.rejects(ctx.reportRequestInsights('x'.repeat(96001), []), /96,000/);
  assert.equal((html.match(/AI 분석을 완료하지 못해 다운로드를 중단했습니다/g) || []).length, 2);
  assert.ok(!html.includes('analysis.detectedSignals.length'));
  const verifier = { REPORT_BUDGET_CLAIM: /never-match-this/, reportCheckSentence: () => [] };
  vm.createContext(verifier);
  vm.runInContext(source('reportVerifyInsights'), verifier);
  const amounts = [{label:'신규 고객',current:74709860,deltas:[38540580]}];
  const bad = {...insight,finding:'신규 고객 매출은 106.6% 증가한 38,540,580원을 기록했습니다.'};
  assert.equal(verifier.reportVerifyInsights([bad],[],amounts).length,1);
  const good = {...insight,finding:'신규 고객 매출은 74,709,860원을 기록하며 전달보다 38,540,580원 증가했습니다.'};
  assert.equal(verifier.reportVerifyInsights([good],[],amounts).length,0);
  assert.equal(verifier.reportVerifyInsights([{...insight,meaning:'전략이 효과를 보인 것으로 판단됩니다.'}],[],[]).length,1);
  response = success({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ insights: [insight] }) }] } }] });
  ctx.reportVerifyInsights = () => [{index:0,message:'Unresolved numeric error'}];
  const annotated = await ctx.reportRequestInsights('test', []);
  assert.equal(JSON.stringify(annotated.insights[0].verify), '["Unresolved numeric error"]');
  assert.equal(annotated.verification.issueCount, 1);
  ctx.reportVerifyInsights = () => [];

  const from = html.indexOf('const REPORT_UP_WORDS');
  const to = html.indexOf('// AI 호출 → 파싱');
  assert.ok(from > 0 && to > from);
  const real = {};
  vm.createContext(real);
  vm.runInContext(html.slice(from, to), real);
  const defs = [
    { metric: '총매출', keywords: ['총매출'], generic: ['매출'], kind: 'amount', unit: '원', better: 'up', get: p => p.sales },
    { metric: 'ROAS', keywords: ['roas'], kind: 'rate', digits: 0, better: 'up', get: p => p.roas },
    { metric: '광고비', keywords: ['광고비'], kind: 'amount', unit: '원', better: null, get: p => p.cost },
  ];
  const facts = real.reportBuildFacts(defs, { sales: 185, roas: 400.9, cost: 191 }, [{ basis: 'prev', label: '전달', period: { sales: 100, roas: 397, cost: 100 } }]);
  const issuesOf = text => real.reportVerifyInsights([{ ...insight, finding: text }], facts, []).length;
  assert.equal(issuesOf('광고비 증가는 임의의 예산 확대보다는 CPC 경매 구조의 영향이 큽니다.'), 0);
  assert.equal(issuesOf('광고비를 예산 증액으로 늘려 광고비가 증가했습니다.'), 1);
  assert.equal(issuesOf('전달 대비 신규 결제자당 매출이 9.6% 감소한 53,000원입니다.'), 0);
  assert.equal(issuesOf('광고비 790원 증가하여 증분 ROAS 3984%를 기록했습니다. 전달 대비 그렇습니다.'), 0);
  assert.equal(issuesOf('총매출은 전달 대비 감소했습니다.'), 1);
  assert.equal('광고비가 572,492원으로 증가'.split(vm.runInContext('REPORT_CLAUSE_SPLIT', real)).length, 1);
  const server = fs.readFileSync('supabase/functions/gemini-chat/index.ts', 'utf8');
  const start = server.indexOf('type ChatPart');
  const end = server.indexOf('\nserve(', start);
  vm.runInContext(stripTypeScriptTypes(server.slice(start, end)), ctx);
  const messages = [{role:'user',parts:[{text:'x'.repeat(20000)}]}];
  assert.equal(ctx.normalizeChatHistory(messages,true)[0].parts[0].text.length,20000);
  assert.throws(()=>ctx.normalizeChatHistory(messages,false), /8000/);
  assert.throws(()=>ctx.normalizeChatHistory([{role:'user',parts:[{text:'x'.repeat(96001)}]}],true), /96000/);
  console.log('PASS: complete input, schema checks, quota/server errors, truncation, old deployment, and fail-closed download');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
