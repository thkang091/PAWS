// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─────────────────────────────────────────
// CORS helpers
// ─────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function err(message: string, status: number): Response {
  return json({ error: message }, status);
}

function errorText(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  }
  return String(error);
}

function isMissingTableError(error: unknown): boolean {
  const text = errorText(error);
  return /schema cache|could not find the table|does not exist|PGRST205/i.test(text);
}

function migrationErr(tableName: string): Response {
  return err(`Database migration missing: ${tableName}. Apply the PAWS curriculum Supabase migrations before generating a roadmap.`, 503);
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const CURRICULUM_VERSION = '1.0.0';
const PERSONALIZATION_ENGINE_VERSION = '1.0.0';

const FOUNDATION_ACTIVITY_IDS: string[] = [
  'BH001', 'SO001', 'BH002', 'SO004', 'BH003', 'SO007', 'BH004', 'SO016', 'BH005', 'SO015',
  'BH006', 'SO018', 'BH007', 'SO026', 'BH008', 'BH014', 'BH011', 'SO035', 'BH018', 'BH021',
];

const DEFAULT_GOALS = ['BETTER_BEHAVIOR_AT_HOME', 'SAFETY_AND_OBEDIENCE'];

// Progression map: after LEARN, move through these in order at +7 day intervals
const PROGRESSION_SEQUENCE: DifficultyMode[] = [
  'LEARN',
  'REPEAT',
  'ADD_DURATION',
  'REAL_LIFE_PROOF',
];

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

type ObedienceLevel = 'beginner' | 'basic' | 'intermediate' | 'advanced';
type EnergyLevel = 'low' | 'moderate' | 'high' | 'very_high';
type DifficultyMode =
  | 'LEARN'
  | 'REPEAT'
  | 'ADD_DURATION'
  | 'ADD_DISTANCE'
  | 'ADD_DISTRACTION'
  | 'REAL_LIFE_PROOF'
  | 'MAINTENANCE'
  | 'REGRESSION'
  | 'BOSS_BATTLE';

interface DogProfile {
  id: string;
  owner_id: string;
  obedience_level: ObedienceLevel;
  energy_level: EnergyLevel;
  age_years: number | null;
  breed: string;
}

interface SelectedGoal {
  id: string;
  dog_id: string;
  goal: string;
  priority_rank: number;
}

interface PainPoint {
  dog_id: string;
  goal: string;
  pain_point_key: string;
}

interface CatalogActivity {
  id: string;
  category: string;
  sequence_number: number;
  level: number;
  title: string;
  prerequisites: string[];
  verification_status: string;
}

interface RoadmapDay {
  roadmap_id: string;
  day_number: number;
  primary_activity_id: string;
  optional_side_quest_id: string | null;
  optional_bond_quest_id: string | null;
  reason_selected: string;
  difficulty_mode: DifficultyMode;
}

// ─────────────────────────────────────────
// Goal weight calculation
// ─────────────────────────────────────────

function calculateGoalWeights(goals: SelectedGoal[]): Map<string, number> {
  const weights = new Map<string, number>();
  const count = goals.length;

  // Weight percentages per rank (index 0 = rank 1)
  const distributionTable: number[][] = [
    [70],                                   // 1 goal
    [42, 28],                               // 2 goals
    [32, 22, 16],                           // 3 goals
    [24, 17, 12, 9],                        // 4 goals
    [19, 13, 10, 8, 7],                     // 5 goals (min 6 enforced)
    [16, 11, 9, 7, 6, 6],                   // 6 goals (min 6 each)
  ];

  const tableIndex = Math.min(count, 6) - 1;
  const percentages = distributionTable[tableIndex];

  // Sort goals by priority_rank ascending so rank 1 maps to the biggest weight
  const sorted = [...goals].sort((a, b) => a.priority_rank - b.priority_rank);

  for (let i = 0; i < sorted.length; i++) {
    const pct = percentages[i] ?? 6; // fallback min 6
    // Convert percentage of 70 days → absolute day count
    const days = Math.max(6, Math.round((pct / 100) * 70));
    weights.set(sorted[i].goal, days);
  }

  return weights;
}

// ─────────────────────────────────────────
// Obedience → max level gate
// ─────────────────────────────────────────

function maxActivityLevel(obedience: ObedienceLevel): number {
  switch (obedience) {
    case 'beginner': return 2;
    case 'basic': return 3;
    case 'intermediate': return 4;
    case 'advanced': return 5;
  }
}

// ─────────────────────────────────────────
// Select activities for a goal (ordered, prereqs satisfied, level gated)
// ─────────────────────────────────────────

function pickActivitiesForGoal(
  goal: string,
  allActivities: CatalogActivity[],
  completedIds: Set<string>,
  scheduledIds: Set<string>,
  maxLevel: number,
  count: number,
): CatalogActivity[] {
  const eligible = allActivities
    .filter((a) => a.category === goal)
    .filter((a) => !completedIds.has(a.id))
    .filter((a) => a.verification_status !== 'DISABLED')
    .filter((a) => a.level <= maxLevel)
    .sort((a, b) => a.sequence_number - b.sequence_number);

  const picked: CatalogActivity[] = [];

  for (const activity of eligible) {
    if (picked.length >= count) break;

    // All prerequisites must be completed or already scheduled earlier
    const prereqsMet = activity.prerequisites.every(
      (p) => completedIds.has(p) || scheduledIds.has(p),
    );
    if (!prereqsMet) continue;

    picked.push(activity);
    scheduledIds.add(activity.id);
  }

  return picked;
}

// ─────────────────────────────────────────
// No-more-than-2-consecutive-from-same-category constraint
// ─────────────────────────────────────────

function enforceConsecutiveCategoryConstraint(
  slots: Array<{ activityId: string; category: string; mode: DifficultyMode; reason: string }>,
): Array<{ activityId: string; category: string; mode: DifficultyMode; reason: string }> {
  const result: typeof slots = [];

  for (let i = 0; i < slots.length; i++) {
    const item = slots[i];
    const prev1 = result[result.length - 1];
    const prev2 = result[result.length - 2];

    if (
      prev1 &&
      prev2 &&
      prev1.category === item.category &&
      prev2.category === item.category
    ) {
      // Find the nearest slot that doesn't violate the constraint and swap
      const swapIdx = slots.findIndex((s, j) => j > i && s.category !== item.category);
      if (swapIdx !== -1) {
        const [swapped] = slots.splice(swapIdx, 1);
        slots.splice(i, 0, swapped);
        i--; // re-evaluate current index with the swapped item
        continue;
      }
    }

    result.push(item);
  }

  return result;
}

// ─────────────────────────────────────────
// Build the selected-category schedule
// ─────────────────────────────────────────

function buildSchedule(
  _dog: DogProfile,
  foundationActivities: CatalogActivity[],
  goalActivities: Map<string, CatalogActivity[]>,
  selectedGoals: SelectedGoal[],
  targetDayCount: number,
): Omit<RoadmapDay, 'roadmap_id'>[] {
  const days: Omit<RoadmapDay, 'roadmap_id'>[] = [];
  const orderedGoals = [...selectedGoals].sort((a, b) => a.priority_rank - b.priority_rank);
  const fallbackActivity = foundationActivities[0] ?? goalActivities.values().next().value?.[0];

  for (const goalEntry of orderedGoals) {
    const activities = (goalActivities.get(goalEntry.goal) ?? [])
      .filter((activity) => activity.verification_status !== 'DISABLED')
      .sort((a, b) => a.sequence_number - b.sequence_number)
      .slice(0, 50);

    for (let index = 0; index < 50; index++) {
      const activity = activities[index] ?? activities[activities.length - 1] ?? fallbackActivity;
      if (!activity) continue;
      const isFinalCategoryDay = index === 49;
      days.push({
        day_number: days.length + 1,
        primary_activity_id: activity.id,
        optional_side_quest_id: null,
        optional_bond_quest_id: null,
        difficulty_mode: isFinalCategoryDay ? 'BOSS_BATTLE' : 'LEARN',
        reason_selected: isFinalCategoryDay
          ? `Final ${goalEntry.goal.replace(/_/g, ' ').toLowerCase()} challenge for this 50-day category track.`
          : `Selected because ${goalEntry.goal.replace(/_/g, ' ').toLowerCase()} was chosen during onboarding.`,
      });
    }
  }

  return days.slice(0, targetDayCount);
}

// ─────────────────────────────────────────
// Verify JWT and return caller user id
// ─────────────────────────────────────────

async function getCallerUserId(
  authHeader: string | null,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string | null> {
  if (!authHeader) return null;

  // Use an anon client scoped to the caller's JWT to verify it
  const anonClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data, error } = await anonClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

// ─────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return err('Server configuration error', 500);
  }

  // Parse request body
  let body: { dogId?: string; forceRegenerate?: boolean };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body', 400);
  }

  const { dogId, forceRegenerate = false } = body;

  if (!dogId || typeof dogId !== 'string') {
    return err('dogId is required', 400);
  }

  // Verify caller identity
  const authHeader = req.headers.get('Authorization');
  const callerId = await getCallerUserId(authHeader, supabaseUrl, serviceRoleKey);
  if (!callerId) {
    return err('Unauthorized', 401);
  }

  // Service-role client (bypasses RLS)
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── STEP 1: Load inputs ──

  // Fetch dog profile
  const { data: dog, error: dogErr } = await supabase
    .from('dogs')
    .select('id, owner_id, obedience_level, energy_level, age_years, breed')
    .eq('id', dogId)
    .single();

  if (dogErr || !dog) {
    return err('Dog not found', 404);
  }

  // Verify the dog belongs to the caller
  if (dog.owner_id !== callerId) {
    return err('Forbidden: this dog does not belong to you', 403);
  }

  const dogProfile = dog as DogProfile;

  // Fetch selected training goals
  const { data: rawGoals, error: rawGoalsErr } = await supabase
    .from('dog_selected_training_goals')
    .select('id, dog_id, goal, priority_rank')
    .eq('dog_id', dogId)
    .order('priority_rank', { ascending: true });
  if (isMissingTableError(rawGoalsErr)) return migrationErr('dog_selected_training_goals');
  if (rawGoalsErr) {
    console.error('Failed to load selected training goals:', rawGoalsErr);
    return err('Failed to load selected training goals', 500);
  }

  let selectedGoals: SelectedGoal[] = (rawGoals ?? []) as SelectedGoal[];

  // Fall back to defaults if no goals selected
  if (selectedGoals.length === 0) {
    selectedGoals = DEFAULT_GOALS.map((goal, i) => ({
      id: `default-${i}`,
      dog_id: dogId,
      goal,
      priority_rank: i + 1,
    }));
  }

  const selectedGoalCategories = [...new Set(selectedGoals.map((g) => g.goal))];
  const targetDayCount = Math.max(50, selectedGoalCategories.length * 50);

  // Check for existing active roadmap with the expected selected-goal day count.
  if (!forceRegenerate) {
    const { data: existingRoadmap, error: existingRoadmapErr } = await supabase
      .from('dog_personalized_roadmaps')
      .select('id')
      .eq('dog_id', dogId)
      .eq('is_active', true)
      .single();
    if (isMissingTableError(existingRoadmapErr)) return migrationErr('dog_personalized_roadmaps');
    if (existingRoadmapErr && existingRoadmapErr.code !== 'PGRST116') {
      console.error('Failed to check existing roadmap:', existingRoadmapErr);
      return err('Failed to check existing roadmap', 500);
    }

    if (existingRoadmap) {
      const { count, error: existingDaysErr } = await supabase
        .from('dog_personalized_roadmap_days')
        .select('id', { count: 'exact', head: true })
        .eq('roadmap_id', existingRoadmap.id);
      if (isMissingTableError(existingDaysErr)) return migrationErr('dog_personalized_roadmap_days');
      if (existingDaysErr) {
        console.error('Failed to check existing roadmap days:', existingDaysErr);
        return err('Failed to check existing roadmap days', 500);
      }

      if ((count ?? 0) === targetDayCount) {
        return json({
          roadmapId: existingRoadmap.id,
          dayCount: count,
          message: 'Existing active roadmap returned',
        });
      }
    }
  }

  // Fetch pain points
  const { data: rawPainPoints, error: rawPainPointsErr } = await supabase
    .from('dog_training_pain_points')
    .select('dog_id, goal, pain_point_key')
    .eq('dog_id', dogId);
  if (isMissingTableError(rawPainPointsErr)) return migrationErr('dog_training_pain_points');
  if (rawPainPointsErr) {
    console.error('Failed to load training pain points:', rawPainPointsErr);
    return err('Failed to load training pain points', 500);
  }

  const _painPoints: PainPoint[] = (rawPainPoints ?? []) as PainPoint[];

  // Fetch completed activity IDs (video submissions with vlm_verdict = 'pass')
  const { data: rawSubmissions, error: rawSubmissionsErr } = await supabase
    .from('dog_training_video_submissions')
    .select('activity_id, vlm_verdict')
    .eq('dog_id', dogId)
    .eq('vlm_verdict', 'pass');
  if (isMissingTableError(rawSubmissionsErr)) return migrationErr('dog_training_video_submissions');
  if (rawSubmissionsErr) {
    console.error('Failed to load completed submissions:', rawSubmissionsErr);
    return err('Failed to load completed training submissions', 500);
  }

  const completedIds = new Set<string>(
    (rawSubmissions ?? []).map((s: any) => s.activity_id as string),
  );

  // Check for previous hard feedback (TOO_HARD on last roadmap)
  const { data: hardFeedbackRows, error: hardFeedbackErr } = await supabase
    .from('dog_personalized_roadmap_days')
    .select('feedback, roadmap_id')
    .eq('feedback', 'TOO_HARD')
    .limit(1);
  if (isMissingTableError(hardFeedbackErr)) return migrationErr('dog_personalized_roadmap_days');
  if (hardFeedbackErr) {
    console.error('Failed to load roadmap feedback:', hardFeedbackErr);
    return err('Failed to load roadmap feedback', 500);
  }

  // Narrow to days that belong to this dog's roadmaps
  let hasPreviousHardFeedback = false;
  if (hardFeedbackRows && hardFeedbackRows.length > 0) {
    const roadmapId = (hardFeedbackRows[0] as any).roadmap_id as string;
    const { data: roadmapCheck, error: roadmapCheckErr } = await supabase
      .from('dog_personalized_roadmaps')
      .select('id')
      .eq('id', roadmapId)
      .eq('dog_id', dogId)
      .single();
    if (isMissingTableError(roadmapCheckErr)) return migrationErr('dog_personalized_roadmaps');
    if (roadmapCheckErr && roadmapCheckErr.code !== 'PGRST116') {
      console.error('Failed to validate roadmap feedback owner:', roadmapCheckErr);
      return err('Failed to validate roadmap feedback', 500);
    }
    hasPreviousHardFeedback = !!roadmapCheck;
  }

  // ── STEP 2: Foundation activities ──

  // Fetch all relevant catalog activities for the foundation IDs
  const { data: rawFoundationCatalog, error: rawFoundationCatalogErr } = await supabase
    .from('training_catalog_activities')
    .select('id, category, sequence_number, level, title, prerequisites, verification_status')
    .in('id', FOUNDATION_ACTIVITY_IDS);
  if (isMissingTableError(rawFoundationCatalogErr)) return migrationErr('training_catalog_activities');
  if (rawFoundationCatalogErr) {
    console.error('Failed to load foundation catalog:', rawFoundationCatalogErr);
    return err('Failed to load foundation training catalog', 500);
  }

  const foundationCatalogMap = new Map<string, CatalogActivity>(
    ((rawFoundationCatalog ?? []) as CatalogActivity[]).map((a) => [a.id, a]),
  );

  const scheduledIds = new Set<string>();

  // Build ordered foundation list, skipping completed activities
  // and substituting with next available from catalog by sequence_number
  const foundationActivities: CatalogActivity[] = [];
  const usedFoundationIds = new Set<string>();

  for (const fId of FOUNDATION_ACTIVITY_IDS) {
    if (completedIds.has(fId)) {
      // Substitute: find the next unscheduled activity from catalog by sequence_number
      // We'll resolve substitutes after fetching goal activities below
      usedFoundationIds.add(fId); // mark as "to skip" — we'll fill below
    } else {
      const activity = foundationCatalogMap.get(fId);
      if (activity) {
        foundationActivities.push(activity);
        scheduledIds.add(fId);
        usedFoundationIds.add(fId);
      }
    }
  }

  // If foundation has fewer than 20 due to completed items, fetch substitutes
  if (foundationActivities.length < 20) {
    // Fetch all catalog activities ordered by sequence_number for substitution
    const { data: rawSubstitutes, error: rawSubstitutesErr } = await supabase
      .from('training_catalog_activities')
      .select('id, category, sequence_number, level, title, prerequisites, verification_status')
      .not('id', 'in', `(${[...usedFoundationIds].join(',')})`)
      .neq('verification_status', 'DISABLED')
      .order('sequence_number', { ascending: true })
      .limit(20);
    if (isMissingTableError(rawSubstitutesErr)) return migrationErr('training_catalog_activities');
    if (rawSubstitutesErr) {
      console.error('Failed to load foundation substitutes:', rawSubstitutesErr);
      return err('Failed to load foundation substitutes', 500);
    }

    const substitutes = (rawSubstitutes ?? []) as CatalogActivity[];
    for (const sub of substitutes) {
      if (foundationActivities.length >= 20) break;
      if (!scheduledIds.has(sub.id)) {
        foundationActivities.push(sub);
        scheduledIds.add(sub.id);
      }
    }
  }

  // ── STEP 3: Goal weight calculation ──

  const _goalWeights = calculateGoalWeights(selectedGoals);

  // ── STEP 4: Activity selection per goal ──

  const goalActivities = new Map<string, CatalogActivity[]>();

  // Fetch catalog activities for all selected goal categories
  const goalCategories = selectedGoalCategories;

  const { data: rawGoalCatalog, error: rawGoalCatalogErr } = await supabase
    .from('training_catalog_activities')
    .select('id, category, sequence_number, level, title, prerequisites, verification_status')
    .in('category', goalCategories)
    .neq('verification_status', 'DISABLED')
    .order('sequence_number', { ascending: true });
  if (isMissingTableError(rawGoalCatalogErr)) return migrationErr('training_catalog_activities');
  if (rawGoalCatalogErr) {
    console.error('Failed to load goal catalog:', rawGoalCatalogErr);
    return err('Failed to load goal training catalog', 500);
  }

  const goalCatalog = (rawGoalCatalog ?? []) as CatalogActivity[];

  for (const goalEntry of selectedGoals) {
    const picked = goalCatalog
      .filter((activity) => activity.category === goalEntry.goal)
      .sort((a, b) => a.sequence_number - b.sequence_number)
      .slice(0, 50);

    goalActivities.set(goalEntry.goal, picked);
  }

  // ── STEPS 5–6: Build schedule with boss battles and difficulty adjustments ──

  const allDays = buildSchedule(
    dogProfile,
    foundationActivities,
    goalActivities,
    selectedGoals,
    targetDayCount,
  );

  // ── STEP 7: Save to database ──

  // Deactivate existing active roadmaps
  await supabase
    .from('dog_personalized_roadmaps')
    .update({ is_active: false })
    .eq('dog_id', dogId)
    .eq('is_active', true);

  // Insert new roadmap
  const selectedGoalsJson = selectedGoals.map((g) => ({
    goal: g.goal,
    priority_rank: g.priority_rank,
  }));

  const { data: newRoadmap, error: insertRoadmapErr } = await supabase
    .from('dog_personalized_roadmaps')
    .insert({
      dog_id: dogId,
      curriculum_version: CURRICULUM_VERSION,
      personalization_engine_version: PERSONALIZATION_ENGINE_VERSION,
      selected_goals: selectedGoalsJson,
      is_active: true,
      generation_notes: `Generated for ${dogProfile.obedience_level} ${dogProfile.breed}, energy: ${dogProfile.energy_level}. Goals: ${goalCategories.join(', ')}.`,
    })
    .select('id')
    .single();

  if (insertRoadmapErr || !newRoadmap) {
    if (isMissingTableError(insertRoadmapErr)) return migrationErr('dog_personalized_roadmaps');
    console.error('Failed to insert roadmap:', insertRoadmapErr);
    return err('Failed to create roadmap', 500);
  }

  const roadmapId: string = newRoadmap.id;

  // Insert all selected-category days
  const dayRows: RoadmapDay[] = allDays.map((d) => ({
    ...d,
    roadmap_id: roadmapId,
  }));

  // Insert in batches of 50 to stay within payload limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < dayRows.length; i += BATCH_SIZE) {
    const batch = dayRows.slice(i, i + BATCH_SIZE);
    const { error: insertDaysErr } = await supabase
      .from('dog_personalized_roadmap_days')
      .insert(batch);

    if (insertDaysErr) {
      if (isMissingTableError(insertDaysErr)) return migrationErr('dog_personalized_roadmap_days');
      console.error(`Failed to insert days batch ${i}–${i + BATCH_SIZE}:`, insertDaysErr);
      // Attempt rollback: deactivate the roadmap we just created
      await supabase
        .from('dog_personalized_roadmaps')
        .update({ is_active: false })
        .eq('id', roadmapId);
      return err('Failed to save roadmap days', 500);
    }
  }

  // ── STEP 8: Return result ──

  return json({
    roadmapId,
    dayCount: dayRows.length,
    message: 'Roadmap generated successfully',
  });
});
