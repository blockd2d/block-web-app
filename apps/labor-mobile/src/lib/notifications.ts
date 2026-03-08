import { Platform } from "react-native";
import { api } from "./apiClient";

/** Lazy-load expo-notifications; can throw under Hermes ("prototype of undefined"). */
function getNotifications() {
  return require("expo-notifications");
}

let handlerSet = false;
function setHandlerOnce(Notifications: Awaited<ReturnType<typeof getNotifications>>) {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });
}

export async function registerForPushNotifications(
  _userId: string
): Promise<string | null> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return null;
    setHandlerOnce(Notifications);

    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT
      });
    }

    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    try {
      await api.post("/v1/auth/me/push-token", { token });
    } catch (e) {
      console.warn("[notifications] Failed to save push token", (e as Error)?.message ?? e);
    }
    return token;
  } catch (e) {
    console.warn("[notifications] Push registration skipped:", (e as Error)?.message ?? e);
    return null;
  }
}
