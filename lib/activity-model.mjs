export const STATUSES = ['planned', 'working', 'waiting', 'watching', 'done', 'paused'];
const fields = ['id', 'title', 'status', 'summary', 'nextStep', 'waitingFor', 'sourceUrl', 'resultUrl', 'nextCheckAt', 'archived', 'expectedRevision'];
export class InputError extends Error {}
export function validateReport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('작업 기록은 객체여야 합니다.');
  for (const key of Object.keys(input)) if (!fields.includes(key)) throw new InputError(`지원하지 않는 항목: ${key}`);
  if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id)) throw new InputError('작업 ID는 영문, 숫자, 밑줄, 하이픈으로 1~80자입니다.');
  for (const key of ['title', 'summary', 'nextStep', 'waitingFor', 'sourceUrl', 'resultUrl', 'nextCheckAt']) {
    if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > (key === 'title' ? 180 : 2000))) throw new InputError(`${key} 길이나 형식을 확인해주세요.`);
  }
  if (input.title !== undefined && !input.title.trim()) throw new InputError('작업 이름을 입력해주세요.');
  if (input.status !== undefined && !STATUSES.includes(input.status)) throw new InputError('올바른 작업 상태를 선택해주세요.');
  for (const key of ['sourceUrl', 'resultUrl']) {
    if (input[key]) {
      let url; try { url = new URL(input[key]); } catch { throw new InputError('링크는 완전한 https:// 또는 http:// 주소여야 합니다.'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new InputError('인증값이 없는 HTTP 또는 HTTPS 링크만 사용할 수 있습니다.');
    }
  }
  if (input.nextCheckAt && (!/^\d{4}-\d{2}-\d{2}T/.test(input.nextCheckAt) || !Number.isFinite(Date.parse(input.nextCheckAt)))) throw new InputError('다음 확인 시각은 ISO 8601 날짜로 입력해주세요.');
  if (input.archived !== undefined && typeof input.archived !== 'boolean') throw new InputError('보관 여부를 확인해주세요.');
  if (input.expectedRevision !== undefined && (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0)) throw new InputError('기록 버전이 올바르지 않습니다.');
  return input;
}
export function mergeReport(previous, input, reporter, now = new Date().toISOString()) {
  validateReport(input);
  if (input.expectedRevision !== undefined && input.expectedRevision !== (previous?.revision ?? 0)) throw new InputError('다른 곳에서 기록이 바뀌었습니다. 새로고침 후 다시 기록해주세요.');
  const task = { id: input.id, title: '', status: 'planned', summary: '', nextStep: '', waitingFor: '', sourceUrl: '', resultUrl: '', nextCheckAt: '', archived: false, ...previous };
  for (const field of fields) if (field !== 'expectedRevision' && input[field] !== undefined) task[field] = typeof input[field] === 'string' ? input[field].trim() : input[field];
  if (!task.title || !task.summary) throw new InputError('작업 이름과 지금까지 한 일을 입력해주세요.');
  if (task.status === 'waiting' && !task.waitingFor) throw new InputError('응답을 기다리는 이유를 입력해주세요.');
  if (previous && fields.filter(f => f !== 'expectedRevision').every(f => task[f] === previous[f])) return previous;
  task.revision = (previous?.revision ?? 0) + 1;
  task.updatedAt = now;
  task.reporter = reporter;
  task.createdAt = previous?.createdAt ?? now;
  task.history = [{ at: now, status: task.status, summary: task.summary, nextStep: task.nextStep, waitingFor: task.waitingFor, reporter }, ...(previous?.history ?? [])].slice(0, 30);
  return task;
}
export function freshness(task, now = Date.now()) {
  if (task.archived || ['done', 'paused', 'planned'].includes(task.status)) return '';
  if (task.status === 'watching' && task.nextCheckAt && Date.parse(task.nextCheckAt) < now) return '확인 예정 시각 지남';
  if (task.status === 'working' && now - Date.parse(task.updatedAt) > 30 * 60 * 1000) return '30분 이상 새 소식 없음';
  return '';
}
