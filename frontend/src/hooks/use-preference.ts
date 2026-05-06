import { useCallback, useState } from "react";
import { getPreference, setPreference } from "@/lib/storage";

type PrefKey = Parameters<typeof getPreference>[0];

// React state mirrored to localStorage. The setter writes both at once so
// the two never drift — calling setPreference imperatively was the previous
// footgun (one update site forgotten leaves stale state).
export function usePreference<T extends string>(
  key: PrefKey,
  fallback: T,
  allowed?: readonly T[],
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = getPreference(key);
    if (!raw) return fallback;
    if (allowed && !(allowed as readonly string[]).includes(raw))
      return fallback;
    return raw as T;
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      setPreference(key, next);
    },
    [key],
  );

  return [value, set];
}
