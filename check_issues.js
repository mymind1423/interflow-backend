import oracledb from 'oracledb';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
import { initializePool, getConnection, closePool } from './config/db.js';

async function check() {
    await initializePool();
    const conn = await getConnection();
    const output = {};

    console.log("--- CHECKING SETTINGS ---");
    try {
        const res = await conn.execute("SELECT column_name, data_type FROM user_tab_columns WHERE table_name = 'SETTINGS'", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        output.settingsColumns = res.rows;
    } catch (e) {
        output.settingsError = e.message;
    }

    console.log("\n--- CHECKING STUDENTS ---");
    try {
        const total = await conn.execute("SELECT COUNT(*) as CNT FROM STUDENTS", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const withNull = await conn.execute("SELECT COUNT(*) as CNT FROM STUDENTS WHERE GRADE IS NULL OR DOMAINE IS NULL", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        output.students = {
            total: total.rows[0].CNT,
            nullGradeDomaine: withNull.rows[0].CNT
        };

        const sample = await conn.execute("SELECT FULLNAME, GRADE, DOMAINE FROM STUDENTS FETCH NEXT 5 ROWS ONLY", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        output.students.sample = sample.rows;
    } catch (e) {
        output.studentsError = e.message;
    }

    console.log("\n--- CHECKING JOBS ---");
    try {
        const jobs = await conn.execute("SELECT ID, TITLE, IS_ACTIVE, COMPANY_ID FROM JOBS", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        output.allJobs = jobs.rows;

        // Check for D-money specifically
        const dmoney = await conn.execute("SELECT ID FROM COMPANIES WHERE NAME LIKE '%D-money%'", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        if (dmoney.rows.length > 0) {
            const coId = dmoney.rows[0].ID;
            const coJobs = await conn.execute("SELECT ID, TITLE, IS_ACTIVE FROM JOBS WHERE COMPANY_ID = :coId", { coId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
            output.dmoneyJobs = coJobs.rows;
        }
    } catch (e) {
        output.jobsError = e.message;
    }

    fs.writeFileSync('check_results.json', JSON.stringify(output, null, 2));
    console.log("Results written to check_results.json");

    await conn.close();
    await closePool();
}
check();
