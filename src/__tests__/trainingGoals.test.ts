/**
 * Training Goal Selection — Unit Tests
 *
 * Covers:
 *   Validation
 *     - selecting 1 goal
 *     - selecting all 6 goals
 *     - rejecting 0 goals (below minimum)
 *     - rejecting more than 6 goals (above maximum)
 *     - rejecting duplicate goal keys
 *     - rejecting duplicate priority ranks
 *     - validated data preserves all goal fields
 *
 *   Persistence (mocked Supabase)
 *     - saveTrainingGoals deletes existing data before inserting
 *     - saveTrainingGoals deletes using the correct dog_id
 *     - saveTrainingGoals writes goal rows correctly for 1 goal
 *     - saveTrainingGoals writes all 6 goal rows with correct priority order
 *     - saveTrainingGoals stores category-specific pain points
 *     - saveTrainingGoals stores pain points across multiple goals separately
 *     - saveTrainingGoals skips pain-point insert when none are selected
 *     - saveTrainingGoals does nothing extra when goals array is empty
 *
 *   Loading saved selections (mocked Supabase)
 *     - getTrainingGoals returns [] when no goals are saved
 *     - getTrainingGoals returns hydrated SelectedOwnerGoal[] with pain points
 *     - getTrainingGoals returns goals with empty pain points when none stored
 *     - getTrainingGoals correctly associates pain points by category
 */

// ─── Module mock: intercept @/lib/supabase before anything imports it ────────
// Using an explicit factory prevents Jest from ever loading the real supabase.ts
// (which imports react-native-url-polyfill, an ESM-only package that crashes the
// Node test environment).
jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(),
}));

import { getSupabaseClient } from "@/lib/supabase";
import { onboardingSchema } from "@/validation/onboardingSchemas";
import { getTrainingGoals, saveTrainingGoals } from "@/services/curriculumService";
import type { SelectedOwnerGoal } from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Mock client factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a chainable mock result: a Promise that can be awaited AND has every
 * Supabase query-builder method attached, each returning another chainable
 * result carrying the same data.  This lets a single fixture work for both
 * `.select().eq().order()` (three-step chain) and `.select().eq()` (two-step).
 */
function mockResult(data: unknown, error: unknown = null) {
  const p = Promise.resolve({ data, error }) as Promise<{ data: unknown; error: unknown }> &
    Record<string, unknown>;
  const CHAIN_METHODS = [
    "eq", "neq", "gt", "lt", "gte", "lte", "like", "ilike",
    "is", "in", "contains", "containedBy", "order", "limit",
    "range", "single", "maybeSingle", "not", "filter",
  ];
  CHAIN_METHODS.forEach((m) => {
    p[m] = jest.fn(() => mockResult(data, error));
  });
  return p;
}

/**
 * Lightweight Supabase client mock.
 *
 * - `tableData` controls what `.select()` resolves to per table name.
 * - `insertLog` accumulates every `.insert()` call ({ table, rows }).
 * - `deleteLog` accumulates every `.delete().eq()` call ({ table, col, val }).
 */
