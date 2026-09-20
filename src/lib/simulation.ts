// -------------------------------------------------------------------------
// PHYTONEXUS — Virtual Demonstration simulation engine (PDF §2, §3, §5)
// Central 2000ms interval + Scenario Array driving the UI through
// NORMAL → WARNING → ALERT → FAULT → LOCK without any real hardware.
// -------------------------------------------------------------------------

export type SystemState = "NORMAL" | "WARNING" | "ALERT" | "FAULT" | "LOCK";

/** The only telemetry variables the frontend may expect (PDF §2). */
export interface Telemetry {
  temperature_c: number;
  humidity_rh: number;
  vapor_signal: number;
  heater_state: 0 | 1;
  system_state: SystemState;
}

/** Color-coded safety states (PDF §3). */
export const STATE_META: Record<
  SystemState,
  { color: string; label: string; description: string }
> = {
  NORMAL: {
    color: "#10b981",
    label: "NORMAL",
    description: "All variables within the safe operating envelope. Monitoring and logging active. Heater allowed to operate.",
  },
  WARNING: {
    color: "#eab308",
    label: "WARNING",
    description: "Approaching a threshold limit. Operation continues but the event is flagged in the timeline.",
  },
  ALERT: {
    color: "#f97316",
    label: "ALERT",
    description: "Critical limit exceeded. Heater forced OFF. Manual acknowledgement required to clear.",
  },
  FAULT: {
    color: "#ef4444",
    label: "FAULT",
    description: "Simulated hardware failure (DHT22 disconnected). Data implausible — live values are obscured.",
  },
  LOCK: {
    color: "#7c3aed",
    label: "LOCK",
    description: "Repeated critical faults. System disabled. A deliberate Reset Protocol is required.",
  },
};

/** Demo thresholds (defaults; live values come from the ThresholdsProvider). */
export const THRESHOLDS = {
  warningTempC: 45,
  alertTempC: 55,
  warningVapor: 400,
  alertVapor: 650,
} as const;

/** Derive the safety state from measured values against a threshold set (PDF §3). */
export function stateFromValuesWith(
  temperature_c: number,
  vapor_signal: number,
  th: { warningTempC: number; alertTempC: number; warningVapor: number; alertVapor: number }
): SystemState {
  if (temperature_c >= th.alertTempC || vapor_signal >= th.alertVapor) return "ALERT";
  if (temperature_c >= th.warningTempC || vapor_signal >= th.warningVapor) return "WARNING";
  return "NORMAL";
}

/** One scripted beat of the demo (PDF §5 "Scenario Array"). */
export interface ScenarioStep {
  /** How many ticks (of 2000ms) this beat lasts. */
  ticks: number;
  /** Narrative printed in the event log when the beat starts. */
  note: string;
  /** Fixed values, or a target the ticker glides toward. */
  target?: Partial<Omit<Telemetry, "system_state">>;
  /** State the evaluator should settle on for this beat (before auto-safety). */
  state?: SystemState;
}

/**
 * The full demo walkthrough (~2.5 minutes): idle run → temp rises →
 * WARNING → ALERT (heater cut) → recovery → sensor FAULT → LOCK.
 */
