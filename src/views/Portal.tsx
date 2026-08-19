import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { PHASES, fmtDateLong, fmtDT, normPhone, waLink, hoursSince } from "../lib/data";
import type { Application } from "../lib/data";
import { Icon, Btn, Modal, Field, inputCls, ToastHost } from "../components/ui";

type Mode = { k: "home" } | { k: "invite"; token: string } | { k: "status" } | { k: "closed"; position: string };

const SECTIONS: { title: string; desc?: string; fields: { k: string; label: string; type: "text" | "textarea" | "date" | "select" | "check"; options?: string[]; req?: boolean; span2?: boolean }[] }[] = [
  { title: "1 · Personal Information", fields: [
    { k: "fullName", label: "Full name", type: "text", req: true }, { k: "phone", label: "Phone (WhatsApp)", type: "text", req: true },
    { k: "email", label: "Email", type: "text", req: true }, { k: "dob", label: "Date of birth", type: "date" },
    { k: "gender", label: "Gender", type: "select", options: ["Female", "Male", "Prefer not to say"] }, { k: "city", label: "Current city", type: "text" },
    { k: "address", label: "Address", type: "text", span2: true },
  ]},
  { title: "2 · Interview Questions", fields: [
    { k: "selfIntro", label: "Briefly introduce yourself", type: "textarea", req: true, span2: true },
    { k: "whyApply", label: "Why are you interested in this position?", type: "textarea", span2: true },
    { k: "strengths", label: "Key strengths & development areas", type: "textarea", span2: true },
  ]},
  { title: "3 · Job History", fields: [
    { k: "currentCompany", label: "Current company", type: "text" }, { k: "currentTitle", label: "Current title", type: "text" },
    { k: "yearsExp", label: "Years of experience", type: "text" }, { k: "prevHistory", label: "Previous roles (short list)", type: "textarea", span2: true },
  ]},
  { title: "4 · Job Compatibility", fields: [
    { k: "willingLocation", label: "Willing to work at the required location?", type: "select", options: ["Yes", "Negotiable", "No"] },
    { k: "willingArrangement", label: "Comfortable with the work arrangement?", type: "select", options: ["Yes", "Negotiable", "No"] },
    { k: "willingTravel", label: "Open to business travel if needed?", type: "select", options: ["Yes", "Occasionally", "No"] },
  ]},
  { title: "5 · Compensation & Availability", fields: [
    { k: "currentSalary", label: "Current salary (jt IDR / month)", type: "text" },
    { k: "expectedSalary", label: "Expected salary (jt IDR / month)", type: "text", req: true },
    { k: "noticePeriod", label: "Notice period", type: "select", options: ["Immediately", "2 weeks", "1 month", "2 months", "3 months"] },
    { k: "earliestJoin", label: "Earliest join date", type: "date" },
  ]},
  { title: "6 · Assessment & Verification Consent", desc: "Required before we can run assessments or checks.", fields: [
    { k: "consentPsychometric", label: "I consent to a psychometric test if required", type: "check", req: true },
    { k: "consentReference", label: "I consent to reference checks", type: "check", req: true },
    { k: "consentBackground", label: "I consent to a background check if required", type: "check", req: true },
    { k: "consentMCU", label: "I consent to a medical check-up if required", type: "check" },
  ]},
  { title: "7 · Education", fields: [
    { k: "educationLevel", label: "Highest education", type: "select", options: ["High school", "Diploma", "Bachelor", "Master", "Doctorate"] },
    { k: "educationInstitution", label: "Institution", type: "text" },
    { k: "major", label: "Major", type: "text" }, { k: "gpa", label: "GPA (optional)", type: "text" },
    { k: "certifications", label: "Certifications", type: "textarea", span2: true },
  ]},
  { title: "8 · CV Upload", desc: "PDF only, maximum 5 MB — validated server-side.", fields: [] },
  { title: "9 · Candidate Questions", fields: [
    { k: "questionsForEmployer", label: "Anything you'd like to ask the employer?", type: "textarea", span2: true },
  ]},
];

/* Answers already stored in QuestionnaireResponses (server) — used when rendering the printable version of a submitted form. */
const PREFILL: Record<string, Record<string, string>> = {
  CND_001: {
    fullName: "Sari Dewanti", phone: "0812-1111-2222", email: "sari.dewanti@gmail.com", dob: "1996-04-12", gender: "Female", city: "Jakarta",
    address: "Kebayoran Baru, Jakarta Selatan",
    selfIntro: "Backend engineer with 6 years in payment systems at Tokopedia; led the gRPC migration of the checkout service and mentor two mid-level engineers.",
    whyApply: "I want to own core payment-gateway services at product scale and grow into a tech-lead track.",
    strengths: "Deep Go/PostgreSQL experience; calm incident commander; strong API design instincts. Development area: public speaking.",
    currentCompany: "Tokopedia", currentTitle: "Backend Engineer", yearsExp: "6",
    prevHistory: "Traveloka — Software Engineer (2019–2022) · Bukalapak — Engineering Intern (2018)",
    willingLocation: "Yes", willingArrangement: "Yes", willingTravel: "Occasionally",
    currentSalary: "22", expectedSalary: "26", noticePeriod: "1 month",
    consentPsychometric: "Yes", consentReference: "Yes", consentBackground: "Yes", consentMCU: "Yes",
    educationLevel: "Bachelor", educationInstitution: "Universitas Indonesia", major: "Computer Science", gpa: "3.71",
    certifications: "AWS Solutions Architect Associate",
    questionsForEmployer: "How is the on-call rotation structured for the gateway team?",
  },
};

