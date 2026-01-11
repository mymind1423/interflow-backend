
import oracledb from "oracledb";
import dotenv from "dotenv";
import { initializePool, getConnection, closePool } from "./config/db.js";

dotenv.config();

async function migrate() {
    let conn;
    try {
        await initializePool();
        conn = await getConnection();
        console.log("Connected to database.");

        console.log("Adding SOURCE to APPLICATIONS...");
        try {
            await conn.execute(`ALTER TABLE APPLICATIONS ADD SOURCE VARCHAR2(20) DEFAULT 'DIRECT'`);
            console.log("Done.");
        } catch (e) {
            if (e.errorNum === 1430) {
                console.log("Column already exists in APPLICATIONS.");
            } else {
                throw e;
            }
        }

        console.log("Adding SOURCE to INTERVIEWS...");
        try {
            await conn.execute(`ALTER TABLE INTERVIEWS ADD SOURCE VARCHAR2(20) DEFAULT 'DIRECT'`);
            console.log("Done.");
        } catch (e) {
            if (e.errorNum === 1430) {
                console.log("Column already exists in INTERVIEWS.");
            } else {
                throw e;
            }
        }

        await conn.commit();
        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        if (conn) await conn.close();
        await closePool();
    }
}

migrate();
