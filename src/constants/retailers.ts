export type Retailer = {
  key: string;
  name: string;
  monogram: string;
  note: string;
  search: (term: string) => string;
};

const encode = (term: string) => encodeURIComponent(term.trim());

export const RETAILERS: readonly Retailer[] = [
  {
    key: "amazon",
    name: "Amazon",
    monogram: "AZ",
    note: "Fastest delivery",
    search: (term) => `https://www.amazon.com/s?k=${encode(term)}`,
  },
  {
    key: "chewy",
    name: "Chewy",
    monogram: "CH",
    note: "Pet specialists",
    search: (term) => `https://www.chewy.com/s?query=${encode(term)}`,
  },
  {
    key: "petco",
    name: "Petco",
    monogram: "PC",
    note: "Collect in store",
    search: (term) => `https://www.petco.com/shop/PetcoSearch?Ntt=${encode(term)}`,
  },
  {
    key: "petsmart",
    name: "PetSmart",
    monogram: "PS",
    note: "Price matching",
    search: (term) => `https://www.petsmart.com/search/?q=${encode(term)}`,
  },
];

export const SEARCH_TERM: Record<string, string> = {
  bath: "dog shampoo oatmeal soap free",
  nail_trim: "dog nail clippers scissor type",
  ear_clean: "dog ear cleaning solution",
  teeth_brush: "dog toothbrush enzymatic toothpaste",
  haircut: "dog grooming clippers quiet",
  flea_tick: "flea comb fine tooth metal",
};