export function Portal() {
  const { db, setRole } = useStore();
  const [mode, setMode] = useState<Mode>({ k: "home" });
  const [tokenInput, setTokenInput] = useState("");

  const openInvite = (token: string) => {
    const t = db.tokens.find((x) => x.token.toLowerCase() === token.trim().toLowerCase());
    if (!t) { setMode({ k: "closed", position: "" }); return; }
    const app = db.applications.find((a) => a.id === t.applicationId);
    const req = db.requisitions.find((r) => r.id === app?.requisitionId);
    if (!app || !req || req.status === "CLOSED" || req.status === "CANCELLED") setMode({ k: "closed", position: req?.positionName || "" });
    else setMode({ k: "invite", token: t.token });
  };

  return (
    <div className="min-h-screen bg-workspace print:hidden">
      <header className="bg-shell text-paper sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => setMode({ k: "home" })} className="flex items-center gap-2.5 cursor-pointer">
            <span className="w-8 h-8 rounded-lg bg-hono-400 text-pine-950 grid place-items-center"><Icon name="foot" size={17} sw={0} className="fill-current" /></span>
            <span className="text-left">
              <span className="font-display font-extrabold text-[15px] leading-none block">Tapak Karir</span>
              <span className="text-[9px] font-mono text-moss-300 uppercase tracking-[0.14em]">candidate portal</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setMode({ k: "status" })} className={`text-[11px] font-bold rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${mode.k === "status" ? "bg-hono-400 text-pine-950" : "text-paper/70 hover:text-paper hover:bg-white/8"}`}>Check my status</button>
            <button onClick={() => setRole("CONSULTANT")} className="text-[11px] font-bold rounded-lg px-3 py-1.5 text-paper/70 hover:text-paper hover:bg-white/8 transition-colors cursor-pointer border border-white/15">← Back to workspace</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {mode.k === "home" && <Home tokens={db.tokens} onOpen={openInvite} tokenInput={tokenInput} setTokenInput={setTokenInput} onStatus={() => setMode({ k: "status" })} />}
        {mode.k === "invite" && <InviteFlow token={mode.token} />}
        {mode.k === "status" && <StatusCheck />}
        {mode.k === "closed" && <ClosedPage position={mode.position} />}
      </main>
      <footer className="max-w-4xl mx-auto px-4 pb-8 text-[10.5px] text-ink-400">
        Your data is processed only for this recruitment · access is token-scoped and expires · questions? Reply to the WhatsApp message you received.
      </footer>
      <ToastHost />
    </div>
  );
}

