import oracledb from "oracledb";
import dotenv from "dotenv";
import { initializePool, getConnection, closePool } from "./config/db.js";

dotenv.config();

async function analyze() {
    let conn;
    try {
        await initializePool();
        conn = await getConnection();
        console.log("Connected to database.");

        const result = await conn.execute(`SELECT ID, NAME, EMAIL FROM COMPANIES`);
        console.log("COMPANIES:", JSON.stringify(result.rows, null, 2));

        const settingsCheck = await conn.execute(`SELECT table_name FROM user_tables WHERE table_name = 'SETTINGS'`);
        if (settingsCheck.rows.length === 0) {
            console.log("SETTINGS table does not exist.");
        } else {
            console.log("SETTINGS table exists.");
            const settingsData = await conn.execute(`SELECT * FROM SETTINGS`);
            console.log("SETTINGS DATA:", JSON.stringify(settingsData.rows, null, 2));
        }

    } catch (err) {
        console.error("Analysis failed:", err);
    } finally {
        if (conn) await conn.close();
        await closePool();
    }
}

analyze();
