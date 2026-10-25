// ================= Settings =================
// Tentative exam dates. Update these once UPSC publishes the official 2027 calendar.
const PRELIMS_DATE = "2027-05-23";
const MAINS_DATE = "2027-08-20";
const GAME_MINUTES = 5; // length of one break
const GAME_COOLDOWN_HOURS = 2; // wait after a break ends before the next one
const FOCUS_MINUTES = 25;

const TOPIC_COLORS = {
  "Polity & Governance": "#6366f1",
  "International Relations": "#0ea5e9",
  "Economy": "#d97706",
  "Environment & Ecology": "#16a34a",
  "Science & Technology": "#8b5cf6",
  "Health & Social Issues": "#db2777",
  "Internal Security & Defence": "#dc2626",
  "Geography & Disasters": "#0d9488",
  "History, Art & Culture": "#c2410c",
  "Reports & Indices": "#64748b",
};
const SOURCE_SHORT = { "The Hindu": "TH", "Indian Express": "IE", "Mint": "MT" };
const GS_ORDER = ["GS-1", "GS-2", "GS-3", "Prelims"];

const GAME_MS = GAME_MINUTES * 60e3;
const COOLDOWN_MS = GAME_COOLDOWN_HOURS * 3600e3;
const FOCUS_MS = FOCUS_MINUTES * 60e3;

