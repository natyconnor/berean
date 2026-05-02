import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";

import {
  FEATURE_HINT_METADATA,
  HINT_QUEUE_COOLDOWN_MS,
  type FeatureHintId,
} from "@/lib/feature-hints";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";
import { logInteraction } from "@/lib/dev-log";
import { api } from "../../../convex/_generated/api";
import {
  StagedOnboardingContext,
  type FeatureHintRecord,
  type StagedOnboardingValue,
} from "./staged-onboarding-context";

interface StagedOnboardingProviderProps {
  milestones: OnboardingMilestones;
  hints: FeatureHintRecord[];
  isLoading: boolean;
  children: ReactNode;
}

interface HintCandidate {
  eligible: boolean;
  order: number;
}

interface LocalHintPatch {
  shownAt?: number;
  completedAt?: number;
  dismissedAt?: number;
}

function selectHintCandidate(
  candidates: Map<FeatureHintId, HintCandidate>,
): FeatureHintId | null {
  let selected: { hintId: FeatureHintId; candidate: HintCandidate } | null =
    null;
  for (const [hintId, candidate] of candidates) {
    if (!candidate.eligible) continue;
    const priority = FEATURE_HINT_METADATA[hintId].priority;
    const selectedPriority =
      selected === null
        ? Number.NEGATIVE_INFINITY
        : FEATURE_HINT_METADATA[selected.hintId].priority;
    if (
      selected === null ||
      priority > selectedPriority ||
      (priority === selectedPriority &&
        candidate.order < selected.candidate.order)
    ) {
      selected = { hintId, candidate };
    }
  }
  return selected?.hintId ?? null;
}

