import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchChecklistItems,
  fetchChecklistResponses,
  setChecklistResponse
} from "../lib/api";

export function useChecklistItems() {
  return useQuery({
    queryKey: ["checklist", "items"],
    queryFn: fetchChecklistItems
  });
}

export function useChecklistResponses(jobId: string | undefined) {
  return useQuery({
    queryKey: ["checklist", "responses", jobId],
    queryFn: () => fetchChecklistResponses(jobId!),
    enabled: !!jobId
  });
}

export function useSetChecklistResponse(jobId: string, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateItemId,
      isChecked
    }: {
      templateItemId: string;
      isChecked: boolean;
    }) => setChecklistResponse(jobId, templateItemId, isChecked, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist", "responses", jobId] });
    }
  });
}
