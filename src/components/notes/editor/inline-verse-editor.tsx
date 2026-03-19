import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Link2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBookInfo } from "@/lib/bible-books";
import {
  EMPTY_NOTE_BODY,
  createVerseRefSegment,
  normalizeNoteBody,
  type NoteBody,
  type NoteBodySegment,
} from "@/lib/note-inline-content";
import {
  buildVerseSuggestions,
  formatVerseRef,
  parseVerseRef,
  resolveCanonicalBookName,
  type VerseRef,
  type VerseSuggestionItem,
} from "@/lib/verse-ref-utils";
import { getVerseRefBoundsErrorMessage } from "@/lib/verse-ref-validation";
import { useDebouncedEsvReferenceValidation } from "@/hooks/use-esv-reference";
import { VerseRefPreviewCard } from "@/components/verse-ref/verse-ref-hover-preview";
import { useVerseLinkNavigation } from "@/hooks/use-verse-link-navigation";
import { useTypedText } from "@/components/tutorial/use-typed-text";

interface CurrentChapter {
  book: string;
  chapter: number;
}

interface InlineVerseEditorProps {
  initialBody: NoteBody;
  verseRef: VerseRef;
  currentChapter?: CurrentChapter;
  placeholder?: string;
  className?: string;
  tourId?: string;
  tutorialPreviewText?: string;
  tutorialAnimateText?: boolean;
  tutorialPreviewQuery?: string;
  onChange: (body: NoteBody) => void;
}

interface ActiveQueryMatch {
  node: Text;
  startOffset: number;
  endOffset: number;
  query: string;
}

interface ReferenceDraft {
  book: string;
  chapterText: string;
  startVerseText: string;
  endVerseText: string | null;
}

interface QueryStatusState {
  tone: "info" | "success" | "error" | "loading";
  label: string;
  description?: string;
  previewText?: string;
  showSpinner?: boolean;
}

interface HoverPreviewState {
  refValue: VerseRef;
  left: number;
  top: number;
}

const EDITOR_PILL_CLASSNAME =
  "inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-100/80 px-2 py-0.5 align-baseline text-xs font-medium text-sky-900 dark:border-sky-700/60 dark:bg-sky-900/35 dark:text-sky-100";

const STARTER_BOOKS = ["John", "Genesis", "Psalms", "Romans"];

function buildStarterSuggestions(currentBook: string): VerseSuggestionItem[] {
  const seen = new Set<string>();
  return [currentBook, ...STARTER_BOOKS]
    .filter((book): book is string => !!book)
    .filter((book) => {
      if (seen.has(book)) return false;
      seen.add(book);
      return true;
    })
    .map((book) => ({
      kind: "book" as const,
      key: `book:${book}`,
      label: book,
      description: "Start with this book",
      book,
    }));
}

function readReferenceDraft(
  query: string,
  defaults: { defaultBook?: string; defaultChapter?: number },
): ReferenceDraft | null {
  const value = query.trim();
  if (!value) return null;

  const compactReferenceMatch = value.match(/^(\d+)(?::(\d*)(?:-(\d*))?)?$/);
  if (compactReferenceMatch && defaults.defaultBook) {
    return {
      book: defaults.defaultBook,
      chapterText:
        compactReferenceMatch[2] !== undefined
          ? compactReferenceMatch[1]
          : String(defaults.defaultChapter ?? ""),
      startVerseText: compactReferenceMatch[2] ?? compactReferenceMatch[1],
      endVerseText: compactReferenceMatch[3] ?? null,
    };
  }

  const match = value.match(/^(.+?)\s+(\d*)(?::(\d*)(?:-(\d*))?)?$/);
  if (!match) return null;

  const canonicalBook = resolveCanonicalBookName(match[1]);
  if (!canonicalBook) return null;

  return {
    book: canonicalBook,
    chapterText: match[2] ?? "",
    startVerseText: match[3] ?? "",
    endVerseText: match[4] ?? null,
  };
}

