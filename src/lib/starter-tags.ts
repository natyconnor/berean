import { normalizeTag } from "@/lib/tag-utils";

export const STARTER_TAGS_VERSION = 2;

export interface StarterTagCategory {
  id: string;
  label: string;
  defaultColor: string;
  tags: string[];
}

export const STARTER_TAG_CATEGORIES: StarterTagCategory[] = [
  {
    id: "core-theology",
    label: "Core Theology",
    defaultColor: "#6366f1",
    tags: [
      "god's character",
      "jesus",
      "holy spirit",
      "sin & repentance",
      "salvation & grace",
      "covenant",
      "law",
      "prophecy",
    ],
  },
  {
    id: "christian-life",
    label: "Christian Life",
    defaultColor: "#16a34a",
    tags: [
      "faith & trust",
      "prayer",
      "worship & praise",
      "obedience",
      "suffering & trials",
      "hope & encouragement",
      "fear & anxiety",
      "pride & humility",
      "wisdom & discernment",
      "temptation",
    ],
  },
  {
    id: "relationships-ethics",
    label: "Relationships & Ethics",
    defaultColor: "#f59e0b",
    tags: [
      "love & compassion",
      "forgiveness & reconciliation",
      "justice & mercy",
      "money & generosity",
      "marriage & family",
      "work & vocation",
    ],
  },
  {
    id: "community-mission",
    label: "Community & Mission",
    defaultColor: "#06b6d4",
    tags: [
      "church & community",
      "discipleship",
      "evangelism & mission",
      "leadership & service",
    ],
  },
  {
    id: "scripture-story",
    label: "Scripture & Story",
    defaultColor: "#a855f7",
    tags: ["creation & fall", "kingdom of god"],
  },
];

export const ALL_STARTER_TAGS = Array.from(
  new Set(STARTER_TAG_CATEGORIES.flatMap((category) => category.tags))
);

export const DEFAULT_STARTER_TAG_CATEGORY_COLORS: Record<string, string> =
  Object.fromEntries(
    STARTER_TAG_CATEGORIES.map((category) => [
      category.id,
      category.defaultColor,
    ])
  ) as Record<string, string>;

export const STARTER_TAG_CATEGORY_BY_TAG: Record<string, string> =
  STARTER_TAG_CATEGORIES.reduce<Record<string, string>>((acc, category) => {
    for (const tag of category.tags) {
      acc[normalizeTag(tag)] = category.id;
    }
    return acc;
  }, {});
