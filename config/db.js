import oracledb from "oracledb";
import dotenv from "dotenv";
import path from 'path';
import fs from 'fs';

dotenv.config();

console.log("--- START DB CONFIG ---");
console.log(`Node Environment: ${process.env.NODE_ENV}`);
console.log(`Current Working Directory (cwd): ${process.cwd()}`);

// TNS_ADMIN Setup for Thin Mode (Required for Wallet-based connections)
try {
    let configDir = process.env.TNS_ADMIN;
    console.log(`Initial TNS_ADMIN env var: '${configDir}'`);

    // AGGRESSIVE FIX: On Vercel (Linux), user env vars often contain local Windows paths (e.g. C:\Users...).
    // We MUST ignore these and force the local 'wallet' directory relative to the app.
    // We check for backslashes OR drive letters, OR just if we are in a /var/task environment (AWS/Vercel).
    const isWindowsPath = configDir && (configDir.includes('\\') || /^[a-zA-Z]:/.test(configDir));

    if (isWindowsPath || process.env.VERCEL) {
        console.log(`[Config] DETECTED POTENTIALLY INVALID PATH. Resetting TNS_ADMIN.`);
        configDir = path.join(process.cwd(), 'wallet');
    } else if (!configDir) {
        configDir = path.join(process.cwd(), 'wallet');
    } else if (!path.isAbsolute(configDir)) {
        configDir = path.join(process.cwd(), configDir);
    }

    // Ensure TNS_ADMIN is set so oracledb can find tnsnames.ora / cwallet.sso
    process.env.TNS_ADMIN = configDir;
    console.log(`FINAL TNS_ADMIN set to: ${configDir}`);

    // DEBUG: Check if files actually exist
    if (fs.existsSync(configDir)) {
        const files = fs.readdirSync(configDir);
        console.log(`[DEBUG] Wallet Directory Content (${files.length} files):`, files);
    } else {
        console.error(`[CRITICAL] Wallet directory DOES NOT EXIST at path: ${configDir}`);
    }

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

/*
 * POOL SINGLETON PATTERN
 * Prevents "Thundering Herd" / Race Conditions in Serverless (Vercel)
 */
let initializationPromise = null;

export async function initializePool() {
    console.log("[Pool] initializePool called...");
    // If already initializing, return the existing promise
    if (initializationPromise) {
        console.log("[Pool] Already initializing, returning existing promise.");
        return initializationPromise;
    }

    // Check if pool already exists to avoid NJS-046
    try {
        if (oracledb.getPool()) {
            console.log("[Pool] Pool already exists (oracledb.getPool() found it). Skipping create.");
            return;
        }
    } catch (e) { /* ignore NJS-047 */ }

    initializationPromise = (async () => {
        try {
            console.log(`[Pool] Creating new pool using User: ${ORACLE_USER}, ConnectString: ${ORACLE_CONNECT_STRING}`);
            await oracledb.createPool({
                user: ORACLE_USER,
                password: ORACLE_PASSWORD,
                connectString: ORACLE_CONNECT_STRING,
                poolMin: 1,
                poolMax: 10, // Keep modest for Serverless
                // poolIncrement: 1, // Default is usually fine
                queueTimeout: 60000,
            });
            console.log("Oracle Connection Pool created successfully.");
        } catch (err) {
            console.error("Error creating connection pool", err);
            initializationPromise = null; // Reset on failure so we can retry
            throw err;
        }
    })();

    return initializationPromise;
}

export async function closePool() {
    try {
        await oracledb.getPool().close(10);
        console.log("Oracle Connection Pool closed.");
    } catch (err) {
        console.error("Error closing connection pool", err);
    }
}

export async function getConnection() {
    try {
        let pool;
        try {
            pool = oracledb.getPool();
        } catch (err) { }

        if (!pool) {
            console.log("[Connection] Pool missing (Cold Start), invoking initializePool()...");
            await initializePool();
        }

        const conn = await oracledb.getConnection();
        // console.log("[Connection] Acquired connection ID:", conn._id); // Internal ID helpful for debug
        return conn;
    } catch (err) {
        console.error("Oracle connection failed:", err);
        throw err;
    }
}
