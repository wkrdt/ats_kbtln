/* ============================================================
   Tapak ATS — data model, enums, rules and seed
   Mirrors the Google Sheets schema from the PRD (Chunk 0–7).
   ============================================================ */

export type Role = "CONSULTANT" | "CLIENT_MASTER" | "CLIENT_HIRING" | "CANDIDATE";

export type CandidateStatus =
  | "ACTIVE" | "RESERVED" | "FAILED" | "WITHDRAWN" | "NO_RESPONSE"
  | "NO_SHOW" | "TALENT_POOL" | "HIRED";

export type ReqStatus = "OPEN" | "ON_HOLD" | "CLOSED" | "CANCELLED";
export type PhaseCode =
  | "SCREENING" | "SCREENING_INTERVIEW" | "PSIKOTEST" | "TECHNICAL_SKILL_ASSESSMENT"
  | "ADDITIONAL_ASSESSMENT" | "ADDITIONAL_INTERVIEW" | "REFERENCE_CHECK"
  | "BACKGROUND_CHECK" | "MCU_MEDICAL" | "USER_INTERVIEW" | "OFFER" | "PLACED" | "ONBOARDING";

export interface User { id: string; email: string; role: Exclude<Role, "CANDIDATE">; clientId?: string; requisitionIds?: string[]; name: string; phone: string; active: boolean; mfa: boolean }
export interface Client { id: string; companyName: string; website: string; picName: string; picPosition: string; picEmail: string; picPhoneWA: string; contractFileName?: string; contractStart: string; contractEnd: string; contractStatus: "SIGNED" | "DRAFT" | "EXPIRED"; notes?: string; active: boolean; createdAt: string }
export interface PhaseConfig { code: PhaseCode; enabled: boolean; required: boolean }
export interface Requisition {
  id: string; clientId: string; positionName: string; department: string; level: string;
  headcount: number; filledCount: number; recruitmentReason: string; employmentType: string;
  workLocation: string; workArrangement: string; minSalary: number; maxSalary: number;
  targetDate: string; jobDescription: string; requiredSkills: string; hiringManagerName: string;
  hiringManagerEmail: string; sourcingChannels: string[]; status: ReqStatus;
  phases: PhaseConfig[]; createdAt: string; closedAt?: string; holdSince?: string; notes?: string;
}
export interface Candidate {
  id: string; code: string; fullName: string; phone: string; email: string; city: string;
  dob?: string; gender?: string; educationLevel?: string; educationInstitution?: string; major?: string;
  currentCompany?: string; currentTitle?: string; yearsExp?: number; expectedSalary?: number;
  noticePeriod?: string; skills?: string[]; cvFileName: string; cvFileId: string; createdAt: string;
}
export interface WithdrawalRequest { reason: string; requestedAt: string; waMessage: string }
export interface Application {
  id: string; candidateId: string; requisitionId: string; phase: PhaseCode; status: CandidateStatus;
  sourcingChannel: string; applicationDate: string; lastInteractionAt: string; statusChangedAt: string;
  questionnaireStatus: "NOT_STARTED" | "DRAFT" | "SUBMITTED"; questionnaireSubmittedAt?: string;
  slotId?: string; withdrawalRequest?: WithdrawalRequest; transferNote?: string; active: boolean;
}
export interface Evaluation { evaluatorId: string; scores: Record<string, number>; rating: number; strengths: string; concerns: string; decision: "MOVE_FORWARD" | "FAILED"; decisionReason: string; createdAt: string }
export interface InterviewSlot { id: string; requisitionId: string; phase: PhaseCode; date: string; start: string; end: string; interviewerId: string; meetLink: string; capacity: number; used: number; status: "OPEN" | "FULL" | "CANCELLED"; createdAt: string }
export interface Interview { id: string; applicationId: string; slotId: string; phase: PhaseCode; date: string; start: string; interviewerId: string; meetLink: string; status: "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELLED"; attended?: boolean; evaluation?: Evaluation; createdAt: string }
export interface AuditEntry { id: string; ts: string; userId: string; userName: string; role: string; clientId?: string; action: string; objectType: string; objectId: string; prev?: string; next?: string; reason?: string }
export interface RetentionEntry { id: string; candidateId: string; candidateCode: string; requisitionIds: string[]; deletedAt: string; deletedBy: string; reason: string; filesDeleted: string[] }
export interface ReportSnapshot { id: string; clientId: string; periodStart: string; periodEnd: string; generatedAt: string; generatedBy: string; recipients: string[]; requisitionIds: string[]; metrics: Record<string, number>; rows: Record<string, string>[] }
export interface Token { token: string; applicationId: string; purpose: string; expiresAt: string }
export interface SourcingResource { id: string; clientId: string; resourceName: string; resourceType: string; url: string; accountUsername: string; credentialReference: string; accessStatus: "ACTIVE" | "PENDING" | "EXPIRED"; notes?: string }
export interface DB {
  users: User[]; clients: Client[]; requisitions: Requisition[]; candidates: Candidate[];
  applications: Application[]; slots: InterviewSlot[]; interviews: Interview[];
  audit: AuditEntry[]; retentionLog: RetentionEntry[]; reports: ReportSnapshot[]; tokens: Token[];
  resources: SourcingResource[]; config: Record<string, string>;
}

/* ---------------- enums & rules (PRD §5) ---------------- */

