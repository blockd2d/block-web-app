import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { ScreenContainer, Button } from "../components";
import { useAuthStore } from "../state/auth";
import { theme } from "../theme";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, error, setError, status } = useAuthStore();

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    try {
      await login(email.trim(), password);
    } catch {
      // error set in store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenContainer centered>
        <View style={styles.form}>
          <Text style={styles.title}>Block Labor</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={theme.colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={status !== "loading"}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={theme.colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            editable={status !== "loading"}
          />
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}
          <Button
            title={status === "loading" ? "Signing in…" : "Sign in"}
            onPress={handleSubmit}
            disabled={status === "loading"}
          />
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { width: "100%", maxWidth: 320 },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: theme.space(3)
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(2),
    paddingHorizontal: theme.space(2),
    fontSize: 16,
    marginBottom: theme.space(2),
    backgroundColor: theme.colors.bg
  },
  error: {
    color: theme.colors.error,
    marginBottom: theme.space(2),
    fontSize: 14
  }
});
