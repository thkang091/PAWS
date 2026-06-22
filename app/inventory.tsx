import { AvatarPreview } from "@/components/avatar/AvatarPreview";
import { AvatarItemCard } from "@/components/avatar/AvatarItemCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useAvatarCatalog, useAvatarInventory, useEquipAvatarItem } from "@/hooks/useAvatarShop";
import { useCurrentDog } from "@/hooks/useCurrentDog";

export default function InventoryScreen() {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const catalog = useAvatarCatalog();
  const inventory = useAvatarInventory(dogId);
  const equip = useEquipAvatarItem(dogId);
  if (dog.isLoading || catalog.isLoading || inventory.isLoading) return <ScreenContainer centered><LoadingState message="Loading inventory..." /></ScreenContainer>;
  const owned = new Set((inventory.data?.owned ?? []).map((item) => item.avatarItemId));
  const equipped = new Set((inventory.data?.equipped ?? []).map((item) => item.avatarItemId));
  return (
    <ScreenContainer scroll>
      <SectionHeader title="Inventory" subtitle="Owned avatar items and equipped state." />
      <AvatarPreview label={dog.data?.name ?? "Your dog"} />
      {(catalog.data ?? []).filter((item) => owned.has(item.id)).map((item) => <AvatarItemCard key={item.id} item={item} owned equipped={equipped.has(item.id)} loading={equip.isPending} onPurchase={() => undefined} onEquip={() => equip.mutate(item.id)} />)}
    </ScreenContainer>
  );
}
