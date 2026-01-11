import oracledb from 'oracledb';
import dotenv from 'dotenv';
import { initializePool, getPool, closePool } from './config/db.js';

dotenv.config();

async function check() {
    try {
        await initializePool();
        const connection = await getPool().getConnection();
        const result = await connection.execute(
            `SELECT ID, NAME, EMAIL FROM COMPANIES`
        );
        console.log("Companies:", result.rows);
        await connection.close();
    } catch (err) {
        console.error(err);
    } finally {
        try {
            await closePool();
        } catch (err) {
            console.error(err);
        }
    }
}

check();
