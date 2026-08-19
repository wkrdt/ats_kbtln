import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../lib/store";
import { PHASES, STATUS_META, REQ_META } from "../lib/data";
import type { PhaseCode, CandidateStatus, ReqStatus } from "../lib/data";

/* ---------------- icons ---------------- */
const P: Record<string, ReactNode> = {
  grid: <><path d="M3 3h7v7H3z" /><path d="M14 3h7v7h-7z" /><path d="M14 14h7v7h-7z" /><path d="M3 14h7v7H3z" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-4h6v4" /><path d="M8 6h2M14 6h2M8 10h2M14 10h2M8 14h2M14 14h2" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8M16 17H8" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  chevD: <path d="m6 9 6 6 6-6" />,
  chevR: <path d="m9 18 6-6-6-6" />,
  arrowR: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  printer: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M21 3v5h-5" /><path d="M3 21v-5h5" /></>,
  external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  up: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>,
  down: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
  sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
  filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  video: <><path d="m22 8-6 4 6 4V8z" /><rect x="2" y="6" width="14" height="12" rx="2" /></>,
  foot: <path d="M12 2c-3.4 0-6 2.9-6 7.4 0 3 1.4 4.8 1.4 7.1 0 1.7 1.3 3 3 3h3.2c1.7 0 3-1.3 3-3 0-2.3 1.4-4.1 1.4-7.1C18 4.9 15.4 2 12 2z" />,
};

export function Icon({ name, size = 16, className = "", sw = 2 }: { name: keyof typeof P | string; size?: number; className?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      {P[name] || P.alert}
    </svg>
  );
}

