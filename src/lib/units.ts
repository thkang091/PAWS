/**
 * Pounds or kilograms. The last weigh-in's unit wins; before any weigh-in, the phone's region decides (pounds in the
 * US, Liberia and Myanmar, kilograms elsewhere), and pounds if the region cannot be read.
 */
export type WeightUnit = "kg" | "lb";

const POUND_REGIONS = new Set(["US", "LR", "MM"]);

export const regionWeightUnit = (): WeightUnit => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    const region = locale.split(/[-_]/)[1]?.toUpperCase();
    if (!region) return "lb";
    return POUND_REGIONS.has(region) ? "lb" : "kg";
  } catch {
    return "lb";
  }
};

export const preferredWeightUnit = (lastUnit: WeightUnit | null | undefined): WeightUnit => lastUnit ?? regionWeightUnit();

/** "22 lb" or "10 kg" for a kilogram figure, rounded for display. */
export const showWeight = (kg: number, unit: WeightUnit) => (unit === "lb" ? `${Math.round(kg * 2.2046)} lb` : `${kg} kg`);
