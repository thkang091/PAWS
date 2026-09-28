import { useEffect, useState } from "react";

import { findKit } from "@/services/shopSearch";
import type { Feed } from "@/services/serpApi";
import type { Offer } from "@/services/shopSearch";

export const useKitOffers = (jobKey: string, enabled: boolean): Feed<Offer> => {
  const [feed, setFeed] = useState<Feed<Offer>>({ state: "idle" });

  useEffect(() => {
    if (!enabled) return;

    let live = true;
    setFeed({ state: "loading" });
    void findKit(jobKey).then((result) => {
      if (live) setFeed(result);
    });

    return () => {
      live = false;
    };
  }, [enabled, jobKey]);

  return feed;
};
