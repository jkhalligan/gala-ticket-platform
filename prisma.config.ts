import { defineConfig } from "@prisma/config";
import dotenv from "dotenv";

// Load environment variables from .env files
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  datasources: {
    db: {
      url: process.env.DATABASE_URL!, // MUST BE DEFINED HERE IN PRISMA 7
    },
  },
});
