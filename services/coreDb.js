import oracledb from "oracledb";
import { getConnection } from "../config/db.js";

oracledb.fetchAsString = [oracledb.CLOB];

/**
 * Executes a callback with an OracleDB connection.
 * Handles connection acquisition and release automatically.
 */
export async function withConnection(callback) {
    let conn;
    try {
        conn = await getConnection();
        const result = await callback(conn);
        return result;
    } catch (err) {
        console.error("DB Error:", err.message);
        throw err;
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (err) {
                console.error("Error closing connection:", err.message);
            }
        }
    }
}

/**
 * Normalizes a User row from DB to a clean Object.
 * Supports both Array (legacy) and Object (newer) formats.
 */
export const normalizeUser = (row) => {
    if (!row) return null;
    // Handle Oracle Object Output (UPPERCASE Keys)
    if (!Array.isArray(row)) {
        return {
            id: row.ID,
            userType: row.USER_TYPE?.toLowerCase(),
            email: row.EMAIL,
            displayName: row.DISPLAY_NAME,
            photoUrl: row.PHOTO_URL?.toLowerCase(),
            status: row.STATUS,
        };
    }
    // Fallback for Array format (Legacy support)
    return {
        id: row[0],
        userType: row[1]?.toLowerCase(),
        email: row[2],
        displayName: row[3],
        photoUrl: row[4]?.toLowerCase(),
        status: row[5],
    };
};

/**
 * LOGGING & NOTIFICATIONS CORE
 */
export async function addSystemLog(adminId, action, details) {
    return withConnection(async (conn) => {
        await conn.execute(
            `INSERT INTO SYSTEM_LOGS (ADMIN_ID, ACTION, DETAILS) VALUES (:adminId, :action, :details)`,
            { adminId, action, details: typeof details === 'string' ? details : JSON.stringify(details) }
        );
        await conn.commit();
    });
}