export const SCENARIO: ScenarioStep[] = [
  { ticks: 4, note: "Simulation started — profile: Reference Stack V1 (ESP32 + DHT22 + MQ-3)", target: { temperature_c: 28, humidity_rh: 42, vapor_signal: 90, heater_state: 0 } },
  { ticks: 4, note: "Relay engaged — heating phase begins", target: { temperature_c: 31, heater_state: 1 } },
  { ticks: 6, note: "Extraction ramp — chamber temperature climbing", target: { temperature_c: 38, vapor_signal: 140 } },
  { ticks: 6, note: "Steady extraction — telemetry nominal", target: { temperature_c: 42, humidity_rh: 44, vapor_signal: 190 } },
  { ticks: 6, note: "Vapor proxy trending upward — monitoring closely", target: { temperature_c: 45, vapor_signal: 330 } },
  { ticks: 6, note: "Approaching temperature limit", target: { temperature_c: 49, vapor_signal: 410 } },
  { ticks: 5, note: "WARNING: Temp approaching limit — flagged in timeline", target: { temperature_c: 52, vapor_signal: 480 } },
  { ticks: 5, note: "WARNING: rising alcohol-vapor proxy — possible leak", target: { temperature_c: 54, vapor_signal: 560 } },
  { ticks: 5, note: "CRITICAL: vapor signal above alert threshold", target: { temperature_c: 56, vapor_signal: 700 } },
  { ticks: 1, note: "ALERT: heater relay forced OFF by safety logic", state: "ALERT" },
  { ticks: 6, note: "ALERT: awaiting manual acknowledgement", target: { temperature_c: 51, vapor_signal: 520, heater_state: 0 }, state: "ALERT" },
  { ticks: 4, note: "Acknowledged — values falling back into envelope", target: { temperature_c: 44, vapor_signal: 330, heater_state: 0 } },
  { ticks: 5, note: "Cooldown phase — system returning to NORMAL", target: { temperature_c: 38, vapor_signal: 210, heater_state: 0 } },
  { ticks: 4, note: "Recovery complete — resuming controlled heating", target: { temperature_c: 40, heater_state: 1 } },
  { ticks: 3, note: "Heating resumed — nominal", target: { temperature_c: 43, vapor_signal: 240 } },
  { ticks: 1, note: "FAULT: DHT22 disconnected — telemetry implausible", state: "FAULT" },
  { ticks: 5, note: "FAULT: sensor data invalid — live values obscured", state: "FAULT" },
  { ticks: 1, note: "Repeated critical faults — LOCK engaged, system disabled", state: "LOCK" },
  { ticks: 999, note: "LOCK: Reset Protocol required to restore operation", state: "LOCK" },
];

export const TICK_MS = 2000;

/** First-motion jitter so the mocked telemetry feels alive, not canned. */
const jitter = (v: number, amt: number) => Math.round((v + (Math.random() * 2 - 1) * amt) * 10) / 10;

/**
 * Pure evaluator: given current telemetry and the scripted target, compute the
 * next sample. Safety rules (PDF §3) are enforced here — the UI never fakes them.
 */
export function evaluateTick(
  current: Telemetry,
  step: ScenarioStep,
  th: { warningTempC: number; alertTempC: number; warningVapor: number; alertVapor: number }
): Telemetry {
  if (step.state === "FAULT") {
    return { temperature_c: NaN, humidity_rh: NaN, vapor_signal: current.vapor_signal, heater_state: 0, system_state: "FAULT" };
  }
  if (step.state === "LOCK") {
    return { ...current, heater_state: 0, system_state: "LOCK" };
  }

  const t = step.target ?? {};
  // Glide toward the beat's targets so the chart shows realistic gradients.
  const glide = (cur: number, to: number | undefined, rate: number) =>
    to === undefined ? cur : Math.round((cur + (to - cur) * rate) * 10) / 10;

  let temperature_c = glide(current.temperature_c || 25, t.temperature_c, 0.35) + jitter(0, 0.3);
  let humidity_rh = glide(current.humidity_rh || 40, t.humidity_rh, 0.3) + jitter(0, 0.4);
  let vapor_signal = Math.max(0, Math.round(glide(current.vapor_signal || 0, t.vapor_signal, 0.4) + jitter(0, 8)));
  let heater_state: 0 | 1 = t.heater_state !== undefined ? t.heater_state : current.heater_state;

  // ---- Safety logic (software level, PDF §3) ----
  let system_state: SystemState = step.state ?? stateFromValuesWith(temperature_c, vapor_signal, th);

  // Anything beyond NORMAL/WARNING forces the relay off (PDF §3).
  if (system_state !== "NORMAL" && system_state !== "WARNING") {
    heater_state = 0;
  }

  return {
    temperature_c: Math.round(temperature_c * 10) / 10,
    humidity_rh: Math.round(humidity_rh * 10) / 10,
    vapor_signal,
    heater_state,
    system_state,
  };
}

/** An entry in the scrolling event log feed. */
export interface LogEvent {
  id: number;
  time: string;
  message: string;
  state: SystemState;
}