export const PHASES: Record<PhaseCode, { name: string; optional: boolean; color: string }> = {
  SCREENING: { name: "Screening", optional: false, color: "#71827a" },
  SCREENING_INTERVIEW: { name: "Screening Interview", optional: false, color: "#3f6488" },
  PSIKOTEST: { name: "Psychometric Test", optional: true, color: "#5b7fa6" },
  TECHNICAL_SKILL_ASSESSMENT: { name: "Technical Assessment", optional: true, color: "#2c835b" },
  ADDITIONAL_ASSESSMENT: { name: "Client Assessment", optional: true, color: "#4f9e77" },
  ADDITIONAL_INTERVIEW: { name: "Additional Interview", optional: true, color: "#6b93b8" },
  REFERENCE_CHECK: { name: "Reference Check", optional: true, color: "#8a9a5b" },
  BACKGROUND_CHECK: { name: "Background Check", optional: true, color: "#a98437" },
  MCU_MEDICAL: { name: "Medical Check-Up", optional: true, color: "#b0713f" },
  USER_INTERVIEW: { name: "User Interview", optional: true, color: "#1e6d4a" },
  OFFER: { name: "Offer", optional: true, color: "#d18a1f" },
  PLACED: { name: "Placed", optional: true, color: "#17573c" },
  ONBOARDING: { name: "Onboarding", optional: true, color: "#0d3325" },
};

export const DEFAULT_FLOW: PhaseCode[] = ["SCREENING", "SCREENING_INTERVIEW", "USER_INTERVIEW", "OFFER", "PLACED", "ONBOARDING"];
export const OPTIONAL_PHASES: PhaseCode[] = ["PSIKOTEST", "TECHNICAL_SKILL_ASSESSMENT", "ADDITIONAL_ASSESSMENT", "ADDITIONAL_INTERVIEW", "REFERENCE_CHECK", "BACKGROUND_CHECK", "MCU_MEDICAL"];

export const PHASE_STATUSES: Record<string, CandidateStatus[]> = {
  SCREENING: ["ACTIVE", "FAILED", "WITHDRAWN", "NO_RESPONSE"],
  SCREENING_INTERVIEW: ["ACTIVE", "FAILED", "WITHDRAWN", "NO_SHOW", "TALENT_POOL"],
  PSIKOTEST: ["ACTIVE", "FAILED", "WITHDRAWN", "RESERVED"],
  TECHNICAL_SKILL_ASSESSMENT: ["ACTIVE", "FAILED", "WITHDRAWN", "TALENT_POOL", "RESERVED"],
  ADDITIONAL_ASSESSMENT: ["ACTIVE", "FAILED", "WITHDRAWN", "RESERVED"],
  ADDITIONAL_INTERVIEW: ["ACTIVE", "FAILED", "WITHDRAWN", "TALENT_POOL", "RESERVED"],
  REFERENCE_CHECK: ["ACTIVE", "FAILED", "WITHDRAWN", "RESERVED"],
  BACKGROUND_CHECK: ["ACTIVE", "FAILED", "WITHDRAWN", "RESERVED"],
  MCU_MEDICAL: ["ACTIVE", "FAILED", "WITHDRAWN", "RESERVED"],
  USER_INTERVIEW: ["ACTIVE", "FAILED", "WITHDRAWN", "RESERVED", "TALENT_POOL"],
  OFFER: ["ACTIVE", "WITHDRAWN", "RESERVED", "TALENT_POOL"],
  PLACED: ["HIRED"],
  ONBOARDING: ["HIRED"],
};

