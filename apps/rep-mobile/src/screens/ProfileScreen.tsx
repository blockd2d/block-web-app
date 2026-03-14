import React from "react";
import { Text, View } from "react-native";
import { Banner, Button, Card, ScrollScreen, ScreenHeader } from "../components";
import { useQueueStore, useSessionStore, useUIStore } from "../state";
import { formatDateTime } from "../lib/format";
import { theme } from "../theme";

export function ProfileScreen() {
  const session = useSessionStore();
  const ui = useUIStore();
  const queue = useQueueStore();

  const pendingCount = queue.items.length;
  const failedCount = queue.items.filter((i) => i.lastError).length;

  return (
    <ScrollScreen>
      {!ui.isOnline && <Banner tone="warning" text="Offline: knocks/quotes will sync when online." />}
      {!!queue.lastFlushError && <Banner tone="danger" text={`Sync error: ${queue.lastFlushError}`} />}

      <ScreenHeader title="Profile" subtitle={session.me ? session.me.org.name : ""} />

      <Card style={{ marginBottom: theme.space(2) }}>
        <Text style={{ fontWeight: "900", color: theme.colors.text }}>Account</Text>

        <Text style={{ marginTop: 10, color: theme.colors.muted, fontWeight: "800" }}>Name</Text>
        <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 4 }}>{session.me?.fullName ?? "—"}</Text>

        <Text style={{ marginTop: 10, color: theme.colors.muted, fontWeight: "800" }}>Email</Text>
        <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 4 }}>{session.me?.user.email ?? "—"}</Text>

        <Text style={{ marginTop: 10, color: theme.colors.muted, fontWeight: "800" }}>Role</Text>
        <Text style={{ color: theme.colors.text, fontWeight: "900", marginTop: 4 }}>{session.me?.role ?? "—"}</Text>

        <View style={{ marginTop: theme.space(2) }}>
          <Button title="Log out" variant="secondary" onPress={() => session.logout()} />
        </View>
      </Card>

      <Card style={{ marginBottom: theme.space(2) }}>
        <Text style={{ fontWeight: "900", color: theme.colors.text }}>Sync</Text>
        <Text style={{ marginTop: 10, color: theme.colors.muted }}>Pending queue: {pendingCount}</Text>
        <Text style={{ marginTop: 4, color: theme.colors.muted }}>Failed items: {failedCount}</Text>
        <Text style={{ marginTop: 10, color: theme.colors.muted }}>
          Last successful sync: {formatDateTime(queue.lastSuccessfulFlushAt ? new Date(queue.lastSuccessfulFlushAt).toISOString() : null)}
        </Text>
        <Text style={{ marginTop: 4, color: theme.colors.muted }}>
          Last sync attempt: {formatDateTime(queue.lastFlushAt ? new Date(queue.lastFlushAt).toISOString() : null)}
        </Text>
        <Text style={{ marginTop: 10, color: theme.colors.muted }}>
          Sync runs automatically on reconnect, foreground, and periodic best-effort while active.
        </Text>
        <View style={{ marginTop: theme.space(2) }}>
          <Button title={queue.flushing ? "Syncing…" : "Sync now"} onPress={() => queue.flush("manual")} disabled={!ui.isOnline || queue.flushing || pendingCount === 0} />
        </View>
      </Card>

      {__DEV__ ? (
        <Card>
          <Text style={{ fontWeight: "900", color: theme.colors.text }}>Dev</Text>
          <Text style={{ marginTop: 10, color: theme.colors.muted }}>
            Online: {String(ui.isOnline)}
          </Text>
          <Text style={{ marginTop: 4, color: theme.colors.muted }}>
            Queue flushing: {String(queue.flushing)}
          </Text>
        </Card>
      ) : null}
    </ScrollScreen>
  );
}
