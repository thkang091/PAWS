import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { runBackendHealthCheck } from "@/services/healthCheckService";

export const useBackendHealthCheck = () =>
  useQuery({
    queryKey: queryKeys.backendHealth,
    queryFn: runBackendHealthCheck,
    enabled: __DEV__,
  });
