/* Books Pro — English Learning & Curriculum app. Sources: the 8 PDFs in the Drive folder "books pro". */
const BOOKS = window.BOOKS, WS = window.WORKSHEETS, TM = window.TESTMASTER;
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const KEY = "books-pro-v1";
let store; try { store = JSON.parse(localStorage.getItem(KEY)) || {} } catch(e) { store = {} }
store.doneWs = store.doneWs || {}; store.scores = store.scores || [];
function save(){ localStorage.setItem(KEY, JSON.stringify(store)); }
function pct(n,d){ return d ? Math.round(n/d*100) : 0 }

const TITLES = { library:"Library", quiz:"TEST MASTER Quiz", worksheets:"Grammar Worksheets", schemes:"Schemes of Work", progress:"My Progress" };
document.querySelectorAll("#nav button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll("#nav button").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); render(b.dataset.view);
}));
function render(v){ ({ library:vLibrary, quiz:vQuiz, worksheets:vWorksheets, schemes:vSchemes, progress:vProgress }[v] || vLibrary)(); }

/* ---------- Library ---------- */
let libQ = "";
function vLibrary(){
  const list = BOOKS.filter(b => !libQ || (b.title+" "+b.file+" "+b.desc+" "+b.tags.join(" ")).toLowerCase().includes(libQ));
  $("#view").innerHTML = `
  <div class="card"><h2>The books pro shelf — 8 books</h2>
  <input id="libQ" placeholder="Search the shelf (e.g. grammar, scheme, class 6, worksheets…)" value="${esc(libQ)}">
  <div class="grid cols-3" style="margin-top:16px">
  ${list.map(b => `<div class="card doc">
    <div>${b.tags.map(t=>`<span class="pill">${esc(t)}</span>`).join(" ")}</div>
    <h3 style="margin:8px 0 4px">${esc(b.title)}</h3>
    <span class="meta">${esc(b.kind)} · ${esc(b.size)}${b.author ? " · " + esc(b.author) : ""}</span>
    <p>${esc(b.desc)}</p>
    <p class="meta">Drive file: ${esc(b.file)} · folder: books pro</p>
    <div><a class="btn" href="${b.url}" target="_blank" rel="noopener">Open in Drive ↗</a></div>
  </div>`).join("") || '<p class="muted">No book matches that search.</p>'}
  </div></div>
  <div class="notice" style="margin-top:16px"><b>One honest gap:</b> <i>digital-65ae24fecf49b7.61315711.pdf</i> (3.65 MB) could not be read by Drive's text extractor, so it is listed as <b>unidentified</b> rather than guessed. Open it in Drive, then update its title in <code>data/books-pro.json</code> and re-run <code>python3 scripts/build_books_data.py</code>.</div>`;
  const q = $("#libQ");
  q.addEventListener("input", () => { libQ = q.value.toLowerCase(); const pos = q.selectionStart; vLibrary(); const n = $("#libQ"); n.focus(); n.setSelectionRange(pos, pos); });
}

