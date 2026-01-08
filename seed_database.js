
import oracledb from "oracledb";
import { faker } from "@faker-js/faker/locale/fr";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";

dotenv.config();

// Ensure TNS_ADMIN
try {
    let configDir = process.env.TNS_ADMIN;
    if (!configDir) {
        configDir = path.join(process.cwd(), 'wallet');
        process.env.TNS_ADMIN = configDir;
    }
} catch (e) {
    console.log("TNS config error (ignoring local dev)", e);
}

const { ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING } = process.env;

// Configuration
const CONFIG = {
    COMPANIES: 50,
    STUDENTS: 500,
    APPS_PER_STUDENT: 5,
    APPS_PER_COMPANY: 50, // Derived check: 500 * 5 / 50 = 50. Matches.
    INTERVIEW_DAYS: ['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'],
    START_HOUR: 8,
    SLOT_DURATION_MIN: 20
};

async function runSeed() {
    console.log("🌱 STARTING SEED V2 (Advanced Scheduling) ...");

    let connection;

    try {
        connection = await oracledb.getConnection({
            user: ORACLE_USER,
            password: ORACLE_PASSWORD,
            connectString: ORACLE_CONNECT_STRING
        });

        console.log("✅ Connected to Oracle DB");

        // --- 1. CLEANUP ---
        console.log("🧹 Cleaning up old test data...");
        try {
            await connection.execute(`DELETE FROM INTERVIEWS WHERE ID LIKE 'TEST_%'`);
            await connection.commit(); // Commit after each table to reduce transaction logs/locks

            await connection.execute(`DELETE FROM APPLICATIONS WHERE ID LIKE 'TEST_%'`);
            await connection.commit();

            await connection.execute(`DELETE FROM JOBS WHERE COMPANY_ID LIKE 'TEST_%'`); // Fix: JOBS use COMPANY_ID or ID? usually ID.
            await connection.commit();

            await connection.execute(`DELETE FROM JOBS WHERE ID LIKE 'TEST_%'`);
            await connection.commit();

            // For students/companies, we delete from tables then USERS
            await connection.execute(`DELETE FROM STUDENTS WHERE ID LIKE 'TEST_%'`);
            await connection.commit();

            await connection.execute(`DELETE FROM COMPANIES WHERE ID LIKE 'TEST_%'`);
            await connection.commit();

            // Finally Users
            await connection.execute(`DELETE FROM USERS WHERE ID LIKE 'TEST_%'`);
            await connection.commit();

            console.log("   -> Cleanup done.");
        } catch (cleanupErr) {
            console.warn("   -> Cleanup error (attempting to continue):", cleanupErr.message);
        }

        // --- 2. CREATE 50 COMPANIES ---
        console.log(`🏭 Creating ${CONFIG.COMPANIES} Companies...`);
        const companyIds = [];
        // const COMP_OFFSET = 200; // Reset offset to 0 for clean run

        for (let i = 0; i < CONFIG.COMPANIES; i++) {
            const id = `TEST_COMP_${i + 100}`;
            const name = faker.company.name();
            const email = `comp${i}@test.com`;

            // Insert User
            await connection.execute(
                `INSERT INTO USERS (ID, USER_TYPE, EMAIL, DISPLAY_NAME, STATUS, PHOTO_URL) 
                 VALUES (:id, 'company', :email, :name, 'approved', :photo)`,
                { id, email, name, photo: faker.image.avatar() }
            );

            // Insert Company
            await connection.execute(
                `INSERT INTO COMPANIES (ID, NAME, ADDRESS, DOMAINE, INTERVIEW_QUOTA) 
                 VALUES (:id, :name, :address, :domaine, :quota)`,
                {
                    id,
                    name,
                    address: faker.location.streetAddress(),
                    domaine: faker.helpers.arrayElement(['Tech', 'Finance', 'Logistique', 'Telecom']),
                    quota: CONFIG.APPS_PER_COMPANY // 50
                }
            );

            companyIds.push(id);
        }
        await connection.commit();

        // --- 3. CREATE JOBS (1 per Company) ---
        console.log("💼 Creating Jobs...");
        const jobIds = []; // corresponds index-wise to companyIds

        for (let i = 0; i < companyIds.length; i++) {
            const companyId = companyIds[i];
            const id = `TEST_JOB_${i + 100}`;

            const title = faker.person.jobTitle();
            await connection.execute(
                `INSERT INTO JOBS (ID, COMPANY_ID, TITLE, DESCRIPTION, LOCATION, TYPE, SALARY, CREATED_AT, IS_ACTIVE, INTERVIEW_QUOTA)
                 VALUES (:id, :companyId, :title, :description, :loc, 'CDI', :salary, SYSTIMESTAMP, 1, :quota)`,
                {
                    id,
                    companyId,
                    title,
                    description: faker.lorem.paragraph(),
                    loc: "Djibouti",
                    salary: "150k - 200k",
                    quota: CONFIG.APPS_PER_COMPANY // 50
                }
            );
            jobIds.push(id);
            // Store title for interview naming later
            if (!global.jobTitlesMap) global.jobTitlesMap = {};
            global.jobTitlesMap[id] = title;
        }
        await connection.commit();

        // --- 4. CREATE 500 STUDENTS ---
        console.log(`🎓 Creating ${CONFIG.STUDENTS} Students...`);
        const studentIds = [];
        // const STUD_OFFSET = 2000; // Reset offset

        for (let i = 0; i < CONFIG.STUDENTS; i++) {
            const id = `TEST_STUD_${i + 1000}`;
            const fullname = faker.person.fullName();
            const email = `stud${i}@test.com`;

            // Insert User
            await connection.execute(
                `INSERT INTO USERS (ID, USER_TYPE, EMAIL, DISPLAY_NAME, STATUS, PHOTO_URL) 
                 VALUES (:id, 'student', :email, :fullname, 'approved', :photo)`,
                { id, email, fullname, photo: faker.image.avatar() }
            );

            // Insert Student
            await connection.execute(
                `INSERT INTO STUDENTS (ID, FULLNAME, PHONE, DOMAINE, GRADE, TOKENS_REMAINING, MAX_TOKENS) 
                 VALUES (:id, :fullname, :phone, :domaine, :grade, 5, 5)`,
                {
                    id,
                    fullname,
                    phone: faker.phone.number().substring(0, 15),
                    domaine: faker.helpers.arrayElement(['Informatique', 'Finance', 'Marketing', 'Droit', 'Génie Civil', 'Biologie', 'Génie Électrique']),
                    grade: faker.helpers.arrayElement(['Bac', 'Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2'])
                }
            );
            studentIds.push(id);
        }
        await connection.commit();


        // --- 5. DISTRIBUTED APPLICATIONS & INTERVIEWS ---
        console.log(`🚀 Generating Applications & Interviews...`);
        console.log(`   Logic: 50 Companies, each gets 50 Apps. 500 Students, each sends 5 Apps.`);

        let totalInterviews = 0;

        // Scheduling State per Company
        // companySchedules[companyIndex] = { dateIdx: 0, slotIdx: 0 }
        const companySchedules = new Array(CONFIG.COMPANIES).fill(0).map(() => ({ dateIdx: 0, slotIdx: 0 }));

        // Distribution Strategy:
        // We group students into batches of 10.
        // Batch 0 (Stud 0-9) -> Companies 0-4
        // Batch 1 (Stud 10-19) -> Companies 5-9
        // ...
        // Batch 49 (Stud 490-499) -> Companies 45-49
        // Batch 50 (Wait, 500 students / 10 = 50 batches. 0 to 49.)
        // Oops, Companies array size is 50.
        // Batch 0 -> Comp 0-4.
        // Batch 1 -> Comp 5-9.
        // ...
        // Batch 9 -> Comp 45-49.
        // Batch 10 -> Comp 0-4 (Reuse!).
        // This ensures every company gets visited by 5 batches.
        // 5 batches * 10 students = 50 students per company. EXACTLY.

        const BATCH_SIZE = 10;
        const COMPANY_GROUP_SIZE = 5; // Each student applies to 5 companies

        for (let batchIdx = 0; batchIdx < (CONFIG.STUDENTS / BATCH_SIZE); batchIdx++) {

            // Determine which companies this batch targets
            // 50 batches total. 
            // Company Groups cycle every 10 batches (since 50 companies / 5 per group = 10 groups)
            const companyGroupIdx = batchIdx % (CONFIG.COMPANIES / COMPANY_GROUP_SIZE);
            const startCompIdx = companyGroupIdx * COMPANY_GROUP_SIZE;
            // e.g. batch 0 -> group 0 -> comp 0-4
            // e.g. batch 10 -> group 0 -> comp 0-4

            // Students in this batch
            const startStudIdx = batchIdx * BATCH_SIZE;
            const endStudIdx = startStudIdx + BATCH_SIZE;

            for (let s = startStudIdx; s < endStudIdx; s++) {
                const studentId = studentIds[s];

                // Apply to the 5 companies in the target group
                for (let c = 0; c < COMPANY_GROUP_SIZE; c++) {
                    const compIdx = startCompIdx + c;
                    const companyId = companyIds[compIdx];
                    const jobId = jobIds[compIdx];

                    const appId = `TEST_APP_${s}_${c}`; // Deterministic ID

                    // 1. Create Application (ACCEPTED)
                    const appDate = new Date();
                    appDate.setDate(appDate.getDate() - Math.floor(Math.random() * 5));

                    await connection.execute(
                        `INSERT INTO APPLICATIONS (ID, JOB_ID, STUDENT_ID, STATUS, CREATED_AT)
                         VALUES (:id, :jobId, :studentId, 'ACCEPTED', :createdAt)`,
                        { id: appId, jobId, studentId, createdAt: appDate }
                    );

                    // 2. Schedule Interview
                    // Get next slot for this company
                    const sched = companySchedules[compIdx];

                    // Safety check if overflow (shouldn't happen with 50 limit)
                    if (sched.dateIdx >= CONFIG.INTERVIEW_DAYS.length) {
                        console.warn(`⚠️ Company ${compIdx} overflowed schedule!`);
                        continue;
                    }

                    const dayStr = CONFIG.INTERVIEW_DAYS[sched.dateIdx];
                    // Create Date object for 8:00 AM + slotIdx * 20min
                    // Note: 'dayStr' is YYYY-MM-DD.
                    const interviewDate = new Date(`${dayStr}T08:00:00`);
                    interviewDate.setMinutes(interviewDate.getMinutes() + (sched.slotIdx * CONFIG.SLOT_DURATION_MIN));

                    const interviewId = `TEST_INT_${s}_${c}`;

                    const jobTitle = global.jobTitlesMap[jobId] || "PFE";
                    await connection.execute(
                        `INSERT INTO INTERVIEWS (ID, COMPANY_ID, STUDENT_ID, APPLICATION_ID, TITLE, DATE_TIME, STATUS, ROOM)
                         VALUES (:id, :cid, :sid, :aid, :title, :dt, 'ACCEPTED', :room)`,
                        {
                            id: interviewId,
                            cid: companyId,
                            sid: studentId,
                            aid: appId,
                            title: `Entretien: ${jobTitle}`,
                            dt: interviewDate,
                            room: `Salle ${(sched.slotIdx % 5) + 1}`
                        }
                    );

                    totalInterviews++;

                    // Advance Schedule Pointer
                    // We need 10 slots per day to fit 50 interviews in 5 days.
                    // 10 slots * 5 days = 50.
                    sched.slotIdx++;
                    if (sched.slotIdx >= 10) { // 10 slots per day (8:00 - 11:20)
                        sched.slotIdx = 0;
                        sched.dateIdx++;
                    }
                }
            }

            if (batchIdx % 5 === 0) console.log(`   ... Processed Batch ${batchIdx}/${CONFIG.STUDENTS / BATCH_SIZE} (${totalInterviews} interviews)`);
        }

        await connection.commit();

        console.log("✅ SEED V2 COMPLETE !");
        console.log(`- ${CONFIG.COMPANIES} Companies`);
        console.log(`- ${CONFIG.STUDENTS} Students`);
        console.log(`- ${totalInterviews} Interviews Created (Target: 2500)`);

    } catch (err) {
        console.error("❌ Seed Error:", err);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error closing connection", err);
            }
        }
    }
}

runSeed();
