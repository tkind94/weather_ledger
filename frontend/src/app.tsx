import { WeatherProvider } from "@/lib/state";
import { Dashboard } from "@/components/dashboard";

export function App() {
  return (
    <WeatherProvider>
      <Dashboard />
    </WeatherProvider>
  );
}
