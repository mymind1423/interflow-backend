
import { initializePool, closePool } from './config/db.js';
import { withConnection } from './services/coreDb.js';
import oracledb from 'oracledb';

const YEAR = 2026;
const TARGET_MONTH = 1; // February

async function run() {
    await initializePool();

    await withConnection(async (conn) => {
        const startRange = new Date(YEAR, TARGET_MONTH, 15, 0, 0, 0);
        const endRange = new Date(YEAR, TARGET_MONTH, 19, 23, 59, 59);

        console.log("Deleting interviews from:", startRange, "to", endRange);

        const res = await conn.execute(
            `DELETE FROM INTERVIEWS 
             WHERE DATE_TIME >= :startRange AND DATE_TIME <= :endRange`,
            { startRange, endRange },
            { autoCommit: true }
        );

        console.log("Deleted Rows:", res.rowsAffected);
    });

    await closePool();
}

run().catch(console.error);
