import oracledb from "oracledb";
import { withConnection } from "./services/coreDb.js";

async function migrate() {
    console.log("Starting migration: Adding Company Fields...");

    await withConnection(async (conn) => {
        // 1. Add PHONE column
        try {
            await conn.execute(`ALTER TABLE COMPANIES ADD (PHONE VARCHAR2(50))`);
            console.log("Added PHONE column.");
        } catch (e) {
            if (e.message.includes("ORA-01430")) {
                console.log("PHONE column already exists.");
            } else {
                console.error("Error adding PHONE:", e.message);
            }
        }

        // 2. Add WEBSITE column
        try {
            await conn.execute(`ALTER TABLE COMPANIES ADD (WEBSITE VARCHAR2(255))`);
            console.log("Added WEBSITE column.");
        } catch (e) {
            if (e.message.includes("ORA-01430")) {
                console.log("WEBSITE column already exists.");
            } else {
                console.error("Error adding WEBSITE:", e.message);
            }
        }

        // 3. Add DESCRIPTION column
        try {
            // Using VARCHAR2(4000) for simplicity, acts as text
            await conn.execute(`ALTER TABLE COMPANIES ADD (DESCRIPTION VARCHAR2(4000))`);
            console.log("Added DESCRIPTION column.");
        } catch (e) {
            if (e.message.includes("ORA-01430")) {
                console.log("DESCRIPTION column already exists.");
            } else {
                console.error("Error adding DESCRIPTION:", e.message);
            }
        }

        // 4. Update INTERVIEW_QUOTA
        try {
            await conn.execute(`ALTER TABLE COMPANIES MODIFY (INTERVIEW_QUOTA DEFAULT 50)`);
            console.log("Updated INTERVIEW_QUOTA default to 50.");

            // Optional: Update existing records to 50 if they were at 10 (or just set all to 50?)
            // Let's safe update: Set to 50 for everyone to grant the new quota
            const result = await conn.execute(`UPDATE COMPANIES SET INTERVIEW_QUOTA = 50`);
            console.log(`Updated ${result.rowsAffected} existing companies to 50 quota.`);
        } catch (e) {
            console.error("Error updating INTERVIEW_QUOTA:", e.message);
        }

        await conn.commit();
    });

    console.log("Migration complete.");
}

migrate().catch(console.error);
