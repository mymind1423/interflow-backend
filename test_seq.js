
import { initializePool, closePool, getConnection } from "./config/db.js";

async function runSeq() {
    try {
        await initializePool();
        console.log("Pool initialized. Testing sequential connections...");

        const times = [];
        for (let i = 0; i < 5; i++) {
            const start = Date.now();
            const conn = await getConnection();
            const dur = Date.now() - start;
            console.log(`Connection ${i + 1}: ${dur}ms`);
            times.push(dur);
            await conn.close();
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`Average connect time: ${avg}ms`);

    } catch (err) {
        console.error("Seq Test Failed:", err);
    } finally {
        await closePool();
    }
}

runSeq();
