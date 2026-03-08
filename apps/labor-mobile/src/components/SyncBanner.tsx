import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useOfflineStore, type QueuedAction } from "../state/offline";
import { theme } from "../theme";

export function SyncBanner() {
  const queue = useOfflineStore((s: { queue: QueuedAction[] }) => s.queue);
  const pending = useMemo(
    () => queue.filter((a: QueuedAction) => a.sync_status === "pending"),
    [queue]
  );

  if (pending.length === 0) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {pending.length} change{pending.length === 1 ? "" : "s"} waiting to sync
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  text: { color: "#FFF", fontWeight: "700", fontSize: 13 }
});