// ================= Icons =================
const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  today: svg('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M8 15h3"/>'),
  archive: svg('<rect x="2" y="3" width="20" height="5" rx="1.5"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>'),
  bookmark: svg('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
  game: svg('<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  refresh: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>'),
  external: svg('<path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  play: svg('<path d="M7 4l13 8-13 8z"/>'),
  pause: svg('<path d="M8 4v16M16 4v16"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
};

// ================= State =================
const data = window.CA_DATA || { items: [], updated: null };
const ls = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const read = new Set(ls.get("ca-read", []));
const saved = new Set(ls.get("ca-saved", []));
const activity = new Set(ls.get("ca-activity", [])); // days on which something was read
let fresh = new Set(); // stories added by the last Refresh

const istNow = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
let todayIST = istNow();

const state = {
  view: "today", // today | date | saved | archive | game
  date: null,
  gs: null,
  topic: null,
  query: "",
  importantOnly: false,
  hideRead: false,
  calMonth: todayIST.slice(0, 7),
};

let byDate = {};
let dates = []; // ascending
function reindex() {
  byDate = {};
  for (const i of data.items) (byDate[i.date] ||= []).push(i);
  dates = Object.keys(byDate).sort();
}

// ================= Helpers =================
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso, o = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", o);
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysUntil = (iso) => Math.max(0, Math.ceil((new Date(iso + "T00:00:00+05:30") - Date.now()) / 86400e3));
const plural = (n, w) => `${n} ${n === 1 ? w : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w + "s"}`;
const color = (topic) => TOPIC_COLORS[topic] || "#6366f1";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function fmtDur(ms) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}h ${String(m).padStart(2, "0")}m ${sec}s` : `${m}:${sec}`;
}

function toast(html, type = "info", ms = 4500) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = html;
  $("toasts").append(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  }, ms);
}

function confetti() {
  if (reduceMotion) return;
  const colors = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9"];
  for (let n = 0; n < 90; n++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[n % colors.length];
    c.style.setProperty("--dx", (Math.random() - 0.5) * 300 + "px");
    c.style.setProperty("--rot", Math.random() * 900 + "deg");
    c.style.setProperty("--dur", 1.8 + Math.random() * 1.6 + "s");
    c.style.animationDelay = Math.random() * 0.3 + "s";
    document.body.append(c);
    setTimeout(() => c.remove(), 4000);
  }
}

// ================= Navigation =================
const NAV = [
  { view: "today", label: "Today", icon: I.today },
  { view: "archive", label: "Archive", icon: I.archive },
  { view: "saved", label: "Revision", icon: I.bookmark },
  { view: "game", label: "Break", icon: I.game },
];

function navBadge(view) {
  if (view === "today") {
    const unread = (byDate[todayIST] || []).filter((i) => !read.has(i.id)).length;
    return unread ? `<span class="badge">${unread}</span>` : "";
  }
  if (view === "saved") return saved.size ? `<span class="badge">${saved.size}</span>` : "";
  if (view === "game") {
    const g = gameStatus();
    if (g.state === "ready") return `<span class="badge ready">Ready</span>`;
    if (g.state === "playing") return `<span class="badge live">${fmtDur(g.left)}</span>`;
    return `<span class="badge">🔒</span>`;
  }
  return "";
}

function renderNav() {
  const activeView = state.query ? null : state.view === "date" ? "archive" : state.view;
  const html = NAV.map((n) =>
    `<button class="nav-item ${activeView === n.view ? "active" : ""}" data-nav="${n.view}">
      ${n.icon}<span>${n.label}</span>${navBadge(n.view)}</button>`).join("");
  if (html === renderNav.last) return; // called every second; avoid needless DOM churn
  renderNav.last = html;
  $("sideNav").innerHTML = html;
  $("bottomNav").innerHTML = html;
}

function setView(view, extra = {}) {
  Object.assign(state, { view, gs: null, topic: null, query: "" }, extra);
  $("search").value = "";
  if (state.view === "date" && state.date === todayIST) state.view = "today";
  if (state.view === "date") state.calMonth = state.date.slice(0, 7);
  render();
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

// ================= Theme =================
function renderTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
    b.innerHTML = `${dark ? I.sun : I.moon}<span class="label">${dark ? "Light mode" : "Dark mode"}</span>`;
    b.title = dark ? "Switch to light mode" : "Switch to dark mode";
  });
  document.querySelector('meta[name="theme-color"]').content = dark ? "#090c16" : "#4f46e5";
}

// ================= Hero (today's progress) =================
function streak() {
  let d = activity.has(todayIST) ? todayIST : addDays(todayIST, -1);
  let n = 0;
  while (activity.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function renderHero() {
  const items = byDate[todayIST] || [];
  const done = items.filter((i) => read.has(i.id)).length;
  const h = new Date().getHours();
  const hello = h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  $("heroDate").textContent = fmtDate(todayIST);
  $("greeting").textContent = `${hello}, Aspirant 👋`;

  const importantLeft = items.filter((i) => i.important && !read.has(i.id)).length;
  $("heroSub").textContent = !items.length
    ? "No stories for today yet. Tap Refresh to fetch the latest news."
    : done === items.length
      ? "All caught up for today! 🎉 Excellent consistency. That's how ranks are made."
      : `${plural(items.length - done, "story")} left today${importantLeft ? `, ${importantLeft} marked important` : ""}. Small steps every day.`;

  $("streak").textContent = streak();
  $("prelimsDays").textContent = daysUntil(PRELIMS_DATE);
  $("mainsDays").textContent = daysUntil(MAINS_DATE);
  $("ringCount").textContent = `${done}/${items.length}`;
  const pct = items.length ? done / items.length : 0;
  $("ringFg").style.strokeDashoffset = 326.7 * (1 - pct);
}

// ================= Focus timer =================
let focus = ls.get("ca-focus", { end: null, left: FOCUS_MS });
const focusLeft = () => (focus.end ? Math.max(0, focus.end - Date.now()) : focus.left);

function focusSessionsToday() {
  const s = ls.get("ca-focus-sessions", {});
  return s.date === todayIST ? s.n : 0;
}

function renderFocus() {
  const left = focusLeft();
  $("focusTime").textContent = fmtDur(left);
  $("focusBar").style.width = `${(1 - left / FOCUS_MS) * 100}%`;
  $("focusToggle").innerHTML = focus.end ? `${I.pause} Pause` : `${I.play} ${left < FOCUS_MS ? "Resume" : "Start"}`;
  $("focusReset").innerHTML = I.reset;
  $("focusTime").parentElement.classList.toggle("running", !!focus.end);
  const n = focusSessionsToday();
  $("focusSessions").textContent = n ? `${n} done today` : "";
}

function tickFocus() {
  if (focus.end && focusLeft() === 0) {
    focus = { end: null, left: FOCUS_MS };
    ls.set("ca-focus", focus);
    ls.set("ca-focus-sessions", { date: todayIST, n: focusSessionsToday() + 1 });
    toast("🎯 Focus session complete! Stretch, hydrate, then go again.", "success", 7000);
    confetti();
  }
  if (!$("hero").hidden) renderFocus();
}

$("focusToggle").addEventListener("click", () => {
  if (focus.end) focus = { end: null, left: focusLeft() };
  else focus = { end: Date.now() + focus.left, left: focus.left };
  ls.set("ca-focus", focus);
  renderFocus();
});
$("focusReset").addEventListener("click", () => {
  focus = { end: null, left: FOCUS_MS };
  ls.set("ca-focus", focus);
  renderFocus();
});

// ================= Calendar =================
function renderCalendar(el) {
  const [y, m] = state.calMonth.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const minMonth = (dates[0] || todayIST).slice(0, 7);
  const maxMonth = todayIST.slice(0, 7);
  const sel = state.view === "date" ? state.date : state.view === "today" ? todayIST : null;
  const max = Math.max(1, ...dates.map((d) => byDate[d].length));

  let cells = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => `<div class="cal-dow">${d}</div>`).join("");
  cells += "<div></div>".repeat(lead);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${state.calMonth}-${String(d).padStart(2, "0")}`;
    const items = byDate[iso] || [];
    const heat = items.length ? Math.round(18 + (items.length / max) * 72) : 0;
    const allRead = items.length && items.every((i) => read.has(i.id));
    const cls = [items.length && "has", heat > 55 && "hot", iso === todayIST && "today", iso === sel && "sel"].filter(Boolean).join(" ");
    cells += `<button class="cal-day ${cls}" style="--heat:${heat}" ${items.length ? `data-date="${iso}" title="${plural(items.length, "story")}"` : "disabled"}>
      ${d}${allRead ? '<span class="done"></span>' : ""}</button>`;
  }
  el.innerHTML = `
    <div class="cal-head">
      <button class="icon-btn" data-cal="-1" ${state.calMonth <= minMonth ? "disabled" : ""} aria-label="Previous month">${I.left}</button>
      <strong>${first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</strong>
      <button class="icon-btn" data-cal="1" ${state.calMonth >= maxMonth ? "disabled" : ""} aria-label="Next month">${I.right}</button>
    </div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend"><span>Darker = more news</span><span><span style="color:var(--success)">●</span> all read</span></div>`;
}

