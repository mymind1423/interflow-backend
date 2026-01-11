import oracledb from 'oracledb';
import dotenv from 'dotenv';
dotenv.config();
import { initializePool, getConnection, closePool } from './config/db.js';

async function finalFix() {
    await initializePool();
    const conn = await getConnection();

    console.log("--- 1. UPDATING JOB QUOTAS ---");
    try {
        const res = await conn.execute("UPDATE JOBS SET INTERVIEW_QUOTA = 100, IS_ACTIVE = 1 WHERE INTERVIEW_QUOTA < 100 OR INTERVIEW_QUOTA IS NULL");
        console.log(`✅ Updated ${res.rowsAffected} jobs with quota 100.`);
    } catch (e) {
        console.error("❌ Error updating quotas:", e.message);
    }

    console.log("\n--- 2. ENSURING SETTINGS ---");
    const defaultSettings = [
        { key: 'VALIDATION_ENABLED', value: 'true', desc: 'Enable/Disable company validation for applications' },
        { key: 'workflow', value: JSON.stringify({ validationEnabled: true }), desc: 'Global workflow settings' }
    ];

    for (const s of defaultSettings) {
        try {
            const check = await conn.execute("SELECT COUNT(*) as CNT FROM SETTINGS WHERE KEY = :key", { key: s.key }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
            if (check.rows[0].CNT === 0) {
                // Rename 'desc' to 'descriptionVal' to avoid any keyword issues
                await conn.execute("INSERT INTO SETTINGS (KEY, VALUE, DESCRIPTION, UPDATED_AT) VALUES (:key, :val, :descriptionVal, SYSTIMESTAMP)",
                    { key: s.key, val: s.value, descriptionVal: s.desc });
                console.log(`✅ Inserted missing setting: ${s.key}`);
            } else {
                console.log(`ℹ️ Setting already exists: ${s.key}`);
            }
        } catch (e) {
            console.error(`❌ Error checking/inserting setting ${s.key}:`, e.message);
        }
    }

    await conn.commit();
    await conn.close();
    await closePool();
    console.log("\n✅ Final fix script completed.");
}
finalFix();