/* ---------------- buttons ---------------- */
const tones: Record<string, string> = {
  solid: "bg-moss-700 text-[#f2f7f2] hover:bg-moss-800 shadow-sm shadow-moss-900/20 border border-moss-800/60",
  soft: "bg-moss-100 text-moss-800 hover:bg-moss-200 border border-moss-200/70",
  ghost: "text-ink-700 hover:bg-ink-900/6 border border-transparent",
  outline: "border border-ink-900/15 text-ink-700 hover:border-moss-500 hover:text-moss-700 bg-card",
  danger: "bg-rust-500 text-white hover:bg-rust-600 border border-rust-600/50",
  dangerSoft: "bg-rust-100 text-rust-600 hover:bg-rust-100/70 border border-rust-400/30",
  amber: "bg-hono-400 text-pine-950 hover:bg-hono-500 border border-hono-500/50 font-semibold",
  dark: "bg-pine-900 text-paper hover:bg-pine-800 border border-pine-800",
};
export function Btn({ children, onClick, tone = "solid", size = "md", disabled, className = "", title, type }: {
  children: ReactNode; onClick?: (e: React.MouseEvent) => void; tone?: keyof typeof tones; size?: "xs" | "sm" | "md"; disabled?: boolean; className?: string; title?: string; type?: "button" | "submit";
}) {
  const sz = size === "xs" ? "text-[11px] px-2 py-1 gap-1" : size === "sm" ? "text-xs px-2.5 py-1.5 gap-1.5" : "text-[13px] px-3.5 py-2 gap-2";
  return (
    <button type={type || "button"} title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${sz} ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}

/* ---------------- pills ---------------- */
export function MetaPill({ meta, small }: { meta: { label: string; fg: string; bg: string; dot: string }; small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${small ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"}`} style={{ color: meta.fg, background: meta.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}
export const StatusPill = ({ s, small }: { s: CandidateStatus; small?: boolean }) => <MetaPill meta={STATUS_META[s]} small={small} />;
export const ReqPill = ({ s, small }: { s: ReqStatus; small?: boolean }) => <MetaPill meta={REQ_META[s]} small={small} />;
export function PhaseChip({ code, small, showDot = true }: { code: PhaseCode; small?: boolean; showDot?: boolean }) {
  const p = PHASES[code];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${small ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"}`} style={{ color: p.color, borderColor: `${p.color}55`, background: `${p.color}14` }}>
      {showDot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />}
      {p.name}
    </span>
  );
}

/* ---------------- modal & drawer ---------------- */
export function Modal({ open, onClose, title, sub, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto" role="dialog" aria-modal>
      <div className="fixed inset-0 bg-pine-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`anim-modal relative bg-card rounded-xl shadow-2xl shadow-pine-950/30 border border-ink-900/10 w-full ${wide ? "max-w-3xl" : "max-w-lg"} my-auto`}>
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-ink-900/8">
          <div>
            <h3 className="font-display font-bold text-lg text-ink-900 leading-tight">{title}</h3>
            {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-900/6 transition-colors cursor-pointer" aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="px-5 py-4 max-h-[65vh] overflow-y-auto scroll-thin">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-ink-900/8 flex justify-end gap-2 bg-paper/60 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 no-print">
      <div className="absolute inset-0 bg-pine-950/45" onClick={onClose} />
      <div className="anim-drawer absolute right-0 top-0 h-full w-full max-w-xl bg-paper shadow-2xl border-l border-ink-900/10 overflow-y-auto scroll-thin">
        {children}
      </div>
    </div>
  );
}

/* ---------------- reason modal (audited manual action) ---------------- */
export function ReasonModal({ open, onClose, title, sub, context, quick, confirmLabel = "Confirm & log", tone = "solid", onConfirm, requireReason = true }: {
  open: boolean; onClose: () => void; title: string; sub?: string; context?: [string, string][]; quick?: string[]; confirmLabel?: string; tone?: keyof typeof tones; onConfirm: (reason: string) => void; requireReason?: boolean;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={title} sub={sub}
      footer={<>
        <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
        <Btn tone={tone} disabled={requireReason && reason.trim().length < 4} onClick={() => { onConfirm(reason.trim()); onClose(); }}>
          <Icon name="shield" size={14} /> {confirmLabel}
        </Btn>
      </>}>
      {context && context.length > 0 && (
        <div className="rounded-lg border border-ink-900/10 bg-paper overflow-hidden mb-4">
          {context.map(([k, v], i) => (
            <div key={i} className={`flex gap-3 px-3 py-2 text-xs ${i > 0 ? "border-t border-ink-900/6" : ""}`}>
              <span className="w-24 shrink-0 text-ink-400 font-medium uppercase tracking-wide text-[10px] pt-0.5">{k}</span>
              <span className="text-ink-700 font-medium">{v}</span>
            </div>
          ))}
        </div>
      )}
      {quick && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {quick.map((q) => (
            <button key={q} onClick={() => setReason(q)} className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${reason === q ? "bg-moss-700 text-white border-moss-700" : "bg-card border-ink-900/12 text-ink-500 hover:border-moss-400 hover:text-moss-700"}`}>{q}</button>
          ))}
        </div>
      )}
      <label className="block text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-1.5">Reason / remark <span className="text-rust-500">*</span></label>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus
        placeholder="This reason is written to the AuditLog and cannot be edited later…"
        className="w-full rounded-lg border border-ink-900/15 bg-card px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20 resize-none" />
      <p className="mt-2 text-[11px] text-ink-400 flex items-center gap-1.5"><Icon name="lock" size={11} /> Recorded with your user ID, timestamp (Asia/Jakarta) and previous → new values.</p>
    </Modal>
  );
}

/* ---------------- form bits ---------------- */
export const inputCls = "w-full rounded-lg border border-ink-900/15 bg-card px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-moss-500 focus:ring-2 focus:ring-moss-500/20";
export function Field({ label, children, hint, req }: { label: string; children: ReactNode; hint?: string; req?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-1.5">{label} {req && <span className="text-rust-500">*</span>}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-400 mt-1">{hint}</span>}
    </label>
  );
}

/* ---------------- KPI with count-up ---------------- */
export function useCountUp(target: number, dur = 700) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setV(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, dur]);
  return v;
}
export function Kpi({ label, value, sub, icon, accent = "#17573c" }: { label: string; value: number; sub?: string; icon: string; accent?: string }) {
  const v = useCountUp(value);
  return (
    <div className="bg-card rounded-xl border border-ink-900/8 px-4 py-3.5 flex items-center gap-3.5 hover:border-moss-300 hover:-translate-y-0.5 transition-all duration-200 shadow-sm shadow-ink-900/4">
      <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: `${accent}16`, color: accent }}>
        <Icon name={icon} size={17} />
      </div>
      <div className="min-w-0">
        <div className="font-display font-extrabold text-2xl leading-none text-ink-900 tabular-nums">{v}</div>
        <div className="text-[11px] font-semibold text-ink-500 mt-1 truncate">{label}</div>
        {sub && <div className="text-[10px] text-ink-400 truncate">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------------- stacked phase bar ---------------- */
export function StackedBar({ segments, height = 8 }: { segments: { v: number; color: string; title?: string }[]; height?: number }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.v, 0));
  return (
    <div className="w-full rounded-full overflow-hidden flex bg-ink-900/8" style={{ height }}>
      {segments.filter((s) => s.v > 0).map((s, i) => (
        <div key={i} title={s.title} className="anim-bar transition-all duration-500" style={{ width: `${(s.v / total) * 100}%`, background: s.color, animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

/* ---------------- toasts ---------------- */
export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  const toneMap = { ok: ["#17573c", "#d8ecdf", "check"], warn: ["#6b440e", "#fbeed3", "alert"], err: ["#6e2a21", "#f9e3de", "alert"], info: ["#2b4560", "#dde9f2", "zap"] } as const;
  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 no-print">
      {toasts.map((t) => {
        const [fg, bg, ic] = toneMap[t.tone];
        return (
          <button key={t.id} onClick={() => dismissToast(t.id)} className="anim-toast text-left flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 shadow-lg shadow-pine-950/15 border max-w-sm cursor-pointer" style={{ color: fg, background: bg, borderColor: `${fg}33` }}>
            <span className="mt-0.5"><Icon name={ic} size={14} /></span>
            <span className="text-xs font-semibold leading-snug">{t.msg}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- misc ---------------- */
export function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const { toast } = useStore();
  return (
    <Btn tone="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(text).then(() => toast("Copied to clipboard", "info")).catch(() => toast("Copy failed", "err")); }}>
      <Icon name="copy" size={13} /> {label}
    </Btn>
  );
}
export function Empty({ icon = "inbox", title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto w-12 h-12 rounded-xl bg-ink-900/5 text-ink-300 grid place-items-center mb-3"><Icon name={icon} size={22} /></div>
      <div className="font-display font-bold text-ink-700">{title}</div>
      {sub && <div className="text-xs text-ink-400 mt-1 max-w-xs mx-auto">{sub}</div>}
    </div>
  );
}
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded bg-ink-900/6 text-ink-700 border border-ink-900/8 ${className}`}>{children}</span>;
}
export function SectionTitle({ icon, title, sub, right }: { icon: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
      <div>
        <h2 className="font-display font-extrabold text-xl sm:text-2xl text-ink-900 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-pine-900 text-hono-400 grid place-items-center"><Icon name={icon} size={16} /></span>
          {title}
        </h2>
        {sub && <p className="text-xs text-ink-500 mt-1.5">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
