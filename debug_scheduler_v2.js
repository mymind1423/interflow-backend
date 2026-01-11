
import { initializePool, closePool } from './config/db.js';
import { withConnection } from './services/coreDb.js';
import oracledb from 'oracledb';

const START_HOUR = 8;
const START_MIN = 30;
const YEAR = 2026;
const TARGET_MONTH = 1; // February

async function run() {
    await initializePool();

    await withConnection(async (conn) => {
        const startRange = new Date(YEAR, TARGET_MONTH, 15, 0, 0, 0);
        const endRange = new Date(YEAR, TARGET_MONTH, 19, 23, 59, 59);

        console.log("Querying from:", startRange, "to", endRange);

        const res = await conn.execute(
            `SELECT ID, DATE_TIME, ROOM, STATUS, SOURCE 
             FROM INTERVIEWS 
             WHERE DATE_TIME >= :startRange AND DATE_TIME <= :endRange`,
            { startRange, endRange },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        console.log("Total Interviews Found:", res.rows.length);

        const validInterviews = res.rows.filter(r => r.STATUS !== 'CANCELLED');
        console.log("Valid Interviews:", validInterviews.length);

        const timeDist = {};
        validInterviews.forEach(r => {
            const d = new Date(r.DATE_TIME);
            const timeKey = d.toTimeString().split(' ')[0]; // HH:MM:SS
            const dateKey = `${d.getMonth() + 1}-${d.getDate()}`;
            const key = `${dateKey} ${timeKey}`;

            if (!timeDist[key]) timeDist[key] = [];
            timeDist[key].push(r.ROOM);
        });

        console.log("Time Distribution:");
        Object.keys(timeDist).sort().forEach(k => {
            console.log(`${k}: ${timeDist[k].length} interviews (${timeDist[k].join(', ')})`);
        });

        // Check for duplicates
        console.log("\nPotential Overlaps (Same Room & Time):");
        Object.entries(timeDist).forEach(([k, rooms]) => {
            if (new Set(rooms).size !== rooms.length) {
                console.log(`ALERT: ${k} has overlapping bookings! Rooms: ${rooms.join(', ')}`);
            }
        });

        const counts = {};
        res.rows.forEach(r => {
            const d = new Date(r.DATE_TIME);
            const key = `${d.getMonth()}-${d.getDate()}`;
            if (!counts[key]) counts[key] = { total: 0, cancelled: 0, valid: 0 };

            counts[key].total++;
            if (r.STATUS === 'CANCELLED') counts[key].cancelled++;
            else counts[key].valid++;

            // console.log(`[${key}] ${r.ID} - ${r.DATE_TIME} - ${r.STATUS}`);
        });

        console.log("Counts per Day:", counts);
    });

    await closePool();
}

run().catch(console.error);
