import React from 'react';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import * as charts from 'recharts';
import {formatDistanceToNow} from 'date-fns';
import {AGENTS,AGENT_MAP} from '../src/lib/constants.js';
import {AgentCard} from '../src/components/AgentCard.js';
import {GlitchText} from '../src/components/GlitchText.js';
import {CostChart} from '../src/components/CostChart.js';

// Execute the real page with its polling response supplied at the HTTP-state
// port. Effects never run during SSR; no private server import is evaluated.
function page(name:string,data:unknown) {
  const source=readFileSync(new URL(`../src/pages/${name}.tsx`,import.meta.url),'utf8');
  const tree=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const body=tree.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(tree)).join('\n');
  const js=ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText.replace(/^export /gm,'');
  const chartPorts=Object.fromEntries(Object.entries(charts).filter(([key])=>/^[A-Za-z_$][\w$]*$/.test(key)&&key!=='default'));
  const ports={React,...chartPorts,formatDistanceToNow,AGENT_MAP,GlitchText,CostChart,api:{},usePolling:()=>({data,loading:false,error:null})};
  const Component=new Function(...Object.keys(ports),js+`;return ${name};`)(...Object.values(ports));
  return renderToStaticMarkup(<Component/>);
}

test('all14 safe shared identities render and AgentCard preserves raw model/provider and provenance',()=>{
  const html=renderToStaticMarkup(<>{AGENTS.map(agent=><AgentCard key={agent.id} agent={agent}/>)}</>);
  for(const name of ['Arya','Koda','Flux','Atlas','Iris','Sentinel','Cipher','Lux','Nexus','Prism','Axon','Nova','Zeta','Helix']) assert.match(html,new RegExp(name));
  const observed=renderToStaticMarkup(<AgentCard agent={{id:'visitor',model:'vendor/raw-model',modelIdentity:{rawModelId:'vendor/raw-model',rawProviderId:'vendor',provenance:'observed_session'}} as any}/>);
  assert.match(observed,/vendor\/raw-model/);assert.match(observed,/observed_session/);
  assert.match(html,/static_fallback/);
});

test('real Performance renders honest weekly empty context and unavailable usage without invented zeros',()=>{
  const html=page('Performance',{agents:{visitor:{id:'visitor',model:'vendor/raw-model',modelIdentity:{rawModelId:'vendor/raw-model',rawProviderId:'vendor',provenance:'observed_session'},sessionCount:0,totalTokens:0,lastActive:null}},modelCosts:{},modelCostsToday:{},modelTokens:{},totalCostToday:null,totalCostAllTime:null,sessionsStatus:'unknown',costStatus:{today:'unknown',allTime:'unknown'},usageSource:'dashboard_data'});
  assert.match(html,/No data yet/);assert.match(html,/7 days/);assert.match(html,/dashboard_data/);assert.match(html,/Unavailable/);
  assert.doesNotMatch(html,/hesaplanacak|\$0\.00|undefined|NaN/);assert.match(html,/vendor\/raw-model/);assert.match(html,/observed_session/);
});

test('real Performance preserves measured zero cost and sessions',()=>{
  const html=page('Performance',{agents:{},modelCosts:{},modelCostsToday:{},modelTokens:{},totalCostToday:0,totalCostAllTime:0,sessionsStatus:'available',costStatus:{today:'available',allTime:'available'},usageSource:'dashboard_data'});
  assert.match(html,/\$0\.00/);assert.match(html,/No data yet/);
});

test('real Costs renders missing totals and row costs as unavailable while preserving measured zero',()=>{
  const html=page('Costs',{totalToday:null,totalAllTime:0,projectedMonthly:null,subagentCostToday:null,breakdownAllTime:[],breakdownToday:[],tokenUsage:[{model:'vendor/model',calls:0,totalTokens:'0',cost:null}],tokenUsageToday:[],usageSource:'dashboard_data',costStatus:{totalToday:'unknown',totalAllTime:'available'}});
  assert.match(html,/Unavailable/);assert.match(html,/\$0\.00/);assert.match(html,/dashboard_data/);assert.doesNotMatch(html,/NaN|\$0<\/td>/);
});

