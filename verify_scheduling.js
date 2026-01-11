import oracledb from "oracledb";
import { initializePool, getConnection, closePool } from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();

async function verifyInterviews() {
    try {
        await initializePool();
        const conn = await getConnection();

        console.log("Checking INTERVIEWS sample...");
        const result = await conn.execute(
            `SELECT COMPANY_ID, STUDENT_ID, DATE_TIME, ROOM FROM INTERVIEWS FETCH FIRST 20 ROWS ONLY`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.table(result.rows);

        console.log("Checking time conflicts (multiple companies at same time)...");
        const conflictCheck = await conn.execute(
            `SELECT TO_CHAR(DATE_TIME, 'YYYY-MM-DD HH24:MI') as TIME, COUNT(DISTINCT COMPANY_ID) as COMP_COUNT 
             FROM INTERVIEWS GROUP BY DATE_TIME HAVING COUNT(DISTINCT COMPANY_ID) > 1 FETCH FIRST 5 ROWS ONLY`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.table(conflictCheck.rows);

        await conn.close();
        await closePool();
    } catch (err) {
        console.error(err);
    }
}

verifyInterviews();
