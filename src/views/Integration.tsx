import { useState } from "react";
import { Icon, Btn, SectionTitle, Mono } from "../components/ui";

/* ---------------- code blocks ---------------- */
function CodeBlock({ file, code, note }: { file: string; code: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="rounded-xl overflow-hidden border border-pine-800 bg-pine-900 shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-2 bg-pine-950/70 border-b border-white/8">
        <span className="font-mono text-[10.5px] font-bold text-moss-200 flex items-center gap-1.5"><Icon name="file" size={11} /> {file}</span>
        <button onClick={copy}
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold rounded-md px-2.5 py-1 transition-all cursor-pointer ${copied ? "bg-moss-500 text-pine-950" : "bg-white/8 text-paper/70 hover:bg-white/15 hover:text-paper"}`}>
          <Icon name={copied ? "check" : "copy"} size={10} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto scroll-thin px-4 py-3.5 font-mono text-[11px] leading-relaxed text-moss-100/95">{code}</pre>
      {note && <div className="px-4 py-2 border-t border-white/8 text-[10.5px] text-paper/45 flex items-center gap-1.5"><Icon name="alert" size={10} className="text-hono-400" /> {note}</div>}
    </div>
  );
}

function Section({ id, n, title, sub, children }: { id: string; n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 bg-card border border-ink-900/8 rounded-xl p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-3.5">
        <span className="w-8 h-8 shrink-0 rounded-lg bg-pine-900 text-hono-300 font-display font-extrabold text-sm grid place-items-center">{n}</span>
        <div>
          <h3 className="font-display font-extrabold text-[17px] text-ink-900 leading-tight">{title}</h3>
          <p className="text-xs text-ink-400 mt-0.5">{sub}</p>
        </div>
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

/* ---------------- snippets (production Apps Script) ---------------- */
const S_CFG = `/** Code.gs — the ONLY place IDs and scopes live (PRD 8.6) */
const CFG = {
  SHEET_ID:   "1AbCdEfG…your-spreadsheet-id…",
  TIMEZONE:   "Asia/Jakarta",
  DRIVE_ROOT: "ATS",
};

const TABS = ["Config","Users","Clients","SourcingResources","Requisitions",
  "RequisitionPhaseConfigs","Candidates","Applications","QuestionnaireDefinitions",
  "QuestionnaireResponses","InterviewSlots","Interviews","InterviewEvaluations",
  "Documents","Reports","AuditLog","RetentionLog","CandidateAccessTokens"];

function setup() {
  const ss = SpreadsheetApp.openById(CFG.SHEET_ID);
  TABS.forEach(function (name) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const prot = sh.protect();              // PRD 4: only the web app writes
    prot.removeEditors(prot.getEditors());
    prot.addEditor(Session.getActiveUser().getEmail());
  });
}`;

const S_HELPERS = `const getId = function (p) {
  return p + "-" + Utilities.getUuid().slice(0, 8).toUpperCase();
};

const withLock = function (fn) {            // PRD: LockService on every write
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
};

function readSheet(name) {
  const v = SpreadsheetApp.openById(CFG.SHEET_ID)
              .getSheetByName(name).getDataRange().getValues();
  const head = v[0], rows = v.slice(1);
  return rows.map(function (r) {
    const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
}
function appendRow(name, obj) { /* ordered values from headers, inside withLock */ }
function updateRow(name, id, obj) { /* locate row by ID column, write changed cells */ }
function findRows(name, crit) { /* filter readSheet(name) by criteria object */ }
function getConfig(k) { const r = findRows("Config", { Key: k })[0]; return r && r.Value; }
function setConfig(k, v) { /* upsert + UpdatedBy / UpdatedAt */ }

function logAudit(e) {
  const u = me();
  appendRow("AuditLog", Object.assign({ ID: getId("AUD"), Timestamp: new Date(),
    UserID: u.ID, Role: u.Role }, e));
}`;

const S_AUTH = `function me() {                             // Google sign-in -> Users sheet (PRD 2)
  const email = Session.getActiveUser().getEmail();
  const u = findRows("Users", { Email: email, Active: true })[0];
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}
function requireRole(roles) {
  const u = me();
  if (roles.indexOf(u.Role) < 0) throw new Error("FORBIDDEN");
  return u;   // every query then filters by u.ClientID — tenant isolation (PRD 8.3)
}
function verifyCandidateToken(token) {      // candidate portal, no Google sign-in (PRD 3.1)
  const t = findRows("CandidateAccessTokens", { Token: token })[0];
  if (!t || new Date(t.ExpiresAt) < new Date()) throw new Error("UNAUTHORIZED");
  appendRow("CandidateAccessTokens", Object.assign({}, t, { LastUsedAt: new Date() }));
  return t;
}`;

const S_ROUTER = `function doGet(e) {
  if (e.parameter.action) return api(e);              // JSON endpoints
  return HtmlService.createTemplateFromFile("app")     // singlefile build (step 6)
    .evaluate().setTitle("Tapak ATS")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e) { return api(e); }

const Router = {
  snapshot:        function ()  { requireRole(["CONSULTANT","CLIENT_MASTER","CLIENT_HIRING"]); /* tenant-scoped read */ },
  addCandidate:    function (p) { requireRole(["CONSULTANT"]); return withLock(function () { /* dup-check, append, logAudit */ }); },
  advancePhase:    function (p) { requireRole(["CONSULTANT"]); return withLock(function () { /* validate PHASE_STATUSES, logAudit */ }); },
  reserveSlot:     function (p) { verifyCandidateToken(p.token); return withLock(function () { /* re-check capacity, UsedCount++ */ }); },
  candidateStatus: function (p) { const t = verifyCandidateToken(p.token); /* sanitized view only (PRD 8.4) */ },
  // one endpoint per action in src/lib/store.tsx — the demo already defines the contract
};

function api(e) {
  try {
    const body = e.postData ? JSON.parse(e.postData.contents) : e.parameter;
    const out = Router[body.action](body);
    return ContentService.createTextOutput(JSON.stringify(out))
             .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "UNVERIFIED" }))
             .setMimeType(ContentService.MimeType.JSON);   // generic on purpose (PRD 8.4)
  }
}`;

const S_DRIVE = `function drivePath(parts) {                 // get-or-create ATS/Clients/{id}/… (PRD 8.5)
  let folder = DriveApp.getFoldersByName(CFG.DRIVE_ROOT).hasNext()
    ? DriveApp.getFoldersByName(CFG.DRIVE_ROOT).next()
    : DriveApp.createFolder(CFG.DRIVE_ROOT);
  parts.forEach(function (name) {
    folder = folder.getFoldersByName(name).hasNext()
      ? folder.getFoldersByName(name).next() : folder.createFolder(name);
  });
  return folder;
}

