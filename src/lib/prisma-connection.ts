import type { PoolConfig } from "pg";

function postgresHost(connectionString: string) {
  return /^postgres(?:ql)?:\/\/(?:[^@/]+@)?([^:/?]+)/i.exec(connectionString)?.[1] ?? "";
}

/** Application traffic must use the Prisma pooler. The direct host is for migrations. */
export function applicationConnectionString(connectionString: string) {
  return connectionString.replace(
    /^(postgres(?:ql)?:\/\/[^@]+@)db\.prisma\.io(?=[:/])/i,
    "$1pooled.db.prisma.io",
  );
}

export function prismaPoolConfig(connectionString: string, options?: { pooled?: boolean }): PoolConfig {
  const pooled = options?.pooled !== false;
  const resolved = pooled ? applicationConnectionString(connectionString) : connectionString;
  const host = postgresHost(resolved);
  if (host !== "db.prisma.io" && host !== "pooled.db.prisma.io") {
    return { connectionString: resolved };
  }

  return {
    connectionString: resolved,
    max: 1,
    idleTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  };
}
