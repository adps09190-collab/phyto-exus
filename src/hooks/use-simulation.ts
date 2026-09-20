import { useCallback, useEffect, useRef, useState } from "react";
import {
  evaluateTick,
  SCENARIO,
  stateFromValuesWith,
  type LogEvent,
  type Telemetry,
  TICK_MS,
} from "@/lib/simulation";
import { useThresholdsRef, type Thresholds } from "@/lib/thresholds";

// Step indexes inside SCENARIO (keep in sync with src/lib/simulation.ts)
const ALERT_HOLD_STEP = 10; // "ALERT: awaiting manual acknowledgement"
const ACK_RELEASE_STEP = 11; // "Acknowledged — values falling back into envelope"

const HISTORY_LIMIT = 150;
const EVENTS_LIMIT = 80;

export type DemoJump = "normal" | "warning" | "lockdown";

/** Scenario anchors the demo-state buttons jump to. */
const JUMP_STEP: Record<DemoJump, number> = {
  normal: 3, // "Steady extraction — telemetry nominal" (heater ON, NORMAL)
  warning: 7, // "WARNING: rising alcohol-vapor proxy" (escalates to ALERT if ignored)
  lockdown: 18, // "LOCK: Reset Protocol required"
};

interface SimState {
  telemetry: Telemetry;
  history: Telemetry[];
  stepIndex: number;
  tickInStep: number;
  finished: boolean;
}

const INITIAL_TELEMETRY: Telemetry = {
  temperature_c: 24.5,
  humidity_rh: 41,
  vapor_signal: 65,
  heater_state: 0,
  system_state: "NORMAL",
};

function initSim(): SimState {
  return {
    telemetry: { ...INITIAL_TELEMETRY },
    history: [],
    stepIndex: 0,
    tickInStep: 0,
    finished: false,
  };
}

/**
 * Manual heater physics: an engaged heater warms the chamber (capped below the
 * ALERT temperature so manual play stays in NORMAL/WARNING), a switched-off
 * one cools toward ambient, and the vapor proxy drifts toward its
 * temperature-dependent equilibrium.
 */
function applyManualHeater(
  next: Telemetry,
  override: boolean | null,
  th: Thresholds
) {
  if (override === null) return;
  next.heater_state = override ? 1 : 0;
  const t = override
    ? Math.min(next.temperature_c + 1.4, th.alertTempC - 2) // heats up ~1.4°C per 2s tick
    : Math.max(next.temperature_c - 1.1, 25.8); // cools toward ambient
  next.temperature_c = Math.round(t * 10) / 10;
  // Vapor glides toward ~10 raw units per °C above ambient.
  const vaporEq = (next.temperature_c - 24) * 10;
  next.vapor_signal = Math.max(40, Math.round(next.vapor_signal + (vaporEq - next.vapor_signal) * 0.35));
  if (next.system_state === "NORMAL" || next.system_state === "WARNING") {
    next.system_state = stateFromValuesWith(next.temperature_c, next.vapor_signal, th);
  }
  // Safety always wins: the moment we leave the safe band the relay cuts.
  if (next.system_state !== "NORMAL" && next.system_state !== "WARNING") {
    next.heater_state = 0;
  }
}

/**
 * Runs the mocked telemetry engine (PDF §5): a central interval that samples
 * the Scenario Array every TICK_MS and keeps the UI fed with history + events.
 */
