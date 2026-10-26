/* École Azobe — School Manager. Data model mirrors the School_Manager workbook:
   Registration, Roll_Call (P/A/L/E), Weekly_Controls (/20), Daily_Performance (/10),
   Competence entry (/280 term, /180 month), Reports. Stored locally in the browser. */
const KEY = "azobe-school-manager-v1";
const S = window.SCHOOL, DOCS = window.DOCUMENTS;
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = (n, d=2) => (n===null||n===undefined||isNaN(n)) ? "–" : Number(n).toFixed(d).replace(/\.00$/,"");

function seedPupils(){
  const out=[];
  S.classes.forEach(c=>{ for(let i=1;i<=c.enrolled;i++){ const n=String(i).padStart(2,"0");
    out.push({id:`${c.name.replace("ème","EME").replace("nde","ND")}-${n}`, cls:c.name, no:i, name:"", gender:"", dob:"", parent:"", phone:"", status:"Active"}); }});
  return out;
}
let db;
try{ db = JSON.parse(localStorage.getItem(KEY)) }catch(e){ db=null }
if(!db || !db.pupils){ db = { pupils: seedPupils(), roll:{}, controls:{}, daily:{}, grades:{} }; save(); }
function save(){ localStorage.setItem(KEY, JSON.stringify(db)); const el=$("#saveState"); if(el){ el.textContent="Saved ✓ "+new Date().toLocaleTimeString(); } }
function cote(pct){ if(pct>=90) return "A+"; if(pct>=75) return "A"; if(pct>=50) return "ECA/B"; return "NA"; }
function pupilsOf(cls){ return db.pupils.filter(p=>p.cls===cls).sort((a,b)=>a.no-b.no); }
function classNames(){ return S.classes.map(c=>c.name); }

const TITLES={dashboard:"Dashboard",pupils:"Pupils & Classes",rollcall:"Roll Call",controls:"Weekly Controls",performance:"Daily Performance",grades:"Grades & Report Card",curriculum:"Curriculum",calendar:"Calendar 2026-27",documents:"Document Library",quiz:"TEST MASTER Quiz",data:"Import & Data"};
document.querySelectorAll("#nav button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("#nav button").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  $("#viewTitle").textContent=TITLES[b.dataset.view]; render(b.dataset.view);
}));
$("#exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(db,null,1)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="azobe-school-manager-data.json"; a.click();
});

function render(view){ ({dashboard:vDashboard,pupils:vPupils,rollcall:vRoll,controls:vControls,performance:vDaily,grades:vGrades,curriculum:vCurriculum,calendar:vCalendar,documents:vDocs,quiz:vQuiz,data:vData}[view]||vDashboard)(); }

/* ---------------- Dashboard ---------------- */
function vDashboard(){
  const wc=S.workingCopy.recorded;
  const max=Math.max(...S.classes.map(c=>c.enrolled));
  $("#view").innerHTML=`
  <div class="grid cols-4">
    <div class="card stat"><div class="num">${S.totalEnrolled}</div><div class="lbl">Enrolled pupils / Élèves inscrits (School_Manager roll)</div></div>
    <div class="card stat"><div class="num">${S.classes.length}</div><div class="lbl">Classes — SIL → 2nde</div></div>
    <div class="card stat"><div class="num">${S.schoolDays}</div><div class="lbl">School days 2026/2027 (W1 starts Mon ${S.firstWeekMonday})</div></div>
    <div class="card stat"><div class="num">${DOCS.length}</div><div class="lbl">Drive documents catalogued &amp; used by this app</div></div>
  </div>
  <div class="grid cols-2" style="margin-top:16px">
    <div class="card"><h2>Per-class enrolment</h2>
      ${S.classes.map(c=>`<div class="row" style="justify-content:space-between"><span style="width:52px"><b>${esc(c.name)}</b></span><span class="bar" style="flex:1"><i style="width:${Math.round(c.enrolled/max*100)}%"></i></span><span>${c.enrolled}</span><span class="muted" style="width:150px">${esc(c.level)}</span></div>`).join("")}
      <p class="muted">Primary (SIL–CM2): ${S.classes.filter(c=>c.level.startsWith("Primary")).reduce((a,c)=>a+c.enrolled,0)} pupils · Secondary: ${S.classes.filter(c=>!c.level.startsWith("Primary")).reduce((a,c)=>a+c.enrolled,0)} pupils.</p></div>
    <div class="card"><h2>Recorded data on file <span class="pill warn">from TRUE MANANGER</span></h2>
      <p>The working workbook already contains real entries for <b>${esc(wc.classFocus)}</b>:</p>
      <ul class="checklist">
        <li>Attendance rate: <b>${wc.attendanceRate}%</b> (roll marks P ${wc.roll.P} · A ${wc.roll.A} · L ${wc.roll.L} · E ${wc.roll.E})</li>
        <li>Weekly controls /20 — English <b>${fmt(wc.weeklyControls["English Language"])}</b>, French <b>${fmt(wc.weeklyControls["French Language"])}</b></li>
        <li>Daily performance /10 — ${Object.entries(wc.dailyPerformance).map(([k,v])=>`${esc(k)} <b>${fmt(v,1)}</b>`).join(" · ")}</li>
      </ul>
      <p class="muted">Canonical roll is the clean <b>School_Manager</b> workbook (244 pupils); TRUE MANANGER totals 241 (CE2 26, CM1 26, CM2 25). Enter new data in the modules on the left — it is saved in this browser.</p></div>
  </div>
  <div class="card" style="margin-top:16px"><h2>How this school is assessed <span class="muted">(from the workbooks)</span></h2>
    <div class="kpi-row">
      <div><b>Weekly controls</b><br><span class="muted">${S.weeklySubjects.join(", ")} — /20</span></div>
      <div><b>Daily performance</b><br><span class="muted">${S.dailyAreas.join(", ")} — /10</span></div>
      <div><b>Term framework</b><br><span class="muted">6 competences, /${S.termTotal} · Monthly card /${S.monthTotal} (C1 French &amp; English, C2, C4, C5)</span></div>
      <div><b>Cotes</b><br><span class="muted">${S.cotes.map(c=>`${c.k} ≥ ${c.min}%`).join(" · ")}</span></div>
    </div><p class="muted">${esc(S.overallRule)}</p></div>`;
}

