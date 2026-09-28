export type CategoryKey = "food" | "toys" | "furniture" | "clothes";

export type Category = {
  key: CategoryKey;
  label: string;
};

export const CATEGORIES: readonly Category[] = [
  { key: "food", label: "Pet Food" },
  { key: "toys", label: "Pet Toys" },
  { key: "furniture", label: "Furniture" },
  { key: "clothes", label: "Clothes" },
];

export type ProductKey =
  | "kibble"
  | "ball"
  | "bone"
  | "bed"
  | "bandana"
  | "recovery"
  | "flea"
  | "spray";

export type Product = {
  key: ProductKey;
  name: string;
  detail: string;
  category: CategoryKey;
  price: number;
  was?: number;
  shelf: "shop" | "pharmacy";
};

const off = (was: number, price: number) => Math.round((1 - price / was) * 100);

export const percentOff = off;
