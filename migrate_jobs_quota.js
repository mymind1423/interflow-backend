import oracledb from "oracledb";
import { withConnection } from "./services/coreDb.js";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
    console.log("Starting migration: Updating JOBS Quota...");

    await withConnection(async (conn) => {
        // 1. Update JOBS Table Defaults
        try {
            await conn.execute(`ALTER TABLE JOBS MODIFY (INTERVIEW_QUOTA DEFAULT 50)`);
            console.log("Updated JOBS INTERVIEW_QUOTA default to 50.");
        } catch (e) {
            console.error("Error modifying JOBS default:", e.message);
        }

        // 2. Update Existing Active Jobs
        try {
            const result = await conn.execute(`UPDATE JOBS SET INTERVIEW_QUOTA = 50`);
            console.log(`Updated ${result.rowsAffected} existing jobs to 50 quota.`);
        } catch (e) {
            console.error("Error updating existing jobs:", e.message);
        }

        await conn.commit();
    });

    console.log("Migration complete.");
}

migrate().catch(console.error);
