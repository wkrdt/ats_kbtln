import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  seedDB, uid, nowISO, normPhone, hoursSince, meetGen, nextPhase, phaseIndex, PHASES,
  PHASE_STATUSES, REQ_TRANSITIONS, WA_INVITE_DEFAULT, defaultPhases,
} from "./data";
import type {
  DB, Role, CandidateStatus, PhaseCode, ReqStatus, AuditEntry, Candidate, Application,
  InterviewSlot, Evaluation, Requisition,
} from "./data";

const LS_KEY = "tapak-ats-v1";

export type Toast = { id: number; msg: string; tone: "ok" | "warn" | "err" | "info" };
export type View = "pipeline" | "candidates" | "requisitions" | "clients" | "interviews" | "reports" | "governance" | "integration";

interface Store {
  db: DB;
  role: Role;
  setRole: (r: Role) => void;
  view: View;
  setView: (v: View) => void;
  currentUserId: string;
  toasts: Toast[];
  toast: (msg: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  resetDemo: () => void;
  audit: (a: Partial<AuditEntry> & { action: string; objectType: string; objectId: string }) => void;
  /* clients & requisitions */
  addClient: (c: Partial<DB["clients"][number]>) => void;
  uploadContract: (clientId: string, fileName: string) => void;
  addResource: (r: Omit<import("./data").SourcingResource, "id">) => void;
  addRequisition: (r: { clientId: string; positionName: string; department: string; level: string; headcount: number; minSalary: number; maxSalary: number; targetDate: string; workArrangement: string; workLocation: string; channels: string[]; extraPhases: PhaseCode[] }) => void;
  setReqStatus: (reqId: string, to: ReqStatus, reason: string) => void;
  savePhaseConfig: (reqId: string, phases: Requisition["phases"], reason: string) => void;
  /* candidates */
  checkDuplicate: (phone: string) => { level: "BLOCK" | "WARN_HISTORY" | "WARN_ACTIVE" | "CLEAR"; message: string; candidate?: Candidate };
  addCandidate: (d: { fullName: string; phone: string; email: string; city: string; cvName: string; reqId: string; channel: string; overrideReason?: string }) => string;
  advancePhase: (appId: string, to: PhaseCode, reason: string) => void;
  setAppStatus: (appId: string, status: CandidateStatus, reason: string) => void;
  transfer: (appId: string, destReqId: string, reason: string, crossClientConsent: boolean) => void;
  requestWithdrawal: (appId: string, reason: string) => string;
  confirmWithdrawal: (appId: string, reason: string) => void;
  submitQuestionnaire: (appId: string, answers: Record<string, string>) => void;
  viewCV: (candidateId: string) => void;
  /* interviews */
  createSlot: (s: { requisitionId: string; phase: PhaseCode; date: string; start: string; duration: number; interviewerId: string; capacity: number }, force?: boolean) => { ok: boolean; conflict?: string; id?: string };
  selectSlot: (appId: string, slotId: string) => { ok: boolean; msg: string };
  cancelSlot: (slotId: string, reason: string) => void;
  evaluateInterview: (interviewId: string, ev: Omit<Evaluation, "createdAt" | "evaluatorId">, reason: string) => void;
  markInterviewNoShow: (interviewId: string, reason: string) => void;
  /* reporting & governance */
  generateReport: (clientId: string) => string;
  deleteCandidate: (candidateId: string, reason: string) => void;
  runNightlyJobs: () => { noResponse: string[]; cancelled: string[]; deleted: string[] };
  saveTemplate: (key: string, value: string) => void;
}

const Ctx = createContext<Store | null>(null);

function load(): DB {
  const seed = seedDB();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...seed, ...(JSON.parse(raw) as DB) };
  } catch { /* corrupted -> reseed */ }
  return seed;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const [role, setRoleState] = useState<Role>("CONSULTANT");
  const [view, setView] = useState<View>("pipeline");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(1);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* quota */ }
  }, [db]);

  const toast = useCallback((msg: string, tone: Toast["tone"] = "ok") => {
    const id = tid.current++;
    setToasts((t) => [...t.slice(-3), { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const currentUserId = role === "CLIENT_MASTER" ? "USER-002" : role === "CLIENT_HIRING" ? "USER-003" : "USER-001";
  const me = db.users.find((u) => u.id === currentUserId)!;

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    if (r === "CANDIDATE") return;
    setView(r === "CONSULTANT" ? "pipeline" : "reports");
  }, []);

  const pushAudit = useCallback((d: DB, a: Partial<AuditEntry> & { action: string; objectType: string; objectId: string }): DB => {
    const entry: AuditEntry = {
      id: uid("AUD"), ts: nowISO(), userId: currentUserId, userName: me.name,
      role: role === "CANDIDATE" ? "CANDIDATE" : me.role, ...a,
    } as AuditEntry;
    return { ...d, audit: [entry, ...d.audit] };
  }, [currentUserId, me, role]);

  const audit = useCallback((a: Partial<AuditEntry> & { action: string; objectType: string; objectId: string }) => {
    setDb((d) => pushAudit(d, a));
  }, [pushAudit]);

  const resetDemo = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    const fresh = seedDB();
    setDb(pushAudit(fresh, { action: "DEMO_RESET", objectType: "System", objectId: "workspace", reason: "Demo data restored to seed state" }));
    toast("Demo data restored", "info");
  }, [pushAudit, toast]);

  /* ---------- clients & requisitions ---------- */

  const addClient: Store["addClient"] = useCallback((c) => {
    setDb((d) => {
      const client = { id: uid("CLI"), companyName: c.companyName || "New Client", website: c.website || "—", picName: c.picName || "", picPosition: c.picPosition || "", picEmail: c.picEmail || "", picPhoneWA: c.picPhoneWA || "", contractStart: c.contractStart || nowISO(), contractEnd: c.contractEnd || nowISO(), contractStatus: "DRAFT" as const, active: true, createdAt: nowISO() };
      let nd: DB = { ...d, clients: [client, ...d.clients] };
      nd = pushAudit(nd, { action: "CLIENT_CREATED", objectType: "Client", objectId: client.id, next: client.companyName, reason: "New consulting engagement" });
      return nd;
    });
    toast("Client created");
  }, [pushAudit, toast]);

  const uploadContract: Store["uploadContract"] = useCallback((clientId, fileName) => {
    setDb((d) => {
      let nd: DB = { ...d, clients: d.clients.map((c) => (c.id === clientId ? { ...c, contractFileName: fileName, contractStatus: "SIGNED" as const } : c)) };
      nd = pushAudit(nd, { action: "CONTRACT_UPLOADED", objectType: "Document", objectId: clientId, next: `${fileName} → ATS/Clients/${clientId}/Contracts/ (private folder)` });
      return nd;
    });
    toast("Contract stored in private Drive folder");
  }, [pushAudit, toast]);

  const addResource: Store["addResource"] = useCallback((r) => {
    setDb((d) => {
      const res = { ...r, id: uid("SRC") };
      let nd: DB = { ...d, resources: [...d.resources, res] };
      nd = pushAudit(nd, { action: "SOURCING_RESOURCE_ADDED", objectType: "SourcingResource", objectId: res.id, clientId: r.clientId, next: `${res.resourceName} (${res.resourceType}) · credential ref ${res.credentialReference}`, reason: "Only a vault reference is stored — never plaintext credentials" });
      return nd;
    });
    toast("Sourcing resource added — credential reference only");
  }, [pushAudit, toast]);

  const addRequisition: Store["addRequisition"] = useCallback((r) => {
    setDb((d) => {
      const id = uid("REQ-2026");
      const req: Requisition = { id, clientId: r.clientId, positionName: r.positionName, department: r.department, level: r.level, headcount: r.headcount, filledCount: 0, recruitmentReason: "New headcount", employmentType: "Permanent", workLocation: r.workLocation, workArrangement: r.workArrangement, minSalary: r.minSalary, maxSalary: r.maxSalary, targetDate: r.targetDate, jobDescription: "", requiredSkills: "", hiringManagerName: d.clients.find((c) => c.id === r.clientId)?.picName || "", hiringManagerEmail: d.clients.find((c) => c.id === r.clientId)?.picEmail || "", sourcingChannels: r.channels, status: "OPEN", phases: defaultPhases(r.extraPhases), createdAt: nowISO() };
      let nd: DB = { ...d, requisitions: [req, ...d.requisitions] };
      nd = pushAudit(nd, { action: "REQUISITION_CREATED", objectType: "Requisition", objectId: id, clientId: r.clientId, next: `${r.positionName} · headcount ${r.headcount}`, reason: "Default 6-phase flow applied" });
      return nd;
    });
    toast("Requisition opened with default flow");
  }, [pushAudit, toast]);

  const setReqStatus: Store["setReqStatus"] = useCallback((reqId, to, reason) => {
    setDb((d) => {
      const req = d.requisitions.find((r) => r.id === reqId);
      if (!req || !REQ_TRANSITIONS[req.status].includes(to)) return d;
      let nd: DB = {
        ...d,
        requisitions: d.requisitions.map((r) => r.id === reqId ? { ...r, status: to, closedAt: to === "CLOSED" || to === "CANCELLED" ? nowISO() : r.closedAt, holdSince: to === "ON_HOLD" ? nowISO() : undefined } : r),
      };
      nd = pushAudit(nd, { action: "REQ_STATUS_CHANGED", objectType: "Requisition", objectId: reqId, clientId: req.clientId, prev: req.status, next: to, reason });
      return nd;
    });
    toast(`Requisition → ${to.replace("_", " ")}`);
  }, [pushAudit, toast]);

  const savePhaseConfig: Store["savePhaseConfig"] = useCallback((reqId, phases, reason) => {
    setDb((d) => {
      const req = d.requisitions.find((r) => r.id === reqId);
      if (!req) return d;
      const prevSummary = req.phases.filter((p) => p.enabled).map((p) => PHASES[p.code].name).join(" → ");
      const nextSummary = phases.filter((p) => p.enabled).map((p) => PHASES[p.code].name).join(" → ");
      let nd: DB = { ...d, requisitions: d.requisitions.map((r) => (r.id === reqId ? { ...r, phases } : r)) };
      nd = pushAudit(nd, { action: "PHASE_CONFIG_CHANGED", objectType: "Requisition", objectId: reqId, clientId: req.clientId, prev: prevSummary, next: nextSummary, reason });
      return nd;
    });
    toast("Phase configuration saved & audited");
  }, [pushAudit, toast]);

  /* ---------- candidates ---------- */

  const checkDuplicate: Store["checkDuplicate"] = useCallback((phone) => {
    const np = normPhone(phone);
    if (!np) return { level: "CLEAR", message: "" };
    const matches = db.candidates.filter((c) => normPhone(c.phone) === np);
    if (matches.length === 0) return { level: "CLEAR", message: "No existing record for this phone number." };
    for (const c of matches) {
      const apps = db.applications.filter((a) => a.candidateId === c.id);
      const blocked = apps.find((a) => (a.status === "NO_SHOW" || a.status === "NO_RESPONSE") && hoursSince(a.statusChangedAt) < 2 * 365 * 24);
      if (blocked) return { level: "BLOCK", message: "Candidate is not eligible due to past no-show / no-response history (within 2 years).", candidate: c };
    }
    for (const c of matches) {
      const apps = db.applications.filter((a) => a.candidateId === c.id);
      const active = apps.find((a) => a.active && (a.status === "ACTIVE" || a.status === "RESERVED"));
      if (active) {
        const req = db.requisitions.find((r) => r.id === active.requisitionId);
        const client = db.clients.find((cl) => cl.id === req?.clientId);
        return { level: "WARN_ACTIVE", message: `A candidate with this phone number already exists and is being processed at ${client?.companyName || "another client"} (${req?.positionName || ""}). Prefer a transfer over a new record.`, candidate: c };
      }
      const warn = apps.find((a) => (a.status === "FAILED" || a.status === "WITHDRAWN") && hoursSince(a.statusChangedAt) < 365 * 24);
      if (warn) return { level: "WARN_HISTORY", message: `This phone number has a ${warn.status.replace("_", " ").toLowerCase()} record from ${Math.round(hoursSince(warn.statusChangedAt) / 24 / 30)} months ago. Review required — a reason is mandatory to proceed.`, candidate: c };
    }
    return { level: "CLEAR", message: "Record found but no blocking history." };
  }, [db]);

  const addCandidate: Store["addCandidate"] = useCallback((d0) => {
    const id = uid("CND");
    const code = `CAND-2026-${String(db.candidates.length + 1).padStart(4, "0")}`;
    const appId = uid("APP");
    setDb((d) => {
      const cand: Candidate = { id, code, fullName: d0.fullName, phone: d0.phone, email: d0.email, city: d0.city, cvFileName: `${id}_CV_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").replace(/(\d{8})(\d{6})/, "$1_$2")}.pdf`, cvFileId: uid("DRV"), createdAt: nowISO() };
      const req = d.requisitions.find((r) => r.id === d0.reqId);
      const app: Application = { id: appId, candidateId: id, requisitionId: d0.reqId, phase: "SCREENING", status: "ACTIVE", sourcingChannel: d0.channel, applicationDate: nowISO(), lastInteractionAt: nowISO(), statusChangedAt: nowISO(), questionnaireStatus: "NOT_STARTED", active: true };
      let nd: DB = { ...d, candidates: [cand, ...d.candidates], applications: [app, ...d.applications] };
      nd = pushAudit(nd, { action: "CV_UPLOADED", objectType: "Document", objectId: cand.cvFileId, clientId: req?.clientId, next: `${cand.cvFileName} → ATS/Clients/${req?.clientId}/Requisitions/${d0.reqId}/CVs/ · application/pdf · ≤5MB verified` });
      nd = pushAudit(nd, { action: "CANDIDATE_CREATED", objectType: "Candidate", objectId: code, clientId: req?.clientId, next: `${d0.fullName} → ${d0.reqId} (${d0.channel})`, reason: d0.overrideReason || undefined });
      return nd;
    });
    toast(`${code} created · phase SCREENING`);
    return code;
  }, [db.candidates.length, pushAudit, toast]);

  const advancePhase: Store["advancePhase"] = useCallback((appId, to, reason) => {
    setDb((d) => {
      const app = d.applications.find((a) => a.id === appId);
      if (!app) return d;
      const req = d.requisitions.find((r) => r.id === app.requisitionId);
      if (!req) return d;
      const skipped = phaseIndex(req, to) > phaseIndex(req, app.phase) + 1;
      let nd: DB = { ...d, applications: d.applications.map((a) => (a.id === appId ? { ...a, phase: to, lastInteractionAt: nowISO(), statusChangedAt: nowISO() } : a)) };
      nd = pushAudit(nd, { action: skipped ? "PHASE_SKIPPED" : "PHASE_ADVANCED", objectType: "Application", objectId: appId, clientId: req.clientId, prev: `${PHASES[app.phase].name}`, next: `${PHASES[to].name}`, reason });
      return nd;
    });
    toast(`Moved to ${PHASES[to].name}`);
  }, [pushAudit, toast]);

  const setAppStatus: Store["setAppStatus"] = useCallback((appId, status, reason) => {
    setDb((d) => {
      const app = d.applications.find((a) => a.id === appId);
      if (!app) return d;
      const req = d.requisitions.find((r) => r.id === app.requisitionId);
      if (!req || !PHASE_STATUSES[app.phase]?.includes(status)) return d;
      let nd: DB = { ...d, applications: d.applications.map((a) => (a.id === appId ? { ...a, status, statusChangedAt: nowISO(), lastInteractionAt: nowISO(), withdrawalRequest: undefined } : a)) };
      if (status === "HIRED") {
        const filled = req.filledCount + 1;
        const autoClose = filled >= req.headcount;
        nd = { ...nd, requisitions: nd.requisitions.map((r) => (r.id === req.id ? { ...r, filledCount: filled, status: autoClose ? "CLOSED" : r.status, closedAt: autoClose ? nowISO() : r.closedAt } : r)) };
        if (autoClose) nd = pushAudit(nd, { action: "REQ_STATUS_CHANGED", objectType: "Requisition", objectId: req.id, clientId: req.clientId, prev: "OPEN", next: "CLOSED", reason: `Automated: headcount fulfilled (${filled}/${req.headcount})` });
      }
      nd = pushAudit(nd, { action: "STATUS_CHANGED", objectType: "Application", objectId: appId, clientId: req.clientId, prev: `${app.status} @ ${PHASES[app.phase].name}`, next: status, reason });
      return nd;
    });
    toast(`Status → ${status.replace("_", " ")}`);
  }, [pushAudit, toast]);

  const transfer: Store["transfer"] = useCallback((appId, destReqId, reason, consent) => {
    setDb((d) => {
      const app = d.applications.find((a) => a.id === appId);
      const src = d.requisitions.find((r) => r.id === app?.requisitionId);
      const dst = d.requisitions.find((r) => r.id === destReqId);
      if (!app || !src || !dst) return d;
      const cand = d.candidates.find((c) => c.id === app.candidateId);
      const newApp: Application = { id: uid("APP"), candidateId: app.candidateId, requisitionId: destReqId, phase: "SCREENING", status: "ACTIVE", sourcingChannel: `Transfer from ${src.id}`, applicationDate: nowISO(), lastInteractionAt: nowISO(), statusChangedAt: nowISO(), questionnaireStatus: "NOT_STARTED", active: true, transferNote: `Transferred from ${src.positionName} (${src.id})` };
      let nd: DB = {
        ...d,
        applications: d.applications.map((a) => (a.id === appId ? { ...a, status: "WITHDRAWN" as CandidateStatus, active: false, statusChangedAt: nowISO(), transferNote: `TRANSFERRED → ${dst.id}` } : a)).concat(newApp),
      };
      nd = pushAudit(nd, { action: "CANDIDATE_TRANSFERRED", objectType: "Application", objectId: appId, clientId: dst.clientId, prev: `${src.id} · ${src.positionName} (client ${src.clientId})`, next: `${dst.id} · ${dst.positionName} (client ${dst.clientId}) · new ${newApp.id}`, reason: `${reason}${dst.clientId !== src.clientId ? ` · cross-client consent ${consent ? "confirmed" : "NOT confirmed"}` : ""}` });
      return nd;
    });
    toast(`Transferred — original closed as TRANSFERRED · candidate kept as ${db.candidates.find((c) => c.id === db.applications.find((a) => a.id === appId)?.candidateId)?.code || "candidate"}`, "info");
  }, [db, pushAudit, toast]);

  const requestWithdrawal: Store["requestWithdrawal"] = useCallback((appId, reason) => {
    const app = db.applications.find((a) => a.id === appId);
    const req = db.requisitions.find((r) => r.id === app?.requisitionId);
    const msg = `Halo ${db.config.CONSULTANT_WA || "consultant"},\n\ndengan berat hati saya harus mengundurkan diri dari proses recruitment posisi ${req?.positionName || ""} ini karena ${reason}.`;
    setDb((d) => {
      let nd: DB = { ...d, applications: d.applications.map((a) => (a.id === appId ? { ...a, withdrawalRequest: { reason, requestedAt: nowISO(), waMessage: msg } } : a)) };
      nd = pushAudit(nd, { action: "WITHDRAWAL_REQUESTED", objectType: "Application", objectId: appId, clientId: req?.clientId, next: `Candidate requested withdrawal — WhatsApp sent to consultant`, reason });
      return nd;
    });
    return msg;
  }, [db, pushAudit]);

  const confirmWithdrawal: Store["confirmWithdrawal"] = useCallback((appId, reason) => {
    setDb((d) => {
      const app = d.applications.find((a) => a.id === appId);
      const req = db.requisitions.find((r) => r.id === app?.requisitionId);
      let nd: DB = { ...d, applications: d.applications.map((a) => (a.id === appId ? { ...a, status: "WITHDRAWN" as CandidateStatus, statusChangedAt: nowISO(), withdrawalRequest: undefined } : a)) };
      nd = pushAudit(nd, { action: "STATUS_CHANGED", objectType: "Application", objectId: appId, clientId: req?.clientId, prev: `${app?.status} (withdrawal requested)`, next: "WITHDRAWN", reason });
      return nd;
    });
    toast("Withdrawal confirmed · status WITHDRAWN");
  }, [db, pushAudit, toast]);

  const submitQuestionnaire: Store["submitQuestionnaire"] = useCallback((appId, answers) => {
    setDb((d) => {
      const app = d.applications.find((a) => a.id === appId);
      const req = db.requisitions.find((r) => r.id === app?.requisitionId);
      let nd: DB = {
        ...d,
        applications: d.applications.map((a) => (a.id === appId ? { ...a, questionnaireStatus: "SUBMITTED" as const, questionnaireSubmittedAt: nowISO(), lastInteractionAt: nowISO() } : a)),
        candidates: d.candidates.map((c) => c.id === app?.candidateId ? { ...c, fullName: answers.fullName || c.fullName, phone: answers.phone || c.phone, email: answers.email || c.email, city: answers.city || c.city, dob: answers.dob || c.dob, gender: answers.gender || c.gender, educationLevel: answers.educationLevel || c.educationLevel, educationInstitution: answers.educationInstitution || c.educationInstitution, major: answers.major || c.major, currentCompany: answers.currentCompany || c.currentCompany, currentTitle: answers.currentTitle || c.currentTitle, expectedSalary: answers.expectedSalary ? Number(answers.expectedSalary) * 1_000_000 : c.expectedSalary, noticePeriod: answers.noticePeriod || c.noticePeriod } : c),
      };
      nd = pushAudit(nd, { action: "QUESTIONNAIRE_SUBMITTED", objectType: "Application", objectId: appId, clientId: req?.clientId, next: `9 sections · answers stored in QuestionnaireResponses` });
      return nd;
    });
    toast("Questionnaire submitted — database is now authoritative");
  }, [db, pushAudit, toast]);

  const viewCV: Store["viewCV"] = useCallback((candidateId) => {
    const c = db.candidates.find((x) => x.id === candidateId);
    audit({ action: "CV_VIEWED", objectType: "Document", objectId: c?.cvFileId || candidateId, next: `${c?.cvFileName || "CV"} opened via authorized Apps Script route (no public URL)` });
  }, [db, audit]);

  /* ---------- interviews ---------- */

  const createSlot: Store["createSlot"] = useCallback((s, force) => {
    const end = (() => {
      const [h, m] = s.start.split(":").map(Number);
      const t = h * 60 + m + s.duration;
      return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    })();
    const clash = db.slots.find((x) => x.status !== "CANCELLED" && x.date === s.date && x.interviewerId === s.interviewerId && s.start < x.end && x.start < end);
    if (clash && !force) {
      const iv = db.users.find((u) => u.id === s.interviewerId);
      return { ok: false, conflict: `${iv?.name || "Interviewer"} is already booked at ${clash.start}–${clash.end} on the same day (${clash.id}). Confirm to create anyway.` };
    }
    const id = uid("SLOT");
    setDb((d) => {
      const slot: InterviewSlot = { id, requisitionId: s.requisitionId, phase: s.phase, date: s.date, start: s.start, end, interviewerId: s.interviewerId, meetLink: meetGen(), capacity: s.capacity, used: 0, status: "OPEN", createdAt: nowISO() };
      let nd: DB = { ...d, slots: [...d.slots, slot] };
      nd = pushAudit(nd, { action: "SLOT_CREATED", objectType: "InterviewSlot", objectId: id, next: `${PHASES[s.phase].name} · ${s.date} ${s.start}–${end} · capacity ${s.capacity} · GMeet auto-generated`, reason: clash ? "Created despite interviewer conflict (confirmed)" : undefined });
      return nd;
    });
    toast("Slot created · Google Meet link generated");
    return { ok: true, id };
  }, [db, pushAudit, toast]);

  const selectSlot: Store["selectSlot"] = useCallback((appId, slotId) => {
    const slot = db.slots.find((s) => s.id === slotId);
    if (!slot) return { ok: false, msg: "Slot no longer exists." };
    /* LockService simulation: re-check capacity under lock */
    if (slot.used >= slot.capacity || slot.status !== "OPEN") return { ok: false, msg: "Mohon maaf, jadwal ini baru saja diambil kandidat lain. Silakan pilih jadwal lain." };
    setDb((d) => {
      const app = d.applications.find((a) => a.id === appId);
      const fresh = d.slots.find((s) => s.id === slotId)!;
      if (fresh.used >= fresh.capacity) return d;
      const used = fresh.used + 1;
      const interview = { id: uid("INT"), applicationId: appId, slotId, phase: slot.phase, date: slot.date, start: slot.start, interviewerId: slot.interviewerId, meetLink: fresh.meetLink, status: "SCHEDULED" as const, createdAt: nowISO() };
      let nd: DB = {
        ...d,
        slots: d.slots.map((s) => (s.id === slotId ? { ...s, used, status: used >= s.capacity ? "FULL" as const : "OPEN" as const } : s)),
        interviews: [...d.interviews, interview],
        applications: d.applications.map((a) => (a.id === appId ? { ...a, slotId, lastInteractionAt: nowISO() } : a)),
      };
      nd = pushAudit(nd, { action: "SLOT_SELECTED", objectType: "Application", objectId: appId, next: `${slotId} · seat ${used}/${slot.capacity} reserved under lock · interview confirmed`, clientId: undefined });
      return nd;
    });
    return { ok: true, msg: "Interview confirmed." };
  }, [db, pushAudit]);

  const cancelSlot: Store["cancelSlot"] = useCallback((slotId, reason) => {
    setDb((d) => {
      let nd: DB = { ...d, slots: d.slots.map((s) => (s.id === slotId ? { ...s, status: "CANCELLED" as const } : s)) };
      nd = pushAudit(nd, { action: "SLOT_CANCELLED", objectType: "InterviewSlot", objectId: slotId, prev: "OPEN", next: "CANCELLED", reason });
      return nd;
    });
    toast("Slot cancelled · affected candidate flagged for reschedule", "warn");
  }, [pushAudit, toast]);

  const evaluateInterview: Store["evaluateInterview"] = useCallback((interviewId, ev, reason) => {
    setDb((d) => {
      const itv = d.interviews.find((i) => i.id === interviewId);
      if (!itv) return d;
      const app = d.applications.find((a) => a.id === itv.applicationId);
      const req = d.requisitions.find((r) => r.id === app?.requisitionId);
      const evaluation: Evaluation = { ...ev, evaluatorId: currentUserId, createdAt: nowISO() };
      let nd: DB = { ...d, interviews: d.interviews.map((i) => (i.id === interviewId ? { ...i, status: "COMPLETED" as const, attended: true, evaluation } : i)) };
      nd = pushAudit(nd, { action: "EVALUATION_SUBMITTED", objectType: "Interview", objectId: interviewId, clientId: req?.clientId, next: `Rating ${ev.rating} · structured scores stored` });
      if (ev.decision === "MOVE_FORWARD" && app) {
        const np = nextPhase(d.requisitions.find((r) => r.id === app.requisitionId)!, app.phase);
        if (np) {
          nd = { ...nd, applications: nd.applications.map((a) => (a.id === app.id ? { ...a, phase: np, lastInteractionAt: nowISO(), statusChangedAt: nowISO() } : a)) };
          nd = pushAudit(nd, { action: "PHASE_ADVANCED", objectType: "Application", objectId: app.id, clientId: req?.clientId, prev: PHASES[app.phase].name, next: PHASES[np].name, reason });
        }
      } else if (ev.decision === "FAILED" && app) {
        nd = { ...nd, applications: nd.applications.map((a) => (a.id === app.id ? { ...a, status: "FAILED" as CandidateStatus, statusChangedAt: nowISO() } : a)) };
        nd = pushAudit(nd, { action: "STATUS_CHANGED", objectType: "Application", objectId: app.id, clientId: req?.clientId, prev: app.status, next: "FAILED", reason });
      }
      return nd;
    });
    toast(ev.decision === "MOVE_FORWARD" ? "Evaluation saved · candidate moved forward" : "Evaluation saved · candidate marked FAILED", ev.decision === "FAILED" ? "warn" : "ok");
  }, [currentUserId, pushAudit, toast]);

  const markInterviewNoShow: Store["markInterviewNoShow"] = useCallback((interviewId, reason) => {
    setDb((d) => {
      const itv = d.interviews.find((i) => i.id === interviewId);
      const app = d.applications.find((a) => a.id === itv?.applicationId);
      let nd: DB = { ...d, interviews: d.interviews.map((i) => (i.id === interviewId ? { ...i, status: "NO_SHOW" as const, attended: false } : i)) };
      if (app) {
        nd = { ...nd, applications: nd.applications.map((a) => (a.id === app.id ? { ...a, status: "NO_SHOW" as CandidateStatus, statusChangedAt: nowISO() } : a)) };
        nd = pushAudit(nd, { action: "STATUS_CHANGED", objectType: "Application", objectId: app.id, prev: app.status, next: "NO_SHOW", reason });
      }
      return nd;
    });
    toast("Marked NO_SHOW · 2-year cooldown now applies", "warn");
  }, [pushAudit, toast]);

  /* ---------- reporting & governance ---------- */

  const generateReport: Store["generateReport"] = useCallback((clientId) => {
    const id = uid("RPT-2026");
    setDb((d) => {
      const reqs = d.requisitions.filter((r) => r.clientId === clientId);
      const reqIds = reqs.map((r) => r.id);
      const apps = d.applications.filter((a) => reqIds.includes(a.requisitionId) && a.active);
      const rows = apps.map((a) => {
        const c = d.candidates.find((x) => x.id === a.candidateId)!;
        const r = reqs.find((x) => x.id === a.requisitionId)!;
        return { Position: r.positionName, Stage: PHASES[a.phase].name, Candidate: c.fullName, Status: a.status.replace("_", " ") };
      });
      const snap = { id, clientId, periodStart: new Date(Date.now() - 7 * 86_400_000).toISOString(), periodEnd: nowISO(), generatedAt: nowISO(), generatedBy: currentUserId, recipients: d.users.filter((u) => u.clientId === clientId).map((u) => u.email), requisitionIds: reqIds, metrics: { openReqs: reqs.filter((r) => r.status === "OPEN").length, pipeline: apps.length, interviews: d.interviews.filter((i) => reqIds.includes(d.applications.find((a) => a.id === i.applicationId)?.requisitionId || "") && i.status === "SCHEDULED").length, offers: apps.filter((a) => a.phase === "OFFER").length }, rows };
      let nd: DB = { ...d, reports: [snap, ...d.reports] };
      nd = pushAudit(nd, { action: "REPORT_GENERATED", objectType: "Report", objectId: id, clientId, next: `Static snapshot · ${reqIds.length} requisitions · delivered to ${snap.recipients.length} recipient(s)` });
      return nd;
    });
    toast("Static report snapshot generated & filed");
    return id;
  }, [currentUserId, pushAudit, toast]);

  const deleteCandidate: Store["deleteCandidate"] = useCallback((candidateId, reason) => {
    setDb((d) => {
      const cand = d.candidates.find((c) => c.id === candidateId);
      if (!cand) return d;
      const apps = d.applications.filter((a) => a.candidateId === candidateId);
      const files = [cand.cvFileName].filter(Boolean) as string[];
      const entry = { id: uid("RET"), candidateId, candidateCode: cand.code, requisitionIds: [...new Set(apps.map((a) => a.requisitionId))], deletedAt: nowISO(), deletedBy: currentUserId, reason, filesDeleted: files };
      let nd: DB = {
        ...d,
        candidates: d.candidates.filter((c) => c.id !== candidateId),
        applications: d.applications.filter((a) => a.candidateId !== candidateId),
        retentionLog: [entry, ...d.retentionLog],
      };
      nd = pushAudit(nd, { action: "CANDIDATE_DELETED", objectType: "Candidate", objectId: cand.code, prev: `Record + ${files.length} Drive file(s)`, next: "Purged per retention policy", reason });
      return nd;
    });
    toast("Candidate data & CV purged · logged in RetentionLog", "warn");
  }, [currentUserId, pushAudit, toast]);

  const runNightlyJobs: Store["runNightlyJobs"] = useCallback(() => {
    const result = { noResponse: [] as string[], cancelled: [] as string[], deleted: [] as string[] };
    setDb((d) => {
      let nd = d;
      /* 1 — NO_RESPONSE sweep: invited, no questionnaire/slot within 120h */
      nd = {
        ...nd,
        applications: nd.applications.map((a) => {
          if (a.status === "ACTIVE" && a.questionnaireStatus !== "SUBMITTED" && !a.slotId && hoursSince(a.lastInteractionAt) > 120) {
            result.noResponse.push(a.id);
            return { ...a, status: "NO_RESPONSE" as CandidateStatus, statusChangedAt: nowISO() };
          }
          return a;
        }),
      };
      for (const appId of result.noResponse) nd = pushAudit(nd, { action: "STATUS_CHANGED", objectType: "Application", objectId: appId, userId: "SYSTEM", userName: "Nightly Trigger", role: "SYSTEM", prev: "ACTIVE", next: "NO_RESPONSE", reason: "Automated trigger: no response within 120 hours" });
      /* 2 — ON_HOLD > 30 days auto-cancel */
      const holdDays = Number(nd.config.HOLD_AUTO_CANCEL_DAYS || 30);
      nd = {
        ...nd,
        requisitions: nd.requisitions.map((r) => {
          if (r.status === "ON_HOLD" && r.holdSince && hoursSince(r.holdSince) > holdDays * 24) {
            result.cancelled.push(r.id);
            return { ...r, status: "CANCELLED" as ReqStatus, closedAt: nowISO() };
          }
          return r;
        }),
      };
      for (const rid of result.cancelled) nd = pushAudit(nd, { action: "REQ_STATUS_CHANGED", objectType: "Requisition", objectId: rid, userId: "SYSTEM", userName: "Nightly Trigger", role: "SYSTEM", prev: "ON_HOLD", next: "CANCELLED", reason: `Automated trigger: on hold longer than ${holdDays} days` });
      /* 3 — retention sweep */
      const failedH = Number(nd.config.RETENTION_FAILED_HOURS || 48);
      const nrH = Number(nd.config.RETENTION_NORESPONSE_HOURS || 120);
      const eligible = nd.candidates.filter((c) => {
        const apps = nd.applications.filter((a) => a.candidateId === c.id);
        if (apps.length === 0) return false;
        return apps.every((a) => {
          const req = nd.requisitions.find((r) => r.id === a.requisitionId);
          if (a.status === "FAILED" || a.status === "WITHDRAWN") return (req?.status === "CLOSED" || req?.status === "CANCELLED") && hoursSince(a.statusChangedAt) > failedH;
          if (a.status === "NO_RESPONSE" || a.status === "NO_SHOW") return hoursSince(a.statusChangedAt) > nrH;
          return false;
        });
      });
      for (const c of eligible) {
        result.deleted.push(c.code);
        const apps = nd.applications.filter((a) => a.candidateId === c.id);
        const entry = { id: uid("RET"), candidateId: c.id, candidateCode: c.code, requisitionIds: [...new Set(apps.map((a) => a.requisitionId))], deletedAt: nowISO(), deletedBy: "SYSTEM (time-driven trigger)", reason: "Retention policy: all applications in eligible final status past cooling period", filesDeleted: [c.cvFileName].filter(Boolean) as string[] };
        nd = { ...nd, candidates: nd.candidates.filter((x) => x.id !== c.id), applications: nd.applications.filter((a) => a.candidateId !== c.id), retentionLog: [entry, ...nd.retentionLog] };
        nd = pushAudit(nd, { action: "CANDIDATE_DELETED", objectType: "Candidate", objectId: c.code, userId: "SYSTEM", userName: "Nightly Trigger", role: "SYSTEM", prev: "Retention-eligible", next: "Purged by nightly trigger", reason: entry.reason });
      }
      return nd;
    });
    return result;
  }, [pushAudit]);

  const saveTemplate: Store["saveTemplate"] = useCallback((key, value) => {
    setDb((d) => {
      let nd: DB = { ...d, config: { ...d.config, [key]: value } };
      nd = pushAudit(nd, { action: "CONFIG_CHANGED", objectType: "Config", objectId: key, next: "Template updated" });
      return nd;
    });
    toast("Template saved");
  }, [pushAudit, toast]);

  const store: Store = useMemo(() => ({
    db, role, setRole, view, setView, currentUserId, toasts, toast, dismissToast, resetDemo, audit,
    addClient, uploadContract, addResource, addRequisition, setReqStatus, savePhaseConfig,
    checkDuplicate, addCandidate, advancePhase, setAppStatus, transfer, requestWithdrawal, confirmWithdrawal,
    submitQuestionnaire, viewCV, createSlot, selectSlot, cancelSlot, evaluateInterview, markInterviewNoShow,
    generateReport, deleteCandidate, runNightlyJobs, saveTemplate,
  }), [db, role, setRole, view, toasts, toast, dismissToast, resetDemo, audit, addClient, uploadContract, addRequisition, setReqStatus, savePhaseConfig, checkDuplicate, addCandidate, advancePhase, setAppStatus, transfer, requestWithdrawal, confirmWithdrawal, submitQuestionnaire, viewCV, createSlot, selectSlot, cancelSlot, evaluateInterview, markInterviewNoShow, generateReport, deleteCandidate, runNightlyJobs, saveTemplate, currentUserId]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

export { WA_INVITE_DEFAULT };
