import { createContext, useContext, useReducer, type ReactNode } from "react";
import {
  initialState,
  weatherReducer,
  type Action,
  type AppState,
} from "./weather-reducer";

type WeatherContextType = {
  state: AppState;
  dispatch: React.Dispatch<Action>;
};

const WeatherContext = createContext<WeatherContextType | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(weatherReducer, initialState);
  return (
    <WeatherContext.Provider value={{ state, dispatch }}>
      {children}
    </WeatherContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWeather(): WeatherContextType {
  const ctx = useContext(WeatherContext);
  if (!ctx) {
    throw new Error("useWeather must be used within a WeatherProvider");
  }
  return ctx;
}
