import { getConnection } from "./config/db.js";

async function run() {
    let conn;
    try {
        conn = await getConnection();
        console.log("Connected to DB");

        // Drop existing table
        try {
            await conn.execute(`DROP TABLE NOTIFICATIONS`);
            console.log("Dropped NOTIFICATIONS table");
        } catch (err) {
            if (err.message.includes("ORA-00942")) {
                console.log("Table NOTIFICATIONS does not exist, skipping drop");
            } else {
                console.error("Drop failed:", err);
                // proceeding anyway?
            }
        }

        // Recreate Table with correct schema
        // ID should be VARCHAR2 to store UUIDs
        await conn.execute(`
        CREATE TABLE NOTIFICATIONS (
            ID VARCHAR2(50) PRIMARY KEY,
            USER_ID VARCHAR2(255) NOT NULL,
            TYPE VARCHAR2(50),
            TITLE VARCHAR2(255),
            MESSAGE VARCHAR2(1000),
            IS_READ NUMBER(1) DEFAULT 0,
            RELATED_ID VARCHAR2(255),
            CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
        )
    `);
        console.log("Created NOTIFICATIONS table with ID as VARCHAR2");

    } catch (err) {
        console.error("Fix failed:", err);
    } finally {
        if (conn) await conn.close();
    }
}

run();
