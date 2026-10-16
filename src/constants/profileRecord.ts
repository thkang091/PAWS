/**
 * The shape of the dog's profile: block and section types, and the questions the guardian can answer. There are no
 * values here. Every value on the Profile comes from the dog's real records (`useProfileData`) or from what the
 * guardian entered; anything unknown says so and offers a way to add it.
 */
export type StateKey = "settled" | "learning" | "hard";

export type StateRow = {
  label: string;
  state: StateKey;
  detail?: string;
};

export type FactRow = readonly [label: string, value: string];

export type EntryRow = {
  title: string;
  meta: string;
  trailing?: string;
  href?: string;
};

export type MeterRow = {
  label: string;
  strong: number;
  total: number;
};

export type Block =
  | { kind: "prose"; text: string }
  | {
      kind: "facts";
      title?: string;
      note?: string;
      rows: readonly FactRow[];
      collapseAfter?: number;
      /** Rows that come from records elsewhere in PAWS; they are shown but changed where they live. */
      locked?: readonly string[];
    }
  | {
      kind: "states";
      title?: string;
      note?: string;
      rows: readonly StateRow[];
      collapseAfter?: number;
      labels?: Partial<Record<StateKey, string>>;
    }
  | { kind: "chips"; title: string; note?: string; items: readonly string[] }
  | {
      kind: "entries";
      title?: string;
      note?: string;
      rows: readonly EntryRow[];
      collapseAfter?: number;
    }
  | { kind: "meters"; title?: string; note?: string; rows: readonly MeterRow[] }
  | { kind: "link"; label: string; hint: string; href: string };

export type ProfileSection = {
  key: string;
  title: string;
  summary: string;
  lede: string;
  blocks: readonly Block[];
};

export type ProfileTab = {
  key: string;
  label: string;
  headTitle: string;
  headHref: string;
  doors: readonly string[];
  panel: ProfilePanel;
};

export type ProfilePanel = {
  spotlight?: {
    chip: string;
    glyph: string;
    title: string;
    meta: string;
    progress?: number;
    progressNote?: string;
    href: string;
  };
  band?: readonly { key: string; glyph: string; value: string; label: string }[];
  rail?: {
    title: string;
    cards: readonly { key: string; title: string; chip?: string; meta: string }[];
  };
  traits?: {
    title: string;
    rows: readonly { key: string; value: string; label: string; level: number; phrase: string }[];
  };
  meters?: { title: string; rows: readonly { key: string; label: string; strong: number; total: number }[] };
  /** Shown when there is nothing real to show yet: what to do to fill this panel. */
  invite?: { title: string; meta: string; href: string };
  tilesTitle: string;
};

/** What an unanswered question shows. */
export const NOT_ADDED = "Not added";

/**
 * Quick answers for questions where a few words cover most dogs. The first answer is the lowest on a scale, so the
 * order also gives the trait level shown on the About panel.
 */
export const FIELD_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  "about.Coat": ["Short", "Medium", "Long", "Wire", "Curly", "Double"],
  "routine.Alone time": ["Not yet", "Up to 1 hour", "Up to 4 hours", "A work day"],
};

export const optionsFor = (section: string, label: string) => FIELD_OPTIONS[`${section}.${label}`] ?? null;
