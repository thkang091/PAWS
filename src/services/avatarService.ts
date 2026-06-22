import { createIdempotencyKey, getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { AvatarItem, EquippedAvatarItem, OwnedAvatarItem, WalletSummary } from "@/types/domain";
import type { Json } from "@/types/database";

type AvatarRow = {
  id: string;
  slug: string;
  name: string;
  silver_cost: number;
  asset_key: string;
  slot_type: AvatarItem["slotType"];
  is_active: boolean;
};

const mapAvatar = (row: AvatarRow): AvatarItem => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  silverCost: row.silver_cost,
  assetKey: row.asset_key,
  slotType: row.slot_type,
  isActive: row.is_active,
});

export const getAvatarCatalog = async (): Promise<AvatarItem[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("avatar_catalog").select("*").eq("is_active", true).order("silver_cost");
  throwIfError(error);
  return ((data ?? []) as AvatarRow[]).map(mapAvatar);
};

export const getAvatarInventory = async (dogId: string): Promise<{ owned: OwnedAvatarItem[]; equipped: EquippedAvatarItem[] }> => {
  const client = getClientOrThrow();
  const [owned, equipped] = await Promise.all([
    client.from("user_avatar_items").select("*").eq("dog_id", dogId),
    client.from("user_equipped_avatar_items").select("*").eq("dog_id", dogId),
  ]);
  throwIfError(owned.error);
  throwIfError(equipped.error);
  return {
    owned: (owned.data ?? []).map((row) => ({ id: row.id, dogId: row.dog_id, avatarItemId: row.avatar_item_id })),
    equipped: (equipped.data ?? []).map((row) => ({ id: row.id, dogId: row.dog_id, slotType: row.slot_type, avatarItemId: row.avatar_item_id })),
  };
};

type PurchaseResult = {
  item: { id: string; dog_id: string; avatar_item_id: string };
  wallet: WalletSummary;
};

export const purchaseAvatarItem = async (dogId: string, avatarItemId: string): Promise<PurchaseResult> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("purchase_avatar_item", {
    target_dog_id: dogId,
    target_avatar_item_id: avatarItemId,
    request_key: createIdempotencyKey("avatar"),
  });
  throwIfError(error);
  return data as Json as PurchaseResult;
};

export const equipAvatarItem = async (dogId: string, avatarItemId: string): Promise<EquippedAvatarItem> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("equip_avatar_item", {
    target_dog_id: dogId,
    target_avatar_item_id: avatarItemId,
  });
  throwIfError(error);
  const row = data as { id: string; dog_id: string; slot_type: AvatarItem["slotType"]; avatar_item_id: string };
  return { id: row.id, dogId: row.dog_id, slotType: row.slot_type, avatarItemId: row.avatar_item_id };
};