function storeCV(clientId, reqId, candidateId, base64, mime) {
  if (mime !== "application/pdf") throw new Error("Only PDF allowed");
  if (Utilities.base64Decode(base64).length > 5 * 1024 * 1024) throw new Error("Max 5 MB");
  const name = candidateId + "_CV_" +
    Utilities.formatDate(new Date(), CFG.TIMEZONE, "yyyyMMdd_HHmmss") + ".pdf";
  const file = drivePath(["Clients", clientId, "Requisitions", reqId, "CVs"])
                 .createFile(name, mime, base64);
  logAudit({ Action: "CV_UPLOADED", ObjectType: "Document", ObjectID: file.getId() });
  return file.getId();                      // never a public URL — served via endpoint
}`;

const S_MEET = `function createMeetEvent(slot, candidate) { // enable "Calendar API" in Services (+)
  try {
    const ev = Calendar.Events.insert(Session.getActiveUser().getEmail(), {
      summary: "Screening — " + candidate.FullName,
      start: { dateTime: slot.start, timeZone: CFG.TIMEZONE },
      end:   { dateTime: slot.end,   timeZone: CFG.TIMEZONE },
      conferenceData: { createRequest: { requestId: getId("MEET"),
        conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }, { conferenceDataVersion: 1 });
    return ev.hangoutLink;
  } catch (err) {
    return null;                            // PRD 5: consultant pastes a link manually
  }
}`;

const S_TRIGGERS = `function installTriggers() {
  ScriptApp.newTrigger("nightlyJobs").timeBased()
    .everyDays(1).atHour(2).inTimezone(CFG.TIMEZONE).create();
}

function nightlyJobs() {                    // chunks 1, 3, 7 — all writes locked + audited as SYSTEM
  withLock(function () {
    autoNoResponse_120h();                  // invited & silent -> NO_RESPONSE
    autoCancelHolds_30d();                  // ON_HOLD > 30d -> CANCELLED
    retentionPurge();                       // 48h / 120h rules -> delete + RetentionLog
  });
}`;

const S_SCOPES = `{
  "timeZone": "Asia/Jakarta",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email"
  ],
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE" }
}`;

const S_SEAM = `// src/lib/store.tsx — swap the transport, keep every action signature intact
const API = "https://script.google.com/macros/s/AKfy…/exec";

const api = function (action: string, payload: object = {}) {
  return fetch(API, {
    method: "POST",
    // text/plain avoids a CORS preflight against Apps Script
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  }).then(function (r) { return r.json(); });
};

// before: localStorage.setItem(LS_KEY, JSON.stringify(db))
// after:  each mutation calls its endpoint —
//           advancePhase -> api("advancePhase", { appId, to, reason })
//         reads hydrate once on load:
//           const db = await api("snapshot")   // server applies tenant scoping`;

/* ---------------- checklist ---------------- */
const CHECKS = [
  "Spreadsheet “Tapak ATS Database” created — ID pasted into CFG.SHEET_ID",
  "setup() ran once — 18 tabs created, editors removed (web-app-only writes)",
  "Users tab contains your Google email with Role = CONSULTANT",
  "Drive root folder “ATS” exists (client/requisition subfolders auto-create)",
  "Calendar API advanced service enabled (Meet links; manual fallback works without it)",
  "installTriggers() ran — nightly NO_RESPONSE / auto-cancel / retention sweep armed",
  "OAuth scopes authorized on first deployment run",
  "Frontend wired: singlefile build pasted into app.html, or API constant set in store.tsx",
  "Smoke test: one UI action produced a row in the AuditLog tab",
];

/* ---------------- view ---------------- */
export function Integration() {
  const [host, setHost] = useState<"script" | "pages">("script");
  const [done, setDone] = useState<boolean[]>(CHECKS.map(() => false));
  const pct = Math.round((done.filter(Boolean).length / CHECKS.length) * 100);

  const steps = [
    { id: "s1", n: 1, label: "Google home" },
    { id: "s2", n: 2, label: "Sheets backend" },
    { id: "s3", n: 3, label: "Drive & CVs" },
    { id: "s4", n: 4, label: "Meet & Calendar" },
    { id: "s5", n: 5, label: "Triggers & scopes" },
    { id: "s6", n: 6, label: "Wire the frontend" },
    { id: "s7", n: 7, label: "Deploy & go live" },
  ];
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="anim-rise">
      <SectionTitle icon="cloud" title="Google Integration"
        sub="Take this working demo onto the real stack from PRD §3 — Sheets as database, Drive for CVs, Calendar for Meet, Apps Script as the authenticated backend" />

      {/* architecture + hosting toggle */}
      <div className="bg-pine-900 text-paper rounded-xl p-5 mb-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-paper/40 mb-3">Production topology — PRD §3</div>
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="flex-1 min-w-[190px] rounded-lg bg-white/6 border border-white/10 px-3.5 py-3">
            <div className="font-display font-extrabold text-hono-300 text-sm">Tapak UI</div>
            <div className="text-[10.5px] text-paper/55 mt-0.5">This React build — served by Apps Script (recommended) or GitHub Pages</div>
          </div>
          <div className="grid place-items-center text-hono-400 px-1"><Icon name="arrowR" size={18} /></div>
          <div className="flex-1 min-w-[210px] rounded-lg bg-hono-400/15 border border-hono-400/30 px-3.5 py-3">
            <div className="font-display font-extrabold text-hono-300 text-sm">Apps Script Web App</div>
            <div className="text-[10.5px] text-paper/55 mt-0.5">Google sign-in · RBAC from Users · tenant scoping · LockService · audit</div>
          </div>
          <div className="grid place-items-center text-hono-400 px-1"><Icon name="arrowR" size={18} /></div>
          <div className="flex-1 min-w-[230px] grid grid-cols-3 gap-2">
            {[["db", "Sheets", "18 protected tabs"], ["file", "Drive", "private CV folders"], ["video", "Calendar", "Meet links & slots"]].map(([ic, t, s]) => (
              <div key={t} className="rounded-lg bg-white/6 border border-white/10 px-2.5 py-3 text-center">
                <Icon name={ic} size={15} className="mx-auto text-moss-300" />
                <div className="text-[11px] font-bold mt-1">{t}</div>
                <div className="text-[9px] text-paper/45 leading-tight mt-0.5">{s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-paper/40">Hosting shape</span>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-pine-950/60 p-1">
            {([["script", "Serve from Apps Script · recommended"], ["pages", "GitHub Pages + API"]] as ["script" | "pages", string][]).map(([v, l]) => (
              <button key={v} onClick={() => setHost(v)}
                className={`text-[10.5px] font-bold rounded-md px-3 py-1.5 transition-all cursor-pointer ${host === v ? "bg-hono-400 text-pine-950 shadow" : "text-paper/60 hover:text-paper hover:bg-white/6"}`}>{l}</button>
            ))}
          </div>
          <span className="text-[10px] text-paper/40">{host === "script" ? "One deployment serves UI + API — no CORS, Google session auth works out of the box." : "Keep the Pages deploy; Apps Script becomes a pure JSON API behind the same Router."}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[190px_1fr] gap-4 items-start">
        {/* rail */}
        <nav className="hidden lg:block sticky top-[70px] space-y-1">
          {steps.map((s) => (
            <button key={s.id} onClick={() => jump(s.id)}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[11.5px] font-semibold text-ink-500 hover:text-moss-800 hover:bg-moss-100 transition-colors cursor-pointer">
              <span className="w-5 h-5 rounded-md bg-ink-900/6 text-ink-400 text-[9.5px] font-bold grid place-items-center shrink-0">{s.n}</span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* steps */}
        <div className="space-y-4 min-w-0">
          <Section id="s1" n={1} title="Create the Google home" sub="Three artifacts, five minutes — the script project is where the sheet ID lives, not in this UI">
            <ol className="text-xs text-ink-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li><b className="text-ink-900">Spreadsheet</b> — sheets.new, name it “Tapak ATS Database”. Copy its ID from the URL: <Mono>docs.google.com/spreadsheets/d/<b className="text-moss-700">THIS_PART</b>/edit</Mono></li>
              <li><b className="text-ink-900">Script project</b> — inside the spreadsheet: <span className="font-semibold">Extensions → Apps Script</span>. That binding is what lets the script open the sheet with its own credentials.</li>
              <li><b className="text-ink-900">Drive root</b> — create a folder named <Mono>ATS</Mono> in the consultant account's Drive. Client/requisition/CV subfolders are created on demand by the code in step 3.</li>
            </ol>
          </Section>

          <Section id="s2" n={2} title="Sheets as the database" sub="Code.gs implements PRD Chunk 0: protected tabs, ID + sheet helpers, LockService, and the append-only audit logger">
            <CodeBlock file="Code.gs — config & setup" code={S_CFG} note="Run setup() once from the editor. Protection means humans can read tabs but only the web app writes." />
            <CodeBlock file="Code.gs — helpers & audit" code={S_HELPERS} />
            <CodeBlock file="Code.gs — auth & RBAC" code={S_AUTH} note="Role is always resolved server-side from the Users sheet — never trusted from the browser (PRD 8.2)." />
            <CodeBlock file="Code.gs — web app router" code={S_ROUTER} note="The Router keys map 1:1 to the actions already defined in src/lib/store.tsx — the demo is the API contract." />
          </Section>

          <Section id="s3" n={3} title="Drive for contracts, CVs & reports" sub="Private folders, system-generated filenames, PDF ≤ 5 MB, access only through the web app (PRD §8.5)">
            <div className="rounded-lg bg-paper border border-ink-900/8 px-3.5 py-3 font-mono text-[10.5px] text-ink-500 leading-relaxed">
              ATS/<br />├─ Clients/<b className="text-moss-700">{'{ClientID}'}</b>/Contracts/&nbsp;&nbsp;← signed contracts<br />
              └─ Clients/<b className="text-moss-700">{'{ClientID}'}</b>/Requisitions/<b className="text-moss-700">{'{ReqID}'}</b>/CVs/&nbsp;&nbsp;← {'{CandidateID}'}_CV_{'{yyyyMMdd_HHmmss}'}.pdf
            </div>
            <CodeBlock file="Code.gs — Drive storage" code={S_DRIVE} />
          </Section>

          <Section id="s4" n={4} title="Google Meet & Calendar" sub="Slots become calendar events with conference data; the meet link lands back in InterviewSlots (PRD Chunk 5)">
            <CodeBlock file="Code.gs — Meet via Calendar API" code={S_MEET} note="Add the Calendar API under Services (+) in the editor. If creation fails, the consultant pastes a meet link manually — the UI already supports that fallback." />
            <p className="text-[11px] text-ink-500 leading-relaxed flex items-start gap-1.5"><Icon name="chat" size={12} className="text-moss-600 mt-0.5 shrink-0" /> WhatsApp stays MVP-simple: the templates live in the Config tab and the UI renders pre-filled <Mono>wa.me</Mono> links — no API key needed.</p>
          </Section>

          <Section id="s5" n={5} title="Time-driven triggers & scopes" sub="The nightly sweep this demo simulates manually — plus the exact OAuth scopes to declare">
            <CodeBlock file="Code.gs — installable trigger" code={S_TRIGGERS} />
            <CodeBlock file="appsscript.json — manifest" code={S_SCOPES} note="Execute as USER_DEPLOYING + access ANYONE matches PRD §3.2; candidate pages stay public while every endpoint re-checks tokens." />
          </Section>

          <Section id="s6" n={6} title="Wire this frontend to the backend" sub="One seam: src/lib/store.tsx. Every view, rule and audit path keeps working — only the transport changes">
            <CodeBlock file="src/lib/store.tsx — transport swap" code={S_SEAM} />
            {host === "script" ? (
              <div className="rounded-lg border border-moss-300 bg-moss-50 px-3.5 py-3 text-[11.5px] text-moss-800 leading-relaxed">
                <b>Serving from Apps Script:</b> install <Mono>vite-plugin-singlefile</Mono>, run <Mono>npm run build</Mono>, then paste the contents of <Mono>dist/index.html</Mono> into an HTML file named <Mono>app.html</Mono> in the script project. One deployment serves UI and API together — Google session auth and <Mono>Session.getActiveUser()</Mono> just work, and there is no CORS at all.
              </div>
            ) : (
              <div className="rounded-lg border border-hono-400/50 bg-hono-100 px-3.5 py-3 text-[11.5px] text-hono-800 leading-relaxed">
                <b>Staying on GitHub Pages:</b> keep the current Pages deployment and set the <Mono>API</Mono> constant to your <Mono>/exec</Mono> URL. Send POST bodies as <Mono>text/plain</Mono> (avoids CORS preflight against Apps Script). Note: third-party cookie blocking can affect <Mono>Session.getActiveUser()</Mono> cross-site — for consultant/client pages, token-based sessions or the Apps-Script-hosted shape are more robust.
              </div>
            )}
          </Section>

          <Section id="s7" n={7} title="Deploy & go live" sub="Publish the web app, then tick the checklist — it mirrors the PRD Definition of Done">
            <ol className="text-xs text-ink-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>In the script editor: <b className="text-ink-900">Deploy → New deployment → Web app</b> · Execute as <b>Me</b> · Access <b>Anyone</b> → Authorize (this is where the scopes get granted).</li>
              <li>Run <Mono>setup()</Mono> and <Mono>installTriggers()</Mono> once from the editor's run menu.</li>
              <li>Open the <Mono>/exec</Mono> URL signed in as the consultant account — the app loads and reads from the spreadsheet.</li>
              <li className="text-ink-400">Every later code change needs <b className="text-ink-600">Deploy → Manage deployments → new version</b>; old versions stay rollback-able.</li>
            </ol>

            <div className="rounded-xl border border-ink-900/10 bg-paper p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-display font-bold text-sm text-ink-900">Go-live checklist</span>
                <span className={`font-mono text-[11px] font-bold tabular-nums ${pct === 100 ? "text-moss-600" : "text-ink-400"}`}>{done.filter(Boolean).length}/{CHECKS.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-900/8 overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-moss-500" : "bg-hono-400"}`} style={{ width: pct + "%" }} />
              </div>
              <div className="space-y-1">
                {CHECKS.map((c, i) => (
                  <label key={i} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors ${done[i] ? "bg-moss-50 text-moss-800" : "hover:bg-ink-900/4 text-ink-600"}`}>
                    <input type="checkbox" checked={done[i]} onChange={() => setDone((d) => d.map((x, j) => (j === i ? !x : x)))} className="mt-0.5 accent-[#17573c] cursor-pointer" />
                    <span className={done[i] ? "line-through opacity-70" : ""}>{c}</span>
                  </label>
                ))}
              </div>
              {pct === 100 && (
                <div className="mt-3 rounded-lg bg-pine-900 text-moss-100 px-3.5 py-2.5 text-[11.5px] flex items-center gap-2 anim-rise">
                  <Icon name="check" size={14} className="text-hono-400" /> Ready. The demo's business rules, audit trail and role model carry over unchanged — Sheets is now the source of truth.
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
