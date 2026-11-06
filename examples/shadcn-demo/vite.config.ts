import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Built into the Lookup site at /demo/shadcn/ (npm run build).
export default defineConfig({
  base: "/demo/shadcn/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "../../site/demo/shadcn", emptyOutDir: true },
})
