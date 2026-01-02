
import { withConnection } from "./services/coreDb.js";
import dotenv from "dotenv";
dotenv.config();

async function migrate() {
    console.log("Starting Migration V2...");

    await withConnection(async (conn) => {
        // 1. INVITATIONS TABLE
        console.log("Creating INVITATIONS table...");
        try {
            await conn.execute(`
                CREATE TABLE INVITATIONS (
                    ID VARCHAR2(50) PRIMARY KEY,
                    COMPANY_ID VARCHAR2(50) NOT NULL,
                    STUDENT_ID VARCHAR2(50) NOT NULL,
                    JOB_ID VARCHAR2(50) NOT NULL,
                    STATUS VARCHAR2(20) DEFAULT 'PENDING',
                    MESSAGE VARCHAR2(1000),
                    CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP,
                    UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
                )
            `);
            console.log("INVITATIONS table created.");
        } catch (e) {
            if (e.message.includes("ORA-00955")) console.log("INVITATIONS table already exists.");
            else console.error("Error creating INVITATIONS:", e);
        }

        // 2. TOKEN_HISTORY TABLE
        console.log("Creating TOKEN_HISTORY table...");
        try {
            await conn.execute(`
                CREATE TABLE TOKEN_HISTORY (
                    ID VARCHAR2(50) PRIMARY KEY,
                    STUDENT_ID VARCHAR2(50) NOT NULL,
                    AMOUNT NUMBER NOT NULL,
                    REASON VARCHAR2(255),
                    CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
                )
            `);
            console.log("TOKEN_HISTORY table created.");
        } catch (e) {
            if (e.message.includes("ORA-00955")) console.log("TOKEN_HISTORY table already exists.");
            else console.error("Error creating TOKEN_HISTORY:", e);
        }

        // 3. EVALUATIONS TABLE REFACTOR
        console.log("Refactoring EVALUATIONS table...");
        try {
            // Drop old table to recreate with new schema cleanly (Data loss accepted as per plan/dev env)
            try {
                await conn.execute(`DROP TABLE EVALUATIONS CASCADE CONSTRAINTS`);
                console.log("Old EVALUATIONS table dropped.");
            } catch (e) {
                if (!e.message.includes("ORA-00942")) console.error("Error dropping EVALUATIONS:", e);
            }

            await conn.execute(`
                CREATE TABLE EVALUATIONS (
                    ID VARCHAR2(50) PRIMARY KEY,
                    APPLICATION_ID VARCHAR2(50) NOT NULL UNIQUE,
                    COMPANY_ID VARCHAR2(50) NOT NULL,
                    STUDENT_ID VARCHAR2(50) NOT NULL,
                    RATING NUMBER(2) CHECK (RATING BETWEEN 1 AND 10),
                    COMMENTS CLOB,
                    CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP,
                    UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
                )
            `);
            console.log("New EVALUATIONS table created.");
        } catch (e) {
            console.error("Error refactoring EVALUATIONS:", e);
        }

        await conn.commit();
    });

    console.log("Migration V2 Complete.");
}

migrate().catch(console.error);