/* ---------- TEST MASTER Quiz ---------- */
let quiz = null;
function vQuiz(){
  if (quiz && !quiz.done) {
    const q = quiz.data.questions[quiz.i];
    $("#view").innerHTML = `<div class="card">
      <p class="muted">${esc(quiz.data.title)} — Question ${quiz.i+1} / ${quiz.data.questions.length} · Score: ${quiz.score}</p>
      <h2>${esc(q.q)}</h2>
      ${q.options.map((o,i)=>`<button class="opt" data-o="${i}">${"ABCD"[i]}) ${esc(o)}</button>`).join("")}
      <p id="fb"></p><button class="btn" id="next" disabled>Next</button></div>`;
    document.querySelectorAll("[data-o]").forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.o), ok = i === q.answer; if (ok) quiz.score++;
      document.querySelectorAll("[data-o]").forEach(x => { x.disabled = true; if (Number(x.dataset.o) === q.answer) x.classList.add("correct"); else if (x === b) x.classList.add("wrong"); });
      $("#fb").innerHTML = ok ? "✅ Correct!" : `❌ Correct answer: <b>${"ABCD"[q.answer]}) ${esc(q.options[q.answer])}</b>`;
      $("#next").disabled = false;
    }));
    $("#next").addEventListener("click", () => { quiz.i++; if (quiz.i >= quiz.data.questions.length) { quiz.done = true; store.scores.push({ title: quiz.data.title, score: quiz.score, total: quiz.data.questions.length, date: new Date().toISOString().slice(0,10) }); save(); } vQuiz(); });
    return;
  }
  if (quiz && quiz.done) {
    $("#view").innerHTML = `<div class="card"><h2>Result</h2>
      <p style="font-size:22px"><b>${quiz.score} / ${quiz.data.questions.length}</b> — ${pct(quiz.score, quiz.data.questions.length)}%</p>
      <p class="muted">${esc(quiz.data.title)} · saved to My Progress</p>
      <button class="btn" id="again">Choose another test</button></div>`;
    $("#again").addEventListener("click", () => { quiz = null; vQuiz(); }); return;
  }
  $("#view").innerHTML = `<div class="card"><h2>${esc(TM.title)} <span class="muted">— ${esc(TM.author)}</span></h2>
    <p><b>${TM.totalQuestions.toLocaleString()} questions</b> · Answer key pp. ${TM.answerKeyPages} · <a href="${BOOKS[0].url}" target="_blank" rel="noopener">Open the full book in Drive ↗</a></p>
    ${TM.books.map(b => `<h3>${esc(b.name)} — ${b.questions.toLocaleString()} questions</h3>
      <table><tr><th>Part</th><th>Pages</th><th>Contents</th></tr>${b.parts.map(p=>`<tr><td><b>${p.part}</b></td><td>${p.pages}</td><td>${esc(p.desc)}</td></tr>`).join("")}</table>`).join("")}
    <h3>Playable tests (transcribed from Book 1, Part A)</h3>
    ${TM.quizzes.map(q => `<p><button class="btn" data-q="${q.id}">▶ ${esc(q.title)}</button></p>`).join("")}
    <p class="muted">To add more tests: transcribe them from the PDF into <code>TESTMASTER.quizzes</code> in <code>assets/books-data.js</code> (format: q, options A–D, answer 0–3), checking against the answer key on pp. 403–431.</p></div>`;
  document.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => { quiz = { data: TM.quizzes.find(x => x.id === b.dataset.q), i: 0, score: 0, done: false }; vQuiz(); }));
}

/* ---------- Worksheets ---------- */
let wsGroup = "all", wsQ = "";
function vWorksheets(){
  const groups = ["all", ...new Set(WS.map(w => w.group))];
  const list = WS.filter(w => (wsGroup === "all" || w.group === wsGroup) && (!wsQ || (w.title + " " + w.group).toLowerCase().includes(wsQ)));
  const done = WS.filter(w => store.doneWs[w.n]).length;
  $("#view").innerHTML = `<div class="card"><h2>Grammar Worksheets — 60 worksheets</h2>
    <p class="muted">From <a href="${BOOKS[2].url}" target="_blank" rel="noopener">worksheets-grammar.pdf</a>. Tick a worksheet when you have completed/printed it — progress is saved in this browser (${done}/60 done).</p>
    <div class="bar"><i style="width:${pct(done,60)}%"></i></div>
    <div class="chipbar">${groups.map(g => `<button class="chip ${wsGroup===g?"active":""}" data-g="${esc(g)}">${g==="all"?"All (60)":esc(g)}</button>`).join("")}</div>
    <input id="wsQ" placeholder="Search worksheets (e.g. passive, modals, relative…)" value="${esc(wsQ)}">
    <div style="margin-top:8px">${list.map(w => `<label class="ws-row">
      <input type="checkbox" data-ws="${w.n}" ${store.doneWs[w.n]?"checked":""}>
      <span><b>Worksheet ${w.n}:</b> ${esc(w.title)}<br><small class="muted">${esc(w.group)}</small></span>
      ${store.doneWs[w.n] ? '<span class="pill done">done</span>' : ""}
      <a style="margin-left:auto" href="${BOOKS[2].url}" target="_blank" rel="noopener">Open PDF ↗</a></label>`).join("") || '<p class="muted">No worksheet matches.</p>'}</div></div>`;
  document.querySelectorAll("[data-g]").forEach(b => b.addEventListener("click", () => { wsGroup = b.dataset.g; vWorksheets(); }));
  document.querySelectorAll("[data-ws]").forEach(c => c.addEventListener("change", () => { store.doneWs[c.dataset.ws] = c.checked; save(); vWorksheets(); }));
  const q = $("#wsQ"); q.addEventListener("input", () => { wsQ = q.value.toLowerCase(); const pos = q.selectionStart; vWorksheets(); const n = $("#wsQ"); n.focus(); n.setSelectionRange(pos, pos); });
}

