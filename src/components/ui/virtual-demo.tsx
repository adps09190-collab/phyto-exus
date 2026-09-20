import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Clapperboard,
  Droplets,
  FlameKindling,
  Gauge,
  Power,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  Thermometer,
  TriangleAlert,
  Wind,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSimulation } from "@/hooks/use-simulation";
import { STATE_META } from "@/lib/simulation";
import { useThresholds } from "@/lib/thresholds";

// -------------------------------------------------------------------------
// Small helpers
// -------------------------------------------------------------------------

const fmt = (v: number, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : "--");
const W = 900;
const H = 260;
const PAD = { l: 38, r: 12, t: 14, b: 22 };

function pathFrom(points: (number | null)[], min: number, max: number) {
  let d = "";
  let penDown = false;
  points.forEach((p, i) => {
    if (p === null || !Number.isFinite(p)) {
      penDown = false;
      return;
    }
    const x = PAD.l + (i / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
    const y = PAD.t + (1 - (p - min) / (max - min || 1)) * (H - PAD.t - PAD.b);
    d += `${penDown ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    penDown = true;
  });
  return d.trim();
}

/** Live-head coordinates for the pulsing endpoint marker. */
function lastPoint(points: (number | null)[], min: number, max: number) {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p !== null && Number.isFinite(p)) {
      const x = PAD.l + (i / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
      const y = PAD.t + (1 - (p - min) / (max - min || 1)) * (H - PAD.t - PAD.b);
      return { x, y };
    }
  }
  return null;
}

// -------------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------------

function StateBanner({ state }: { state: keyof typeof STATE_META }) {
  const meta = STATE_META[state];
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-5 py-3 transition-colors duration-500"
      style={{ borderColor: `${meta.color}55`, background: `${meta.color}14` }}
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: meta.color }} />
        <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: meta.color }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-black tracking-widest text-sm transition-colors duration-500" style={{ color: meta.color }}>
          SYSTEM STATE: {meta.label}
        </div>
        <div className="text-xs text-muted-foreground truncate">{meta.description}</div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  invalid,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  unit: string;
  sub: string;
  invalid?: boolean;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-4 transition-all duration-500">
      <div className="flex items-center justify-between">
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={cn("w-4 h-4", invalid ? "text-muted-foreground/40" : "")} style={!invalid ? { color: accent } : undefined} />
      </div>
      <div className={cn("mt-2 font-black tabular-nums text-3xl md:text-4xl", invalid ? "text-muted-foreground/30 blur-[5px] select-none" : "text-foreground")}>
        {value}
        <span className="text-sm font-bold text-muted-foreground ml-1">{unit}</span>
      </div>
      <div className="mt-1 text-[10px] md:text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function HeaterToggle({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label={on ? "Switch heater off" : "Switch heater on"}
      className={cn(
        "group flex items-center gap-2.5 rounded-full border pl-2 pr-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-all duration-300",
        disabled
          ? "opacity-40 cursor-not-allowed border-border bg-background/60 text-muted-foreground"
          : on
            ? "border-orange-400/60 bg-orange-400/10 text-orange-300 hover:bg-orange-400/20 shadow-[0_0_18px_-4px_rgba(249,115,22,0.6)]"
            : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "relative flex h-6 w-11 items-center rounded-full px-0.5 transition-colors duration-300",
          on ? "bg-orange-500/80" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 flex items-center justify-center",
            on ? "translate-x-5" : "translate-x-0"
          )}
        >
          <FlameKindling className={cn("w-3 h-3", on ? "text-orange-500" : "text-muted-foreground")} />
        </span>
      </span>
      Heater {on ? "ON" : "OFF"}
    </button>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  color,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all duration-300",
        disabled ? "opacity-40 cursor-not-allowed border-border text-muted-foreground" : "hover:scale-[1.04] text-foreground"
      )}
      style={disabled ? undefined : { borderColor: `${color}66`, background: `${color}14`, color }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function TelemetryChart({ history }: { history: ReturnType<typeof useSimulation>["history"] }) {
  const { thresholds } = useThresholds();
  const maxVapor = Math.max(thresholds.alertVapor * 1.1, ...history.map((h) => h.vapor_signal || 0));
  const maxTemp = Math.max(thresholds.alertTempC + 10, ...history.map((h) => (Number.isFinite(h.temperature_c) ? h.temperature_c : 0)));

  const tempPts = useMemo(
    () => history.map((h) => (Number.isFinite(h.temperature_c) ? h.temperature_c : null)) as (number | null)[],
    [history]
  );
  const vaporPts = useMemo(() => history.map((h) => h.vapor_signal), [history]);
  const heaterFlags = useMemo(() => history.map((h) => h.heater_state === 1), [history]);

  const tempPath = pathFrom(tempPts, 0, maxTemp);
  const vaporPath = pathFrom(vaporPts, 0, maxVapor);
  const tempHead = lastPoint(tempPts, 0, maxTemp);
  const vaporHead = lastPoint(vaporPts, 0, maxVapor);
  const tempLine = (v: number) => PAD.t + (1 - v / maxTemp) * (H - PAD.t - PAD.b);
  const vaporLine = (v: number) => PAD.t + (1 - v / maxVapor) * (H - PAD.t - PAD.b);

  // Heater activity ribbon: small ticks along the bottom, orange when ON.
  const ribbonY = H - 6;
  const heaterTicks = heaterFlags.map((on, i) => {
    const x = PAD.l + (i / Math.max(1, heaterFlags.length - 1)) * (W - PAD.l - PAD.r);
    return <rect key={i} x={x - 1.2} y={ribbonY - 5} width={2.4} height={5} rx={1} fill="#f97316" opacity={on ? 0.95 : 0.15} />;
  });

  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Activity className="w-4 h-4" /> Real-Time Timeline
        </div>
        <div className="flex items-center gap-4 text-[10px] md:text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-0.5 w-4 rounded" style={{ background: "#f97316" }} /> Temp °C</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-0.5 w-4 rounded" style={{ background: "#7c3aed" }} /> Vapor</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-0.5 w-4 rounded bg-muted-foreground/40" /> Warning/Alert</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48 md:h-56">
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vaporFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* threshold lines (live values — move them in Hardware Demonstration) */}
        <line x1={PAD.l} x2={W - PAD.r} y1={tempLine(thresholds.warningTempC)} y2={tempLine(thresholds.warningTempC)} stroke="#eab308" strokeOpacity="0.5" strokeDasharray="4 4" />
        <line x1={PAD.l} x2={W - PAD.r} y1={tempLine(thresholds.alertTempC)} y2={tempLine(thresholds.alertTempC)} stroke="#f97316" strokeOpacity="0.6" strokeDasharray="4 4" />
        <line x1={PAD.l} x2={W - PAD.r} y1={vaporLine(thresholds.alertVapor)} y2={vaporLine(thresholds.alertVapor)} stroke="#7c3aed" strokeOpacity="0.5" strokeDasharray="4 4" />

        {/* area fills */}
        {tempPath && <path d={`${tempPath} L${W - PAD.r},${H - PAD.b} L${PAD.l},${H - PAD.b} Z`} fill="url(#tempFill)" stroke="none" />}
        {vaporPath && <path d={`${vaporPath} L${W - PAD.r},${H - PAD.b} L${PAD.l},${H - PAD.b} Z`} fill="url(#vaporFill)" stroke="none" />}

        {/* series lines */}
        <path d={tempPath} fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={vaporPath} fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

        {/* pulsing live heads */}
        {tempHead && (
          <circle cx={tempHead.x} cy={tempHead.y} r="4" fill="#f97316">
            <animate attributeName="r" values="3.5;5.5;3.5" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
        {vaporHead && (
          <circle cx={vaporHead.x} cy={vaporHead.y} r="4" fill="#7c3aed">
            <animate attributeName="r" values="5.5;3.5;5.5" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}

        {/* heater activity ribbon */}
        {heaterTicks}
      </svg>
    </div>
  );
}

function EventFeed({ events }: { events: ReturnType<typeof useSimulation>["events"] }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [events]);

  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-1 pb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <ScrollText className="w-4 h-4" /> Event Log Feed
      </div>
      <div ref={listRef} className="overflow-y-auto max-h-52 md:max-h-[19rem] pr-1 flex flex-col gap-1.5">
        {events.length === 0 && <div className="text-xs text-muted-foreground px-1">Awaiting events…</div>}
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-2 text-xs rounded-lg border border-border/40 bg-background/40 px-2.5 py-1.5">
            <span className="tabular-nums text-muted-foreground/80 shrink-0">{e.time}</span>
            <span className="h-2 w-2 mt-1 rounded-full shrink-0" style={{ background: STATE_META[e.state].color }} />
            <span className={cn("min-w-0", e.state === "NORMAL" ? "text-muted-foreground" : "font-semibold")} style={e.state !== "NORMAL" ? { color: STATE_META[e.state].color } : undefined}>
              {e.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Main modal
// -------------------------------------------------------------------------

export function VirtualDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sim = useSimulation();

  if (!open) return null;

  const { telemetry } = sim;
  const faulted = telemetry.system_state === "FAULT";
  const locked = telemetry.system_state === "LOCK";
  const inAlarm = telemetry.system_state === "ALERT" || faulted || locked;
  const heaterOn = telemetry.heater_state === 1 && !faulted && !locked;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border/70 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 backdrop-blur px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Gauge className="w-5 h-5 text-primary" />
            <div className="min-w-0">
              <div className="font-black tracking-widest text-sm md:text-base uppercase truncate">Virtual Demonstration</div>
              <div className="text-[10px] md:text-xs text-muted-foreground truncate">
                Reference Stack V1 — ESP32 + DHT22 + MQ-3 · simulated telemetry every 2s
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full border border-border/60 p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Close demo">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative p-4 md:p-5 flex flex-col gap-4">
          <StateBanner state={telemetry.system_state} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard icon={Thermometer} label="Temperature" value={fmt(telemetry.temperature_c)} unit="°C" sub="DHT22 · primary process variable" invalid={faulted} accent="#f97316" />
            <MetricCard icon={Droplets} label="Humidity" value={fmt(telemetry.humidity_rh)} unit="%" sub="DHT22 · chamber metadata" invalid={faulted} accent="#10b981" />
            <MetricCard icon={Wind} label="Vapor Proxy" value={faulted ? "—" : String(telemetry.vapor_signal)} unit="raw" sub="MQ-3 · hazard indicator" invalid={faulted} accent="#7c3aed" />
            <div className="rounded-xl border border-border/60 bg-background/60 p-4 flex flex-col items-start justify-between gap-2">
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground">Heater Relay</span>
              <HeaterToggle on={heaterOn} disabled={inAlarm} onToggle={sim.toggleHeater} />
              <span className="text-[10px] md:text-xs text-muted-foreground">
                {inAlarm ? "Relay locked out during alarm" : "Tap to toggle · temp reacts live"}
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-3">
            <TelemetryChart history={sim.history} />
            <EventFeed events={sim.events} />
          </div>

          {/* Demo + control deck */}
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground mr-1">
              <Clapperboard className="w-3.5 h-3.5" /> Demo:
            </span>
            <ControlButton icon={Activity} label="Normal" color="#10b981" onClick={() => sim.jumpTo("normal")} disabled={locked} />
            <ControlButton icon={TriangleAlert} label="Warning" color="#eab308" onClick={() => sim.jumpTo("warning")} disabled={locked} />
            <ControlButton icon={ShieldAlert} label="Lockdown" color="#7c3aed" onClick={() => sim.jumpTo("lockdown")} disabled={locked} />

            <span className="mx-1 h-5 w-px bg-border/70" aria-hidden />

            <ControlButton icon={Power} label={sim.running ? "Pause" : "Resume"} color="#94a3b8" onClick={() => sim.setRunning(!sim.running)} />
            <ControlButton
              icon={Activity}
              label={`Speed ${sim.speed}×`}
              color="#94a3b8"
              onClick={() => sim.setSpeed(speed => (speed === 1 ? 4 : 1))}
            />
            <ControlButton icon={RotateCcw} label="Reset" color="#f97316" onClick={sim.resetProtocol} />

            <span className="text-[10px] md:text-xs text-muted-foreground ml-auto">
              Scenario beat {Math.min(sim.progress.step + 1, sim.progress.total)} / {sim.progress.total}
            </span>
          </div>

          {/* ALERT acknowledgement gate (PDF §3) */}
          {sim.awaitingAck && (
            <div className="absolute inset-x-0 top-14 z-20 flex justify-center px-4">
              <div className="rounded-xl border px-5 py-4 shadow-2xl bg-background/95 backdrop-blur max-w-md w-full" style={{ borderColor: "#f9731655" }}>
                <div className="flex items-center gap-2 font-black tracking-widest text-sm" style={{ color: "#f97316" }}>
                  <ShieldAlert className="w-4 h-4" /> MANUAL ACKNOWLEDGEMENT REQUIRED
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  A critical limit was exceeded and the heater was forced OFF. Acknowledge to resume the scripted recovery.
                </p>
                <button
                  onClick={sim.acknowledge}
                  className="mt-3 w-full rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
                  style={{ background: "#f97316" }}
                >
                  Acknowledge &amp; Resume
                </button>
              </div>
            </div>
          )}

          {/* LOCK: deliberate Reset Protocol (PDF §3) */}
          {locked && (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm p-4">
              <div className="rounded-2xl border max-w-md w-full p-6 text-center" style={{ borderColor: "#7c3aed66", background: "#7c3aed10" }}>
                <ShieldAlert className="w-8 h-8 mx-auto" style={{ color: "#7c3aed" }} />
                <div className="mt-2 font-black tracking-widest text-lg" style={{ color: "#7c3aed" }}>SYSTEM LOCKED</div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Repeated critical faults disabled the system. Use the Reset Protocol below — or the Reset button in the control deck after closing this panel.
                </p>
                <button
                  onClick={sim.resetProtocol}
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white"
                  style={{ background: "#7c3aed" }}
                >
                  <RotateCcw className="w-4 h-4" /> Reset Protocol
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