export function useSimulation() {
  const simRef = useRef<SimState>(initSim());
  const ackRef = useRef(false);
  const heaterOverrideRef = useRef<boolean | null>(null);
  const eventId = useRef(0);
  const thRef = useThresholdsRef();

  const [telemetry, setTelemetry] = useState<Telemetry>(simRef.current.telemetry);
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [progress, setProgress] = useState({ step: 0, total: SCENARIO.length });
  const [acknowledged, setAcknowledged] = useState(false);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<1 | 4>(1);
  const [heaterOverride, setHeaterOverride] = useState<boolean | null>(null);

  const makeEvent = useCallback((message: string, state: LogEvent["state"]): LogEvent => {
    return {
      id: ++eventId.current,
      time: new Date().toLocaleTimeString([], { hour12: false }),
      message,
      state,
    };
  }, []);

  const pushEvent = useCallback(
    (message: string, state: LogEvent["state"]) => {
      setEvents((prev) => [makeEvent(message, state), ...prev].slice(0, EVENTS_LIMIT));
    },
    [makeEvent]
  );

  // Seed the log with the opening scenario note.
  useEffect(() => {
    setEvents([makeEvent(SCENARIO[0].note, "NORMAL")]);
  }, [makeEvent]);

  // The central demo loop (2000ms at 1×).
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const sim = simRef.current;
      if (sim.finished) return;

      const step = SCENARIO[sim.stepIndex];
      // Manual mode: while the operator holds the heater override, the script
      // stands down and the values react purely to the toggle physics.
      if (heaterOverrideRef.current !== null) {
        const manual: Telemetry = { ...sim.telemetry };
        applyManualHeater(manual, heaterOverrideRef.current, thRef.current);
        if (manual.system_state !== "NORMAL" && manual.system_state !== "WARNING") {
          // The operator's own actions tripped a limit — safety cuts the relay,
          // manual control is released and the ALERT gate is raised.
          heaterOverrideRef.current = null;
          setHeaterOverride(null);
          ackRef.current = false;
          setAcknowledged(false);
          sim.stepIndex = ALERT_HOLD_STEP;
          sim.tickInStep = SCENARIO[ALERT_HOLD_STEP].ticks - 1;
          manual.system_state = "ALERT";
          manual.heater_state = 0;
          pushEvent("ALERT: heater relay forced OFF by safety logic", "ALERT");
        }
        sim.telemetry = manual;
        sim.history = [...sim.history, manual].slice(-HISTORY_LIMIT);
        setTelemetry(manual);
        setHistory(sim.history);
        setProgress({ step: sim.stepIndex, total: SCENARIO.length });
        return;
      }

      // ALERT gate: hold here until the operator acknowledges (PDF §3).
      if (sim.stepIndex === ALERT_HOLD_STEP && sim.tickInStep >= step.ticks - 1 && !ackRef.current) {
        const held = evaluateTick(sim.telemetry, step, thRef.current);
        sim.telemetry = held;
        sim.history = [...sim.history, held].slice(-HISTORY_LIMIT);
        setTelemetry(held);
        setHistory(sim.history);
        return;
      }

      let stepIndex = sim.stepIndex;
      let tickInStep = sim.tickInStep + 1;
      let advanced = false;

      if (tickInStep >= step.ticks) {
        stepIndex = Math.min(stepIndex + 1, SCENARIO.length - 1);
        tickInStep = 0;
        advanced = true;
        if (sim.stepIndex === SCENARIO.length - 1) sim.finished = true;
      }

      const current = SCENARIO[stepIndex];

      // The script explicitly commanding the relay regains manual control.
      if (current.target?.heater_state !== undefined) {
        heaterOverrideRef.current = null;
        setHeaterOverride(null);
      }

      const next = evaluateTick(sim.telemetry, current, thRef.current);

      sim.stepIndex = stepIndex;
      sim.tickInStep = tickInStep;
      sim.telemetry = next;
      sim.history = [...sim.history, next].slice(-HISTORY_LIMIT);

      setTelemetry(next);
      setHistory(sim.history);
      setProgress({ step: stepIndex, total: SCENARIO.length });

      if (advanced) pushEvent(current.note, current.state ?? "NORMAL");
      if (current.state === "LOCK") sim.finished = true;
    }, TICK_MS / speed);

    return () => clearInterval(iv);
  }, [running, speed, pushEvent]);

  /** Manual heater toggle — only allowed while the process is safe. */
  const toggleHeater = useCallback(() => {
    const sim = simRef.current;
    const s = sim.telemetry.system_state;
    if (s !== "NORMAL" && s !== "WARNING") return; // ALERT/FAULT/LOCK: relay locked out

    const engage = sim.telemetry.heater_state !== 1;
    heaterOverrideRef.current = engage;
    setHeaterOverride(engage);
    pushEvent(
      engage
        ? "Manual override: heater relay ENGAGED by operator"
        : "Manual override: heater relay switched OFF by operator",
      s
    );
  }, [pushEvent]);

  /** Jump straight into a demo state (Normal / Warning / Lockdown). */
  const jumpTo = useCallback(
    (kind: DemoJump) => {
      const sim = simRef.current;
      heaterOverrideRef.current = null;
      setHeaterOverride(null);
      setRunning(true);

      if (kind === "lockdown") {
        sim.stepIndex = JUMP_STEP.lockdown;
        sim.tickInStep = 0;
        sim.finished = false;
        pushEvent("Demo mode: LOCKDOWN injected — system disabled", "LOCK");
      } else {
        sim.stepIndex = JUMP_STEP[kind];
        sim.tickInStep = 0;
        sim.finished = false;
        ackRef.current = false;
        setAcknowledged(false);
        pushEvent(
          kind === "normal"
            ? "Demo mode: NORMAL run injected — steady extraction in progress"
            : "Demo mode: WARNING injected — watch the thresholds escalate",
          kind === "normal" ? "NORMAL" : "WARNING"
        );
      }
      setProgress({ step: JUMP_STEP[kind], total: SCENARIO.length });
    },
    [pushEvent]
  );

  /** Manual acknowledgement clearing the ALERT state (PDF §3). */
  const acknowledge = useCallback(() => {
    if (ackRef.current) return;
    ackRef.current = true;
    setAcknowledged(true);
    const sim = simRef.current;
    sim.stepIndex = ACK_RELEASE_STEP;
    sim.tickInStep = 0;
    pushEvent("Manual acknowledgement recorded — ALERT cleared by operator", "ALERT");
    pushEvent(SCENARIO[ACK_RELEASE_STEP].note, "NORMAL");
    setProgress({ step: ACK_RELEASE_STEP, total: SCENARIO.length });
  }, [pushEvent]);

  /** Deliberate reset required to leave LOCK (PDF §3) — also the general reset. */
  const resetProtocol = useCallback(() => {
    simRef.current = initSim();
    ackRef.current = false;
    heaterOverrideRef.current = null;
    setAcknowledged(false);
    setHeaterOverride(null);
    setTelemetry(simRef.current.telemetry);
    setHistory([]);
    setProgress({ step: 0, total: SCENARIO.length });
    setEvents([makeEvent("Reset Protocol accepted — simulation rebooted", "NORMAL")]);
    setRunning(true);
  }, [makeEvent]);

  return {
    telemetry,
    history,
    events,
    progress,
    acknowledged,
    awaitingAck: telemetry.system_state === "ALERT" && !acknowledged,
    locked: telemetry.system_state === "LOCK",
    running,
    setRunning,
    speed,
    setSpeed,
    heaterOverride,
    toggleHeater,
    jumpTo,
    acknowledge,
    resetProtocol,
  };
}