/* ---------------- Pupils ---------------- */
let pupilCls = S.classes[0].name, pupilQ = "";
function vPupils(){
  const list = pupilsOf(pupilCls).filter(p=>!pupilQ || (p.name+" "+p.id).toLowerCase().includes(pupilQ));
  $("#view").innerHTML=`
  <div class="notice"><b>Privacy note:</b> the 244 real pupil names stay in your Drive workbook (<i>School_Manager → Registration</i>) and are <b>not</b> copied into this website's code. The roll below is pre-built with the workbook's exact IDs and class sizes (${S.classes.map(c=>c.name+" "+c.enrolled).join(" · ")}). Add each pupil's name here, or import the whole roll in <b>Import &amp; Data</b>.</div>
  <div class="card" style="margin-top:14px"><div class="row">
    <label>Class <select id="pCls">${classNames().map(c=>`<option ${c===pupilCls?"selected":""}>${c}</option>`).join("")}</select></label>
    <input id="pQ" placeholder="Search name or ID…" value="${esc(pupilQ)}" style="flex:1;min-width:180px">
    <button class="btn" id="pAdd">+ Add pupil</button></div>
  <table style="margin-top:12px"><tr><th>ID</th><th>No</th><th>Full name</th><th>Gender</th><th>DOB</th><th>Parent / guardian</th><th>Phone</th><th>Status</th><th></th></tr>
  ${list.map(p=>`<tr><td><b>${esc(p.id)}</b></td><td>${p.no}</td>
    <td><input data-f="name" data-id="${esc(p.id)}" value="${esc(p.name)}" placeholder="Pupil ${esc(p.id)} — type name"></td>
    <td><select data-f="gender" data-id="${esc(p.id)}"><option value="">–</option><option ${p.gender==="M"?"selected":""}>M</option><option ${p.gender==="F"?"selected":""}>F</option></select></td>
    <td><input type="date" data-f="dob" data-id="${esc(p.id)}" value="${esc(p.dob)}"></td>
    <td><input data-f="parent" data-id="${esc(p.id)}" value="${esc(p.parent)}"></td>
    <td><input data-f="phone" data-id="${esc(p.id)}" value="${esc(p.phone)}"></td>
    <td><select data-f="status" data-id="${esc(p.id)}">${["Active","Transferred","Suspended","Expelled","Graduated"].map(s=>`<option ${p.status===s?"selected":""}>${s}</option>`).join("")}</select></td>
    <td><button class="btn small danger" data-del="${esc(p.id)}">✕</button></td></tr>`).join("")}
  </table><p class="muted">${list.length} pupil(s) in ${esc(pupilCls)} · workbook enrolment: ${S.classes.find(c=>c.name===pupilCls).enrolled}</p></div>`;
  $("#pCls").addEventListener("change",e=>{pupilCls=e.target.value;vPupils();});
  $("#pQ").addEventListener("input",e=>{pupilQ=e.target.value.toLowerCase();vPupils();$("#pQ").focus();});
  document.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("change",()=>{
    const p=db.pupils.find(x=>x.id===el.dataset.id); if(p){ p[el.dataset.f]=el.value; save(); } }));
  document.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{ if(confirm("Remove "+b.dataset.del+"?")){ db.pupils=db.pupils.filter(p=>p.id!==b.dataset.del); save(); vPupils(); } }));
  $("#pAdd").addEventListener("click",()=>{
    const inCls=db.pupils.filter(p=>p.cls===pupilCls); const no=(inCls.length?Math.max(...inCls.map(p=>p.no)):0)+1;
    const base=pupilCls.replace("ème","EME").replace("nde","ND");
    db.pupils.push({id:`${base}-${String(no).padStart(2,"0")}`,cls:pupilCls,no,name:"",gender:"",dob:"",parent:"",phone:"",status:"Active"}); save(); vPupils(); });
}

