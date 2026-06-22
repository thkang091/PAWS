import {
  createIdempotencyKey,
  getClientOrThrow,
  mapMoment,
  throwIfError,
} from "@/services/serviceUtils";
import type { DogMoment } from "@/types/domain";
import type { DogMomentRow, Json } from "@/types/database";

export const maxDogMomentBytes = 10 * 1024 * 1024;
export const allowedDogMomentTypes = ["image/jpeg", "image/png", "image/heic"] as const;

type SubmitMomentJson = {
  moment: DogMomentRow;
  streak: number;
};

const inferContentType = (uri: string): string => {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
};

export const uploadDogMoment = async ({
  dogId,
  ownerId,
  uri,
  fileSize,
  caption,
  localDate,
}: {
  dogId: string;
  ownerId: string;
  uri: string;
  fileSize?: number;
  caption: string | null;
  localDate: string;
}): Promise<{ moment: DogMoment; streak: number }> => {
  if (typeof fileSize === "number" && fileSize > maxDogMomentBytes) throw new Error("Dog Moment image is larger than 10 MB.");

  const client = getClientOrThrow();
  const extension = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${Date.now()}.${extension}`;
  const storagePath = `${ownerId}/${dogId}/${localDate}/${filename}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = inferContentType(uri);

  if (!allowedDogMomentTypes.includes(contentType as (typeof allowedDogMomentTypes)[number])) {
    throw new Error("Dog Moment image type is not supported.");
  }

  const upload = await client.storage.from("dog-moments").upload(storagePath, blob, {
    contentType,
    upsert: false,
  });
  throwIfError(upload.error);

  const { data, error } = await client.rpc("submit_daily_dog_moment", {
    target_dog_id: dogId,
    storage_path_value: storagePath,
    caption_value: caption,
    local_date: localDate,
    request_key: createIdempotencyKey("moment"),
  });
  throwIfError(error);
  const result = data as Json as SubmitMomentJson;

  return { moment: mapMoment(result.moment), streak: result.streak };
};

export const getDogMoments = async (dogId: string): Promise<DogMoment[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("dog_moments").select("*").eq("dog_id", dogId).order("moment_date", { ascending: false });
  throwIfError(error);

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row) => {
      const signed = await client.storage.from("dog-moments").createSignedUrl(row.storage_path, 60 * 10);
      return mapMoment(row, signed.data?.signedUrl ?? null);
    }),
  );
};

export const updateDogMomentDetails = async ({
  momentId,
  caption,
  isFavorite,
  visibility,
}: {
  momentId: string;
  caption: string | null;
  isFavorite: boolean;
  visibility: "private" | "share_link";
}): Promise<DogMoment> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("update_dog_moment_details", {
    target_moment_id: momentId,
    caption_value: caption,
    is_favorite_value: isFavorite,
    visibility_value: visibility,
  });
  throwIfError(error);
  return mapMoment(data as DogMomentRow);
};
