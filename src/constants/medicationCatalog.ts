export type MedCategory =
  | "parasite"
  | "skin"
  | "pain"
  | "heart"
  | "stomach"
  | "behaviour"
  | "hormone"
  | "infection"
  | "eye"
  | "supplement";

export const MED_CATEGORIES: readonly { key: MedCategory; label: string }[] = [
  { key: "parasite", label: "Fleas & worms" },
  { key: "skin", label: "Skin & itching" },
  { key: "pain", label: "Pain & joints" },
  { key: "heart", label: "Heart" },
  { key: "stomach", label: "Stomach" },
  { key: "behaviour", label: "Anxiety" },
  { key: "hormone", label: "Hormones" },
  { key: "infection", label: "Infections" },
  { key: "eye", label: "Eyes & ears" },
  { key: "supplement", label: "Supplements" },
];

export type Medicine = {
  key: string;
  name: string;
  generic: string;
  category: MedCategory;
  purpose: string;
  form: string;
  cadence: "daily" | "monthly" | "twice-daily" | "as-needed" | "quarterly";
  also?: readonly string[];
};

export const MEDICINES: readonly Medicine[] = [
  { key: "nexgard", name: "NexGard", generic: "Afoxolaner", category: "parasite", purpose: "Fleas and ticks", form: "Chewable", cadence: "monthly" },
  { key: "bravecto", name: "Bravecto", generic: "Fluralaner", category: "parasite", purpose: "Fleas and ticks", form: "Chewable", cadence: "quarterly" },
  { key: "simparica", name: "Simparica Trio", generic: "Sarolaner", category: "parasite", purpose: "Fleas, ticks, worms", form: "Chewable", cadence: "monthly" },
  { key: "heartgard", name: "Heartgard Plus", generic: "Ivermectin", category: "parasite", purpose: "Heartworm", form: "Chewable", cadence: "monthly" },
  { key: "interceptor", name: "Interceptor Plus", generic: "Milbemycin oxime", category: "parasite", purpose: "Heartworm and worms", form: "Chewable", cadence: "monthly" },
  { key: "frontline", name: "Frontline Plus", generic: "Fipronil", category: "parasite", purpose: "Fleas and ticks", form: "Spot-on", cadence: "monthly" },
  { key: "seresto", name: "Seresto", generic: "Imidacloprid", category: "parasite", purpose: "Fleas and ticks", form: "Collar", cadence: "quarterly" },
  { key: "drontal", name: "Drontal Plus", generic: "Praziquantel", category: "parasite", purpose: "Worming", form: "Tablet", cadence: "quarterly", also: ["deworm", "tapeworm", "roundworm"] },
  { key: "panacur", name: "Panacur", generic: "Fenbendazole", category: "parasite", purpose: "Worming", form: "Granules", cadence: "daily", also: ["deworm", "giardia"] },

  { key: "apoquel", name: "Apoquel", generic: "Oclacitinib", category: "skin", purpose: "Itching and allergies", form: "Tablet", cadence: "daily", also: ["itch", "allergy", "scratching"] },
  { key: "cytopoint", name: "Cytopoint", generic: "Lokivetmab", category: "skin", purpose: "Itching and allergies", form: "Injection", cadence: "monthly", also: ["itch", "allergy"] },
  { key: "atopica", name: "Atopica", generic: "Cyclosporine", category: "skin", purpose: "Atopic dermatitis", form: "Capsule", cadence: "daily" },
  { key: "malaseb", name: "Malaseb", generic: "Miconazole", category: "skin", purpose: "Skin infections", form: "Shampoo", cadence: "as-needed", also: ["yeast", "fungal"] },

  { key: "rimadyl", name: "Rimadyl", generic: "Carprofen", category: "pain", purpose: "Pain and inflammation", form: "Chewable", cadence: "daily", also: ["nsaid", "arthritis"] },
  { key: "galliprant", name: "Galliprant", generic: "Grapiprant", category: "pain", purpose: "Arthritis pain", form: "Tablet", cadence: "daily", also: ["arthritis"] },
  { key: "previcox", name: "Previcox", generic: "Firocoxib", category: "pain", purpose: "Pain and inflammation", form: "Chewable", cadence: "daily", also: ["nsaid"] },
  { key: "meloxicam", name: "Metacam", generic: "Meloxicam", category: "pain", purpose: "Pain and inflammation", form: "Oral liquid", cadence: "daily", also: ["nsaid"] },
  { key: "gabapentin", name: "Gabapentin", generic: "Gabapentin", category: "pain", purpose: "Nerve pain and calming", form: "Capsule", cadence: "twice-daily" },
  { key: "librela", name: "Librela", generic: "Bedinvetmab", category: "pain", purpose: "Arthritis pain", form: "Injection", cadence: "monthly", also: ["arthritis"] },
  { key: "tramadol", name: "Tramadol", generic: "Tramadol", category: "pain", purpose: "Pain relief", form: "Tablet", cadence: "twice-daily" },

  { key: "vetmedin", name: "Vetmedin", generic: "Pimobendan", category: "heart", purpose: "Heart failure", form: "Chewable", cadence: "twice-daily", also: ["mitral", "murmur"] },
  { key: "furosemide", name: "Frusemide", generic: "Furosemide", category: "heart", purpose: "Fluid on the lungs", form: "Tablet", cadence: "twice-daily", also: ["lasix", "diuretic", "water tablet"] },
  { key: "benazepril", name: "Fortekor", generic: "Benazepril", category: "heart", purpose: "Heart and kidneys", form: "Tablet", cadence: "daily", also: ["ace inhibitor"] },
  { key: "spironolactone", name: "Cardalis", generic: "Spironolactone", category: "heart", purpose: "Heart failure", form: "Tablet", cadence: "daily" },

  { key: "cerenia", name: "Cerenia", generic: "Maropitant", category: "stomach", purpose: "Sickness and travel", form: "Tablet", cadence: "daily", also: ["vomiting", "nausea", "car sick"] },
  { key: "omeprazole", name: "Omeprazole", generic: "Omeprazole", category: "stomach", purpose: "Stomach acid", form: "Tablet", cadence: "daily", also: ["reflux", "ulcer"] },
  { key: "metronidazole", name: "Metronidazole", generic: "Metronidazole", category: "stomach", purpose: "Diarrhoea and gut infections", form: "Tablet", cadence: "twice-daily", also: ["flagyl", "diarrhea"] },
  { key: "prokolin", name: "Pro-Kolin", generic: "Kaolin and probiotic", category: "stomach", purpose: "Upset stomach", form: "Paste", cadence: "as-needed" },

  { key: "trazodone", name: "Trazodone", generic: "Trazodone", category: "behaviour", purpose: "Anxiety and recovery rest", form: "Tablet", cadence: "as-needed", also: ["calm", "fireworks", "vet visits"] },
  { key: "fluoxetine", name: "Reconcile", generic: "Fluoxetine", category: "behaviour", purpose: "Separation anxiety", form: "Chewable", cadence: "daily", also: ["prozac", "separation"] },
  { key: "sileo", name: "Sileo", generic: "Dexmedetomidine", category: "behaviour", purpose: "Noise fear", form: "Oral gel", cadence: "as-needed", also: ["fireworks", "thunder"] },
  { key: "clomicalm", name: "Clomicalm", generic: "Clomipramine", category: "behaviour", purpose: "Separation anxiety", form: "Tablet", cadence: "daily" },

  { key: "levothyroxine", name: "Thyforon", generic: "Levothyroxine", category: "hormone", purpose: "Underactive thyroid", form: "Tablet", cadence: "twice-daily", also: ["thyroid", "soloxine", "hypothyroid"] },
  { key: "vetoryl", name: "Vetoryl", generic: "Trilostane", category: "hormone", purpose: "Cushing's disease", form: "Capsule", cadence: "daily", also: ["cushings"] },
  { key: "insulin", name: "Caninsulin", generic: "Porcine insulin", category: "hormone", purpose: "Diabetes", form: "Injection", cadence: "twice-daily", also: ["vetsulin", "diabetes"] },
  { key: "prednisolone", name: "Prednisolone", generic: "Prednisolone", category: "hormone", purpose: "Inflammation and immune conditions", form: "Tablet", cadence: "daily", also: ["steroid", "pred"] },

  { key: "amoxiclav", name: "Synulox", generic: "Amoxicillin-clavulanate", category: "infection", purpose: "Bacterial infections", form: "Tablet", cadence: "twice-daily", also: ["clavamox", "antibiotic"] },
  { key: "cephalexin", name: "Rilexine", generic: "Cephalexin", category: "infection", purpose: "Skin infections", form: "Tablet", cadence: "twice-daily", also: ["antibiotic"] },
  { key: "doxycycline", name: "Doxycycline", generic: "Doxycycline", category: "infection", purpose: "Tick-borne infections", form: "Tablet", cadence: "daily", also: ["antibiotic", "lyme"] },
  { key: "convenia", name: "Convenia", generic: "Cefovecin", category: "infection", purpose: "Bacterial infections", form: "Injection", cadence: "as-needed", also: ["antibiotic"] },

  { key: "optixcare", name: "Optixcare", generic: "Carbomer", category: "eye", purpose: "Dry eye", form: "Gel", cadence: "twice-daily" },
  { key: "optimmune", name: "Optimmune", generic: "Cyclosporine", category: "eye", purpose: "Dry eye", form: "Eye ointment", cadence: "twice-daily", also: ["kcs"] },
  { key: "canaural", name: "Canaural", generic: "Fusidic acid", category: "eye", purpose: "Ear infections", form: "Ear drops", cadence: "twice-daily", also: ["otitis", "ear"] },
  { key: "osurnia", name: "Osurnia", generic: "Terbinafine", category: "eye", purpose: "Ear infections", form: "Ear gel", cadence: "as-needed", also: ["otitis", "ear"] },

  { key: "yumove", name: "YuMOVE", generic: "Green-lipped mussel", category: "supplement", purpose: "Joint support", form: "Chewable", cadence: "daily", also: ["joint", "glucosamine"] },
  { key: "omega", name: "Fish oil", generic: "Omega-3", category: "supplement", purpose: "Coat and joints", form: "Oil", cadence: "daily", also: ["salmon oil", "omega"] },
  { key: "probiotic", name: "Pro-Fibre", generic: "Prebiotic fibre", category: "supplement", purpose: "Gut health", form: "Powder", cadence: "daily", also: ["probiotic"] },
  { key: "renal", name: "Ipakitine", generic: "Chitosan", category: "supplement", purpose: "Kidney support", form: "Powder", cadence: "twice-daily", also: ["kidney", "renal"] },
];

export const CADENCE_LABEL: Record<Medicine["cadence"], string> = {
  daily: "Once a day",
  "twice-daily": "Twice a day",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  "as-needed": "When needed",
};

export const searchMedicines = (
  query: string,
  category: MedCategory | null,
): readonly Medicine[] => {
  const q = query.trim().toLowerCase();
  const pool = category ? MEDICINES.filter((m) => m.category === category) : MEDICINES;
  if (q.length === 0) return pool;

  const scored = pool
    .map((medicine) => {
      const name = medicine.name.toLowerCase();
      const generic = medicine.generic.toLowerCase();
      const haystack = [name, generic, medicine.purpose.toLowerCase(), ...(medicine.also ?? [])]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return null;
      const score = name.startsWith(q) ? 0 : generic.startsWith(q) ? 1 : name.includes(q) ? 2 : 3;
      return { medicine, score };
    })
    .filter((hit): hit is { medicine: Medicine; score: number } => hit !== null)
    .sort((a, b) => a.score - b.score || a.medicine.name.localeCompare(b.medicine.name));

  return scored.map((hit) => hit.medicine);
};

export const MED_DISCLAIMER =
  "Only what your vet has already prescribed. PAWS records doses, it never suggests them.";
