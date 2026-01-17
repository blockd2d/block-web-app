import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node20",
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  bundle: true,
  external: ["@prisma/client", "twilio"]
});