function shiftMonth(n) {
  const [y, m] = state.calMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  state.calMonth = d.toISOString().slice(0, 7);
  renderCalendar($("calendar"));
  if (state.view === "archive") renderCalendar($("calendarBig"));
}

// ================= News list =================
function baseItems() {
  if (state.query) return data.items; // search spans every day
  if (state.view === "saved") return data.items.filter((i) => saved.has(i.id));
  return byDate[state.view === "today" ? todayIST : state.date] || [];
}

function applyFilters(items) {
  const q = state.query.toLowerCase();
  return items.filter((i) =>
    (!state.gs || i.gs.includes(state.gs)) &&
    (!state.topic || i.topics.includes(state.topic)) &&
    (!state.importantOnly || i.important) &&
    (!state.hideRead || !read.has(i.id)) &&
    (!q || `${i.title} ${i.summary} ${i.topics.join(" ")}`.toLowerCase().includes(q)));
}

function renderFilters(items) {
  const gsCount = {};
  const topicCount = {};
  items.forEach((i) => {
    i.gs.forEach((g) => (gsCount[g] = (gsCount[g] || 0) + 1));
    i.topics.forEach((t) => (topicCount[t] = (topicCount[t] || 0) + 1));
  });
  $("gsSeg").innerHTML = `<button class="seg ${!state.gs ? "active" : ""}" data-gs="">All<small>${items.length}</small></button>` +
    GS_ORDER.filter((g) => gsCount[g]).map((g) =>
      `<button class="seg ${state.gs === g ? "active" : ""}" data-gs="${g}">${g}<small>${gsCount[g]}</small></button>`).join("");
  $("topicChips").innerHTML = Object.entries(topicCount).sort((a, b) => b[1] - a[1]).map(([t, n]) =>
    `<button class="chip ${state.topic === t ? "active" : ""}" style="--tc:${color(t)}" data-topic="${esc(t)}">
      <span class="dot"></span>${esc(t)} <small>${n}</small></button>`).join("");
  $("importantOnly").classList.toggle("on", state.importantOnly);
  $("hideRead").classList.toggle("on", state.hideRead);
}

