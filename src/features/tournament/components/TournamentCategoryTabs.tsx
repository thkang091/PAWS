import { SegmentedTabs } from "@/features/profile/components/SegmentedTabs";
import type { TournamentMode } from "@/services/tournamentService";

const OPTIONS = [
  { key: "online", label: "Online" },
  { key: "nearby", label: "Nearby" },
] as const;

/** Online games are played from anywhere; nearby games with players close by. */
export const TournamentCategoryTabs = ({ value, onChange }: { value: TournamentMode; onChange: (mode: TournamentMode) => void }) => (
  <SegmentedTabs options={OPTIONS} value={value} onChange={onChange} />
);
