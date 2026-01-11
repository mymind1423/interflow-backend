import oracledb from "oracledb";
import { initializePool, getConnection, closePool } from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();

async function checkJobs() {
    try {
        await initializePool();
        const conn = await getConnection();

        console.log("Checking all JOBS status...");
        const result = await conn.execute(
            `SELECT ID, TITLE, COMPANY_ID, INTERVIEW_QUOTA, ACCEPTED_COUNT, IS_ACTIVE FROM JOBS`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const fs = await import("fs");
        fs.writeFileSync("jobs_debug.json", JSON.stringify(result.rows, null, 2));
        console.log("Job details written to jobs_debug.json");

        await conn.close();
        await closePool();
    } catch (err) {
        console.error(err);
    }
}

checkJobs();
