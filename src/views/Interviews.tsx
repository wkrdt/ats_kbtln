import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { PHASES, fmtDateLong, waLink, fmtDate } from "../lib/data";
import type { PhaseCode, Interview } from "../lib/data";
import { Icon, Btn, PhaseChip, ReasonModal, Modal, Field, inputCls, Empty, SectionTitle, Mono, CopyBtn } from "../components/ui";

const EVAL_CRITERIA = ["Composure", "Communication", "Confidence", "Accuracy", "Clarity", "Relevance", "Problem-solving", "Professionalism", "Motivation", "Cultural fit", "Overall suitability"];
const INTERVIEW_PHASES: PhaseCode[] = ["SCREENING_INTERVIEW", "PSIKOTEST", "TECHNICAL_SKILL_ASSESSMENT", "ADDITIONAL_INTERVIEW", "USER_INTERVIEW"];

function SlotForm() {
  const { db, createSlot, toast } = useStore();
  const openReqs = db.requisitions.filter((r) => r.status === "OPEN");
  const [f, setF] = useState({ requisitionId: openReqs[0]?.id || "", phase: "SCREENING_INTERVIEW" as PhaseCode, date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), start: "09:00", duration: 45, interviewerId: db.users.find((u) => u.role === "CONSULTANT")?.id || "USER-001", capacity: 2 });
  const [conflict, setConflict] = useState<string | null>(null);

  const submit = (force = false) => {
    const res = createSlot(f, force);
    if (!res.ok && res.conflict) { setConflict(res.conflict); return; }
    setConflict(null);
    toast("Slot published — candidates can now self-select it", "info");
  };

  return (
    <div className="bg-card border border-ink-900/8 rounded-xl p-4">
      <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2 mb-3"><Icon name="plus" size={14} className="text-moss-600" /> Publish interview slots</h4>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Requisition" req>
          <select className={inputCls} value={f.requisitionId} onChange={(e) => setF({ ...f, requisitionId: e.target.value })}>
            {openReqs.map((r) => <option key={r.id} value={r.id}>{r.positionName}</option>)}
          </select>
        </Field>
        <Field label="Phase" req>
          <select className={inputCls} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value as PhaseCode })}>
            {INTERVIEW_PHASES.map((p) => <option key={p} value={p}>{PHASES[p].name}</option>)}
          </select>
        </Field>
        <Field label="Interviewer" req>
          <select className={inputCls} value={f.interviewerId} onChange={(e) => setF({ ...f, interviewerId: e.target.value })}>
            {db.users.filter((u) => u.role === "CONSULTANT" || u.role === "CLIENT_HIRING").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Date (WIB)" req><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Start"><input type="time" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="Duration (min)">
          <select className={inputCls} value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) })}>
            {[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </Field>
        <Field label="Max capacity"><input type="number" min={1} max={6} className={inputCls} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Math.min(6, Math.max(1, Number(e.target.value))) })} /></Field>
      </div>
      {conflict && (
        <div className="mt-3 rounded-lg bg-rust-100 border border-rust-400/40 px-3 py-2.5 text-xs text-rust-800 anim-rise">
          <div className="font-bold flex items-center gap-1.5 mb-1"><Icon name="alert" size={13} /> Interviewer conflict detected</div>
          {conflict}
          <div className="mt-2 flex gap-2">
            <Btn size="xs" tone="dangerSoft" onClick={() => submit(true)}>Create anyway (audited)</Btn>
            <Btn size="xs" tone="ghost" onClick={() => setConflict(null)}>Dismiss</Btn>
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-ink-400 flex items-center gap-1.5"><Icon name="video" size={11} /> Google Meet link auto-generated via Calendar API · manual fallback available on API failure.</p>
        <Btn onClick={() => submit()}><Icon name="calendar" size={13} /> Create slot</Btn>
      </div>
    </div>
  );
}