/* ---------------- Roll call ---------------- */
let rollCls=S.classes[4].name, rollDate=S.firstWeekMonday;
function vRoll(){
  const key=rollCls+"|"+rollDate, marks=db.roll[key]||{};
  const list=pupilsOf(rollCls);
  const cnt={P:0,A:0,L:0,E:0}; Object.values(marks).forEach(m=>{if(cnt[m]!==undefined)cnt[m]++;});
  const att=list.length? Math.round((cnt.P+cnt.L+cnt.E)/list.length*1000)/10 : 0;
  $("#view").innerHTML=`<div class="card"><div class="row"><label>Class <select id="rCls">${classNames().map(c=>`<option ${c===rollCls?"selected":""}>${c}</option>`).join("")}</select></label>
  <label>Date <input type="date" id="rDate" value="${rollDate}"></label>
  <span class="pill">Present ${cnt.P}</span><span class="pill">Absent ${cnt.A}</span><span class="pill">Late ${cnt.L}</span><span class="pill">Excused ${cnt.E}</span><span class="pill">Attendance ${att}%</span>
  <button class="btn ghost" id="rAll">Mark all present</button></div>
  <table style="margin-top:12px"><tr><th>ID</th><th>Pupil</th><th>Roll mark (workbook codes)</th></tr>
  ${list.map(p=>`<tr><td><b>${esc(p.id)}</b></td><td>${esc(p.name)||'<span class="muted">Pupil '+esc(p.id)+'</span>'}</td>
  <td>${["P","A","L","E"].map(m=>`<button class="markbtn ${marks[p.id]===m?"sel-"+m:""}" data-mark="${esc(p.id)}|${m}">${m}</button>`).join(" ")}</td></tr>`).join("")}</table>
  <p class="muted">${S.rollMarks.map(r=>`<b>${r.k}</b> ${esc(r.label)}`).join(" · ")}</p></div>`;
  $("#rCls").addEventListener("change",e=>{rollCls=e.target.value;vRoll();});
  $("#rDate").addEventListener("change",e=>{rollDate=e.target.value;vRoll();});
  $("#rAll").addEventListener("click",()=>{ db.roll[key]=db.roll[key]||{}; list.forEach(p=>db.roll[key][p.id]="P"); save(); vRoll(); });
  document.querySelectorAll("[data-mark]").forEach(b=>b.addEventListener("click",()=>{ const [id,m]=b.dataset.mark.split("|");
    db.roll[key]=db.roll[key]||{}; db.roll[key][id]= db.roll[key][id]===m ? "" : m; save(); vRoll(); }));
}

