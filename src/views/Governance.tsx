import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { PHASES, hoursSince, fmtDT, WA_PLACEHOLDERS } from "../lib/data";
import { Icon, Btn, ReasonModal, Modal, Field, inputCls, Empty, SectionTitle, Mono, StackedBar } from "../components/ui";

type Tab = "audit" | "retention" | "automation" | "templates";

export function Governance() {
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>("audit");
  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "audit", label: "Audit Log", icon: "list" },
    { id: "retention", label: "Retention & Deletion", icon: "trash" },
    { id: "automation", label: "Time-Driven Triggers", icon: "zap" },
    { id: "templates", label: "WhatsApp Templates", icon: "chat" },
  ];
  return (
    <div className="anim-rise">
      <SectionTitle icon="shield" title="Audit & Retention" sub="Append-only trail · data minimization · every sensitive access leaves a mark"
        right={<span className="text-[11px] text-ink-400 font-mono">{db.audit.length} audit entries · {db.retentionLog.length} deletions logged</span>} />
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer border ${tab === t.id ? "bg-pine-900 text-hono-300 border-pine-900 shadow" : "bg-card text-ink-500 border-ink-900/10 hover:border-moss-400 hover:text-moss-700"}`}>
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "audit" && <AuditTab />}
      {tab === "retention" && <RetentionTab />}
      {tab === "automation" && <AutomationTab />}
      {tab === "templates" && <TemplatesTab />}
    </div>
  );
}

/* ---------------- audit ---------------- */
function AuditTab() {
  const { db, toast } = useStore();
  const [q, setQ] = useState("");
  const [fAction, setFAction] = useState("");
  const actions = useMemo(() => [...new Set(db.audit.map((a) => a.action))].sort(), [db.audit]);
  const rows = db.audit.filter((a) => {
    if (fAction && a.action !== fAction) return false;
    if (q && !`${a.userName} ${a.objectId} ${a.action} ${a.prev || ""} ${a.next || ""} ${a.reason || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const exportCsv = () => {
    const head = ["Timestamp", "User", "Role", "Action", "Object", "ID", "Previous", "New", "Reason"];
    const body = rows.map((a) => [a.ts, a.userName, a.role, a.action, a.objectType, a.objectId, a.prev || "", a.next || "", a.reason || ""].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = "tapak-audit-log.csv"; el.click();
    URL.revokeObjectURL(url);
    toast("Audit log exported (event itself is audited in production)", "info");
  };
  return (
    <div className="bg-card border border-ink-900/8 rounded-xl overflow-hidden anim-rise">
      <div className="px-3.5 py-3 border-b border-ink-900/6 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input className={`${inputCls} pl-9`} placeholder="Search user, object, reason…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${inputCls} w-auto`} value={fAction} onChange={(e) => setFAction(e.target.value)}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <Btn tone="outline" size="sm" onClick={exportCsv}><Icon name="download" size={12} /> Export CSV</Btn>
      </div>
      <div className="divide-y divide-ink-900/4 max-h-[62vh] overflow-y-auto scroll-thin">
        {rows.map((a) => (
          <div key={a.id} className="px-4 py-2.5 text-xs hover:bg-moss-50/60 transition-colors">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[9.5px] text-ink-300 tabular-nums shrink-0">{fmtDT(a.ts)}</span>
              <span className="font-mono text-[9.5px] font-bold text-moss-700 bg-moss-100 rounded px-1.5 py-0.5">{a.action}</span>
              <span className="text-ink-500">{a.objectType} <Mono>{a.objectId}</Mono></span>
              <span className="ml-auto text-[10px] text-ink-400 flex items-center gap-1"><Icon name="user" size={10} /> {a.userName} · <span className={`font-bold ${a.role === "SYSTEM" ? "text-river-600" : a.role === "CANDIDATE" ? "text-hono-600" : "text-moss-700"}`}>{a.role}</span></span>
            </div>
            {(a.prev || a.next) && (
              <div className="mt-1 text-ink-600 pl-[86px]">
                {a.prev && <span className="line-through opacity-55">{a.prev}</span>}
                {a.prev && a.next && <span className="mx-1.5 text-moss-600 font-bold">→</span>}
                {a.next && <span className="font-semibold">{a.next}</span>}
              </div>
            )}
            {a.reason && <div className="pl-[86px] text-[10.5px] italic text-ink-400 mt-0.5">Reason: “{a.reason}”</div>}
          </div>
        ))}
        {rows.length === 0 && <Empty icon="list" title="No entries match" />}
      </div>
    </div>
  );
}

/* ---------------- retention ---------------- */
function eligibility(db: ReturnType<typeof useStore>["db"]) {
  const failedH = Number(db.config.RETENTION_FAILED_HOURS || 48);
  const nrH = Number(db.config.RETENTION_NORESPONSE_HOURS || 120);
  return db.candidates.map((c) => {
    const apps = db.applications.filter((a) => a.candidateId === c.id);
    if (apps.length === 0) return null;
    const statuses = apps.map((a) => {
      const req = db.requisitions.find((r) => r.id === a.requisitionId);
      if (a.status === "FAILED" || a.status === "WITHDRAWN") {
        const reqDone = req?.status === "CLOSED" || req?.status === "CANCELLED";
        const h = hoursSince(a.statusChangedAt);
        return { a, eligible: reqDone && h > failedH, hLeft: reqDone ? Math.max(0, failedH - h) : null, note: reqDone ? null : `waiting for ${req?.id} to close/cancel` };
      }
      if (a.status === "NO_RESPONSE" || a.status === "NO_SHOW") {
        const h = hoursSince(a.statusChangedAt);
        return { a, eligible: h > nrH, hLeft: Math.max(0, nrH - h), note: null };
      }
      return { a, eligible: false, hLeft: null, note: `${a.status} — retained` };
    });
    const allEligible = statuses.every((s) => s.eligible);
    const maxLeft = Math.max(0, ...statuses.map((s) => s.hLeft || 0));
    return { c, apps, statuses, allEligible, maxLeft };
  }).filter(Boolean) as { c: (typeof db.candidates)[0]; apps: (typeof db.applications); statuses: { a: (typeof db.applications)[0]; eligible: boolean; hLeft: number | null; note: string | null }[]; allEligible: boolean; maxLeft: number }[];
}

function RetentionTab() {
  const { db, deleteCandidate } = useStore();
  const [purge, setPurge] = useState<string | null>(null);
  const rows = useMemo(() => eligibility(db), [db]);
  const eligible = rows.filter((r) => r.allEligible);
  const pending = rows.filter((r) => !r.allEligible);
  const target = rows.find((r) => r.c.id === purge);

  return (
    <div className="space-y-4 anim-rise">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-card border border-ink-900/8 rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">FAILED / WITHDRAWN</div>
          <div className="font-display font-extrabold text-2xl text-ink-900 mt-1">48h</div>
          <div className="text-[11px] text-ink-500 mt-0.5">after the linked requisition is CLOSED or CANCELLED</div>
        </div>
        <div className="bg-card border border-ink-900/8 rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">NO_RESPONSE / NO_SHOW</div>
          <div className="font-display font-extrabold text-2xl text-ink-900 mt-1">120h</div>
          <div className="text-[11px] text-ink-500 mt-0.5">after the status change timestamp</div>
        </div>
        <div className="bg-pine-900 rounded-xl p-4 text-paper">
          <div className="text-[10px] font-bold uppercase tracking-wider text-paper/50">Always retained</div>
          <div className="font-display font-extrabold text-lg text-hono-300 mt-1">HIRED · RESERVED · TALENT_POOL · ACTIVE</div>
          <div className="text-[11px] text-paper/50 mt-0.5">Deletion only when ALL applications are eligible finals</div>
        </div>
      </div>

      <div className="bg-card border border-ink-900/8 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-900/6 flex items-center justify-between">
          <h4 className="font-display font-bold text-sm text-ink-900">Eligible for deletion now</h4>
          <span className="text-[11px] font-bold text-rust-500 bg-rust-100 rounded-full px-2.5 py-0.5">{eligible.length}</span>
        </div>
        <div className="divide-y divide-ink-900/4">
          {eligible.map((r) => (
            <div key={r.c.id} className="px-4 py-3 flex items-center gap-3 flex-wrap text-xs">
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold text-ink-900 text-[13px]">{r.c.fullName} <span className="font-mono text-[9.5px] text-ink-400 font-normal">{r.c.code}</span></div>
                <div className="text-[10.5px] text-ink-400 mt-0.5">
                  {r.statuses.map((s) => `${s.a.status} @ ${PHASES[s.a.phase].name}`).join(" · ")} — cooling period elapsed
                </div>
              </div>
              <span className="text-[10px] font-mono text-ink-400">{r.c.cvFileName}</span>
              <Btn size="sm" tone="dangerSoft" onClick={() => setPurge(r.c.id)}><Icon name="trash" size={12} /> Delete & log</Btn>
            </div>
          ))}
          {eligible.length === 0 && <Empty icon="check" title="Queue empty" sub="No candidates currently past their retention period." />}
        </div>
      </div>

      <div className="bg-card border border-ink-900/8 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-900/6"><h4 className="font-display font-bold text-sm text-ink-900">Not yet eligible</h4></div>
        <div className="divide-y divide-ink-900/4">
          {pending.map((r) => (
            <div key={r.c.id} className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-xs">
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold text-ink-800">{r.c.fullName} <span className="font-mono text-[9.5px] text-ink-400 font-normal">{r.c.code}</span></div>
                <div className="text-[10.5px] text-ink-400 mt-0.5">
                  {r.statuses.map((s, i) => <span key={i}>{i > 0 && " · "}{s.a.status}{s.note ? ` (${s.note})` : s.hLeft && s.hLeft > 0 ? ` — ${Math.ceil(s.hLeft)}h left` : ""}</span>)}
                </div>
              </div>
              {!r.allEligible && r.maxLeft > 0 && <span className="text-[10px] font-bold text-hono-600 bg-hono-100 rounded-full px-2 py-0.5 tabular-nums">~{Math.ceil(r.maxLeft / 24)}d to eligibility</span>}
              <span className="text-[10px] font-bold text-moss-700 bg-moss-100 rounded-full px-2 py-0.5">retained</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-ink-900/8 rounded-xl p-4">
        <h4 className="font-display font-bold text-sm text-ink-900 mb-2.5">RetentionLog ({db.retentionLog.length})</h4>
        {db.retentionLog.length === 0 ? <Empty icon="trash" title="No deletions recorded" /> : (
          <div className="divide-y divide-ink-900/4">
            {db.retentionLog.map((l) => (
              <div key={l.id} className="py-2 text-xs flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[9.5px] text-ink-300 tabular-nums">{fmtDT(l.deletedAt)}</span>
                <b className="text-ink-800">{l.candidateCode}</b>
                <span className="text-ink-500">{l.requisitionIds.join(", ")}</span>
                <span className="font-mono text-[9.5px] text-rust-500">{l.filesDeleted.length} file(s) purged</span>
                <span className="ml-auto text-[10px] text-ink-400">{l.deletedBy}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReasonModal open={!!purge} onClose={() => setPurge(null)} title="Delete candidate data"
        sub="GDPR/PDP-style minimization — this cannot be undone"
        context={target ? [
          ["Candidate", `${target.c.fullName} · ${target.c.code}`],
          ["Deletes", `record, ${target.apps.length} application(s), questionnaire responses, CV from Drive`],
          ["Keeps", "anonymized RetentionLog entry"],
        ] : []}
        quick={["Retention period elapsed", "Candidate requested erasure"]}
        tone="danger" confirmLabel="Purge & log"
        onConfirm={(r) => purge && deleteCandidate(purge, r)} />
    </div>
  );
}

/* ---------------- automation ---------------- */
function AutomationTab() {
  const { db, runNightlyJobs, toast } = useStore();
  const [lastRun, setLastRun] = useState<{ noResponse: string[]; cancelled: string[]; deleted: string[] } | null>(null);
  const [running, setRunning] = useState(false);
  const pendingNR = db.applications.filter((a) => a.status === "ACTIVE" && a.questionnaireStatus !== "SUBMITTED" && !a.slotId && hoursSince(a.lastInteractionAt) > 120);
  const pendingHold = db.requisitions.filter((r) => r.status === "ON_HOLD" && r.holdSince && hoursSince(r.holdSince) > 720);

  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      const res = runNightlyJobs();
      setLastRun(res);
      setRunning(false);
      toast(`Nightly run: ${res.noResponse.length} NO_RESPONSE · ${res.cancelled.length} auto-cancelled · ${res.deleted.length} purged`, res.deleted.length ? "warn" : "info");
    }, 900);
  };

  return (
    <div className="space-y-4 anim-rise">
      <div className="bg-pine-900 text-paper rounded-xl p-5 flex flex-wrap items-center gap-5">
        <div className="w-11 h-11 rounded-xl bg-hono-400 text-pine-950 grid place-items-center"><Icon name="zap" size={20} /></div>
        <div className="flex-1 min-w-[240px]">
          <h4 className="font-display font-extrabold text-lg text-hono-300">Simulate the time-driven trigger</h4>
          <p className="text-xs text-paper/60 mt-0.5">In production this runs daily via Apps Script installable trigger: 120h NO_RESPONSE sweep → 30-day ON_HOLD auto-cancel → retention purge. All writes use LockService and are audited as <span className="font-mono text-moss-200">SYSTEM</span>.</p>
        </div>
        <Btn tone="amber" onClick={run} disabled={running} className="min-w-[150px]">
          <Icon name={running ? "refresh" : "zap"} size={14} className={running ? "animate-spin" : ""} /> {running ? "Running…" : "Run nightly jobs"}
        </Btn>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-card border border-ink-900/8 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400"><Icon name="clock" size={11} /> 120h no-response sweep</div>
          <div className="font-display font-extrabold text-3xl text-ink-900 mt-2">{pendingNR.length}</div>
          <div className="text-[11px] text-ink-500">candidate(s) invited but silent past 120h → will flip to NO_RESPONSE</div>
        </div>
        <div className="bg-card border border-ink-900/8 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400"><Icon name="alert" size={11} /> ON_HOLD &gt; 30 days</div>
          <div className="font-display font-extrabold text-3xl text-ink-900 mt-2">{pendingHold.length}</div>
          <div className="text-[11px] text-ink-500">requisition(s) will auto-cancel{pendingHold.map((r) => ` (${r.id})`).join("")}</div>
        </div>
        <div className="bg-card border border-ink-900/8 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400"><Icon name="trash" size={11} /> Retention purge</div>
          <div className="font-display font-extrabold text-3xl text-ink-900 mt-2">{eligibility(db).filter((r) => r.allEligible).length}</div>
          <div className="text-[11px] text-ink-500">candidate record(s) + Drive CV(s) past cooling period</div>
        </div>
      </div>

      {lastRun && (
        <div className="bg-card border border-ink-900/8 rounded-xl p-4 anim-rise">
          <h4 className="font-display font-bold text-sm text-ink-900 mb-2 flex items-center gap-2"><Icon name="check" size={14} className="text-moss-600" /> Last run report</h4>
          <div className="text-xs space-y-1.5">
            <div><b className="text-ink-700">NO_RESPONSE assigned:</b> {lastRun.noResponse.length ? lastRun.noResponse.map((x) => <Mono key={x}>{x}</Mono>) : "none"}</div>
            <div><b className="text-ink-700">Requisitions auto-cancelled:</b> {lastRun.cancelled.length ? lastRun.cancelled.map((x) => <Mono key={x}>{x}</Mono>) : "none"}</div>
            <div><b className="text-ink-700">Candidates purged:</b> {lastRun.deleted.length ? lastRun.deleted.map((x) => <Mono key={x}>{x}</Mono>) : "none"}</div>
          </div>
        </div>
      )}

      <div className="bg-card border border-ink-900/8 rounded-xl p-4">
        <h4 className="font-display font-bold text-sm text-ink-900 mb-3">Security posture (PRD §8)</h4>
        <div className="grid sm:grid-cols-2 gap-2 text-[11.5px] text-ink-600">
          {[
            ["lock", "Object-level authorization on every endpoint — role never trusted from browser"],
            ["file", "CVs in private Drive folders · served only through the Apps Script route · access audited"],
            ["shield", "Multi-tenant isolation: User → Client → Requisition → Candidate → Document"],
            ["eye", "Candidates see sanitized status only; generic OTP errors reveal nothing"],
            ["chat", "No plaintext credentials in Sheets — vault references only, access logged"],
            ["clock", "Rate limiting on candidate status-check and sign-in (simulated)"],
          ].map(([ic, txt]) => (
            <div key={txt} className="flex items-start gap-2 rounded-lg bg-paper px-3 py-2"><Icon name={ic} size={13} className="text-moss-600 mt-0.5 shrink-0" />{txt}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- templates ---------------- */
function TemplatesTab() {
  const { db, saveTemplate } = useStore();
  const [tpl, setTpl] = useState(db.config.WHATSAPP_INVITE_TEMPLATE || "");
  const [wa, setWa] = useState(db.config.CONSULTANT_WA || "");
  const dirty = tpl !== db.config.WHATSAPP_INVITE_TEMPLATE || wa !== db.config.CONSULTANT_WA;
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start anim-rise">
      <div className="bg-card border border-ink-900/8 rounded-xl p-4">
        <h4 className="font-display font-bold text-sm text-ink-900 mb-3">Invitation template <Mono>Config.WHATSAPP_INVITE_TEMPLATE</Mono></h4>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {WA_PLACEHOLDERS.map((p) => (
            <button key={p} onClick={() => setTpl((t) => t + " " + p)} className="font-mono text-[10px] px-2 py-1 rounded-md bg-river-100 text-river-800 hover:bg-river-400/30 transition-colors cursor-pointer border border-river-400/20">{p}</button>
          ))}
        </div>
        <textarea value={tpl} onChange={(e) => setTpl(e.target.value)} rows={14} className={`${inputCls} font-mono text-[11.5px] leading-relaxed resize-y`} />
        <div className="mt-3 flex items-center justify-between gap-3">
          <Field label="Consultant WhatsApp number"><input className={`${inputCls} w-56`} value={wa} onChange={(e) => setWa(e.target.value)} /></Field>
          <Btn disabled={!dirty} onClick={() => { saveTemplate("WHATSAPP_INVITE_TEMPLATE", tpl); saveTemplate("CONSULTANT_WA", wa); }}><Icon name="check" size={13} /> Save config</Btn>
        </div>
      </div>
      <div className="bg-pine-900 text-paper rounded-xl p-4">
        <h4 className="font-display font-bold text-sm text-hono-300 mb-2">Live preview</h4>
        <pre className="whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-moss-100/90 max-h-[420px] overflow-y-auto scroll-thin">
          {tpl
            .split("[CANDIDATE NAME]").join("Sari Dewanti")
            .split("[CONSULTANT NAME]").join("Raka Adiwijaya")
            .split("[COMPANY NAME]").join("Nusa Fintech Group")
            .split("[POSITION NAME]").join("Senior Backend Engineer")
            .split("[REQUISITION ID]").join("REQ-2026-001")
            .split("[SCHEDULER LINK]").join("https://script.google.com/…/exec?page=candidate&token=TKN-…")
            .split("[CONSULTANT WA NUMBER]").join(wa)}
        </pre>
        <p className="mt-3 text-[10px] text-paper/40">Button + visible wa.me hyperlink are both rendered to the consultant — no sensitive data in the URL.</p>
      </div>
    </div>
  );
}