function card(i, idx) {
  const main = i.topics[0];
  const showDate = state.query || state.view === "saved";
  const isRead = read.has(i.id);
  const isSaved = saved.has(i.id);
  return `<article class="card ${isRead ? "is-read" : ""}" data-id="${i.id}" style="--tc:${color(main)};--i:${Math.min(idx, 10)}">
    <div class="card-top">
      ${main ? `<span class="topic"><span class="dot"></span>${esc(main)}</span>` : ""}
      ${fresh.has(i.id) ? `<span class="tag new">NEW</span>` : ""}
      ${i.important ? `<span class="tag star">★ Important</span>` : ""}
      ${i.gs.map((g) => `<span class="tag gs">${g}</span>`).join("")}
      ${i.topics.slice(1).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
    </div>
    <h3><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a></h3>
    ${i.summary ? `<p class="summary">${esc(i.summary)}</p>` : ""}
    <div class="card-foot">
      <div class="src"><span class="src-badge">${SOURCE_SHORT[i.source] || i.source[0]}</span>
        <span>${esc(i.source)} · ${esc(i.section)}${showDate ? ` · ${fmtDate(i.date, { day: "numeric", month: "short" })}` : ""}</span></div>
      <div class="actions">
        <button class="act ${isRead ? "on" : ""}" data-act="read" title="Mark as read">${I.check}<span class="lbl">${isRead ? "Read" : "Mark read"}</span></button>
        <button class="act ${isSaved ? "on" : ""}" data-act="save" title="Add to revision list">${I.bookmark}<span class="lbl">${isSaved ? "Saved" : "Revise"}</span></button>
        <a class="act" href="${esc(i.link)}" target="_blank" rel="noopener" title="Open full article">${I.external}</a>
      </div>
    </div>
  </article>`;
}

function emptyState(base) {
  if (!data.items.length) return ["📰", "No news yet", "Tap <b>Refresh</b> to fetch today's current affairs."];
  if (state.query) return ["🔍", "No matches", `Nothing found for “${esc(state.query)}”. Try a shorter keyword.`];
  if (state.view === "saved" && !base.length) return ["🔖", "Your revision list is empty", "Tap <b>Revise</b> on any story to save it here for later."];
  if (state.view === "today" && !base.length) return ["☀️", "Nothing for today yet", "Newspapers publish through the day. Tap <b>Refresh</b>, or revise a previous day."];
  if (state.hideRead && base.every((i) => read.has(i.id))) return ["🏆", "All read!", "You've finished everything here. Great work."];
  return ["🧭", "No stories match these filters", "Try clearing a filter."];
}

