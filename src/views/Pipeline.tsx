import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { PHASES, enabledPhases, nextPhase, hoursSince, fmtIDR } from "../lib/data";
import type { PhaseCode, Application, Candidate } from "../lib/data";
import { Icon, Btn, Kpi, PhaseChip, StatusPill, ReasonModal, Empty, SectionTitle, Mono } from "../components/ui";

interface DragPayload { appId: string; from: PhaseCode }

export function Pipeline({ openCandidate }: { openCandidate: (id: string) => void }) {
  const { db, role, currentUserId, setView, advancePhase } = useStore();
  const openReqs = useMemo(() => db.requisitions.filter((r) => r.status === "OPEN" || r.status === "ON_HOLD"), [db.requisitions]);
  const scoped = role === "CLIENT_HIRING" ? openReqs.filter((r) => db.users.find((u) => u.id === currentUserId)?.requisitionIds?.includes(r.id)) : openReqs;
  const [reqId, setReqId] = useState(scoped[0]?.id || "");
  const req = db.requisitions.find((r) => r.id === reqId) || scoped[0];
  const [dragOver, setDragOver] = useState<PhaseCode | null>(null);
  const [pending, setPending] = useState<{ app: Application; cand: Candidate; to: PhaseCode; skip: boolean } | null>(null);

  const apps = useMemo(() => db.applications.filter((a) => a.requisitionId === req?.id && a.active && (a.status === "ACTIVE" || a.status === "RESERVED")), [db.applications, req]);
  const activeAll = db.applications.filter((a) => a.active && (a.status === "ACTIVE" || a.status === "RESERVED"));
  const weekInterviews = db.interviews.filter((i) => i.status === "SCHEDULED" && hoursSince(i.date) > -24 * 7 && hoursSince(i.date) < 0);
  const offers = db.applications.filter((a) => a.active && a.phase === "OFFER" && a.status === "ACTIVE").length;

  if (!req) return <Empty icon="briefcase" title="No open requisitions" sub="Create a requisition to start a pipeline." />;
  const phases = enabledPhases(req);
  const client = db.clients.find((c) => c.id === req.clientId);

  const onDrop = (code: PhaseCode) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const p = JSON.parse(e.dataTransfer.getData("text/plain")) as DragPayload;
      const app = db.applications.find((a) => a.id === p.appId);
      const cand = db.candidates.find((c) => c.id === app?.candidateId);
      if (!app || !cand || app.phase === code) return;
      const fromIdx = phases.findIndex((x) => x.code === p.from);
      const toIdx = phases.findIndex((x) => x.code === code);
      setPending({ app, cand, to: code, skip: toIdx > fromIdx + 1 || toIdx < fromIdx });
    } catch { /* ignore */ }
  };

  return (
    <div className="anim-rise">
      <SectionTitle icon="grid" title="Recruitment Pipeline" sub="Live view across configured phases — every move requires a reason and lands in the AuditLog."
        right={<Btn tone="outline" size="sm" onClick={() => setView("requisitions")}><Icon name="briefcase" size={13} /> Requisitions</Btn>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 stagger">
        <Kpi label="Active candidates" value={activeAll.length} icon="users" />
        <Kpi label="Open requisitions" value={openReqs.filter((r) => r.status === "OPEN").length} icon="briefcase" accent="#3f6488" />
        <Kpi label="Interviews · next 7 days" value={weekInterviews.length} icon="video" accent="#a96a12" />
        <Kpi label="Offers in progress" value={offers} icon="send" accent="#17573c" />
      </div>

      {/* requisition selector */}
      <div className="flex gap-2 overflow-x-auto scroll-thin pb-2 mb-4">
        {scoped.map((r) => {
          const cl = db.clients.find((c) => c.id === r.clientId);
          const cnt = db.applications.filter((a) => a.requisitionId === r.id && a.active && (a.status === "ACTIVE" || a.status === "RESERVED")).length;
          const sel = r.id === req.id;
          return (
            <button key={r.id} onClick={() => setReqId(r.id)}
              className={`shrink-0 text-left rounded-xl border px-3.5 py-2.5 transition-all duration-150 cursor-pointer ${sel ? "bg-pine-900 text-paper border-pine-900 shadow-lg shadow-pine-900/20 -translate-y-0.5" : "bg-card border-ink-900/10 hover:border-moss-400"}`}>
              <div className={`text-[12.5px] font-bold ${sel ? "text-hono-300" : "text-ink-900"}`}>{r.positionName}</div>
              <div className={`text-[10.5px] mt-0.5 ${sel ? "text-paper/60" : "text-ink-400"}`}>{cl?.companyName} · {cnt} in play · {r.filledCount}/{r.headcount} filled</div>
            </button>
          );
        })}
      </div>

      {/* req summary strip */}
      <div className="bg-card border border-ink-900/8 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-bold text-ink-900 text-sm font-display">{req.positionName}</span>
        <span className="text-ink-500">{client?.companyName}</span>
        <span className="text-ink-500"><Mono>{req.id}</Mono></span>
        <span className="text-ink-500 flex items-center gap-1"><Icon name="users" size={12} /> {req.filledCount}/{req.headcount} filled</span>
        <span className="text-ink-500 flex items-center gap-1"><Icon name="clock" size={12} /> target {new Date(req.targetDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
        <span className="text-ink-500">{fmtIDR(req.minSalary)}–{fmtIDR(req.maxSalary)} · {req.workArrangement}</span>
        {req.status === "ON_HOLD" && <span className="flex items-center gap-1 font-bold text-hono-600"><Icon name="alert" size={12} /> ON HOLD — auto-cancel in {Math.max(0, 30 - Math.floor(hoursSince(req.holdSince || req.createdAt) / 24))}d</span>}
      </div>

      {/* board */}
      <div className="flex gap-3 overflow-x-auto scroll-thin pb-4 items-start">
        {phases.map((p) => {
          const col = apps.filter((a) => a.phase === p.code).map((a) => ({ a, c: db.candidates.find((c) => c.id === a.candidateId)! })).filter((x) => x.c);
          const np = nextPhase(req, p.code);
          return (
            <div key={p.code}
              onDragOver={(e) => { e.preventDefault(); setDragOver(p.code); }}
              onDragLeave={() => setDragOver((d) => (d === p.code ? null : d))}
              onDrop={onDrop(p.code)}
              className={`shrink-0 w-[248px] rounded-xl border transition-all duration-150 ${dragOver === p.code ? "border-moss-500 bg-moss-50 shadow-lg shadow-moss-500/10" : "border-ink-900/8 bg-paper-deep/60"}`}>
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <PhaseChip code={p.code} small />
                <span className="text-[10.5px] font-bold text-ink-400 bg-card border border-ink-900/8 rounded-full px-2 py-0.5 tabular-nums">{col.length}</span>
              </div>
              <div className="px-2 pb-2 space-y-2 min-h-[90px]">
                {col.length === 0 && <div className="text-[10.5px] text-ink-300 text-center py-5 border border-dashed border-ink-900/10 rounded-lg">Drop candidates here</div>}
                {col.map(({ a, c }) => (
                  <div key={a.id} draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ appId: a.id, from: a.phase } satisfies DragPayload))}
                    onClick={() => openCandidate(c.id)}
                    className="group bg-card rounded-lg border border-ink-900/8 px-3 py-2.5 cursor-pointer hover:border-moss-400 hover:shadow-md hover:shadow-moss-900/8 hover:-translate-y-0.5 transition-all duration-150">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-ink-900 truncate">{c.fullName}</div>
                        <div className="font-mono text-[9.5px] text-ink-400 mt-0.5">{c.code}</div>
                      </div>
                      <StatusPill s={a.status} small />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-ink-400">
                      <span className="flex items-center gap-1"><Icon name="clock" size={10} /> {Math.floor(hoursSince(a.statusChangedAt) / 24)}d in phase</span>
                      <span className="flex items-center gap-1">
                        {a.questionnaireStatus === "SUBMITTED" ? <span className="text-moss-600 flex items-center gap-0.5"><Icon name="check" size={10} /> form</span> : <span className="text-hono-600 flex items-center gap-0.5"><Icon name="alert" size={10} /> form due</span>}
                        {a.withdrawalRequest && <span className="text-rust-500 font-bold">withdraw?</span>}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {np && a.status === "ACTIVE" && (
                        <button onClick={(e) => { e.stopPropagation(); setPending({ app: a, cand: c, to: np, skip: false }); }}
                          className="flex-1 text-[10px] font-bold bg-moss-700 text-white rounded-md py-1 hover:bg-moss-800 transition-colors cursor-pointer flex items-center justify-center gap-1">
                          <Icon name="arrowR" size={10} /> Advance
                        </button>
                      )}
                      {p.code === "PLACED" && a.status === "ACTIVE" && (
                        <button onClick={(e) => { e.stopPropagation(); setPending({ app: a, cand: c, to: "PLACED", skip: false }); }}
                          className="flex-1 text-[10px] font-bold bg-pine-900 text-hono-300 rounded-md py-1 hover:bg-pine-800 transition-colors cursor-pointer">
                          Mark HIRED
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-ink-400 mt-1">
        <Icon name="zap" size={12} className="text-hono-500" />
        Drag a card to any later column to <b className="text-ink-700">skip phases</b> — skips are flagged in the audit trail. Hover a card for quick actions; click to open the full record.
      </div>

      {/* advance / skip modal */}
      <ReasonModal
        open={!!pending && !(pending?.to === "PLACED" && pending?.app.phase === "PLACED")}
        onClose={() => setPending(null)}
        title={pending?.skip ? "Skip phase — reason required" : "Advance candidate"}
        sub={pending?.skip ? "Skipping phases is allowed but permanently flagged in the AuditLog." : "Normal progression along the configured flow."}
        context={pending ? [
          ["Candidate", `${pending.cand.fullName} · ${pending.cand.code}`],
          ["From", PHASES[pending.app.phase].name],
          ["To", PHASES[pending.to].name],
          ["Requisition", `${req.positionName} (${req.id})`],
        ] : []}
        quick={["Passed screening criteria", "Client expedited request", "Strong assessment result", "Phase duplicated by client process"]}
        confirmLabel={pending?.skip ? "Log skip & move" : "Advance & log"}
        onConfirm={(reason) => pending && advancePhase(pending.app.id, pending.to, reason)}
      />
      <HireModal pending={pending} onClose={() => setPending(null)} reqId={req.id} />
    </div>
  );
}

function HireModal({ pending, onClose, reqId }: { pending: { app: Application; cand: Candidate; to: PhaseCode; skip: boolean } | null; onClose: () => void; reqId: string }) {
  const { db, setAppStatus } = useStore();
  const isHire = !!pending && pending.to === "PLACED" && pending.app.phase === "PLACED";
  const req = db.requisitions.find((r) => r.id === reqId);
  return (
    <ReasonModal open={isHire} onClose={onClose} title="Confirm placement (HIRED)"
      sub={`Filled count moves to ${Math.min(req?.headcount || 0, (req?.filledCount || 0) + 1)}/${req?.headcount}. The requisition auto-closes when full.`}
      context={pending ? [["Candidate", `${pending.cand.fullName} · ${pending.cand.code}`], ["Requisition", `${req?.positionName} (${reqId})`], ["Result", "Status → HIRED · audit entry written"]] : []}
      quick={["Signed offer & joined", "Joined onboarding today"]}
      confirmLabel="Mark HIRED" tone="dark"
      onConfirm={(reason) => pending && setAppStatus(pending.app.id, "HIRED", reason)}
    />
  );
}

