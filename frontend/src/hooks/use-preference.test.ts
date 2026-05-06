import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePreference } from "./use-preference";

const ALLOWED = ["metric", "imperial"] as const;

describe("usePreference", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns the fallback when localStorage is empty", () => {
    const { result } = renderHook(() =>
      usePreference("units", "metric", ALLOWED),
    );
    expect(result.current[0]).toBe("metric");
  });

  it("hydrates from localStorage on mount", () => {
    localStorage.setItem("pref_units", "imperial");
    const { result } = renderHook(() =>
      usePreference("units", "metric", ALLOWED),
    );
    expect(result.current[0]).toBe("imperial");
  });

  it("ignores stored values not in the allow-list", () => {
    localStorage.setItem("pref_units", "kelvin");
    const { result } = renderHook(() =>
      usePreference("units", "metric", ALLOWED),
    );
    expect(result.current[0]).toBe("metric");
  });

  it("setter updates state and persists to localStorage atomically", () => {
    const { result } = renderHook(() =>
      usePreference("units", "metric", ALLOWED),
    );
    act(() => result.current[1]("imperial"));
    expect(result.current[0]).toBe("imperial");
    expect(localStorage.getItem("pref_units")).toBe("imperial");
  });
});
