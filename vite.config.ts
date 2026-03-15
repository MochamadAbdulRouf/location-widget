import { defineConfig } from "vite";
// Ganti plugin-react-swc ke plugin-react jika ingin lebih stabil di v8
// atau tetap gunakan swc tapi pastikan versinya terbaru.
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  // Tambahkan ini jika peringatan 'jsx' masih muncul
  esbuild: {
    jsx: "automatic",
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean,
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
