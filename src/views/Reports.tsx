import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { PHASES, clientVisible, enabledPhases, fmtDate, fmtDT, fmtIDR, hoursSince } from "../lib/data";
import type { Application, Candidate } from "../lib/data";
import { Icon, Btn, ReqPill, StatusPill, PhaseChip, Modal, Empty, SectionTitle, Mono, StackedBar, Kpi, useCountUp } from "../components/ui";

const CATS: { group: string; internal?: boolean; rows: { label: string; get: (c: Candidate, a: Application) => string; internal?: boolean }[] }[] = [
  {
    group: "Identity", rows: [
      { label: "Name", get: (c) => c.fullName },
      { label: "Gender", get: (c) => c.gender || "—" },
      { label: "Age", get: (c) => (c.dob ? `${Math.floor((Date.now() - new Date(c.dob).getTime()) / (365.25 * 86_400_000))} yrs` : "—") },
      { label: "City", get: (c) => c.city || "—" },
    ],
  },
  {
    group: "Background", rows: [
      { label: "Experience", get: (c) => (c.yearsExp ? `${c.yearsExp} years` : "—") },
      { label: "Education", get: (c) => (c.educationLevel ? `${c.educationLevel} — ${c.educationInstitution || ""}` : "—") },
      { label: "Key skills", get: (c) => (c.skills || []).join(", ") || "—" },
      { label: "Current position", get: (c) => (c.currentTitle ? `${c.currentTitle} @ ${c.currentCompany || ""}` : "—") },
    ],
  },
  {
    group: "Logistics", rows: [
      { label: "Salary expectation", get: (c) => (c.expectedSalary ? fmtIDR(c.expectedSalary) : "—") },
      { label: "Availability", get: (c) => c.noticePeriod || "—" },
      { label: "Source", get: (_c, a) => a.sourcingChannel },
    ],
  },
  {
    group: "Results", rows: [
      { label: "Current stage", get: (_c, a) => PHASES[a.phase].name },
      { label: "Screening result", get: (_c, a) => (a.questionnaireStatus === "SUBMITTED" ? "CV + form reviewed" : "Pending form") },
      { label: "Screening interview", get: (_c, a, ) => a.phase === "SCREENING" || a.phase === "SCREENING_INTERVIEW" ? (a.status === "FAILED" ? "Not passed" : "Scheduled/pending") : "Passed" },
      { label: "Current status", get: (_c, a) => a.status.replace("_", " ") },
    ],
  },
  {
    group: "Consultant assessment", internal: true, rows: [
      { label: "Rating", get: (_c, a) => evalRating(a), internal: true },
      { label: "Strengths", get: (_c, a) => evalField(a, "strengths"), internal: true },
      { label: "Concerns", get: (_c, a) => evalField(a, "concerns"), internal: true },
    ],
  },
];

let EVAL_DB: ReturnType<typeof useStore>["db"] | null = null;
function evalRating(a: Application): string {
  const itv = EVAL_DB?.interviews.filter((i) => i.applicationId === a.id && i.evaluation).sort((x, y) => y.createdAt!.localeCompare(x.createdAt!))[0];
  return itv?.evaluation ? `${itv.evaluation.rating} / 5` : "—";
}
function evalField(a: Application, f: "strengths" | "concerns"): string {
  const itv = EVAL_DB?.interviews.filter((i) => i.applicationId === a.id && i.evaluation).sort((x, y) => y.createdAt!.localeCompare(x.createdAt!))[0];
  return itv?.evaluation ? itv.evaluation[f] || "—" : "—";
}

