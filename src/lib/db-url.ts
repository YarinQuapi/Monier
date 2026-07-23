import type { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Use the config type PrismaMariaDb itself expects (it bundles its own copy
// of the `mariadb` package) instead of importing PoolConfig from our
// top-level `mariadb` dependency, since the two copies' types are
// structurally incompatible for strict type-checking purposes.
type PoolConfig = Exclude<ConstructorParameters<typeof PrismaMariaDb>[0], string>;

/**
 * Parses DATABASE_URL into a mariadb PoolConfig instead of handing the raw
 * string to the driver.
 *
 * Why: the `mariadb` package's own connection-string parser only accepts
 * a `mariadb://` scheme and doesn't support query-string SSL options, so a
 * standard `mysql://` URL (as used everywhere else, e.g. Prisma docs) can't
 * be passed straight through when SSL needs to be configured.
 *
 * Why SSL is forced on: this app's remote MySQL host authenticates with the
 * `sha256_password` plugin, which requires either SSL or RSA public-key
 * retrieval to exchange credentials safely. We enable SSL with a relaxed
 * (self-signed-friendly) config. If you point this at a server with a
 * trusted CA certificate, swap `rejectUnauthorized: false` for a proper
 * `ca` value instead of disabling verification.
 */
export function parseDatabaseUrl(databaseUrl: string): PoolConfig {
  const parsed = new URL(databaseUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  };
}
