import { useQuery } from "@tanstack/react-query";
import { fetchTodayJobs, fetchUpcomingJobs, fetchCompletedJobs } from "../lib/api";

export function useTodayJobs() {
  return useQuery({
    queryKey: ["jobs", "today"],
    queryFn: fetchTodayJobs
  });
}

export function useUpcomingJobs() {
  return useQuery({
    queryKey: ["jobs", "upcoming"],
    queryFn: fetchUpcomingJobs
  });
}

export function useCompletedJobs() {
  return useQuery({
    queryKey: ["jobs", "completed"],
    queryFn: fetchCompletedJobs
  });
}
