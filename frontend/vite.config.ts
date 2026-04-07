import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(rawBasePath?: string) {
  if (!rawBasePath || rawBasePath === "/") {
    return "/";
  }

  const trimmed = rawBasePath.endsWith("/") ? rawBasePath : `${rawBasePath}/`;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: normalizeBasePath(env.VITE_APP_BASE_PATH || "/nav/"),
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
    },
  };
});