function renderNews() {
  const base = baseItems();
  const items = applyFilters(base).slice(0, 200);
  $("hero").hidden = !(state.view === "today" && !state.query);
  if (!$("hero").hidden) {
    renderHero();
    renderFocus();
  }
  renderFilters(base);

  let title;
  if (state.query) title = `Search results`;
  else if (state.view === "saved") title = "Revision list";
  else if (state.view === "today") title = "Today's current affairs";
  else title = fmtDate(state.date);
  $("viewTitle").textContent = title;
  const unread = items.filter((i) => !read.has(i.id)).length;
  $("viewMeta").textContent = `${plural(items.length, "story")} · ${unread} unread`;

  // Previous / next day arrows
  const cur = state.view === "today" ? todayIST : state.view === "date" ? state.date : null;
  if (cur && !state.query) {
    const older = [...dates].reverse().find((d) => d < cur);
    const newer = dates.find((d) => d > cur) || (cur < todayIST ? todayIST : null);
    $("dayNav").innerHTML =
      `<button class="icon-btn" data-date="${older || ""}" ${older ? "" : "disabled"} title="Previous day">${I.left}</button>
       <button class="icon-btn" data-date="${newer || ""}" ${newer ? "" : "disabled"} title="Next day">${I.right}</button>`;
  } else $("dayNav").innerHTML = "";

  if (!items.length) {
    const [emoji, head, text] = emptyState(base);
    $("cards").innerHTML = `<div class="empty"><span class="emoji">${emoji}</span><b>${head}</b>${text}</div>`;
  } else {
    $("cards").innerHTML = items.map(card).join("");
  }
}

function toggleRead(id, el) {
  const nowRead = !read.has(id);
  nowRead ? read.add(id) : read.delete(id);
  ls.set("ca-read", [...read]);
  if (nowRead) {
    activity.add(todayIST);
    ls.set("ca-activity", [...activity]);
  }
  const cardEl = el.closest(".card");
  cardEl.classList.toggle("is-read", nowRead);
  el.classList.toggle("on", nowRead);
  el.querySelector(".lbl").textContent = nowRead ? "Read" : "Mark read";
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
  if (nowRead && state.hideRead) {
    cardEl.classList.add("leaving");
    setTimeout(() => renderNews(), 350);
  }
  if (!$("hero").hidden) renderHero();
  renderNav();
  renderCalendar($("calendar"));

  const today = byDate[todayIST] || [];
  const item = data.items.find((i) => i.id === id);
  if (nowRead && item?.date === todayIST && today.length && today.every((i) => read.has(i.id))) {
    confetti();
    toast("🏆 You've read all of today's current affairs! Brilliant work.", "success", 6000);
  }
}

function toggleSave(id, el) {
  const nowSaved = !saved.has(id);
  nowSaved ? saved.add(id) : saved.delete(id);
  ls.set("ca-saved", [...saved]);
  el.classList.toggle("on", nowSaved);
  el.querySelector(".lbl").textContent = nowSaved ? "Saved" : "Revise";
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
  if (!nowSaved && state.view === "saved") {
    el.closest(".card").classList.add("leaving");
    setTimeout(() => renderNews(), 350);
  }
  renderNav();
}

// ================= Archive =================
function renderArchive() {
  renderCalendar($("calendarBig"));
  const list = [...dates].reverse();
  $("dayList").innerHTML = list.length ? list.map((d, idx) => {
    const items = byDate[d];
    const done = items.filter((i) => read.has(i.id)).length;
    const top = [...items].sort((a, b) => b.score - a.score).slice(0, 3);
    return `<button class="day-card" data-date="${d}" style="--i:${Math.min(idx, 10)}">
      <div class="day-date"><small>${fmtDate(d, { month: "short" })}</small><b>${Number(d.slice(8))}</b><small>${fmtDate(d, { weekday: "short" })}</small></div>
      <div class="day-info">
        <strong>${d === todayIST ? "Today · " : ""}${plural(items.length, "story")} · ${done} read</strong>
        <ul>${top.map((i) => `<li>${esc(i.title)}</li>`).join("")}</ul>
        <div class="progress"><div style="width:${(done / items.length) * 100}%"></div></div>
      </div></button>`;
  }).join("") : `<div class="empty"><span class="emoji">🗂️</span><b>No archive yet</b>Days appear here as news is fetched.</div>`;
}

// ================= Break Zone (2048) =================
function gameStatus() {
  const start = ls.get("ca-game-start", null);
  if (!start) return { state: "ready" };
  const elapsed = Date.now() - start;
  if (elapsed < 0) return { state: "ready" };
  if (elapsed < GAME_MS) return { state: "playing", left: GAME_MS - elapsed, start };
  if (elapsed < GAME_MS + COOLDOWN_MS) return { state: "cooldown", left: GAME_MS + COOLDOWN_MS - elapsed };
  return { state: "ready" };
}

