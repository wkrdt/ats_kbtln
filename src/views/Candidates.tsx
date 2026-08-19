import { useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import {
  PHASES, PHASE_STATUSES, enabledPhases, nextPhase, phaseIndex, timeAgo, fmtDT, fmtIDR, waLink, normPhone, hoursSince,
} from "../lib/data";
import type { Application, Candidate, PhaseCode, CandidateStatus, Requisition } from "../lib/data";
import { Icon, Btn, StatusPill, PhaseChip, ReasonModal, Modal, Drawer, Field, inputCls, Empty, SectionTitle, Mono, CopyBtn } from "../components/ui";

/* ================= WhatsApp invite modal ================= */
export function WhatsAppModal({ app, onClose }: { app: Application | null; onClose: () => void }) {
  const { db } = useStore();
  if (!app) return null;
  const cand = db.candidates.find((c) => c.id === app.candidateId);
  const req = db.requisitions.find((r) => r.id === app.requisitionId);
  const client = db.clients.find((c) => c.id === req?.clientId);
  const consultant = db.users.find((u) => u.role === "CONSULTANT");
  const token = db.tokens.find((t) => t.applicationId === app.id)?.token || `TKN-${app.id.slice(-4)}`;
  const scheduler = `https://script.google.com/macros/s/AKfy…/exec?page=candidate&token=${token}`;
  const rep = (s: string, k: string, v: string) => s.split(k).join(v);
  let msg = db.config.WHATSAPP_INVITE_TEMPLATE || "";
  msg = rep(msg, "[CANDIDATE NAME]", cand?.fullName || "");
  msg = rep(msg, "[CONSULTANT NAME]", consultant?.name || "");
  msg = rep(msg, "[COMPANY NAME]", client?.companyName || "");
  msg = rep(msg, "[POSITION NAME]", req?.positionName || "");
  msg = rep(msg, "[REQUISITION ID]", req?.id || "");
  msg = rep(msg, "[SCHEDULER LINK]", scheduler);
  msg = rep(msg, "[CONSULTANT WA NUMBER]", db.config.CONSULTANT_WA || "");
  const href = waLink(cand?.phone || "", msg);
  return (
    <Modal open onClose={onClose} title="WhatsApp invitation" sub="Template from Config · placeholders resolved · no sensitive data in the URL" wide
      footer={<>
        <CopyBtn text={msg} label="Copy message" />
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md text-[13px] px-3.5 py-2 font-semibold bg-[#1f8f5f] text-white hover:bg-[#17714b] transition-colors">
          <Icon name="chat" size={14} /> Open wa.me
        </a>
      </>}>
      <div className="text-[11px] text-ink-500 mb-2">Visible link (PRD: hyperlink must be visible, not only a button):</div>
      <div className="font-mono text-[10.5px] break-all bg-river-100 text-river-800 rounded-lg px-3 py-2 mb-3">{href.slice(0, 140)}…</div>
      <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed bg-pine-900 text-moss-100 rounded-xl p-4 max-h-72 overflow-y-auto scroll-thin">{msg}</pre>
    </Modal>
  );
}

/* ================= Transfer modal ================= */
function TransferModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const { db, transfer } = useStore();
  const [dest, setDest] = useState("");
  const [consent, setConsent] = useState(false);
  const [reason, setReason] = useState("");
  const src = db.requisitions.find((r) => r.id === app.requisitionId);
  const dst = db.requisitions.find((r) => r.id === dest);
  const crossClient = !!dst && dst.clientId !== src?.clientId;
  const options = db.requisitions.filter((r) => r.id !== app.requisitionId && r.status === "OPEN");
  return (
    <Modal open onClose={onClose} title="Transfer candidate" sub="Original application closes as TRANSFERRED · a new application opens at SCREENING"
      footer={<>
        <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!dest || reason.trim().length < 4 || (crossClient && !consent)}
          onClick={() => { transfer(app.id, dest, reason.trim(), consent); onClose(); }}>
          <Icon name="send" size={13} /> Transfer & log
        </Btn>
      </>}>
      <div className="space-y-4">
        <Field label="Destination requisition" req>
          <select className={inputCls} value={dest} onChange={(e) => setDest(e.target.value)}>
            <option value="">Select…</option>
            {db.clients.map((cl) => (
              <optgroup key={cl.id} label={cl.companyName}>
                {options.filter((r) => r.clientId === cl.id).map((r) => (
                  <option key={r.id} value={r.id}>{r.positionName} — {r.id}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        {dst && (
          <div className={`rounded-lg border px-3 py-2.5 text-xs ${crossClient ? "border-hono-400/50 bg-hono-100 text-hono-800" : "border-moss-200 bg-moss-50 text-moss-800"}`}>
            {crossClient
              ? <><b>Cross-client transfer.</b> Destination client will only see data necessary for the new recruitment. You must confirm candidate consent was obtained outside the system, and that the data-sharing clause exists in both contracts.</>
              : <><b>Same-client transfer</b> — {db.clients.find((c) => c.id === dst.clientId)?.companyName}. Only consultant confirmation and a reason are required.</>}
          </div>
        )}
        {crossClient && (
          <label className="flex items-start gap-2.5 text-xs text-ink-700 bg-card border border-ink-900/10 rounded-lg px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#17573c]" />
            <span>I confirm the <b>candidate has consented</b> to sharing their profile with {db.clients.find((c) => c.id === dst?.clientId)?.companyName}, and both client contracts permit this data sharing.</span>
          </label>
        )}
        <Field label="Reason" req>
          <textarea className={`${inputCls} resize-none`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Better fit for Surabaya hub; candidate agreed during call…" />
        </Field>
        <p className="text-[11px] text-ink-400 flex items-center gap-1.5"><Icon name="lock" size={11} /> The audit entry records origin, destination, consultant, timestamp, consent status and reason.</p>
      </div>
    </Modal>
  );
}

/* ================= Add candidate modal w/ duplicate control ================= */
function AddCandidateModal({ onClose, onOpenCandidate }: { onClose: () => void; onOpenCandidate: (id: string) => void }) {
  const { db, checkDuplicate, addCandidate } = useStore();
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", city: "", cvName: "", reqId: db.requisitions.find((r) => r.status === "OPEN")?.id || "", channel: "LinkedIn" });
  const [cvError, setCvError] = useState("");
  const [check, setCheck] = useState<ReturnType<typeof checkDuplicate> | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const openReqs = db.requisitions.filter((r) => r.status === "OPEN");

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf") { setCvError("Only PDF files are accepted (application/pdf)."); return; }
    if (f.size > 5 * 1024 * 1024) { setCvError("CV exceeds the 5 MB limit."); return; }
    setCvError("");
    setForm((x) => ({ ...x, cvName: f.name }));
  };

  const runCheck = () => setCheck(checkDuplicate(form.phone));
  const canAdd = !!check && check.level !== "BLOCK" && (check.level === "CLEAR" || overrideReason.trim().length >= 4) && form.fullName && form.cvName && form.reqId;

  return (
    <Modal open onClose={onClose} title="Add candidate" sub="Name, phone and CV are required — the rest can arrive via the questionnaire" wide
      footer={check ? <>
        <Btn tone="ghost" onClick={() => { setCheck(null); setOverrideReason(""); }}><Icon name="refresh" size={13} /> Edit details</Btn>
        {check.level === "BLOCK"
          ? <Btn tone="danger" disabled><Icon name="lock" size={13} /> Blocked by policy</Btn>
          : <Btn disabled={!canAdd} onClick={() => { addCandidate({ ...form, overrideReason: overrideReason || undefined }); onClose(); }}>
              <Icon name="plus" size={13} /> {check.level === "CLEAR" ? "Create candidate" : "Override & create (logged)"}
            </Btn>}
      </> : <>
        <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!form.fullName || !form.phone || !form.cvName || !form.reqId} onClick={runCheck}><Icon name="shield" size={13} /> Run duplicate check</Btn>
      </>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full name" req><input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Nadia Putri" /></Field>
        <Field label="Registered phone" req hint="Duplicate control key — normalized before matching">
          <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0812-…" />
        </Field>
        <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@mail.com" /></Field>
        <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
        <Field label="Requisition" req>
          <select className={inputCls} value={form.reqId} onChange={(e) => setForm({ ...form, reqId: e.target.value })}>
            {openReqs.map((r) => <option key={r.id} value={r.id}>{r.positionName} — {db.clients.find((c) => c.id === r.clientId)?.companyName}</option>)}
          </select>
        </Field>
        <Field label="Sourcing channel">
          <select className={inputCls} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            {["LinkedIn", "Glints", "JobStreet", "Referral", "Walk-in", "Talent pool"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="CV (PDF, ≤ 5 MB)" req hint="Stored as {CandidateID}_CV_{yyyyMMdd_HHmmss}.pdf in ATS/Clients/{ClientID}/Requisitions/{ReqID}/CVs/">
            <button onClick={() => fileRef.current?.click()}
              className={`w-full rounded-lg border-2 border-dashed px-3 py-3.5 text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 ${form.cvName ? "border-moss-400 bg-moss-50 text-moss-800" : cvError ? "border-rust-400 bg-rust-100/60 text-rust-600" : "border-ink-900/15 bg-card text-ink-500 hover:border-moss-400"}`}>
              <Icon name={form.cvName ? "check" : "file"} size={15} /> {form.cvName || (cvError || "Click to attach CV — MIME & size validated server-side")}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </Field>
        </div>
      </div>

      {check && (
        <div className={`mt-4 rounded-xl border px-4 py-3.5 anim-rise ${
          check.level === "BLOCK" ? "border-rust-500/40 bg-rust-100 text-rust-800"
          : check.level === "CLEAR" ? "border-moss-300 bg-moss-50 text-moss-800"
          : "border-hono-400/60 bg-hono-100 text-hono-800"}`}>
          <div className="flex items-center gap-2 font-bold text-sm mb-1">
            <Icon name={check.level === "BLOCK" ? "lock" : check.level === "CLEAR" ? "check" : "alert"} size={15} />
            {check.level === "BLOCK" ? "Blocked — past no-show / no-response (2-year rule)"
              : check.level === "CLEAR" ? "Duplicate check passed"
              : check.level === "WARN_ACTIVE" ? "Warning — active duplicate by phone" : "Warning — failed / withdrawn history (1-year rule)"}
          </div>
          <p className="text-xs leading-relaxed">{check.message}</p>
          {check.candidate && check.level !== "BLOCK" && (
            <div className="mt-2 flex gap-2 items-center">
              <Btn size="sm" tone="outline" onClick={() => { onClose(); onOpenCandidate(check.candidate!.id); }}>
                <Icon name="eye" size={12} /> Review {check.candidate.code}
              </Btn>
              <span className="text-[10.5px] opacity-70">Existing record: {check.candidate.fullName}</span>
            </div>
          )}
          {check.level !== "BLOCK" && check.level !== "CLEAR" && (
            <div className="mt-3">
              <label className="block text-[10.5px] font-bold uppercase tracking-wider opacity-70 mb-1">Mandatory override reason</label>
              <textarea className="w-full rounded-lg border border-hono-500/40 bg-card/80 px-3 py-2 text-xs text-ink-900 resize-none focus:outline-none focus:border-hono-500" rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Why is a new record justified? (written to AuditLog)" />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ================= Candidate drawer ================= */
export function CandidateDrawer({ candidateId, onClose }: { candidateId: string | null; onClose: () => void }) {
  const { db, advancePhase, setAppStatus, confirmWithdrawal, viewCV } = useStore();
  const [statusPick, setStatusPick] = useState<{ app: Application; status: CandidateStatus } | null>(null);
  const [advancePick, setAdvancePick] = useState<{ app: Application; to: PhaseCode } | null>(null);
  const [transferApp, setTransferApp] = useState<Application | null>(null);
  const [waApp, setWaApp] = useState<Application | null>(null);
  const [cvView, setCvView] = useState<Candidate | null>(null);

  const cand = db.candidates.find((c) => c.id === candidateId) || null;
  const apps = db.applications.filter((a) => a.candidateId === candidateId);
  const timeline = useMemo(() => db.audit.filter((a) => {
    const matchObj = a.objectId === candidateId || apps.some((x) => x.id === a.objectId) || (cand && a.objectId === cand.code);
    return matchObj;
  }).slice(0, 14), [db.audit, candidateId, apps, cand]);

  return (
    <Drawer open={!!candidateId} onClose={onClose}>
      {cand && <>
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-ink-900/8 px-5 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-display font-extrabold text-xl text-ink-900">{cand.fullName}</h3>
              <Mono>{cand.code}</Mono>
            </div>
            <div className="text-xs text-ink-500 mt-1 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><Icon name="phone" size={11} /> {cand.phone}</span>
              <span className="flex items-center gap-1"><Icon name="mail" size={11} /> {cand.email || "—"}</span>
              <span className="flex items-center gap-1"><Icon name="building" size={11} /> {cand.city || "—"}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-900/6 cursor-pointer"><Icon name="x" size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* profile */}
          <section className="bg-card border border-ink-900/8 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2"><Icon name="user" size={14} className="text-moss-600" /> Profile</h4>
              <div className="flex gap-2">
                <Btn size="xs" tone="outline" onClick={() => { viewCV(cand.id); setCvView(cand); }}><Icon name="file" size={12} /> View CV</Btn>
                <CopyBtn text={`https://script.google.com/macros/s/AKfy…/exec?file=${cand.cvFileId}&auth=signed`} label="Signed URL" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {[
                ["Current role", cand.currentTitle ? `${cand.currentTitle} @ ${cand.currentCompany || "—"}` : "—"],
                ["Experience", cand.yearsExp ? `${cand.yearsExp} years` : "—"],
                ["Education", cand.educationLevel ? `${cand.educationLevel} · ${cand.educationInstitution || ""}` : "—"],
                ["Major", cand.major || "—"],
                ["Expected salary", cand.expectedSalary ? fmtIDR(cand.expectedSalary) : "—"],
                ["Notice period", cand.noticePeriod || "—"],
              ].map(([k, v]) => (
                <div key={k}><div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{k}</div><div className="text-ink-800 font-medium mt-0.5">{v}</div></div>
              ))}
            </div>
            {cand.skills && cand.skills.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-3">{cand.skills.map((s) => <span key={s} className="text-[10.5px] font-semibold bg-moss-100 text-moss-800 rounded-full px-2 py-0.5">{s}</span>)}</div>
            )}
            <div className="mt-3 pt-3 border-t border-ink-900/6 font-mono text-[10px] text-ink-400 flex items-center gap-1.5 flex-wrap">
              <Icon name="lock" size={10} /> {cand.cvFileName} · Drive <Mono>{cand.cvFileId}</Mono> · private, Apps-Script-only access
            </div>
          </section>

          {/* applications */}
          <section>
            <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2 mb-2.5"><Icon name="briefcase" size={14} className="text-moss-600" /> Applications ({apps.length})</h4>
            <div className="space-y-3">
              {apps.map((a) => {
                const req = db.requisitions.find((r) => r.id === a.requisitionId);
                const client = db.clients.find((c) => c.id === req?.clientId);
                const np = req ? nextPhase(req, a.phase) : null;
                const allowed = (PHASE_STATUSES[a.phase] || []).filter((s) => s !== a.status);
                const en = req ? enabledPhases(req) : [];
                const later = en.slice(en.findIndex((p) => p.code === a.phase) + 1).filter((p) => p.code !== (np || "—"));
                return (
                  <div key={a.id} className={`rounded-xl border p-4 ${a.active ? "bg-card border-ink-900/10" : "bg-paper-deep/50 border-ink-900/6 opacity-70"}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="text-[13px] font-bold text-ink-900">{req?.positionName}</div>
                        <div className="text-[11px] text-ink-400">{client?.companyName} · <Mono>{req?.id}</Mono> · via {a.sourcingChannel}</div>
                      </div>
                      <div className="flex items-center gap-1.5"><PhaseChip code={a.phase} small /><StatusPill s={a.status} small /></div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3 text-[10.5px] text-ink-400 flex-wrap">
                      <span className={a.questionnaireStatus === "SUBMITTED" ? "text-moss-600 font-semibold" : "text-hono-600 font-semibold"}>
                        Questionnaire: {a.questionnaireStatus.toLowerCase()}
                      </span>
                      <span>Last touch {timeAgo(a.lastInteractionAt)}</span>
                      {a.slotId && <span className="flex items-center gap-1"><Icon name="video" size={10} /> slot {a.slotId}</span>}
                      {a.transferNote && <span className="text-river-600 font-semibold">{a.transferNote}</span>}
                    </div>

                    {a.withdrawalRequest && (
                      <div className="mt-3 rounded-lg bg-rust-100 border border-rust-400/40 px-3 py-2.5 text-xs text-rust-800">
                        <div className="font-bold flex items-center gap-1.5 mb-1"><Icon name="alert" size={12} /> Withdrawal requested {timeAgo(a.withdrawalRequest.requestedAt)}</div>
                        <p className="opacity-90">“{a.withdrawalRequest.reason}” — candidate sent the WhatsApp message; status only changes when you confirm.</p>
                        <div className="mt-2"><Btn size="xs" tone="dangerSoft" onClick={() => setStatusPick({ app: a, status: "WITHDRAWN" })}><Icon name="check" size={11} /> Confirm withdrawal</Btn></div>
                      </div>
                    )}

                    {a.active && (a.status === "ACTIVE" || a.status === "RESERVED") && (
                      <div className="mt-3 pt-3 border-t border-ink-900/6 flex flex-wrap items-center gap-1.5">
                        {np && <Btn size="xs" onClick={() => setAdvancePick({ app: a, to: np })}><Icon name="arrowR" size={11} /> Advance → {PHASES[np].name}</Btn>}
                        {later.length > 0 && (
                          <select className="text-[11px] rounded-md border border-ink-900/15 bg-card px-2 py-1.5 text-ink-700 font-semibold cursor-pointer" value=""
                            onChange={(e) => e.target.value && setAdvancePick({ app: a, to: e.target.value as PhaseCode })}>
                            <option value="">Skip to…</option>
                            {later.map((p) => <option key={p.code} value={p.code}>{PHASES[p.code].name}</option>)}
                          </select>
                        )}
                        <select className="text-[11px] rounded-md border border-ink-900/15 bg-card px-2 py-1.5 text-ink-700 font-semibold cursor-pointer" value=""
                          onChange={(e) => e.target.value && setStatusPick({ app: a, status: e.target.value as CandidateStatus })}>
                          <option value="">Set status…</option>
                          {allowed.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                        </select>
                        <Btn size="xs" tone="outline" onClick={() => setTransferApp(a)}><Icon name="send" size={11} /> Transfer</Btn>
                        <Btn size="xs" tone="outline" onClick={() => setWaApp(a)}><Icon name="chat" size={11} /> WhatsApp</Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* timeline */}
          <section>
            <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2 mb-2.5"><Icon name="list" size={14} className="text-moss-600" /> Activity (AuditLog)</h4>
            <div className="rounded-xl border border-ink-900/8 bg-card divide-y divide-ink-900/5 overflow-hidden">
              {timeline.length === 0 && <Empty icon="list" title="No audited activity yet" />}
              {timeline.map((t) => (
                <div key={t.id} className="px-3.5 py-2.5 text-xs hover:bg-moss-50/60 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9.5px] font-bold text-moss-700 bg-moss-100 rounded px-1.5 py-0.5">{t.action}</span>
                    <span className="font-mono text-[9.5px] text-ink-400">{fmtDT(t.ts)}</span>
                  </div>
                  {(t.prev || t.next) && <div className="mt-1 text-ink-600">{t.prev && <span className="line-through opacity-60">{t.prev}</span>}{t.prev && t.next && <span className="mx-1.5 text-moss-600">→</span>}<span className="font-semibold">{t.next}</span></div>}
                  {t.reason && <div className="text-[10.5px] italic text-ink-400 mt-0.5">“{t.reason}” — {t.userName}</div>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </>}

      {/* modals */}
      <ReasonModal open={!!advancePick} onClose={() => setAdvancePick(null)}
        title={advancePick && phaseIndex(db.requisitions.find((r) => r.id === advancePick.app.requisitionId) as Requisition, advancePick.to) > phaseIndex(db.requisitions.find((r) => r.id === advancePick.app.requisitionId) as Requisition, advancePick.app.phase) + 1 ? "Skip phase — flagged" : "Advance candidate"}
        context={advancePick ? [["Candidate", cand?.fullName || ""], ["From", PHASES[advancePick.app.phase].name], ["To", PHASES[advancePick.to].name]] : []}
        quick={["Meets phase criteria", "Client expedited", "Assessment passed"]}
        onConfirm={(r) => advancePick && advancePhase(advancePick.app.id, advancePick.to, r)} confirmLabel="Move & log" />

      {statusPick && (
        <ReasonModal open onClose={() => setStatusPick(null)}
          title={`Set status → ${statusPick.status.replace("_", " ")}`}
          sub={statusPick.status === "HIRED" ? "Filled count increments; requisition auto-closes when full." : "Manual status changes always require a reason."}
          context={[["Candidate", cand?.fullName || ""], ["Current", `${statusPick.app.status} @ ${PHASES[statusPick.app.phase].name}`], ["Allowed here", (PHASE_STATUSES[statusPick.app.phase] || []).join(", ")]]}
          quick={statusPick.status === "FAILED" ? ["Below bar for this level", "Salary gap too large", "Failed assessment"] : statusPick.status === "WITHDRAWN" ? ["Candidate withdrew via WhatsApp", "Accepted another offer"] : ["Kept as backup", "Revisit for future role"]}
          tone={["FAILED", "WITHDRAWN", "NO_SHOW"].includes(statusPick.status) ? "danger" : "solid"}
          confirmLabel="Apply & log"
          onConfirm={(r) => setAppStatus(statusPick.app.id, statusPick.status, r)} />
      )}
      {transferApp && <TransferModal app={transferApp} onClose={() => setTransferApp(null)} />}
      {waApp && <WhatsAppModal app={waApp} onClose={() => setWaApp(null)} />}
      {cvView && (
        <Modal open onClose={() => setCvView(null)} title={`CV — ${cvView.fullName}`} sub="Served through the Apps Script file route · access logged" wide>
          <div className="rounded-xl bg-pine-900 text-paper/80 p-6 min-h-[320px] grid place-items-center">
            <div className="text-center">
              <Icon name="file" size={40} className="mx-auto text-hono-400 mb-3" />
              <div className="font-mono text-xs text-moss-200 mb-1">{cvView.cvFileName}</div>
              <div className="text-[11px] text-paper/50 max-w-sm">Secure preview placeholder — in production this streams the PDF from the private Drive folder via an authorized endpoint. This view event was appended to the AuditLog.</div>
              <div className="mt-3"><span className="font-mono text-[10px] bg-white/10 rounded px-2 py-1">{cvView.cvFileId} · ATS/Clients/…/CVs/</span></div>
            </div>
          </div>
        </Modal>
      )}
    </Drawer>
  );
}

/* ================= Candidates list ================= */
export function Candidates() {
  const { db, role, currentUserId } = useStore();
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fReq, setFReq] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const me = db.users.find((u) => u.id === currentUserId);
  const rows = useMemo(() => {
    return db.applications
      .filter((a) => a.active || a.status === "HIRED")
      .map((a) => ({ a, c: db.candidates.find((c) => c.id === a.candidateId)!, r: db.requisitions.find((r) => r.id === a.requisitionId)! }))
      .filter((x) => x.c && x.r)
      .filter((x) => {
        if (role === "CLIENT_HIRING" && !me?.requisitionIds?.includes(x.r.id)) return false;
        if (q && !(x.c.fullName.toLowerCase().includes(q.toLowerCase()) || x.c.code.toLowerCase().includes(q.toLowerCase()) || normPhone(x.c.phone).includes(normPhone(q)))) return false;
        if (fStatus && x.a.status !== fStatus) return false;
        if (fReq && x.a.requisitionId !== fReq) return false;
        return true;
      })
      .sort((x, y) => y.a.lastInteractionAt.localeCompare(x.a.lastInteractionAt));
  }, [db, q, fStatus, fReq, role, me]);

  return (
    <div className="anim-rise">
      <SectionTitle icon="users" title="Candidates" sub={`${rows.length} records · duplicate control by normalized phone · CVs in private Drive`}
        right={<Btn onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> Add candidate</Btn>} />

      <div className="bg-card border border-ink-900/8 rounded-xl overflow-hidden">
        <div className="px-3.5 py-3 border-b border-ink-900/6 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input className={`${inputCls} pl-9`} placeholder="Search name, code or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={`${inputCls} w-auto`} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">All statuses</option>
            {["ACTIVE", "RESERVED", "FAILED", "WITHDRAWN", "NO_RESPONSE", "NO_SHOW", "TALENT_POOL", "HIRED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select className={`${inputCls} w-auto`} value={fReq} onChange={(e) => setFReq(e.target.value)}>
            <option value="">All requisitions</option>
            {db.requisitions.map((r) => <option key={r.id} value={r.id}>{r.positionName}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-400 border-b border-ink-900/6">
                <th className="px-4 py-2.5 font-bold">Candidate</th>
                <th className="px-3 py-2.5 font-bold">Requisition</th>
                <th className="px-3 py-2.5 font-bold">Phase</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Form</th>
                <th className="px-3 py-2.5 font-bold">Last touch</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, c, r }) => (
                <tr key={a.id} onClick={() => setOpen(c.id)} className="border-b border-ink-900/4 hover:bg-moss-50/70 cursor-pointer transition-colors group">
                  <td className="px-4 py-2.5">
                    <div className="font-bold text-ink-900 text-[13px]">{c.fullName}</div>
                    <div className="font-mono text-[9.5px] text-ink-400">{c.code} · {c.phone}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-ink-700">{r.positionName}</div>
                    <div className="text-[10px] text-ink-400">{db.clients.find((x) => x.id === r.clientId)?.companyName}</div>
                  </td>
                  <td className="px-3 py-2.5"><PhaseChip code={a.phase} small /></td>
                  <td className="px-3 py-2.5"><StatusPill s={a.status} small /></td>
                  <td className="px-3 py-2.5">
                    {a.questionnaireStatus === "SUBMITTED"
                      ? <span className="text-moss-600 flex items-center gap-1 font-semibold"><Icon name="check" size={11} /> done</span>
                      : <span className="text-hono-600 flex items-center gap-1 font-semibold"><Icon name="clock" size={11} /> pending</span>}
                  </td>
                  <td className="px-3 py-2.5 text-ink-500">{timeAgo(a.lastInteractionAt)}</td>
                  <td className="px-3 py-2.5 text-right"><span className="opacity-0 group-hover:opacity-100 transition-opacity text-moss-700 font-bold text-[11px] inline-flex items-center gap-1">Open <Icon name="chevR" size={11} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty icon="users" title="No candidates match" sub="Adjust filters or add a candidate." />}
        </div>
      </div>

      {addOpen && <AddCandidateModal onClose={() => setAddOpen(false)} onOpenCandidate={(id) => setOpen(id)} />}
      <CandidateDrawer candidateId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
