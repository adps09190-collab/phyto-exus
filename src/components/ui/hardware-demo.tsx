"use client";

import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import {
  Cable,
  CircuitBoard,
  Cpu,
  Flame,
  Gauge,
  RotateCcw,
  SlidersHorizontal,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { ToolDock, ToolDockTile, type ToolDockItem } from "@/components/ui/techstack";
import { useThresholds } from "@/lib/thresholds";

// -------------------------------------------------------------------------
// Reference Stack V1 hardware — photos are free-to-use Wikimedia images.
// -------------------------------------------------------------------------

const ESP32_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/ESP32-C3_RISC-V_NodeMCU_board.jpg/500px-ESP32-C3_RISC-V_NodeMCU_board.jpg";
const DHT22_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/AM2302_%28DHT22%29_digital_temperature_and_humidity_sensor_module.jpg/500px-AM2302_%28DHT22%29_digital_temperature_and_humidity_sensor_module.jpg";
const RELAY_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/SRD-05VDC-SL-C_5V_one-channel_relay_module.jpg/500px-SRD-05VDC-SL-C_5V_one-channel_relay_module.jpg";

interface HardwareSpec {
  id: string;
  name: string;
  role: string;
  img: string | null;
  tileClass: string;
  accent: string;
  variables: string[];
  specs: { k: string; v: string }[];
  about: string;
  inStack: string;
}

const HARDWARE: HardwareSpec[] = [
  {
    id: "esp32",
    name: "ESP32 (NodeMCU)",
    role: "Controller · Wi-Fi microcontroller",
    img: ESP32_IMG,
    tileClass: "bg-[#e6e7ea]",
    accent: "#38bdf8",
    variables: ["Wi-Fi telemetry bridge"],
    specs: [
      { k: "Core", v: "Dual-core Xtensa LX6 @ 240 MHz" },
      { k: "Wireless", v: "Wi-Fi 802.11 b/g/n + BLE" },
      { k: "GPIO", v: "34 programmable pins, 12-bit ADC" },
      { k: "Logic level", v: "3.3 V (5 V-tolerant via modules)" },
      { k: "Power", v: "5 V micro-USB, ~240 mA peak" },
      { k: "Cost (approx.)", v: "$3–6 board" },
    ],
    about:
      "The brain of Reference Stack V1. It polls the DHT22 and MQ-3 on fixed intervals, drives the 5 V relay from a GPIO pin, wraps every reading into a JSON payload — temperature_c, humidity_rh, vapor_signal, heater_state — and pushes it to the platform over Wi-Fi. Its dual-core design keeps the Wi-Fi stack off the sampling loop, so timestamps stay regular even while streaming.",
    inStack:
      "Reads: DHT22 (single-wire), MQ-3 (ADC) · Drives: relay GPIO · Uplink: Wi-Fi JSON every 2 s",
  },
  {
    id: "dht22",
    name: "DHT22 / AM2302",
    role: "Sensor · Temperature + humidity",
    img: DHT22_IMG,
    tileClass: "bg-white",
    accent: "#f97316",
    variables: ["temperature_c", "humidity_rh"],
    specs: [
      { k: "Temperature range", v: "−40 to +80 °C" },
      { k: "Temperature accuracy", v: "±0.5 °C" },
      { k: "Humidity range", v: "0–100 % RH" },
      { k: "Humidity accuracy", v: "±2–5 % RH" },
      { k: "Sampling", v: "0.5 Hz (one reading per 2 s)" },
      { k: "Signal", v: "single-wire digital protocol" },
    ],
    about:
      "A capacitive humidity element and a thermistor behind a single-wire digital interface inside a ventilated polymer cage. It is the primary process variable for an extraction run: temperature drives the whole safety envelope, while humidity is logged as ambient metadata so every experiment is reproducible. When its wire comes loose the platform reads implausible data and raises the FAULT state — exactly the failure the sensor-coverage logic is designed to catch.",
    inStack:
      "Data pin → ESP32 GPIO · 4.7 kΩ pull-up · 3.3 V or 5 V supply",
  },
  {
    id: "mq3",
    name: "MQ-3 Alcohol Vapor",
    role: "Sensor · Hazard proxy (MQ series)",
    img: null,
    tileClass: "bg-gradient-to-br from-slate-200 to-slate-400",
    accent: "#a78bfa",
    variables: ["vapor_signal"],
    specs: [
      { k: "Sensitive to", v: "Alcohol/ethanol vapor (benzine, hexane minor)" },
      { k: "Element", v: "SnO₂ semiconductor, heated" },
      { k: "Output", v: "Analog 0–5 V (raw ADC count)" },
      { k: "Preheat", v: "24–48 h burn-in, minutes per session" },
      { k: "Load resistor", v: "External RL, typically 20 kΩ" },
      { k: "Cost (approx.)", v: "$2–4 module" },
    ],
    about:
      "A heated tin-dioxide (SnO₂) film whose conductivity drops when alcohol vapors adsorb onto its surface — the raw analog count is treated strictly as a hazard indicator for extraction leaks, never as a calibrated PPM value. Rising vapor with stable temperature is the classic early warning of a seal failure, which is why the WARNING state keys off it. No MQ-series photo is shown because the module look varies wildly between vendors; the bare metallic mesh head is the constant.",
    inStack:
      "A0 → ESP32 ADC (12-bit) · 5 V heater rail · standalone module",
  },
  {
    id: "relay",
    name: "5 V Relay Module",
    role: "Actuator · Heater power switch",
    img: RELAY_IMG,
    tileClass: "bg-[#1b3a6b]",
    accent: "#22d3ee",
    variables: ["heater_state"],
    specs: [
      { k: "Coil", v: "5 V DC, ~70 mA" },
      { k: "Contacts", v: "SRD-05VDC-SL-C, 10 A @ 250 V AC / 30 V DC" },
      { k: "Trigger", v: "Opto-isolated, 3.3–5 V logic (active LOW common)" },
      { k: "Indicator", v: "Onboard LED per channel" },
      { k: "Protection", v: "Flyback diode, optocoupler isolation" },
      { k: "Cost (approx.)", v: "$1–2 per channel" },
    ],
    about:
      "The only actuator in Reference Stack V1. The ESP32 energizes its coil to close a contact that switches the extraction heater's power line; the same GPIO state is what the dashboard shows as heater ON/OFF. The safety logic hard-wires the rule that ALERT, FAULT and LOCK all force the relay to 0 — the software cut you saw in the Virtual Demonstration is this component dropping out.",
    inStack:
      "IN → ESP32 GPIO (active low) · VCC 5 V · COM/NO in series with heater supply",
  },
];

const DOCK_ITEMS: ToolDockItem[] = HARDWARE.map((h) => ({
  label: h.name,
  icon: (
    <ToolDockTile className={h.tileClass}>
      {h.img ? (
        <img src={h.img} alt="" draggable={false} className="size-[74%] object-contain" />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden className="size-[62%] text-slate-700">
          {/* stylized MQ-series mesh sensor head */}
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.4 1.6" />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" opacity="0.85" />
          <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </ToolDockTile>
  ),
}));

// -------------------------------------------------------------------------
// Pin → variable mapping (PDF §4.3 "Variable Mapping Table")
// -------------------------------------------------------------------------

const MAPPING = [
  { hw: "DHT22 · DATA", pin: "GPIO 4", var: "temperature_c", type: "float (°C)", role: "Primary process variable", color: "#f97316" },
  { hw: "DHT22 · DATA", pin: "GPIO 4", var: "humidity_rh", type: "float (%)", role: "Ambient metadata", color: "#10b981" },
  { hw: "MQ-3 · A0", pin: "GPIO 34 (ADC1_6)", var: "vapor_signal", type: "int (raw)", role: "Hazard indicator", color: "#a78bfa" },
  { hw: "Relay · IN", pin: "GPIO 26", var: "heater_state", type: "bool (0/1)", role: "Electrical load status", color: "#22d3ee" },
];

// -------------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------------

function SensorPanel({ spec }: { spec: HardwareSpec }) {
  return (
    <motion.div
      key={spec.id}
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-border/60 bg-background/70 overflow-hidden"
    >
      <div className="grid md:grid-cols-[220px_1fr]">
        <div className="relative flex items-center justify-center p-5 border-b md:border-b-0 md:border-r border-border/50 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.05),transparent_70%)]">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="w-40 h-40 rounded-2xl overflow-hidden border border-border/60 bg-black/30 shadow-2xl"
          >
            {spec.img ? (
              <img src={spec.img} alt={spec.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center bg-gradient-to-br from-slate-200 to-slate-400">
                <svg viewBox="0 0 24 24" aria-hidden className="w-24 h-24 text-slate-700">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="1.2 1.5" />
                  <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                  <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </motion.div>
          <span
            className="absolute top-3 left-3 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${spec.accent}1f`, color: spec.accent }}
          >
            {spec.role.split(" · ")[0]}
          </span>
        </div>

        <div className="p-5">
          <h3 className="font-black text-lg tracking-tight">{spec.name}</h3>
          <p className="text-xs text-muted-foreground">{spec.role}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {spec.variables.map((v) => (
              <code key={v} className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-bold text-foreground/80">
                {v}
              </code>
            ))}
          </div>

          <p className="mt-3 text-xs md:text-[13px] leading-relaxed text-muted-foreground">{spec.about}</p>

          <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
            {spec.specs.map((s) => (
              <div key={s.k} className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">{s.k}</div>
                <div className="text-[11px] font-semibold text-foreground/90 truncate" title={s.v}>{s.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2">
            <Cable className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <span className="text-[10px] md:text-xs text-muted-foreground">{spec.inStack}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ThresholdSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  color,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  color: string;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="font-black tabular-nums text-sm" style={{ color }}>
          {value}
          <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-current cursor-pointer"
        style={{ color }}
        aria-label={label}
      />
    </div>
  );
}

// -------------------------------------------------------------------------
// Main modal
// -------------------------------------------------------------------------

export function HardwareDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = React.useState(0);
  const { thresholds, setThreshold, resetThresholds } = useThresholds();

  if (!open) return null;

  const spec = HARDWARE[selected];

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
            <Cpu className="w-5 h-5 text-primary" />
            <div className="min-w-0">
              <div className="font-black tracking-widest text-sm md:text-base uppercase truncate">Hardware Demonstration</div>
              <div className="text-[10px] md:text-xs text-muted-foreground truncate">
                Reference Stack V1 · ESP32 + DHT22 + MQ-3 + 5 V Relay — the hardware-agnostic platform in one view
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full border border-border/60 p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Close hardware view">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 md:p-6 flex flex-col gap-6">
          {/* Section: the dock of real hardware photos */}
          <section className="flex flex-col gap-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">Reference Stack — tap a tile</h2>
            <ToolDock
              items={DOCK_ITEMS}
              size={68}
              magnification={0.34}
              label="Reference Stack V1 hardware"
              onTileSelect={setSelected}
              forceMotion
            />
            <p className="text-center text-[10px] md:text-xs text-muted-foreground/70">
              Hover or tap the tiles — they swell like a dock. Selecting one loads its full profile below.
            </p>
          </section>

          {/* Selected hardware detail */}
          <section className="min-h-[290px]">
            <AnimatePresence mode="wait">
              <SensorPanel spec={spec} />
            </AnimatePresence>
          </section>

          {/* Variable mapping table */}
          <section className="rounded-2xl border border-border/60 bg-background/60 p-4 md:p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <CircuitBoard className="w-4 h-4" /> Variable Mapping — pins to platform
            </div>
            <p className="mt-1 text-[10px] md:text-xs text-muted-foreground/70">
              Physical pins map to logical software variables — swap the board or sensors and only this table changes, proving the hardware-agnostic claim.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead>
                  <tr className="text-[9px] uppercase tracking-widest text-muted-foreground/70 border-b border-border/50">
                    <th className="py-2 pr-3 font-bold">Hardware line</th>
                    <th className="py-2 pr-3 font-bold">ESP32 pin</th>
                    <th className="py-2 pr-3 font-bold">Software variable</th>
                    <th className="py-2 pr-3 font-bold">Type</th>
                    <th className="py-2 font-bold">Role in botanical R&D</th>
                  </tr>
                </thead>
                <tbody>
                  {MAPPING.map((m, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.06 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-semibold text-foreground/90">{m.hw}</td>
                      <td className="py-2.5 pr-3"><code className="rounded bg-background border border-border/50 px-1.5 py-0.5 text-[10px]">{m.pin}</code></td>
                      <td className="py-2.5 pr-3 font-bold" style={{ color: m.color }}>{m.var}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{m.type}</td>
                      <td className="py-2.5 text-muted-foreground">{m.role}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Threshold sliders — live, shared with the Virtual Demonstration */}
          <section className="rounded-2xl border border-border/60 bg-background/60 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <SlidersHorizontal className="w-4 h-4" /> Threshold Settings
              </div>
              <button
                onClick={resetThresholds}
                className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Defaults
              </button>
            </div>
            <p className="mt-1 text-[10px] md:text-xs text-muted-foreground/70">
              These limits are evaluated live by the simulation — drag a slider lower and watch the Virtual Demonstration escalate.
            </p>
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ThresholdSlider
                label="Warning temp"
                unit="°C"
                color="#eab308"
                min={30}
                max={70}
                step={1}
                value={thresholds.warningTempC}
                onChange={(v) => setThreshold("warningTempC", Math.min(v, thresholds.alertTempC - 5))}
              />
              <ThresholdSlider
                label="Alert temp"
                unit="°C"
                color="#f97316"
                min={35}
                max={80}
                step={1}
                value={thresholds.alertTempC}
                onChange={(v) => setThreshold("alertTempC", Math.max(v, thresholds.warningTempC + 5))}
              />
              <ThresholdSlider
                label="Warning vapor"
                unit="raw"
                color="#a78bfa"
                min={100}
                max={700}
                step={10}
                value={thresholds.warningVapor}
                onChange={(v) => setThreshold("warningVapor", Math.min(v, thresholds.alertVapor - 50))}
              />
              <ThresholdSlider
                label="Alert vapor"
                unit="raw"
                color="#7c3aed"
                min={150}
                max={900}
                step={10}
                value={thresholds.alertVapor}
                onChange={(v) => setThreshold("alertVapor", Math.max(v, thresholds.warningVapor + 50))}
              />
            </div>
          </section>

          {/* BOM strip */}
          <section className="rounded-xl border border-border/40 bg-background/40 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] md:text-xs text-muted-foreground">
            <span className="font-bold uppercase tracking-widest text-muted-foreground/80">BOM · Reference Stack V1</span>
            <span className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> ESP32 dev board ×1</span>
            <span className="flex items-center gap-1.5"><Thermometer className="w-3 h-3" /> DHT22 ×1</span>
            <span className="flex items-center gap-1.5"><Wind className="w-3 h-3" /> MQ-3 ×1</span>
            <span className="flex items-center gap-1.5"><Flame className="w-3 h-3" /> 5 V relay module ×1</span>
            <span className="flex items-center gap-1.5"><Gauge className="w-3 h-3" /> 4.7 kΩ pull-up ×1</span>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
