import oracledb from "oracledb";
import { initializePool, getConnection, closePool } from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();

async function updateQuotas() {
    try {
        await initializePool();
        const conn = await getConnection();

        console.log("Updating JOB quotas to 50...");
        const result = await conn.execute(
            `UPDATE JOBS SET INTERVIEW_QUOTA = 50 WHERE INTERVIEW_QUOTA != 50`
        );

        await conn.commit();
        console.log(`Updated ${result.rowsAffected} jobs.`);

        await conn.close();
        await closePool();
    } catch (err) {
        console.error(err);
    }
}

updateQuotas();
