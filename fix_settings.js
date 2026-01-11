import oracledb from 'oracledb';
import dotenv from 'dotenv';
dotenv.config();
import { initializePool, getConnection, closePool } from './config/db.js';

async function fix() {
    await initializePool();
    const conn = await getConnection();

    console.log("--- FIXING SETTINGS TABLE ---");
    try {
        await conn.execute("ALTER TABLE SETTINGS ADD (DESCRIPTION VARCHAR2(500))");
        console.log('✅ Added DESCRIPTION column to SETTINGS');
    } catch (e) {
        if (e.message.includes("ORA-01430")) {
            console.log('ℹ️ DESCRIPTION column already exists');
        } else {
            console.error('❌ Error adding DESCRIPTION:', e.message);
        }
    }

    try {
        // Change VALUE from CLOB to VARCHAR2(4000) if possible, 
        // but if it has data it might fail. Let's try to add it back if it's missing or wrong type.
        // Actually, let's just make sure it exists and is VARCHAR2(4000) for better compatibility with current service.
        // If it is CLOB, we might leave it, but ORA-00904 was for DESCRIPTION.
    } catch (e) { }

    await conn.commit();
    await conn.close();
    await closePool();
}
fix();