/* ---------------- Entry grids (controls & daily) ---------------- */
function entryGrid(kind){
  const isC = kind==="controls";
  const fields = isC ? S.weeklySubjects : S.dailyAreas, max = isC?20:10;
  const store = isC? db.controls : db.daily;
  const clsKey = kind+"Cls", perKey = kind+"Per";
  if(!window[clsKey]) window[clsKey]=S.classes[4].name;
  if(!window[perKey]) window[perKey]= isC? "Week 1" : S.firstWeekMonday;
  const cls=window[clsKey], per=window[perKey], key=cls+"|"+per, rec=store[key]||{};
  const list=pupilsOf(cls);
  const periods = isC? Array.from({length:47},(_,i)=>"Week "+(i+1)) : null;
  $("#view").innerHTML=`<div class="card"><h2>${isC?"Weekly controls — subjects /20":"Daily performance — areas /10"}</h2>
  <div class="row"><label>Class <select id="eCls">${classNames().map(c=>`<option ${c===cls?"selected":""}>${c}</option>`).join("")}</select></label>
  ${isC?`<label>Week <select id="ePer">${periods.map(p=>`<option ${p===per?"selected":""}>${p}</option>`).join("")}</select></label>`
       :`<label>Date <input type="date" id="ePer" value="${per}"></label>`}
  <span class="muted">${isC?"One row per pupil per week: the 4 subjects /20 (Workbook: Weekly_Controls)":"One row per pupil per day: the 7 areas /10 (Workbook: Daily_Performance)"}</span></div>
  <div style="overflow:auto"><table style="margin-top:12px"><tr><th>ID</th><th>Pupil</th>${fields.map(f=>`<th>${esc(f)}</th>`).join("")}<th>Avg</th></tr>
  ${list.map(p=>{ const r=rec[p.id]||{}; const vals=fields.map(f=>r[f]).filter(v=>v!==""&&v!==undefined&&v!==null);
    const avg=vals.length? vals.reduce((a,b)=>a+Number(b),0)/vals.length : null;
    return `<tr><td><b>${esc(p.id)}</b></td><td>${esc(p.name)||'<span class="muted">Pupil '+esc(p.id)+'</span>'}</td>
    ${fields.map(f=>`<td><input type="number" min="0" max="${max}" step="0.5" value="${r[f]??""}" data-cell="${esc(p.id)}|${esc(f)}"></td>`).join("")}
    <td><b>${fmt(avg)}</b></td></tr>`}).join("")}</table></div></div>`;
  $("#eCls").addEventListener("change",e=>{window[clsKey]=e.target.value;entryGrid(kind);});
  $("#ePer").addEventListener("change",e=>{window[perKey]=e.target.value;entryGrid(kind);});
  document.querySelectorAll("[data-cell]").forEach(el=>el.addEventListener("change",()=>{
    const [id,f]=el.dataset.cell.split("|"); store[key]=store[key]||{}; store[key][id]=store[key][id]||{};
    store[key][id][f]= el.value===""? "" : Math.min(max,Math.max(0,Number(el.value))); save(); entryGrid(kind); }));
}
function vControls(){ entryGrid("controls"); }
function vDaily(){ entryGrid("daily"); }

/* ---------------- Grades ---------------- */
let gradeCls=S.classes[4].name, gradeId=null, gradeMode="term";
function vGrades(){
  const list=pupilsOf(gradeCls); if(!gradeId||!list.find(p=>p.id===gradeId)) gradeId=list.length?list[0].id:null;
  const comps=S.competences.filter(c=>gradeMode==="term"||c.monthly);
  const totalMax=gradeMode==="term"?S.termTotal:S.monthTotal;
  const g=(gradeId&&db.grades[gradeId])||{};
  const total=comps.reduce((a,c)=>a+(Number(g[c.code])||0),0);
  const pct= totalMax? total/totalMax*100:0;
  $("#view").innerHTML=`<div class="card"><div class="row">
    <label>Class <select id="gCls">${classNames().map(c=>`<option ${c===gradeCls?"selected":""}>${c}</option>`).join("")}</select></label>
    <label>Pupil <select id="gId">${list.map(p=>`<option value="${esc(p.id)}" ${p.id===gradeId?"selected":""}>${esc(p.id)}${p.name?" — "+esc(p.name):""}</option>`).join("")}</select></label>
    <label>Card <select id="gMode"><option value="term" ${gradeMode==="term"?"selected":""}>Term card (/280, 6 competences)</option><option value="month" ${gradeMode==="month"?"selected":""}>Monthly card (/180 — C1 Fr &amp; En, C2, C4, C5)</option></select></label>
    <button class="btn ghost" onclick="window.print()">🖨 Print report card</button></div>
  <table style="margin-top:14px"><tr><th>Code</th><th>Competence</th><th>Discipline (as on the official card)</th><th>Criteria</th><th>Mark</th><th>Max</th></tr>
  ${comps.map(c=>`<tr><td><b>${c.code}</b></td><td>${esc(c.comp)}</td><td>${esc(c.name)}</td><td class="muted">${esc(c.criteria)}</td>
    <td><input type="number" min="0" max="${c.max}" step="0.5" data-g="${c.code}" value="${g[c.code]??""}"></td><td>/${c.max}</td></tr>`).join("")}
  <tr><td colspan="4"><b>TOTAL</b></td><td colspan="2"><b>${fmt(total,1)} / ${totalMax}</b> &nbsp; <span class="pill">${fmt(pct,1)}% · Cote ${cote(pct)}</span></td></tr></table>
  <p class="muted">${esc(S.overallRule)} Cotes: ${S.cotes.map(c=>`<b>${c.k}</b> ≥${c.min}% ${esc(c.label)}`).join(" · ")}</p></div>`;
  $("#gCls").addEventListener("change",e=>{gradeCls=e.target.value;gradeId=null;vGrades();});
  $("#gId").addEventListener("change",e=>{gradeId=e.target.value;vGrades();});
  $("#gMode").addEventListener("change",e=>{gradeMode=e.target.value;vGrades();});
  document.querySelectorAll("[data-g]").forEach(el=>el.addEventListener("change",()=>{
    if(!gradeId) return; db.grades[gradeId]=db.grades[gradeId]||{};
    const c=comps.find(x=>x.code===el.dataset.g);
    db.grades[gradeId][el.dataset.g]= el.value===""? "" : Math.min(c.max,Math.max(0,Number(el.value))); save(); vGrades(); }));
}

