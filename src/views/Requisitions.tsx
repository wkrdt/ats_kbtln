import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import {
  PHASES, DEFAULT_FLOW, OPTIONAL_PHASES, REQ_TRANSITIONS, enabledPhases, hoursSince, fmtDate, fmtIDR, daysUntil,
} from "../lib/data";
import type { PhaseCode, PhaseConfig, ReqStatus, Requisition } from "../lib/data";
import { Icon, Btn, ReqPill, ReasonModal, Modal, Field, inputCls, Empty, SectionTitle, Mono, StackedBar, PhaseChip } from "../components/ui";

/* ================= Clients ================= */
export function Clients() {
  const { db, addClient, uploadContract, addResource } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [form, setForm] = useState({ companyName: "", website: "", picName: "", picPosition: "", picEmail: "", picPhoneWA: "", contractStart: "", contractEnd: "" });
  const [resForm, setResForm] = useState({ clientId: db.clients[0]?.id || "", resourceName: "", resourceType: "Sourcing platform", url: "", accountUsername: "", credentialReference: "", notes: "" });

  return (
    <div className="anim-rise">
      <SectionTitle icon="building" title="Clients & Contracts" sub="Each client is a tenant — data isolation flows User → Client → Requisition → Candidate → Document"
        right={<>
          <Btn tone="outline" onClick={() => setResOpen(true)}><Icon name="search" size={13} /> Sourcing resource</Btn>
          <Btn onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> New client</Btn>
        </>} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {db.clients.map((c) => {
          const reqs = db.requisitions.filter((r) => r.clientId === c.id);
          const open = reqs.filter((r) => r.status === "OPEN").length;
          return (
            <div key={c.id} className="bg-card border border-ink-900/8 rounded-xl p-4 hover:border-moss-300 hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display font-bold text-[15px] text-ink-900">{c.companyName}</div>
                  <div className="text-[11px] text-ink-400 font-mono">{c.website} · <Mono>{c.id}</Mono></div>
                </div>
                <span className={`text-[9.5px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${c.contractStatus === "SIGNED" ? "bg-moss-100 text-moss-800" : "bg-hono-100 text-hono-800"}`}>{c.contractStatus}</span>
              </div>
              <div className="mt-3 text-xs text-ink-600 space-y-1">
                <div className="flex items-center gap-1.5"><Icon name="user" size={12} className="text-ink-300" /> {c.picName} — {c.picPosition}</div>
                <div className="flex items-center gap-1.5"><Icon name="mail" size={12} className="text-ink-300" /> {c.picEmail}</div>
                <div className="flex items-center gap-1.5"><Icon name="calendar" size={12} className="text-ink-300" /> {fmtDate(c.contractStart)} → {fmtDate(c.contractEnd)}</div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-500">
                <span className="font-bold text-ink-700">{reqs.length}</span> requisitions · <span className="font-bold text-moss-700">{open}</span> open
              </div>
              <div className="mt-3 pt-3 border-t border-ink-900/6 flex items-center justify-between gap-2">
                {c.contractFileName ? (
                  <span className="flex items-center gap-1.5 text-[10.5px] font-mono text-moss-700 min-w-0"><Icon name="file" size={12} className="shrink-0" /><span className="truncate">{c.contractFileName}</span></span>
                ) : <span className="text-[10.5px] text-hono-600 font-semibold flex items-center gap-1"><Icon name="alert" size={11} /> No contract on file</span>}
                <label className="text-[10.5px] font-bold text-river-600 hover:text-river-800 cursor-pointer inline-flex items-center gap-1 shrink-0">
                  <Icon name="download" size={11} /> {c.contractFileName ? "Replace" : "Upload"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadContract(c.id, f.name); }} />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* sourcing resources */}
      <div className="mt-4 bg-card border border-ink-900/8 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-900/6 flex items-center justify-between">
          <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2"><Icon name="search" size={14} className="text-moss-600" /> Sourcing resources</h4>
          <span className="text-[10.5px] font-semibold text-hono-800 bg-hono-100 rounded-full px-2.5 py-1 flex items-center gap-1"><Icon name="lock" size={10} /> vault references only — no plaintext passwords</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-left text-xs">
            <thead><tr className="text-[10px] uppercase tracking-wider text-ink-400 border-b border-ink-900/6">
              <th className="px-4 py-2.5 font-bold">Resource</th><th className="px-3 py-2.5 font-bold">Client</th><th className="px-3 py-2.5 font-bold">Account</th><th className="px-3 py-2.5 font-bold">Credential ref</th><th className="px-3 py-2.5 font-bold">Access</th>
            </tr></thead>
            <tbody>
              {db.resources.map((r) => (
                <tr key={r.id} className="border-b border-ink-900/4 hover:bg-moss-50/60 transition-colors">
                  <td className="px-4 py-2.5"><div className="font-bold text-ink-900">{r.resourceName}</div><div className="text-[10px] text-ink-400">{r.resourceType} · {r.url}</div></td>
                  <td className="px-3 py-2.5 text-ink-600">{db.clients.find((c) => c.id === r.clientId)?.companyName}</td>
                  <td className="px-3 py-2.5 font-mono text-[10.5px] text-ink-500">{r.accountUsername}</td>
                  <td className="px-3 py-2.5"><Mono>{r.credentialReference}</Mono></td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[9.5px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${r.accessStatus === "ACTIVE" ? "bg-moss-100 text-moss-800" : r.accessStatus === "PENDING" ? "bg-hono-100 text-hono-800" : "bg-rust-100 text-rust-600"}`}>{r.accessStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* add resource modal */}
      <Modal open={resOpen} onClose={() => setResOpen(false)} title="Add sourcing resource" sub="Store a credential REFERENCE — the actual secret lives in the vault (PRD §8.6)"
        footer={<>
          <Btn tone="ghost" onClick={() => setResOpen(false)}>Cancel</Btn>
          <Btn disabled={!resForm.resourceName || !resForm.credentialReference}
            onClick={() => { addResource({ ...resForm, accessStatus: "ACTIVE" }); setResOpen(false); setResForm({ ...resForm, resourceName: "", url: "", accountUsername: "", credentialReference: "", notes: "" }); }}>
            <Icon name="check" size={13} /> Save resource
          </Btn>
        </>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Client" req>
            <select className={inputCls} value={resForm.clientId} onChange={(e) => setResForm({ ...resForm, clientId: e.target.value })}>
              {db.clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </Field>
          <Field label="Resource name" req><input className={inputCls} value={resForm.resourceName} onChange={(e) => setResForm({ ...resForm, resourceName: e.target.value })} placeholder="e.g. LinkedIn Recruiter Seat" /></Field>
          <Field label="Type">
            <select className={inputCls} value={resForm.resourceType} onChange={(e) => setResForm({ ...resForm, resourceType: e.target.value })}>
              {["Sourcing platform", "Job board", "Agency portal", "Internal referral tool"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="URL"><input className={inputCls} value={resForm.url} onChange={(e) => setResForm({ ...resForm, url: e.target.value })} placeholder="platform.com" /></Field>
          <Field label="Account username"><input className={inputCls} value={resForm.accountUsername} onChange={(e) => setResForm({ ...resForm, accountUsername: e.target.value })} /></Field>
          <Field label="Credential reference" req hint="e.g. VAULT:ln-recruiter-nusa — never the password itself">
            <input className={`${inputCls} font-mono`} value={resForm.credentialReference} onChange={(e) => setResForm({ ...resForm, credentialReference: e.target.value })} placeholder="VAULT:…" />
          </Field>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New client" sub="Creates the tenant and its private Drive folder ATS/Clients/{ClientID}/"
        footer={<>
          <Btn tone="ghost" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn disabled={!form.companyName || !form.picName} onClick={() => { addClient({ ...form, contractStart: form.contractStart || new Date().toISOString(), contractEnd: form.contractEnd || new Date().toISOString() }); setAddOpen(false); }}>
            <Icon name="check" size={13} /> Create client
          </Btn>
        </>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Field label="Company name" req><input className={inputCls} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="PT …" /></Field></div>
          <Field label="Website"><input className={inputCls} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label="PIC name" req><input className={inputCls} value={form.picName} onChange={(e) => setForm({ ...form, picName: e.target.value })} /></Field>
          <Field label="PIC position"><input className={inputCls} value={form.picPosition} onChange={(e) => setForm({ ...form, picPosition: e.target.value })} /></Field>
          <Field label="PIC email"><input className={inputCls} value={form.picEmail} onChange={(e) => setForm({ ...form, picEmail: e.target.value })} /></Field>
          <Field label="PIC WhatsApp"><input className={inputCls} value={form.picPhoneWA} onChange={(e) => setForm({ ...form, picPhoneWA: e.target.value })} /></Field>
          <Field label="Contract start"><input type="date" className={inputCls} value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} /></Field>
          <Field label="Contract end"><input type="date" className={inputCls} value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/* ================= Requisitions ================= */
export function Requisitions() {
  const { db, setReqStatus, savePhaseConfig, addRequisition, toast } = useStore();
  const [sel, setSel] = useState(db.requisitions[0]?.id || "");
  const [statusPick, setStatusPick] = useState<ReqStatus | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const req = db.requisitions.find((r) => r.id === sel) || db.requisitions[0];

  const stats = useMemo(() => ({
    open: db.requisitions.filter((r) => r.status === "OPEN").length,
    hold: db.requisitions.filter((r) => r.status === "ON_HOLD").length,
    closed: db.requisitions.filter((r) => r.status === "CLOSED").length,
    cancelled: db.requisitions.filter((r) => r.status === "CANCELLED").length,
  }), [db.requisitions]);

  return (
    <div className="anim-rise">
      <SectionTitle icon="briefcase" title="Requisitions" sub={`${stats.open} open · ${stats.hold} on hold · ${stats.closed} closed · ${stats.cancelled} cancelled — status changes require reasons`}
        right={<Btn onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> New requisition</Btn>} />

      <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
        {/* list */}
        <div className="space-y-2 lg:sticky lg:top-[70px]">
          {db.requisitions.map((r) => {
            const cl = db.clients.find((c) => c.id === r.clientId);
            const act = db.applications.filter((a) => a.requisitionId === r.id && a.active).length;
            const isSel = r.id === req?.id;
            return (
              <button key={r.id} onClick={() => setSel(r.id)}
                className={`w-full text-left rounded-xl border px-3.5 py-3 transition-all duration-150 cursor-pointer ${isSel ? "bg-pine-900 border-pine-900 text-paper shadow-lg shadow-pine-900/15" : "bg-card border-ink-900/10 hover:border-moss-400"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-bold truncate ${isSel ? "text-hono-300" : "text-ink-900"}`}>{r.positionName}</span>
                  <ReqPill s={r.status} small />
                </div>
                <div className={`text-[10.5px] mt-1 ${isSel ? "text-paper/60" : "text-ink-400"}`}>{cl?.companyName} · {r.department}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className={`flex-1 mr-3 rounded-full h-1.5 overflow-hidden ${isSel ? "bg-white/15" : "bg-ink-900/8"}`}>
                    <div className="h-full rounded-full bg-moss-500 transition-all duration-500" style={{ width: `${(r.filledCount / Math.max(1, r.headcount)) * 100}%` }} />
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${isSel ? "text-moss-200" : "text-ink-500"}`}>{r.filledCount}/{r.headcount} · {act} active</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* detail */}
        {req && <ReqDetail key={req.id} req={req} onStatus={(s) => setStatusPick(s)} onConfig={() => setConfigOpen(true)} />}
      </div>

      {/* status modal */}
      <ReasonModal open={!!statusPick} onClose={() => setStatusPick(null)}
        title={`Requisition → ${statusPick?.replace("_", " ")}`}
        sub={statusPick === "ON_HOLD" ? "Auto-cancels after 30 days unless re-opened." : statusPick === "CLOSED" ? "Use when the required headcount is placed." : statusPick === "CANCELLED" ? "Terminated without full fulfilment." : ""}
        context={req ? [["Requisition", `${req.positionName} (${req.id})`], ["Current", req.status], ["Allowed from here", REQ_TRANSITIONS[req.status].join(", ") || "none — final state"]] : []}
        quick={statusPick === "ON_HOLD" ? ["Client budget freeze", "Hiring pause requested"] : statusPick === "CANCELLED" ? ["Client terminated engagement", "Role eliminated"] : ["Headcount fulfilled"]}
        tone={statusPick === "CANCELLED" ? "danger" : "solid"}
        onConfirm={(r) => req && statusPick && setReqStatus(req.id, statusPick, r)} confirmLabel="Apply & log" />

      {req && <PhaseConfigModal open={configOpen} onClose={() => setConfigOpen(false)} req={req} onSave={(ph, reason) => { savePhaseConfig(req.id, ph, reason); setConfigOpen(false); }} />}
      <NewReqModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={(r) => { addRequisition(r); setAddOpen(false); toast(`${r.positionName} opened`, "info"); }} />
    </div>
  );
}

function ReqDetail({ req, onStatus, onConfig }: { req: Requisition; onStatus: (s: ReqStatus) => void; onConfig: () => void }) {
  const { db } = useStore();
  const client = db.clients.find((c) => c.id === req.clientId);
  const apps = db.applications.filter((a) => a.requisitionId === req.id);
  const en = enabledPhases(req);
  const holdLeft = req.status === "ON_HOLD" && req.holdSince ? Math.max(0, 30 - Math.floor(hoursSince(req.holdSince) / 24)) : null;

  return (
    <div className="space-y-4 anim-rise">
      <div className="bg-card border border-ink-900/8 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-display font-extrabold text-xl text-ink-900">{req.positionName}</h3>
              <ReqPill s={req.status} />
              <Mono>{req.id}</Mono>
            </div>
            <div className="text-xs text-ink-500 mt-1.5">{client?.companyName} · {req.department} · {req.level} · {req.workLocation} ({req.workArrangement}) · opened {fmtDate(req.createdAt)}</div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {REQ_TRANSITIONS[req.status].map((s) => (
              <Btn key={s} size="sm" tone={s === "CANCELLED" ? "dangerSoft" : s === "ON_HOLD" ? "amber" : "outline"} onClick={() => onStatus(s)}>
                <Icon name={s === "ON_HOLD" ? "clock" : s === "CLOSED" ? "check" : "x"} size={12} /> {s.replace("_", " ")}
              </Btn>
            ))}
          </div>
        </div>

        {holdLeft !== null && (
          <div className="mt-3 rounded-lg bg-hono-100 border border-hono-400/50 px-3 py-2.5 text-xs text-hono-800 flex items-center gap-2">
            <Icon name="alert" size={13} /> <b>On hold.</b> Nightly trigger will auto-cancel in <b>{holdLeft} day(s)</b> unless re-opened (policy: 30 days).
          </div>
        )}

        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-paper px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Headcount</div>
            <div className="font-display font-extrabold text-lg text-ink-900">{req.filledCount}<span className="text-ink-400 text-sm">/{req.headcount}</span></div>
            <div className="mt-1.5 h-1.5 rounded-full bg-ink-900/8 overflow-hidden"><div className="h-full bg-moss-600 anim-bar" style={{ width: `${(req.filledCount / req.headcount) * 100}%` }} /></div>
          </div>
          <div className="rounded-lg bg-paper px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Salary band</div>
            <div className="font-display font-extrabold text-lg text-ink-900">{fmtIDR(req.minSalary)}–{fmtIDR(req.maxSalary)}</div>
            <div className="text-[10.5px] text-ink-400">{req.employmentType}</div>
          </div>
          <div className="rounded-lg bg-paper px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Target fill</div>
            <div className="font-display font-extrabold text-lg text-ink-900">{fmtDate(req.targetDate)}</div>
            <div className={`text-[10.5px] ${daysUntil(req.targetDate) < 7 ? "text-rust-500 font-bold" : "text-ink-400"}`}>{daysUntil(req.targetDate) >= 0 ? `${daysUntil(req.targetDate)}d left` : `${-daysUntil(req.targetDate)}d overdue`}</div>
          </div>
          <div className="rounded-lg bg-paper px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Hiring manager</div>
            <div className="font-bold text-ink-800 text-[12.5px]">{req.hiringManagerName}</div>
            <div className="text-[10.5px] text-ink-400 truncate">{req.hiringManagerEmail}</div>
          </div>
        </div>

        {req.jobDescription && <p className="mt-3 text-xs text-ink-600 leading-relaxed">{req.jobDescription} <span className="text-ink-400">Required: {req.requiredSkills}.</span></p>}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mr-1">Sourcing</span>
          {req.sourcingChannels.map((s) => <span key={s} className="text-[10.5px] font-semibold bg-river-100 text-river-800 rounded-full px-2 py-0.5">{s}</span>)}
        </div>
      </div>

      {/* pipeline distribution */}
      <div className="bg-card border border-ink-900/8 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-bold text-sm text-ink-900">Pipeline distribution</h4>
          <span className="text-[11px] text-ink-400">{apps.filter((a) => a.active).length} active applications</span>
        </div>
        <StackedBar height={12} segments={en.map((p) => ({ v: apps.filter((a) => a.active && a.phase === p.code).length, color: PHASES[p.code].color, title: `${PHASES[p.code].name}: ${apps.filter((a) => a.active && a.phase === p.code).length}` }))} />
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {en.map((p) => {
            const n = apps.filter((a) => a.active && a.phase === p.code).length;
            return n > 0 ? <span key={p.code} className="text-[10.5px] text-ink-500 flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: PHASES[p.code].color }} />{PHASES[p.code].name} <b className="text-ink-800">{n}</b></span> : null;
          })}
        </div>
      </div>

      {/* phase config */}
      <div className="bg-card border border-ink-900/8 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-bold text-sm text-ink-900">Recruitment flow ({en.length} phases enabled)</h4>
          <Btn size="sm" tone="outline" onClick={onConfig}><Icon name="sliders" size={12} /> Configure phases</Btn>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {en.map((p, i) => (
            <span key={p.code} className="flex items-center gap-1">
              <PhaseChip code={p.code} small />
              {i < en.length - 1 && <Icon name="chevR" size={12} className="text-ink-300" />}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-ink-400 flex items-center gap-1.5"><Icon name="shield" size={11} /> Every manual configuration change stores previous + new flow, consultant, timestamp and reason in the AuditLog.</p>
      </div>
    </div>
  );
}

/* ---- phase builder ---- */
function PhaseConfigModal({ open, onClose, req, onSave }: { open: boolean; onClose: () => void; req: Requisition; onSave: (p: PhaseConfig[], reason: string) => void }) {
  const [draft, setDraft] = useState<PhaseConfig[]>(req.phases);
  const [reasonOpen, setReasonOpen] = useState(false);
  const move = (i: number, dir: -1 | 1) => setDraft((d) => {
    const n = [...d];
    const j = i + dir;
    if (j < 0 || j >= n.length) return d;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const toggle = (code: PhaseCode) => setDraft((d) => d.map((p) => (p.code === code && !p.required ? { ...p, enabled: !p.enabled } : p)));
  const dirty = JSON.stringify(draft) !== JSON.stringify(req.phases);
  const enabledNow = draft.filter((p) => p.enabled).length;

  return (
    <>
      <Modal open={open} onClose={onClose} title="Configure recruitment flow" sub={`${req.positionName} — required phases are locked; order matters`} wide
        footer={<>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn disabled={!dirty || enabledNow < 2} onClick={() => setReasonOpen(true)}><Icon name="shield" size={13} /> Save with reason</Btn>
        </>}>
        <div className="space-y-1.5">
          {draft.map((p, i) => (
            <div key={p.code} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all ${p.enabled ? "bg-card border-ink-900/10" : "bg-paper-deep/60 border-ink-900/6 opacity-55"}`}>
              <span className="w-5 h-5 rounded-md bg-pine-900 text-hono-300 grid place-items-center text-[10px] font-mono font-bold">{i + 1}</span>
              <span className="text-[13px] font-semibold text-ink-800 flex-1">{PHASES[p.code].name}</span>
              {p.required
                ? <span className="text-[9.5px] font-bold uppercase tracking-wide text-river-600 bg-river-100 rounded-full px-2 py-0.5 flex items-center gap-1"><Icon name="lock" size={9} /> required</span>
                : <span className="text-[9.5px] font-bold uppercase tracking-wide text-ink-400 bg-ink-900/5 rounded-full px-2 py-0.5">optional</span>}
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-ink-900/6 text-ink-500 disabled:opacity-25 cursor-pointer"><Icon name="up" size={13} /></button>
              <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="p-1 rounded hover:bg-ink-900/6 text-ink-500 disabled:opacity-25 cursor-pointer"><Icon name="down" size={13} /></button>
              <button onClick={() => toggle(p.code)} disabled={p.required}
                className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer disabled:cursor-not-allowed ${p.enabled ? "bg-moss-600" : "bg-ink-900/20"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${p.enabled ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-ink-400">
          Add optional phases: {OPTIONAL_PHASES.filter((c) => !draft.some((p) => p.code === c)).map((c) => (
            <button key={c} onClick={() => setDraft((d) => {
              const ui = d.findIndex((x) => x.code === "USER_INTERVIEW");
              const n = [...d];
              n.splice(ui >= 0 ? ui : d.length, 0, { code: c, enabled: true, required: false });
              return n;
            })} className="text-moss-700 font-bold hover:underline mr-2 cursor-pointer">+ {PHASES[c].name}</button>
          ))}
          {OPTIONAL_PHASES.every((c) => draft.some((p) => p.code === c)) && <span>all optional phases already in flow</span>}
        </div>
      </Modal>
      <ReasonModal open={reasonOpen} onClose={() => setReasonOpen(false)}
        title="Save phase configuration" sub="Previous and new flow are stored side-by-side in the AuditLog"
        context={[["Previous", req.phases.filter((p) => p.enabled).map((p) => PHASES[p.code].name).join(" → ")], ["New", draft.filter((p) => p.enabled).map((p) => PHASES[p.code].name).join(" → ")]]}
        quick={["Client added assessment gate", "Removed unused phase", "Reordered per client SOP"]}
        onConfirm={(r) => onSave(draft, r)} confirmLabel="Save & log change" />
    </>
  );
}

/* ---- new requisition ---- */
function NewReqModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (r: { clientId: string; positionName: string; department: string; level: string; headcount: number; minSalary: number; maxSalary: number; targetDate: string; workArrangement: string; workLocation: string; channels: string[]; extraPhases: PhaseCode[] }) => void }) {
  const { db } = useStore();
  const [f, setF] = useState({ clientId: db.clients[0]?.id || "", positionName: "", department: "", level: "Mid", headcount: 1, minSalary: 8, maxSalary: 12, targetDate: "", workArrangement: "Hybrid", workLocation: "Jakarta", channels: ["LinkedIn"] });
  const [extra, setExtra] = useState<PhaseCode[]>([]);
  return (
    <Modal open={open} onClose={onClose} title="Open requisition" sub="Starts with the default flow — configure optional gates after creation" wide
      footer={<>
        <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!f.positionName || !f.targetDate} onClick={() => onCreate({ ...f, minSalary: f.minSalary * 1_000_000, maxSalary: f.maxSalary * 1_000_000, headcount: Math.max(1, f.headcount), extraPhases: extra })}>
          <Icon name="check" size={13} /> Create requisition
        </Btn>
      </>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Client" req>
          <select className={inputCls} value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>
            {db.clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </Field>
        <Field label="Position name" req><input className={inputCls} value={f.positionName} onChange={(e) => setF({ ...f, positionName: e.target.value })} placeholder="e.g. QA Automation Lead" /></Field>
        <Field label="Department"><input className={inputCls} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></Field>
        <Field label="Level">
          <select className={inputCls} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
            {["Junior", "Mid", "Senior", "Lead", "Manager"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Headcount" req><input type="number" min={1} className={inputCls} value={f.headcount} onChange={(e) => setF({ ...f, headcount: Number(e.target.value) })} /></Field>
        <Field label="Target fill date" req><input type="date" className={inputCls} value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} /></Field>
        <Field label="Min salary (jt IDR)"><input type="number" className={inputCls} value={f.minSalary} onChange={(e) => setF({ ...f, minSalary: Number(e.target.value) })} /></Field>
        <Field label="Max salary (jt IDR)"><input type="number" className={inputCls} value={f.maxSalary} onChange={(e) => setF({ ...f, maxSalary: Number(e.target.value) })} /></Field>
        <Field label="Work location"><input className={inputCls} value={f.workLocation} onChange={(e) => setF({ ...f, workLocation: e.target.value })} /></Field>
        <Field label="Arrangement">
          <select className={inputCls} value={f.workArrangement} onChange={(e) => setF({ ...f, workArrangement: e.target.value })}>
            {["On-site", "Hybrid", "Remote"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <span className="block text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-1.5">Optional gates to pre-enable</span>
          <div className="flex flex-wrap gap-1.5">
            {OPTIONAL_PHASES.map((c) => (
              <button key={c} onClick={() => setExtra((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}
                className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors cursor-pointer ${extra.includes(c) ? "bg-moss-700 text-white border-moss-700" : "bg-card border-ink-900/12 text-ink-500 hover:border-moss-400"}`}>
                {PHASES[c].name}
              </button>
            ))}
          </div>
          <div className="mt-2.5 text-[11px] text-ink-400 font-mono">Default: {DEFAULT_FLOW.join(" → ")}</div>
        </div>
      </div>
    </Modal>
  );
}
