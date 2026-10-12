import { useCallback, useRef, useState } from "react";

interface SubmitLock {
  /**
   * Run an async submit task, but only if none is already in flight. The
   * in-flight guard is a ref, so a second call in the *same* event turn is
   * rejected synchronously — before React can re-render a disabled control.
   */
  submit: (task: () => Promise<void>) => void;
  /** Mirrors the in-flight flag as state so callers can disable the control. */
  pending: boolean;
}

/**
 * Serializes an async "submit" action against overlapping and duplicate calls.
 *
 * A `disabled` prop alone can't prevent a double submit: it only updates after
 * React re-renders, so two activations in one tick (double-tap, touch+mouse
 * pair, Enter + click) both fire before the button disables. Holding the
 * in-flight flag in a ref closes that window synchronously.
 *
 * The task is expected to settle without throwing synchronously (our
 * `record()` bridge never rejects). The lock releases on either settle path so
 * a failed attempt re-enables the control instead of stranding it disabled.
 */
export function useSubmitLock(): SubmitLock {
  const inFlightRef = useRef(false);
  const [pending, setPending] = useState(false);

  const submit = useCallback((task: () => Promise<void>) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    const release = () => {
      inFlightRef.current = false;
      setPending(false);
    };
    void task().then(release, release);
  }, []);

  return { submit, pending };
}

interface SingleFlight<Args extends unknown[], Result> {
  /**
   * Start `run`, or, while a call is still in flight, return that call's
   * promise instead of starting another (its arguments win).
   */
  call: (...args: Args) => Promise<Result>;
  pending: boolean;
}

/**
 * Promise-returning sibling of {@link useSubmitLock} for callers that need the
 * task's result or error. The in-flight promise is held in a ref so a double
 * tap in one event turn runs `run` once.
 */
export function useSingleFlight<Args extends unknown[], Result>(
  run: (...args: Args) => Promise<Result>,
): SingleFlight<Args, Result> {
  const inFlightRef = useRef<Promise<Result> | null>(null);
  const [pending, setPending] = useState(false);

  const call = useCallback(
    (...args: Args): Promise<Result> => {
      const current = inFlightRef.current;
      if (current) return current;

      let started: Promise<Result>;
      try {
        started = run(...args);
      } catch (caught) {
        started = Promise.reject(
          caught instanceof Error ? caught : new Error(String(caught)),
        );
      }
      const tracked = started.finally(() => {
        inFlightRef.current = null;
        setPending(false);
      });
      inFlightRef.current = tracked;
      setPending(true);
      return tracked;
    },
    [run],
  );

  return { call, pending };
}
