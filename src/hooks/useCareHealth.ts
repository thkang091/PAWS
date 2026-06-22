import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCareProfile,
  getGroomingLogs,
  getMedications,
  getTodayExerciseLogs,
  getTodayMedicationLogs,
  getVaccinations,
  logExercise,
  logGrooming,
  logMedicationGiven,
  saveMedication,
  saveVaccination,
  upsertCareProfile,
  deleteMedication,
  deleteVaccination,
} from "@/services/careHealthService";

const keys = {
  careProfile: (dogId: string) => ["careProfile", dogId] as const,
  vaccinations: (dogId: string) => ["vaccinations", dogId] as const,
  medications: (dogId: string) => ["medications", dogId] as const,
  medicationLogs: (dogId: string) => ["medicationLogs", dogId] as const,
  exerciseLogs: (dogId: string) => ["exerciseLogs", dogId] as const,
  groomingLogs: (dogId: string) => ["groomingLogs", dogId] as const,
};

export const useCareProfile = (dogId?: string) =>
  useQuery({
    queryKey: keys.careProfile(dogId ?? ""),
    queryFn: () => getCareProfile(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useUpsertCareProfile = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof upsertCareProfile>[1]) => upsertCareProfile(dogId, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.careProfile(dogId) });
    },
  });
};

export const useVaccinations = (dogId?: string) =>
  useQuery({
    queryKey: keys.vaccinations(dogId ?? ""),
    queryFn: () => getVaccinations(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useSaveVaccination = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveVaccination>[1]) => saveVaccination(dogId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.vaccinations(dogId) });
    },
  });
};

export const useDeleteVaccination = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVaccination(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.vaccinations(dogId) });
    },
  });
};

export const useMedications = (dogId?: string) =>
  useQuery({
    queryKey: keys.medications(dogId ?? ""),
    queryFn: () => getMedications(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useSaveMedication = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveMedication>[1]) => saveMedication(dogId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.medications(dogId) });
    },
  });
};

export const useDeleteMedication = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMedication(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.medications(dogId) });
    },
  });
};

export const useTodayMedicationLogs = (dogId?: string) =>
  useQuery({
    queryKey: keys.medicationLogs(dogId ?? ""),
    queryFn: () => getTodayMedicationLogs(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useLogMedicationGiven = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (medicationId: string) => logMedicationGiven(dogId, medicationId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.medicationLogs(dogId) });
    },
  });
};

export const useTodayExerciseLogs = (dogId?: string) =>
  useQuery({
    queryKey: keys.exerciseLogs(dogId ?? ""),
    queryFn: () => getTodayExerciseLogs(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useLogExercise = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof logExercise>[1]) => logExercise(dogId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.exerciseLogs(dogId) });
    },
  });
};

export const useGroomingLogs = (dogId?: string) =>
  useQuery({
    queryKey: keys.groomingLogs(dogId ?? ""),
    queryFn: () => getGroomingLogs(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useLogGrooming = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof logGrooming>[1]) => logGrooming(dogId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.groomingLogs(dogId) });
    },
  });
};
