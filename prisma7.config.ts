import { loadAppEnv } from "./scripts/app-env.mjs";
import { defineConfig } from "prisma/config";

loadAppEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
