import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { api } from "./apiClient";
import { isMockMode } from "../state/auth";

export type PhotoLabel = "before" | "after" | "extra";

export async function pickImage(
  options?: { camera?: boolean; label?: PhotoLabel }
): Promise<{ uri: string; label: PhotoLabel } | null> {
  const { camera = false } = options ?? {};
  const label = options?.label ?? "extra";

  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = camera
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8
      });

  if (result.canceled || !result.assets[0]) return null;
  return { uri: result.assets[0].uri, label };
}

/**
 * Upload job photo via Block API: POST /v1/jobs/:id/photos with data_url for server-side upload.
 */
export async function uploadJobPhoto(
  jobId: string,
  uri: string,
  label: PhotoLabel,
  _userId: string
): Promise<string> {
  if (isMockMode()) {
    return Promise.resolve("mock-uploaded");
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64"
  });
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  const filename = `${Date.now()}-${label}.jpg`;

  const res = (await api.post(`/v1/jobs/${jobId}/photos`, {
    kind: label,
    filename,
    data_url: dataUrl
  })) as { ok?: boolean; storage_path?: string };

  if (!res?.ok && res?.storage_path == null) {
    throw new Error("Photo upload failed");
  }
  return res?.storage_path ?? "uploaded";
}
