import { initializePool, getConnection, closePool } from "./config/db.js";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

async function check() {
    await initializePool();
    const conn = await getConnection();
    const res = await conn.execute(`SELECT COLUMN_NAME, NULLABLE, DATA_DEFAULT FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'EVALUATIONS'`);
    fs.writeFileSync("eval_schema_output.txt", JSON.stringify(res.rows, null, 2));
    await conn.close();
    await closePool();
}
check();
