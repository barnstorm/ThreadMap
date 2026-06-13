import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  // Bundle the workspace schema package; keep heavy runtime deps external.
  noExternal: ["@threadmap/shared"],
  sourcemap: true,
});
