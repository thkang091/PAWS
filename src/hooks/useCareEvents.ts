import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { removeCareRoutine,
  addCareRoutine,
  completeCareRoutine,
  deleteCareEvent,
  getCareEvents,
  getCareRoutineCompletions,
  getCareRoutines,
  saveCareRoutineSetup,
  type CareRoutineDraft,
  upsertCareEvent,
  type CareEventInput,
} from "@/services/careService";

export const useCareEvents = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.careEvents(dogId) : ["careEvents", "missing"],
    queryFn: () => getCareEvents(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useSaveCareEvent = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, eventId }: { input: CareEventInput; eventId?: string }) => upsertCareEvent(input, eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.careEvents(dogId) });
    },
  });
};

export const useDeleteCareEvent = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCareEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.careEvents(dogId) });
    },
  });
};

export const useCareRoutines = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.careRoutines(dogId) : ["careRoutines", "missing"],
    queryFn: () => getCareRoutines(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useCareRoutineCompletions = (dogId: string | undefined, date: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.careRoutineCompletions(dogId, date) : ["careRoutineCompletions", "missing", date],
    queryFn: () => getCareRoutineCompletions(dogId ?? "", date),
    enabled: Boolean(dogId),
  });

export const useSaveCareRoutineSetup = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (routineDrafts: CareRoutineDraft[]) => saveCareRoutineSetup(dogId, routineDrafts),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.careRoutines(dogId) });
    },
  });
};

export const useAddCareRoutine = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: { title: string; description: string; iconKey: string; reminderTime: string | null }) => addCareRoutine(dogId, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.careRoutines(dogId) });
    },
  });
};

export const useRemoveCareRoutine = (dogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (routineId: string) => removeCareRoutine(routineId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.careRoutines(dogId) });
    },
  });
};

export const useCompleteCareRoutine = (dogId: string, date: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (routineId: string) => completeCareRoutine(routineId, date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.careRoutineCompletions(dogId, date) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyRoutineLogs(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dogId) });
    },
  });
};
