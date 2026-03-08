import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  StyleSheet
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenContainer } from "../components";
import { useJobDetail } from "../hooks/useJobDetail";
import { useChecklistItems, useChecklistResponses, useSetChecklistResponse } from "../hooks/useChecklist";
import {
  updateJobStatus,
  LABOR_STATUSES,
  createJobNote,
  createIssueReport
} from "../lib/api";
import { useAuthStore } from "../state/auth";
import { ISSUE_TYPES } from "../types/note";
import type { RootStackParamList } from "../navigation";
import type { JobStatus } from "../types/job";
import { theme } from "../theme";

type JobDetailRoute = RouteProp<RootStackParamList, "JobDetail">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  return phone;
}

export function JobDetailScreen() {
  const route = useRoute<JobDetailRoute>();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const { jobId } = route.params;
  const userId = useAuthStore((s) => s.user?.id);
  const { data: job, isLoading, isError } = useJobDetail(jobId);
  const { data: checklistItems = [] } = useChecklistItems();
  const { data: checklistResponses = {} } = useChecklistResponses(jobId);
  const setChecklist = useSetChecklistResponse(jobId, userId ?? undefined);
  const [noteText, setNoteText] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDesc, setIssueDesc] = useState("");
  const [issueType, setIssueType] = useState<string>(ISSUE_TYPES[0]);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const statusMutation = useMutation({
    mutationFn: (status: JobStatus) => updateJobStatus(jobId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  });
  const noteMutation = useMutation({
    mutationFn: (body: string) =>
      createJobNote(jobId, body, userId!), 
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    }
  });
  const issueMutation = useMutation({
    mutationFn: () =>
      createIssueReport(jobId, userId!, {
        issue_type: issueType,
        title: issueTitle,
        description: issueDesc
      }),
    onSuccess: () => {
      setIssueTitle("");
      setIssueDesc("");
      setShowIssueForm(false);
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    }
  });

  const handleCall = () => {
    if (job?.customer_phone) {
      Linking.openURL(`tel:${formatPhone(job.customer_phone)}`);
    }
  };

  const handleText = () => {
    if (job?.customer_phone) {
      Linking.openURL(`sms:${formatPhone(job.customer_phone)}`);
    }
  };

  const handlePhotos = () => {
    navigation.navigate("PhotoCapture", { jobId });
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <Text style={{ color: theme.colors.muted }}>Loading job…</Text>
      </ScreenContainer>
    );
  }

  if (isError || !job) {
    return (
      <ScreenContainer>
        <Text style={{ color: theme.colors.error }}>
          Could not load job. You may not have access to this job, or it may have been removed.
        </Text>
      </ScreenContainer>
    );
  }

  const laborStatuses = LABOR_STATUSES as readonly JobStatus[];

  return (
    <ScreenContainer>
      <ScrollView style={styles.scroll}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusRow}>
          {laborStatuses.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusChip,
                job.status === s && styles.statusChipActive,
                statusMutation.isPending && styles.statusChipDisabled
              ]}
              onPress={() => statusMutation.mutate(s)}
              disabled={statusMutation.isPending || job.status === s}
            >
              <Text
                style={[
                  styles.statusChipText,
                  job.status === s && styles.statusChipTextActive
                ]}
              >
                {s.replace(/_/g, " ")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Customer</Text>
        <Text style={styles.customerName}>{job.customer_name || "—"}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleCall}
            disabled={!job.customer_phone}
          >
            <Text style={styles.linkText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleText}
            disabled={!job.customer_phone}
          >
            <Text style={styles.linkText}>Text</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Address</Text>
        <Text style={styles.body}>{job.address_full || job.address_short || "—"}</Text>

        <Text style={styles.sectionTitle}>Service</Text>
        <Text style={styles.body}>{job.service_name || job.service_type || "—"}</Text>
        {job.quote_summary ? (
          <Text style={[styles.body, styles.muted]}>{job.quote_summary}</Text>
        ) : null}

        {job.notes ? (
          <>
            <Text style={styles.sectionTitle}>Office notes</Text>
            <Text style={styles.body}>{job.notes}</Text>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Add note</Text>
        <TextInput
          style={styles.input}
          placeholder="Job note…"
          placeholderTextColor={theme.colors.muted}
          value={noteText}
          onChangeText={setNoteText}
          multiline
          editable={!noteMutation.isPending}
        />
        <TouchableOpacity
          style={styles.photoButton}
          onPress={() => noteText.trim() && userId && noteMutation.mutate(noteText.trim())}
          disabled={!noteText.trim() || noteMutation.isPending}
        >
          <Text style={styles.photoButtonText}>Save note</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Report issue</Text>
        {!showIssueForm ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowIssueForm(true)}>
            <Text style={styles.secondaryButtonText}>Report issue or blocker</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.issueForm}>
            <Text style={styles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.issueTypeRow}>
              {ISSUE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.issueTypeChip, issueType === t && styles.issueTypeChipActive]}
                  onPress={() => setIssueType(t)}
                >
                  <Text style={[styles.issueTypeText, issueType === t && styles.issueTypeTextActive]}>
                    {t.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Short title"
              placeholderTextColor={theme.colors.muted}
              value={issueTitle}
              onChangeText={setIssueTitle}
            />
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Details…"
              placeholderTextColor={theme.colors.muted}
              value={issueDesc}
              onChangeText={setIssueDesc}
              multiline
            />
            <View style={styles.issueActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowIssueForm(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={() => issueTitle.trim() && issueMutation.mutate()}
                disabled={!issueTitle.trim() || issueMutation.isPending}
              >
                <Text style={styles.photoButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Map</Text>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>
            Map will show property location when Mapbox is configured.
          </Text>
          {(job.latitude != null && job.longitude != null) && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps?q=${job.latitude},${job.longitude}`
                )
              }
            >
              <Text style={styles.linkText}>Open in Maps</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Checklist</Text>
        {checklistItems.length === 0 ? (
          <Text style={styles.muted}>No checklist items. Configure template in backend.</Text>
        ) : (
          checklistItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.checklistRow}
              onPress={() =>
                userId &&
                setChecklist.mutate({
                  templateItemId: item.template_item_id,
                  isChecked: !(checklistResponses[item.template_item_id] ?? false)
                })
              }
              disabled={setChecklist.isPending}
            >
              <View
                style={[
                  styles.checkbox,
                  (checklistResponses[item.template_item_id] ?? false) && styles.checkboxChecked
                ]}
              >
                {(checklistResponses[item.template_item_id] ?? false) ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : null}
              </View>
              <Text style={styles.checklistLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.sectionTitle}>Photos</Text>
        <TouchableOpacity style={styles.photoButton} onPress={handlePhotos}>
          <Text style={styles.photoButtonText}>Add / view photos</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.muted,
    marginTop: theme.space(2),
    marginBottom: 4
  },
  customerName: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  body: { fontSize: 15, color: theme.colors.text },
  muted: { color: theme.colors.muted },
  actions: { flexDirection: "row", gap: 16, marginTop: 8 },
  linkButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.chipBg,
    borderRadius: theme.radius.sm
  },
  linkText: { fontSize: 14, fontWeight: "700", color: theme.colors.primary },
  mapPlaceholder: {
    height: 160,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  mapPlaceholderText: { color: theme.colors.muted, textAlign: "center" },
  photoButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    alignItems: "center"
  },
  photoButtonText: { color: "#FFF", fontWeight: "700" },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8
  },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.chipBg
  },
  statusChipActive: { backgroundColor: theme.colors.primary },
  statusChipDisabled: { opacity: 0.6 },
  statusChipText: { fontSize: 12, fontWeight: "700", color: theme.colors.text },
  statusChipTextActive: { color: "#FFF" },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxChecked: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkmark: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  checklistLabel: { flex: 1, fontSize: 15, color: theme.colors.text },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    fontSize: 15,
    backgroundColor: theme.colors.bg,
    color: theme.colors.text
  },
  inputMultiline: { minHeight: 80 },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.chipBg,
    borderRadius: theme.radius.md,
    alignItems: "center"
  },
  secondaryButtonText: { color: theme.colors.text, fontWeight: "700" },
  issueForm: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, marginBottom: 4 },
  issueTypeRow: { marginBottom: 12 },
  issueTypeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.chipBg,
    marginRight: 8
  },
  issueTypeChipActive: { backgroundColor: theme.colors.primary },
  issueTypeText: { fontSize: 12, fontWeight: "700", color: theme.colors.text },
  issueTypeTextActive: { color: "#FFF" },
  issueActions: { flexDirection: "row", gap: 12, marginTop: 12 }
});
