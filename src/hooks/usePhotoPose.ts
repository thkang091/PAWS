import { useQuery } from "@tanstack/react-query";

import { getConcept, getGallery, getQueue, getResults, library, listChallenges, listConcepts, ownPhotoUrl, referenceUrl } from "@/services/mediaService";

export const poseKeys = {
  challenges: ["photoPose", "challenges"] as const,
  reels: ["dogReels", "challenges"] as const,
  seasonal: ["seasonalSelfie", "challenges"] as const,
  library: ["photoPose", "library"] as const,
  gallery: (id: string) => ["photoPose", "gallery", id] as const,
  results: (id: string) => ["photoPose", "results", id] as const,
  queue: ["photoPose", "queue"] as const,
  concepts: ["photoPose", "concepts"] as const,
  concept: (id: string) => ["photoPose", "concept", id] as const,
  reference: (path: string) => ["photoPose", "reference", path] as const,
  own: (path: string) => ["photoPose", "own", path] as const,
};

export const usePoseChallenges = () => useQuery({ queryKey: poseKeys.challenges, queryFn: () => listChallenges("photo_pose"), staleTime: 20_000 });
/** Seasonal Selfie: this month's theme and recent months. */
export const useSeasonalChallenges = () =>
  useQuery({ queryKey: poseKeys.seasonal, queryFn: () => listChallenges("seasonal_selfie").then((l) => l.map((c) => ({ ...c, game: "seasonal_selfie" as const }))), staleTime: 20_000 });

/**
 * Every photo challenge (Photo Pose and Seasonal Selfie), for the shared photo screens that open one by its id.
 * Same shape as a single query so the screens don't change.
 */
export const usePhotoChallenges = () => {
  const poses = usePoseChallenges();
  const seasonal = useSeasonalChallenges();
  return {
    data: poses.data || seasonal.data ? [...(poses.data ?? []).map((c) => ({ ...c, game: "photo_pose" as const })), ...(seasonal.data ?? [])] : undefined,
    isPending: poses.isPending && seasonal.isPending,
    isRefetching: poses.isRefetching || seasonal.isRefetching,
    error: poses.data || seasonal.data ? null : (poses.error ?? seasonal.error),
    refetch: async () => {
      await Promise.all([poses.refetch(), seasonal.refetch()]);
    },
  };
};

/** Dog Reels: this week's theme, friend battles and recent weeks. */
export const useReelChallenges = () => useQuery({ queryKey: poseKeys.reels, queryFn: () => listChallenges("dog_reels"), staleTime: 20_000 });
export const usePoseLibrary = () => useQuery({ queryKey: poseKeys.library, queryFn: library, staleTime: 5 * 60_000 });

/** Signed links last an hour; refresh well before that. */
export const useReferenceUrl = (path: string | null | undefined) =>
  useQuery({ queryKey: poseKeys.reference(path ?? ""), queryFn: () => referenceUrl(path!), enabled: !!path, staleTime: 40 * 60_000 });
export const useOwnPhotoUrl = (path: string | null | undefined) =>
  useQuery({ queryKey: poseKeys.own(path ?? ""), queryFn: () => ownPhotoUrl(path!), enabled: !!path, staleTime: 20 * 60_000 });

export const useGallery = (challengeId: string | undefined, enabled = true) =>
  useQuery({ queryKey: poseKeys.gallery(challengeId ?? ""), queryFn: () => getGallery(challengeId!), enabled: !!challengeId && enabled, staleTime: 60_000 });
export const useResults = (challengeId: string | undefined, enabled = true) =>
  useQuery({ queryKey: poseKeys.results(challengeId ?? ""), queryFn: () => getResults(challengeId!), enabled: !!challengeId && enabled, staleTime: 5 * 60_000 });

export const useModerationQueue = () => useQuery({ queryKey: poseKeys.queue, queryFn: getQueue, staleTime: 10_000 });
export const useConcepts = () => useQuery({ queryKey: poseKeys.concepts, queryFn: listConcepts, staleTime: 10_000 });
export const useConcept = (id: string | undefined) => useQuery({ queryKey: poseKeys.concept(id ?? ""), queryFn: () => getConcept(id!), enabled: !!id });
