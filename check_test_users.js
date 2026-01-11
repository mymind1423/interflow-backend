import oracledb from "oracledb";
import dotenv from "dotenv";
import { initializePool, getConnection, closePool } from "./config/db.js";

dotenv.config();

async function checkTestUsers() {
    let conn;
    try {
        await initializePool();
        conn = await getConnection();
        const testUsers = await conn.execute(`SELECT COUNT(*) FROM USERS WHERE EMAIL LIKE '%@test.com'`);
        const simUsers = await conn.execute(`SELECT COUNT(*) FROM USERS WHERE EMAIL LIKE '%@simulation.com'`);
        console.log({
            testUsers: testUsers.rows[0][0],
            simUsers: simUsers.rows[0][0]
        });
    } catch (err) {
        console.error(err);
    } finally {
        if (conn) await conn.close();
        await closePool();
    }
}

checkTestUsers();