export function Reports() {
  const { db, role, currentUserId, generateReport, viewCV } = useStore();
  const me = db.users.find((u) => u.id === currentUserId);
  const isClient = role === "CLIENT_MASTER" || role === "CLIENT_HIRING";
  const [clientId, setClientId] = useState(isClient ? me?.clientId || db.clients[0].id : db.clients[0].id);
  const effClientId = isClient ? me?.clientId || clientId : clientId;
  const [compReq, setCompReq] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ c: Candidate; a: Application } | null>(null);
  const [reportView, setReportView] = useState<string | null>(null);

  EVAL_DB = db;

  const client = db.clients.find((c) => c.id === effClientId)!;
  const reqs = useMemo(() => {
    let r = db.requisitions.filter((x) => x.clientId === effClientId);
    if (role === "CLIENT_HIRING") r = r.filter((x) => me?.requisitionIds?.includes(x.id));
    return r;
  }, [db.requisitions, effClientId, role, me]);

  const visibleApps = useMemo(() => db.applications
    .filter((a) => reqs.some((r) => r.id === a.requisitionId))
    .map((a) => ({ a, c: db.candidates.find((c) => c.id === a.candidateId)!, r: reqs.find((r) => r.id === a.requisitionId)! }))
    .filter((x) => x.c && (!isClient || clientVisible(x.a, x.r)))
    , [db, reqs, isClient]);

  const metrics = useMemo(() => {
    const headNeed = reqs.reduce((s, r) => s + r.headcount, 0);
    const filled = reqs.reduce((s, r) => s + r.filledCount, 0);
    const phaseSeg = reqs.flatMap((r) => enabledPhases(r)).filter((p, i, arr) => arr.findIndex((x) => x.code === p.code) === i);
    return {
      open: reqs.filter((r) => r.status === "OPEN").length,
      hold: reqs.filter((r) => r.status === "ON_HOLD").length,
      closed: reqs.filter((r) => r.status === "CLOSED").length,
      cancelled: reqs.filter((r) => r.status === "CANCELLED").length,
      headNeed, filled, remaining: headNeed - filled,
      pipeline: visibleApps.filter((x) => x.a.active && x.a.status !== "HIRED").length,
      interviews: db.interviews.filter((i) => i.status === "SCHEDULED" && reqs.some((r) => r.id === db.applications.find((a) => a.id === i.applicationId)?.requisitionId)).length,
      offers: visibleApps.filter((x) => x.a.phase === "OFFER" && x.a.active).length,
      placed: visibleApps.filter((x) => x.a.status === "HIRED").length,
      phaseSeg,
    };
  }, [reqs, visibleApps, db]);

  const compApps = visibleApps.filter((x) => x.a.requisitionId === compReq && x.a.active);
  const compRows = compApps.filter((x) => picked.includes(x.c.id));
  const visibleCats = CATS.filter((c) => !hidden.includes(c.group) && (!isClient || !c.internal));
  const report = db.reports.find((r) => r.id === reportView);
  const avgFill = useCountUp(23);

  return (
    <div className="anim-rise">
      <SectionTitle icon="file" title={isClient ? `${client.companyName} — Hiring Dashboard` : "Client Reporting"}
        sub={isClient ? `Signed in as ${me?.name} · you see ${role === "CLIENT_HIRING" ? "only your assigned requisitions" : "all requisitions for your company"} · candidates appear from User Interview onward` : "Static snapshots for clients — never live database access, never other clients' data"}
        right={!isClient ? <>
          <select className="text-xs rounded-lg border border-ink-900/15 bg-card px-3 py-2 font-semibold text-ink-700 cursor-pointer" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {db.clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
          <Btn onClick={() => generateReport(effClientId)}><Icon name="send" size={13} /> Generate & send report</Btn>
        </> : <Btn tone="outline" size="sm" onClick={() => generateReport(effClientId)}><Icon name="refresh" size={12} /> Latest snapshot</Btn>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 stagger">
        <Kpi label="Open requisitions" value={metrics.open} sub={`${metrics.hold} on hold`} icon="briefcase" />
        <Kpi label="Headcount remaining" value={metrics.remaining} sub={`${metrics.filled}/${metrics.headNeed} filled`} icon="users" accent="#3f6488" />
        <Kpi label="Candidates in pipeline" value={metrics.pipeline} sub={`${metrics.interviews} interviews scheduled`} icon="grid" accent="#a96a12" />
        <Kpi label="Placed · avg 23d to fill" value={metrics.placed} sub={`${metrics.offers} offers in progress`} icon="check" />
      </div>

      {/* per requisition */}
      <div className="bg-card border border-ink-900/8 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-ink-900/6 flex items-center justify-between">
          <h4 className="font-display font-bold text-sm text-ink-900">Requisitions</h4>
          <span className="text-[11px] text-ink-400">{reqs.length} total</span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-left text-xs">
            <thead><tr className="text-[10px] uppercase tracking-wider text-ink-400 border-b border-ink-900/6">
              <th className="px-4 py-2.5 font-bold">Position</th><th className="px-3 py-2.5 font-bold">Status</th><th className="px-3 py-2.5 font-bold">Headcount</th><th className="px-3 py-2.5 font-bold min-w-[180px]">Pipeline by phase</th><th className="px-3 py-2.5 font-bold">Days open</th><th className="px-3 py-2.5 font-bold">Target</th>
            </tr></thead>
            <tbody>
              {reqs.map((r) => {
                const apps = db.applications.filter((a) => a.requisitionId === r.id && (!isClient || clientVisible(a, r)));
                return (
                  <tr key={r.id} className="border-b border-ink-900/4 hover:bg-moss-50/60 transition-colors">
                    <td className="px-4 py-3"><div className="font-bold text-ink-900 text-[13px]">{r.positionName}</div><div className="text-[10px] text-ink-400">{r.department} · <Mono>{r.id}</Mono></div></td>
                    <td className="px-3 py-3"><ReqPill s={r.status} small /></td>
                    <td className="px-3 py-3 font-mono font-bold text-ink-800">{r.filledCount}/{r.headcount}</td>
                    <td className="px-3 py-3"><StackedBar segments={enabledPhases(r).map((p) => ({ v: apps.filter((a) => a.active && a.phase === p.code).length, color: PHASES[p.code].color, title: PHASES[p.code].name }))} /></td>
                    <td className="px-3 py-3 text-ink-500 tabular-nums">{Math.max(0, Math.floor(hoursSince(r.createdAt) / 24))}d</td>
                    <td className="px-3 py-3 text-ink-500">{fmtDate(r.targetDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {reqs.length === 0 && <Empty icon="briefcase" title="No requisitions assigned" />}
        </div>
      </div>

      {/* candidate table + comparison */}
      <div className="grid xl:grid-cols-[1fr_380px] gap-4 items-start mb-4">
        <div className="bg-card border border-ink-900/8 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-900/6 flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-display font-bold text-sm text-ink-900">Candidates {isClient && <span className="text-[10px] font-sans font-semibold text-river-600 bg-river-100 rounded-full px-2 py-0.5 ml-1">visible: user-interview stage & later</span>}</h4>
            <select className="text-[11px] rounded-md border border-ink-900/15 bg-card px-2 py-1.5 font-semibold text-ink-700 cursor-pointer" value={compReq} onChange={(e) => { setCompReq(e.target.value); setPicked([]); }}>
              <option value="">Compare within requisition…</option>
              {reqs.filter((r) => r.status === "OPEN" || r.status === "CLOSED").map((r) => <option key={r.id} value={r.id}>{r.positionName}</option>)}
            </select>
          </div>
          <div className="divide-y divide-ink-900/4">
            {visibleApps.map(({ a, c, r }) => (
              <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-moss-50/60 transition-colors text-xs">
                {compReq && a.requisitionId === compReq && (
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked((p) => p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id])} className="accent-[#17573c] cursor-pointer" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink-900 text-[13px]">{c.fullName} <span className="font-mono text-[9.5px] text-ink-400 font-normal">{c.code}</span></div>
                  <div className="text-[10.5px] text-ink-400 truncate">{r.positionName} · {c.currentTitle ? `${c.currentTitle} @ ${c.currentCompany || ""}` : c.educationInstitution || "—"}</div>
                </div>
                <PhaseChip code={a.phase} small />
                <StatusPill s={a.status} small />
                <Btn size="xs" tone="outline" onClick={() => setSummary({ c, a })}><Icon name="eye" size={11} /> Summary</Btn>
              </div>
            ))}
            {visibleApps.length === 0 && <Empty icon="users" title="No candidates visible yet" sub={isClient ? "Candidates appear here once they reach the User Interview stage." : undefined} />}
          </div>
        </div>

        {/* comparison panel */}
        <div className="bg-card border border-ink-900/8 rounded-xl p-4 xl:sticky xl:top-[70px]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2"><Icon name="grid" size={14} className="text-moss-600" /> Side-by-side</h4>
            <Btn size="xs" tone="outline" disabled={compRows.length < 2} onClick={() => window.print()}><Icon name="printer" size={11} /> Print / PDF</Btn>
          </div>
          {!compReq && <p className="text-[11px] text-ink-400">Select a requisition, then tick 2–4 candidates to compare.</p>}
          {compReq && compRows.length < 2 && <p className="text-[11px] text-ink-400">Pick at least two candidates from the list.</p>}
          {compRows.length >= 2 && (
            <>
              <div className="flex flex-wrap gap-1 mb-3">
                {CATS.filter((c) => (!isClient || !c.internal)).map((c) => (
                  <button key={c.group} onClick={() => setHidden((h) => h.includes(c.group) ? h.filter((x) => x !== c.group) : [...h, c.group])}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors cursor-pointer ${hidden.includes(c.group) ? "bg-ink-900/5 text-ink-400 border-ink-900/10" : "bg-moss-100 text-moss-800 border-moss-200"}`}>
                    {hidden.includes(c.group) ? "+ " : "✓ "}{c.group}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto scroll-thin rounded-lg border border-ink-900/8">
                <table className="w-full text-[11px]">
                  <thead><tr className="bg-pine-900 text-paper">
                    <th className="px-2.5 py-2 text-left font-bold text-[10px] uppercase tracking-wider w-24"> </th>
                    {compRows.map(({ c }) => <th key={c.id} className="px-2.5 py-2 text-left font-bold">{c.fullName.split(" ")[0]}</th>)}
                  </tr></thead>
                  <tbody>
                    {visibleCats.map((cat) => (
                      cat.rows.filter((r) => !isClient || !r.internal).map((row) => (
                        <tr key={cat.group + row.label} className="border-t border-ink-900/5 odd:bg-paper/60">
                          <td className="px-2.5 py-1.5 font-bold text-ink-400 text-[10px] uppercase tracking-wide">{row.label}</td>
                          {compRows.map(({ c, a }) => <td key={c.id} className="px-2.5 py-1.5 text-ink-700">{row.get(c, a)}</td>)}
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-ink-400 mt-2 flex items-center gap-1"><Icon name="lock" size={10} /> Client views exclude internal scores, concerns and other clients.</p>
            </>
          )}
        </div>
      </div>

      {/* report snapshots */}
      <div className="bg-card border border-ink-900/8 rounded-xl p-4">
        <h4 className="font-display font-bold text-sm text-ink-900 flex items-center gap-2 mb-3"><Icon name="mail" size={14} className="text-moss-600" /> Report snapshots <span className="text-[10px] font-sans font-semibold text-ink-400">static — frozen at generation, filed in Reports sheet + Drive</span></h4>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {db.reports.map((r) => {
            const rc = db.clients.find((c) => c.id === r.clientId);
            return (
              <div key={r.id} className="rounded-lg border border-ink-900/8 bg-paper px-3.5 py-3 hover:border-moss-300 transition-colors">
                <div className="flex items-center justify-between">
                  <Mono>{r.id}</Mono>
                  <span className="text-[10px] font-bold text-moss-700 bg-moss-100 rounded-full px-2 py-0.5 flex items-center gap-1"><Icon name="check" size={9} /> delivered</span>
                </div>
                <div className="text-[13px] font-bold text-ink-900 mt-1.5">{rc?.companyName}</div>
                <div className="text-[10.5px] text-ink-400">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)} · generated {fmtDT(r.generatedAt)}</div>
                <div className="text-[10.5px] text-ink-500 mt-1">To: {r.recipients.join(", ")}</div>
                <div className="mt-2.5 flex gap-1.5">
                  <Btn size="xs" tone="outline" onClick={() => setReportView(r.id)}><Icon name="eye" size={11} /> View</Btn>
                  <Btn size="xs" tone="ghost" onClick={() => window.print()}><Icon name="download" size={11} /> PDF</Btn>
                </div>
              </div>
            );
          })}
          {db.reports.length === 0 && <div className="md:col-span-3"><Empty icon="mail" title="No reports yet" /></div>}
        </div>
      </div>

      {/* summary modal */}
      {summary && (
        <Modal open onClose={() => setSummary(null)} title={`Candidate Summary — ${summary.c.fullName}`} sub={`${client.companyName} · generated ${fmtDT(new Date().toISOString())} · secure web view / print-ready`} wide
          footer={<>
            <Btn tone="outline" onClick={() => { viewCV(summary.c.id); }}><Icon name="file" size={13} /> Open CV</Btn>
            <Btn tone="outline" onClick={() => window.print()}><Icon name="printer" size={13} /> Print / PDF</Btn>
            <Btn onClick={() => setSummary(null)}>Done</Btn>
          </>}>
          <SummaryBody c={summary.c} a={summary.a} internal={!isClient} />
        </Modal>
      )}

      {report && (
        <Modal open onClose={() => setReportView(null)} title={`Static report — ${report.id}`} sub={`Frozen ${fmtDT(report.generatedAt)} · does not change after generation`} wide
          footer={<Btn onClick={() => setReportView(null)}>Close</Btn>}>
          <div className="text-xs space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(report.metrics).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-paper px-3 py-2"><div className="text-[9.5px] font-bold uppercase tracking-wider text-ink-400">{k}</div><div className="font-display font-extrabold text-xl text-ink-900">{v}</div></div>
              ))}
            </div>
            <div className="rounded-lg border border-ink-900/8 overflow-hidden">
              <table className="w-full text-left text-[11.5px]">
                <thead><tr className="bg-pine-900 text-paper text-[10px] uppercase tracking-wider">{Object.keys(report.rows[0] || {}).map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead>
                <tbody>{report.rows.map((row, i) => <tr key={i} className="border-t border-ink-900/5 odd:bg-paper/60">{Object.values(row).map((v, j) => <td key={j} className="px-3 py-2 text-ink-700">{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <p className="text-[10.5px] text-ink-400 flex items-center gap-1.5"><Icon name="lock" size={11} /> Snapshot excludes internal notes, sourcing credentials, other clients and pre-interview candidates.</p>
          </div>
        </Modal>
      )}
      <span className="hidden">{avgFill}</span>
    </div>
  );
}

function SummaryBody({ c, a, internal }: { c: Candidate; a: Application; internal: boolean }) {
  const { db } = useStore();
  EVAL_DB = db;
  const req = db.requisitions.find((r) => r.id === a.requisitionId);
  const timeline = db.audit.filter((t) => t.objectId === a.id || t.objectId === c.code).slice(0, 8);
  const grid: [string, string][] = [
    ["Candidate code", c.code], ["Position", `${req?.positionName} (${req?.id})`],
    ["Contact", `${c.phone} · ${c.email}`], ["Source", a.sourcingChannel],
    ["Education", c.educationLevel ? `${c.educationLevel} — ${c.educationInstitution || ""} (${c.major || "—"})` : "—"],
    ["Experience", c.yearsExp ? `${c.yearsExp} years · ${c.currentTitle || ""} @ ${c.currentCompany || "—"}` : "—"],
    ["Key skills", (c.skills || []).join(", ") || "—"], ["Salary expectation", c.expectedSalary ? fmtIDR(c.expectedSalary) : "—"],
    ["Availability", c.noticePeriod || "—"], ["Current stage", `${PHASES[a.phase].name} · ${a.status.replace("_", " ")}`],
    ["Screening", a.questionnaireStatus === "SUBMITTED" ? "CV + questionnaire reviewed" : "Questionnaire pending"],
    ["Screening interview", evalRating(a) !== "—" ? `Rating ${evalRating(a)}` : a.phase === "SCREENING" || a.phase === "SCREENING_INTERVIEW" ? "Upcoming" : "Passed"],
  ];
  return (
    <div className="text-xs space-y-4">
      <div className="grid sm:grid-cols-2 gap-x-5 gap-y-2.5">
        {grid.map(([k, v]) => (
          <div key={k} className="flex gap-3"><span className="w-32 shrink-0 text-[10px] font-bold uppercase tracking-wider text-ink-400 pt-0.5">{k}</span><span className="text-ink-800 font-medium">{v}</span></div>
        ))}
      </div>
      {internal && (
        <div className="rounded-xl bg-pine-900 text-paper p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-hono-400 mb-2 flex items-center gap-1.5"><Icon name="lock" size={11} /> Consultant-only assessment</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><div className="text-[10px] text-paper/50 font-bold uppercase">Strengths</div><p className="mt-1 text-paper/90 leading-relaxed">{evalField(a, "strengths")}</p></div>
            <div><div className="text-[10px] text-paper/50 font-bold uppercase">Concerns</div><p className="mt-1 text-paper/90 leading-relaxed">{evalField(a, "concerns")}</p></div>
          </div>
        </div>
      )}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-2">Activity log (sanitized)</div>
        <div className="rounded-lg border border-ink-900/8 divide-y divide-ink-900/4 overflow-hidden">
          {timeline.map((t) => (
            <div key={t.id} className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
              <span className="font-mono text-[9.5px] font-bold text-moss-700">{t.action}</span>
              <span className="text-ink-500 truncate flex-1 text-right">{t.next || t.reason || ""}</span>
              <span className="font-mono text-[9.5px] text-ink-300 shrink-0">{fmtDT(t.ts)}</span>
            </div>
          ))}
          {timeline.length === 0 && <div className="px-3 py-2 text-ink-400">No activity yet.</div>}
        </div>
      </div>
    </div>
  );
}
