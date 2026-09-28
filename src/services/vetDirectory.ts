import { distanceKm } from "@/services/postcodeService";
import { serpSearch, type Feed } from "@/services/serpApi";

export type Clinic = {
  id: string;
  name: string;
  address: string;
  distance: string | null;
  rating: number | null;
  reviews: number | null;
  openState: string | null;
  phone: string | null;
  website: string | null;
  bookOnline: string | null;
  thumbnail: string | null;
};

type Raw = {
  place_id?: string;
  title?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  open_state?: string;
  hours?: string;
  phone?: string;
  website?: string;
  book_online?: string;
  thumbnail?: string;
  serpapi_thumbnail?: string;
  photos?: Array<{ thumbnail?: string; image?: string }>;
  gps_coordinates?: { latitude?: number; longitude?: number };
};

export const findClinics = async (
  place: { latitude: number; longitude: number },
  query = "veterinarian",
): Promise<Feed<Clinic>> => {
  const pick = (body: Record<string, unknown>): readonly Clinic[] => {
    const rows = (body.local_results as Raw[] | undefined) ?? [];

    return rows
      .filter((row) => row.title)
      .map((row) => {
        const gps = row.gps_coordinates;
        const km =
          typeof gps?.latitude === "number" && typeof gps?.longitude === "number"
            ? distanceKm(place, { latitude: gps.latitude, longitude: gps.longitude })
            : null;

        return {
          id: row.place_id ?? (row.title as string),
          name: row.title as string,
          address: row.address ?? "",
          distance: km === null ? null : `${km.toFixed(1)} km`,
          km: km ?? Number.POSITIVE_INFINITY,
          rating: typeof row.rating === "number" ? row.rating : null,
          reviews: typeof row.reviews === "number" ? row.reviews : null,
          openState: row.open_state ?? row.hours ?? null,
          phone: row.phone ?? null,
          website: row.website ?? null,
          bookOnline: row.book_online ?? null,
          thumbnail: row.thumbnail ?? row.serpapi_thumbnail ?? row.photos?.[0]?.thumbnail ?? row.photos?.[0]?.image ?? null,
        };
      })
      .sort((left, right) => left.km - right.km)
      .slice(0, 8)
      .map(({ km: _km, ...clinic }) => clinic);
  };

  return serpSearch<Clinic>(
    {
      engine: "google_maps",
      q: query,
      ll: `@${place.latitude},${place.longitude},13z`,
      type: "search",
      hl: "en",
    },
    pick,
  );
};

export const CLINIC_DISCLAIMER =
  "Live results from Google Maps. Booking happens with the practice, not in PAWS. Confirm the time with them.";

export type Booking = {
  clinicId: string;
  clinicName: string;
  dayKey: string;
  day: string;
  time: string;
  phone: string | null;
  address: string | null;
  via: "online" | "phone";
};