const G = { grid: [], tiles: [], score: 0, best: ls.get("ca-2048-best", 0), over: false, nextId: 1, session: null };
let lastGameState = gameStatus().state;
let justEnded = false;

function renderGame() {
  const g = gameStatus();
  const playing = g.state === "playing";
  $("gamePlay").hidden = !playing;
  $("gameGate").hidden = playing;
  if (playing) {
    if (G.session !== g.start) {
      G.session = g.start;
      newGame();
    }
    tickGameUI(g);
    return;
  }
  const unread = (byDate[todayIST] || []).filter((i) => !read.has(i.id)).length;
  if (g.state === "ready") {
    $("gameGate").innerHTML = `
      <span class="gate-emoji">🎮</span>
      <h3>Your break is ready</h3>
      <p>Play <b>2048</b> for ${GAME_MINUTES} minutes to refresh your mind. The timer can't be paused, and the next break unlocks ${GAME_COOLDOWN_HOURS} hours after this one ends.</p>
      <button class="btn primary big" id="startBreak">${I.play} Start my ${GAME_MINUTES}-minute break</button>
      <div class="rules"><span>⏱ ${GAME_MINUTES} min per break</span><span>🔒 ${GAME_COOLDOWN_HOURS} h cooldown</span><span>📚 Study comes first</span></div>`;
  } else {
    $("gameGate").innerHTML = `
      <span class="gate-emoji">${justEnded ? "⏰" : "📚"}</span>
      <h3>${justEnded ? "Time's up! Break over." : "Break Zone is locked"}</h3>
      <p>${justEnded ? "Great break. Now back to the books, your future self will thank you." : "Focus now. Your next break unlocks in:"}</p>
      <div class="countdown" id="gateCountdown">${fmtDur(g.left)}</div>
      <div class="bar"><div id="gateBar" style="width:${(1 - g.left / COOLDOWN_MS) * 100}%"></div></div>
      ${unread ? `<button class="btn primary" data-nav="today">📰 Read today's ${plural(unread, "unread story")}</button>`
        : `<button class="btn ghost" data-nav="saved">🔖 Revise your saved stories</button>`}`;
  }
}

function tickGameUI(g) {
  if (g.state === "playing") {
    $("gameLeft").textContent = fmtDur(g.left);
    $("gameBar").style.width = `${(g.left / GAME_MS) * 100}%`;
    $("gameLeft").closest(".game-timer").classList.toggle("warn", g.left < 60e3);
  } else if (g.state === "cooldown" && $("gateCountdown")) {
    $("gateCountdown").textContent = fmtDur(g.left);
    $("gateBar").style.width = `${(1 - g.left / COOLDOWN_MS) * 100}%`;
  }
}

function tickGame() {
  const g = gameStatus();
  if (g.state !== lastGameState) {
    if (lastGameState === "playing") {
      justEnded = true;
      G.over = true;
      toast("⏰ Break over! Back to study, you've got this. 💪", "info", 7000);
    }
    if (g.state === "ready") {
      justEnded = false;
      if (lastGameState === "cooldown") toast("🎮 Your next break is unlocked. Take it when you need it.", "success");
    }
    lastGameState = g.state;
    if (state.view === "game") renderGame();
  } else if (state.view === "game") tickGameUI(g);
  renderNav();
}

function startBreak() {
  if (gameStatus().state !== "ready") return;
  ls.set("ca-game-start", Date.now());
  lastGameState = "playing";
  justEnded = false;
  renderGame();
  renderNav();
}

function newGame() {
  G.grid = Array.from({ length: 4 }, () => Array(4).fill(null));
  G.tiles = [];
  G.score = 0;
  G.over = false;
  $("tiles").innerHTML = "";
  $("boardOverlay").hidden = true;
  addTile();
  addTile();
  drawBoard();
}

function addTile() {
  const empty = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!G.grid[r][c]) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const t = { id: G.nextId++, v: Math.random() < 0.9 ? 2 : 4, r, c, isNew: true };
  G.grid[r][c] = t;
  G.tiles.push(t);
}

function canMove() {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const t = G.grid[r][c];
      if (!t) return true;
      if (c < 3 && G.grid[r][c + 1]?.v === t.v) return true;
      if (r < 3 && G.grid[r + 1][c]?.v === t.v) return true;
    }
  }
  return false;
}

function move(dir) {
  if (G.over || gameStatus().state !== "playing") return;
  const [dr, dc] = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
  const idx = [0, 1, 2, 3];
  const rows = dr === 1 ? [...idx].reverse() : idx;
  const cols = dc === 1 ? [...idx].reverse() : idx;
  G.tiles.forEach((t) => (t.merged = t.isNew = false));
  let moved = false;

  for (const r of rows) {
    for (const c of cols) {
      const t = G.grid[r][c];
      if (!t) continue;
      let nr = r, nc = c, target = null;
      for (;;) {
        const tr = nr + dr, tc = nc + dc;
        if (tr < 0 || tr > 3 || tc < 0 || tc > 3) break;
        const o = G.grid[tr][tc];
        if (!o) {
          nr = tr;
          nc = tc;
          continue;
        }
        if (o.v === t.v && !o.merged) target = o;
        break;
      }
      if (target) {
        G.grid[r][c] = null;
        Object.assign(t, { r: target.r, c: target.c, dead: true });
        target.v *= 2;
        target.merged = true;
        G.score += target.v;
        moved = true;
      } else if (nr !== r || nc !== c) {
        G.grid[r][c] = null;
        G.grid[nr][nc] = t;
        Object.assign(t, { r: nr, c: nc });
        moved = true;
      }
    }
  }
  if (!moved) return;
  addTile();
  if (G.score > G.best) {
    G.best = G.score;
    ls.set("ca-2048-best", G.best);
  }
  drawBoard();
  if (!canMove()) {
    G.over = true;
    setTimeout(() => {
      $("boardOverlay").innerHTML = `<h3>No more moves</h3><p>Score: ${G.score}</p><button class="btn primary" id="retryBtn">Try again</button>`;
      $("boardOverlay").hidden = false;
    }, 400);
  }
}

function drawBoard() {
  const layer = $("tiles");
  for (const t of G.tiles) {
    let el = layer.querySelector(`[data-id="${t.id}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "tile";
      el.dataset.id = t.id;
      el.innerHTML = '<div class="tile-inner"></div>';
      layer.append(el);
    }
    el.style.setProperty("--r", t.r);
    el.style.setProperty("--c", t.c);
    const inner = el.firstChild;
    const paint = () => {
      inner.textContent = t.v;
      el.dataset.v = t.v > 2048 ? "big" : t.v;
    };
    if (t.isNew) {
      paint();
      inner.className = "tile-inner appear";
    } else if (t.merged) {
      setTimeout(() => {
        paint();
        inner.className = "tile-inner";
        void inner.offsetWidth;
        inner.className = "tile-inner pop";
      }, 110);
    } else paint();
    if (t.dead) {
      el.style.zIndex = 1;
      setTimeout(() => el.remove(), 120);
    }
  }
  G.tiles = G.tiles.filter((t) => !t.dead);
  $("score").textContent = G.score;
  $("best").textContent = G.best;
}