/* ---------------- Curriculum ---------------- */
function unitDocs(unitNo){
  return DOCS.filter(d=>d.category==="english6" && new RegExp(`Unit ${unitNo}\\b`).test(d.title));
}
function vCurriculum(){
  $("#view").innerHTML=`
  <div class="card"><h2>Class 6 English — Integrated Scheme of Work (EFEDI Schools · Azobe-EFEDI)</h2>
  <p class="muted">32 weeks · 8 themes · from <i>🌃 Class 6 Integrated Scheme of Work.pdf</i>. Each theme also has a pupil's book PDF, a Compact A3 doc and an A3 print master in the Document Library.</p>
  ${window.CLASS6_ENGLISH.map(t=>`<h3>Theme ${t.theme}: ${esc(t.title)}</h3>
    <div class="row" style="margin-bottom:6px"><span class="muted">Culminating project:</span> ${esc(t.project)}</div>
    <table><tr><th>Week</th><th>Topic</th><th>Documents for this theme</th></tr>
    ${t.weeks.map(w=>`<tr><td>Week ${w[0]}</td><td>${esc(w[1])}</td><td>${w===t.weeks[0]? unitDocs(t.theme).slice(0,3).map(d=>`<a href="${d.url}" target="_blank" rel="noopener">${esc(d.kind)}: ${esc(d.name.replace(/^English (Language )?Class 6 — |^English_Class6_PupilsBook_/,""))}</a>`).join("<br>") : ""}</td></tr>`).join("")}</table>`).join("")}</div>
  <div class="grid cols-2" style="margin-top:16px">
    <div class="card"><h2>Integrated Schemes of Work — Classes 1–6</h2>
      ${DOCS.filter(d=>d.category==="schemes").map(d=>`<p>📄 <a href="${d.url}" target="_blank" rel="noopener"><b>${esc(d.title)}</b></a><br><small class="muted">${esc(d.folder)} · ${esc(d.note)}</small></p>`).join("")}</div>
    <div class="card"><h2>Class 1 Citizenship (ages 5–6)</h2>
      <p class="muted">Term 1 Units 1–3 · Term 2 Units 4–6 · Term 3 Units 7–8, plus scheme of work, full-year lesson plans and weekly worksheets.</p>
      ${DOCS.filter(d=>d.category==="citizenship1").map(d=>`<p>📘 <a href="${d.url}" target="_blank" rel="noopener"><b>${esc(d.title)}</b></a><br><small class="muted">${esc(d.note)}</small></p>`).join("")}
      <h3>Also for Class 6 teachers</h3>
      ${DOCS.filter(d=>["1 Teacher Guide - Autism and EAL.pdf","2 Student Materials - Picture Words and Talking Board.pdf","4 Class 6 English Access Pack (editable).docx","3 Class 6 English Access Pack (print).pdf"].includes(d.name)).map(d=>`<p>🧩 <a href="${d.url}" target="_blank" rel="noopener"><b>${esc(d.title)}</b></a><br><small class="muted">${esc(d.note)}</small></p>`).join("")}</div>
  </div>
  <div class="card" style="margin-top:16px"><h2>Research Methodology — university library</h2>
  <p class="muted">20 files (Root + 'books pro'): final/applied, teacher-guided, compact, detailed and seven-departments editions in editable and PDF forms. This is university-level material — kept as a staff/teacher reference library, not pupil coursework.</p>
  ${DOCS.filter(d=>d.category==="research").map(d=>`<p>🎓 <a href="${d.url}" target="_blank" rel="noopener"><b>${esc(d.title)}</b></a> <span class="pill">${esc(d.kind)}</span><br><small class="muted">${esc(d.folder)} · ${esc(d.note)}</small></p>`).join("")}</div>`;
}

