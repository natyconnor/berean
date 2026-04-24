import {
  activityDescription,
  activityLabel,
  type ActivityType,
} from "./study-card-model";

export type SessionView = ActivityType | "overview";

export interface ActivityOption {
  view: SessionView;
  label: string;
  description: string;
  /** When false, the button is disabled and shows the tooltip with `disabledReason`. */
  available: boolean;
  disabledReason?: string;
}

export function buildActivityOptions(input: {
  savedVersesCount: number;
  notesCount: number;
  teachPassagesCount: number;
}): ActivityOption[] {
  const hasVerses = input.savedVersesCount > 0;
  const hasNotes = input.notesCount > 0;
  const hasTeachPassages = input.teachPassagesCount > 0;

  const activities: ActivityType[] = ["verse-memory", "teach"];

  const activityOptions: ActivityOption[] = activities.map((activity) => {
    let available = true;
    let disabledReason: string | undefined;

    if (activity === "verse-memory" && !hasVerses) {
      available = false;
      disabledReason = "Heart some verses in this scope to use Verse Memory.";
    } else if (activity === "teach" && !hasTeachPassages) {
      available = false;
      disabledReason = hasNotes
        ? "Link notes to verses in this scope to use Teach."
        : "Add notes in this scope to use Teach.";
    }

    return {
      view: activity,
      label: activityLabel(activity),
      description: activityDescription(activity),
      available,
      disabledReason,
    };
  });

  return [
    {
      view: "overview",
      label: "Overview",
      description: "Browse the full list of notes and hearted verses",
      available: true,
    },
    ...activityOptions,
  ];
}
