
import { withConnection } from "./services/coreDb.js";
import { findBestSlot } from "./services/schedulerService.js";
import { randomUUID } from "crypto";

async function run() {
    await withConnection(async (conn) => {
        console.log("Starting Verification...");

        // 1. Get Test Data
        const sRes = await conn.execute(`SELECT ID FROM STUDENTS FETCH NEXT 1 ROWS ONLY`);
        const cRes = await conn.execute(`SELECT ID FROM COMPANIES FETCH NEXT 1 ROWS ONLY`);

        if (sRes.rows.length === 0 || cRes.rows.length === 0) {
            console.error("No student or company found.");
            return;
        }

        const studentId = sRes.rows[0][0];
        const companyId = cRes.rows[0][0];

        console.log(`Using Student: ${studentId}\nUsing Company: ${companyId}`);

        // 2. Clean up
        console.log("Cleaning up interviews for company...");
        const delRes = await conn.execute(`DELETE FROM INTERVIEWS WHERE COMPANY_ID = :id`, { id: companyId });
        console.log(`Deleted ${delRes.rowsAffected} interviews.`);
        await conn.commit();

        // 3. Fill 10 Applications
        console.log("--- Filling 10 Applications ---");
        for (let i = 0; i < 10; i++) {
            console.log(`Filling App ${i + 1}...`);
            try {
                const slot = await findBestSlot(conn, studentId, companyId, 'APPLICATION');
                const id = randomUUID();
                const appId = randomUUID();

                // Get a valid job ID
                const jRes = await conn.execute(`SELECT ID FROM JOBS WHERE COMPANY_ID = :id FETCH NEXT 1 ROWS ONLY`, { id: companyId });
                const jobId = jRes.rows[0] ? jRes.rows[0][0] : null;

                await conn.execute(`INSERT INTO APPLICATIONS (ID, JOB_ID, STUDENT_ID, STATUS, CREATED_AT, SOURCE) VALUES (:id, :job, :stud, 'ACCEPTED', SYSTIMESTAMP, 'DIRECT')`,
                    { id: appId, job: jobId, stud: studentId });

                await conn.execute(
                    `INSERT INTO INTERVIEWS (ID, COMPANY_ID, STUDENT_ID, APPLICATION_ID, TITLE, DATE_TIME, STATUS, SOURCE) 
                     VALUES (:id, :cid, :sid, :aid, 'Test', :dt, 'ACCEPTED', 'APPLICATION')`,
                    { id, cid: companyId, sid: studentId, aid: appId, dt: slot.startTime }
                );
                console.log(`  > Success. Slot: ${slot.startTime}`);
            } catch (e) {
                console.error(`  > Error filling app ${i + 1}:`, e.message);
                return; // Stop but don't throw
            }
        }
        await conn.commit();

        // 4. Try 11th Application (Expect Failure)
        console.log("--- Attempting 11th Application (Expect Failure) ---");
        try {
            await findBestSlot(conn, studentId, companyId, 'APPLICATION');
            console.error("FAIL: 11th Application should have failed!");
        } catch (e) {
            if (e.message.includes("Aucun créneau disponible")) {
                console.log("PASS: 11th Application blocked as expected.");
            } else {
                console.error("FAIL: Unexpected error:", e.message);
            }
        }

        // 5. Try Invitation 1
        console.log("--- Attempting Invitation 1 (Expect Success) ---");
        try {
            const slot = await findBestSlot(conn, studentId, companyId, 'INVITATION');
            console.log("PASS: Invitation 1 worked. Slot:", slot.startTime);
            const id = randomUUID();
            await conn.execute(
                `INSERT INTO INTERVIEWS (ID, COMPANY_ID, STUDENT_ID, TITLE, DATE_TIME, STATUS, SOURCE) 
                 VALUES (:id, :cid, :sid, 'Test Inv', :dt, 'ACCEPTED', 'INVITATION')`,
                { id, cid: companyId, sid: studentId, dt: slot.startTime }
            );
            await conn.commit();
        } catch (e) {
            console.error("FAIL: Invitation 1 failed:", e.message);
        }

        // 6. Try Invitation 2
        console.log("--- Attempting Invitation 2 (Expect Success) ---");
        try {
            const slot = await findBestSlot(conn, studentId, companyId, 'INVITATION');
            console.log("PASS: Invitation 2 worked. Slot:", slot.startTime);
            const id = randomUUID();
            await conn.execute(
                `INSERT INTO INTERVIEWS (ID, COMPANY_ID, STUDENT_ID, TITLE, DATE_TIME, STATUS, SOURCE) 
                 VALUES (:id, :cid, :sid, 'Test Inv', :dt, 'ACCEPTED', 'INVITATION')`,
                { id, cid: companyId, sid: studentId, dt: slot.startTime }
            );
            await conn.commit();
        } catch (e) {
            console.error("FAIL: Invitation 2 failed:", e.message);
        }

        // 7. Try Invitation 3
        console.log("--- Attempting Invitation 3 (Expect Failure) ---");
        try {
            await findBestSlot(conn, studentId, companyId, 'INVITATION');
            console.error("FAIL: Invitation 3 should have failed!");
        } catch (e) {
            if (e.message.includes("Aucun créneau disponible")) {
                console.log("PASS: Invitation 3 blocked as expected (Max 12).");
            } else {
                console.error("FAIL: Unexpected error:", e.message);
            }
        }
    });
}

run();
