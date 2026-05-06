import { createContext, useContext, type ReactNode } from "react";
import type { WeatherObservation } from "@/lib/weather";
import type { Range, Units } from "./format";

// Co-locate the dashboard's pervasive read-only inputs (units toggle,
// range toggle, observations stream) so sections don't get prop-drilled
// through index.tsx. Sections read what they need; index.tsx stays a
// composition file rather than a god prop hub.

type DashboardCtx = {
  units: Units;
  range: Range;
  observations: WeatherObservation[];
};

const Ctx = createContext<DashboardCtx | null>(null);

export function DashboardProvider({
  units,
  range,
  observations,
  children,
}: DashboardCtx & { children: ReactNode }) {
  return (
    <Ctx.Provider value={{ units, range, observations }}>
      {children}
    </Ctx.Provider>
  );
}

function useDashboard(): DashboardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("DashboardProvider missing");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUnits(): Units {
  return useDashboard().units;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRange(): Range {
  return useDashboard().range;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useObservations(): WeatherObservation[] {
  return useDashboard().observations;
}
