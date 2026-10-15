import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StagedOnboardingProvider } from "@/components/tutorial/staged-onboarding-provider";
import type { FeatureHintRecord } from "@/components/tutorial/staged-onboarding-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { memorizeStartHref } from "@/hooks/use-memorize-start";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import {
  estimateMasteryDays,
  formatMasteryDuration,
} from "@/lib/memorize-plan";
import type { MemorizeTarget } from "@/lib/memorize-target";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";

import { useMemorizeSheet } from "./memorize-context";
import { MemorizeProvider } from "./memorize-provider";

const NOW = 1_700_000_000_000;

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  queryArgs: new Map<string, unknown>(),
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  navigate: vi.fn(),
  location: { pathname: "/memory/presets", searchStr: "?q=1" },
  toast: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetchChapters: vi.fn(),
  isMobile: false,
  packs: [] as unknown[],
  verseText: null as string | null,
}));

function mutation(name: string) {
  let fn = mocks.mutations.get(name);
  if (!fn) {
    fn = vi.fn().mockResolvedValue(null);
    mocks.mutations.set(name, fn);
  }
  return fn;
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutation(name),
  useAction: () => mocks.fetchChapters,
  useConvex: () => ({ query: vi.fn() }),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args: unknown) => {
    if (args === "skip") return undefined;
    mocks.queryArgs.set(name, args);
    return mocks.queryResults.get(name);
  },
  usePaginatedQuery: () => ({
    results: mocks.packs,
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: { getChaptersBatch: "esv.getChaptersBatch" },
    onboarding: {
      markHintShown: "onboarding.markHintShown",
      completeHint: "onboarding.completeHint",
      dismissHint: "onboarding.dismissHint",
    },
    packs: {
      addVerse: "packs.addVerse",
      create: "packs.create",
      createAndMemorize: "packs.createAndMemorize",
      listMine: "packs.listMine",
      startPreset: "packs.startPreset",
    },
    passageMemory: {
      getForPack: "passageMemory.getForPack",
      start: "passageMemory.start",
    },
    verseMemory: {
      getInMemory: "verseMemory.getInMemory",
      memorize: "verseMemory.memorize",
      memorizeStatus: "verseMemory.memorizeStatus",
    },
  },
}));

