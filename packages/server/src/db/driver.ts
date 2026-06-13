import neo4j, { type Driver, type Session } from "neo4j-driver";
import { config } from "../config.js";

let driver: Driver | undefined;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
      { disableLosslessIntegers: true },
    );
  }
  return driver;
}

export function getSession(): Session {
  return getDriver().session({ database: config.neo4j.database });
}

/** Run a write/read in a session and always close it. */
export async function withSession<T>(fn: (s: Session) => Promise<T>): Promise<T> {
  const session = getSession();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

export async function verifyConnectivity(): Promise<void> {
  await getDriver().verifyConnectivity();
}

/**
 * Ensure uniqueness/existence constraints. Safe to run repeatedly. We keep a
 * single :ThreadNode label for all nodes (with a `type` property) so that
 * cross-type queries and constraints stay simple.
 */
export async function ensureSchema(): Promise<void> {
  await withSession(async (s) => {
    await s.run("CREATE CONSTRAINT threadnode_id IF NOT EXISTS FOR (n:ThreadNode) REQUIRE n.id IS UNIQUE");
    await s.run("CREATE INDEX threadnode_type IF NOT EXISTS FOR (n:ThreadNode) ON (n.type)");
  });
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = undefined;
  }
}
