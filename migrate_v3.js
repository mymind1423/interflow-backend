
import { withConnection } from "./services/coreDb.js";
import dotenv from "dotenv";
dotenv.config();

async function migrate() {
    console.log("Starting Migration V3...");

    await withConnection(async (conn) => {
        // ADD DATE_OF_BIRTH TO STUDENTS TABLE
        console.log("Adding DATE_OF_BIRTH to STUDENTS table...");
        try {
            await conn.execute(`ALTER TABLE STUDENTS ADD (DATE_OF_BIRTH DATE)`);
            console.log("DATE_OF_BIRTH column added.");
        } catch (e) {
            if (e.message.includes("ORA-01430")) console.log("DATE_OF_BIRTH column already exists.");
            else console.error("Error adding DATE_OF_BIRTH:", e);
        }

        await conn.commit();
    });

    console.log("Migration V3 Complete.");
}

migrate().catch(console.error);