function EvalModal({ itv, onClose }: { itv: Interview; onClose: () => void }) {
  const { db, evaluateInterview } = useStore();
  const app = db.applications.find((a) => a.id === itv.applicationId);
  const cand = db.candidates.find((c) => c.id === app?.candidateId);
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries(EVAL_CRITERIA.map((c) => [c, 3])));
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [decision, setDecision] = useState<"MOVE_FORWARD" | "FAILED">("MOVE_FORWARD");
  const [reason, setReason] = useState("");
  const rating = Math.round((Object.values(scores).reduce((s, v) => s + v, 0) / EVAL_CRITERIA.length) * 10) / 10;
  const needReason = decision === "FAILED" ? reason.trim().length < 4 : true;

  return (
    <Modal open onClose={onClose} title={`Evaluate — ${cand?.fullName}`} sub={`${PHASES[itv.phase].name} · ${fmtDate(itv.date)} ${itv.start} WIB`} wide
      footer={<>
        <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!needReason} tone={decision === "FAILED" ? "danger" : "solid"}
          onClick={() => { evaluateInterview(itv.id, { scores, rating, strengths, concerns, decision, decisionReason: decision === "FAILED" ? reason.trim() : (reason.trim() || "Meets bar — progressed") }, decision === "FAILED" ? reason.trim() : (reason.trim() || "Meets bar — progressed")); onClose(); }}>
          <Icon name="check" size={13} /> Save evaluation & apply decision
        </Btn>
      </>}>
      <div className="grid lg:grid-cols-[1fr_240px] gap-5">
        <div>
          <div className="space-y-2">
            {EVAL_CRITERIA.map((c) => (
              <div key={c} className="flex items-center gap-3">
                <span className="w-36 text-[11.5px] font-semibold text-ink-600 shrink-0">{c}</span>
                <input type="range" min={1} max={5} value={scores[c]} onChange={(e) => setScores({ ...scores, [c]: Number(e.target.value) })} className="flex-1 accent-[#17573c]" />
                <span className={`w-6 text-center font-mono text-xs font-bold rounded ${scores[c] >= 4 ? "text-moss-700 bg-moss-100" : scores[c] <= 2 ? "text-rust-600 bg-rust-100" : "text-hono-600 bg-hono-100"}`}>{scores[c]}</span>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <Field label="Strengths"><textarea className={`${inputCls} resize-none`} rows={3} value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Observed strengths…" /></Field>
            <Field label="Concerns"><textarea className={`${inputCls} resize-none`} rows={3} value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Risks / gaps…" /></Field>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-pine-900 text-paper px-4 py-3.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-paper/50">Weighted rating</div>
            <div className="font-display font-extrabold text-4xl text-hono-400 tabular-nums">{rating}</div>
            <div className="text-[10px] text-paper/50 font-mono">of 5 · stored as StructuredScoresJSON</div>
          </div>
          <div className="space-y-1.5">
            <button onClick={() => setDecision("MOVE_FORWARD")} className={`w-full text-left rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${decision === "MOVE_FORWARD" ? "border-moss-600 bg-moss-50 text-moss-800" : "border-ink-900/10 bg-card text-ink-500"}`}>
              <span className="flex items-center gap-1.5"><Icon name="arrowR" size={12} /> Move forward</span>
              <span className="block text-[10px] font-normal opacity-70 mt-0.5">Advance to the next configured phase</span>
            </button>
            <button onClick={() => setDecision("FAILED")} className={`w-full text-left rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${decision === "FAILED" ? "border-rust-500 bg-rust-100 text-rust-800" : "border-ink-900/10 bg-card text-ink-500"}`}>
              <span className="flex items-center gap-1.5"><Icon name="x" size={12} /> Fail candidate</span>
              <span className="block text-[10px] font-normal opacity-70 mt-0.5">Status → FAILED, reason required</span>
            </button>
          </div>
          {decision === "FAILED" && (
            <Field label="Failure reason" req><textarea className={`${inputCls} resize-none`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Written to AuditLog…" /></Field>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function Interviews() {
  const { db, cancelSlot, markInterviewNoShow } = useStore();
  const [evalItv, setEvalItv] = useState<Interview | null>(null);
  const [cancelPick, setCancelPick] = useState<string | null>(null);
  const [noShowPick, setNoShowPick] = useState<Interview | null>(null);

  const upcoming = useMemo(() => db.interviews.filter((i) => i.status === "SCHEDULED").sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), [db.interviews]);
  const conflicts = useMemo(() => {
    const out: { a: typeof db.slots[0]; b: typeof db.slots[0] }[] = [];
    const act = db.slots.filter((s) => s.status !== "CANCELLED");
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const x = act[i], y = act[j];
      if (x.date === y.date && x.interviewerId === y.interviewerId && x.start < y.end && y.start < x.end) out.push({ a: x, b: y });
    }
    return out;
  }, [db.slots]);

  const slotsByDate = useMemo(() => {
    const m = new Map<string, typeof db.slots>();
    [...db.slots].filter((s) => s.status !== "CANCELLED").sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).forEach((s) => {
      const arr = m.get(s.date) || [];
      arr.push(s);
      m.set(s.date, arr);
    });
    return [...m.entries()];
  }, [db.slots]);

  const rescheduleMsg = (slotId: string) => {
    const itv = db.interviews.find((i) => i.slotId === slotId && i.status === "SCHEDULED");
    const cand = db.candidates.find((c) => c.id === db.applications.find((a) => a.id === itv?.applicationId)?.candidateId);
    return `Halo ${cand?.fullName || ""}, mohon maaf jadwal interview Anda harus kami geser karena bentrok dengan jadwal lain. Silakan pilih jadwal baru melalui link scheduler yang sama. Terima kasih atas pengertiannya.`;
  };

  return (
    <div className="anim-rise">
      <SectionTitle icon="video" title="Interviews & Scheduling" sub="Slots are race-safe (LockService re-check) · all online interviews run on Google Meet" />
      <div className="space-y-4">
        {conflicts.length > 0 && (
          <div className="rounded-xl border border-rust-400/40 bg-rust-100/70 p-4 anim-rise">
            <h4 className="font-display font-bold text-sm text-rust-800 flex items-center gap-2 mb-2"><Icon name="alert" size={15} /> {conflicts.length} interviewer conflict{conflicts.length > 1 ? "s" : ""} — action needed</h4>
            {conflicts.map(({ a, b }, i) => {
              const iv = db.users.find((u) => u.id === a.interviewerId);
              const affected = db.interviews.find((x) => x.slotId === b.id && x.status === "SCHEDULED");
              const cand = db.candidates.find((c) => c.id === db.applications.find((ap) => ap.id === affected?.applicationId)?.candidateId);
              const alt = db.slots.find((s) => s.status === "OPEN" && s.requisitionId === b.requisitionId && s.id !== b.id && !(s.date === a.date && s.interviewerId === a.interviewerId && s.start < a.end && a.start < s.end));
              return (
                <div key={i} className="bg-card rounded-lg border border-rust-400/30 px-3.5 py-3 mb-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <b className="text-ink-900">{iv?.name}</b>
                    <span className="text-ink-500">double-booked {fmtDate(a.date)} · {a.start}–{a.end} vs {b.start}–{b.end}</span>
                    <Mono>{a.id}</Mono><Mono>{b.id}</Mono>
                  </div>
                  <div className="mt-1.5 text-ink-600">
                    Affected candidate: <b>{cand?.fullName || "not yet reserved"}</b>
                    {alt && <> · alternative: <b>{fmtDate(alt.date)} {alt.start}</b> ({alt.capacity - alt.used} seat(s) left)</>}
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {cand && <a className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#1f8f5f] text-white rounded-md px-2.5 py-1.5 hover:bg-[#17714b] transition-colors" target="_blank" rel="noreferrer" href={waLink(db.candidates.find((c) => c.id === cand.id)?.phone || "", rescheduleMsg(b.id))}><Icon name="chat" size={11} /> WhatsApp reschedule</a>}
                    <Btn size="xs" tone="dangerSoft" onClick={() => setCancelPick(b.id)}><Icon name="x" size={11} /> Cancel {b.id}</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <SlotForm />

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {/* slots */}
          <div className="bg-card border border-ink-900/8 rounded-xl p-4">
            <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2 mb-3"><Icon name="calendar" size={14} className="text-moss-600" /> Published slots</h4>
            <div className="space-y-3">
              {slotsByDate.map(([date, slots]) => (
                <div key={date}>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">{fmtDateLong(date)}</div>
                  <div className="space-y-1.5">
                    {slots.map((s) => {
                      const req = db.requisitions.find((r) => r.id === s.requisitionId);
                      const iv = db.users.find((u) => u.id === s.interviewerId);
                      const pct = (s.used / s.capacity) * 100;
                      return (
                        <div key={s.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${s.status === "FULL" ? "border-ink-900/6 bg-paper-deep/50 opacity-60" : "border-ink-900/8 bg-paper hover:border-moss-300"} transition-colors`}>
                          <span className="font-mono font-bold text-ink-800 tabular-nums w-24 shrink-0">{s.start}–{s.end}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-ink-800 truncate">{req?.positionName} · <span className="text-ink-400 font-normal">{PHASES[s.phase].name}</span></div>
                            <div className="text-[10px] text-ink-400 truncate">{iv?.name} · <span className="font-mono">{s.meetLink.replace("https://", "")}</span></div>
                          </div>
                          <div className="w-16 shrink-0">
                            <div className="h-1.5 rounded-full bg-ink-900/8 overflow-hidden"><div className={`h-full transition-all duration-500 ${pct >= 100 ? "bg-rust-400" : "bg-moss-500"}`} style={{ width: `${pct}%` }} /></div>
                            <div className="text-[9.5px] font-mono text-ink-400 text-right mt-0.5">{s.used}/{s.capacity}</div>
                          </div>
                          {s.status === "FULL" ? <span className="text-[9px] font-bold uppercase text-rust-500 bg-rust-100 rounded-full px-2 py-0.5 shrink-0">Full</span>
                            : <button onClick={() => setCancelPick(s.id)} className="text-ink-300 hover:text-rust-500 transition-colors cursor-pointer shrink-0" title="Cancel slot"><Icon name="x" size={13} /></button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {slotsByDate.length === 0 && <Empty icon="calendar" title="No slots published" />}
            </div>
          </div>

          {/* upcoming interviews */}
          <div className="bg-card border border-ink-900/8 rounded-xl p-4">
            <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2 mb-3"><Icon name="users" size={14} className="text-moss-600" /> Upcoming interviews</h4>
            <div className="space-y-1.5">
              {upcoming.map((i) => {
                const app = db.applications.find((a) => a.id === i.applicationId);
                const cand = db.candidates.find((c) => c.id === app?.candidateId);
                const req = db.requisitions.find((r) => r.id === app?.requisitionId);
                const iv = db.users.find((u) => u.id === i.interviewerId);
                return (
                  <div key={i.id} className="rounded-lg border border-ink-900/8 bg-paper px-3 py-2.5 text-xs hover:border-moss-300 transition-colors">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <b className="text-ink-900 text-[13px]">{cand?.fullName}</b>
                        <span className="text-ink-400"> · {req?.positionName}</span>
                      </div>
                      <PhaseChip code={i.phase} small />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[10.5px] text-ink-500 flex-wrap">
                      <span className="flex items-center gap-1"><Icon name="clock" size={10} /> {fmtDate(i.date)} · {i.start} WIB</span>
                      <span className="flex items-center gap-1"><Icon name="user" size={10} /> {iv?.name}</span>
                      <a href={i.meetLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-river-600 font-semibold hover:underline"><Icon name="video" size={10} /> Meet</a>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Btn size="xs" onClick={() => setEvalItv(i)}><Icon name="check" size={11} /> Evaluate</Btn>
                      <Btn size="xs" tone="dangerSoft" onClick={() => setNoShowPick(i)}><Icon name="x" size={11} /> No-show</Btn>
                    </div>
                  </div>
                );
              })}
              {upcoming.length === 0 && <Empty icon="video" title="Nothing scheduled" sub="Publish slots and let candidates self-select." />}
            </div>
          </div>
        </div>
      </div>

      {evalItv && <EvalModal itv={evalItv} onClose={() => setEvalItv(null)} />}
      <ReasonModal open={!!cancelPick} onClose={() => setCancelPick(null)} title="Cancel slot"
        sub="Reserved candidates are flagged for rescheduling with a pre-filled WhatsApp message."
        context={cancelPick ? [["Slot", cancelPick], ["Effect", "Status → CANCELLED · audited"]] : []}
        quick={["Interviewer unavailable", "Client rescheduled", "Merged with another slot"]}
        tone="danger" confirmLabel="Cancel slot"
        onConfirm={(r) => cancelPick && cancelSlot(cancelPick, r)} />
      <ReasonModal open={!!noShowPick} onClose={() => setNoShowPick(null)} title="Mark no-show"
        sub="Candidate status becomes NO_SHOW and the 2-year eligibility cooldown starts."
        context={noShowPick ? [["Interview", noShowPick.id], ["Candidate", db.candidates.find((c) => c.id === db.applications.find((a) => a.id === noShowPick.applicationId)?.candidateId)?.fullName || ""]] : []}
        quick={["Did not join after 15 minutes", "No reply to reminders"]}
        tone="danger" confirmLabel="Mark NO_SHOW"
        onConfirm={(r) => noShowPick && markInterviewNoShow(noShowPick.id, r)} />
    </div>
  );
}