export function StagedOnboardingProvider({
  milestones,
  hints,
  isLoading,
  children,
}: StagedOnboardingProviderProps) {
  const markShownMutation = useMutation(api.onboarding.markHintShown);
  const completeMutation = useMutation(api.onboarding.completeHint);
  const dismissMutation = useMutation(api.onboarding.dismissHint);
  const [activeDisplayHintId, setActiveDisplayHintId] =
    useState<FeatureHintId | null>(null);
  const [localHintPatches, setLocalHintPatches] = useState(
    () => new Map<FeatureHintId, LocalHintPatch>(),
  );
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const nextCandidateOrderRef = useRef(0);
  const hintCandidatesRef = useRef(new Map<FeatureHintId, HintCandidate>());
  const activeDisplayHintIdRef = useRef<FeatureHintId | null>(null);
  const cooldownUntilRef = useRef<number | null>(null);
  const isLoadingRef = useRef(isLoading);
  const selectionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(
    () => () => {
      if (selectionTimerRef.current !== null) {
        window.clearTimeout(selectionTimerRef.current);
      }
    },
    [],
  );

  const hintsById = useMemo(() => {
    const map = new Map<string, FeatureHintRecord>();
    for (const hint of hints) {
      map.set(hint.hintId, hint);
    }
    for (const [hintId, patch] of localHintPatches) {
      map.set(hintId, {
        ...map.get(hintId),
        hintId,
        ...patch,
      });
    }
    return map;
  }, [hints, localHintPatches]);

  const isHintCompleted = useCallback(
    (hintId: FeatureHintId) => hintsById.get(hintId)?.completedAt !== undefined,
    [hintsById],
  );
  const isHintDismissed = useCallback(
    (hintId: FeatureHintId) => hintsById.get(hintId)?.dismissedAt !== undefined,
    [hintsById],
  );
  const isHintShown = useCallback(
    (hintId: FeatureHintId) => hintsById.get(hintId)?.shownAt !== undefined,
    [hintsById],
  );
  const isHintPending = useCallback(
    (hintId: FeatureHintId, trigger: boolean) => {
      if (!trigger) return false;
      if (isLoading) return false;
      const record = hintsById.get(hintId);
      if (!record) return true;
      if (record.shownAt !== undefined) return false;
      if (record.completedAt !== undefined) return false;
      if (record.dismissedAt !== undefined) return false;
      return true;
    },
    [hintsById, isLoading],
  );

  const isHintDisplayActive = useCallback(
    (hintId: FeatureHintId) => activeDisplayHintId === hintId,
    [activeDisplayHintId],
  );

  const setActiveHint = useCallback((hintId: FeatureHintId | null) => {
    activeDisplayHintIdRef.current = hintId;
    setActiveDisplayHintId(hintId);
  }, []);

  const setCooldown = useCallback((nextCooldownUntil: number | null) => {
    cooldownUntilRef.current = nextCooldownUntil;
    setCooldownUntil(nextCooldownUntil);
  }, []);

  const runQueuedSelection = useCallback(() => {
    if (activeDisplayHintIdRef.current !== null) return;
    if (isLoadingRef.current) return;
    if (cooldownUntilRef.current !== null) return;

    const selectedHintId = selectHintCandidate(hintCandidatesRef.current);
    if (selectedHintId === null) return;
    setActiveHint(selectedHintId);
  }, [setActiveHint]);

  const scheduleQueuedSelection = useCallback(() => {
    if (selectionTimerRef.current !== null) return;
    selectionTimerRef.current = window.setTimeout(() => {
      selectionTimerRef.current = null;
      runQueuedSelection();
    }, 0);
  }, [runQueuedSelection]);

  const requestHintDisplay = useCallback(
    (hintId: FeatureHintId, eligible: boolean) => {
      const current = hintCandidatesRef.current;
      const existing = current.get(hintId);
      if (existing && existing.eligible === eligible) return;

      const next = new Map(current);
      next.set(hintId, {
        eligible,
        order: existing?.order ?? nextCandidateOrderRef.current,
      });
      if (!existing) {
        nextCandidateOrderRef.current += 1;
      }
      hintCandidatesRef.current = next;

      if (eligible) {
        scheduleQueuedSelection();
      }
    },
    [scheduleQueuedSelection],
  );

  const releaseHintDisplay = useCallback(
    (hintId: FeatureHintId) => {
      const current = hintCandidatesRef.current;
      if (current.has(hintId)) {
        const next = new Map(current);
        next.delete(hintId);
        hintCandidatesRef.current = next;
      }
      if (activeDisplayHintIdRef.current === hintId) {
        setActiveHint(null);
        scheduleQueuedSelection();
      }
    },
    [scheduleQueuedSelection, setActiveHint],
  );

  useEffect(() => {
    if (cooldownUntil === null) return;

    const remainingMs = cooldownUntil - Date.now();
    const timer = window.setTimeout(
      () => {
        setCooldown(null);
        scheduleQueuedSelection();
      },
      Math.max(remainingMs, 0),
    );
    return () => window.clearTimeout(timer);
  }, [cooldownUntil, scheduleQueuedSelection, setCooldown]);

  const markShown = useCallback(
    (hintId: FeatureHintId) => {
      const record = hintsById.get(hintId);
      if (record?.shownAt !== undefined) return;
      const now = Date.now();
      logInteraction("onboarding", "hint-shown", { hintId });
      setLocalHintPatches((current) => {
        const next = new Map(current);
        next.set(hintId, { ...next.get(hintId), shownAt: now });
        return next;
      });
      void markShownMutation({ hintId });
    },
    [hintsById, markShownMutation],
  );

  const startCooldownAfterActiveHint = useCallback(
    (hintId: FeatureHintId) => {
      if (activeDisplayHintIdRef.current === hintId) {
        setActiveHint(null);
        setCooldown(Date.now() + HINT_QUEUE_COOLDOWN_MS);
      }
      const current = hintCandidatesRef.current;
      if (current.has(hintId)) {
        const next = new Map(current);
        next.delete(hintId);
        hintCandidatesRef.current = next;
      }
    },
    [setActiveHint, setCooldown],
  );

  const complete = useCallback(
    (hintId: FeatureHintId) => {
      const record = hintsById.get(hintId);
      if (record?.completedAt !== undefined) return;
      const now = Date.now();
      logInteraction("onboarding", "hint-completed", { hintId });
      setLocalHintPatches((current) => {
        const next = new Map(current);
        next.set(hintId, { ...next.get(hintId), completedAt: now });
        return next;
      });
      startCooldownAfterActiveHint(hintId);
      void completeMutation({ hintId });
    },
    [completeMutation, hintsById, startCooldownAfterActiveHint],
  );

  const dismiss = useCallback(
    (hintId: FeatureHintId) => {
      const record = hintsById.get(hintId);
      if (record?.dismissedAt !== undefined) return;
      const now = Date.now();
      logInteraction("onboarding", "hint-dismissed", { hintId });
      setLocalHintPatches((current) => {
        const next = new Map(current);
        next.set(hintId, { ...next.get(hintId), dismissedAt: now });
        return next;
      });
      startCooldownAfterActiveHint(hintId);
      void dismissMutation({ hintId });
    },
    [dismissMutation, hintsById, startCooldownAfterActiveHint],
  );

  const value = useMemo<StagedOnboardingValue>(
    () => ({
      milestones,
      isHintCompleted,
      isHintDismissed,
      isHintShown,
      isHintPending,
      isHintDisplayActive,
      requestHintDisplay,
      releaseHintDisplay,
      markShown,
      complete,
      dismiss,
      isLoading,
    }),
    [
      complete,
      dismiss,
      isHintCompleted,
      isHintDismissed,
      isHintDisplayActive,
      isHintPending,
      isHintShown,
      isLoading,
      markShown,
      milestones,
      releaseHintDisplay,
      requestHintDisplay,
    ],
  );

  return (
    <StagedOnboardingContext.Provider value={value}>
      {children}
    </StagedOnboardingContext.Provider>
  );
}
