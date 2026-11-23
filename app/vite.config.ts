import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Configuração do Vite para o Tauri: porta fixa, sem limpar o terminal e sem
// observar a pasta do Rust.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
