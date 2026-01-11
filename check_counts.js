import oracledb from "oracledb";
import dotenv from "dotenv";
import fs from "fs";
import { initializePool, getConnection, closePool } from "./config/db.js";

dotenv.config();

async function checkCounts() {
    let conn;
    try {
        await initializePool();
        conn = await getConnection();

        const counts = {};
        const tables = ['USERS', 'STUDENTS', 'COMPANIES', 'APPLICATIONS', 'INTERVIEWS', 'JOBS'];
        for (const tableName of tables) {
            const result = await conn.execute(`SELECT COUNT(*) FROM ${tableName}`);
            counts[tableName] = result.rows[0][0];
        }

        fs.writeFileSync("counts_debug.json", JSON.stringify(counts, null, 2));
        console.log("Counts written to counts_debug.json");

    } catch (err) {
        console.error("Count check failed:", err);
    } finally {
        if (conn) await conn.close();
        await closePool();
    }
}

checkCounts();
