import { getConnection, initializePool, closePool } from "./config/db.js";

async function run() {
    let conn;
    try {
        await initializePool();
        conn = await getConnection();
        console.log("Connected to DB");

        const tables = ['NOTIFICATIONS', 'APPLICATIONS', 'JOBS', 'STUDENTS', 'TOKEN_HISTORY'];

        for (const table of tables) {
            console.log(`\n--- ${table} ---`);
            const res = await conn.execute(
                `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION, DATA_SCALE 
             FROM USER_TAB_COLUMNS 
             WHERE TABLE_NAME = :tableName`,
                { tableName: table }
            );
            for (const row of res.rows) {
                console.log(`${row[0]}: ${row[1]}(${row[2]})`);
            }
        }

    } catch (err) {
        console.error("Check failed:", err);
    } finally {
        if (conn) await conn.close();
        await closePool();
    }
}

run();
