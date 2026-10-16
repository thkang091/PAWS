import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { NOT_ADDED, type Block, type EntryRow, type FactRow, type ProfileSection, type ProfileTab } from "@/constants/profileRecord";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { CARE_LABEL, BCS_WORDS } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { useDogBasis } from "@/features/care/food/useDogBasis";
import { useLivePlan } from "@/features/care/food/usePlan";
import { formatAmount } from "@/features/care/food/foodPlanMath";
import { ROLE_LABEL, roleOf } from "@/features/care/food/options";
import { VISIT_KINDS } from "@/features/care/state/careDose";
import { useCareLocations } from "@/features/care/state/careLocations";
import { useCareOnboarding } from "@/features/care/state/careOnboarding";
import { useFoodPlan } from "@/features/care/state/foodPlan";
import { useCheckInHistory, useCheckInSettings } from "@/features/care/state/dailyCheckIn";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { useMedicalFacts } from "@/features/profile/state/medicalFacts";
import { useKnow } from "@/features/profile/intel/useKnow";
import { useProfileDraft } from "@/features/profile/state/profileDraft";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { useCareProfile, useMedications, useVaccinations } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useFoodRules } from "@/hooks/useFood";
import { useGameEntries } from "@/hooks/useGameInstances";
import { useProfileDashboard } from "@/hooks/useProfileDashboard";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import { getDogTrainingOverview, getDogTrainingPreferences } from "@/services/trainingCurriculumService";

