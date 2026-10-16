/**
 * A photo taken outside the food check (the Feed camera) waiting to be checked. Held in memory for one hand-off:
 * the Feed sets it right before opening the check screen, and the check screen takes it once.
 */
export type PendingPhoto = { base64: string; mimeType: string; uri: string };

let pending: PendingPhoto | null = null;

export const setPendingPhoto = (photo: PendingPhoto) => {
  pending = photo;
};

export const takePendingPhoto = () => {
  const photo = pending;
  pending = null;
  return photo;
};
