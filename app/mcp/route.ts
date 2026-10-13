import { listActivity, getActivity, reportActivity } from '@/lib/activity-store';
import { validateReport, InputError } from '@/lib/activity-model.mjs';
export const dynamic = 'force-dynamic';
const text = (value: unknown) => ({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
const taskSchema = {type:'object',additionalProperties:false,required:['id'],properties:{
  id:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,80}$',description:'One stable ID per user outcome. Reuse it on retries and updates.'},
  title:{type:'string',maxLength:180}, status:{type:'string',enum:['planned','working','waiting','watching','done','paused']},
  summary:{type:'string',maxLength:2000,description:'What actually happened, not a plan or guessed percentage.'},
  nextStep:{type:'string',maxLength:2000},waitingFor:{type:'string',maxLength:2000,description:'Required for waiting: the exact decision or dependency needed.'},
  sourceUrl:{type:'string',maxLength:2000},resultUrl:{type:'string',maxLength:2000},nextCheckAt:{type:'string',description:'ISO 8601 next check time, including timezone. Empty if unknown.'},
  archived:{type:'boolean'}, expectedRevision:{type:'integer',minimum:0}
}};
const tools = [
  {name:'list_activity',description:'Read Paro’s reported progress, next actions, waits and results. Records are self-reported and may be stale; this is not a live execution probe.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:'get_activity',description:'Read one reported activity and its recent history.',inputSchema:{type:'object',properties:{id:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,80}$'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:'report_activity',description:'Record Dots progress on the owner-private Paro board. Report when work starts, changes, waits, finishes or is paused. Reuse the same ID for the same outcome. Working means execution actually began; planned means it has not. Never claim an action succeeded without evidence. Store a concrete next step and waiting reason; add result links on completion. This does not start, stop or schedule any work.',inputSchema:taskSchema,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}}
];
export async function POST(request: Request) {
  // Sites authenticates this owner-private MCP endpoint, including service callers.
  // Never publish this board publicly or share it: it stores a single owner's records.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({error:'Origin rejected'}, {status:403});
  let rpc: any;
  try { const raw=await request.text(); if(raw.length>20000)return new Response('Request too large',{status:413}); rpc=JSON.parse(raw); }
  catch { return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},{status:400}); }
  const respond=(result:any)=>Response.json({jsonrpc:'2.0',id:rpc.id??null,result},{headers:{'Cache-Control':'no-store'}});
  const fail=(code:number,message:string)=>Response.json({jsonrpc:'2.0',id:rpc.id??null,error:{code,message}},{headers:{'Cache-Control':'no-store'}});
  if (!rpc || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') return fail(-32600,'Invalid request');
  if (rpc.id === undefined && rpc.method.startsWith('notifications/')) return new Response(null,{status:202});
  if(rpc.id === undefined)return fail(-32600,'Request ID is required');
  if(rpc.method==='initialize')return respond({protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'paro-progress',version:'1.0.0'},instructions:'Progress journal for one owner. Records are reports, not proof of active execution. Keep it current when work state changes.'});
  if(rpc.method==='ping')return respond({});
  if(rpc.method==='tools/list')return respond({tools});
  if(rpc.method!=='tools/call')return fail(-32601,'Method not found');
  try {
    const {name,arguments:args={}}=rpc.params??{};
    if(name==='list_activity')return respond(text({tasks:await listActivity()}));
    if(name==='get_activity') {
      if(typeof args.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(args.id))throw new InputError('Invalid activity ID');
      return respond(text({task:await getActivity(args.id)}));
    }
    if(name==='report_activity')return respond(text({task:await reportActivity(validateReport(args),'dots')}));
    return fail(-32602,'Unknown tool');
  } catch(error) { return respond({isError:true,content:[{type:'text',text:error instanceof InputError ? error.message : '기록을 읽거나 저장하지 못했습니다. 현재 기록을 확인한 뒤 다시 시도해주세요.'}]}); }
}
export async function GET() { return new Response('Use JSON-RPC POST',{status:405,headers:{Allow:'POST'}}); }