function isPotentialVerseQuery(
  query: string,
  defaults: { defaultBook?: string; defaultChapter?: number },
): boolean {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return true;
  }

  if (parseVerseRef(query, defaults) || readReferenceDraft(query, defaults)) {
    return true;
  }

  if (!/^[1-3]?\s?[A-Za-z]*(?:\s+[A-Za-z]*)*$/.test(trimmedQuery)) {
    return false;
  }

  return buildVerseSuggestions(query, defaults).some(
    (item) => item.kind === "book",
  );
}

function buildDraftStatus(draft: ReferenceDraft): QueryStatusState {
  if (!draft.chapterText) {
    return {
      tone: "info",
      label: `Now type a chapter for ${draft.book}.`,
      description: "For example: John 3:16",
    };
  }

  if (!draft.startVerseText) {
    return {
      tone: "info",
      label: `Keep typing a verse in ${draft.book} ${draft.chapterText}.`,
      description: "Add a verse number to finish the link.",
    };
  }

  if (draft.endVerseText !== null && draft.endVerseText.length === 0) {
    return {
      tone: "info",
      label: `Keep typing the end of the range for ${draft.book} ${draft.chapterText}:${draft.startVerseText}.`,
      description: "Finish the ending verse to insert a range.",
    };
  }

  return {
    tone: "info",
    label: `Keep refining ${draft.book} ${draft.chapterText}:${draft.startVerseText}.`,
    description: "Press Enter once the reference validates.",
  };
}

function getDraftChapterErrorMessage(
  draft: ReferenceDraft | null,
): string | null {
  if (!draft?.chapterText) {
    return null;
  }

  const chapter = Number.parseInt(draft.chapterText, 10);
  if (Number.isNaN(chapter)) {
    return null;
  }

  const bookInfo = getBookInfo(draft.book);
  if (!bookInfo) {
    return null;
  }

  if (chapter < 1 || chapter > bookInfo.chapters) {
    return `${draft.book} has ${bookInfo.chapters} chapter${
      bookInfo.chapters === 1 ? "" : "s"
    }.`;
  }

  return null;
}

function buildPreviewSnippet(
  refValue: VerseRef,
  verses: Array<{ number: number; text: string }>,
): string | null {
  if (verses.length === 0) {
    return null;
  }

  const flattened = verses
    .map((verse) => `${verse.text.replace(/\s+/g, " ").trim()}`)
    .join(" ")
    .trim();

  if (!flattened) {
    return null;
  }

  const maxLength = 120;
  const truncated =
    flattened.length > maxLength
      ? `${flattened.slice(0, maxLength).trimEnd()}...`
      : flattened;

  return `${formatVerseRef(refValue)} ${truncated}`;
}

function createPillElement(
  documentRef: Document,
  label: string,
  refValue: VerseRef,
): HTMLSpanElement {
  const pill = documentRef.createElement("span");
  pill.contentEditable = "false";
  pill.className = EDITOR_PILL_CLASSNAME;
  pill.dataset.noteVersePill = "true";
  pill.dataset.label = label;
  pill.dataset.book = refValue.book;
  pill.dataset.chapter = String(refValue.chapter);
  pill.dataset.startVerse = String(refValue.startVerse);
  pill.dataset.endVerse = String(refValue.endVerse);

  const text = documentRef.createElement("span");
  text.textContent = label;
  pill.append(text);

  const remove = documentRef.createElement("button");
  remove.type = "button";
  remove.className =
    "rounded-full p-0.5 transition-colors hover:bg-sky-200/80 dark:hover:bg-sky-800/60";
  remove.dataset.notePillRemove = "true";
  remove.ariaLabel = `Remove ${label}`;
  remove.textContent = "×";
  pill.append(remove);

  return pill;
}

function appendSegmentsToEditor(root: HTMLElement, body: NoteBody) {
  const normalized = normalizeNoteBody(body);
  const documentRef = root.ownerDocument;
  for (const segment of normalized.segments) {
    if (segment.type === "text") {
      root.append(documentRef.createTextNode(segment.text));
      continue;
    }
    if (segment.type === "lineBreak") {
      root.append(documentRef.createElement("br"));
      continue;
    }
    root.append(createPillElement(documentRef, segment.label, segment.ref));
  }
}

