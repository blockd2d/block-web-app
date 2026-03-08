import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { ScreenContainer, Button } from "../components";
import { useAuthStore } from "../state/auth";
import { pickImage, uploadJobPhoto, type PhotoLabel } from "../lib/uploads";
import type { RootStackParamList } from "../navigation";
import { theme } from "../theme";

type Route = RouteProp<RootStackParamList, "PhotoCapture">;

const LABELS: PhotoLabel[] = ["before", "after", "extra"];

export function PhotoCaptureScreen() {
  const route = useRoute<Route>();
  const { jobId } = route.params;
  const userId = useAuthStore((s) => s.user?.id);
  const [localUris, setLocalUris] = useState<{ uri: string; label: PhotoLabel }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (label: PhotoLabel) => {
    setError(null);
    const result = await pickImage({ camera: true, label });
    if (result) setLocalUris((prev) => [...prev, result]);
  };

  const handlePickFromLibrary = async () => {
    setError(null);
    const result = await pickImage({ camera: false, label: "extra" });
    if (result) setLocalUris((prev) => [...prev, result]);
  };

  const handleUploadAll = async () => {
    if (!userId || localUris.length === 0) return;
    setUploading(true);
    setError(null);
    const failed: string[] = [];
    for (const { uri, label } of localUris) {
      try {
        await uploadJobPhoto(jobId, uri, label, userId);
      } catch (e) {
        failed.push((e as Error).message);
      }
    }
    setUploading(false);
    if (failed.length > 0) setError(failed.join("; "));
    else setLocalUris([]);
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Photos</Text>
      <Text style={styles.subtitle}>Capture or pick photos for this job.</Text>

      <View style={styles.actions}>
        {LABELS.map((label) => (
          <TouchableOpacity
            key={label}
            style={styles.captureButton}
            onPress={() => handlePick(label)}
            disabled={uploading}
          >
            <Text style={styles.captureButtonText}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.captureButton}
          onPress={handlePickFromLibrary}
          disabled={uploading}
        >
          <Text style={styles.captureButtonText}>Library</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {localUris.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Pending ({localUris.length})</Text>
          <ScrollView horizontal style={styles.thumbScroll}>
            {localUris.map((item, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri: item.uri }} style={styles.thumb} />
                <Text style={styles.thumbLabel}>{item.label}</Text>
              </View>
            ))}
          </ScrollView>
          <Button
            title={uploading ? "Uploading…" : "Upload all"}
            onPress={handleUploadAll}
            disabled={uploading}
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  subtitle: { marginTop: 4, color: theme.colors.muted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  captureButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md
  },
  captureButtonText: { color: "#FFF", fontWeight: "700" },
  error: { marginTop: 8, color: theme.colors.error, fontSize: 14 },
  sectionTitle: { marginTop: 16, fontSize: 13, fontWeight: "800", color: theme.colors.muted },
  thumbScroll: { marginTop: 8, maxHeight: 120 },
  thumbWrap: { marginRight: 12 },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  thumbLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 4 }
});
