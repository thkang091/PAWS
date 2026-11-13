import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isOrganizer, organizerRegions, publishedRegions, regionRoads } from "@/services/roomService";

export const REGION_KEYS = {
  organizer: ["isOrganizer"] as const,
  admin: ["organizerRegions"] as const,
  published: ["publishedRegions"] as const,
  roads: (id: string) => ["regionRoads", id] as const,
};

/** Whether this account may manage road areas. The server checks again on every write. */
export const useOrganizer = () => useQuery({ queryKey: REGION_KEYS.organizer, queryFn: isOrganizer, staleTime: 5 * 60_000, retry: 1 });

export const useOrganizerRegions = (enabled: boolean) => useQuery({ queryKey: REGION_KEYS.admin, queryFn: organizerRegions, enabled, staleTime: 15_000 });

export const usePublishedRegions = () => useQuery({ queryKey: REGION_KEYS.published, queryFn: publishedRegions, staleTime: 60_000 });

export const useRegionRoads = (id: string | undefined, enabled = true) =>
  useQuery({ queryKey: REGION_KEYS.roads(id ?? ""), queryFn: () => regionRoads(id ?? ""), enabled: Boolean(id) && enabled, staleTime: 30_000 });

/** After any admin write: the list, the lobby picker and the region's roads all reload from the server. */
export const useRefreshRegions = () => {
  const client = useQueryClient();
  return (id?: string) =>
    Promise.all([
      client.invalidateQueries({ queryKey: REGION_KEYS.admin }),
      client.invalidateQueries({ queryKey: REGION_KEYS.published }),
      id ? client.invalidateQueries({ queryKey: REGION_KEYS.roads(id) }) : Promise.resolve(),
    ]);
};
