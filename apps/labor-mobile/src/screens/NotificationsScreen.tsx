import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { ScreenContainer } from "../components";
import { useAuthStore } from "../state/auth";
import { MOCK_NOTIFICATIONS } from "../lib/mock";
import { theme } from "../theme";

function formatNotificationDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function NotificationsScreen() {
  const authMode = useAuthStore((s) => s.authMode);
  const items = authMode === "mock" ? MOCK_NOTIFICATIONS : [];

  return (
    <ScreenContainer>
      <Text style={styles.title}>Notifications</Text>
      {items.length === 0 ? (
        <Text style={styles.placeholder}>
          Recent assignments and schedule updates will appear here.
        </Text>
      ) : (
        <ScrollView style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardDate}>{formatNotificationDate(item.date)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  placeholder: { marginTop: 8, color: theme.colors.muted },
  list: { flex: 1, marginTop: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space(2),
    marginBottom: theme.space(2),
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  cardBody: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
  cardDate: { fontSize: 12, color: theme.colors.muted, marginTop: 8 }
});
