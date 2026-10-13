import { listActivity, reportActivity } from '@/lib/activity-store';
import { InputError, validateReport } from '@/lib/activity-model.mjs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  if (!request.headers.get('oai-authenticated-user-id')) return Response.json({error:'로그인이 필요합니다.'}, {status:401, headers});
  try { return Response.json({tasks: await listActivity()}, {headers}); }
  catch { return Response.json({error:'기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}, {status:503, headers}); }
}
export async function POST(request: Request) {
  if (!request.headers.get('oai-authenticated-user-id')) return Response.json({error:'로그인이 필요합니다.'}, {status:401, headers});
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error:'같은 사이트에서 기록해주세요.'}, {status:403, headers});
  try {
    const raw = await request.text();
    if (raw.length > 16000) return Response.json({error:'기록이 너무 깁니다.'}, {status:413, headers});
    const input = validateReport(JSON.parse(raw));
    return Response.json({task: await reportActivity(input, 'manual')}, {headers});
  } catch (error) {
    return Response.json({error: error instanceof InputError ? error.message : error instanceof SyntaxError ? '올바른 JSON을 입력해주세요.' : '저장하지 못했습니다. 기록을 확인한 뒤 다시 시도해주세요.'}, {status:error instanceof InputError || error instanceof SyntaxError ? 400 : 503, headers});
  }
}