test('actual card and Performance expose explicit provider IDs even when model has no provider prefix',()=>{
  const agent={id:'visitor',model:'raw-model',modelIdentity:{rawModelId:'raw-model',rawProviderId:'raw-provider',provenance:'observed_session'},sessionCount:1,totalTokens:0,lastActive:null};
  const card=renderToStaticMarkup(<AgentCard agent={agent as any}/>);
  const performance=page('Performance',{agents:{visitor:agent},modelCosts:{},totalCostToday:null,totalCostAllTime:null,sessionsStatus:'available',costStatus:{today:'unknown',allTime:'unknown'},usageSource:'dashboard_data'});
  assert.match(card,/raw-provider/);assert.match(performance,/raw-provider/);
});

test('actual Agents edit action starts from configured model when the observed session model differs',()=>{
  const source=readFileSync(new URL('../src/pages/Agents.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('Agents.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const body=tree.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(tree)).join('\n');
  const js=ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText.replace(/^export /gm,'');
  const agent={id:'koda',name:'Koda',model:'observed/model',modelIdentity:{rawModelId:'observed/model',rawProviderId:'observed',configuredModelId:'configured/model',provenance:'observed_session'}};
  let onEdit: ((agent:any)=>void)|undefined;let edited:any;let poll=0;let state=0;
  const ports={React,GlitchText,api:{agents:()=>{},sessions:()=>{}},useEffect:()=>{},useNavigate:()=>()=>{},
    usePolling:()=>({data:poll++===0?[agent]:[],loading:false,error:null,refresh:()=>{}}),
    useState:(initial:any)=>{const index=state++;return [initial,(value:any)=>{if(index===0) edited=value;}];},
    AgentCard:(props:any)=>{onEdit=props.onEdit;return <AgentCard {...props}/>;},
  };
  const Component=new Function(...Object.keys(ports),js+';return Agents;')(...Object.values(ports));
  renderToStaticMarkup(<Component/>);assert.ok(onEdit);onEdit(agent);
  assert.equal(edited.model,'configured/model');assert.equal(edited.modelIdentity.rawModelId,'observed/model');
});

test('public HTTP types admit unavailable costs and token rows and require nullable-aware typed consumers',()=>{
  const file=fileURLToPath(new URL('./agent-http-contract.fixture.ts',import.meta.url));
  const source=`import type { Agent, CostData } from '../src/lib/types';
    import type { api } from '../src/lib/api';
    const costs: CostData = {
      totalToday:null,totalAllTime:0,projectedMonthly:null,subagentCostToday:null,subagentCostAllTime:null,
      breakdownAllTime:[],breakdownToday:[],tokenUsage:[{model:'vendor/model',cost:null,calls:0,totalTokens:'0'}],tokenUsageToday:[],
      costStatus:{totalToday:'unknown',totalAllTime:'available',projectedMonthly:'unknown',subagentCostToday:'unknown',subagentCostAllTime:'unknown'},usageSource:'dashboard_data',
    };
    const endpoint: Awaited<ReturnType<typeof api.costs>> = costs;
    const legacyAgent: Agent = {id:'koda',name:'Koda',identityName:'Koda',identityEmoji:'',model:'legacy',workspace:'',bindings:0,isDefault:false};
    declare const agent: Agent;
    const rawModel:string|null|undefined = agent.modelIdentity?.rawModelId;
    const rowCost:number|null|undefined = endpoint.tokenUsage[0].cost;
    // An unavailable total must require a null check at the API boundary.
    // @ts-expect-error nullable total cannot be consumed as always measured
    endpoint.totalToday.toFixed(2);
    type IsAny<T> = 0 extends (1 & T) ? true : false;
    const typedPerformance: IsAny<Awaited<ReturnType<typeof api.performance>>> = false;
    declare const performance: Awaited<ReturnType<typeof api.performance>>;
    const performanceCost:number|null = performance.totalCostToday;
    const tokens:string|number|null = performance.modelTokens['vendor/model'].totalTokens;
  `;
  const options:ts.CompilerOptions={noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX};
  const host=ts.createCompilerHost(options);const original=host.getSourceFile.bind(host);
  host.getSourceFile=(name,...rest)=>name===file?ts.createSourceFile(file,source,options.target!,true):original(name,...rest);
  const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([file],options,host));
  assert.equal(diagnostics.length,0,ts.formatDiagnostics(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
});
