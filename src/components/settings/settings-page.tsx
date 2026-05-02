import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { TutorialStatus } from "../../../convex/lib/tutorial";
import { ImportExportSection } from "@/components/settings/import-export-section";
import { useTutorial } from "@/components/tutorial/tutorial-context";
import { useTabs } from "@/lib/use-tabs";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  ALL_STARTER_TAGS,
  DEFAULT_STARTER_TAG_CATEGORY_COLORS,
} from "@/lib/starter-tags";
import { normalizeTag } from "@/lib/tag-utils";
import { CustomTagsSection } from "@/components/settings/custom-tags-section";
import { StarterTagsSection } from "@/components/settings/starter-tags-section";
import { DevSeedSection } from "@/components/settings/dev-seed-section";
import { TutorialActionsSection } from "@/components/settings/tutorial-actions-section";
import { DeleteCustomTagDialog } from "@/components/settings/delete-custom-tag-dialog";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { logInteraction } from "@/lib/dev-log";

interface SeedResultSummary {
  seed: number;
  selectedChapters: number;
  heavyChapters: number;
  notesCreated: number;
  verseRefsCreated: number;
  linksCreated: number;
  testamentDistribution: { ot: number; nt: number };
  cleanup: {
    notesDeleted: number;
    linksDeleted: number;
    verseRefsDeleted: number;
  };
  usedTags: string[];
}

