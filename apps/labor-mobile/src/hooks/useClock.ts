import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clockIn, clockOut, getTodayShiftState } from "../lib/api";

export function useTodayShiftState(userId: string | undefined) {
  return useQuery({
    queryKey: ["clock", "today", userId],
    queryFn: () => getTodayShiftState(userId!),
    enabled: !!userId
  });
}

export function useClockIn(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clockIn(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clock"] });
    }
  });
}

export function useClockOut(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clockOut(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clock"] });
    }
  });
}
