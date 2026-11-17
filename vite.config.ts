import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const clinicName = process.env.VITE_CLINIC_NAME || env.VITE_CLINIC_NAME || "Clínica Odontológica";
  const escapedClinicName = clinicName.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]!));
  return ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), {
    name: "clinic-build-identity",
    transformIndexHtml: (html: string) => html.replaceAll("Clínica Odontológica", escapedClinicName),
  }, mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  });
});