export function SettingsPage() {
  const catalog = useQuery(api.tags.listCatalog);
  const setupStatus: TutorialStatus | undefined = useQuery(
    api.userSettings.getTutorialStatus,
  );
  const addMany = useMutation(api.tags.addMany);
  const removeMany = useMutation(api.tags.removeMany);
  const removeCustomTagAndDetach = useMutation(
    api.tags.removeCustomTagAndDetach,
  );
  const setCategoryColor = useMutation(
    api.userSettings.setStarterTagCategoryColor,
  );
  const seedDevChapterNotes = useMutation(api.seed.seedDevChapterNotes);
  const { startTour } = useTutorial();
  const { backPassageId } = useTabs();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    logInteraction("settings", "closed");
    void navigate({
      to: "/passage/$passageId",
      params: { passageId: backPassageId },
    });
  }, [navigate, backPassageId]);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [draftCategoryColors, setDraftCategoryColors] = useState<
    Record<string, string>
  >({});
  const [customTagInput, setCustomTagInput] = useState("");
  const [deleteTagCandidate, setDeleteTagCandidate] = useState<string | null>(
    null,
  );
  const [seedResult, setSeedResult] = useState<SeedResultSummary | null>(null);

  const catalogByTag = useMemo(() => {
    const entries = catalog ?? [];
    return new Map(entries.map((entry) => [entry.tag, entry]));
  }, [catalog]);

  const customTags = useMemo(
    () => (catalog ?? []).filter((entry) => entry.source === "custom"),
    [catalog],
  );

  const parsedCustomTagInput = useMemo(() => {
    const inputTags = customTagInput
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => normalizeTag(part))
      .filter((part) => part.length > 0);

    const seen = new Set<string>();
    const duplicateTagsInInput: string[] = [];
    const duplicateTagsInCatalog: string[] = [];
    const tagsToAdd: string[] = [];

    for (const tag of inputTags) {
      if (seen.has(tag)) {
        duplicateTagsInInput.push(tag);
        continue;
      }
      seen.add(tag);

      if (catalogByTag.has(tag)) {
        duplicateTagsInCatalog.push(tag);
        continue;
      }

      tagsToAdd.push(tag);
    }

    return {
      duplicateTagsInInput,
      duplicateTagsInCatalog,
      tagsToAdd,
    };
  }, [catalogByTag, customTagInput]);

  const categoryColors = useMemo<Record<string, string>>(
    () => ({
      ...DEFAULT_STARTER_TAG_CATEGORY_COLORS,
      ...(setupStatus?.categoryColors ?? {}),
    }),
    [setupStatus?.categoryColors],
  );

  useEffect(() => {
    setDraftCategoryColors(categoryColors);
  }, [categoryColors]);

  const selectedStarterCount = useMemo(() => {
    let count = 0;
    for (const tag of ALL_STARTER_TAGS) {
      if (catalogByTag.has(tag)) count += 1;
    }
    return count;
  }, [catalogByTag]);

  const isLoading = catalog === undefined || setupStatus === undefined;
  const isDev = import.meta.env.DEV;

  const handleAddAll = async () => {
    setBusyAction("add-all");
    try {
      await addMany({ tags: ALL_STARTER_TAGS, source: "starter" });
      logInteraction("settings", "starter-tags-added-all", {
        tagCount: ALL_STARTER_TAGS.length,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddCategory = async (categoryId: string, tags: string[]) => {
    setBusyAction(`add-category:${categoryId}`);
    try {
      await addMany({ tags, source: "starter" });
      logInteraction("settings", "starter-tag-category-added", {
        categoryId,
        tagCount: tags.length,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleTag = async (tag: string) => {
    const existing = catalogByTag.get(tag);
    const isStarterTagInCatalog = existing?.source === "starter";
    const isCustomTagInCatalog = existing?.source === "custom";

    if (isCustomTagInCatalog) return;

    setBusyAction(`toggle:${tag}`);
    try {
      if (isStarterTagInCatalog) {
        await removeMany({ tags: [tag] });
        logInteraction("settings", "starter-tag-removed");
      } else {
        await addMany({ tags: [tag], source: "starter" });
        logInteraction("settings", "starter-tag-added");
      }
    } finally {
      setBusyAction(null);
    }
  };

  const colorSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const saveCategoryColor = useCallback(
    (categoryId: string, color: string) => {
      void setCategoryColor({ categoryId, color });
    },
    [setCategoryColor],
  );

  const handleColorChange = useCallback(
    (categoryId: string, color: string) => {
      logInteraction("settings", "starter-tag-category-color-changed", {
        categoryId,
      });
      setDraftCategoryColors((prev) => ({ ...prev, [categoryId]: color }));

      if (colorSaveTimers.current[categoryId]) {
        clearTimeout(colorSaveTimers.current[categoryId]);
      }
      colorSaveTimers.current[categoryId] = setTimeout(() => {
        saveCategoryColor(categoryId, color);
        delete colorSaveTimers.current[categoryId];
      }, 500);
    },
    [saveCategoryColor],
  );

  useEffect(() => {
    const timers = colorSaveTimers.current;
    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const handleAddCustomTags = async () => {
    const tags = parsedCustomTagInput.tagsToAdd;
    if (tags.length === 0) return;

    setBusyAction("add-custom");
    try {
      await addMany({ tags, source: "custom" });
      logInteraction("settings", "custom-tags-added", {
        duplicateInCatalogCount:
          parsedCustomTagInput.duplicateTagsInCatalog.length,
        duplicateInInputCount: parsedCustomTagInput.duplicateTagsInInput.length,
        tagCount: tags.length,
      });
      setCustomTagInput("");
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmDeleteCustomTag = async () => {
    if (!deleteTagCandidate) return;

    setBusyAction(`delete-custom:${deleteTagCandidate}`);
    try {
      await removeCustomTagAndDetach({ tag: deleteTagCandidate });
      logInteraction("settings", "custom-tag-deleted");
      setDeleteTagCandidate(null);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunDevSeed = async () => {
    setBusyAction("seed-dev-notes");
    try {
      const result = await seedDevChapterNotes({
        confirmReplace: true,
      });
      logInteraction("settings", "dev-seed-completed", {
        chapters: result.selectedChapters,
        linksCreated: result.linksCreated,
        notesCreated: result.notesCreated,
      });
      setSeedResult({
        seed: result.seed,
        selectedChapters: result.selectedChapters,
        heavyChapters: result.heavyChapters,
        notesCreated: result.notesCreated,
        verseRefsCreated: result.verseRefsCreated,
        linksCreated: result.linksCreated,
        testamentDistribution: result.testamentDistribution,
        cleanup: result.cleanup,
        usedTags: result.usedTags,
      });
    } finally {
      setBusyAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <motion.div
        className="mx-auto max-w-6xl px-4 py-8 space-y-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TooltipButton
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                tooltip="Back to passage"
                aria-label="Back to passage"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </TooltipButton>
              <h1 className="text-2xl font-semibold tracking-tight">
                Settings
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage import/export, tags, and category colors.
          </p>
        </div>

        <ImportExportSection />

        <section className="rounded-lg border bg-card p-5 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Tags</h2>
            <p className="text-sm text-muted-foreground">
              Manage your custom tags and starter tag catalog. All changes save
              automatically.
            </p>
          </div>

          <CustomTagsSection
            customTags={customTags}
            customTagInput={customTagInput}
            busyAction={busyAction}
            parsedCustomTagInput={parsedCustomTagInput}
            onCustomTagInputChange={setCustomTagInput}
            onAddCustomTags={handleAddCustomTags}
            onDeleteCustomTag={setDeleteTagCandidate}
          />

          <hr className="border-border" />

          <StarterTagsSection
            selectedStarterCount={selectedStarterCount}
            catalogByTag={catalogByTag}
            draftCategoryColors={draftCategoryColors}
            busyAction={busyAction}
            onAddAll={handleAddAll}
            onAddCategory={handleAddCategory}
            onColorChange={handleColorChange}
            onToggleTag={handleToggleTag}
          />
        </section>

        <DevSeedSection
          isDev={isDev}
          busyAction={busyAction}
          seedResult={seedResult}
          onRunDevSeed={handleRunDevSeed}
        />

        <TutorialActionsSection
          busyAction={busyAction}
          onReplayMainTour={() => {
            logInteraction("settings", "tutorial-replay-started", {
              tour: "main",
            });
            startTour("main");
          }}
          onReplaySearchTour={() => {
            logInteraction("settings", "tutorial-replay-started", {
              tour: "search",
            });
            startTour("search");
          }}
        />

        <DeleteAccountSection />

        <section className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
          <Link
            to="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link
            to="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms of Service
          </Link>
        </section>
      </motion.div>

      <DeleteCustomTagDialog
        deleteTagCandidate={deleteTagCandidate}
        busyAction={busyAction}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTagCandidate(null);
          }
        }}
        onCancel={() => setDeleteTagCandidate(null)}
        onConfirm={handleConfirmDeleteCustomTag}
      />
    </div>
  );
}
