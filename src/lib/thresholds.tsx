import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** Thresholds that the simulation engine evaluates (PDF §3), editable at runtime. */
export interface Thresholds {
  warningTempC: number;
  alertTempC: number;
  warningVapor: number;
  alertVapor: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  warningTempC: 45,
  alertTempC: 55,
  warningVapor: 400,
  alertVapor: 650,
};

// ---------------------------------------------------------------------------
// React context store
// ---------------------------------------------------------------------------

interface ThresholdsStore {
  thresholds: Thresholds;
  setThreshold: (key: keyof Thresholds, value: number) => void;
  resetThresholds: () => void;
}

const ThresholdsContext = createContext<ThresholdsStore | null>(null);

export function ThresholdsProvider({ children }: { children: ReactNode }) {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  const store = useMemo<ThresholdsStore>(
    () => ({
      thresholds,
      setThreshold: (key, value) =>
        setThresholds((prev) => ({ ...prev, [key]: value })),
      resetThresholds: () => setThresholds(DEFAULT_THRESHOLDS),
    }),
    [thresholds]
  );

  return <ThresholdsContext.Provider value={store}>{children}</ThresholdsContext.Provider>;
}

export function useThresholds(): ThresholdsStore {
  const ctx = useContext(ThresholdsContext);
  if (!ctx) throw new Error("useThresholds must be used within a ThresholdsProvider");
  return ctx;
}

/**
 * A ref-mirror of the live thresholds, so the simulation's interval closure
 * always evaluates against the current slider values without re-subscribing.
 */
export function useThresholdsRef() {
  const { thresholds } = useThresholds();
  const ref = useMemo(() => ({ current: thresholds }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    ref.current = thresholds;
  }, [thresholds, ref]);
  return ref;
}