/* ---------------- Calendar ---------------- */
function vCalendar(){
  $("#view").innerHTML=`<div class="card"><h2>Terms 2026/2027 <span class="muted">(Workbook: Lists / Calendar)</span></h2>
  <table><tr><th>Term</th><th>Start</th><th>End</th><th>Weeks</th><th>UA months</th></tr>
  ${S.terms.map(t=>`<tr><td><b>${t.name}</b></td><td>${t.start}</td><td>${t.end}</td><td>${t.weeks}</td><td>${t.uaMonths.join(", ")}</td></tr>`).join("")}</table>
  <p class="muted">180 school days. Week W1 starts Monday ${S.firstWeekMonday}.</p></div>
  <div class="card" style="margin-top:16px"><h2>Key dates — Calendrier scolaire Azobe 2026-2027</h2>
  <table><tr><th>Date</th><th>Event</th><th>Type</th></tr>
  ${window.CALENDAR_EVENTS.map(e=>`<tr><td><b>${e.date}</b></td><td>${esc(e.label)}</td><td><span class="pill">${esc(e.type)}</span></td></tr>`).join("")}</table>
  <p class="muted">Transcribed from <i>Azobe Calendrier_scolaire_2026_2027 (2).xlsx</i> (Aug 2026–Jul 2027 grid). Open the original in the Document Library for the full day-by-day calendar.</p></div>`;
}

/* ---------------- Documents ---------------- */
let docCat="all", docQ="";
function vDocs(){
  const list=DOCS.filter(d=>(docCat==="all"||d.category===docCat) && (!docQ || (d.title+" "+d.name+" "+d.note).toLowerCase().includes(docQ)));
  const cats=[["all","All ("+DOCS.length+")"],...Object.entries(window.DOC_CATEGORIES).map(([k,v])=>[k,`${v} (${DOCS.filter(d=>d.category===k).length})`])];
  $("#view").innerHTML=`
  <div class="notice">Every file in the Drive folder is catalogued below and used somewhere in this app (84 entries incl. 2 sub-folders). <b>Duplicates</b> and <b>private</b> files are flagged so they are not shared by mistake. Files open in Google Drive — nothing is re-uploaded.</div>
  <div class="chipbar">${cats.map(([k,l])=>`<button class="chip ${docCat===k?"active":""}" data-cat="${k}">${esc(l)}</button>`).join("")}</div>
  <input id="dQ" placeholder="Search documents (e.g. Unit 3, citizenship, scheme, research…)" value="${esc(docQ)}" style="width:100%">
  <div class="grid cols-3" style="margin-top:14px">${list.map(d=>`<div class="card doc">
    <a class="title" href="${d.url}" target="_blank" rel="noopener">${esc(d.title)}</a>
    <span class="meta">${esc(d.kind)} · ${esc(d.folder)} · ${esc(d.categoryLabel)}</span>
    ${d.category==="personal"?'<span class="pill private">PRIVATE — do not share with pupils</span>':""}
    ${/DUPLICATE|second copy/i.test(d.note)?'<span class="pill warn">Possible duplicate</span>':""}
    <span class="note">${esc(d.note)}</span>
    ${d.title!==d.name?`<span class="meta">File: ${esc(d.name)}</span>`:""}
    </div>`).join("")||'<p class="muted">No documents match.</p>'}</div>`;
  document.querySelectorAll("[data-cat]").forEach(b=>b.addEventListener("click",()=>{docCat=b.dataset.cat;vDocs();}));
  const q=$("#dQ"); q.addEventListener("input",()=>{docQ=q.value.toLowerCase();const v=q.value, pos=q.selectionStart; vDocs(); const nq=$("#dQ"); nq.focus(); nq.setSelectionRange(pos,pos);});
}