/* ---------------- home ---------------- */
function Home({ tokens, onOpen, tokenInput, setTokenInput, onStatus }: { tokens: { token: string; applicationId: string }[]; onOpen: (t: string) => void; tokenInput: string; setTokenInput: (s: string) => void; onStatus: () => void }) {
  const { db } = useStore();
  return (
    <div className="anim-rise">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-moss-700 bg-moss-100 rounded-full px-3 py-1.5 mb-4">
          <Icon name="lock" size={11} /> Secure candidate access — no account needed
        </div>
        <h1 className="font-display font-extrabold text-3xl sm:text-[42px] leading-[1.05] text-ink-900">
          Your recruitment,<br />in your own hands.
        </h1>
        <p className="text-sm text-ink-500 mt-3 leading-relaxed max-w-lg">
          Pick an interview slot, complete the preliminary questionnaire, track your status and manage your participation — all from the link your consultant sent via WhatsApp.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        <div className="bg-card border border-ink-900/8 rounded-xl p-5">
          <h3 className="font-display font-bold text-ink-900 flex items-center gap-2"><Icon name="send" size={15} className="text-moss-600" /> Open my invitation</h3>
          <p className="text-[11.5px] text-ink-500 mt-1 mb-3">Paste the token from your WhatsApp invitation link.</p>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="TKN-XXXX-0000" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
            <Btn onClick={() => tokenInput && onOpen(tokenInput)}><Icon name="arrowR" size={14} /></Btn>
          </div>
          <div className="mt-4 pt-3 border-t border-dashed border-ink-900/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">Demo invitations</div>
            <div className="space-y-1.5">
              {tokens.map((t) => {
                const app = db.applications.find((a) => a.id === t.applicationId);
                const cand = db.candidates.find((c) => c.id === app?.candidateId);
                const req = db.requisitions.find((r) => r.id === app?.requisitionId);
                const closed = req?.status === "CLOSED" || req?.status === "CANCELLED";
                return (
                  <button key={t.token} onClick={() => onOpen(t.token)}
                    className="w-full text-left flex items-center gap-2.5 rounded-lg border border-ink-900/8 bg-paper px-3 py-2 hover:border-moss-400 hover:-translate-y-px transition-all cursor-pointer">
                    <span className={`w-7 h-7 rounded-lg grid place-items-center ${closed ? "bg-rust-100 text-rust-500" : "bg-moss-100 text-moss-700"}`}><Icon name={closed ? "lock" : "mail"} size={13} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-ink-800 truncate">{cand?.fullName} — {req?.positionName || "position"}</span>
                      <span className="font-mono text-[9.5px] text-ink-400">{t.token}{closed ? " · requisition closed" : app?.slotId ? " · interview scheduled" : " · slot + questionnaire pending"}</span>
                    </span>
                    <Icon name="chevR" size={13} className="text-ink-300" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-pine-900 text-paper rounded-xl p-5">
            <h3 className="font-display font-bold text-hono-300 flex items-center gap-2"><Icon name="search" size={15} /> Track an application</h3>
            <p className="text-[11.5px] text-paper/60 mt-1 mb-3">Use your Candidate Code + registered phone. A one-time password is sent to your email.</p>
            <Btn tone="amber" onClick={onStatus}><Icon name="arrowR" size={13} /> Check status</Btn>
          </div>
          <div className="bg-card border border-ink-900/8 rounded-xl p-5">
            <h3 className="font-display font-bold text-sm text-ink-900 mb-2.5">How it works</h3>
            {[["chat", "Receive a WhatsApp invitation with a private link"], ["calendar", "Pick an interview slot — first come, first served"], ["file", "Complete the questionnaire (drafts save automatically)"], ["video", "Join your Google Meet interview on time"]].map(([ic, txt], i) => (
              <div key={i} className="flex items-start gap-2.5 py-1.5 text-[11.5px] text-ink-600">
                <span className="w-6 h-6 rounded-md bg-moss-100 text-moss-700 grid place-items-center shrink-0 mt-[-2px]"><Icon name={ic} size={12} /></span>{txt}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- invite flow ---------------- */
function InviteFlow({ token }: { token: string }) {
  const { db, selectSlot, submitQuestionnaire, requestWithdrawal } = useStore();
  const tk = db.tokens.find((t) => t.token === token)!;
  const app = db.applications.find((a) => a.id === tk.applicationId);
  const req = db.requisitions.find((r) => r.id === app?.requisitionId);
  const cand = db.candidates.find((c) => c.id === app?.candidateId);
  const client = db.clients.find((c) => c.id === req?.clientId);
  const consultant = db.users.find((u) => u.role === "CONSULTANT");

  const [slotMsg, setSlotMsg] = useState<string | null>(null);
  const [confirmSlot, setConfirmSlot] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cvName, setCvName] = useState("");
  const [cvErr, setCvErr] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wReason, setWReason] = useState("");
  const [wMsg, setWMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftKey = `tapak-draft-${token}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) { const d = JSON.parse(raw); setAnswers(d.answers || {}); setCvName(d.cvName || ""); setSavedAt(d.savedAt || null); }
    } catch { /* noop */ }
  }, [draftKey]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const at = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      localStorage.setItem(draftKey, JSON.stringify({ answers, cvName, savedAt: at }));
      if (Object.keys(answers).length > 0) setSavedAt(at);
    }, 500);
    return () => window.clearTimeout(t);
  }, [answers, cvName, draftKey]);

  if (!app || !req || !cand) return null;
  const slots = db.slots.filter((s) => s.requisitionId === req.id && s.status !== "CANCELLED" && s.phase === "SCREENING_INTERVIEW").sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const myInterview = db.interviews.find((i) => i.applicationId === app.id && i.status === "SCHEDULED");
  const submitted = app.questionnaireStatus === "SUBMITTED";
  const step = myInterview ? (submitted ? 3 : 2) : 1;

  const doSubmit = () => {
    const missing = SECTIONS.flatMap((s) => s.fields).filter((f) => f.req && !(f.type === "check" ? answers[f.k] === "Yes" : (answers[f.k] || "").trim()));
    if (!cvName) { setSlotMsg("Please attach your CV (PDF, ≤ 5 MB) in section 8."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (missing.length > 0) { setSlotMsg(`Please complete: ${missing.map((m) => m.label).join(", ")}`); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSlotMsg(null);
    localStorage.removeItem(draftKey);
    submitQuestionnaire(app.id, { ...answers, cvName });
  };

  const doWithdraw = () => {
    const msg = requestWithdrawal(app.id, wReason.trim());
    setWMsg(msg);
  };

  return (
    <div className="anim-rise">
      {/* greeting */}
      <div className="bg-pine-900 text-paper rounded-xl p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-10 w-44 h-44 rounded-full bg-hono-400/10" />
        <div className="absolute right-16 -bottom-14 w-36 h-36 rounded-full bg-moss-500/10" />
        <div className="relative">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-moss-300 mb-2">Undangan interview · {req.id}</div>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl">Halo, {cand.fullName.split(" ")[0]} 👋</h2>
          <p className="text-sm text-paper/70 mt-2 max-w-lg">You've been shortlisted for <b className="text-hono-300">{req.positionName}</b> at <b className="text-hono-300">{client?.companyName}</b>. {consultant?.name} invites you to choose an interview schedule and complete the preliminary questionnaire.</p>
          <div className="mt-4 flex gap-2 flex-wrap text-[10.5px]">
            <span className="bg-white/10 rounded-full px-2.5 py-1 font-mono">{cand.code}</span>
            <span className="bg-white/10 rounded-full px-2.5 py-1">{req.workLocation} · {req.workArrangement}</span>
            <span className="bg-white/10 rounded-full px-2.5 py-1">Online — Google Meet</span>
          </div>
        </div>
      </div>

      {/* stepper */}
      <div className="flex items-center gap-2 my-5">
        {["Choose schedule", "Questionnaire", "Confirmed"].map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`w-6 h-6 rounded-full grid place-items-center text-[10.5px] font-bold shrink-0 ${step > i + 1 ? "bg-moss-600 text-white" : step === i + 1 ? "bg-hono-400 text-pine-950" : "bg-ink-900/8 text-ink-400"}`}>
              {step > i + 1 ? <Icon name="check" size={11} /> : i + 1}
            </span>
            <span className={`text-[11px] font-bold truncate ${step === i + 1 ? "text-ink-900" : "text-ink-400"}`}>{s}</span>
            {i < 2 && <span className="flex-1 h-px bg-ink-900/10" />}
          </div>
        ))}
      </div>

      {slotMsg && <div className="mb-4 rounded-lg bg-rust-100 border border-rust-400/40 px-3.5 py-2.5 text-xs text-rust-800 font-semibold anim-rise flex items-center gap-2"><Icon name="alert" size={13} /> {slotMsg}</div>}

      {/* STEP 1 — slots */}
      {step === 1 && (
        <div>
          <h3 className="font-display font-bold text-lg text-ink-900 mb-1">Pilih jadwal interview</h3>
          <p className="text-xs text-ink-500 mb-4">First come, first served — seats are re-checked under a lock when you confirm. All times in WIB.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {slots.map((s) => {
              const left = s.capacity - s.used;
              const full = left <= 0 || s.status === "FULL";
              const iv = db.users.find((u) => u.id === s.interviewerId);
              return (
                <button key={s.id} disabled={full} onClick={() => setConfirmSlot(s.id)}
                  className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${full ? "border-ink-900/6 bg-paper-deep/60 opacity-55 cursor-not-allowed" : "bg-card border-ink-900/10 hover:border-moss-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-moss-900/8"}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{fmtDateLong(s.date)}</div>
                  <div className="font-display font-extrabold text-2xl text-ink-900 mt-1 tabular-nums">{s.start}<span className="text-sm text-ink-400 font-body font-medium">–{s.end} WIB</span></div>
                  <div className="text-[10.5px] text-ink-500 mt-1.5 flex items-center gap-1"><Icon name="user" size={10} /> {iv?.name} · {PHASES[s.phase].name}</div>
                  <div className={`mt-2.5 text-[10px] font-bold rounded-full px-2 py-0.5 inline-block ${full ? "bg-rust-100 text-rust-500" : left === 1 ? "bg-hono-100 text-hono-600" : "bg-moss-100 text-moss-700"}`}>
                    {full ? "Penuh / full" : left === 1 ? "1 seat left" : `${left} seats left`}
                  </div>
                </button>
              );
            })}
            {slots.length === 0 && <div className="sm:col-span-3 text-xs text-ink-400 bg-card border border-ink-900/8 rounded-xl p-4">No slots published yet — the consultant will share new schedules soon.</div>}
          </div>
        </div>
      )}

      {/* STEP 2 — questionnaire */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-display font-bold text-lg text-ink-900">Preliminary questionnaire</h3>
              <p className="text-xs text-ink-500">Interview confirmed for <b>{myInterview && fmtDateLong(myInterview.date)} · {myInterview?.start} WIB</b>. Now tell us about yourself.</p>
            </div>
            <span className={`text-[10.5px] font-bold rounded-full px-2.5 py-1 flex items-center gap-1.5 ${savedAt ? "bg-moss-100 text-moss-700" : "bg-ink-900/5 text-ink-400"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current relative live-dot" /> {savedAt ? `Draft saved locally · ${savedAt}` : "Drafts auto-save in your browser"}
            </span>
          </div>
          <div className="space-y-4">
            {SECTIONS.map((sec) => (
              <section key={sec.title} className="bg-card border border-ink-900/8 rounded-xl p-5">
                <h4 className="font-display font-bold text-sm text-ink-900">{sec.title}</h4>
                {sec.desc && <p className="text-[11px] text-ink-400 mt-0.5">{sec.desc}</p>}
                {sec.title.startsWith("8") ? (
                  <div className="mt-3">
                    <button onClick={() => fileRef.current?.click()}
                      className={`w-full rounded-lg border-2 border-dashed px-3 py-4 text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 ${cvName ? "border-moss-400 bg-moss-50 text-moss-800 font-semibold" : cvErr ? "border-rust-400 text-rust-500 bg-rust-100/50" : "border-ink-900/15 text-ink-500 hover:border-moss-400"}`}>
                      <Icon name={cvName ? "check" : "file"} size={15} /> {cvName || cvErr || "Attach CV (PDF · max 5 MB)"}
                    </button>
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.type !== "application/pdf") { setCvErr("Only PDF files are accepted."); setCvName(""); return; }
                      if (f.size > 5 * 1024 * 1024) { setCvErr("File exceeds 5 MB."); setCvName(""); return; }
                      setCvErr(""); setCvName(f.name);
                    }} />
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3.5 mt-3.5">
                    {sec.fields.map((f) => (
                      <div key={f.k} className={f.span2 ? "sm:col-span-2" : ""}>
                        {f.type === "check" ? (
                          <label className="flex items-start gap-2.5 text-xs text-ink-700 bg-paper border border-ink-900/8 rounded-lg px-3 py-2.5 cursor-pointer hover:border-moss-400 transition-colors">
                            <input type="checkbox" checked={answers[f.k] === "Yes"} onChange={(e) => setAnswers({ ...answers, [f.k]: e.target.checked ? "Yes" : "" })} className="mt-0.5 accent-[#17573c]" />
                            <span>{f.label} {f.req && <span className="text-rust-500">*</span>}</span>
                          </label>
                        ) : (
                          <Field label={f.label} req={f.req}>
                            {f.type === "textarea"
                              ? <textarea className={`${inputCls} resize-none`} rows={3} value={answers[f.k] || ""} onChange={(e) => setAnswers({ ...answers, [f.k]: e.target.value })} />
                              : f.type === "select"
                                ? <select className={inputCls} value={answers[f.k] || ""} onChange={(e) => setAnswers({ ...answers, [f.k]: e.target.value })}><option value="">Select…</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>
                                : <input type={f.type === "date" ? "date" : "text"} className={inputCls} value={answers[f.k] || ""} onChange={(e) => setAnswers({ ...answers, [f.k]: e.target.value })} />}
                          </Field>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
          <div className="sticky bottom-3 mt-5 bg-pine-900 text-paper rounded-xl px-4 py-3 flex items-center justify-between gap-3 shadow-xl shadow-pine-950/20">
            <span className="text-[10.5px] text-paper/60">Submitting stores your answers as the official record — corrections afterwards go through the consultant.</span>
            <Btn tone="amber" onClick={doSubmit}><Icon name="check" size={13} /> Submit questionnaire</Btn>
          </div>
        </div>
      )}

      {/* STEP 3 — done */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-card border border-moss-300 rounded-xl p-6 text-center anim-rise">
            <div className="mx-auto w-12 h-12 rounded-full bg-moss-600 text-white grid place-items-center mb-3"><Icon name="check" size={22} /></div>
            <h3 className="font-display font-extrabold text-2xl text-ink-900">Semua sudah beres!</h3>
            <p className="text-xs text-ink-500 mt-1.5 max-w-md mx-auto">Your questionnaire is submitted and your interview is confirmed. Keep your candidate code safe — you'll need it to check your status.</p>
            <div className="inline-flex items-center gap-2 mt-4 bg-pine-900 text-hono-300 font-mono font-bold rounded-lg px-4 py-2 text-sm">{cand.code}</div>
          </div>
          {myInterview && (
            <div className="bg-card border border-ink-900/8 rounded-xl p-5">
              <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2 mb-3"><Icon name="video" size={14} className="text-moss-600" /> Your interview</h4>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-600">
                <span className="flex items-center gap-1.5"><Icon name="calendar" size={13} className="text-ink-400" /> {fmtDateLong(myInterview.date)}</span>
                <span className="flex items-center gap-1.5"><Icon name="clock" size={13} className="text-ink-400" /> {myInterview.start} WIB ({PHASES[myInterview.phase].name})</span>
                <a href={myInterview.meetLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-bold text-moss-700 hover:underline"><Icon name="video" size={13} /> Join Google Meet</a>
              </div>
              <div className="mt-3 rounded-lg bg-paper px-3 py-2.5 text-[11px] text-ink-500">
                <b className="text-ink-700">Recruitment instructions:</b> join 5 minutes early from a quiet place, prepare a stable connection, and have your KTP & latest CV nearby.
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn tone="outline" onClick={() => window.print()}><Icon name="printer" size={13} /> Print my questionnaire</Btn>
            <Btn tone="dangerSoft" onClick={() => setWithdrawOpen(true)}><Icon name="x" size={13} /> Withdraw from process</Btn>
          </div>
        </div>
      )}

      {/* printable questionnaire */}
      {submitted && (
        <div className="print-sheet hidden">
          <h1 style={{ fontFamily: "Bricolage Grotesque", fontSize: 22 }}>Questionnaire — {cand.fullName} ({cand.code})</h1>
          <p style={{ fontSize: 11, color: "#555" }}>{req.positionName} · {client?.companyName} · submitted {app.questionnaireSubmittedAt ? fmtDT(app.questionnaireSubmittedAt) : ""}</p>
          {SECTIONS.filter((s) => !s.title.startsWith("8")).map((sec) => (
            <div key={sec.title} style={{ marginTop: 12 }}>
              <h2 style={{ fontSize: 13, borderBottom: "1px solid #ccc", paddingBottom: 2 }}>{sec.title}</h2>
              {sec.fields.map((f) => (
                <p key={f.k} style={{ fontSize: 11, margin: "4px 0" }}><b>{f.label}:</b> {answers[f.k] || PREFILL[cand.id.replace("-", "_")]?.[f.k] || (f.type === "check" ? "No" : "—")}</p>
              ))}
            </div>
          ))}
          <p style={{ fontSize: 11, marginTop: 12 }}><b>8 · CV:</b> {cvName || cand.cvFileName}</p>
        </div>
      )}

      {/* slot confirm modal */}
      <Modal open={!!confirmSlot} onClose={() => setConfirmSlot(null)} title="Confirm this schedule?" sub="Availability is re-checked under a lock before reserving."
        footer={<>
          <Btn tone="ghost" onClick={() => setConfirmSlot(null)}>Pick another</Btn>
          <Btn onClick={() => {
            if (!confirmSlot) return;
            const res = selectSlot(app.id, confirmSlot);
            setConfirmSlot(null);
            if (!res.ok) setSlotMsg(res.msg);
          }}><Icon name="check" size={13} /> Reserve seat</Btn>
        </>}>
        {(() => {
          const s = db.slots.find((x) => x.id === confirmSlot);
          if (!s) return null;
          return (
            <div className="rounded-xl bg-pine-900 text-paper p-5 text-center">
              <div className="text-[10px] uppercase tracking-widest text-paper/50">{PHASES[s.phase].name} · online</div>
              <div className="font-display font-extrabold text-3xl text-hono-400 mt-1.5 tabular-nums">{s.start}–{s.end}</div>
              <div className="text-xs text-paper/70 mt-1">{fmtDateLong(s.date)} · WIB</div>
              <div className="text-[10.5px] font-mono mt-3 bg-white/10 rounded-full inline-block px-3 py-1">{Math.max(0, s.capacity - s.used)} of {s.capacity} seats remaining</div>
            </div>
          );
        })()}
      </Modal>

      {/* withdraw modal */}
      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Withdraw from this recruitment" sub="Your status changes only after the consultant confirms — sending the WhatsApp message is the first step."
        footer={wMsg ? <Btn onClick={() => setWithdrawOpen(false)}>Done</Btn> : <>
          <Btn tone="ghost" onClick={() => setWithdrawOpen(false)}>Cancel</Btn>
          <Btn tone="danger" disabled={wReason.trim().length < 4} onClick={doWithdraw}><Icon name="chat" size={13} /> Generate WhatsApp message</Btn>
        </>}>
        {!wMsg ? (
          <Field label="Reason" req><textarea className={`${inputCls} resize-none`} rows={3} value={wReason} onChange={(e) => setWReason(e.target.value)} placeholder="e.g. saya sudah menerima penawaran di tempat lain…" /></Field>
        ) : (
          <div>
            <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed bg-pine-900 text-moss-100 rounded-xl p-4">{wMsg}</pre>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href={waLink(db.config.CONSULTANT_WA || "", wMsg)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md text-[13px] px-3.5 py-2 font-semibold bg-[#1f8f5f] text-white hover:bg-[#17714b] transition-colors"><Icon name="chat" size={14} /> Send via WhatsApp</a>
              <span className="font-mono text-[10px] text-river-600 break-all">wa.me/{normPhone(db.config.CONSULTANT_WA || "")}</span>
            </div>
            <p className="text-[10.5px] text-ink-400 mt-2.5 flex items-start gap-1.5"><Icon name="alert" size={11} className="mt-0.5 shrink-0 text-hono-500" /> Sending the message does <b>not</b> automatically change your status — the consultant will confirm your withdrawal in the system.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- status check + OTP ---------------- */
function StatusCheck() {
  const { db, requestWithdrawal } = useStore();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<"form" | "otp" | "result">("form");
  const [otp, setOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpLeft, setOtpLeft] = useState(600);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [err, setErr] = useState("");
  const [match, setMatch] = useState<{ candId: string } | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wReason, setWReason] = useState("");
  const [wMsg, setWMsg] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== "otp") return;
    const t = window.setInterval(() => setOtpLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  const verifyIdentity = () => {
    const c = db.candidates.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
    if (!c || normPhone(c.phone) !== normPhone(phone)) { setErr("The information provided could not be verified."); return; }
    setErr("");
    setOtp(String(Math.floor(100000 + Math.random() * 900000)));
    setOtpLeft(600);
    setAttempts(0);
    setMatch({ candId: c.id });
    setStage("otp");
  };
  const verifyOtp = () => {
    if (Date.now() < lockUntil) return;
    if (otpLeft <= 0) { setErr("Code expired — start over."); return; }
    if (otpInput === otp) { setErr(""); setStage("result"); return; }
    const a = attempts + 1;
    setAttempts(a);
    setErr("The information provided could not be verified.");
    if (a >= 3) { setLockUntil(Date.now() + 60_000); setErr("Too many attempts — locked for 60 seconds."); }
  };

  const cand = match ? db.candidates.find((c) => c.id === match.candId) : null;
  const apps = cand ? db.applications.filter((a) => a.candidateId === cand.id && a.active) : [];
  const locked = Date.now() < lockUntil;

  return (
    <div className="max-w-xl mx-auto anim-rise">
      <h2 className="font-display font-extrabold text-2xl text-ink-900">Check my status</h2>
      <p className="text-xs text-ink-500 mt-1 mb-5">Candidate Code + registered phone, verified with a one-time password emailed to you (valid 10 minutes).</p>

      {stage === "form" && (
        <div className="bg-card border border-ink-900/8 rounded-xl p-5 space-y-4">
          <Field label="Candidate code" req><input className={`${inputCls} font-mono`} placeholder="CAND-2026-0001" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Field label="Registered phone" req><input className={inputCls} placeholder="0812-…" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          {err && <div className="text-xs font-semibold text-rust-600 bg-rust-100 rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="alert" size={13} /> {err}</div>}
          <Btn className="w-full" onClick={verifyIdentity} disabled={!code || !phone}><Icon name="lock" size={13} /> Verify & send OTP</Btn>
          <p className="text-[10px] text-ink-400 text-center">Rate-limited after 3 failed attempts · generic errors never reveal whether a record exists.</p>
        </div>
      )}

      {stage === "otp" && (
        <div className="bg-card border border-ink-900/8 rounded-xl p-5">
          <div className="rounded-lg bg-river-100 border border-river-400/30 px-3.5 py-3 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-river-800 flex items-center gap-1.5"><Icon name="mail" size={11} /> Demo inbox — email to {cand?.email}</div>
            <div className="font-mono text-xl font-bold text-river-800 tracking-[0.3em] mt-1">{otp}</div>
            <div className="text-[10px] text-river-800/70 mt-0.5 tabular-nums">expires in {Math.floor(otpLeft / 60)}:{String(otpLeft % 60).padStart(2, "0")}</div>
          </div>
          <Field label="Enter 6-digit code" req><input className={`${inputCls} font-mono text-center tracking-[0.4em] text-lg`} maxLength={6} value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))} /></Field>
          {err && <div className="text-xs font-semibold text-rust-600 mt-3 flex items-center gap-2"><Icon name="alert" size={13} /> {err}</div>}
          <div className="flex gap-2 mt-4">
            <Btn tone="ghost" onClick={() => setStage("form")}>Back</Btn>
            <Btn className="flex-1" onClick={verifyOtp} disabled={locked || otpInput.length !== 6}>{locked ? "Locked — wait 60s" : "Verify"}</Btn>
          </div>
        </div>
      )}

      {stage === "result" && cand && (
        <div className="space-y-4">
          <div className="bg-pine-900 text-paper rounded-xl p-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-moss-300">Verified · {cand.code}</div>
            <h3 className="font-display font-extrabold text-xl mt-1">{cand.fullName}</h3>
          </div>
          {apps.map((a) => {
            const req = db.requisitions.find((r) => r.id === a.requisitionId);
            const client = db.clients.find((c) => c.id === req?.clientId);
            const itv = db.interviews.find((i) => i.applicationId === a.id && i.status === "SCHEDULED");
            const next = itv ? `Join your interview on ${fmtDateLong(itv.date)} at ${itv.start} WIB via Google Meet.`
              : a.questionnaireStatus !== "SUBMITTED" ? "Complete the preliminary questionnaire from your invitation link."
              : a.status === "ACTIVE" ? "Your profile is being reviewed — we'll contact you via WhatsApp."
              : a.status === "FAILED" || a.status === "WITHDRAWN" ? "This process has ended. Thank you for your interest."
              : "You're in our talent pool for future opportunities.";
            return (
              <div key={a.id} className="bg-card border border-ink-900/8 rounded-xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-bold text-ink-900 text-[15px]">{req?.positionName}</div>
                    <div className="text-[11px] text-ink-400">{client?.companyName}</div>
                  </div>
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${a.status === "ACTIVE" ? "bg-moss-100 text-moss-800" : a.status === "TALENT_POOL" ? "bg-river-100 text-river-800" : "bg-ink-900/6 text-ink-500"}`}>{a.status.replace("_", " ")}</span>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-paper px-3 py-2.5"><div className="text-[9.5px] font-bold uppercase tracking-wider text-ink-400">Current stage</div><div className="font-bold text-ink-800 mt-0.5">{PHASES[a.phase].name}</div></div>
                  <div className="rounded-lg bg-paper px-3 py-2.5"><div className="text-[9.5px] font-bold uppercase tracking-wider text-ink-400">Next action</div><div className="font-medium text-ink-600 mt-0.5">{next}</div></div>
                </div>
                {itv && (
                  <div className="mt-3 rounded-lg bg-moss-50 border border-moss-200 px-3 py-2.5 text-xs text-moss-800 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <b className="flex items-center gap-1.5"><Icon name="video" size={12} /> Interview: {fmtDateLong(itv.date)} · {itv.start} WIB</b>
                    <a className="font-bold underline" href={itv.meetLink} target="_blank" rel="noreferrer">Google Meet link</a>
                  </div>
                )}
                {(a.status === "ACTIVE" || a.status === "RESERVED") && (
                  <div className="mt-3 pt-3 border-t border-ink-900/6">
                    <Btn size="sm" tone="dangerSoft" onClick={() => { setWMsg(null); setWReason(""); setWithdrawOpen(true); }}><Icon name="x" size={12} /> Withdraw from this process</Btn>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-ink-400 text-center">Only sanitized information is shown — internal notes, scores and other candidates are never exposed.</p>
        </div>
      )}

      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Withdraw from recruitment" sub="Generates a pre-filled WhatsApp message to the consultant."
        footer={wMsg ? <Btn onClick={() => setWithdrawOpen(false)}>Done</Btn> : <>
          <Btn tone="ghost" onClick={() => setWithdrawOpen(false)}>Cancel</Btn>
          <Btn tone="danger" disabled={wReason.trim().length < 4} onClick={() => { const app = apps.find((a) => a.status === "ACTIVE" || a.status === "RESERVED"); if (app) setWMsg(requestWithdrawal(app.id, wReason.trim())); }}>Generate message</Btn>
        </>}>
        {!wMsg ? (
          <Field label="Reason" req><textarea className={`${inputCls} resize-none`} rows={3} value={wReason} onChange={(e) => setWReason(e.target.value)} /></Field>
        ) : (
          <div>
            <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed bg-pine-900 text-moss-100 rounded-xl p-4">{wMsg}</pre>
            <a href={waLink(db.config.CONSULTANT_WA || "", wMsg)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-md text-[13px] px-3.5 py-2 font-semibold bg-[#1f8f5f] text-white hover:bg-[#17714b] transition-colors"><Icon name="chat" size={14} /> Send via WhatsApp</a>
            <span className="ml-2 font-mono text-[10px] text-river-600">wa.me/{normPhone(db.config.CONSULTANT_WA || "")}</span>
            <p className="text-[10.5px] text-ink-400 mt-2.5">The WhatsApp message does not automatically change your status — the consultant confirms it in the system.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- closed page (PRD §Chunk 4) ---------------- */
function ClosedPage({ position }: { position: string }) {
  return (
    <div className="max-w-xl mx-auto text-center py-14 anim-rise">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-ink-900/6 text-ink-400 grid place-items-center mb-5"><Icon name="lock" size={24} /></div>
      <h2 className="font-display font-extrabold text-2xl text-ink-900">Lowongan Telah Ditutup</h2>
      <p className="text-sm text-ink-500 mt-3 leading-relaxed">
        Mohon maaf, lowongan untuk posisi <b className="text-ink-800">{position || "ini"}</b> saat ini sudah ditutup dan proses rekrutmen untuk posisi tersebut sudah tidak menerima kandidat baru.
      </p>
      <p className="text-xs text-ink-400 mt-4">Thank you for your interest — no internal recruitment data is accessible from this link.</p>
    </div>
  );
}
