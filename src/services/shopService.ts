import { createIdempotencyKey, getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { Product, ProductKey } from "@/components/shop/shopData";

export type ShopItem = Product & { id: string };

const mapShopItem = (row: {
  id: string;
  item_key: string;
  name: string;
  detail: string;
  category: Product["category"];
  shelf: Product["shelf"];
  price_gold: number;
  was_price_gold: number | null;
}): ShopItem => ({
  id: row.id,
  key: row.item_key as ProductKey,
  name: row.name,
  detail: row.detail,
  category: row.category,
  price: row.price_gold,
  was: row.was_price_gold ?? undefined,
  shelf: row.shelf,
});

export const getShopItems = async (): Promise<ShopItem[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("shop_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  throwIfError(error);
  return (data ?? []).map(mapShopItem);
};

export type ShopPurchaseResult = { goldBalance: number };

export const purchaseShopBasket = async (
  dogId: string,
  lines: readonly { itemId: string; quantity: number }[],
): Promise<ShopPurchaseResult> => {
  const client = getClientOrThrow();
  let lastBalance = 0;

  for (const line of lines) {
    const { data, error } = await client.rpc("purchase_shop_item", {
      target_dog_id: dogId,
      target_shop_item_id: line.itemId,
      quantity_value: line.quantity,
      request_key: createIdempotencyKey("shop-item"),
    });
    throwIfError(error);
    const wallet = (data as { wallet?: { goldBalance?: number } } | null)?.wallet;
    if (typeof wallet?.goldBalance === "number") lastBalance = wallet.goldBalance;
  }

  return { goldBalance: lastBalance };
};