/* ---------------- Quiz ---------------- */
let quizState=null;
function vQuiz(){
  const tm=window.TESTMASTER;
  if(quizState && quizState.done!==true && quizState.idx < quizState.quiz.questions.length){
    const q=quizState.quiz.questions[quizState.idx];
    $("#view").innerHTML=`<div class="card"><p class="muted">${esc(quizState.quiz.title)} — Question ${quizState.idx+1} / ${quizState.quiz.questions.length} · Score so far: ${quizState.score}</p>
    <h2>${esc(q.q)}</h2>
    ${q.options.map((o,i)=>`<button class="opt" data-opt="${i}">${"ABCD"[i]}) ${esc(o)}</button>`).join("")}
    <p id="qFb"></p><button class="btn" id="qNext" disabled>Next</button></div>`;
    document.querySelectorAll("[data-opt]").forEach(b=>b.addEventListener("click",()=>{
      const i=Number(b.dataset.opt), ok=i===q.answer;
      if(ok) quizState.score++;
      document.querySelectorAll("[data-opt]").forEach(x=>{ x.disabled=true; if(Number(x.dataset.opt)===q.answer)x.classList.add("correct"); else if(x===b)x.classList.add("wrong"); });
      $("#qFb").innerHTML= ok? "✅ Correct!" : `❌ Correct answer: <b>${"ABCD"[q.answer]}) ${esc(q.options[q.answer])}</b>`;
      $("#qNext").disabled=false;
    }));
    $("#qNext").addEventListener("click",()=>{ quizState.idx++; if(quizState.idx>=quizState.quiz.questions.length) quizState.done=true; vQuiz(); });
    return;
  }
  if(quizState && quizState.done){
    const n=quizState.quiz.questions.length;
    $("#view").innerHTML=`<div class="card"><h2>Result</h2><p style="font-size:22px"><b>${quizState.score} / ${n}</b> — ${fmt(quizState.score/n*100,0)}% · Cote ${cote(quizState.score/n*100)}</p>
    <p class="muted">${esc(quizState.quiz.title)}</p><button class="btn" id="qAgain">Choose another test</button></div>`;
    $("#qAgain").addEventListener("click",()=>{quizState=null;vQuiz();}); return;
  }
  $("#view").innerHTML=`<div class="card"><h2>${esc(tm.title)} <span class="muted">— ${esc(tm.author)}</span></h2>
  <p><b>${tm.totalQuestions.toLocaleString()} questions</b> in the book · Answer key pp. ${tm.answerKeyPages} · Original PDF (2 copies in Drive) is in the Document Library.</p>
  ${tm.books.map(b=>`<h3>${esc(b.name)} — ${b.questions.toLocaleString()} questions</h3><table><tr><th>Part</th><th>Pages</th><th>Contents</th></tr>${b.parts.map(p=>`<tr><td><b>${p.part}</b></td><td>${p.pages}</td><td>${esc(p.desc)}</td></tr>`).join("")}</table>`).join("")}
  <h3>Playable tests (transcribed from Book 1, Part A)</h3>
  ${tm.quizzes.map(q=>`<p><button class="btn" data-quiz="${q.id}">▶ ${esc(q.title)}</button></p>`).join("")}
  <p class="muted">More tests can be transcribed from the PDF in the same format — see docs/INVENTORY.md.</p></div>`;
  document.querySelectorAll("[data-quiz]").forEach(b=>b.addEventListener("click",()=>{
    quizState={quiz:tm.quizzes.find(q=>q.id===b.dataset.quiz), idx:0, score:0, done:false}; vQuiz(); }));
}

