import { describe, expect, it } from "vitest";
import { CROSSFADE_TRANSITION } from "./note-animation-config";
import {
  draftComposerLayoutId,
  draftComposerMotionProps,
  draftGroupPresenceKey,
  draftSpanLayoutId,
  groupListPresenceMotion,
  groupOwnsRetargetingDraft,
  groupUsesRetargetMotion,
  isInPlaceGroupRetarget,
  singleVersePresenceKind,
  singleVersePresenceMotion,
  verseListPresenceMode,
} from "./draft-retarget-presence";

const EDITOR_KEY = "new:16:16";

describe("draft retarget presence", () => {
  it("keeps one presence key from 16 through 16–17 to 15–17", () => {
    const spanId = draftSpanLayoutId(EDITOR_KEY);
    expect(spanId).toBe("draft-span-new:16:16");
    expect(draftGroupPresenceKey(16, [{ editorKey: EDITOR_KEY }])).toBe(spanId);
    expect(draftGroupPresenceKey(15, [{ editorKey: EDITOR_KEY }])).toBe(spanId);
    expect(draftComposerLayoutId(EDITOR_KEY)).toBe("draft-new:16:16");
    expect(draftGroupPresenceKey(9, [])).toBe("passage-group-9");
  });

  it("skips note-enter on a nudge remount and keeps it for the first open", () => {
    expect(draftComposerMotionProps(false, false).initial).toEqual({
      opacity: 0,
      height: 0,
    });
    expect(draftComposerMotionProps(true, false).initial).toBe(false);
    expect(draftComposerMotionProps(true, true).transition).toEqual({
      duration: 0,
    });
    expect(draftComposerMotionProps(false, true).transition).not.toEqual({
      duration: 0,
    });
  });

  it("limits skip-enter to the group that docks the nudged draft", () => {
    expect(
      groupOwnsRetargetingDraft([{ editorKey: EDITOR_KEY }], EDITOR_KEY),
    ).toBe(true);
    expect(
      groupOwnsRetargetingDraft([{ editorKey: "new:3:5" }], EDITOR_KEY),
    ).toBe(false);
    expect(groupOwnsRetargetingDraft([], EDITOR_KEY)).toBe(false);
    expect(groupOwnsRetargetingDraft([{ editorKey: EDITOR_KEY }], null)).toBe(
      false,
    );

    const owning = groupListPresenceMotion(true, false);
    const other = groupListPresenceMotion(false, false);
    expect(owning.initial).toBe(false);
    expect(other.initial).toEqual({ opacity: 0 });
    expect(other.transition).toBe(CROSSFADE_TRANSITION);
    expect(groupListPresenceMotion(true, true).transition).toEqual({
      duration: 0,
    });
    expect(groupListPresenceMotion(true, true).exit).toEqual({ opacity: 1 });
  });

  it("uses popLayout for first grouping, shrink-to-single, and close", () => {
    expect(
      isInPlaceGroupRetarget(
        { startVerse: 16, endVerse: 16 },
        { startVerse: 16, endVerse: 17 },
      ),
    ).toBe(false);
    expect(
      isInPlaceGroupRetarget(
        { startVerse: 16, endVerse: 17 },
        { startVerse: 16, endVerse: 16 },
      ),
    ).toBe(false);
    expect(
      isInPlaceGroupRetarget(
        { startVerse: 16, endVerse: 17 },
        { startVerse: 15, endVerse: 17 },
      ),
    ).toBe(true);
    expect(verseListPresenceMode(false)).toBe("popLayout");
    expect(verseListPresenceMode(true)).toBe("sync");
    expect(
      groupUsesRetargetMotion([{ editorKey: EDITOR_KEY }], EDITOR_KEY, false),
    ).toBe(false);
    expect(
      groupUsesRetargetMotion([{ editorKey: EDITOR_KEY }], EDITOR_KEY, true),
    ).toBe(true);
    expect(
      groupListPresenceMotion(
        groupUsesRetargetMotion([{ editorKey: EDITOR_KEY }], EDITOR_KEY, false),
        false,
      ).initial,
    ).toEqual({ opacity: 0 });
  });

  it("orders presence as host, then reenter, then neighbor, then default", () => {
    const openDrafts = [{ startVerse: 16, endVerse: 16 }];

    expect(
      singleVersePresenceKind({
        hostsOpenDraft: true,
        reenteringFromGroup: true,
        verseNumber: 16,
        openDrafts,
        inPlaceRetarget: true,
      }),
    ).toBe("draft-host");

    expect(
      singleVersePresenceKind({
        hostsOpenDraft: true,
        reenteringFromGroup: false,
        verseNumber: 16,
        openDrafts,
        inPlaceRetarget: false,
      }),
    ).toBe("default");

    expect(
      singleVersePresenceKind({
        hostsOpenDraft: false,
        reenteringFromGroup: true,
        verseNumber: 17,
        openDrafts,
        inPlaceRetarget: true,
      }),
    ).toBe("reenter");

    expect(
      singleVersePresenceKind({
        hostsOpenDraft: false,
        reenteringFromGroup: false,
        verseNumber: 17,
        openDrafts,
        inPlaceRetarget: true,
      }),
    ).toBe("retarget-neighbor");

    expect(
      singleVersePresenceKind({
        hostsOpenDraft: false,
        reenteringFromGroup: false,
        verseNumber: 20,
        openDrafts,
        inPlaceRetarget: true,
      }),
    ).toBe("default");

    expect(
      singleVersePresenceKind({
        hostsOpenDraft: false,
        reenteringFromGroup: false,
        verseNumber: 17,
        openDrafts,
        inPlaceRetarget: false,
      }),
    ).toBe("default");

    expect(singleVersePresenceMotion("reenter", false).transition).toBe(
      CROSSFADE_TRANSITION,
    );
    expect(singleVersePresenceMotion("draft-host", false).initial).toBe(false);
    expect(
      singleVersePresenceMotion("retarget-neighbor", true).exit,
    ).toMatchObject({ height: 0, opacity: 1 });
  });
});
