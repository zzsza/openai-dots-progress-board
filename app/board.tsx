'use client';
import {useEffect,useRef,useState} from 'react';
import {Activity,CalendarClock,ArrowUpRight,Check,ChevronRight,Clock,Copy,ExternalLink,Link2,Pause,Plus,Radar,RefreshCw,Search,X} from 'lucide-react';
import {freshness,displayStatus} from '@/lib/activity-model.mjs';

type Task={kind?:string;schedule?:string;timezone?:string;nextRunAt?:string;lastRunAt?:string;scheduleEnabled?:boolean;sourceScheduleId?:string;id:string;title:string;status:string;summary:string;nextStep:string;waitingFor:string;sourceUrl:string;resultUrl:string;nextCheckAt:string;archived:boolean;revision:number;updatedAt:string;createdAt:string;reporter:string;history:any[]};
const labels:Record<string,string>={all:'전체 소식',working:'진행 중',waiting:'내 응답 필요',watching:'계속 확인 중',planned:'시작 전',paused:'멈춰 있음',done:'완료',archive:'보관한 기록',schedules:'예약된 일'};
const icons:Record<string,any>={working:Activity,waiting:Clock,watching:Radar,planned:Clock,paused:Pause,done:Check};
const instruction=`앞으로 내가 맡긴 일을 이 Dots 진행상황 보드에 기록해줘.
1. 하나의 목표에는 하나의 고정 작업 ID를 사용해. 새 일을 맡으면 report_activity로 등록하고 아직 실행 전이면 planned로 표시해.
2. 실제로 일을 시작했을 때 working, 내 결정이나 외부 조건을 기다리면 waiting, 계속 관찰하는 일은 watching, 결과 확인 후 done, 중단되면 paused로 갱신해.
3. summary에는 실제로 한 일, nextStep에는 다음 행동을 기록해. waitingFor에는 내가 답해야 할 질문이나 기다리는 조건을 구체적으로 써줘.
4. 예약된 다음 확인이 있으면 nextCheckAt에 시간대가 포함된 ISO 시각을 기록해. 모르면 비워둬. 완료 시 결과 링크도 남겨줘.
5. 상태가 바뀌거나 의미 있는 진전이 있을 때 갱신해. 변하지 않은 일을 진행한 것처럼 쓰거나 실행 중이라고 추측하지 마.
6. 기존에 저장된 cron과 반복 예약도 목록을 조회해서 kind=schedule로 기록해. 실제 저장된 schedule, timezone, scheduleEnabled, sourceScheduleId와 알려진 nextRunAt, lastRunAt을 함께 보내줘. 보드를 채우려고 예약을 새로 만들거나 변경하지 마. 다음 실행 시각을 모르면 비워둬.
7. 대화가 다른 주제로 넘어가도 같은 ID로 이어가고, 보고 전에 list_activity로 기존 기록을 확인해.`;
function exampleTasks(now:number):Task[]{
 const time=(minutes:number)=>new Date(now-minutes*60000).toISOString();
 const base={sourceUrl:'',resultUrl:'',nextCheckAt:'',archived:false,revision:1,createdAt:time(95),reporter:'example',history:[]};
 return [
  {...base,id:'demo-calendar',title:'공고와 캘린더의 시간 비교',status:'waiting',summary:'공고는 오후 2시, 캘린더는 오후 3시로 되어 있어요.',nextStep:'맞는 시간을 확인한 뒤 변경안을 정리할 예정이에요.',waitingFor:'공고와 캘린더 중 어느 시간을 기준으로 할까요?',updatedAt:time(8)},
  {...base,id:'demo-lecture',title:'다음 강의 자료 준비',status:'working',summary:'기존 강의 자료에서 평가 방법 관련 내용을 모았어요.',nextStep:'세 가지 예시를 비교하고 초안으로 정리할게요.',waitingFor:'',updatedAt:time(12)},
  {...base,kind:'schedule',schedule:'0 * * * *',timezone:'Asia/Seoul',scheduleEnabled:true,nextRunAt:new Date(Math.floor(now/3600000)*3600000+3600000).toISOString(),lastRunAt:time(80),id:'demo-monitor',title:'관심 공고의 변경사항 확인',status:'watching',summary:'새 공고가 올라오거나 마감일이 바뀌는지 확인하는 일이에요.',nextStep:'다음 확인 때 달라진 내용만 알려드릴게요.',waitingFor:'',nextCheckAt:new Date(now+60*60000).toISOString(),updatedAt:time(80)},
  {...base,id:'demo-thumbnail',title:'Dots 후기 영상 썸네일',status:'done',summary:'요청한 문구와 이미지를 넣은 썸네일을 준비했어요.',nextStep:'결과를 검토한 뒤 영상에 사용할 수 있어요.',waitingFor:'',updatedAt:time(40)}
 ].map(t=>({...t,history:[{at:t.updatedAt,status:t.status,summary:t.summary,nextStep:t.nextStep,waitingFor:t.waitingFor,reporter:'example'}]}));
}
function relative(iso:string,now:number){const m=Math.max(0,Math.floor((now-Date.parse(iso))/60000));return m<1?'방금 전':m<60?`${m}분 전`:m<1440?`${Math.floor(m/60)}시간 전`:`${Math.floor(m/1440)}일 전`;}
function date(iso:string){return new Date(iso).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'});}
function Badge({status}:{status:string}){const Icon=icons[status]??Clock;return <span className={`badge ${status}`}><Icon size={13}/>{labels[status]}</span>;}
export default function Home({initialNow}:{initialNow:number}){
 const [tasks,setTasks]=useState<Task[]>([]),[examples]=useState(()=>exampleTasks(initialNow)),[demo,setDemo]=useState(true),[filter,setFilter]=useState('all'),[query,setQuery]=useState('');
 const [loaded,setLoaded]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(initialNow);
 const [modal,setModal]=useState<null|'detail'|'edit'|'new'|'connect'>(null),[selected,setSelected]=useState<Task|null>(null),[saveError,setSaveError]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),returnFocus=useRef<HTMLElement|null>(null),requestNumber=useRef(0),modeChosen=useRef(false);
 const form=useRef<HTMLFormElement>(null);
 async function refresh(initial=false){
  const number=++requestNumber.current;if(!initial)setBusy(true);
  try{const response=await fetch('/api/activity',{cache:'no-store'});const data=await response.json() as {tasks:Task[];task:Task;error?:string};if(!response.ok)throw new Error(data.error??'소식을 불러오지 못했습니다.');
   if(number!==requestNumber.current)return;setTasks(data.tasks);setError('');if(initial&&!modeChosen.current)setDemo(data.tasks.length===0);
  }catch(e){if(number===requestNumber.current)setError((e as Error).message);}finally{if(number===requestNumber.current){setLoaded(true);setBusy(false);}}
 }
 useEffect(()=>{refresh(true);const tick=setInterval(()=>{setNow(Date.now());if(document.visibilityState==='visible')refresh(true);},20000);return()=>clearInterval(tick);},[]);
 useEffect(()=>{if(modal&&!dialog.current?.open){returnFocus.current=document.activeElement as HTMLElement;dialog.current?.showModal();}else if(!modal&&dialog.current?.open){dialog.current.close();returnFocus.current?.focus();}},[modal]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
 const items=demo?examples:tasks,visible=items.filter(t=>filter==='archive'?t.archived:!t.archived&&(filter==='all'||(filter==='schedules'?t.kind==='schedule':displayStatus(t)===filter))).filter(t=>`${t.title} ${t.summary} ${t.nextStep} ${t.waitingFor}`.toLowerCase().includes(query.toLowerCase()));
 const count=(s:string)=>items.filter(t=>!t.archived&&displayStatus(t)===s).length,active=items.filter(t=>!t.archived),liveReport=tasks.filter(t=>t.reporter==='dots').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 const stale=active.filter(t=>freshness(t,now));
 function open(kind:typeof modal,task:Task|null=null){setSaveError('');setSelected(task);setModal(kind);}
 function chooseMode(value:boolean){modeChosen.current=true;setDemo(value);setFilter('all');}
 async function copy(){try{await navigator.clipboard.writeText(instruction);setNotice('Dots에게 줄 안내를 복사했어요.');}catch{setSaveError('복사하지 못했습니다. 아래 안내를 선택해서 복사해주세요.');}}
 async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(saving)return;setSaving(true);setSaveError('');
  const data=new FormData(event.currentTarget),editing=modal==='edit'&&selected?.reporter!=='example';
  const payload:any={id:editing?selected!.id:crypto.randomUUID(),expectedRevision:editing?selected!.revision:0};
  for(const key of ['title','status','summary','nextStep','waitingFor','sourceUrl','resultUrl','kind','schedule','timezone'])payload[key]=String(data.get(key)??'');
  payload.scheduleEnabled=data.get('scheduleEnabled')==='on';
  for(const key of ['nextRunAt','lastRunAt']){const value=String(data.get(key)??'');payload[key]=value?new Date(`${value}+09:00`).toISOString():'';}
  const next=String(data.get('nextCheckAt')??'');payload.nextCheckAt=next?new Date(`${next}+09:00`).toISOString():'';
  try{const response=await fetch('/api/activity',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const result=await response.json() as {task:Task;error?:string};if(!response.ok)throw new Error(result.error);
   modeChosen.current=true;setDemo(false);setTasks(old=>[result.task,...old.filter(t=>t.id!==result.task.id)]);setSelected(result.task);setModal('detail');setNotice('기록을 저장했어요.');
  }catch(e){setSaveError((e as Error).message);}finally{setSaving(false);}
 }
 async function archive(){if(!selected||saving)return;setSaving(true);setSaveError('');try{
  const response=await fetch('/api/activity',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:selected.id,archived:!selected.archived,expectedRevision:selected.revision})});const data=await response.json() as {tasks:Task[];task:Task;error?:string};if(!response.ok)throw new Error(data.error);
  setTasks(old=>old.map(t=>t.id===data.task.id?data.task:t));setModal(null);setNotice(selected.archived?'보관에서 꺼냈어요.':'기록을 보관했어요. 실제 작업은 중단되지 않아요.');
 }catch(e){setSaveError((e as Error).message);}finally{setSaving(false);}}
 return <div className="app-shell">
  <aside className="sidebar">
   <a className="brand" href="/" aria-label="Dots 작업 보드 홈"><span className="brand-mark"><Activity size={21}/></span><span>dots<span className="brand-sub">PROGRESS BOARD</span></span></a>
   <div className="nav-label">Dots의 소식</div>
   <nav aria-label="작업 상태"><button className={filter==='all'?'nav-item selected':'nav-item'} onClick={()=>setFilter('all')}><Activity size={18}/>전체 소식<span>{active.length}</span></button>
    {['working','waiting','watching','done'].map(s=>{const Icon=icons[s];return <button key={s} className={filter===s?'nav-item selected':'nav-item'} onClick={()=>setFilter(s)}><Icon size={18}/>{labels[s]}<span>{count(s)}</span></button>;})}
   <button className={filter==='schedules'?'nav-item selected':'nav-item'} onClick={()=>setFilter('schedules')}><CalendarClock size={18}/>예약된 일<span>{active.filter(t=>t.kind==='schedule').length}</span></button>
   </nav>
   <div className="sidebar-bottom"><button className={filter==='archive'?'nav-item selected':'nav-item'} onClick={()=>setFilter('archive')}><Clock size={18}/>보관한 기록</button><button className="connection-card" onClick={()=>open('connect')}><Link2 size={18}/><span>Dots 연결 안내<small>대화 밖에서도 소식을 이어가요</small></span><ChevronRight size={16}/></button><p className="sidebar-note">무슨 일을 하는지,<br/>다시 물어보지 않아도 알 수 있게.</p></div>
  </aside>
  <main>
   <header className="topbar"><span className="crumb">나의 Dots <ChevronRight size={14}/> 진행상황</span><div className="top-actions"><span className="received"><span className={liveReport?'dot received-dot':'dot'}/>{liveReport?'Dots 기록 수신됨':'Dots의 첫 보고 대기'}</span><button className="icon-button" onClick={()=>refresh()} disabled={busy} aria-label="새로고침"><RefreshCw size={17} className={busy?'spin':''}/></button></div></header>
   <div className="content">
    <section className="page-intro"><div><p className="eyebrow">A LITTLE LESS ASKING, A LITTLE MORE KNOWING</p><h1>Dots 진행상황</h1><p className="intro-copy">맡긴 일부터 기다리는 이유까지, 마지막 소식을 한곳에서.</p></div><button className="primary-button" onClick={()=>open('new')}><Plus size={17}/>기록 추가</button></section>
    {error&&<div className="error-banner" role="alert"><span>{error} 기존 기록은 마지막으로 받은 상태입니다.</span><button onClick={()=>refresh()}>다시 시도</button></div>}
    <div className="mode-bar"><span>{demo?<><span className="sample-label">예시 미리보기</span> 아래 내용은 연결 전 화면을 살펴보기 위한 예시예요.</>:<><span className="sample-label real">내 기록</span> Dots와 내가 남긴 소식만 표시해요.</>}</span><button onClick={()=>chooseMode(!demo)}>{demo?'내 기록 보기':'예시 살펴보기'}<ChevronRight size={14}/></button></div>
    <section className="overview" aria-label="현재 상황 요약"><div className="overview-text"><span className="overview-label">{demo?'Dots가 보고하면 이렇게 보여요':'기록으로 보는 지금'}</span><h2>{count('waiting')>0?<>내 답변을 기다리는 일이 <em>{count('waiting')}개</em> 있어요.</>:count('working')>0?<>Dots가 <em>{count('working')}개의 일</em>을 진행 중이라고 알려왔어요.</>:<>아직 기다리는 답변은 없어요.</>}</h2><p>{count('waiting')>0?'다음 단계로 넘어갈 수 있도록, 기다리는 질문부터 살펴보세요.':'새로 시작한 일이나 상태가 바뀐 일은 이곳에 기록돼요.'}</p><button className="text-link" onClick={()=>count('waiting')?setFilter('waiting'):open('connect')}>{count('waiting')?'기다리는 질문 보기':'Dots 연결 안내 보기'}<ArrowUpRight size={16}/></button></div><div className="overview-symbol" aria-hidden="true"><Radar size={70} strokeWidth={1}/></div></section>
    <section className="stats" aria-label="상태별 기록 수">{['working','waiting','watching','done'].map(s=>{const Icon=icons[s];return <button key={s} className={`stat ${s} ${filter===s?'active':''}`} onClick={()=>setFilter(filter===s?'all':s)}><span className="stat-top"><Icon size={17}/>{labels[s]}</span><strong>{count(s)}<small>개</small></strong></button>;})}</section>
    {stale.length>0&&<div className="stale-note"><Clock size={15}/><span>{stale.length}개 기록에 새 소식이 필요해요. 실제 실행 여부는 확인되지 않았습니다.</span></div>}
    <div className="feed-tabs" aria-label="기록 종류"><button aria-pressed={filter!=='schedules'} onClick={()=>setFilter('all')}>진행상황</button><button aria-pressed={filter==='schedules'} onClick={()=>setFilter('schedules')}><CalendarClock size={15}/>예약된 일 <span>{active.filter(t=>t.kind==='schedule').length}</span></button></div>
    {filter==='schedules'&&<p className="schedule-note">Dots가 보고한 기존 예약입니다. 아직 전달받지 않은 예약은 표시되지 않습니다.</p>}
    <section className="feed" aria-label="작업 소식"><div className="feed-header"><div><h2>{filter==='all'?'맡긴 일의 마지막 소식':labels[filter]}</h2><span className="feed-description">마지막으로 한 일과 다음 행동을 함께 보여드려요.</span></div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="맡긴 일 검색" aria-label="맡긴 일 검색"/></label></div>
     <div className="task-list">{visible.map(task=>{const status=displayStatus(task);const Icon=icons[status]??Clock;const warning=freshness(task,now);return <button key={task.id} className={`task-row ${status}`} onClick={()=>open('detail',task)}><div className={`task-icon ${status}`}><Icon size={20}/></div><div className="task-content"><div className="task-top"><h3>{task.title}</h3><Badge status={status}/>{task.kind==='schedule'&&<span className="badge scheduled"><CalendarClock size={12}/>{task.scheduleEnabled?'예약 활성':'예약 일시정지'}</span>}</div><p>{task.summary}</p><div className="next-action"><span>{task.kind==='schedule'?'다음 실행':task.status==='waiting'?'기다리는 답변':task.status==='watching'?'다음 확인':'다음 행동'}</span>{task.kind==='schedule'?task.scheduleEnabled?task.nextRunAt?`${date(task.nextRunAt)} (한국 시간)`:'다음 실행 시각을 아직 전달받지 못했어요':'예약이 일시정지되어 있어요':task.status==='waiting'?task.waitingFor:task.status==='watching'?task.nextCheckAt?`${date(task.nextCheckAt)} (한국 시간)`:'예정 시각이 아직 없어요':task.nextStep||'아직 기록되지 않았어요'}</div>{task.kind==='schedule'&&<p className="schedule-expression">{task.schedule} · {task.timezone}</p>}{warning&&<div className="warning"><Clock size={12}/>{warning}</div>}</div><div className="task-meta"><time dateTime={task.updatedAt}>{relative(task.updatedAt,now)}</time><span>{task.reporter==='dots'?'Dots의 보고':task.reporter==='example'?'예시 기록':'직접 남긴 기록'}</span><ChevronRight size={18}/></div></button>;})}
      {visible.length===0&&<div className="empty"><Radar size={30}/><h3>{query?'찾는 기록이 없어요':filter==='schedules'?'아직 예약 목록을 전달받지 못했어요':!loaded?'기록을 불러오고 있어요':'이곳에 남긴 소식이 아직 없어요'}</h3><p>{query?'다른 단어로 검색하거나 전체 소식을 살펴보세요.':filter==='schedules'?'Dots에게 기존 예약 목록을 조회해서 이 보드에 기록해달라고 요청하세요.':'Dots에게 보드를 연결하거나, 맡긴 일을 직접 기록할 수 있어요.'}</p><button className="secondary-button" onClick={()=>query?setQuery(''):open('connect')}>{query?'검색 지우기':'Dots 연결 안내'}</button></div>}
     </div>
    </section>
    <footer><span><span className="dot"/>Dots와 내가 남긴 마지막 보고를 기준으로 표시합니다.</span><span>{demo?'예시 데이터':liveReport?`Dots의 마지막 보고 ${relative(liveReport.updatedAt,now)}`:'Dots의 첫 보고를 기다리고 있어요'}</span></footer>
   </div>
  </main>
  <dialog ref={dialog} className={`dialog ${modal==='detail'?'detail-dialog':''}`} aria-labelledby="dialog-title" onCancel={e=>{if(saving)e.preventDefault();else setModal(null);}} onClick={e=>{if(!saving&&e.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)setModal(null);}}}>
   <div className="dialog-head"><span className="eyebrow">{modal==='connect'?'CONNECT YOUR DOT':'DOTS PROGRESS'}</span><button className="icon-button" aria-label="닫기" onClick={()=>setModal(null)} disabled={saving}><X size={20}/></button></div>
   {modal==='connect'?<><h2 id="dialog-title">Dots와 소식을 이어가요.</h2><p className="dialog-description">이 보드가 제공하는 기록 도구를 Dots에 연결하면, 대화가 다른 주제로 넘어가도 맡긴 일의 상태를 이어서 남길 수 있어요.</p><ol className="connect-steps"><li><strong>보드 플러그인을 연결하세요</strong><span>ChatGPT의 Plugins → Personal → Created by you에서 이 사이트의 플러그인을 찾아 Install 또는 Connect를 선택하세요.</span></li><li><strong>Dots에게 아래 안내를 전달하세요</strong><span>Dots 대화에서 연결한 플러그인을 선택하고 안내를 붙여넣으세요.</span></li><li><strong>첫 기록을 확인하세요</strong><span>작은 일을 하나 맡겨 기록을 요청하세요. 보드에 ‘Dots의 보고’가 나타나면 기록 연결이 확인된 겁니다.</span></li></ol><div className="instruction"><pre>{instruction}</pre></div><p className="fine-print">연결 전 대화의 자동 수집과 실제 작업의 시작, 중단 기능은 포함되지 않습니다. Dots가 기록 도구를 호출해야 갱신됩니다.</p>{saveError&&<p role="alert" className="form-error">{saveError}</p>}<button className="primary-button full" onClick={copy}><Copy size={16}/>Dots에게 줄 안내 복사</button></>:modal==='detail'&&selected?<>
    <Badge status={displayStatus(selected)}/><h2 id="dialog-title">{selected.title}</h2><p className="detail-date">{date(selected.updatedAt)} (한국 시간) · {selected.reporter==='example'?'예시 기록':selected.reporter==='dots'?'Dots가 남긴 소식':'직접 남긴 기록'}</p>
    <div className="detail-section"><h3>마지막으로 한 일</h3><p>{selected.summary}</p></div>
    {selected.kind==='schedule'&&<div className="schedule-details"><h3>예약 정보</h3><dl><dt>예약 주기</dt><dd>{selected.schedule}</dd><dt>기준 시간대</dt><dd>{selected.timezone}</dd><dt>예약 상태</dt><dd>{selected.scheduleEnabled?'활성':'일시정지'}</dd><dt>다음 실행</dt><dd>{selected.nextRunAt?date(selected.nextRunAt)+' (한국 시간)':'아직 보고되지 않음'}</dd><dt>마지막 실행</dt><dd>{selected.lastRunAt?date(selected.lastRunAt)+' (한국 시간)':'아직 보고되지 않음'}</dd></dl><p className="fine-print">보드에서 기록을 수정해도 실제 예약은 바뀌지 않습니다.</p></div>}
    {selected.status==='waiting'&&<div className="question-block"><Clock size={17}/><div><h3>내 답변이 필요해요</h3><p>{selected.waitingFor}</p></div></div>}
    <div className="detail-section"><h3>다음 행동</h3><p>{selected.nextStep||'아직 기록되지 않았어요.'}</p>{selected.nextCheckAt&&<p className="fine-print">다음 확인: {date(selected.nextCheckAt)} (한국 시간)</p>}</div>
    <div className="result-links">{selected.sourceUrl&&<a href={selected.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={15}/>원래 대화 또는 자료<ExternalLink size={14}/></a>}{selected.resultUrl&&<a href={selected.resultUrl} target="_blank" rel="noreferrer"><Check size={15}/>결과 열기<ExternalLink size={14}/></a>}</div>
    <div className="detail-section"><h3>소식의 흐름</h3><ol className="timeline">{selected.history.map((event,i)=><li key={`${event.at}-${i}`}><span className="timeline-dot"/><div><time>{date(event.at)}</time><strong>{labels[event.status]}</strong><p>{event.summary}</p></div></li>)}</ol></div>
    {saveError&&<p role="alert" className="form-error">{saveError}</p>}
    <div className="dialog-actions"><button className="secondary-button" onClick={()=>setModal('edit')}>{selected.reporter==='example'?'이 예시로 새 기록 만들기':'기록 업데이트'}</button>{selected.reporter!=='example'&&<button className="text-button" disabled={saving} onClick={archive}>{selected.archived?'보관에서 꺼내기':'보드에서 보관하기'}</button>}</div><p className="fine-print">기록 변경은 실제 Dots의 작업을 시작하거나 중단하지 않습니다.</p>
   </>:<>
    <h2 id="dialog-title">{modal==='edit'&&selected?.reporter!=='example'?'새 소식 남기기':'맡긴 일 기록하기'}</h2><p className="dialog-description">실제로 확인한 내용만 남겨주세요. Dots에게 실행을 지시하는 기능은 아닙니다.</p>
    <form ref={form} key={`${modal}-${selected?.id}`} onSubmit={save}><label>맡긴 일<input name="title" required maxLength={180} defaultValue={modal==='edit'?selected?.title:''} placeholder="예: 공고와 캘린더 시간 비교" autoFocus/></label><label>기록 종류<select name="kind" onChange={event=>{if(event.currentTarget.value==='schedule')event.currentTarget.form?.querySelector('details')?.setAttribute('open','');}} defaultValue={modal==='edit'?selected?.kind??'task':filter==='schedules'?'schedule':'task'}><option value="task">진행상황</option><option value="schedule">기존 예약</option></select></label><label>현재 상태<select name="status" defaultValue={modal==='edit'?selected?.status:'planned'}>{Object.entries(labels).filter(([k])=>k!=='all'&&k!=='archive'&&k!=='schedules').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>지금까지 한 일<textarea name="summary" required maxLength={2000} defaultValue={modal==='edit'?selected?.summary:''} placeholder="실제로 확인하거나 진행한 내용을 적어주세요."/></label><label>다음 행동<textarea name="nextStep" maxLength={2000} defaultValue={modal==='edit'?selected?.nextStep:''}/></label><label>기다리는 답변이나 조건 <small>‘내 응답 필요’ 상태일 때 필수</small><textarea name="waitingFor" maxLength={2000} defaultValue={modal==='edit'?selected?.waitingFor:''}/></label><details className="extra-fields" open={selected?.kind==='schedule'||filter==='schedules'}><summary>예약 주기와 실행 시각</summary><p className="fine-print">기존 예약의 정보를 기록합니다. 새 예약을 만들지 않습니다.</p><label>예약 주기<input name="schedule" maxLength={2000} defaultValue={modal==='edit'?selected?.schedule:''} placeholder="예: 0 9 * * 1-5 또는 매주 월요일 오전 9시"/></label><label>예약 기준 시간대<input name="timezone" defaultValue={modal==='edit'?selected?.timezone??'Asia/Seoul':'Asia/Seoul'} placeholder="Asia/Seoul"/></label><label className="checkbox-label"><input type="checkbox" name="scheduleEnabled" defaultChecked={modal==='edit'?selected?.scheduleEnabled??true:true}/>현재 예약이 활성화되어 있음</label>{['nextRunAt','lastRunAt'].map(key=><label key={key}>{key==='nextRunAt'?'다음 실행':'마지막 실행'} <small>알려진 시각만 입력, 한국 시간</small><input name={key} type="datetime-local" defaultValue={modal==='edit'&&(selected as any)?.[key]?new Date(Date.parse((selected as any)[key])+9*3600000).toISOString().slice(0,16):''}/></label>)}</details><details className="extra-fields"><summary>대화 링크, 결과, 다음 확인 시각</summary><label>원래 대화 또는 자료 링크<input name="sourceUrl" type="url" maxLength={2000} defaultValue={modal==='edit'?selected?.sourceUrl:''} placeholder="https://"/></label><label>결과 링크<input name="resultUrl" type="url" maxLength={2000} defaultValue={modal==='edit'?selected?.resultUrl:''} placeholder="https://"/></label><label>다음 확인 시각 <small>한국 시간</small><input name="nextCheckAt" type="datetime-local" defaultValue={modal==='edit'&&selected?.nextCheckAt?new Date(Date.parse(selected.nextCheckAt)+9*3600000).toISOString().slice(0,16):''}/></label></details>
     {saveError&&<p className="form-error" role="alert">{saveError}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={()=>setModal(null)} disabled={saving}>취소</button><button className="primary-button" type="submit" disabled={saving}>{saving?'저장 중…':'기록 저장'}</button></div>
    </form>
   </>}
  </dialog>
  {notice&&<div className="toast" role="status"><Check size={16}/>{notice}</div>}
 </div>;
}
