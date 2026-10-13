import { env } from 'cloudflare:workers';
import { InputError, mergeReport } from './activity-model.mjs';

function db() {
  if (!env.DB) throw new Error('작업 저장소에 연결하지 못했습니다.');
  return env.DB;
}
export async function listActivity() {
  // shortcut: one personal board reads up to 500 records; add pagination if usage grows.
  const rows = await db().prepare('SELECT document FROM activity ORDER BY updated_at DESC LIMIT 501').all<{document: string}>();
  if (rows.results.length > 500) throw new Error('작업이 500개를 넘었습니다. 페이지 조회 기능이 필요합니다.');
  return rows.results.map(row => JSON.parse(row.document));
}
export async function getActivity(id: string) {
  const row = await db().prepare('SELECT document FROM activity WHERE id = ?').bind(id).first<{document: string}>();
  return row ? JSON.parse(row.document) : null;
}
export async function reportActivity(input: any, reporter: 'dots' | 'manual') {
  const previous = await getActivity(input.id);
  const task = mergeReport(previous, input, reporter);
  if (task === previous) return task;
  const result = await db().prepare(`INSERT INTO activity (id, document, revision, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET document=excluded.document, revision=excluded.revision, updated_at=excluded.updated_at WHERE activity.revision = ?`)
    .bind(task.id, JSON.stringify(task), task.revision, task.updatedAt, previous?.revision ?? 0).run();
  if (!result.meta.changes) throw new InputError('다른 곳에서 기록이 바뀌었습니다. 새로고침 후 다시 기록해주세요.');
  return task;
}
