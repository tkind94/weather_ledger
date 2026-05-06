import { Component, type ErrorInfo, type ReactNode } from "react";
import { Frame, Mono } from "./primitives";

// One section crashing should not unmount the whole dashboard.
// Wrap each section so a bad ECharts option, a malformed observation, or
// a future schema drift becomes a soft-fail "§NN unavailable" instead of
// a blank page.

type Props = { label: string; children: ReactNode };
type State = { error: Error | null };

export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console for ad-hoc debugging; in a real app we'd
    // forward this to telemetry instead.
    console.error(`[${this.props.label}] section crashed`, error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Frame label={`${this.props.label} · unavailable`}>
        <div className="px-[18px] py-6">
          <Mono className="text-[11px] text-ink-soft">
            This section failed to render. Other sections continue working.
          </Mono>
        </div>
      </Frame>
    );
  }
}
