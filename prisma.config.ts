import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

// Load environment variables from .env files
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
});
