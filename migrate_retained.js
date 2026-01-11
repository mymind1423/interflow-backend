import { withConnection } from "./services/coreDb.js";
import dotenv from "dotenv";

dotenv.config();

console.log("Starting migration...");

async function migrate() {
    await withConnection(async (connection) => {
        console.log("Connected to DB.");
        console.log("Checking EVALUATIONS table for IS_RETAINED column...");

        // Check if column exists
        const check = await connection.execute(
            `SELECT COUNT(*) as CNT FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'EVALUATIONS' AND COLUMN_NAME = 'IS_RETAINED'`
        );

        if (check.rows[0][0] > 0) {
            console.log("Column IS_RETAINED already exists. Skipping.");
        } else {
            console.log("Adding IS_RETAINED column...");
            await connection.execute(`ALTER TABLE EVALUATIONS ADD (IS_RETAINED NUMBER(1) DEFAULT 0)`);
            console.log("Column added successfully.");
        }

        console.log("Migration complete.");
    });
}

migrate().catch(err => console.error("Migration failed:", err));
