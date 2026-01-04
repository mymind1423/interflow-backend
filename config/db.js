import oracledb from "oracledb";
import dotenv from "dotenv";
import path from 'path';

dotenv.config();

// TNS_ADMIN Setup for Thin Mode (Required for Wallet-based connections)
try {
  let configDir = process.env.TNS_ADMIN;

  // If no env var, or it's a relative path, resolve it relative to project root
  if (!configDir) {
    configDir = path.join(process.cwd(), 'wallet');
  } else if (!path.isAbsolute(configDir)) {
    configDir = path.join(process.cwd(), configDir);
  }

  // Ensure TNS_ADMIN is set so oracledb can find tnsnames.ora / cwallet.sso
  process.env.TNS_ADMIN = configDir;
  console.log(`Oracle Wallet Configured: ${configDir}`);
} catch (err) {
  console.warn("Oracle Client config warning:", err);
}

const {
  ORACLE_USER,
  ORACLE_PASSWORD,
  ORACLE_CONNECT_STRING,
} = process.env;

if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_CONNECT_STRING) {
  throw new Error("Missing Oracle credentials! Localhost defaults have been removed. check .env");
}

/**
 * Get an Oracle connection. The caller is responsible for closing it.
 */
// Connection Pool configuration
export async function initializePool() {
  try {
    await oracledb.createPool({
      user: ORACLE_USER,
      password: ORACLE_PASSWORD,
      connectString: ORACLE_CONNECT_STRING,
      poolMin: 1, // Reduced to 1 to avoid startup storm
      poolMax: 25, // Increased to handle more concurrency
      poolIncrement: 1,
      queueTimeout: 120000, // Wait up to 2 mins for a connection
    });
    console.log("Oracle Connection Pool created successfully (Max: 25).");
  } catch (err) {
    console.error("Error creating connection pool", err);
    throw err;
  }
}

export async function closePool() {
  try {
    await oracledb.getPool().close(10);
    console.log("Oracle Connection Pool closed.");
  } catch (err) {
    console.error("Error closing connection pool", err);
  }
}

/**
 * Get an Oracle connection from the default pool.
 * The caller is responsible for closing it (conn.close()).
 */
export async function getConnection() {
  try {
    // When a default pool exists, getConnection() fetches from it automatically
    const conn = await oracledb.getConnection();

    // Optional: Log pool stats (only enabled during debugging)
    const pool = oracledb.getPool();
    if (pool) {
      // console.log(`Pool Status: ${pool.connectionsInUse} in use / ${pool.connectionsOpen} open`);
    }

    return conn;
  } catch (err) {
    console.error("Oracle connection failed (POOL issue likely)", err);
    throw err;
  }
}
