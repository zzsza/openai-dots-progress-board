import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeReport,validateReport,freshness,displayStatus} from '../lib/activity-model.mjs';
const input={id:'test-task',title:'공고 확인',status:'working',summary:'공고와 캘린더를 비교했습니다.',nextStep:'시간 차이 확인'};
test('upserts are idempotent and preserve earlier history',()=>{
 const first=mergeReport(null,input,'dots','2026-10-13T09:00:00Z');
 assert.equal(mergeReport(first,input,'dots'),first);
 const second=mergeReport(first,{id:input.id,status:'done',resultUrl:'https://example.com/result'},'dots','2026-10-13T09:10:00Z');
 assert.equal(second.revision,2);assert.equal(second.history.length,2);assert.equal(second.history[1].status,'working');
 assert.throws(()=>mergeReport(second,{id:input.id,summary:'late',expectedRevision:1},'manual'));
});
test('rejects missing wait reasons, unsafe links, unknown fields and invalid data',()=>{
 assert.throws(()=>mergeReport(null,{...input,status:'waiting'},'dots'));
 for(const value of ['javascript:alert(1)','file:///tmp/a','https://user:secret@example.com'])assert.throws(()=>validateReport({...input,resultUrl:value}));
 assert.throws(()=>validateReport({...input,password:'secret'}));
 assert.throws(()=>validateReport({...input,nextCheckAt:'tomorrow'}));
 assert.throws(()=>validateReport({...input,id:'../escape'}));
});
test('only flags running reports that are stale and overdue scheduled checks',()=>{
 const task=mergeReport(null,input,'dots','2026-10-13T09:00:00Z');
 assert.equal(freshness(task,Date.parse('2026-10-13T09:31:00Z')),'30분 이상 새 소식 없음');
 assert.equal(freshness({...task,status:'waiting'},Date.parse('2026-10-13T09:31:00Z')),'');
 assert.equal(freshness({...task,status:'watching',nextCheckAt:'2026-10-13T09:10:00Z'},Date.parse('2026-10-13T09:31:00Z')),'확인 예정 시각 지남');
});
test('schedules preserve original recurrence and refuse unknown timezones or invented dates',()=>{
 const schedule=mergeReport(null,{...input,kind:'schedule',status:'watching',schedule:'0 9 * * 1-5',timezone:'Asia/Seoul',scheduleEnabled:true,nextRunAt:'2026-10-14T09:00:00+09:00',sourceScheduleId:'original-job'},'dots');
 assert.equal(schedule.sourceScheduleId,'original-job');
 assert.equal(freshness(schedule,Date.parse('2026-10-14T09:01:00+09:00')),'실행 예정 시각 지남');
 assert.equal(freshness({...schedule,scheduleEnabled:false},Date.parse('2026-10-14T09:01:00+09:00')),'');
 assert.throws(()=>mergeReport(null,{...input,kind:'schedule',schedule:'',timezone:'Asia/Seoul'},'dots'));
 assert.throws(()=>validateReport({...input,timezone:'Mars/City'}));
 assert.throws(()=>validateReport({...input,nextRunAt:'2026-10-14T09:00:00'}));
 assert.equal(mergeReport(schedule,{id:input.id,scheduleEnabled:false},'dots').scheduleEnabled,false);
});

test('disabled recurring jobs display as paused without changing regular task status',()=>{
 assert.equal(displayStatus({kind:'schedule',status:'watching',scheduleEnabled:false}),'paused');
 assert.equal(displayStatus({kind:'task',status:'working',scheduleEnabled:false}),'working');
 assert.equal(freshness({kind:'schedule',status:'working',scheduleEnabled:false,updatedAt:'2020-01-01T00:00:00Z'}),'');
});