/* ---------- Schemes ---------- */
function vSchemes(){
  const schemes = BOOKS.filter(b => b.tags.includes("scheme"));
  $("#view").innerHTML = `<div class="card"><h2>Integrated Schemes of Work — Classes 2–6 (EFEDI Schools, Azobe-EFEDI)</h2>
    <div class="grid cols-3">${schemes.map(b => `<div class="card doc"><h3>${esc(b.title.replace(" — English Language",""))}</h3>
      <span class="meta">${esc(b.kind)} · ${esc(b.size)}</span><p>${esc(b.desc)}</p>
      <a class="btn" href="${b.url}" target="_blank" rel="noopener">Open scheme ↗</a></div>`).join("")}</div></div>
  <div class="card" style="margin-top:16px"><h2>Class 6 — full weekly programme (from its scheme of work)</h2>
    <p class="muted">Level 3 (Primary Six) · 8 themes × 4 weeks = 32 weeks. Culminating project, Theme 1: Nature Language Journal (descriptive essay, nature poem, 3 persuasive statements on protecting nature, weather dialogue).</p>
    ${window.CLASS6_ENGLISH.map(t => `<h3>Theme ${t.theme}: ${esc(t.title)}</h3>
      <table><tr><th>Week</th><th>Topic</th></tr>${t.weeks.map(w=>`<tr><td>Week ${w[0]}</td><td>${esc(w[1])}</td></tr>`).join("")}</table>`).join("")}
    <p class="muted">Class 2 (Level 1, Primary 2) starts: Theme 1 The Home (W1–4: Greeting and Describing People at Home; Describing Home Places and Objects; Describing Home Routines and Actions; Sharing and Performing), Theme 2 The Village/Town (W5–8), Theme 3 The School (W9–12), Theme 4 Occupations (W13–16), Theme 5 Travelling (W17–20)… Full weekly tables for Classes 2–5 are inside their PDFs above.</p></div>`;
}

/* ---------- Progress ---------- */
function vProgress(){
  const done = WS.filter(w => store.doneWs[w.n]).length;
  $("#view").innerHTML = `<div class="grid cols-2">
    <div class="card"><h2>Worksheets progress</h2><p style="font-size:30px"><b>${done} / 60</b> completed (${pct(done,60)}%)</p><div class="bar"><i style="width:${pct(done,60)}%"></i></div>
    <p class="muted">Tick worksheets off in the Grammar Worksheets module.</p></div>
    <div class="card"><h2>Quiz history</h2>
    ${store.scores.length ? `<table><tr><th>Date</th><th>Test</th><th>Score</th></tr>${store.scores.slice().reverse().map(s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.title)}</td><td><b>${s.score}/${s.total}</b> (${pct(s.score,s.total)}%)</td></tr>`).join("")}</table>` : '<p class="muted">No quizzes taken yet — start one in the TEST MASTER Quiz module.</p>'}
    <p><button class="btn ghost" id="reset">Reset my progress</button></p></div></div>`;
  const r = $("#reset"); if (r) r.addEventListener("click", () => { if (confirm("Clear worksheet ticks and quiz history?")) { store = { doneWs:{}, scores:[] }; save(); vProgress(); } });
}

render("library");