/**
 * The whole Profile, built from what PAWS actually knows about the dog: the dog record, weigh-ins, the food plan,
 * care set-up, check-ins, health records, training progress and games, plus whatever the guardian has written in.
 * Nothing is invented. A question nobody has answered says "Not added" and opens an editor; a fact that lives in
 * another part of PAWS is shown but locked, with a link to where it is changed.
 */
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTH[m - 1]} ${y}`;
};
const monthYear = (iso: string) => `${MONTH[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const ago = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
};
const ageText = (birthday: string | null, ageYears: number | null) => {
  if (birthday) {
    const then = new Date(birthday);
    const now = new Date();
    let months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
    if (now.getDate() < then.getDate()) months -= 1;
    const y = Math.floor(Math.max(0, months) / 12);
    const m = Math.max(0, months) % 12;
    return y === 0 ? `${m} ${m === 1 ? "month" : "months"}` : m === 0 ? `${y} ${y === 1 ? "year" : "years"}` : `${y} ${y === 1 ? "year" : "years"}, ${m} ${m === 1 ? "month" : "months"}`;
  }
  return ageYears != null ? `${ageYears} ${ageYears === 1 ? "year" : "years"}` : null;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const times = (list: readonly string[] | null | undefined) => (list?.length ? list.map((t) => prettyTime(t)).join(", ") : null);

export type ProfileData = ReturnType<typeof useProfileData>;

export const useProfileData = () => {
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const know = useKnow();
  const weights = useWeightLogs(dogId);
  const intel = useCareIntel();
  const { basis, walking } = useDogBasis();
  const facts = useMedicalFacts();
  const draft = useProfileDraft();
  const record = useHealthRecord();
  const vaccinations = useVaccinations(dogId);
  const meds = useMedications(dogId);
  const careProfile = useCareProfile(dogId);
  const { choice } = useCareOnboarding();
  const live = useLivePlan();
  const foodStore = useFoodPlan();
  const rules = useFoodRules(dogId);
  const locations = useCareLocations();
  const dashboard = useProfileDashboard(dogId);
  const checkIns = useCheckInHistory();
  const checkInSettings = useCheckInSettings();
  const account = useAccountStatus();
  const games = useGameEntries(dogId);
  const training = useQuery({
    queryKey: dogId ? queryKeys.dogTrainingOverview(dogId) : ["dogTrainingOverview", "missing"],
    queryFn: () => getDogTrainingOverview(dogId ?? ""),
    enabled: Boolean(dogId),
  });
  const trainingPrefs = useQuery({
    queryKey: dogId ? queryKeys.dogTrainingPreferences(dogId) : ["dogTrainingPreferences", "missing"],
    queryFn: () => getDogTrainingPreferences(dogId ?? ""),
    enabled: Boolean(dogId),
  });

  return useMemo(() => {
    const d = dog.data;
    const name = d?.name ?? "Your dog";
    const field = (section: string, label: string) => (draft.isEdited(section, label) ? draft.resolve(section, label, NOT_ADDED) : NOT_ADDED);
    const answered = (section: string, labels: readonly string[]) => labels.filter((l) => field(section, l) !== NOT_ADDED);

    // ---------- About ----------
    const latest = weights.data?.[0];
    const fixed = facts.surgeries?.picks.find((p) => p === "Spayed" || p === "Neutered") ?? (basis.neutered === true ? (d?.gender === "female" ? "Spayed" : "Neutered") : null);
    const sex = d?.gender && d.gender !== "unknown" ? `${cap(d.gender)}${fixed ? `, ${fixed.toLowerCase()}` : ""}` : null;
    const age = ageText(d?.birthday ?? null, d?.ageYears ?? null);
    const since = d?.ownedSince ?? d?.adoptionDate ?? null;
    const bcs = foodStore.profile.bcs ?? null;
    const weight = latest ? `${latest.weightValue} ${latest.weightUnit}` : null;
    const aboutRows: FactRow[] = [
      ["Name", name],
      ["Nickname", field("about", "Nickname")],
      ["Breed", d?.breed?.trim() || NOT_ADDED],
      ["Sex", sex ?? NOT_ADDED],
      ["Date of birth", day(d?.birthday) ?? NOT_ADDED],
      ["Age", age ?? NOT_ADDED],
      ["Together since", day(since) ?? NOT_ADDED],
      ["Size", cap(intel.size)],
    ];
    const bodyRows: FactRow[] = [
      ["Weight", weight ? `${weight}, ${day(latest!.recordedAt)}` : NOT_ADDED],
      ["Body condition", bcs ? `${bcs}/9, ${BCS_WORDS[bcs].toLowerCase()}` : NOT_ADDED],
      ["Coat", field("about", "Coat")],
      ["Colour", field("about", "Colour")],
    ];
    const ID_LABELS = ["Microchip number", "Microchip registry", "Registration", "Emergency contact", "Vet", "Insurance", "Travel notes"];
    const about: ProfileSection = {
      key: "about",
      title: `About ${name}`,
      summary: [d?.breed, age, weight].filter(Boolean).join(" · ") || "Add the basics",
      lede: `The things that stay true about ${name}.`,
      blocks: [
        { kind: "facts", title: "Basics", rows: aboutRows, locked: ["Name", "Breed", "Sex", "Date of birth", "Age", "Together since", "Size"] },
        { kind: "facts", title: "Body", rows: bodyRows, locked: ["Weight", "Body condition"] },
        { kind: "facts", title: "Identification & safety", rows: ID_LABELS.map((l) => [l, field("about", l)] as const) },
        { kind: "link", label: "Weigh-ins", hint: "Log a new weight", href: "/care/weight-log" },
      ],
    };

    // ---------- Personality (the tailored question set) ----------
    const personality: ProfileSection = {
      key: "personality",
      title: "Personality",
      summary: know.answered ? (know.answered === know.total ? "All answered" : `${know.answered} of ${know.total} answered`) : `${know.total} quick questions`,
      lede: "",
      blocks: [],
    };

    // ---------- A normal day ----------
    const mealTimes = live.mealTimes?.length ? live.mealTimes : (careProfile.data?.mealTimes ?? choice?.mealTimes ?? []);
    const goal = careProfile.data?.dailyExerciseGoalMinutes ?? choice?.exerciseMinutes ?? null;
    const routine: ProfileSection = {
      key: "routine",
      title: "A normal day",
      summary: [choice?.walkTimes?.length ? `${choice.walkTimes.length} ${choice.walkTimes.length === 1 ? "walk" : "walks"}` : null, mealTimes.length ? `${mealTimes.length} meals` : null, checkInSettings.enabled ? `check-in ${prettyTime(checkInSettings.time)}` : null].filter(Boolean).join(" · ") || "Set up in Care",
      lede: `${name}'s usual day, from the Care set-up. Today's list lives in Care.`,
      blocks: [
        {
          kind: "facts",
          title: "From the care plan",
          rows: [
            ["Walks", times(choice?.walkTimes) ?? NOT_ADDED],
            ["Meals", times(mealTimes) ?? NOT_ADDED],
            ["Daily walking goal", goal ? `${goal} minutes` : NOT_ADDED],
            ["Evening check-in", checkInSettings.enabled ? prettyTime(checkInSettings.time) : "Off"],
          ],
          locked: ["Walks", "Meals", "Daily walking goal", "Evening check-in"],
        },
        { kind: "facts", title: "Around the house", rows: ["Wakes", "Bed", "Alone time"].map((l) => [l, field("routine", l)] as const) },
        { kind: "link", label: "Change the schedule", hint: "Walks, meals and reminders", href: "/care/schedule" },
      ],
    };

    // ---------- Training ----------
    const skills = training.data ?? [];
    const strong = skills.filter((s) => s.progress.status === "completed");
    const practising = skills.filter((s) => s.progress.status === "in_progress");
    const bySection = new Map<string, { strong: number; total: number }>();
    for (const s of skills) {
      if (s.progress.status === "not_started") continue;
      const row = bySection.get(s.sectionTitle) ?? { strong: 0, total: 0 };
      row.total += 1;
      if (s.progress.status === "completed") row.strong += 1;
      bySection.set(s.sectionTitle, row);
    }
    const meters = [...bySection.entries()].map(([label, r]) => ({ label, strong: r.strong, total: r.total }));
    const focus = practising[0] ?? null;
    const prefs = trainingPrefs.data;
    const trainingBlocks: Block[] = [
      {
        kind: "facts",
        title: `How ${name} trains`,
        rows: [
          ["Experience", prefs?.trainingExperience ? cap(prefs.trainingExperience.replace(/_/g, " ")) : NOT_ADDED],
          ["Minutes a day", prefs?.dailyMinutes ? `${prefs.dailyMinutes} minutes` : NOT_ADDED],
          ["Current focus", focus ? focus.skill.title : "Nothing in progress"],
          ["Primary reward", field("training", "Primary reward")],
          ["Best time", field("training", "Best time")],
        ],
        locked: ["Experience", "Minutes a day", "Current focus"],
      },
    ];
    if (meters.length) trainingBlocks.push({ kind: "meters", title: "By section", note: "Skills finished, out of the skills started.", rows: meters });
    if (strong.length + practising.length) {
      trainingBlocks.push({
        kind: "states",
        title: "Skills",
        collapseAfter: 6,
        labels: { settled: "Strong", learning: "Practising" },
        rows: [...practising, ...strong].map((s) => ({
          label: s.skill.title,
          state: s.progress.status === "completed" ? ("settled" as const) : ("learning" as const),
          detail: [s.sectionTitle, s.progress.lastPracticedAt ? `practised ${ago(s.progress.lastPracticedAt)}` : null].filter(Boolean).join(" · "),
        })),
      });
    } else {
      trainingBlocks.push({ kind: "prose", text: `${name} has not started a skill yet. The first one takes a few minutes.` });
    }
    trainingBlocks.push({ kind: "link", label: "Open training", hint: "Lessons and this week's plan", href: "/train" });
    const trainingSection: ProfileSection = {
      key: "training",
      title: "Training profile",
      summary: skills.length ? `${strong.length} strong · ${practising.length} practising` : "Not started yet",
      lede: `What ${name} knows and what they are working on, from Train.`,
      blocks: trainingBlocks,
    };
    const BEHAVIOUR = ["Working on", "Improving", "Settled"];
    const behaviour: ProfileSection = {
      key: "behaviour",
      title: "Behaviour notes",
      summary: answered("behaviour", BEHAVIOUR).length ? `${answered("behaviour", BEHAVIOUR).length} notes` : "Not added yet",
      lede: `What you have noticed, so training can account for it.`,
      blocks: [
        { kind: "facts", rows: BEHAVIOUR.map((l) => [l, field("behaviour", l)] as const) },
        { kind: "link", label: "Open training", hint: "The plan that works on these", href: "/train" },
      ],
    };

    // ---------- Health (its own screen) ----------
    const conditions = record.items.filter((i) => i.kind === "condition");
    const allergies = record.items.filter((i) => i.kind === "allergy");
    const latestShot = new Map<string, NonNullable<typeof vaccinations.data>[number]>();
    for (const v of vaccinations.data ?? []) {
      const seen = latestShot.get(v.vaccineKey);
      if (!seen || v.dateGiven > seen.dateGiven) latestShot.set(v.vaccineKey, v);
    }
    const nextShot = [...latestShot.values()].filter((v) => v.nextDueDate).sort((a, b) => (a.nextDueDate! < b.nextDueDate! ? -1 : 1))[0];
    const health: ProfileSection = {
      key: "health",
      title: "Medical record",
      summary: [conditions.length ? `${conditions.length} ${conditions.length === 1 ? "condition" : "conditions"}` : "No conditions", nextShot ? `next vaccine ${monthYear(nextShot.nextDueDate!)}` : null].filter(Boolean).join(" · "),
      lede: "",
      blocks: [],
    };

    // ---------- Food ----------
    const plan = live.plan;
    const food: ProfileSection = plan
      ? {
          key: "food",
          title: "Food & nutrition",
          summary: [plan.food.product.name, live.result?.amount != null ? `${formatAmount(live.result.amount, plan.unit)} a day` : null].filter(Boolean).join(" · "),
          lede: `What ${name} eats, from the Food Plan.`,
          blocks: [
            {
              kind: "facts",
              title: "Main food",
              rows: [
                ["Food", plan.food.product.name],
                ["Each day", live.result?.amount != null ? formatAmount(live.result.amount, plan.unit) : NOT_ADDED],
                ["Meals", mealTimes.length ? `${mealTimes.length} at ${times(mealTimes)}` : NOT_ADDED],
                ["Calories a day", live.result?.energy ? `${live.result.energy.kcal} kcal` : NOT_ADDED],
              ],
              locked: ["Food", "Each day", "Meals", "Calories a day"],
            },
            ...(plan.treats.length
              ? [{ kind: "entries" as const, title: "Treats", rows: plan.treats.map((t) => ({ title: t.product.name, meta: ROLE_LABEL[roleOf(t)], href: `/care/food-item?id=${encodeURIComponent(t.product.id)}&role=${roleOf(t)}` })) }]
              : []),
            {
              kind: "facts",
              title: "Avoid",
              rows: [
                ["Allergies", allergies.length ? allergies.map((a) => a.name).join(", ") : "None recorded"],
                ["Can't-eat list", (rules.data ?? []).length ? (rules.data ?? []).map((r) => r.name).join(", ") : "Empty"],
              ],
              locked: ["Allergies", "Can't-eat list"],
            },
            { kind: "link", label: "Open the Food Plan", hint: "Change food, treats or amounts", href: "/care/food-plan" },
          ],
        }
      : {
          key: "food",
          title: "Food & nutrition",
          summary: "No Food Plan yet",
          lede: `What ${name} eats, from the Food Plan.`,
          blocks: [
            { kind: "prose", text: `Set up a Food Plan and ${name}'s food, amounts and treats show here.` },
            { kind: "link", label: "Set up the Food Plan", hint: "About a minute", href: "/care/food-plan" },
          ],
        };

    // ---------- Activity ----------
    const activity: ProfileSection = {
      key: "activity",
      title: "Activity & lifestyle",
      summary: walking ? `About ${walking.minutesPerDay} min of walking a day` : goal ? `Goal ${goal} min a day` : "Not set up yet",
      lede: `How much ${name} moves, from walks logged in PAWS.`,
      blocks: [
        {
          kind: "facts",
          title: "This week",
          rows: [
            ["Walking a day", walking ? `About ${walking.minutesPerDay} minutes` : "Not enough walks logged yet"],
            ["Days walked", walking ? `${walking.days} of 7` : NOT_ADDED],
            ["Activity level", basis.activity ? cap(basis.activity) : NOT_ADDED],
            ["Daily goal", goal ? `${goal} minutes` : NOT_ADDED],
          ],
          locked: ["Walking a day", "Days walked", "Activity level", "Daily goal"],
        },
        { kind: "facts", title: "Preferences", rows: ["Favourites", "Not for them"].map((l) => [l, field("activity", l)] as const) },
        { kind: "link", label: "Exercise log", hint: `What ${name} has actually done`, href: "/care/exercise" },
      ],
    };

    // ---------- People, care team, records ----------
    const people: ProfileSection = {
      key: "people",
      title: `${name}'s people`,
      summary: account.data?.email ? "You" : "You, on this phone",
      lede: `Who looks after ${name} in PAWS.`,
      blocks: [
        {
          kind: "entries",
          title: "Household",
          rows: [{ title: "You", meta: account.data?.email ?? "Signed in on this phone only. Link an account to keep it safe", trailing: "Owner", href: "/account/link" }],
        },
      ],
    };
    const team: EntryRow[] = [
      ...(draft.isEdited("about", "Vet") ? [{ title: draft.resolve("about", "Vet", ""), meta: "Usual vet", trailing: "Vet" }] : []),
      ...locations.clinics.map((c) => ({ title: c.name, meta: [c.phone, c.address].filter(Boolean).join(" · ") || "Saved clinic", trailing: "Clinic" })),
    ];
    const TEAM = ["Groomer", "Trainer", "Walker", "Emergency clinic"];
    const careTeam: ProfileSection = {
      key: "care-team",
      title: "Care team",
      summary: team.length || answered("care-team", TEAM).length ? `${team.length + answered("care-team", TEAM).length} people and places` : "Not added yet",
      lede: `The people outside the house who look after ${name}.`,
      blocks: [
        ...(team.length ? [{ kind: "entries" as const, title: "Vets and clinics", rows: team }] : []),
        { kind: "facts", title: "Others", rows: TEAM.map((l) => [l, field("care-team", l)] as const) },
        { kind: "link", label: "Find a vet", hint: "Clinics near you", href: "/care/find-vet" },
      ],
    };
    const logged = intel.log.filter((e) => e.kind !== "brushing");
    const recordCount = logged.length + (vaccinations.data?.length ?? 0);
    const lastRecord = [...logged.map((e) => e.date), ...(vaccinations.data ?? []).map((v) => v.dateGiven.slice(0, 10))].sort().pop() ?? null;
    const records: ProfileSection = {
      key: "records",
      title: "Records",
      summary: recordCount ? `${recordCount} records · last ${day(lastRecord)}` : "None yet",
      lede: "Everything with a date behind it.",
      blocks: [
        {
          kind: "entries",
          rows: [
            { title: "Health records", meta: `${logged.length} visits, tests and doses`, trailing: logged.length ? monthYear(logged.map((e) => e.date).sort().pop()!) : undefined, href: "/care/records" },
            { title: "Vaccinations", meta: `${vaccinations.data?.length ?? 0} recorded`, href: "/care/vaccinations" },
            { title: "Medications", meta: `${(meds.data ?? []).filter((m) => m.isActive).length} current`, href: "/care/medications" },
            { title: "Medical record PDF", meta: "For your vet", href: "/profile/health" },
          ],
        },
      ],
    };

    const sections = [about, personality, routine, trainingSection, behaviour, health, food, activity, people, careTeam, records];

    // ---------- Tab panels ----------
    const recentVisits = intel.log.filter((e) => VISIT_KINDS.includes(e.kind) || e.kind === "vet_note").sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);

    const tabs: ProfileTab[] = [
      {
        key: "about",
        label: "About",
        headTitle: `About ${name}`,
        headHref: "/profile/about",
        doors: ["routine", "people", "records"],
        panel: {
          // The understanding card and the question sets carry temperament and basics now.
          traits: undefined,
          // The About tab leads with "How PAWS understands" and the question sets, so no separate invite.
          invite: undefined,
          tilesTitle: `${name}'s world`,
        },
      },
      {
        key: "training",
        label: "Training",
        headTitle: "How training is going",
        headHref: "/profile/training",
        doors: ["training", "behaviour"],
        panel: {
          spotlight: focus
            ? {
                chip: "Working on",
                glyph: "target",
                title: focus.skill.title,
                meta: [focus.sectionTitle, focus.progress.lastPracticedAt ? `practised ${ago(focus.progress.lastPracticedAt)}` : null].filter(Boolean).join(" · "),
                progress: skills.length ? strong.length / Math.max(1, strong.length + practising.length) : undefined,
                progressNote: `${strong.length} of ${strong.length + practising.length} skills strong`,
                href: "/train",
              }
            : undefined,
          invite: focus ? undefined : { title: strong.length ? "Pick the next skill" : "Start the first skill", meta: "Short lessons, a few minutes a day.", href: "/train" },
          meters: meters.length ? { title: "By section", rows: meters.map((m) => ({ key: m.label, ...m })) } : undefined,
          tilesTitle: "Training in detail",
        },
      },
      {
        key: "health",
        label: "Health",
        headTitle: "Health at a glance",
        headHref: "/profile/health",
        doors: ["health", "food", "activity", "care-team"],
        panel: {
          spotlight: nextShot
            ? {
                chip: "Next up",
                glyph: "syringe",
                title: `${nextShot.vaccineName} vaccine`,
                meta: `Due ${day(nextShot.nextDueDate)} · last given ${day(nextShot.dateGiven)}${nextShot.vetName ? ` at ${nextShot.vetName}` : ""}`,
                href: "/care/vaccinations",
              }
            : undefined,
          invite: nextShot ? undefined : { title: "Add vaccinations", meta: "So PAWS can remind you before they are due.", href: "/care/vaccinations" },
          band: [
            { key: "conditions", glyph: "heart", value: conditions.length ? conditions.map((c) => c.insight?.name ?? c.name).join(", ") : "None", label: "Conditions" },
            { key: "allergies", glyph: "sensitivity", value: allergies.length ? allergies.map((a) => a.name).join(", ") : "None", label: "Allergies" },
            { key: "vaccines", glyph: "syringe", value: String(latestShot.size), label: "Vaccines" },
          ],
          rail: recentVisits.length
            ? { title: "Recent checkups", cards: recentVisits.map((e) => ({ key: e.id, title: CARE_LABEL[e.kind], chip: e.result ?? undefined, meta: day(e.date) ?? "" })) }
            : undefined,
          tilesTitle: "Health in detail",
        },
      },
    ];

    // ---------- Together (progress) ----------
    const firstCheckIn = checkIns.length ? checkIns[checkIns.length - 1].date : null;
    const firstStrong = strong.map((s) => s.progress.completedAt).filter((x): x is string => Boolean(x)).sort()[0] ?? null;
    const milestones: EntryRow[] = [
      ...(since ? [{ title: `Together since ${day(since)}`, meta: ago(since) ? `Started ${ago(since)}` : "" }] : []),
      ...(firstCheckIn ? [{ title: "First evening check-in", meta: day(firstCheckIn) ?? "" }] : []),
      ...(firstStrong ? [{ title: "First strong skill", meta: day(firstStrong) ?? "" }] : []),
      ...(checkIns.length >= 7 ? [{ title: `${checkIns.length} check-ins`, meta: "Every one helps PAWS spot a change early" }] : []),
      ...(recordCount ? [{ title: `${recordCount} health records kept`, meta: lastRecord ? `Latest ${day(lastRecord)}` : "" }] : []),
    ];
    const played = games.data?.length ?? 0;
    const together = {
      level: dashboard.data?.level ?? 1,
      xpInLevel: dashboard.data ? dashboard.data.bondXp % 100 : 0,
      xpPerLevel: 100,
      streak: dashboard.data?.streak ?? 0,
      points: dashboard.data?.wallet.silverBalance ?? 0,
      strong: strong.length,
      practising: practising.length,
    };
    const progress = {
      training: [
        ...(meters.length ? [{ kind: "meters" as const, title: "By section", note: "Skills finished, out of the skills started.", rows: meters }] : []),
        {
          kind: "facts" as const,
          title: "Totals",
          rows: [
            ["Skills started", String(strong.length + practising.length)],
            ["Strong", String(strong.length)],
            ["Still practising", String(practising.length)],
            ["Current focus", focus ? focus.skill.title : "Nothing in progress"],
          ] as FactRow[],
        },
        { kind: "link" as const, label: "Open training", hint: "Lessons and this week's plan", href: "/train" },
      ] as Block[],
      games: [
        played
          ? { kind: "facts" as const, title: "Games", rows: [["Games entered", String(played)]] as FactRow[] }
          : { kind: "prose" as const, text: `No games played yet. Challenges are a quick way to practise what ${name} knows.` },
        { kind: "link" as const, label: "Open games", hint: "Challenges, duels and tournaments", href: "/game" },
      ] as Block[],
      milestones: (milestones.length
        ? [{ kind: "entries" as const, title: "So far", rows: milestones }]
        : [{ kind: "prose" as const, text: `Milestones appear as you and ${name} use PAWS: the first check-in, the first strong skill and more.` }]) as Block[],
    };

    return {
      name,
      breed: d?.breed?.trim() || null,
      tag: d?.dogTag?.trim() || null,
      age: age ?? null,
      weight,
      sections,
      tabs,
      together,
      progress,
      findSection: (key: string) => sections.find((s) => s.key === key),
    };
  }, [dog.data, weights.data, intel, basis, walking, facts, draft, record.items, vaccinations.data, meds.data, careProfile.data, choice, live, rules.data, locations.clinics, dashboard.data, checkIns, checkInSettings, account.data, games.data, training.data, trainingPrefs.data, foodStore.profile.bcs, know]);
};
