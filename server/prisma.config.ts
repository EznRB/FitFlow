// Configuração única do Prisma: migrations e seed reproduzíveis, sem definição duplicada.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { getDatabaseProvider } = require("./src/config/databaseProvider.js");
const postgresql = getDatabaseProvider() === "postgresql";
if (postgresql && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
}

export default defineConfig({
  schema: postgresql ? "prisma/postgresql/schema.prisma" : "prisma/schema.prisma",
  migrations: {
    path: postgresql ? "prisma/postgresql/migrations" : "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: postgresql ? process.env["DIRECT_URL"] : process.env["DATABASE_URL"],
  },
});
