import { useQuery } from "@tanstack/react-query";
import { fetchJobDetail } from "../lib/api";

export function useJobDetail(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJobDetail(jobId!),
    enabled: !!jobId
  });
}
