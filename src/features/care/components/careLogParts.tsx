import {
  BugIcon,
  ClipboardTextIcon,
  DropIcon,
  FileTextIcon,
  FlaskIcon,
  HeartIcon,
  ImageSquareIcon,
  PillIcon,
  ShieldCheckIcon,
  SparkleIcon,
  StethoscopeIcon,
  SyringeIcon,
  ToothIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import type { CareKind } from "@/features/care/intel/careIntel";

export const KIND_GLYPH: Record<CareKind, PhosphorIcon> = {
  flea_tick: BugIcon,
  heartworm_prev: HeartIcon,
  deworm: PillIcon,
  brushing: SparkleIcon,
  dental_cleaning: ToothIcon,
  wellness_exam: StethoscopeIcon,
  bloodwork: DropIcon,
  urinalysis: FlaskIcon,
  fecal: FlaskIcon,
  heartworm_test: ShieldCheckIcon,
  dental_procedure: ToothIcon,
  vaccine_cert: SyringeIcon,
  imaging: ImageSquareIcon,
  vet_note: ClipboardTextIcon,
};

export const RecordGlyph = FileTextIcon;

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const thisYear = new Date().getFullYear() === y;
  return `${MONTH[m - 1]} ${d}${thisYear ? "" : `, ${y}`}`;
};
