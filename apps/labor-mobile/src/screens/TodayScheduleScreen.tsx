import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScreenContainer } from "../components";
import { JobCard } from "../components/JobCard";
import { useTodayJobs } from "../hooks/useJobs";
import type { RootStackParamList } from "../navigation";
import { theme } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TodayScheduleScreen() {
  const navigation = useNavigation<Nav>();
  const { data: jobs = [], isLoading, isError, refetch, isRefetching } = useTodayJobs();

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 20, fontWeight: "800", color: theme.colors.text }}>
        Today's Schedule
      </Text>
      <Text style={{ marginTop: 8, color: theme.colors.muted }}>
        Your assigned jobs for today.
      </Text>
      <ScrollView
        style={{ flex: 1, marginTop: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
      >
        {isLoading ? (
          <Text style={{ marginTop: 16, color: theme.colors.muted }}>Loading…</Text>
        ) : isError ? (
          <Text style={{ marginTop: 16, color: theme.colors.error }}>
            Failed to load jobs. Pull to retry.
          </Text>
        ) : jobs.length === 0 ? (
          <Text style={{ marginTop: 16, color: theme.colors.muted }}>
            No jobs scheduled for today.
          </Text>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPress={() => navigation.navigate("JobDetail", { jobId: job.id })}
            />
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