vi.mock("@/hooks/use-esv-reference", () => ({
  useEsvReference: (ref: unknown) => ({
    data:
      ref && mocks.verseText ? { verses: [{ text: mocks.verseText }] } : null,
    loading: false,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(mocks.toast, {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  }),
}));

vi.mock("@/hooks/use-media-query", () => ({
  useIsMobile: () => mocks.isMobile,
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => NOW,
}));

vi.mock("@/lib/dev-log", () => ({
  logInteraction: vi.fn(),
}));

const milestones: OnboardingMilestones = {
  notesCount: 0,
  taggedNotesCount: 0,
  distinctTagCount: 0,
  heartsCount: 0,
  hasInlineVerseLink: false,
  hasExplicitVerseLink: false,
  starterTagCount: 0,
  customTagCount: 0,
};

const romans828 = { book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 };
const verseTarget: MemorizeTarget = { kind: "spans", spans: [romans828] };
const psalm1Target: MemorizeTarget = {
  kind: "chapters",
  book: "Psalms",
  startChapter: 1,
  endChapter: 1,
};
const HOPE_PACK = {
  _id: "pack_hope",
  name: "Verses on hope",
  kind: "custom",
  lastOpenedAt: 1,
  summary: { kind: "pack", verseCount: 2, learned: 0, mastered: 0, today: 0 },
};

function setStatus(status: unknown) {
  mocks.queryResults.set("verseMemory.memorizeStatus", status);
}

function Opener({ target }: { target: MemorizeTarget }) {
  const sheet = useMemorizeSheet();
  return (
    <button type="button" onClick={() => sheet.open(target)}>
      Open sheet
    </button>
  );
}

async function openSheet(
  target: MemorizeTarget,
  { hints = [] }: { hints?: FeatureHintRecord[] } = {},
) {
  render(
    <TooltipProvider delayDuration={0}>
      <StagedOnboardingProvider
        milestones={milestones}
        hints={hints}
        isLoading={false}
      >
        <MemorizeProvider>
          <Opener target={target} />
        </MemorizeProvider>
      </StagedOnboardingProvider>
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Open sheet" }));
  return screen.getByRole("dialog");
}

function startButton(dialog: HTMLElement) {
  return within(dialog).getByRole("button", { name: /Start memorizing/ });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("MemorizeSheet", () => {
  beforeEach(() => {
    mocks.verseText = null;
    mocks.queryResults.clear();
    mocks.queryArgs.clear();
    mocks.mutations.clear();
    mocks.navigate.mockReset();
    mocks.location = { pathname: "/memory/presets", searchStr: "?q=1" };
    mocks.toast.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.fetchChapters.mockReset();
    mocks.isMobile = false;
    mocks.packs = [HOPE_PACK];
    setStatus({ state: "none", allHearted: false });
    mutation("verseMemory.memorize").mockResolvedValue({
      added: 1,
      alreadyMemorizing: 0,
      verseRefIds: ["vr_1"],
    });
  });

  it("draws the explainer's samples from the verse being memorized", async () => {
    mocks.verseText =
      "And we know that for those who love God all things work together for good,";
    const dialog = await openSheet(verseTarget);
    const view = within(dialog);

    expect(
      view.getByText("A__ w_ k___ t___ f__ t____ w__ l___ G__…"),
    ).toBeInTheDocument();
    expect(view.getByText(/^And we/)).toBeInTheDocument();
    expect(view.queryByText(/^B____ i_ t__ m__/)).not.toBeInTheDocument();
  });

  it("plans a verse: three daily steps, no verse-count chip, heart line", async () => {
    const dialog = await openSheet(verseTarget);

    expect(screen.getByRole("dialog", { name: "Memorize Romans 8:28" })).toBe(
      dialog,
    );
    const view = within(dialog);
    expect(view.queryByText(/\d+ verses?$/)).not.toBeInTheDocument();
    expect(view.getByText("Learn it in about 3 days")).toBeInTheDocument();
    expect(view.getByText("About 3 min a day")).toBeInTheDocument();
    expect(
      view.getByText(
        "Three short daily steps, then we'll bring it back right before you'd forget it.",
      ),
    ).toBeInTheDocument();
    const mastery = formatMasteryDuration(
      estimateMasteryDays({ mode: "verse", verseCount: 1 }),
    );
    expect(view.getByText(`${mastery}.`)).toBeInTheDocument();
    expect(view.getByText("Learn it in about 3 days")).not.toHaveTextContent(
      "Mastered",
    );
    expect(
      view.getByText("Also adds Romans 8:28 to your hearts"),
    ).toBeInTheDocument();
    expect(view.getByText("How memorizing works")).toBeInTheDocument();
    expect(view.getByText(/^B____ i_ t__ m__/)).toBeInTheDocument();
    expect(
      view.queryByText(/Longer passages add up to/),
    ).not.toBeInTheDocument();
    expect(view.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(mocks.queryArgs.get("verseMemory.memorizeStatus")).toEqual({
      spans: [romans828],
    });
  });

  it("plans a passage with its verse count and the passage pace", async () => {
    setStatus({ state: "none", allHearted: true });
    const dialog = await openSheet(psalm1Target);
    const view = within(dialog);

    expect(
      view.getByRole("heading", { name: "Memorize Psalm 1" }),
    ).toBeInTheDocument();
    expect(view.getByText("6 verses")).toBeInTheDocument();
    expect(view.getByText("Learn it in about 4 days")).toBeInTheDocument();
    expect(view.getByText("About 7 min a day")).toBeInTheDocument();
    expect(
      view.getByText(
        "You'll learn it in order, a few verses a day, then say it all the way through.",
      ),
    ).toBeInTheDocument();
    expect(
      view.getByText(/Longer passages add up to 5 new verses a day\./),
    ).toBeInTheDocument();
    expect(view.queryByText(/to your hearts/)).not.toBeInTheDocument();
    expect(mocks.queryArgs.get("verseMemory.memorizeStatus")).toEqual({
      spans: [{ book: "Psalms", chapter: 1, startVerse: 1, endVerse: 6 }],
    });
  });

  it("says a memorized verse inside a passage counts as learned", async () => {
    setStatus({
      state: "none",
      allHearted: true,
      carriedOver: [
        {
          book: "Psalms",
          chapter: 1,
          startVerse: 3,
          endVerse: 3,
          memorized: true,
        },
      ],
    });
    const dialog = await openSheet(psalm1Target);

    expect(
      within(dialog).getByText(
        "You've already memorized Psalm 1:3. It counts as learned.",
      ),
    ).toBeInTheDocument();
  });

  it("says progress on started verses carries over into a passage", async () => {
    setStatus({
      state: "none",
      allHearted: true,
      carriedOver: [3, 5].map((verse) => ({
        book: "Psalms",
        chapter: 1,
        startVerse: verse,
        endVerse: verse,
        memorized: verse === 3,
      })),
    });
    const dialog = await openSheet(psalm1Target);

    expect(
      within(dialog).getByText(
        "You've already started Psalm 1:3 and 1:5. That progress carries over.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves the carried-over line out when not starting a passage", async () => {
    setStatus({
      state: "none",
      allHearted: true,
      carriedOver: [
        {
          book: "John",
          chapter: 3,
          startVerse: 16,
          endVerse: 16,
          memorized: true,
        },
      ],
    });
    const dialog = await openSheet({
      kind: "spans",
      spans: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 17 }],
    });

    expect(
      within(dialog).queryByText(/You've already/),
    ).not.toBeInTheDocument();
  });

  it("plans a pack by card count and starts it with the typed name", async () => {
    mutation("packs.createAndMemorize").mockResolvedValue({
      packId: "pack_9",
    });
    const dialog = await openSheet({
      kind: "spans",
      spans: [
        { book: "John", chapter: 3, startVerse: 16, endVerse: 17 },
        romans828,
      ],
    });
    const view = within(dialog);

    expect(
      view.getByRole("heading", { name: "Memorize 3 verses" }),
    ).toBeInTheDocument();
    expect(view.getByText("3 verses")).toBeInTheDocument();
    expect(view.getByText("Learn it in about 3 days")).toBeInTheDocument();
    expect(view.getByText("About 6 min a day")).toBeInTheDocument();
    expect(
      view.getByText(
        "Each verse takes three short daily steps. We'll keep them all fresh for you.",
      ),
    ).toBeInTheDocument();

    const name = view.getByLabelText("Name");
    expect(name).toHaveValue("3 verses");
    expect(name).toHaveAttribute("placeholder", "e.g. Verses on hope");
    await userEvent.clear(name);
    await userEvent.type(name, "Merced team");
    await userEvent.click(startButton(dialog));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        href: memorizeStartHref(
          { kind: "pack", packId: "pack_9" as never },
          "/memory/presets?q=1",
        ),
      }),
    );
    expect(mutation("packs.createAndMemorize")).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Merced team" }),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("hides the explainer once it has been completed", async () => {
    const dialog = await openSheet(verseTarget, {
      hints: [
        { hintId: FEATURE_HINTS.MEMORIZE_EXPLAINER, completedAt: NOW - 1 },
      ],
    });

    expect(
      within(dialog).queryByText("How memorizing works"),
    ).not.toBeInTheDocument();
  });

  it("starts, closes, completes the explainer, and goes straight to learning", async () => {
    const dialog = await openSheet(verseTarget);

    await userEvent.click(startButton(dialog));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mutation("verseMemory.memorize")).toHaveBeenCalledWith({
      spans: [romans828],
      now: expect.any(Number) as number,
    });
    expect(mutation("onboarding.completeHint")).toHaveBeenCalledWith({
      hintId: FEATURE_HINTS.MEMORIZE_EXPLAINER,
    });
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: memorizeStartHref(
        { kind: "verse", verseRefId: "vr_1" as never, span: romans828 },
        "/memory/presets?q=1",
      ),
    });
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("adds a started verse to the pack picked under the plan", async () => {
    const dialog = await openSheet(verseTarget);

    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Add to a pack (optional)",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitemradio", { name: "Verses on hope" }),
    );
    expect(
      within(dialog).getByRole("button", { name: "Verses on hope" }),
    ).toBeInTheDocument();
    await userEvent.click(startButton(dialog));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        href: memorizeStartHref(
          { kind: "verse", verseRefId: "vr_1" as never, span: romans828 },
          "/memory/presets?q=1",
        ),
      }),
    );
    const memorize = mutation("verseMemory.memorize");
    const addVerse = mutation("packs.addVerse");
    expect(addVerse).toHaveBeenCalledWith({ id: "pack_hope", ...romans828 });
    expect(memorize.mock.invocationCallOrder[0]).toBeLessThan(
      addVerse.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mutation("packs.createAndMemorize")).not.toHaveBeenCalled();
  });

  it("makes a new pack with the verse, named right in the sheet", async () => {
    const dialog = await openSheet(verseTarget);

    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Add to a pack (optional)",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "New pack…" }),
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "New pack name" }),
      "Hope{Enter}",
    );

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mutation("packs.createAndMemorize")).toHaveBeenCalledWith({
      name: "Hope",
      spans: [romans828],
      now: expect.any(Number) as number,
    });
    expect(mutation("packs.addVerse")).not.toHaveBeenCalled();
  });

  it("drops the pack again with the clear button", async () => {
    const dialog = await openSheet(verseTarget);
    const view = within(dialog);

    await userEvent.click(
      view.getByRole("button", { name: "Add to a pack (optional)" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitemradio", { name: "Verses on hope" }),
    );
    await userEvent.click(
      view.getByRole("button", { name: "Don't add to a pack" }),
    );
    await userEvent.click(startButton(dialog));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mutation("packs.addVerse")).not.toHaveBeenCalled();
  });

  it("still starts learning when adding to the pack fails", async () => {
    mutation("packs.addVerse").mockRejectedValue(new Error("offline"));
    const dialog = await openSheet(verseTarget);

    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Add to a pack (optional)",
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitemradio", { name: "Verses on hope" }),
    );
    await userEvent.click(startButton(dialog));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't add to Verses on hope.",
      ),
    );
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalledWith(
      "Couldn't start memorizing. Try again.",
    );
  });

  it("offers a pack only for a single verse", async () => {
    const dialog = await openSheet(psalm1Target);

    expect(
      within(dialog).queryByRole("button", { name: /Add to a pack/ }),
    ).not.toBeInTheDocument();
  });

  it("returns a session started on Today to plain Today", async () => {
    mocks.location = { pathname: "/memory", searchStr: "?panel=verses" };
    const dialog = await openSheet(verseTarget);

    await userEvent.click(startButton(dialog));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        href: "/memory/learn?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory",
      }),
    );
  });

  it("opens a target that turns out to be memorized already", async () => {
    mutation("verseMemory.memorize").mockResolvedValue({
      added: 0,
      alreadyMemorizing: 1,
      verseRefIds: ["vr_1"],
    });
    const dialog = await openSheet(verseTarget);

    await userEvent.click(startButton(dialog));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        href: "/memory/verse/vr_1",
      }),
    );
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("starts once on a double click", async () => {
    const pending = deferred<{
      added: number;
      alreadyMemorizing: number;
      verseRefIds: string[];
    }>();
    mutation("verseMemory.memorize").mockReturnValue(pending.promise);
    const dialog = await openSheet(verseTarget);

    await userEvent.dblClick(startButton(dialog));
    pending.resolve({ added: 1, alreadyMemorizing: 0, verseRefIds: ["vr_1"] });

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mutation("verseMemory.memorize")).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it("keeps the sheet open with a toast when starting fails", async () => {
    mutation("verseMemory.memorize").mockRejectedValue(new Error("offline"));
    const dialog = await openSheet(verseTarget);

    await userEvent.click(startButton(dialog));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn't start memorizing. Try again.",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(startButton(dialog)).toBeEnabled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("waits for the status before allowing a start", async () => {
    setStatus(undefined);
    const dialog = await openSheet(verseTarget);

    expect(startButton(dialog)).toBeDisabled();
    expect(
      within(dialog).queryByText(/to your hearts/),
    ).not.toBeInTheDocument();
  });

  function setInMemory(status: "new" | "learning", learnStage: number): void {
    mocks.queryResults.set("verseMemory.getInMemory", {
      verseRefId: "vr_1",
      ...romans828,
      memory: {
        status,
        learnStage,
        ease: 2.5,
        intervalDays: 0,
        dueAt: NOW - 1,
        consecutiveCorrect: 0,
        lapses: 0,
      },
      packIds: [],
    });
  }

  it("says a verse is up next in its pack and starts it now", async () => {
    setStatus({
      state: "memorizing",
      destination: { kind: "verse", verseRefId: "vr_1", span: romans828 },
      progress: "upNext",
      upNextPackName: "Sample · Mix",
      allHearted: true,
    });
    setInMemory("new", 0);
    const dialog = await openSheet(verseTarget);
    const view = within(dialog);

    expect(
      view.getByRole("heading", {
        name: "Romans 8:28 is up next in Sample · Mix",
      }),
    ).toBeInTheDocument();
    expect(
      view.getByText("It starts when the pack gets to it, or start it now."),
    ).toBeInTheDocument();
    expect(view.queryByText(/You're memorizing/)).not.toBeInTheDocument();
    expect(view.getByRole("button", { name: "Add to pack" })).toBeVisible();
    expect(view.getByRole("button", { name: "Open" })).toHaveAttribute(
      "data-variant",
      "outline",
    );
    const startNow = view.getByRole("button", { name: "Start now" });
    expect(startNow).toHaveAttribute("data-variant", "default");

    await userEvent.click(startNow);
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory/learn?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fpresets%3Fq%3D1",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mutation("verseMemory.memorize")).not.toHaveBeenCalled();
  });

  it("says a verse added but never practiced hasn't started", async () => {
    mocks.location = { pathname: "/memory", searchStr: "?panel=verses" };
    setStatus({
      state: "memorizing",
      destination: { kind: "verse", verseRefId: "vr_1", span: romans828 },
      progress: "notStarted",
      allHearted: true,
    });
    setInMemory("learning", 0);
    const dialog = await openSheet(verseTarget);
    const view = within(dialog);

    expect(
      view.getByRole("heading", {
        name: "You added Romans 8:28 but haven't started",
      }),
    ).toBeInTheDocument();
    expect(
      view.getByText("Read it, then type it with first letters"),
    ).toBeInTheDocument();

    await userEvent.click(view.getByRole("button", { name: "Open" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory?panel=verse%3Avr_1",
    });
  });

  it("starts a not-started verse from Today back to plain Today", async () => {
    mocks.location = { pathname: "/memory", searchStr: "?panel=verses" };
    setStatus({
      state: "memorizing",
      destination: { kind: "verse", verseRefId: "vr_1", span: romans828 },
      progress: "notStarted",
      allHearted: true,
    });
    const dialog = await openSheet(verseTarget);

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Start" }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory/learn?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory",
    });
  });

  it("shows what's next for a verse already being memorized", async () => {
    setStatus({
      state: "memorizing",
      destination: { kind: "verse", verseRefId: "vr_1", span: romans828 },
      progress: "learning",
      allHearted: true,
    });
    setInMemory("learning", 1);
    const dialog = await openSheet(verseTarget);
    const view = within(dialog);

    expect(
      view.getByRole("heading", { name: "You're memorizing Romans 8:28" }),
    ).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Start/ }),
    ).not.toBeInTheDocument();
    expect(
      view.getByText("Read it, then type it with first letters"),
    ).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /Start memorizing/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(view.getByRole("button", { name: "Add to pack" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Verses on hope" }),
    );
    expect(mutation("packs.addVerse")).toHaveBeenCalledWith({
      id: "pack_hope",
      ...romans828,
    });
    await screen.findByRole("button", { name: /Verses on hope\s*Added/ });
    await userEvent.keyboard("{Escape}");

    await userEvent.click(view.getByRole("button", { name: "Open" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory/verse/vr_1",
    });
  });

  it("opens the drawer instead when already on Today", async () => {
    mocks.location = { pathname: "/memory", searchStr: "" };
    setStatus({
      state: "memorizing",
      destination: { kind: "verse", verseRefId: "vr_1", span: romans828 },
      allHearted: true,
    });
    const dialog = await openSheet(verseTarget);

    await userEvent.click(within(dialog).getByRole("button", { name: "Open" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory?panel=verse%3Avr_1",
    });
  });

  it("points a verse inside a memorized passage at that passage", async () => {
    setStatus({
      state: "partOf",
      title: "Psalm 1",
      destination: { kind: "pack", packId: "pack_1" },
      allHearted: true,
    });
    const dialog = await openSheet({
      kind: "spans",
      spans: [{ book: "Psalms", chapter: 1, startVerse: 3, endVerse: 3 }],
    });
    const view = within(dialog);

    expect(
      view.getByText("Psalm 1:3 is part of Psalm 1, which you're memorizing."),
    ).toBeInTheDocument();
    await userEvent.click(view.getByRole("button", { name: "Open Psalm 1" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory/pack_1",
    });
  });

  it("says you're memorizing the passage a range sits inside", async () => {
    setStatus({
      state: "partOf",
      title: "Romans 8",
      destination: { kind: "pack", packId: "pack_8" },
      allHearted: true,
    });
    const dialog = await openSheet({
      kind: "spans",
      spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 39 }],
    });
    const view = within(dialog);

    expect(
      view.getByRole("heading", { name: "You're memorizing Romans 8" }),
    ).toBeInTheDocument();
    expect(
      view.getByText("Romans 8:28\u201339 is part of it."),
    ).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /Start memorizing/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(view.getByRole("button", { name: "Open" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory/pack_8",
    });
  });

  it("blocks a passage that overlaps one being memorized", async () => {
    setStatus({
      state: "overlaps",
      title: "More than conquerors",
      destination: { kind: "pack", packId: "pack_828" },
      allHearted: false,
    });
    const dialog = await openSheet({
      kind: "chapters",
      book: "Romans",
      startChapter: 8,
      endChapter: 8,
    });
    const view = within(dialog);

    expect(
      view.getByText(
        "This overlaps More than conquerors, which you're memorizing. Stop it first to memorize Romans 8.",
      ),
    ).toBeInTheDocument();
    expect(startButton(dialog)).toBeDisabled();
    await userEvent.click(
      view.getByRole("button", { name: "Open More than conquerors" }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory/pack_828",
    });
  });

  it("lets a verse overlap a passage being memorized", async () => {
    setStatus({
      state: "overlaps",
      title: "More than conquerors",
      destination: { kind: "pack", packId: "pack_828" },
      allHearted: true,
    });
    const dialog = await openSheet({
      kind: "spans",
      spans: [{ book: "Romans", chapter: 8, startVerse: 27, endVerse: 28 }],
    });

    expect(startButton(dialog)).toBeEnabled();
    expect(within(dialog).queryByText(/This overlaps/)).not.toBeInTheDocument();
  });

  it("says when a short passage is learned all together", async () => {
    mocks.fetchChapters.mockResolvedValue([
      {
        chapter: 23,
        data: {
          canonical: "Psalm 23",
          copyright: "ESV",
          verses: [1, 2, 3, 4, 5, 6].map((number) => ({
            number,
            text: "The Lord is my shepherd,",
          })),
        },
      },
    ]);
    const span = { book: "Psalms", chapter: 23, startVerse: 1, endVerse: 4 };
    const dialog = await openSheet({ kind: "spans", spans: [span] });

    await userEvent.click(startButton(dialog));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mutation("verseMemory.memorize")).toHaveBeenCalledWith({
      spans: [span],
      now: expect.any(Number) as number,
    });
    expect(mutation("packs.create")).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      "It's short, so you'll learn it all together.",
    );
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: memorizeStartHref(
        { kind: "verse", verseRefId: "vr_1" as never, span },
        "/memory/presets?q=1",
      ),
    });
  });

  it("disables starting a passage longer than 20 chapters", async () => {
    const dialog = await openSheet({
      kind: "chapters",
      book: "Romans",
      startChapter: 1,
      endChapter: 21,
    });

    expect(
      within(dialog).getByText(
        "Pick up to 20 chapters to memorize as one passage.",
      ),
    ).toBeInTheDocument();
    expect(startButton(dialog)).toBeDisabled();
  });

  it("is a bottom sheet on mobile with the start button outside the scroll area", async () => {
    mocks.isMobile = true;
    const dialog = await openSheet(verseTarget);

    expect(dialog).toHaveAttribute("data-side", "bottom");
    const start = startButton(dialog);
    expect(start.closest('[data-slot="sheet-footer"]')).not.toBeNull();
    expect(start.closest('[data-slot="sheet-body"]')).toBeNull();
  });

  it("closes on Escape and returns focus to the opener", async () => {
    await openSheet(verseTarget);

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Open sheet" })).toHaveFocus();
  });
});
