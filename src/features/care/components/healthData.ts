export type CareState = "ontrack" | "attention";

export type CareArea = {
  key: string;
  label: string;
  status: string;
  detail: string;
  state: CareState;
  progress: number;
  href: string;
};

export type QuickService = {
  key: string;
  label: string;
  hint: string;
  href: string;
};

export const QUICK_SERVICES: readonly QuickService[] = [
  {
    key: "records",
    label: "Health records",
    hint: "History and a PDF for the vet",
    href: "/care/records",
  },
  {
    key: "appointment",
    label: "Book a visit",
    hint: "Your clinic, one tap",
    href: "/care/book-visit",
  },
  { key: "pharmacy", label: "Pet pharmacy", hint: "Refill meds, order supplies", href: "/care/pharmacy" },
  {
    key: "emergency",
    label: "Emergency & first aid",
    hint: "Nearest ER, poison control, first aid",
    href: "/care/emergency",
  },
];
