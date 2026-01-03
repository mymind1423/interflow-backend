import oracledb from "oracledb";
import dotenv from "dotenv";
import path from 'path';

dotenv.config();

// Oracle Thick Mode initialization removed for Vercel compatibility (Thin Mode is default)
/*
try {
  let configDir = process.env.TNS_ADMIN;

  // If no env var, or it's a relative path, resolve it relative to project root
  if (!configDir) {
    configDir = path.join(process.cwd(), 'wallet');
  } else if (!path.isAbsolute(configDir)) {
    configDir = path.join(process.cwd(), configDir);
  }

  // Only init if directory exists to avoid crashes
  oracledb.initOracleClient({ configDir });
  console.log(`Oracle Client Initialized. Wallet: ${configDir}`);
} catch (err) {
  if (err.message.includes("NJS-009")) {
    // already initialized, ignore
  } else {
    console.error("Oracle Client init error:", err);
  }
}
*/

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
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
    });
    console.log("Oracle Connection Pool created successfully.");
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
    return await oracledb.getConnection();
  } catch (err) {
    console.error("Oracle connection failed (POOL issue likely)", err);
    throw err;
  }
}
