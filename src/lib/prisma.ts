import { PrismaClient } from "@/generated/prisma"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

function parseConnectionString(url: string) {
  try {
    const cleanedUrl = url.trim().replace(/^['"]|['"]$/g, "")
    const parsed = new URL(cleanedUrl)
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: parsed.username ? decodeURIComponent(parsed.username) : "root",
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      database: parsed.pathname.replace(/^\//, ""),
    }
  } catch (error) {
    console.error("Failed to parse DATABASE_URL:", error)
    return {}
  }
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment variables.")
  }

  const config = parseConnectionString(connectionString)
  const adapter = new PrismaMariaDb({
    host: config.host || "localhost",
    port: config.port || 3306,
    user: config.user || "root",
    password: config.password,
    database: config.database,
    connectionLimit: 2,
  })

  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