export const REQ_TRANSITIONS: Record<ReqStatus, ReqStatus[]> = {
  OPEN: ["ON_HOLD", "CLOSED", "CANCELLED"],
  ON_HOLD: ["OPEN", "CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

export const FINAL_STATUSES: CandidateStatus[] = ["FAILED", "WITHDRAWN", "NO_RESPONSE", "NO_SHOW", "HIRED"];

export const STATUS_META: Record<CandidateStatus, { label: string; fg: string; bg: string; dot: string }> = {
  ACTIVE: { label: "Active", fg: "#17573c", bg: "#d8ecdf", dot: "#2c835b" },
  RESERVED: { label: "Reserved", fg: "#6b440e", bg: "#fbeed3", dot: "#e8a33d" },
  FAILED: { label: "Failed", fg: "#6e2a21", bg: "#f9e3de", dot: "#c14b3c" },
  WITHDRAWN: { label: "Withdrawn", fg: "#6e2a21", bg: "#f9e3de", dot: "#d96a5b" },
  NO_RESPONSE: { label: "No Response", fg: "#52635a", bg: "#e5e8dd", dot: "#71827a" },
  NO_SHOW: { label: "No-Show", fg: "#6e2a21", bg: "#f9e3de", dot: "#a03a2e" },
  TALENT_POOL: { label: "Talent Pool", fg: "#2b4560", bg: "#dde9f2", dot: "#6b93b8" },
  HIRED: { label: "Hired", fg: "#0d3325", bg: "#b2d8c2", dot: "#17573c" },
};

export const REQ_META: Record<ReqStatus, { label: string; fg: string; bg: string; dot: string }> = {
  OPEN: { label: "Open", fg: "#17573c", bg: "#d8ecdf", dot: "#2c835b" },
  ON_HOLD: { label: "On Hold", fg: "#6b440e", bg: "#fbeed3", dot: "#e8a33d" },
  CLOSED: { label: "Closed", fg: "#2b4560", bg: "#dde9f2", dot: "#6b93b8" },
  CANCELLED: { label: "Cancelled", fg: "#6e2a21", bg: "#f9e3de", dot: "#c14b3c" },
};

export const WA_PLACEHOLDERS = ["[CANDIDATE NAME]", "[CONSULTANT NAME]", "[COMPANY NAME]", "[POSITION NAME]", "[REQUISITION ID]", "[SCHEDULER LINK]", "[CONSULTANT WA NUMBER]", "[INTERVIEW DATE]", "[INTERVIEW TIME]", "[GOOGLE MEET LINK]"];

export const WA_INVITE_DEFAULT = `Halo [CANDIDATE NAME],

Perkenalkan saya [CONSULTANT NAME] dari [COMPANY NAME].

Saya menghubungi Anda berkaitan dengan lamaran Anda untuk posisi [POSITION NAME].

Jika Anda bersedia untuk berdiskusi lebih lanjut, silakan pilih jadwal interview (daring/online) melalui link berikut:

> [SCHEDULER LINK]

Catatan:
1. Agar link muncul/aktif di WhatsApp, silakan simpan nomor ini atau balas pesan ini.
2. Ketik "LOWONGAN" ke nomor WhatsApp [CONSULTANT WA NUMBER] untuk mendapatkan informasi lowongan yang tersedia di perusahaan kami.`;

export const WA_WITHDRAW = `Halo [CONSULTANT NAME],

dengan berat hati saya harus mengundurkan diri dari proses recruitment posisi [POSITION NAME] ini karena [REASON].`;

/* ---------------- helpers ---------------- */

let seq = 1000;
export const uid = (p: string) => `${p}-${(seq++).toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export const nowISO = () => new Date().toISOString();
export const hoursAgoISO = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
export const daysAgoISO = (d: number) => hoursAgoISO(d * 24);
export const daysAheadISO = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
export const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600_000;
export const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
export const fmtDateLong = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fmtDT = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const timeAgo = (iso: string) => {
  const h = hoursSince(iso);
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
};
export const normPhone = (p: string) => p.replace(/[^\d]/g, "").replace(/^0/, "62");
export const waLink = (phone: string, text: string) => `https://wa.me/${normPhone(phone)}?text=${encodeURIComponent(text)}`;
export const meetGen = () => {
  const s = () => Math.random().toString(36).slice(2, 5);
  return `https://meet.google.com/${s()}-${s()}${s().slice(0, 1)}-${s()}`;
};
export const phaseIndex = (req: Requisition, code: PhaseCode) => req.phases.filter((p) => p.enabled).findIndex((p) => p.code === code);
export const enabledPhases = (req: Requisition) => req.phases.filter((p) => p.enabled);
export const nextPhase = (req: Requisition, code: PhaseCode): PhaseCode | null => {
  const en = enabledPhases(req);
  const i = en.findIndex((p) => p.code === code);
  return i >= 0 && i < en.length - 1 ? en[i + 1].code : null;
};
export const defaultPhases = (extra: PhaseCode[] = []): PhaseConfig[] => {
  const flow: PhaseCode[] = ["SCREENING", "SCREENING_INTERVIEW", ...extra.filter((c) => OPTIONAL_PHASES.includes(c)), "USER_INTERVIEW", "OFFER", "PLACED", "ONBOARDING"];
  return flow.map((code) => ({ code, enabled: true, required: !PHASES[code].optional }));
};
export const clientVisible = (app: Application, req: Requisition): boolean => {
  const i = phaseIndex(req, app.phase);
  const ui = phaseIndex(req, "USER_INTERVIEW");
  return app.status === "HIRED" || (ui >= 0 && i >= ui);
};
export const fmtIDR = (n: number) => `Rp ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;

/* ---------------- seed ---------------- */

const ph = (codes: PhaseCode[]): PhaseConfig[] => codes.map((code) => ({ code, enabled: true, required: !PHASES[code].optional }));

export function seedDB(): DB {
  const users: User[] = [
    { id: "USER-001", email: "raka@tapak.id", role: "CONSULTANT", name: "Raka Adiwijaya", phone: "0812-3456-7890", active: true, mfa: true },
    { id: "USER-002", email: "dian@nusafintech.co.id", role: "CLIENT_MASTER", clientId: "CLI-002", name: "Dian Prasetyo", phone: "0811-2200-331", active: true, mfa: true },
    { id: "USER-003", email: "bimo@nusafintech.co.id", role: "CLIENT_HIRING", clientId: "CLI-002", requisitionIds: ["REQ-2026-001", "REQ-2026-002"], name: "Bimo Hartanto", phone: "0811-2200-442", active: true, mfa: false },
    { id: "USER-004", email: "alya@tapak.id", role: "CONSULTANT", name: "Alya Rahmadani", phone: "0813-9900-112", active: true, mfa: true },
  ];
  const clients: Client[] = [
    { id: "CLI-001", companyName: "PT Samudra Biru Logistik", website: "samudrabiru.co.id", picName: "Hesti Wulandari", picPosition: "Head of People", picEmail: "hesti@samudrabiru.co.id", picPhoneWA: "0811-800-220", contractFileName: "MSA_Samudra_2026_signed.pdf", contractStart: daysAgoISO(140), contractEnd: daysAheadISO(225), contractStatus: "SIGNED", notes: "Prefers weekly WhatsApp updates.", active: true, createdAt: daysAgoISO(140) },
    { id: "CLI-002", companyName: "Nusa Fintech Group", website: "nusafintech.co.id", picName: "Dian Prasetyo", picPosition: "VP Operations", picEmail: "dian@nusafintech.co.id", picPhoneWA: "0811-2200-331", contractFileName: "MSA_NusaFintech_2026_signed.pdf", contractStart: daysAgoISO(90), contractEnd: daysAheadISO(275), contractStatus: "SIGNED", active: true, createdAt: daysAgoISO(90) },
    { id: "CLI-003", companyName: "Kirana Retail Indonesia", website: "kiranaretail.id", picName: "Oscar Tanuwidjaja", picPosition: "Chief People Officer", picEmail: "oscar@kiranaretail.id", picPhoneWA: "0815-660-990", contractStart: daysAgoISO(200), contractEnd: daysAheadISO(165), contractStatus: "SIGNED", active: true, createdAt: daysAgoISO(200) },
  ];
  const requisitions: Requisition[] = [
    { id: "REQ-2026-001", clientId: "CLI-002", positionName: "Senior Backend Engineer", department: "Engineering", level: "Senior", headcount: 2, filledCount: 0, recruitmentReason: "Backfill", employmentType: "Permanent", workLocation: "Jakarta Selatan", workArrangement: "Hybrid", minSalary: 22_000_000, maxSalary: 30_000_000, targetDate: daysAheadISO(21), jobDescription: "Own payment-gateway services, mentor mid-level engineers, drive API design.", requiredSkills: "Go, PostgreSQL, gRPC, Kubernetes", hiringManagerName: "Bimo Hartanto", hiringManagerEmail: "bimo@nusafintech.co.id", sourcingChannels: ["LinkedIn", "Glints", "Referral"], status: "OPEN", phases: ph(["SCREENING", "SCREENING_INTERVIEW", "TECHNICAL_SKILL_ASSESSMENT", "USER_INTERVIEW", "OFFER", "PLACED", "ONBOARDING"]), createdAt: daysAgoISO(26) },
    { id: "REQ-2026-002", clientId: "CLI-002", positionName: "Financial Analyst", department: "Finance", level: "Mid", headcount: 1, filledCount: 0, recruitmentReason: "New headcount", employmentType: "Permanent", workLocation: "Jakarta Pusat", workArrangement: "On-site", minSalary: 12_000_000, maxSalary: 16_000_000, targetDate: daysAheadISO(35), jobDescription: "Monthly closing, budget variance analysis, investor reporting.", requiredSkills: "Excel modelling, SQL, IFRS basics", hiringManagerName: "Bimo Hartanto", hiringManagerEmail: "bimo@nusafintech.co.id", sourcingChannels: ["JobStreet", "LinkedIn"], status: "OPEN", phases: ph(["SCREENING", "SCREENING_INTERVIEW", "USER_INTERVIEW", "OFFER", "PLACED", "ONBOARDING"]), createdAt: daysAgoISO(12) },
    { id: "REQ-2026-003", clientId: "CLI-001", positionName: "Warehouse Operations Lead", department: "Operations", level: "Lead", headcount: 2, filledCount: 1, recruitmentReason: "Expansion", employmentType: "Permanent", workLocation: "Surabaya", workArrangement: "On-site", minSalary: 10_000_000, maxSalary: 14_000_000, targetDate: daysAheadISO(14), jobDescription: "Run inbound/outbound ops for the Tanjung Perak hub, 40-person team.", requiredSkills: "WMS, Lean, team leadership", hiringManagerName: "Hesti Wulandari", hiringManagerEmail: "hesti@samudrabiru.co.id", sourcingChannels: ["Glints", "Walk-in"], status: "OPEN", phases: ph(["SCREENING", "SCREENING_INTERVIEW", "BACKGROUND_CHECK", "USER_INTERVIEW", "OFFER", "PLACED", "ONBOARDING"]), createdAt: daysAgoISO(40) },
    { id: "REQ-2026-004", clientId: "CLI-001", positionName: "Fleet Coordinator", department: "Operations", level: "Supervisor", headcount: 1, filledCount: 0, recruitmentReason: "Backfill", employmentType: "Contract", workLocation: "Semarang", workArrangement: "On-site", minSalary: 7_000_000, maxSalary: 9_000_000, targetDate: daysAheadISO(10), jobDescription: "Coordinate 60-truck fleet scheduling and driver rotation.", requiredSkills: "TMS, dispatch planning", hiringManagerName: "Hesti Wulandari", hiringManagerEmail: "hesti@samudrabiru.co.id", sourcingChannels: ["JobStreet"], status: "ON_HOLD", holdSince: daysAgoISO(34), phases: ph(DEFAULT_FLOW), createdAt: daysAgoISO(60), notes: "Client froze budget pending Q3 review — hold started 34 days ago." },
    { id: "REQ-2026-007", clientId: "CLI-001", positionName: "Harbour Admin Officer", department: "Administration", level: "Junior", headcount: 1, filledCount: 0, recruitmentReason: "New headcount", employmentType: "Contract", workLocation: "Surabaya", workArrangement: "On-site", minSalary: 5_500_000, maxSalary: 7_000_000, targetDate: daysAheadISO(40), jobDescription: "Documentation and manifest administration at the harbour office.", requiredSkills: "Admin, Ms. Office, customs docs", hiringManagerName: "Hesti Wulandari", hiringManagerEmail: "hesti@samudrabiru.co.id", sourcingChannels: ["Glints"], status: "ON_HOLD", holdSince: daysAgoISO(5), phases: ph(DEFAULT_FLOW), createdAt: daysAgoISO(30) },
    { id: "REQ-2026-005", clientId: "CLI-003", positionName: "Store Manager", department: "Retail Ops", level: "Manager", headcount: 1, filledCount: 1, recruitmentReason: "Backfill", employmentType: "Permanent", workLocation: "Bandung", workArrangement: "On-site", minSalary: 9_000_000, maxSalary: 12_000_000, targetDate: daysAgoISO(10), jobDescription: "Full P&L ownership for the Dago flagship store.", requiredSkills: "Retail P&L, team of 25", hiringManagerName: "Oscar Tanuwidjaja", hiringManagerEmail: "oscar@kiranaretail.id", sourcingChannels: ["LinkedIn", "Referral"], status: "CLOSED", closedAt: daysAgoISO(3), phases: ph(DEFAULT_FLOW), createdAt: daysAgoISO(80) },
    { id: "REQ-2026-006", clientId: "CLI-003", positionName: "Merchandising Analyst", department: "Commercial", level: "Mid", headcount: 1, filledCount: 0, recruitmentReason: "New headcount", employmentType: "Permanent", workLocation: "Jakarta Utara", workArrangement: "Hybrid", minSalary: 10_000_000, maxSalary: 13_000_000, targetDate: daysAheadISO(45), jobDescription: "Assortment planning, sell-through analytics for 120 stores.", requiredSkills: "SQL, Tableau, retail analytics", hiringManagerName: "Oscar Tanuwidjaja", hiringManagerEmail: "oscar@kiranaretail.id", sourcingChannels: ["LinkedIn"], status: "OPEN", phases: ph(["SCREENING", "SCREENING_INTERVIEW", "PSIKOTEST", "USER_INTERVIEW", "OFFER", "PLACED", "ONBOARDING"]), createdAt: daysAgoISO(6) },
  ];
  const candidates: Candidate[] = [
    { id: "CND-001", code: "CAND-2026-0001", fullName: "Sari Dewanti", phone: "0812-1111-2222", email: "sari.dewanti@gmail.com", city: "Jakarta", dob: "1996-04-12", gender: "Female", educationLevel: "Bachelor", educationInstitution: "Universitas Indonesia", major: "Computer Science", currentCompany: "Tokopedia", currentTitle: "Backend Engineer", yearsExp: 6, expectedSalary: 26_000_000, noticePeriod: "30 days", skills: ["Go", "PostgreSQL", "gRPC"], cvFileName: "CND-001_CV_20260118_091204.pdf", cvFileId: "DRV-88213", createdAt: daysAgoISO(21) },
    { id: "CND-002", code: "CAND-2026-0002", fullName: "Andre Wijaya", phone: "0813-7788-9900", email: "andre.wijaya@outlook.com", city: "Bandung", dob: "1994-09-30", gender: "Male", educationLevel: "Bachelor", educationInstitution: "ITB", major: "Informatics", currentCompany: "Blibli", currentTitle: "Software Engineer II", yearsExp: 7, expectedSalary: 24_000_000, noticePeriod: "1 month", skills: ["Go", "Kubernetes", "Kafka"], cvFileName: "CND-002_CV_20260125_141022.pdf", cvFileId: "DRV-88402", createdAt: daysAgoISO(14) },
    { id: "CND-003", code: "CAND-2026-0003", fullName: "Maya Kartika", phone: "0819-3344-5566", email: "maya.kartika@gmail.com", city: "Depok", educationLevel: "Bachelor", educationInstitution: "Binus", major: "Information Systems", currentCompany: "Freelance", currentTitle: "Backend Developer", yearsExp: 4, expectedSalary: 18_000_000, skills: ["Node.js", "MySQL"], cvFileName: "CND-003_CV_20260128_102200.pdf", cvFileId: "DRV-88455", createdAt: daysAgoISO(7) },
    { id: "CND-004", code: "CAND-2026-0004", fullName: "Fajar Nugroho", phone: "0812-5050-7070", email: "fajar.nug@yahoo.com", city: "Bekasi", currentCompany: "—", currentTitle: "Backend Developer", yearsExp: 5, skills: ["PHP", "Laravel"], cvFileName: "CND-004_CV_20260110_083011.pdf", cvFileId: "DRV-88101", createdAt: daysAgoISO(24) },
    { id: "CND-005", code: "CAND-2026-0005", fullName: "Rina Melati", phone: "0811-2299-4433", email: "rina.melati@gmail.com", city: "Jakarta", dob: "1993-01-22", gender: "Female", educationLevel: "Master", educationInstitution: "UGM", major: "Computer Science", currentCompany: "DANA", currentTitle: "Senior Backend Engineer", yearsExp: 8, expectedSalary: 29_000_000, noticePeriod: "2 months", skills: ["Java", "Spring", "gRPC"], cvFileName: "CND-005_CV_20260105_160410.pdf", cvFileId: "DRV-87990", createdAt: daysAgoISO(33) },
    { id: "CND-006", code: "CAND-2026-0006", fullName: "Galih Saputra", phone: "0812-9001-1234", email: "galih.saputra@gmail.com", city: "Jakarta", yearsExp: 5, skills: ["Python"], cvFileName: "CND-006_CV_20251202_110215.pdf", cvFileId: "DRV-86310", createdAt: daysAgoISO(75) },
    { id: "CND-007", code: "CAND-2026-0007", fullName: "Tono Prasetya", phone: "0813-5555-6666", email: "tono.prasetya@gmail.com", city: "Tangerang", yearsExp: 6, skills: ["Go"], cvFileName: "CND-007_CV_20251108_093340.pdf", cvFileId: "DRV-85100", createdAt: daysAgoISO(180) },
    { id: "CND-008", code: "CAND-2026-0008", fullName: "Dewi Lestari", phone: "0812-8811-3322", email: "dewi.lestari@gmail.com", city: "Jakarta", dob: "1998-06-15", gender: "Female", educationLevel: "Bachelor", educationInstitution: "Universitas Airlangga", major: "Accounting", currentCompany: "EY", currentTitle: "Associate — Assurance", yearsExp: 3, expectedSalary: 13_500_000, noticePeriod: "1 month", skills: ["Excel", "SQL"], cvFileName: "CND-008_CV_20260201_130930.pdf", cvFileId: "DRV-88600", createdAt: daysAgoISO(4) },
    { id: "CND-009", code: "CAND-2026-0009", fullName: "Hendra Gunawan", phone: "0815-7722-0011", email: "hendra.gunawan@gmail.com", city: "Jakarta", yearsExp: 9, educationLevel: "Master", educationInstitution: "UI", major: "Management", currentCompany: "BCA", currentTitle: "Senior Analyst", expectedSalary: 20_000_000, skills: ["Modelling", "IFRS"], cvFileName: "CND-009_CV_20260120_151512.pdf", cvFileId: "DRV-88315", createdAt: daysAgoISO(11) },
    { id: "CND-010", code: "CAND-2026-0010", fullName: "Bagus Wicaksono", phone: "0813-4411-9090", email: "bagus.wicaksono@gmail.com", city: "Surabaya", dob: "1990-11-03", gender: "Male", educationLevel: "Bachelor", educationInstitution: "ITS", major: "Industrial Engineering", currentCompany: "DHL", currentTitle: "Shift Supervisor", yearsExp: 9, expectedSalary: 12_000_000, noticePeriod: "2 weeks", skills: ["WMS", "Lean"], cvFileName: "CND-010_CV_20260112_074512.pdf", cvFileId: "DRV-88150", createdAt: daysAgoISO(30) },
    { id: "CND-011", code: "CAND-2026-0011", fullName: "Lina Anggraini", phone: "0819-1212-8888", email: "lina.anggraini@gmail.com", city: "Surabaya", yearsExp: 8, skills: ["WMS", "SAP"], cvFileName: "CND-011_CV_20260108_101045.pdf", cvFileId: "DRV-88042", createdAt: daysAgoISO(38) },
    { id: "CND-012", code: "CAND-2026-0012", fullName: "Yoga Pratama", phone: "0812-6677-2020", email: "yoga.pratama@gmail.com", city: "Bandung", yearsExp: 11, skills: ["Retail P&L"], cvFileName: "CND-012_CV_20251120_141420.pdf", cvFileId: "DRV-85911", createdAt: daysAgoISO(70) },
    { id: "CND-013", code: "CAND-2026-0013", fullName: "Sinta Maharani", phone: "0813-9090-1414", email: "sinta.maharani@gmail.com", city: "Bandung", yearsExp: 6, skills: ["Retail ops"], cvFileName: "CND-013_CV_20251128_090912.pdf", cvFileId: "DRV-86120", createdAt: daysAgoISO(66) },
    { id: "CND-014", code: "CAND-2026-0014", fullName: "Reza Fahlevi", phone: "0811-5544-7766", email: "reza.fahlevi@gmail.com", city: "Jakarta", dob: "1997-02-08", gender: "Male", educationLevel: "Bachelor", educationInstitution: "Trisakti", major: "Business", currentCompany: "Alfamart", currentTitle: "Category Executive", yearsExp: 4, expectedSalary: 11_000_000, noticePeriod: "1 month", skills: ["SQL", "Tableau"], cvFileName: "CND-014_CV_20260203_113302.pdf", cvFileId: "DRV-88710", createdAt: daysAgoISO(3) },
  ];
  const applications: Application[] = [
    { id: "APP-001", candidateId: "CND-001", requisitionId: "REQ-2026-001", phase: "USER_INTERVIEW", status: "ACTIVE", sourcingChannel: "LinkedIn", applicationDate: daysAgoISO(21), lastInteractionAt: daysAgoISO(1), statusChangedAt: daysAgoISO(2), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(19), slotId: "SLOT-001", active: true },
    { id: "APP-002", candidateId: "CND-002", requisitionId: "REQ-2026-001", phase: "SCREENING_INTERVIEW", status: "ACTIVE", sourcingChannel: "Glints", applicationDate: daysAgoISO(14), lastInteractionAt: daysAgoISO(1), statusChangedAt: daysAgoISO(6), questionnaireStatus: "NOT_STARTED", active: true },
    { id: "APP-003", candidateId: "CND-003", requisitionId: "REQ-2026-001", phase: "SCREENING", status: "ACTIVE", sourcingChannel: "Referral", applicationDate: daysAgoISO(7), lastInteractionAt: hoursAgoISO(130), statusChangedAt: daysAgoISO(7), questionnaireStatus: "NOT_STARTED", active: true },
    { id: "APP-004", candidateId: "CND-004", requisitionId: "REQ-2026-001", phase: "SCREENING", status: "NO_RESPONSE", sourcingChannel: "LinkedIn", applicationDate: daysAgoISO(24), lastInteractionAt: daysAgoISO(9), statusChangedAt: daysAgoISO(3), questionnaireStatus: "NOT_STARTED", active: true },
    { id: "APP-005", candidateId: "CND-005", requisitionId: "REQ-2026-001", phase: "OFFER", status: "RESERVED", sourcingChannel: "Referral", applicationDate: daysAgoISO(33), lastInteractionAt: daysAgoISO(4), statusChangedAt: daysAgoISO(4), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(31), active: true },
    { id: "APP-006", candidateId: "CND-006", requisitionId: "REQ-2026-001", phase: "SCREENING_INTERVIEW", status: "FAILED", sourcingChannel: "JobStreet", applicationDate: daysAgoISO(75), lastInteractionAt: daysAgoISO(60), statusChangedAt: daysAgoISO(60), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(70), active: true },
    { id: "APP-007", candidateId: "CND-007", requisitionId: "REQ-2026-002", phase: "SCREENING_INTERVIEW", status: "NO_SHOW", sourcingChannel: "LinkedIn", applicationDate: daysAgoISO(180), lastInteractionAt: daysAgoISO(160), statusChangedAt: daysAgoISO(160), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(170), active: true },
    { id: "APP-008", candidateId: "CND-008", requisitionId: "REQ-2026-002", phase: "SCREENING", status: "ACTIVE", sourcingChannel: "JobStreet", applicationDate: daysAgoISO(4), lastInteractionAt: daysAgoISO(1), statusChangedAt: daysAgoISO(4), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(2), active: true },
    { id: "APP-009", candidateId: "CND-009", requisitionId: "REQ-2026-002", phase: "SCREENING_INTERVIEW", status: "TALENT_POOL", sourcingChannel: "LinkedIn", applicationDate: daysAgoISO(11), lastInteractionAt: daysAgoISO(5), statusChangedAt: daysAgoISO(5), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(10), active: true },
    { id: "APP-010", candidateId: "CND-010", requisitionId: "REQ-2026-003", phase: "USER_INTERVIEW", status: "ACTIVE", sourcingChannel: "Glints", applicationDate: daysAgoISO(30), lastInteractionAt: daysAgoISO(1), statusChangedAt: daysAgoISO(3), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(28), slotId: "SLOT-005", active: true },
    { id: "APP-011", candidateId: "CND-011", requisitionId: "REQ-2026-003", phase: "PLACED", status: "HIRED", sourcingChannel: "Walk-in", applicationDate: daysAgoISO(38), lastInteractionAt: daysAgoISO(6), statusChangedAt: daysAgoISO(6), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(36), active: true },
    { id: "APP-012", candidateId: "CND-012", requisitionId: "REQ-2026-005", phase: "PLACED", status: "HIRED", sourcingChannel: "Referral", applicationDate: daysAgoISO(70), lastInteractionAt: daysAgoISO(8), statusChangedAt: daysAgoISO(8), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(68), active: true },
    { id: "APP-013", candidateId: "CND-013", requisitionId: "REQ-2026-005", phase: "USER_INTERVIEW", status: "FAILED", sourcingChannel: "LinkedIn", applicationDate: daysAgoISO(66), lastInteractionAt: daysAgoISO(20), statusChangedAt: daysAgoISO(20), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(60), active: true },
    { id: "APP-014", candidateId: "CND-014", requisitionId: "REQ-2026-006", phase: "SCREENING", status: "ACTIVE", sourcingChannel: "LinkedIn", applicationDate: daysAgoISO(3), lastInteractionAt: hoursAgoISO(20), statusChangedAt: daysAgoISO(3), questionnaireStatus: "SUBMITTED", questionnaireSubmittedAt: daysAgoISO(1), active: true },
  ];
  const slots: InterviewSlot[] = [
    { id: "SLOT-001", requisitionId: "REQ-2026-001", phase: "USER_INTERVIEW", date: daysAheadISO(2), start: "10:00", end: "11:00", interviewerId: "USER-003", meetLink: "https://meet.google.com/kpr-tywn-bde", capacity: 1, used: 1, status: "FULL", createdAt: daysAgoISO(4) },
    { id: "SLOT-002", requisitionId: "REQ-2026-001", phase: "SCREENING_INTERVIEW", date: daysAheadISO(1), start: "09:00", end: "09:45", interviewerId: "USER-001", meetLink: "https://meet.google.com/zwa-mpqd-hux", capacity: 3, used: 0, status: "OPEN", createdAt: daysAgoISO(3) },
    { id: "SLOT-003", requisitionId: "REQ-2026-001", phase: "SCREENING_INTERVIEW", date: daysAheadISO(1), start: "13:00", end: "13:45", interviewerId: "USER-004", meetLink: "https://meet.google.com/bcv-nreq-kjm", capacity: 2, used: 2, status: "FULL", createdAt: daysAgoISO(3) },
    { id: "SLOT-004", requisitionId: "REQ-2026-002", phase: "SCREENING_INTERVIEW", date: daysAheadISO(1), start: "09:00", end: "09:45", interviewerId: "USER-001", meetLink: "https://meet.google.com/qwe-rtyu-pas", capacity: 2, used: 0, status: "OPEN", createdAt: daysAgoISO(2) },
    { id: "SLOT-005", requisitionId: "REQ-2026-003", phase: "USER_INTERVIEW", date: daysAheadISO(3), start: "14:00", end: "15:00", interviewerId: "USER-001", meetLink: "https://meet.google.com/sby-hubx-one", capacity: 2, used: 1, status: "OPEN", createdAt: daysAgoISO(5) },
  ];
  const interviews: Interview[] = [
    { id: "INT-001", applicationId: "APP-001", slotId: "SLOT-001", phase: "USER_INTERVIEW", date: daysAheadISO(2), start: "10:00", interviewerId: "USER-003", meetLink: "https://meet.google.com/kpr-tywn-bde", status: "SCHEDULED", createdAt: daysAgoISO(2) },
    { id: "INT-003", applicationId: "APP-010", slotId: "SLOT-005", phase: "USER_INTERVIEW", date: daysAheadISO(3), start: "14:00", interviewerId: "USER-001", meetLink: "https://meet.google.com/sby-hubx-one", status: "SCHEDULED", createdAt: daysAgoISO(3) },
    { id: "INT-004", applicationId: "APP-001", slotId: "SLOT-OLD", phase: "SCREENING_INTERVIEW", date: daysAgoISO(12), start: "10:00", interviewerId: "USER-001", meetLink: "https://meet.google.com/old-scr-nng", status: "COMPLETED", attended: true, createdAt: daysAgoISO(15), evaluation: { evaluatorId: "USER-001", scores: { Composure: 5, Communication: 4, Confidence: 4, Accuracy: 5, Clarity: 4, Relevance: 5, "Problem-solving": 5, Professionalism: 4, Motivation: 5, "Cultural fit": 4, "Overall suitability": 5 }, rating: 4.5, strengths: "Deep Go experience, led incident response at scale, articulate system-design answers.", concerns: "Notice period of 30 days; salary expectation at top of band.", decision: "MOVE_FORWARD", decisionReason: "Strong technical depth and ownership mindset — fast-track to user interview.", createdAt: daysAgoISO(11) } },
  ];
  const audit: AuditEntry[] = [
    { id: "AUD-900", ts: daysAgoISO(26), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", clientId: "CLI-002", action: "REQUISITION_CREATED", objectType: "Requisition", objectId: "REQ-2026-001", next: "Senior Backend Engineer · headcount 2", reason: "New backfill request from VP Operations" },
    { id: "AUD-901", ts: daysAgoISO(24), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", clientId: "CLI-002", action: "PHASE_CONFIG_CHANGED", objectType: "Requisition", objectId: "REQ-2026-001", prev: "Default 6-phase flow", next: "Added TECHNICAL_SKILL_ASSESSMENT after Screening Interview", reason: "Client requires live-coding gate before user interview" },
    { id: "AUD-902", ts: daysAgoISO(21), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", clientId: "CLI-002", action: "CANDIDATE_CREATED", objectType: "Candidate", objectId: "CAND-2026-0001", next: "Sari Dewanti → REQ-2026-001 (LinkedIn)" },
    { id: "AUD-903", ts: daysAgoISO(21), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", action: "CV_UPLOADED", objectType: "Document", objectId: "DRV-88213", next: "CND-001_CV_20260118_091204.pdf · 412 KB · application/pdf" },
    { id: "AUD-904", ts: daysAgoISO(19), userId: "SYSTEM", userName: "Candidate Portal", role: "CANDIDATE", action: "QUESTIONNAIRE_SUBMITTED", objectType: "Application", objectId: "APP-001", next: "v1.2 · 9 sections complete" },
    { id: "AUD-905", ts: daysAgoISO(15), userId: "SYSTEM", userName: "Candidate Portal", role: "CANDIDATE", action: "SLOT_SELECTED", objectType: "Application", objectId: "APP-010", next: "SLOT-005 · 1 seat of 2 reserved under lock" },
    { id: "AUD-906", ts: daysAgoISO(11), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", clientId: "CLI-002", action: "EVALUATION_SUBMITTED", objectType: "Interview", objectId: "INT-004", prev: "SCREENING_INTERVIEW", next: "Rating 4.5 · MOVE_FORWARD → USER_INTERVIEW", reason: "Strong technical depth and ownership mindset" },
    { id: "AUD-907", ts: daysAgoISO(9), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", action: "CV_VIEWED", objectType: "Document", objectId: "DRV-88455", next: "Maya Kartika CV opened in secure viewer" },
    { id: "AUD-908", ts: daysAgoISO(6), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", clientId: "CLI-001", action: "REQ_STATUS_CHANGED", objectType: "Requisition", objectId: "REQ-2026-003", next: "FilledCount 1/2 — Lina Anggraini HIRED" },
    { id: "AUD-909", ts: daysAgoISO(5), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", clientId: "CLI-002", action: "STATUS_CHANGED", objectType: "Application", objectId: "APP-009", prev: "ACTIVE @ SCREENING_INTERVIEW", next: "TALENT_POOL", reason: "Overqualified for mid band; retain for future senior analyst req" },
    { id: "AUD-910", ts: daysAgoISO(4), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", clientId: "CLI-002", action: "STATUS_CHANGED", objectType: "Application", objectId: "APP-005", prev: "ACTIVE @ OFFER", next: "RESERVED", reason: "Backup while primary offer is negotiated" },
    { id: "AUD-911", ts: daysAgoISO(3), userId: "SYSTEM", userName: "Nightly Trigger", role: "SYSTEM", clientId: "CLI-002", action: "STATUS_CHANGED", objectType: "Application", objectId: "APP-004", prev: "ACTIVE @ SCREENING", next: "NO_RESPONSE", reason: "Automated: no questionnaire/slot response within 120 hours" },
    { id: "AUD-912", ts: daysAgoISO(3), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", clientId: "CLI-003", action: "REQ_STATUS_CHANGED", objectType: "Requisition", objectId: "REQ-2026-005", prev: "OPEN", next: "CLOSED", reason: "Headcount fulfilled — Yoga Pratama placed" },
    { id: "AUD-913", ts: daysAgoISO(2), userId: "USER-002", userName: "Dian Prasetyo", role: "CLIENT_MASTER", clientId: "CLI-002", action: "REPORT_VIEWED", objectType: "Report", objectId: "RPT-2026-01", next: "Weekly pipeline snapshot opened" },
    { id: "AUD-914", ts: daysAgoISO(1), userId: "USER-001", userName: "Raka Adiwijaya", role: "CONSULTANT", action: "LOGIN", objectType: "Session", objectId: "USER-001", next: "Google Sign-In + MFA verified (Asia/Jakarta)" },
  ];
  const reports: ReportSnapshot[] = [
    { id: "RPT-2026-01", clientId: "CLI-002", periodStart: daysAgoISO(14), periodEnd: daysAgoISO(7), generatedAt: daysAgoISO(7), generatedBy: "USER-001", recipients: ["dian@nusafintech.co.id", "bimo@nusafintech.co.id"], requisitionIds: ["REQ-2026-001", "REQ-2026-002"], metrics: { openReqs: 2, pipeline: 6, interviews: 3, offers: 1 }, rows: [{ Position: "Senior Backend Engineer", Stage: "User Interview", Candidate: "Sari Dewanti", Status: "Active" }, { Position: "Senior Backend Engineer", Stage: "Offer", Candidate: "Rina Melati", Status: "Reserved" }] },
  ];
  const tokens: Token[] = [
    { token: "TKN-SARI-7Q2M", applicationId: "APP-001", purpose: "INVITE", expiresAt: daysAheadISO(5) },
    { token: "TKN-ANDRE-9X1K", applicationId: "APP-002", purpose: "INVITE", expiresAt: daysAheadISO(5) },
    { token: "TKN-YOGA-3B8N", applicationId: "APP-012", purpose: "INVITE", expiresAt: daysAheadISO(2) },
  ];
  const resources: SourcingResource[] = [
    { id: "SRC-001", clientId: "CLI-002", resourceName: "LinkedIn Recruiter Seat", resourceType: "Sourcing platform", url: "linkedin.com/recruiter", accountUsername: "raka@tapak.id", credentialReference: "VAULT:ln-recruiter-nusa", accessStatus: "ACTIVE", notes: "Shared seat — Nusa Fintech branded profile" },
    { id: "SRC-002", clientId: "CLI-002", resourceName: "Glints Employer Account", resourceType: "Job board", url: "glints.com/employer", accountUsername: "talent@nusafintech.co.id", credentialReference: "VAULT:glints-nusa", accessStatus: "ACTIVE" },
    { id: "SRC-003", clientId: "CLI-001", resourceName: "Glints Employer Account", resourceType: "Job board", url: "glints.com/employer", accountUsername: "people@samudrabiru.co.id", credentialReference: "VAULT:glints-samudra", accessStatus: "PENDING", notes: "Awaiting client password reset" },
    { id: "SRC-004", clientId: "CLI-003", resourceName: "JobStreet Posting Credits", resourceType: "Job board", url: "jobstreet.co.id", accountUsername: "oscar@kiranaretail.id", credentialReference: "VAULT:js-kirana", accessStatus: "ACTIVE" },
  ];
  return {
    users, clients, requisitions, candidates, applications, slots, interviews, audit,
    retentionLog: [], reports, tokens, resources,
    config: { WHATSAPP_INVITE_TEMPLATE: WA_INVITE_DEFAULT, CONSULTANT_WA: "0812-3456-7890", RETENTION_FAILED_HOURS: "48", RETENTION_NORESPONSE_HOURS: "120", HOLD_AUTO_CANCEL_DAYS: "30" },
  };
}