function parseSegmentsFromNodeList(
  nodes: NodeListOf<ChildNode> | ChildNode[],
): NoteBodySegment[] {
  const segments: NoteBodySegment[] = [];
  const nodeArray = Array.from(nodes);

  const pushText = (text: string) => {
    if (!text) return;
    const previous = segments[segments.length - 1];
    if (previous?.type === "text") {
      previous.text += text;
      return;
    }
    segments.push({ type: "text", text });
  };

  const pushLineBreak = () => {
    const previous = segments[segments.length - 1];
    if (previous?.type === "lineBreak") return;
    segments.push({ type: "lineBreak" });
  };

  const pushTextWithLineBreaks = (text: string) => {
    const normalizedText = text.replace(/\r\n?/g, "\n");
    const lines = normalizedText.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      pushText(lines[index] ?? "");
      if (index < lines.length - 1) {
        pushLineBreak();
      }
    }
  };

  const appendSegments = (nextSegments: NoteBodySegment[]) => {
    for (const segment of nextSegments) {
      if (segment.type === "text") {
        pushText(segment.text);
        continue;
      }
      if (segment.type === "lineBreak") {
        pushLineBreak();
        continue;
      }
      segments.push(segment);
    }
  };

  const nodeHasMeaningfulContent = (node: ChildNode): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").length > 0;
    }
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    if (node.dataset.noteVersePill === "true") {
      return true;
    }
    if (node.tagName === "BR") {
      return true;
    }
    return Array.from(node.childNodes).some((child) =>
      nodeHasMeaningfulContent(child),
    );
  };

  for (let index = 0; index < nodeArray.length; index += 1) {
    const node = nodeArray[index];
    if (node.nodeType === Node.TEXT_NODE) {
      pushTextWithLineBreaks(node.textContent ?? "");
      continue;
    }

    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (node.dataset.noteVersePill === "true") {
      segments.push(
        createVerseRefSegment(
          {
            book: node.dataset.book ?? "",
            chapter: Number.parseInt(node.dataset.chapter ?? "0", 10),
            startVerse: Number.parseInt(node.dataset.startVerse ?? "0", 10),
            endVerse: Number.parseInt(node.dataset.endVerse ?? "0", 10),
          },
          node.dataset.label ?? "",
        ),
      );
      continue;
    }

    if (node.tagName === "BR") {
      pushLineBreak();
      continue;
    }

    if (node.tagName === "DIV" || node.tagName === "P") {
      if (segments.length > 0) {
        pushLineBreak();
      }
      appendSegments(parseSegmentsFromNodeList(node.childNodes));
      const hasFollowingContent = nodeArray
        .slice(index + 1)
        .some((child) => nodeHasMeaningfulContent(child));
      if (hasFollowingContent) {
        pushLineBreak();
      }
      continue;
    }

    appendSegments(parseSegmentsFromNodeList(node.childNodes));
  }

  return segments;
}

function readBodyFromEditor(root: HTMLElement): NoteBody {
  return normalizeNoteBody({
    version: 1,
    segments: parseSegmentsFromNodeList(root.childNodes),
  });
}

function placeCaretAfterNode(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    range.setStart(textNode, textNode.data.length);
  } else {
    range.setStartAfter(node);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function readActiveQueryMatch(root: HTMLElement): ActiveQueryMatch | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  let node = selection.anchorNode;
  let offset = selection.anchorOffset;

  if (!node || !root.contains(node)) {
    return null;
  }

  if (node instanceof HTMLElement) {
    const childAtCursor = node.childNodes[offset];
    const childBeforeCursor = node.childNodes[offset - 1];
    if (childAtCursor instanceof Text) {
      node = childAtCursor;
      offset = 0;
    } else if (childBeforeCursor instanceof Text) {
      node = childBeforeCursor;
      offset = childBeforeCursor.data.length;
    } else {
      return null;
    }
  }

  if (!(node instanceof Text)) {
    return null;
  }

  const prefix = node.data.slice(0, offset);
  const match = prefix.match(/(^|[\s])@([^\n@]*)$/);
  if (!match) {
    return null;
  }

  return {
    node,
    query: match[2],
    startOffset: offset - match[2].length - 1,
    endOffset: offset,
  };
}

