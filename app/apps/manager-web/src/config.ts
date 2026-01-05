import { RuntimeConfigSchema } from "@block/shared";

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Record<string, any>;
  }
}

export function getConfig() {
  const raw = window.__RUNTIME_CONFIG__ ?? {};
  const parsed = RuntimeConfigSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid runtime config. Check /runtime-config.js");
  }
  return parsed.data;
}