$("cells").innerHTML = "<div></div>".repeat(16);
$("newGameBtn").addEventListener("click", newGame);

let touch = null;
$("board").addEventListener("touchstart", (e) => (touch = e.touches[0]), { passive: true });
$("board").addEventListener("touchend", (e) => {
  if (!touch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.clientX;
  const dy = t.clientY - touch.clientY;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
});

// ================= Refresh =================
async function refreshNews() {
  if (location.protocol === "file:") {
    toast("Refresh needs the local server. Open the page with <code>start.bat</code> (it opens localhost:3000).", "error", 8000);
    return;
  }
  const btn = $("refreshBtn");
  btn.disabled = true;
  btn.classList.add("spin");
  btn.querySelector(".label").textContent = "Fetching…";
  try {
    let out;
    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
      // Local server (start.bat): fetch fresh news right now.
      const res = await fetch("api/refresh", { method: "POST" });
      out = await res.json();
      if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
    } else {
      // Hosted site (GitHub Pages): news is fetched hourly by GitHub Actions; load the latest copy.
      const res = await fetch(`data/news.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      out = { data: await res.json(), failed: [] };
    }
    const before = new Set(data.items.map((i) => i.id));
    data.items = out.data.items;
    data.updated = out.data.updated;
    fresh = new Set(data.items.filter((i) => !before.has(i.id)).map((i) => i.id));
    todayIST = istNow();
    reindex();
    const todayNew = data.items.filter((i) => fresh.has(i.id) && i.date === todayIST).length;
    toast(fresh.size
      ? `✨ ${plural(fresh.size, "new story")} added${todayNew ? ` (${todayNew} for today)` : ""}. Look for the <b>NEW</b> tag.`
      : "✅ You're up to date. No new stories since the last refresh.", "success");
    if (out.failed?.length) toast(`Couldn't reach: ${out.failed.map(esc).join(", ")}`, "error");
    render();
  } catch (e) {
    const local = ["localhost", "127.0.0.1"].includes(location.hostname);
    toast(`Couldn't refresh: ${esc(e.message)}. Check your internet connection${local ? ", and keep the start.bat window open" : ""}.`, "error", 7000);
  } finally {
    btn.disabled = false;
    btn.classList.remove("spin");
    btn.querySelector(".label").textContent = "Refresh";
  }
}

// ================= Render & events =================
function render() {
  const news = !["archive", "game"].includes(state.view) || !!state.query;
  $("view-news").hidden = !news;
  $("view-archive").hidden = !(state.view === "archive" && !state.query);
  $("view-game").hidden = !(state.view === "game" && !state.query);
  if (news) renderNews();
  else if (state.view === "archive") renderArchive();
  else renderGame();
  renderNav();
  renderCalendar($("calendar"));
  document.querySelectorAll("[data-updated]").forEach((el) =>
    (el.textContent = data.updated ? "Updated " + new Date(data.updated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""));
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.nav) setView(d.nav);
  else if (d.date) setView("date", { date: d.date });
  else if (d.cal) shiftMonth(Number(d.cal));
  else if ("gs" in d) (state.gs = d.gs || null), renderNews();
  else if ("topic" in d) (state.topic = state.topic === d.topic ? null : d.topic), renderNews();
  else if (d.act === "read") toggleRead(t.closest(".card").dataset.id, t);
  else if (d.act === "save") toggleSave(t.closest(".card").dataset.id, t);
  else if ("themeToggle" in d) {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    ls.set("ca-theme", next);
    renderTheme();
  } else if (t.id === "importantOnly") (state.importantOnly = !state.importantOnly), renderNews();
  else if (t.id === "hideRead") (state.hideRead = !state.hideRead), renderNews();
  else if (t.id === "refreshBtn") refreshNews();
  else if (t.id === "startBreak") startBreak();
  else if (t.id === "retryBtn") newGame();
});

$("search").addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

document.addEventListener("keydown", (e) => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key === "/" && !typing) {
    e.preventDefault();
    if (["archive", "game"].includes(state.view)) setView("today");
    $("search").focus();
    return;
  }
  if (e.key === "Escape" && typing) {
    $("search").value = "";
    state.query = "";
    document.activeElement.blur();
    render();
    return;
  }
  if (state.view === "game" && !typing) {
    const dir = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" }[e.key];
    if (dir && gameStatus().state === "playing") {
      e.preventDefault();
      move(dir);
    }
  }
});

setInterval(() => {
  const now = istNow();
  if (now !== todayIST) {
    todayIST = now;
    render();
  }
  tickFocus();
  tickGame();
}, 1000);

document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = I[el.dataset.icon]));
reindex();
renderTheme();
render();
