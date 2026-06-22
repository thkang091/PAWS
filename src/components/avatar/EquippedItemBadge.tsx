import { Badge } from "@/components/ui/Badge";

export const EquippedItemBadge = ({ equipped }: { equipped: boolean }) =>
  equipped ? <Badge label="Equipped" tone="success" /> : null;
