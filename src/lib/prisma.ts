import { PrismaClient } from "@/generated/prisma"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "node:path"

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

function resolveSqlitePath(databaseUrl: string) {
  if (databaseUrl === ":memory:" || databaseUrl === "file::memory:") {
    return ":memory:"
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL must use a sqlite file: path when using the better-sqlite3 adapter."
    )
  }

  const sqlitePath = databaseUrl.slice("file:".length)

  if (path.isAbsolute(sqlitePath)) {
    return sqlitePath
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), sqlitePath)
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db"
  const adapter = new PrismaBetterSqlite3({
    // Keep runtime access aligned with Prisma CLI/database config.
    url: resolveSqlitePath(databaseUrl),
  })

  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
