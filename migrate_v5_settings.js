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

        console.log("Creating SETTINGS table...");
        try {
            await conn.execute(`
                CREATE TABLE SETTINGS (
                    KEY VARCHAR2(50) PRIMARY KEY,
                    VALUE VARCHAR2(4000),
                    DESCRIPTION VARCHAR2(500)
                )
            `);
            console.log("Table created.");

            // Insert initial settings
            await conn.execute(
                `INSERT INTO SETTINGS (KEY, VALUE, DESCRIPTION) VALUES (:key, :value, :desc)`,
                {
                    key: 'VALIDATION_ENABLED',
                    value: 'true',
                    desc: 'Enable or disable manual candidate validation by companies'
                }
            );
            console.log("Initial settings inserted.");

        } catch (e) {
            if (e.errorNum === 955) {
                console.log("Table SETTINGS already exists.");
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
