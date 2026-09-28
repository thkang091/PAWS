import { useState } from "react";
import { Text } from "react-native";

import { AvatarItemCard } from "@/components/avatar/AvatarItemCard";
import { AvatarPreview } from "@/components/avatar/AvatarPreview";
import { PurchaseConfirmationModal } from "@/components/avatar/PurchaseConfirmationModal";
import { WalletSummary } from "@/features/profile/components/WalletSummary";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useAvatarCatalog, useAvatarInventory, useEquipAvatarItem, usePurchaseAvatarItem } from "@/hooks/useAvatarShop";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useWallet } from "@/hooks/useWallet";
import type { AvatarItem } from "@/types/domain";

export default function AvatarShopScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const catalog = useAvatarCatalog();
  const inventory = useAvatarInventory(dogId);
  const wallet = useWallet(dogId);
  const purchase = usePurchaseAvatarItem(dogId);
  const equip = useEquipAvatarItem(dogId);
  const [selected, setSelected] = useState<AvatarItem | null>(null);
  if (dog.isLoading || catalog.isLoading || inventory.isLoading || wallet.isLoading) return <ScreenContainer centered><LoadingState message="Loading avatar shop..." /></ScreenContainer>;
  const owned = new Set((inventory.data?.owned ?? []).map((item) => item.avatarItemId));
  const equipped = new Set((inventory.data?.equipped ?? []).map((item) => item.avatarItemId));
  return (
    <ScreenContainer scroll>
      <SectionHeader title="Avatar Shop" subtitle="Spend silver only. Purchases are confirmed by secure RPC." />
      <AvatarPreview label={dog.data?.name ?? "Your dog"} />
      <WalletSummary wallet={wallet.data ?? { silverBalance: 0, goldBalance: 0 }} />
      {(catalog.data ?? []).map((item) => <AvatarItemCard key={item.id} item={item} owned={owned.has(item.id)} equipped={equipped.has(item.id)} loading={purchase.isPending || equip.isPending} onPurchase={() => setSelected(item)} onEquip={() => equip.mutate(item.id)} />)}
      {purchase.error ? <Text>{purchase.error.message}</Text> : null}
      <PurchaseConfirmationModal visible={Boolean(selected)} itemName={selected?.name ?? ""} loading={purchase.isPending} onCancel={() => setSelected(null)} onConfirm={() => selected && purchase.mutate(selected.id, { onSuccess: () => setSelected(null) })} />
    </ScreenContainer>
  );
}
