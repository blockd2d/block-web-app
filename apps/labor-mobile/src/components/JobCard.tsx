import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { JobListItem } from "../types/job";
import { theme } from "../theme";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function formatWindow(start: string | null | undefined, end: string | null | undefined): string {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s === "—" && e === "—") return "—";
  if (s === "—") return e;
  if (e === "—") return s;
  return `${s} – ${e}`;
}

export function JobCard({
  job,
  onPress
}: {
  job: JobListItem;
  onPress: () => void;
}) {
  const isComplete = job.status === "complete" || job.status === "approved" || job.status === "paid";
  const isUpcoming = !isComplete && job.scheduled_start && new Date(job.scheduled_start) > new Date();
  const isInProgress = !isComplete && !isUpcoming;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.row}>
        <Text style={styles.time}>{formatWindow(job.scheduled_start, job.scheduled_end)}</Text>
        <View style={styles.badges}>
          {job.has_unsynced ? (
            <View style={[styles.badge, styles.badgeUnsynced]}>
              <Text style={styles.badgeText}>Unsynced</Text>
            </View>
          ) : null}
          {job.has_issue ? (
            <View style={[styles.badge, styles.badgeIssue]}>
              <Text style={styles.badgeText}>Issue</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {job.customer_name || job.address_short || "Job"}
      </Text>
      {(job.address_short || job.address_full) ? (
        <Text style={styles.address} numberOfLines={2}>
          {job.address_short || job.address_full}
        </Text>
      ) : null}
      {job.service_name ? (
        <Text style={styles.service} numberOfLines={1}>{job.service_name}</Text>
      ) : null}
      <View style={styles.footer}>
        <View
          style={[
            styles.statusPill,
            isComplete && styles.statusComplete,
            isInProgress && styles.statusInProgress,
            isUpcoming && styles.statusUpcoming
          ]}
        >
          <Text style={styles.statusText}>{job.status.replace(/_/g, " ")}</Text>
        </View>
        {job.crew_label ? (
          <Text style={styles.crew}>{job.crew_label}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space(2),
    marginBottom: theme.space(2),
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  time: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted
  },
  badges: { flexDirection: "row", gap: 6 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeUnsynced: { backgroundColor: theme.colors.warning },
  badgeIssue: { backgroundColor: theme.colors.error },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 4
  },
  address: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: 4
  },
  service: {
    fontSize: 13,
    color: theme.colors.muted,
    marginBottom: 8
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.chipBg
  },
  statusUpcoming: { backgroundColor: "#DBEAFE" },
  statusInProgress: { backgroundColor: "#FEF3C7" },
  statusComplete: { backgroundColor: "#D1FAE5" },
  statusText: { fontSize: 12, fontWeight: "700", color: theme.colors.text },
  crew: { fontSize: 12, color: theme.colors.muted }
});
