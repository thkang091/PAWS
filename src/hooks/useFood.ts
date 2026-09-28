import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addFoodRule,
  getFoodChecks,
  getFoodRules,
  getRecentTreatNames,
  getSavedTreats,
  removeFoodRule,
  removeSavedTreat,
  saveFoodCheck,
  saveMealPlan,
  saveTreat,
  setCurrentFood,
  type MealPlan,
  type SavedTreat,
  type FoodCheck,
  type FoodRule,
  type FoodRuleKind,
} from "@/services/foodService";

const keys = {
  rules: (dogId: string) => ["foodRules", dogId] as const,
  checks: (dogId: string) => ["foodChecks", dogId] as const,
  careProfile: (dogId: string) => ["careProfile", dogId] as const,
  treats: (dogId: string) => ["savedTreats", dogId] as const,
  recentTreats: (dogId: string) => ["recentTreats", dogId] as const,
};

export const useFoodRules = (dogId?: string) =>
  useQuery({
    queryKey: keys.rules(dogId ?? ""),
    queryFn: () => getFoodRules(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useAddFoodRule = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; kind: FoodRuleKind; note?: string | null }) =>
      addFoodRule(dogId, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: keys.rules(dogId) });
      const before = qc.getQueryData<FoodRule[]>(keys.rules(dogId));
      qc.setQueryData<FoodRule[]>(keys.rules(dogId), (rules = []) => [
        ...rules,
        { id: `pending-${input.name}`, name: input.name.trim(), kind: input.kind, note: input.note ?? null },
      ]);
      return { before };
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(keys.rules(dogId), context?.before);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.rules(dogId) });
    },
  });
};

export const useRemoveFoodRule = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => removeFoodRule(ruleId),
    onMutate: async (ruleId) => {
      await qc.cancelQueries({ queryKey: keys.rules(dogId) });
      const before = qc.getQueryData<FoodRule[]>(keys.rules(dogId));
      qc.setQueryData<FoodRule[]>(keys.rules(dogId), (rules = []) =>
        rules.filter((rule) => rule.id !== ruleId),
      );
      return { before };
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(keys.rules(dogId), context?.before);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.rules(dogId) });
    },
  });
};

export const useFoodChecks = (dogId?: string) =>
  useQuery({
    queryKey: keys.checks(dogId ?? ""),
    queryFn: () => getFoodChecks(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useSaveFoodCheck = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (check: Omit<FoodCheck, "id" | "createdAt">) => saveFoodCheck(dogId, check),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.checks(dogId) });
    },
  });
};

export const useSetCurrentFood = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (food: { name: string; imageUrl?: string | null; kcalPer100g?: number | null }) =>
      setCurrentFood(dogId, food),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.careProfile(dogId) });
    },
  });
};

export const useSavedTreats = (dogId?: string) =>
  useQuery({
    queryKey: keys.treats(dogId ?? ""),
    queryFn: () => getSavedTreats(dogId ?? ""),
    enabled: Boolean(dogId),
    retry: 1,
  });

export const useRecentTreats = (dogId?: string) =>
  useQuery({
    queryKey: keys.recentTreats(dogId ?? ""),
    queryFn: () => getRecentTreatNames(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useSaveTreat = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treat: { name: string; imageUrl?: string | null }) => saveTreat(dogId, treat),
    onMutate: async (treat) => {
      await qc.cancelQueries({ queryKey: keys.treats(dogId) });
      const before = qc.getQueryData<SavedTreat[]>(keys.treats(dogId));
      qc.setQueryData<SavedTreat[]>(keys.treats(dogId), (list = []) =>
        list.some((item) => item.name.toLowerCase() === treat.name.trim().toLowerCase())
          ? list
          : [...list, { id: `pending-${treat.name}`, name: treat.name.trim(), imageUrl: treat.imageUrl ?? null }],
      );
      return { before };
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(keys.treats(dogId), context?.before);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.treats(dogId) });
    },
  });
};

export const useRemoveSavedTreat = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treatId: string) => removeSavedTreat(treatId),
    onMutate: async (treatId) => {
      await qc.cancelQueries({ queryKey: keys.treats(dogId) });
      const before = qc.getQueryData<SavedTreat[]>(keys.treats(dogId));
      qc.setQueryData<SavedTreat[]>(keys.treats(dogId), (list = []) => list.filter((item) => item.id !== treatId));
      return { before };
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(keys.treats(dogId), context?.before);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.treats(dogId) });
    },
  });
};

export const useSaveMealPlan = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: MealPlan) => saveMealPlan(dogId, plan),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.careProfile(dogId) });
    },
  });
};

export const useInvalidateRecentTreats = (dogId: string) => {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: keys.recentTreats(dogId) });
};
