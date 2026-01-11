import oracledb from "oracledb";
import { initializePool, getConnection, closePool } from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function runSelectionSimulation() {
    console.log("🚀 STARTING SELECTION SIMULATION ...");

    let conn;
    try {
        await initializePool();
        conn = await getConnection();
        console.log("✅ Connected to Oracle DB");

        // 1. Get 5 Companies (that likely have interviews)
        // We look for companies that actually HAVE interviews first to be safe
        const companyRes = await conn.execute(`
            SELECT DISTINCT C.ID, C.NAME 
            FROM COMPANIES C
            JOIN INTERVIEWS I ON C.ID = I.COMPANY_ID
            FETCH NEXT 5 ROWS ONLY
        `);

        const companies = companyRes.rows;
        if (companies.length === 0) {
            console.log("❌ No companies with interviews found. Please run 'simulate_data.js' first.");
            return;
        }

        console.log(`found ${companies.length} companies with interviews.`);

        for (const company of companies) {
            const companyId = company[0] || company.ID;
            const companyName = company[1] || company.NAME;

            console.log(`\nWorking on Company: ${companyName} (${companyId})`);

            // 2. Get All Interviews for this company
            const interviewRes = await conn.execute(
                `SELECT ID, APPLICATION_ID, COMPANY_ID, STUDENT_ID FROM INTERVIEWS WHERE COMPANY_ID = :id`,
                { id: companyId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            const allInterviews = interviewRes.rows;
            const count = allInterviews.length;
            console.log(`   -> Found ${count} interviews.`);

            if (count < 10) {
                console.log("   -> Not enough interviews to retain 10. Retaining all available.");
            }

            // 3. Select 10 Random
            const selected = shuffle(allInterviews).slice(0, 10);

            console.log(`   -> Selected ${selected.length} candidates to retain.`);

            let retainedCount = 0;
            for (const interview of selected) {
                const appId = interview.APPLICATION_ID;
                const iCid = interview.COMPANY_ID;
                const iSid = interview.STUDENT_ID;

                if (!appId) {
                    console.log(`   -> Warning: Interview ${interview.ID} has no Application ID.`);
                    continue;
                }

                // 4. Update/Insert into EVALUATIONS
                // Check if evaluation exists
                const checkEval = await conn.execute(
                    `SELECT ID FROM EVALUATIONS WHERE APPLICATION_ID = :appId`,
                    { appId }
                );

                if (checkEval.rows.length > 0) {
                    // Update
                    await conn.execute(
                        `UPDATE EVALUATIONS SET IS_RETAINED = 1, RATING = 9, COMMENTS = 'Candidat retenu (Simulation)' WHERE APPLICATION_ID = :appId`,
                        { appId }
                    );
                } else {
                    // Insert
                    const evalId = `EVAL_${Math.floor(Math.random() * 1000000000)}`;
                    await conn.execute(
                        `INSERT INTO EVALUATIONS (ID, APPLICATION_ID, COMPANY_ID, STUDENT_ID, RATING, COMMENTS, IS_RETAINED, CREATED_AT) 
                         VALUES (:id, :appId, :cid, :sid, 9, 'Candidat retenu (Simulation)', 1, SYSTIMESTAMP)`,
                        { id: evalId, appId, cid: iCid, sid: iSid }
                    );
                }
                retainedCount++;
            }
            console.log(`   -> Successfully marked ${retainedCount} candidates as RETAINED.`);
        }

        await conn.commit();
        console.log("\n✅ SELECTION SIMULATION COMPLETE!");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) { console.error(e); }
        }
        await closePool();
    }
}

runSelectionSimulation();
