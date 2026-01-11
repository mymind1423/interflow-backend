import oracledb from "oracledb";
import dotenv from "dotenv";
import fs from "fs";
import { initializePool, getConnection, closePool } from "./config/db.js";

dotenv.config();

async function checkSchema() {
    let conn;
    try {
        await initializePool();
        conn = await getConnection();

        const schema = {};
        const tables = ['USERS', 'STUDENTS', 'COMPANIES', 'APPLICATIONS', 'INTERVIEWS', 'JOBS', 'SETTINGS'];
        for (const tableName of tables) {
            const result = await conn.execute(
                `SELECT column_name, data_type FROM user_tab_columns WHERE table_name = :tname`,
                { tname: tableName }
            );
            schema[tableName] = result.rows;
        }

        fs.writeFileSync("schema_debug.json", JSON.stringify(schema, null, 2));
        console.log("Schema written to schema_debug.json");

    } catch (err) {
        console.error("Schema check failed:", err);
    } finally {
        if (conn) await conn.close();
        await closePool();
    }
}

checkSchema();
