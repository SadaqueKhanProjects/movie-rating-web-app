import { KEY, GENRES, DEMO, today, read, save, filterFilms } from './core.js';
const $ = s => document.querySelector(s);
let films=[], raw=null, demo=false, blocked=false, editing=null, draftRaw=null, deleting=null, deleteRaw=null, toastTimer;
const dialog=$('#film-dialog'), form=$('#film-form');
function announce(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4000); }
function load() {
  try { ({films,raw}=read(localStorage)); blocked=false; $('#storage-error').hidden=true; }
  catch(error) { blocked=true; $('#storage-error').textContent=`Journal unavailable: ${error.message} Saved data will not be overwritten. If browser storage is blocked, enable it and reload this page.`; $('#storage-error').hidden=false; }
  document.querySelectorAll('.add-button').forEach(b=>b.disabled=blocked);
  render();
}
for (const selector of ['#genre-filter','#genre-input']) for(const genre of GENRES) $(selector).add(new Option(genre,genre));
$('#watched-input').max=today();
for(const selector of ['#from-date','#to-date']) { $(selector).min='1888-01-01'; $(selector).max=today(); }
function filters() {
  const range=$('#score-filter').value;
  const [min,max]=range==='all'?[0,10]:range.split('-').map(Number);
  return {query:$('#search').value,genre:$('#genre-filter').value,min,max,from:$('#from-date').value,to:$('#to-date').value,sort:$('#sort').value};
}
const palettes=[['#977c81','#5f555f'],['#314e54','#a3a17c'],['#9c9c77','#d7c59d'],['#6c8b7d','#b4cbb0'],['#a27a59','#d0ae84'],['#596577','#a0a8b8']];
function el(tag,className,text) { const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; }
function card(f) {
  const article=el('article','film-card');
  const art=el('div','film-art'); art.setAttribute('aria-hidden','true');
  const hash=[...f.title].reduce((sum,c)=>sum+c.codePointAt(0),0); const palette=palettes[hash%palettes.length];
  art.style.setProperty('--art-bg',palette[0]); art.style.setProperty('--art-fg',palette[1]);
  art.append(el('span','art-caption','A FRAME IN TIME'),el('span','art-initial',f.title.split(/\s+/).slice(0,2).map(w=>w[0]).join('')));
  const badge=el('div','score-badge'); badge.append(el('span','','★'),document.createTextNode(`${f.score.toFixed(1)}`)); art.append(badge);
  const body=el('div','card-body'); body.append(el('h3','',f.title));
  const accessibleScore=el('span','genre-tag',`${f.genre} · ${f.score.toFixed(1)} / 10`);body.append(accessibleScore,el('p','review',f.review));
  const bottom=el('div','card-bottom'); const time=el('time','',new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${f.watched}T12:00:00`)));time.dateTime=f.watched;bottom.append(time);
  if(!demo) { const actions=el('div','card-actions'); const edit=el('button','','Edit'),remove=el('button','','Remove'); edit.setAttribute('aria-label',`Edit ${f.title}`);remove.setAttribute('aria-label',`Remove ${f.title}`);edit.disabled=blocked;remove.disabled=blocked;edit.onclick=()=>openForm(f);remove.onclick=()=>openDelete(f);actions.append(edit,remove);bottom.append(actions); }
  body.append(bottom);article.append(art,body);return article;
}
function render() {
  const source=demo?DEMO:films, f=filters(); const visible=filterFilms(source,f);
  $('#total').textContent=source.length;$('#count').textContent=source.length;
  $('#average').textContent=source.length?(source.reduce((s,f)=>s+f.score,0)/source.length).toFixed(1):'—';
  $('#month').textContent=source.filter(f=>f.watched.startsWith(today().slice(0,7))).length;
  $('#journal-title').firstChild.textContent=demo?'Sample film journal ':'Your film journal ';
  $('#demo-notice').hidden=!demo;$('#demo-toggle').textContent=demo?'Back to my journal ↗':'Explore a sample journal ↗';
  const active=!!(f.query||f.genre||f.min!==0||f.max!==10||f.from||f.to);
  $('#clear-filters').hidden=!active;
  $('#date-error').textContent=f.from&&f.to&&f.from>f.to?'The start date is after the end date.':'';
  $('#results').textContent=source.length?`${visible.length} of ${source.length} film${source.length===1?'':'s'}${demo?' · Sample data':''}`:'Your collection starts here';
  $('#films').replaceChildren(...visible.map(card));$('#empty').hidden=source.length>0||blocked;$('#no-results').hidden=!source.length||visible.length>0;
}
function reset() {$('#search').value='';$('#genre-filter').value='';$('#score-filter').value='all';$('#from-date').value='';$('#to-date').value='';$('#sort').value='newest';render();}
for(const id of ['search','genre-filter','score-filter','sort','from-date','to-date']) $('#'+id).addEventListener('input',render);
$('#clear-filters').onclick=reset;$('#reset-results').onclick=reset;
$('#date-toggle').onclick=()=>{const shown=$('#date-filters').hidden;$('#date-filters').hidden=!shown;$('#date-toggle').setAttribute('aria-expanded',String(shown));};
function toggleDemo(){demo=!demo;reset();}
$('#demo-toggle').onclick=toggleDemo;$('#leave-demo').onclick=toggleDemo;
function openForm(film=null) {
  if(blocked)return;
  // Refresh before opening; retain the exact snapshot for conflict detection at save.
  load();if(blocked)return;
  if(film) {film=films.find(f=>f.id===film.id);if(!film){announce('This film was removed in another tab.');return;}}
  editing=film?.id??null; draftRaw=raw;form.reset();$('#form-error').hidden=true;
  $('#form-title').textContent=film?'Edit your film':'Log a film';
  $('#title-input').value=film?.title??'';$('#genre-input').value=film?.genre??'';$('#watched-input').value=film?.watched??today();$('#score-input').value=film?.score??'';$('#review-input').value=film?.review??'';
  $('#review-count').textContent=$('#review-input').value.length;dialog.showModal();$('#title-input').focus();
}
document.querySelectorAll('.add-button').forEach(b=>b.onclick=()=>openForm());
document.querySelectorAll('#film-dialog .close').forEach(b=>b.onclick=()=>dialog.close());
$('#review-input').oninput=()=>$('#review-count').textContent=$('#review-input').value.length;
form.onsubmit=event=>{
  event.preventDefault();
  const film={id:editing??crypto.randomUUID(),title:$('#title-input').value.trim(),genre:$('#genre-input').value,watched:$('#watched-input').value,score:Number($('#score-input').value),review:$('#review-input').value.trim()};
  const next=editing?films.map(f=>f.id===editing?film:f):[film,...films];
  try {raw=save(localStorage,next,draftRaw);films=next;demo=false;reset();dialog.close();announce(editing?'Film updated. A fresh take.':'Film saved. Another one for the collection.');}
  catch(error){$('#form-error').textContent=`Couldn't save: ${error.message} Your draft has been kept. Check browser storage permissions or available space if needed.`;$('#form-error').hidden=false;}
};
function openDelete(film) {deleting=film;deleteRaw=raw;$('#delete-description').textContent=`“${film.title}” and your review will be removed.`;$('#delete-error').hidden=true;$('#delete-dialog').showModal();$('#cancel-delete').focus();}
$('#cancel-delete').onclick=()=>$('#delete-dialog').close();
$('#confirm-delete').onclick=()=>{
  const next=films.filter(f=>f.id!==deleting.id);
  try {raw=save(localStorage,next,deleteRaw);films=next;$('#delete-dialog').close();render();announce('Film removed from your journal.');}
  catch(error){$('#delete-error').textContent=error.message;$('#delete-error').hidden=false;}
};
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){load();if(dialog.open){$('#form-error').textContent='Your journal changed in another tab. Your draft is kept here; close and reopen the form before saving.';$('#form-error').hidden=false;}announce('Journal refreshed from another tab.');}});
load();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{ /* The journal still works online when offline caching is unavailable. */ });