function replaceTextInRange(match: ActiveQueryMatch, replacement: string) {
  match.node.data =
    match.node.data.slice(0, match.startOffset) +
    replacement +
    match.node.data.slice(match.endOffset);

  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStart(match.node, match.startOffset + replacement.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function replaceQueryWithPill(match: ActiveQueryMatch, refValue: VerseRef) {
  const documentRef = match.node.ownerDocument;
  const label = formatVerseRef(refValue);
  const before = match.node.data.slice(0, match.startOffset);
  const after = match.node.data.slice(match.endOffset);
  const afterNode = documentRef.createTextNode(` ${after}`);
  const pill = createPillElement(documentRef, label, refValue);

  match.node.data = before;
  match.node.parentNode?.insertBefore(pill, match.node.nextSibling);
  match.node.parentNode?.insertBefore(afterNode, pill.nextSibling);
  placeCaretAfterNode(afterNode);
}

function insertPlainTextAtCursor(root: HTMLElement, text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    root.append(document.createTextNode(text));
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const pieces = text.split("\n");
  let lastInserted: Node | null = null;
  for (let index = 0; index < pieces.length; index += 1) {
    const textNode = document.createTextNode(pieces[index]);
    range.insertNode(textNode);
    lastInserted = textNode;
    range.setStartAfter(textNode);

    if (index < pieces.length - 1) {
      const br = document.createElement("br");
      range.insertNode(br);
      lastInserted = br;
      range.setStartAfter(br);
    }
  }

  if (lastInserted) {
    placeCaretAfterNode(lastInserted);
  }
}

export function InlineVerseEditor({
  initialBody,
  verseRef,
  currentChapter,
  placeholder = "Write your note...",
  className,
  tourId,
  tutorialPreviewText,
  tutorialAnimateText = false,
  tutorialPreviewQuery,
  onChange,
}: InlineVerseEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigateToVerse = useVerseLinkNavigation(currentChapter);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(
    () => normalizeNoteBody(initialBody).segments.length === 0,
  );
  const [isQueryActive, setIsQueryActive] = useState(false);
  const [activeQuery, setActiveQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(
    null,
  );
  const activeQueryMatchRef = useRef<ActiveQueryMatch | null>(null);
  const showTutorialText = !!tutorialPreviewText;
  const isTutorialLinkStep =
    !!tutorialPreviewText && !!tutorialPreviewQuery && !tutorialAnimateText;
  const effectiveQuery =
    isQueryActive || !tutorialPreviewQuery ? activeQuery : tutorialPreviewQuery;
  const trimmedEffectiveQuery = effectiveQuery.trim();
  const {
    visibleText: animatedTutorialText,
    isComplete: isTutorialTextComplete,
  } = useTypedText({
    active: showTutorialText && tutorialAnimateText,
    text: tutorialPreviewText ?? "",
    charIntervalMs: 18,
    startDelayMs: 120,
    loop: true,
    pauseAtEndMs: 1400,
  });
  const {
    visibleText: animatedTutorialQuery,
    isComplete: isTutorialQueryComplete,
  } = useTypedText({
    active: isTutorialLinkStep,
    text: tutorialPreviewQuery ? `@${tutorialPreviewQuery}` : "",
    charIntervalMs: 52,
    startDelayMs: 260,
    loop: true,
    pauseAtEndMs: 1800,
  });
  const [isTutorialLinkInserted, setIsTutorialLinkInserted] = useState(false);
  const showTutorialQueryPreview =
    !isQueryActive &&
    isTutorialLinkStep &&
    isTutorialQueryComplete &&
    !isTutorialLinkInserted;
  const showSuggestionPopover = isQueryActive || showTutorialQueryPreview;

  const parserDefaults = useMemo(
    () => ({
      defaultBook: verseRef.book,
      defaultChapter: verseRef.chapter,
    }),
    [verseRef.book, verseRef.chapter],
  );

  const starterSuggestions = useMemo(
    () => buildStarterSuggestions(verseRef.book),
    [verseRef.book],
  );
  const parsedRef = useMemo(
    () => parseVerseRef(effectiveQuery, parserDefaults),
    [effectiveQuery, parserDefaults],
  );
  const draft = useMemo(
    () => readReferenceDraft(effectiveQuery, parserDefaults),
    [effectiveQuery, parserDefaults],
  );
  const localValidationMessage = useMemo(
    () => (parsedRef ? getVerseRefBoundsErrorMessage(parsedRef) : null),
    [parsedRef],
  );
  const draftChapterErrorMessage = useMemo(
    () => getDraftChapterErrorMessage(draft),
    [draft],
  );
  const validation = useDebouncedEsvReferenceValidation(
    parsedRef && !localValidationMessage ? parsedRef : null,
  );

  const hasStructuredReferenceInput = useMemo(() => {
    if (draft) return true;
    if (!effectiveQuery.endsWith(" ")) return false;
    return resolveCanonicalBookName(trimmedEffectiveQuery) !== null;
  }, [draft, effectiveQuery, trimmedEffectiveQuery]);

  const bookSuggestions = useMemo(() => {
    if (!trimmedEffectiveQuery) return starterSuggestions;
    if (hasStructuredReferenceInput) return [];
    return buildVerseSuggestions(effectiveQuery, parserDefaults)
      .filter((item): item is VerseSuggestionItem => item.kind === "book")
      .slice(0, 6);
  }, [
    effectiveQuery,
    hasStructuredReferenceInput,
    parserDefaults,
    starterSuggestions,
    trimmedEffectiveQuery,
  ]);

  const referenceSuggestion = useMemo(() => {
    if (!parsedRef || localValidationMessage) {
      return null;
    }

    return {
      kind: "reference" as const,
      key: `ref:${formatVerseRef(parsedRef)}`,
      label: formatVerseRef(parsedRef),
      description: "Insert verse link",
      ref: parsedRef,
    };
  }, [localValidationMessage, parsedRef]);

  const actionableSuggestions = useMemo(() => {
    const nextItems: VerseSuggestionItem[] = [];
    if (referenceSuggestion) {
      nextItems.push(referenceSuggestion);
    }
    nextItems.push(...bookSuggestions);
    return nextItems;
  }, [bookSuggestions, referenceSuggestion]);

  const activeHighlightedIndex =
    actionableSuggestions.length === 0
      ? 0
      : Math.min(highlightedIndex, actionableSuggestions.length - 1);

  const queryStatus = useMemo<QueryStatusState>(() => {
    if (!trimmedEffectiveQuery) {
      return {
        tone: "info",
        label: "Type a verse like John 3:16.",
        description:
          "Pick a starter book below, or keep typing to create a verse link.",
      };
    }

    if (localValidationMessage) {
      return {
        tone: "error",
        label: localValidationMessage,
        description: "Keep typing to correct the reference.",
      };
    }

    if (draftChapterErrorMessage) {
      return {
        tone: "error",
        label: draftChapterErrorMessage,
        description: "Choose a valid chapter to keep creating the link.",
      };
    }

    if (parsedRef) {
      const label = formatVerseRef(parsedRef);
      switch (validation.status) {
        case "debouncing":
        case "checking":
          return {
            tone: "success",
            label: `${label} is ready to insert.`,
            showSpinner: true,
          };
        case "valid":
          return {
            tone: "success",
            label: `${label} is ready to insert.`,
            previewText:
              buildPreviewSnippet(parsedRef, validation.data?.verses ?? []) ??
              undefined,
          };
        case "invalid":
          return {
            tone: "success",
            label: `${label} is ready to insert.`,
            description: "Preview unavailable in ESV.",
          };
        case "unavailable":
          return {
            tone: "success",
            label: `${label} is ready to insert.`,
            description: "Preview check unavailable right now.",
          };
        default:
          break;
      }
    }

    const bookOnlyMatch =
      effectiveQuery.endsWith(" ") && !draft
        ? resolveCanonicalBookName(trimmedEffectiveQuery)
        : null;
    if (bookOnlyMatch) {
      return {
        tone: "info",
        label: `Now type a chapter and verse for ${bookOnlyMatch}.`,
        description: "For example: John 3:16",
      };
    }

    if (draft) {
      return buildDraftStatus(draft);
    }

    if (bookSuggestions.length > 0) {
      return {
        tone: "info",
        label: "Book suggestions are ready below.",
        description: "Choose one, or keep typing chapter and verse details.",
      };
    }

    return {
      tone: "info",
      label: "Type a book like John to start a verse link.",
      description:
        "Verse link suggestions will stay open while you type the reference.",
    };
  }, [
    bookSuggestions.length,
    draft,
    draftChapterErrorMessage,
    effectiveQuery,
    localValidationMessage,
    parsedRef,
    trimmedEffectiveQuery,
    validation.data,
    validation.status,
  ]);

  const refreshQueryState = useCallback(() => {
    if (!editorRef.current) return;
    const nextMatch = readActiveQueryMatch(editorRef.current);
    const nextQuery = nextMatch?.query ?? "";
    const nextIsQueryActive =
      nextMatch !== null && isPotentialVerseQuery(nextQuery, parserDefaults);
    const resolvedQuery = nextIsQueryActive ? nextQuery : "";
    setHighlightedIndex((current) =>
      resolvedQuery === activeQuery ? current : 0,
    );
    activeQueryMatchRef.current = nextIsQueryActive ? nextMatch : null;
    setIsQueryActive(nextIsQueryActive);
    setActiveQuery(resolvedQuery);
  }, [activeQuery, parserDefaults]);

  const clearHoverPreview = useCallback(() => {
    setHoverPreview(null);
  }, []);

  const showHoverPreview = useCallback((pill: HTMLElement) => {
    const container = wrapperRef.current;
    if (!container) return;

    const book = pill.dataset.book;
    const chapter = Number.parseInt(pill.dataset.chapter ?? "", 10);
    const startVerse = Number.parseInt(pill.dataset.startVerse ?? "", 10);
    const endVerse = Number.parseInt(pill.dataset.endVerse ?? "", 10);
    if (
      !book ||
      Number.isNaN(chapter) ||
      Number.isNaN(startVerse) ||
      Number.isNaN(endVerse)
    ) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    const previewWidth = 320;
    const maxLeft = Math.max(containerRect.width - previewWidth - 8, 8);

    setHoverPreview({
      refValue: { book, chapter, startVerse, endVerse },
      left: Math.min(Math.max(pillRect.left - containerRect.left, 8), maxLeft),
      top: pillRect.bottom - containerRect.top + 8,
    });
  }, []);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    const nextBody = readBodyFromEditor(editorRef.current);
    setIsEmpty(nextBody.segments.length === 0);
    onChange(nextBody);
    refreshQueryState();
  }, [onChange, refreshQueryState]);

  const handleSelectSuggestion = useCallback(
    (item: VerseSuggestionItem) => {
      const match = activeQueryMatchRef.current;
      if (!match) return;

      if (item.kind === "book" && item.book) {
        replaceTextInRange(match, `@${item.book} `);
      }

      if (item.kind === "reference" && item.ref) {
        replaceQueryWithPill(match, item.ref);
      }

      emitChange();
      editorRef.current?.focus();
    },
    [emitChange],
  );

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = "";
    appendSegmentsToEditor(editorRef.current, initialBody ?? EMPTY_NOTE_BODY);
    const trailingTextNode = document.createTextNode("");
    editorRef.current.append(trailingTextNode);
    placeCaretAfterNode(trailingTextNode);
    onChange(readBodyFromEditor(editorRef.current));
  }, [initialBody, onChange]);

  useEffect(() => {
    if (!showTutorialText && !tutorialPreviewQuery) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
  }, [showTutorialText, tutorialPreviewQuery]);

  useEffect(() => {
    let timeoutId: number | null = null;

    if (!isTutorialLinkStep) {
      timeoutId = window.setTimeout(() => {
        setIsTutorialLinkInserted(false);
      }, 0);
      return;
    }
    if (!isTutorialQueryComplete) {
      timeoutId = window.setTimeout(() => {
        setIsTutorialLinkInserted(false);
      }, 0);
      return;
    }

    timeoutId = window.setTimeout(() => {
      setIsTutorialLinkInserted(true);
    }, 650);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isTutorialLinkStep, isTutorialQueryComplete]);

  const displayedTutorialText =
    showTutorialText && tutorialAnimateText
      ? animatedTutorialText
      : (tutorialPreviewText ?? "");
  const shouldShowTutorialCursor =
    (showTutorialText && tutorialAnimateText && !isTutorialTextComplete) ||
    (isTutorialLinkStep && !isTutorialLinkInserted);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {!isFocused && isEmpty && !showTutorialText ? (
        <div className="pointer-events-none absolute left-3 top-2.5 text-sm text-muted-foreground">
          {placeholder}
        </div>
      ) : null}
      {showTutorialText ? (
        <div className="pointer-events-none absolute inset-x-3 top-2.5 z-10 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {displayedTutorialText}
          {isTutorialLinkStep ? (
            <>
              {"\n"}
              {isTutorialLinkInserted ? (
                <span className={EDITOR_PILL_CLASSNAME}>
                  {tutorialPreviewQuery}
                </span>
              ) : (
                <span className="font-mono text-sky-700 dark:text-sky-300">
                  {animatedTutorialQuery}
                </span>
              )}
            </>
          ) : null}
          {shouldShowTutorialCursor ? (
            <span className="ml-0.5 inline-block h-[1.05em] w-px translate-y-0.5 animate-pulse bg-foreground/70 align-bottom" />
          ) : null}
        </div>
      ) : null}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        className={cn(
          "min-h-[96px] rounded-md border bg-background px-3 py-2.5 text-sm leading-relaxed outline-hidden whitespace-pre-wrap",
          "focus:border-ring focus:ring-ring/50 focus:ring-[3px]",
        )}
        {...(tourId ? { "data-tour-id": tourId } : {})}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsFocused(false);
            setIsQueryActive(false);
            setActiveQuery("");
            clearHoverPreview();
          }, 120);
        }}
        onInput={() => emitChange()}
        onKeyUp={() => refreshQueryState()}
        onMouseUp={() => refreshQueryState()}
        onPaste={(event) => {
          event.preventDefault();
          insertPlainTextAtCursor(
            event.currentTarget,
            event.clipboardData.getData("text/plain"),
          );
          emitChange();
        }}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          const removeButton = target.closest<HTMLElement>(
            "[data-note-pill-remove='true']",
          );
          if (removeButton) {
            event.preventDefault();
            event.stopPropagation();
            removeButton.closest("[data-note-verse-pill='true']")?.remove();
            clearHoverPreview();
            emitChange();
            return;
          }
          const pill = target.closest<HTMLElement>(
            "[data-note-verse-pill='true']",
          );
          if (pill && currentChapter) {
            const book = pill.dataset.book;
            const chapter = Number.parseInt(pill.dataset.chapter ?? "", 10);
            const startVerse = Number.parseInt(
              pill.dataset.startVerse ?? "",
              10,
            );
            const endVerse = Number.parseInt(pill.dataset.endVerse ?? "", 10);
            if (
              book &&
              !Number.isNaN(chapter) &&
              !Number.isNaN(startVerse) &&
              !Number.isNaN(endVerse)
            ) {
              event.preventDefault();
              event.stopPropagation();
              navigateToVerse({
                book,
                chapter,
                startVerse,
                endVerse,
              });
            }
          }
        }}
        onMouseOver={(event) => {
          const target = event.target as HTMLElement;
          const pill = target.closest<HTMLElement>(
            "[data-note-verse-pill='true']",
          );
          if (!pill || !event.currentTarget.contains(pill)) return;
          showHoverPreview(pill);
        }}
        onMouseOut={(event) => {
          const target = event.target as HTMLElement;
          const pill = target.closest<HTMLElement>(
            "[data-note-verse-pill='true']",
          );
          if (!pill) return;

          const relatedTarget = event.relatedTarget;
          if (relatedTarget instanceof Node && pill.contains(relatedTarget)) {
            return;
          }

          const nextPill =
            relatedTarget instanceof Element
              ? relatedTarget.closest<HTMLElement>(
                  "[data-note-verse-pill='true']",
                )
              : null;
          if (nextPill && event.currentTarget.contains(nextPill)) {
            showHoverPreview(nextPill);
            return;
          }

          clearHoverPreview();
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            return;
          }

          if (event.key === "Escape" && isQueryActive) {
            event.preventDefault();
            event.stopPropagation();
            setIsQueryActive(false);
            setActiveQuery("");
            setHighlightedIndex(0);
            activeQueryMatchRef.current = null;
            return;
          }

          if (
            isQueryActive &&
            event.key === "ArrowDown" &&
            actionableSuggestions.length > 0
          ) {
            event.preventDefault();
            setHighlightedIndex(
              (activeHighlightedIndex + 1) % actionableSuggestions.length,
            );
            return;
          }

          if (
            isQueryActive &&
            event.key === "ArrowUp" &&
            actionableSuggestions.length > 0
          ) {
            event.preventDefault();
            setHighlightedIndex(
              activeHighlightedIndex === 0
                ? actionableSuggestions.length - 1
                : activeHighlightedIndex - 1,
            );
            return;
          }

          if (
            isQueryActive &&
            (event.key === "Enter" || event.key === "Tab") &&
            actionableSuggestions.length > 0
          ) {
            event.preventDefault();
            handleSelectSuggestion(
              actionableSuggestions[activeHighlightedIndex] ??
                actionableSuggestions[0],
            );
            return;
          }

          if ((event.key === "Enter" || event.key === "Tab") && isQueryActive) {
            event.preventDefault();
            return;
          }
        }}
      />

      {showSuggestionPopover && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1">
          <div className="rounded-md border bg-popover p-1 shadow-lg">
            {showTutorialQueryPreview ? (
              <div className="mb-1 rounded-sm border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                Preview of the verse-link suggestion for what you typed above.
              </div>
            ) : null}
            <div
              className={cn(
                "mb-1 rounded-sm px-2 py-2 text-left",
                queryStatus.tone === "error" &&
                  "bg-destructive/10 text-destructive",
                queryStatus.tone === "success" &&
                  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                queryStatus.tone === "loading" &&
                  "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                queryStatus.tone === "info" && "bg-muted/70 text-foreground",
              )}
            >
              <div className="flex items-start gap-2">
                {queryStatus.tone === "loading" ? (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : queryStatus.tone === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : queryStatus.tone === "error" ? (
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium">{queryStatus.label}</div>
                  {queryStatus.showSpinner ? (
                    <div className="mt-1 flex items-center">
                      <Loader2
                        className="h-3 w-3 animate-spin opacity-70"
                        aria-label="Loading verse preview"
                      />
                    </div>
                  ) : queryStatus.previewText ? (
                    <div className="mt-1 truncate text-xs opacity-80">
                      {queryStatus.previewText}
                    </div>
                  ) : queryStatus.description ? (
                    <div className="text-xs opacity-80">
                      {queryStatus.description}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {actionableSuggestions.length > 0 ? (
              actionableSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.key}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60",
                    index === activeHighlightedIndex &&
                      "bg-accent text-accent-foreground",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setHighlightedIndex(index);
                    handleSelectSuggestion(suggestion);
                  }}
                >
                  {suggestion.kind === "reference" ? (
                    <Link2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {suggestion.label}
                    </div>
                    {suggestion.description ? (
                      <div className="text-xs text-muted-foreground">
                        {suggestion.description}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                No selectable verse link yet.
              </div>
            )}
          </div>
        </div>
      )}

      {hoverPreview ? (
        <div
          className="pointer-events-none absolute z-50 w-80"
          style={{ left: hoverPreview.left, top: hoverPreview.top }}
        >
          <div className="rounded-md border bg-popover px-3 py-2 shadow-lg">
            <VerseRefPreviewCard refValue={hoverPreview.refValue} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
