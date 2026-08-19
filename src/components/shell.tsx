import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../lib/store";
import type { View } from "../lib/store";
import type { Role } from "../lib/data";
import { Icon } from "./ui";

const NAV: { id: View; label: string; icon: string; roles: Role[] }[] = [
  { id: "pipeline", label: "Pipeline", icon: "grid", roles: ["CONSULTANT"] },
  { id: "candidates", label: "Candidates", icon: "users", roles: ["CONSULTANT"] },
  { id: "requisitions", label: "Requisitions", icon: "briefcase", roles: ["CONSULTANT"] },
  { id: "clients", label: "Clients & Contracts", icon: "building", roles: ["CONSULTANT"] },
  { id: "interviews", label: "Interviews", icon: "video", roles: ["CONSULTANT"] },
  { id: "reports", label: "Client Reporting", icon: "file", roles: ["CONSULTANT", "CLIENT_MASTER", "CLIENT_HIRING"] },
  { id: "governance", label: "Audit & Retention", icon: "shield", roles: ["CONSULTANT"] },
];

const ROLE_LABEL: Record<Role, string> = {
  CONSULTANT: "Consultant",
  CLIENT_MASTER: "Client · Master",
  CLIENT_HIRING: "Client · Hiring",
  CANDIDATE: "Candidate Portal",
};

function WibClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const d = now.toLocaleDateString("en-GB", { timeZone: "Asia/Jakarta", weekday: "short", day: "2-digit", month: "short" });
  return (
    <div className="hidden md:flex items-center gap-2 rounded-lg border border-ink-900/10 bg-card px-3 py-1.5">
      <span className="relative w-1.5 h-1.5 rounded-full bg-moss-500 text-moss-500 live-dot" />
      <span className="font-mono text-xs text-ink-700 tabular-nums">{s}</span>
      <span className="text-[10px] font-bold text-ink-400 uppercase">WIB · {d}</span>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { role, setRole, view, setView, db, currentUserId } = useStore();
  const me = db.users.find((u) => u.id === currentUserId);
  const nav = NAV.filter((n) => n.roles.includes(role));
  const client = role === "CLIENT_MASTER" || role === "CLIENT_HIRING" ? db.clients.find((c) => c.id === me?.clientId) : undefined;
  const conflicts = db.slots.filter((s) => s.status === "OPEN" && db.slots.some((o) => o.id !== s.id && o.status !== "CANCELLED" && o.date === s.date && o.interviewerId === s.interviewerId && s.start < o.end && o.start < s.end)).length;

  return (
    <div className="min-h-screen flex">
      {/* ------------ sidebar ------------ */}
      <aside className="bg-shell w-[218px] shrink-0 flex flex-col sticky top-0 h-screen text-paper no-print">
        <div className="px-5 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-hono-400 text-pine-950 grid place-items-center shadow-md shadow-hono-400/20">
              <Icon name="foot" size={20} sw={0} className="fill-current" />
            </span>
            <div>
              <div className="font-display font-extrabold text-lg leading-none tracking-tight">Tapak</div>
              <div className="text-[9.5px] font-mono text-moss-300 uppercase tracking-[0.14em] mt-1">Hiring Ledger</div>
            </div>
          </div>
        </div>

        <div className="px-3.5 pt-4">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-paper/40 px-1.5 mb-1.5">Signed in as</div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-pine-950/60 p-1">
            {(["CONSULTANT", "CLIENT_MASTER", "CLIENT_HIRING", "CANDIDATE"] as Role[]).map((r) => (
              <button key={r} onClick={() => setRole(r)}
                className={`text-[10px] font-bold rounded-md px-1.5 py-1.5 transition-all duration-150 cursor-pointer leading-tight ${role === r ? "bg-hono-400 text-pine-950 shadow" : "text-paper/60 hover:text-paper hover:bg-white/6"}`}>
                {r === "CONSULTANT" ? "Consultant" : r === "CLIENT_MASTER" ? "Client · M" : r === "CLIENT_HIRING" ? "Client · H" : "Candidate"}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex-1 px-3.5 py-4 space-y-0.5 overflow-y-auto scroll-thin">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-paper/40 px-1.5 mb-1.5">Workspace</div>
          {nav.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition-all duration-150 cursor-pointer group relative ${view === n.id ? "bg-white/10 text-hono-300" : "text-paper/65 hover:text-paper hover:bg-white/5"}`}>
              {view === n.id && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-hono-400" />}
              <Icon name={n.icon} size={15} className={view === n.id ? "text-hono-400" : "text-paper/45 group-hover:text-paper/80"} />
              {n.label}
              {n.id === "interviews" && conflicts > 0 && <span className="ml-auto text-[9px] font-bold bg-rust-500 text-white rounded-full px-1.5 py-0.5">{conflicts}</span>}
            </button>
          ))}
          {role !== "CONSULTANT" && (
            <button onClick={() => setRole("CANDIDATE")}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-paper/65 hover:text-paper hover:bg-white/5 transition-all cursor-pointer mt-2 border border-dashed border-white/15">
              <Icon name="user" size={15} className="text-paper/45" /> Open candidate portal
            </button>
          )}
        </nav>

        <div className="px-3.5 pb-4">
          <div className="rounded-lg bg-pine-950/60 border border-white/8 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-moss-700 text-moss-100 grid place-items-center text-[11px] font-bold">{me?.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
              <div className="min-w-0">
                <div className="text-[11.5px] font-bold truncate">{me?.name}</div>
                <div className="text-[9.5px] text-paper/50 truncate">{ROLE_LABEL[role]}{client ? ` · ${client.companyName}` : ""}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-mono text-moss-300">
              <Icon name="lock" size={10} /> Google SSO + MFA · RBAC enforced server-side
            </div>
          </div>
        </div>
      </aside>

      {/* ------------ main ------------ */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-ink-900/8 px-5 py-3 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 text-[11px] text-ink-400 font-medium">
            <span className="text-ink-300">Tapak</span>
            <Icon name="chevR" size={11} />
            <span className="text-ink-700 font-bold">{NAV.find((n) => n.id === view)?.label || "Reporting"}</span>
            {client && <><Icon name="chevR" size={11} /><span className="text-moss-700 font-bold">{client.companyName}</span></>}
          </div>
          <div className="flex items-center gap-2.5">
            <WibClock />
            <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-mono text-ink-400 bg-card border border-ink-900/10 rounded-lg px-2.5 py-1.5">
              <Icon name="shield" size={11} className="text-moss-600" /> Sheets + Drive + Calendar · tenant-isolated
            </span>
          </div>
        </header>
        <main className="flex-1 bg-workspace px-4 sm:px-6 py-5">{children}</main>
        <footer className="px-6 py-3 text-[10px] text-ink-400 flex items-center justify-between border-t border-ink-900/6 bg-paper/60 no-print">
          <span>Tapak ATS · runs as a Google Apps Script web app — Sheets as DB, Drive for CVs, Calendar for Meet slots</span>
          <span className="font-mono">v0.8 · chunk 0–7 demo build</span>
        </footer>
      </div>
    </div>
  );
}
