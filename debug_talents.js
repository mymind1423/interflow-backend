import oracledb from 'oracledb';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
import { initializePool, getConnection, closePool } from './config/db.js';

async function debugTalents() {
    await initializePool();
    const conn = await getConnection();
    const output = {};

    try {
        const dmoney = await conn.execute("SELECT ID FROM COMPANIES WHERE NAME LIKE '%D-money%'", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        if (dmoney.rows.length > 0) {
            const coId = dmoney.rows[0].ID;
            output.dmoneyId = coId;

            // Replicate the Talent Pool query
            const res = await conn.execute(`
                SELECT S.ID, S.FULLNAME as NAME, S.DOMAINE, S.GRADE
                FROM STUDENTS S
                JOIN USERS U ON S.ID = U.ID
                WHERE S.DOMAINE IS NOT NULL AND S.GRADE IS NOT NULL
                AND (SELECT COUNT(*) FROM APPLICATIONS A JOIN JOBS J ON A.JOB_ID = J.ID WHERE A.STUDENT_ID = S.ID AND J.COMPANY_ID = :coId) = 0
                ORDER BY S.FULLNAME ASC`,
                { coId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            output.talentCount = res.rows.length;
            output.talentSample = res.rows.slice(0, 10);

            // Also check how many applied to D-money
            const apps = await conn.execute(`
                SELECT COUNT(*) as CNT FROM APPLICATIONS A 
                JOIN JOBS J ON A.JOB_ID = J.ID 
                WHERE J.COMPANY_ID = :coId`,
                { coId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            output.dmoneyAppCount = apps.rows[0].CNT;

            // Total students
            const total = await conn.execute("SELECT COUNT(*) as CNT FROM STUDENTS", [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
            output.totalStudents = total.rows[0].CNT;
        } else {
            output.error = "D-money company not found";
        }
    } catch (e) {
        output.error = e.message;
    }

    fs.writeFileSync('debug_talents.json', JSON.stringify(output, null, 2));
    console.log("Results written to debug_talents.json");

    await conn.close();
    await closePool();
}
debugTalents();
