export type Place = {
  postcode: string;
  town: string;
  region: string;
  latitude: number;
  longitude: number;
};

export type Lookup =
  | { state: "idle" }
  | { state: "looking" }
  | { state: "found"; place: Place }
  | { state: "notFound" }
  | { state: "offline" };

const countryFor = (raw: string) => {
  const value = raw.trim().toUpperCase();
  if (/^\d{5}(-\d{4})?$/.test(value)) return "us";
  if (/^[A-Z]{1,2}\d/.test(value)) return "gb";
  if (/^[A-Z]\d[A-Z]/.test(value)) return "ca";
  return "us";
};

const MAX_LENGTH: Record<string, number> = { us: 9, gb: 7, ca: 6 };

const normalise = (raw: string, country: string) => {
  const value = raw.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (country === "us") return value.slice(0, 5);
  if (country === "gb") return value.slice(0, value.length > 4 ? 4 : value.length);
  return value.slice(0, 3);
};

export const lookupPostcode = async (raw: string): Promise<Lookup> => {
  const country = countryFor(raw);
  const bare = raw.trim().replace(/[\s-]+/g, "");
  if (bare.length > (MAX_LENGTH[country] ?? 9)) return { state: "notFound" };

  const code = normalise(raw, country);
  if (code.length < 3) return { state: "idle" };

  try {
    const response = await fetch(`https://api.zippopotam.us/${country}/${code}`);
    if (response.status === 404) return { state: "notFound" };
    if (!response.ok) return { state: "offline" };

    const body = (await response.json()) as {
      "post code"?: string;
      places?: {
        "place name"?: string;
        state?: string;
        latitude?: string;
        longitude?: string;
      }[];
    };

    const first = body.places?.[0];
    if (!first) return { state: "notFound" };

    return {
      state: "found",
      place: {
        postcode: body["post code"] ?? code,
        town: first["place name"] ?? "",
        region: first.state ?? "",
        latitude: Number(first.latitude ?? 0),
        longitude: Number(first.longitude ?? 0),
      },
    };
  } catch {
    return { state: "offline" };
  }
};

export const distanceKm = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) => {
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
