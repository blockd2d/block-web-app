export const theme = {
  colors: {
    bg: "#FFFFFF",
    surface: "#F5F5F5",
    text: "#1A1A1A",
    muted: "#6B7280",
    border: "#E5E7EB",
    primary: "#2563EB",
    success: "#059669",
    warning: "#D97706",
    error: "#DC2626",
    chipBg: "#F3F4F6"
  },
  space: (n: number) => n * 8,
  radius: {
    sm: 4,
    md: 8,
    lg: 12
  }
} as const;