/* ---------------- Import & data ---------------- */
function vData(){
  $("#view").innerHTML=`<div class="grid cols-2">
  <div class="card"><h2>Import pupils (Registration)</h2>
    <p>Export the <b>Registration</b> sheet of <i>School_Manager</i> from Drive (File → Download → CSV), or prepare a CSV with columns:</p>
    <p><code>id,name,class,gender,dob,parent,phone,status</code></p>
    <p class="muted">Only <b>name</b> and <b>class</b> are required; if an ID is given it must match the class pattern (e.g. CE2-13). Imported pupils replace/add to the roll in this browser only.</p>
    <input type="file" id="csvFile" accept=".csv,text/csv"><p id="csvMsg"></p>
    <h3>Template</h3><button class="btn ghost" id="tplBtn">Download CSV template</button></div>
  <div class="card"><h2>Your data in this app</h2>
    <ul class="checklist"><li>${db.pupils.length} pupils on roll (${db.pupils.filter(p=>p.name).length} named)</li>
    <li>${Object.keys(db.roll).length} roll-call day(s) recorded</li>
    <li>${Object.keys(db.controls).length} weekly-control sheet(s) · ${Object.keys(db.daily).length} daily-performance sheet(s)</li>
    <li>${Object.keys(db.grades).length} pupil(s) with competence marks</li></ul>
    <div class="row"><button class="btn" id="expBtn2">Export all data (JSON)</button>
    <label class="btn ghost" style="cursor:pointer">Import JSON<input type="file" id="jsonFile" accept=".json,application/json" hidden></label>
    <button class="btn danger" id="resetBtn">Reset to workbook roll</button></div>
    <p class="muted">Data is stored only in this browser (localStorage). Export regularly for backup, exactly as the Excel workbooks back up to Drive.</p></div></div>
  <div class="card" style="margin-top:16px"><h2>Where every Drive document is used</h2>
  <table><tr><th>Drive source</th><th>Used in</th></tr>
  <tr><td>School_Manager workbook (244 pupils, 11 classes)</td><td>Dashboard, Pupils &amp; Classes, Roll Call, Weekly Controls, Daily Performance, Grades &amp; Report Card</td></tr>
  <tr><td>TRUE MANANGER workbook (working copy, CM1 data)</td><td>Dashboard “Recorded data on file” panel</td></tr>
  <tr><td>Azobe Calendrier scolaire 2026-2027</td><td>Calendar module (terms + key dates)</td></tr>
  <tr><td>Class 1–6 Integrated Schemes of Work + Class 6 English scheme (32 weeks)</td><td>Curriculum module</td></tr>
  <tr><td>Class 6 English pupil's books / A3 editions / Access Pack / Autism &amp; EAL guide</td><td>Curriculum + Document Library (open in Drive)</td></tr>
  <tr><td>Class 1 Citizenship books, lesson plans, worksheets, scheme</td><td>Curriculum + Document Library</td></tr>
  <tr><td>TEST MASTER (16,161 questions) + grammar worksheets</td><td>TEST MASTER Quiz module + Document Library</td></tr>
  <tr><td>Research Methodology editions (20 files) + EIE 510 notes</td><td>Curriculum (staff library) + Document Library</td></tr>
  <tr><td>My Passport, Capiemp certificate, OLALHND</td><td><b>Not used with pupils</b> — catalogued as PRIVATE in the Document Library so they are never shared by mistake</td></tr></table></div>`;
  $("#csvFile").addEventListener("change",e=>{
    const f=e.target.files[0]; if(!f) return;
    f.text().then(t=>{
      const lines=t.split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2){ $("#csvMsg").textContent="CSV looks empty."; return; }
      const head=lines[0].toLowerCase().split(",").map(s=>s.trim());
      const ix={id:head.indexOf("id"),name:head.indexOf("name"),cls:head.findIndex(h=>["class","classe","cls"].includes(h)),gender:head.indexOf("gender"),dob:head.indexOf("dob"),parent:head.indexOf("parent"),phone:head.indexOf("phone"),status:head.indexOf("status")};
      let added=0, updated=0;
      lines.slice(1).forEach(l=>{ const c=l.split(",").map(s=>s.trim()); const name=ix.name>=0?c[ix.name]:""; const cls=ix.cls>=0?c[ix.cls]:"";
        if(!name||!cls) return; let p= ix.id>=0&&c[ix.id]? db.pupils.find(x=>x.id===c[ix.id]) : db.pupils.find(x=>x.cls===cls&&!x.name);
        if(p){ p.name=name; if(ix.gender>=0)p.gender=c[ix.gender]||p.gender; if(ix.dob>=0)p.dob=c[ix.dob]||p.dob; if(ix.parent>=0)p.parent=c[ix.parent]||p.parent; if(ix.phone>=0)p.phone=c[ix.phone]||p.phone; if(ix.status>=0&&c[ix.status])p.status=c[ix.status]; updated++; }
        else { const inCls=db.pupils.filter(x=>x.cls===cls); const no=(inCls.length?Math.max(...inCls.map(x=>x.no)):0)+1;
          db.pupils.push({id:(ix.id>=0&&c[ix.id])||`${cls.replace("ème","EME").replace("nde","ND")}-${String(no).padStart(2,"0")}`,cls,no,name,gender:ix.gender>=0?c[ix.gender]:"",dob:ix.dob>=0?c[ix.dob]:"",parent:ix.parent>=0?c[ix.parent]:"",phone:ix.phone>=0?c[ix.phone]:"",status:"Active"}); added++; } });
      save(); $("#csvMsg").textContent=`Imported: ${updated} updated, ${added} added.`; });
  });
  $("#tplBtn").addEventListener("click",()=>{ const blob=new Blob(["id,name,class,gender,dob,parent,phone,status\nCE2-28,Example Pupil,CE2,M,2018-05-01,Parent Name,690000000,Active\n"],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="azobe-registration-template.csv"; a.click(); });
  $("#expBtn2").addEventListener("click",()=>$("#exportBtn").click());
  $("#jsonFile").addEventListener("change",e=>{ const f=e.target.files[0]; if(!f)return;
    f.text().then(t=>{ try{ const d=JSON.parse(t); if(!d.pupils) throw 0; db=d; save(); alert("Data imported."); vData(); }catch(_){ alert("That JSON file could not be imported."); } }); });
  $("#resetBtn").addEventListener("click",()=>{ if(confirm("Reset everything to the clean workbook roll (244 ID slots, no names/marks)?")){ db={pupils:seedPupils(),roll:{},controls:{},daily:{},grades:{}}; save(); vData(); } });
}

render("dashboard");
