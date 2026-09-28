export type CatalogTreat = {
  key: string;
  name: string;
  brand: string | null;
  aliases: readonly string[];
};

const t = (key: string, name: string, brand: string | null, aliases: readonly string[] = []): CatalogTreat => ({
  key,
  name,
  brand,
  aliases,
});

export const TREAT_CATALOG: readonly CatalogTreat[] = [
  t("dentastix", "Dentastix", "Pedigree", ["dental stick", "dental chew"]),
  t("jumbone", "Jumbone", "Pedigree", ["bone"]),
  t("rodeo", "Rodeo Duos", "Pedigree"),
  t("markies", "Markies", "Pedigree", ["biscuit"]),
  t("greenies", "Greenies Dental Treats", "Greenies", ["dental chew"]),
  t("milkbone", "Milk-Bone Original Biscuits", "Milk-Bone", ["milk bone", "biscuit"]),
  t("milkbone-soft", "Milk-Bone Soft & Chewy", "Milk-Bone"),
  t("pupperoni", "Pup-Peroni", "Pup-Peroni", ["pupperoni", "meat stick"]),
  t("beggin", "Beggin' Strips", "Purina", ["beggin", "bacon strips"]),
  t("dentalife", "DentaLife Daily Oral Care", "Purina", ["dental chew"]),
  t("zukes", "Zuke's Mini Naturals", "Zuke's", ["training treat"]),
  t("bluebits", "Blue Bits Training Treats", "Blue Buffalo", ["training treat"]),
  t("wellness-puppy", "Soft Puppy Bites", "Wellness", ["puppy treat", "training treat"]),
  t("oldmother", "Old Mother Hubbard Biscuits", "Old Mother Hubbard", ["biscuit"]),
  t("whimzees", "Whimzees Dental Chews", "Whimzees", ["dental chew"]),
  t("dreambone", "DreamBone Chews", "DreamBone", ["chew"]),
  t("nylabone", "Nylabone Healthy Edibles", "Nylabone", ["chew"]),
  t("kong-easy", "KONG Easy Treat", "KONG", ["kong paste"]),
  t("kong-snacks", "KONG Snacks", "KONG"),
  t("vitakraft", "Beef Stick", "Vitakraft", ["meat stick"]),
  t("dreamies-dog", "Good Boy Chewy Twists", "Good Boy", ["chew"]),
  t("freeze-liver", "Freeze-dried liver", null, ["liver", "freeze dried"]),
  t("freeze-chicken", "Freeze-dried chicken", null, ["freeze dried"]),
  t("jerky", "Chicken jerky", null, ["jerky"]),
  t("sweet-potato", "Sweet potato chews", null, ["sweet potato"]),
  t("yak", "Himalayan yak chew", null, ["yak", "cheese chew"]),
  t("bully", "Bully stick", null, ["pizzle"]),
  t("pig-ear", "Pig ear", null, ["ear"]),
  t("antler", "Antler chew", null, ["antler"]),
  t("fish-skin", "Fish skin chews", null, ["fish"]),
  t("training", "Training treats", null, ["training"]),
  t("biscuit", "Dog biscuits", null, ["biscuit", "cookie"]),
  t("carrot", "Carrot sticks", null, ["carrot"]),
  t("apple", "Apple slices (no seeds)", null, ["apple"]),
  t("blueberries", "Blueberries", null, ["blueberry"]),
  t("banana", "Banana slices", null, ["banana"]),
  t("cucumber", "Cucumber", null),
  t("green-beans", "Green beans", null, ["beans"]),
  t("pumpkin", "Plain pumpkin", null),
  t("chicken", "Plain cooked chicken", null, ["chicken"]),
  t("egg", "Plain cooked egg", null, ["egg"]),
  t("cheese", "Cheese cube", null, ["cheese"]),
  t("peanut-butter", "Peanut butter (xylitol free)", null, ["peanut butter"]),
  t("yogurt", "Plain yogurt", null, ["yoghurt", "yogurt"]),
  t("popcorn", "Plain air-popped popcorn", null, ["popcorn"]),
  t("ice-cube", "Ice cubes", null, ["ice"]),
];

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const matchTreats = (query: string, limit = 8): readonly CatalogTreat[] => {
  const q = norm(query);
  if (q.length < 2) return [];
  const scored = TREAT_CATALOG.map((treat) => {
    const hay = [treat.name, treat.brand ?? "", ...treat.aliases].map(norm);
    const best = hay.reduce((score, field) => {
      if (field === q) return Math.max(score, 3);
      if (field.startsWith(q)) return Math.max(score, 2);
      if (field.includes(q) || q.split(" ").every((word) => field.includes(word))) return Math.max(score, 1);
      return score;
    }, 0);
    return { treat, best };
  }).filter((item) => item.best > 0);
  return scored.sort((a, b) => b.best - a.best).slice(0, limit).map((item) => item.treat);
};

export const treatLabel = (treat: { name: string; brand: string | null }) =>
  treat.brand && !treat.name.toLowerCase().includes(treat.brand.toLowerCase())
    ? `${treat.brand} ${treat.name}`
    : treat.name;