function makeMockClient(tableData: Record<string, unknown[]> = {}) {
  const insertLog: Array<{ table: string; rows: unknown }> = [];
  const deleteLog: Array<{ table: string; col: string; val: unknown }> = [];

  const client = {
    from: jest.fn((table: string) => ({
      select: jest.fn((_cols?: string) => mockResult(tableData[table] ?? [])),
      insert: jest.fn((rows: unknown) => {
        insertLog.push({ table, rows });
        return Promise.resolve({ error: null });
      }),
      delete: jest.fn(() => ({
        eq: jest.fn((col: string, val: unknown) => {
          deleteLog.push({ table, col, val });
          return Promise.resolve({ error: null });
        }),
      })),
      update: jest.fn(() => mockResult(null)),
      upsert: jest.fn(() => Promise.resolve({ error: null })),
    })),
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
  };

  return { client, insertLog, deleteLog };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ONE_GOAL: SelectedOwnerGoal[] = [
  { goal: "SAFETY_AND_OBEDIENCE", priorityRank: 1, selectedPainPoints: ["recall", "leave_it"] },
];

const SIX_GOALS: SelectedOwnerGoal[] = [
  { goal: "BETTER_BEHAVIOR_AT_HOME",         priorityRank: 1, selectedPainPoints: ["jumping_on_people"] },
  { goal: "SAFETY_AND_OBEDIENCE",            priorityRank: 2, selectedPainPoints: ["recall"] },
  { goal: "BETTER_WALKS",                    priorityRank: 3, selectedPainPoints: ["pulling_on_leash"] },
  { goal: "COOL_TRICKS_AND_GAMES",           priorityRank: 4, selectedPainPoints: ["beginner_tricks"] },
  { goal: "HELPFUL_SKILLS_AROUND_THE_HOUSE", priorityRank: 5, selectedPainPoints: [] },
  { goal: "CALM_ALONE_TIME",                 priorityRank: 6, selectedPainPoints: ["safe_zone_routine"] },
];

/** Minimal valid onboarding form values for schema testing. */
const BASE_FORM = {
  name: "Buddy",
  gender: "male" as const,
  birthday: "2022-01-15",
  ageYears: null,
  breed: "Labrador",
  ownedSince: null,
  adoptionDate: null,
  obedienceLevel: "beginner" as const,
  energyLevel: "moderate" as const,
  goalKeys: [],
  existingSkillIds: [],
  targetSkillIds: [],
  concernKeys: [],
  concernOtherNote: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation tests
// ─────────────────────────────────────────────────────────────────────────────

describe("training goal validation — onboardingSchema", () => {
  it("accepts exactly 1 selected goal", () => {
    const result = onboardingSchema.safeParse({
      ...BASE_FORM,
      selectedTrainingGoals: ONE_GOAL,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all 6 goals", () => {
    const result = onboardingSchema.safeParse({
      ...BASE_FORM,
      selectedTrainingGoals: SIX_GOALS,
    });
    expect(result.success).toBe(true);
  });

  it("rejects 0 goals", () => {
    const result = onboardingSchema.safeParse({
      ...BASE_FORM,
      selectedTrainingGoals: [],
    });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages.some((m) => /at least one/i.test(m))).toBe(true);
  });

  it("rejects more than 6 goals", () => {
    // 7 entries — max(6) fires before the duplicate-goal refine
    const tooMany: SelectedOwnerGoal[] = [
      ...SIX_GOALS,
      { goal: "BETTER_BEHAVIOR_AT_HOME", priorityRank: 7, selectedPainPoints: [] },
    ];
    const result = onboardingSchema.safeParse({
      ...BASE_FORM,
      selectedTrainingGoals: tooMany,
    });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages.some((m) => /at most 6/i.test(m))).toBe(true);
  });

  it("rejects duplicate goal keys", () => {
    const duplicateGoal: SelectedOwnerGoal[] = [
      { goal: "SAFETY_AND_OBEDIENCE", priorityRank: 1, selectedPainPoints: [] },
      { goal: "SAFETY_AND_OBEDIENCE", priorityRank: 2, selectedPainPoints: [] },
    ];
    const result = onboardingSchema.safeParse({
      ...BASE_FORM,
      selectedTrainingGoals: duplicateGoal,
    });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages.some((m) => /once|unique/i.test(m))).toBe(true);
  });

  it("rejects duplicate priority ranks", () => {
    const dupRanks: SelectedOwnerGoal[] = [
      { goal: "BETTER_BEHAVIOR_AT_HOME", priorityRank: 1, selectedPainPoints: [] },
      { goal: "SAFETY_AND_OBEDIENCE",    priorityRank: 1, selectedPainPoints: [] },
    ];
    const result = onboardingSchema.safeParse({
      ...BASE_FORM,
      selectedTrainingGoals: dupRanks,
    });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages.some((m) => /unique priority rank/i.test(m))).toBe(true);
  });

  it("validated data preserves all goal fields", () => {
    const result = onboardingSchema.safeParse({
      ...BASE_FORM,
      selectedTrainingGoals: SIX_GOALS,
    });
    expect(result.success).toBe(true);
    const parsed = result.data!.selectedTrainingGoals;
    expect(parsed).toHaveLength(6);
    expect(parsed[0]).toMatchObject({
      goal: "BETTER_BEHAVIOR_AT_HOME",
      priorityRank: 1,
      selectedPainPoints: ["jumping_on_people"],
    });
    expect(parsed[5]).toMatchObject({
      goal: "CALM_ALONE_TIME",
      priorityRank: 6,
      selectedPainPoints: ["safe_zone_routine"],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Persistence tests — saveTrainingGoals
// ─────────────────────────────────────────────────────────────────────────────

describe("saveTrainingGoals — persistence", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes existing goals and pain points before inserting fresh ones", async () => {
    const { client, deleteLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    await saveTrainingGoals("dog-abc", ONE_GOAL);

    const tables = deleteLog.map((d) => d.table);
    expect(tables).toContain("dog_selected_training_goals");
    expect(tables).toContain("dog_training_pain_points");
  });

  it("deletes using the correct dog_id", async () => {
    const { client, deleteLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    await saveTrainingGoals("dog-xyz", ONE_GOAL);

    deleteLog.forEach((d) => {
      expect(d.col).toBe("dog_id");
      expect(d.val).toBe("dog-xyz");
    });
  });

  it("inserts one goal row for a single-goal selection", async () => {
    const { client, insertLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    await saveTrainingGoals("dog-001", ONE_GOAL);

    const goalInsert = insertLog.find((e) => e.table === "dog_selected_training_goals");
    expect(goalInsert).toBeDefined();
    expect(goalInsert!.rows).toEqual([
      { dog_id: "dog-001", goal: "SAFETY_AND_OBEDIENCE", priority_rank: 1 },
    ]);
  });

  it("inserts all 6 goal rows for a full selection", async () => {
    const { client, insertLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    await saveTrainingGoals("dog-002", SIX_GOALS);

    const goalInsert = insertLog.find((e) => e.table === "dog_selected_training_goals");
    expect(goalInsert).toBeDefined();
    expect(Array.isArray(goalInsert!.rows)).toBe(true);
    expect((goalInsert!.rows as unknown[]).length).toBe(6);
  });

  it("inserts priority ranks in the correct order", async () => {
    const { client, insertLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    await saveTrainingGoals("dog-003", SIX_GOALS);

    const goalInsert = insertLog.find((e) => e.table === "dog_selected_training_goals");
    const rows = goalInsert!.rows as Array<{ priority_rank: number }>;
    expect(rows.map((r) => r.priority_rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("inserts category-specific pain points with the correct goal association", async () => {
    const { client, insertLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const goals: SelectedOwnerGoal[] = [
      {
        goal: "BETTER_WALKS",
        priorityRank: 1,
        selectedPainPoints: ["pulling_on_leash", "poor_curb_awareness"],
      },
    ];

    await saveTrainingGoals("dog-004", goals);

    const ppInsert = insertLog.find((e) => e.table === "dog_training_pain_points");
    expect(ppInsert).toBeDefined();
    expect(ppInsert!.rows).toEqual([
      { dog_id: "dog-004", goal: "BETTER_WALKS", pain_point_key: "pulling_on_leash" },
      { dog_id: "dog-004", goal: "BETTER_WALKS", pain_point_key: "poor_curb_awareness" },
    ]);
  });

  it("stores pain points for multiple goals without cross-contamination", async () => {
    const { client, insertLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const goals: SelectedOwnerGoal[] = [
      {
        goal: "SAFETY_AND_OBEDIENCE",
        priorityRank: 1,
        selectedPainPoints: ["recall"],
      },
      {
        goal: "CALM_ALONE_TIME",
        priorityRank: 2,
        selectedPainPoints: ["safe_zone_routine", "settling_independently"],
      },
    ];

    await saveTrainingGoals("dog-005", goals);

    const ppInsert = insertLog.find((e) => e.table === "dog_training_pain_points");
    expect(ppInsert).toBeDefined();
    const rows = ppInsert!.rows as Array<{ goal: string; pain_point_key: string }>;
    expect(rows).toHaveLength(3);

    const soRows = rows.filter((r) => r.goal === "SAFETY_AND_OBEDIENCE");
    const caRows = rows.filter((r) => r.goal === "CALM_ALONE_TIME");

    expect(soRows.map((r) => r.pain_point_key)).toEqual(["recall"]);
    expect(caRows.map((r) => r.pain_point_key)).toEqual([
      "safe_zone_routine",
      "settling_independently",
    ]);
  });

  it("skips pain-point insert when no pain points are selected", async () => {
    const { client, insertLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const goals: SelectedOwnerGoal[] = [
      { goal: "COOL_TRICKS_AND_GAMES", priorityRank: 1, selectedPainPoints: [] },
    ];

    await saveTrainingGoals("dog-006", goals);

    const ppInsert = insertLog.find((e) => e.table === "dog_training_pain_points");
    expect(ppInsert).toBeUndefined();
  });

  it("still deletes old data even when saving an empty goals array", async () => {
    const { client, insertLog, deleteLog } = makeMockClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    await saveTrainingGoals("dog-007", []);

    // Deletes should fire to purge stale data.
    expect(deleteLog.length).toBeGreaterThan(0);
    // No inserts should occur.
    const goalInsert = insertLog.find((e) => e.table === "dog_selected_training_goals");
    expect(goalInsert).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Loading saved selections — getTrainingGoals
// ─────────────────────────────────────────────────────────────────────────────

describe("getTrainingGoals — loading saved selections", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns an empty array when no goals are saved", async () => {
    const { client } = makeMockClient({
      dog_selected_training_goals: [],
      dog_training_pain_points: [],
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const result = await getTrainingGoals("dog-empty");
    expect(result).toEqual([]);
  });

  it("returns a hydrated SelectedOwnerGoal[] with pain points", async () => {
    const { client } = makeMockClient({
      dog_selected_training_goals: [
        { goal: "SAFETY_AND_OBEDIENCE", priority_rank: 1 },
        { goal: "BETTER_WALKS",         priority_rank: 2 },
      ],
      dog_training_pain_points: [
        { goal: "SAFETY_AND_OBEDIENCE", pain_point_key: "recall" },
        { goal: "SAFETY_AND_OBEDIENCE", pain_point_key: "leave_it" },
        { goal: "BETTER_WALKS",         pain_point_key: "pulling_on_leash" },
      ],
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const result = await getTrainingGoals("dog-hydrate");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      goal: "SAFETY_AND_OBEDIENCE",
      priorityRank: 1,
      selectedPainPoints: ["recall", "leave_it"],
    });
    expect(result[1]).toMatchObject({
      goal: "BETTER_WALKS",
      priorityRank: 2,
      selectedPainPoints: ["pulling_on_leash"],
    });
  });

  it("returns goals with empty pain points when none were stored", async () => {
    const { client } = makeMockClient({
      dog_selected_training_goals: [
        { goal: "COOL_TRICKS_AND_GAMES", priority_rank: 1 },
      ],
      dog_training_pain_points: [],
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const result = await getTrainingGoals("dog-no-pp");
    expect(result[0]).toMatchObject({
      goal: "COOL_TRICKS_AND_GAMES",
      priorityRank: 1,
      selectedPainPoints: [],
    });
  });

  it("correctly associates pain points from different categories without cross-contamination", async () => {
    const { client } = makeMockClient({
      dog_selected_training_goals: [
        { goal: "BETTER_BEHAVIOR_AT_HOME", priority_rank: 1 },
        { goal: "CALM_ALONE_TIME",          priority_rank: 2 },
      ],
      dog_training_pain_points: [
        { goal: "BETTER_BEHAVIOR_AT_HOME", pain_point_key: "jumping_on_people" },
        { goal: "CALM_ALONE_TIME",          pain_point_key: "safe_zone_routine" },
        { goal: "CALM_ALONE_TIME",          pain_point_key: "settling_independently" },
      ],
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(client);

    const result = await getTrainingGoals("dog-multi");

    const bhGoal = result.find((g) => g.goal === "BETTER_BEHAVIOR_AT_HOME");
    const caGoal = result.find((g) => g.goal === "CALM_ALONE_TIME");

    expect(bhGoal?.selectedPainPoints).toEqual(["jumping_on_people"]);
    expect(caGoal?.selectedPainPoints).toEqual(["safe_zone_routine", "settling_independently"]);
  });
});
