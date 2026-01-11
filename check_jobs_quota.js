import oracledb from 'oracledb';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
import { initializePool, getConnection, closePool } from './config/db.js';

async function check() {
    await initializePool();
    const conn = await getConnection();
    const output = {};

    try {
        const jobs = await conn.execute("SELECT ID, TITLE, INTERVIEW_QUOTA, ACCEPTED_COUNT, IS_ACTIVE, COMPANY_ID FROM JOBS", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        output.jobs = jobs.rows;

        const dmoney = await conn.execute("SELECT ID FROM COMPANIES WHERE NAME LIKE '%D-money%'", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        if (dmoney.rows.length > 0) {
            const coId = dmoney.rows[0].ID;
            const coJobs = await conn.execute("SELECT ID, TITLE, INTERVIEW_QUOTA, ACCEPTED_COUNT, IS_ACTIVE FROM JOBS WHERE COMPANY_ID = :coId", { coId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
            output.dmoneyJobs = coJobs.rows;
        }
    } catch (e) {
        output.error = e.message;
    }

    fs.writeFileSync('check_jobs_quota.json', JSON.stringify(output, null, 2));
    console.log("Results written to check_jobs_quota.json");

    await conn.close();
    await closePool();
}
check();
