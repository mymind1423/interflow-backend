import oracledb from "oracledb";
import { faker } from "@faker-js/faker/locale/fr";
import dotenv from "dotenv";
import { initializePool, getConnection, closePool } from "./config/db.js";

dotenv.config();

const CONFIG = {
    STUDENTS_TO_CREATE: 250,
    INTERVIEW_DAYS: ['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'],
    START_HOUR: 8,
    START_MINUTE: 0,
    SLOT_DURATION_MIN: 20,
    SLOTS_PER_DAY: 12,
    INTERVIEW_QUOTA: 50
};

async function runSimulation() {
    console.log("🚀 STARTING SIMULATION (Parallel Disable Version) ...");

    let conn;
    try {
        await initializePool();
        conn = await getConnection();
        console.log("✅ Connected to Oracle DB");

        // Disable Parallel DML to avoid ORA-12860
        console.log("🛠 Disabling Parallel DML for session...");
        await conn.execute(`ALTER SESSION DISABLE PARALLEL DML`);

        // --- 1. CLEANUP ---
        console.log("🧹 Cleaning up transactional data...");
        const tablesToClear = ['INTERVIEWS', 'NOTIFICATIONS', 'APPLICATIONS', 'INVITATIONS', 'SAVED_JOBS'];
        for (const table of tablesToClear) {
            try {
                await conn.execute(`DELETE FROM ${table}`);
                console.log(`   -> ${table} cleared.`);
            } catch (e) {
                console.warn(`   -> Warning clearing ${table}: ${e.message}`);
            }
        }
        await conn.commit();

        console.log("🧹 Deleting old data (@test.com and @simulation.com)...");
        await conn.execute(`DELETE FROM STUDENTS WHERE ID IN (SELECT ID FROM USERS WHERE EMAIL LIKE '%@test.com' OR EMAIL LIKE '%@simulation.com')`);
        await conn.execute(`DELETE FROM COMPANIES WHERE ID IN (SELECT ID FROM USERS WHERE EMAIL LIKE '%@test.com' OR EMAIL LIKE '%@simulation.com')`);
        const delUsers = await conn.execute(`DELETE FROM USERS WHERE EMAIL LIKE '%@test.com' OR EMAIL LIKE '%@simulation.com'`);
        console.log(`   -> Removed ${delUsers.rowsAffected} users.`);
        await conn.commit();

        // --- 2. IDENTIFY TARGET COMPANIES ---
        const allCompsResult = await conn.execute(`SELECT ID, NAME FROM COMPANIES`);
        let djiboutiTelecom = allCompsResult.rows.find(r => (r[1] || r.NAME || "").toLowerCase().includes("djibouti telecom"));

        if (!djiboutiTelecom) {
            console.log("⚠️ Djibouti Telecom not found. Creating it...");
            const id = 'DJIB_TELECOM_ID';
            const name = 'Djibouti Telecom';
            const email = 'contact@dep.dj';
            await conn.execute(
                `INSERT INTO USERS (ID, USER_TYPE, EMAIL, DISPLAY_NAME, STATUS) VALUES (:id, 'company', :email, :name, 'approved')`,
                { id, email, name }
            );
            await conn.execute(
                `INSERT INTO COMPANIES (ID, NAME, DOMAINE) VALUES (:id, :name, 'Telecom')`,
                { id, name }
            );
            djiboutiTelecom = [id, name];
        }

        const targetCompanies = [djiboutiTelecom];
        const otherComps = allCompsResult.rows
            .filter(r => (r[0] || r.ID) !== (djiboutiTelecom[0] || djiboutiTelecom.ID))
            .filter(r => !(r[1] || r.NAME || "").toLowerCase().includes("test"))
            .slice(0, 4);

        targetCompanies.push(...otherComps);
        const companyIds = targetCompanies.map(c => c[0] || c.ID);

        // Jobs Check
        for (const cid of companyIds) {
            const jobCheck = await conn.execute(`SELECT ID FROM JOBS WHERE COMPANY_ID = :cid`, { cid });
            if (jobCheck.rows.length === 0) {
                await conn.execute(
                    `INSERT INTO JOBS (ID, COMPANY_ID, TITLE, DESCRIPTION, LOCATION, IS_ACTIVE, SOURCE, INTERVIEW_QUOTA)
                     VALUES (:id, :cid, 'Simulation Job', 'Job created for simulation', 'Djibouti', 1, 'DIRECT', 50)`,
                    { id: `JOB_SIM_${cid}`, cid }
                );
            }
        }
        await conn.commit();

        // --- 3. CREATE STUDENTS ---
        const studentIds = [];
        const grades = ['Licence', 'Master'];
        const domains = ['Informatique', 'Gestion des Entreprises', 'Génie Civil', 'Télécommunications', 'Banque & Finance', 'Logistique & Transport'];
        const faculties = ['Université de Djibouti - FSI', 'Université de Djibouti - FDEG', 'IUT de Djibouti', 'ENSAD', 'ISCA'];

        for (let i = 0; i < CONFIG.STUDENTS_TO_CREATE; i++) {
            const id = `SIM_STUD_${i}`;
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();
            const name = `${firstName} ${lastName}`;
            const email = `student_${i}@simulation.com`;
            const grade = faker.helpers.arrayElement(grades);
            const domain = faker.helpers.arrayElement(domains);
            const phone = faker.phone.number();
            const address = faker.location.streetAddress();
            const faculty = faker.helpers.arrayElement(faculties);
            const dob = faker.date.birthdate({ min: 18, max: 25, mode: 'age' });
            const photoUrl = `https://i.pravatar.cc/150?u=${id}`;
            const cvUrl = `https://example.com/cv/${id}.pdf`;
            const diplomaUrl = `https://example.com/diploma/${id}.pdf`;

            await conn.execute(
                `INSERT INTO USERS (ID, USER_TYPE, EMAIL, DISPLAY_NAME, PHOTO_URL, STATUS) 
                 VALUES (:id, 'student', :email, :name, :photoUrl, 'approved')`,
                { id, email, name, photoUrl }
            );

            await conn.execute(
                `INSERT INTO STUDENTS (ID, FULLNAME, PHONE, ADDRESS, DOMAINE, GRADE, CV_URL, DIPLOMA_URL, FACULTY, TOKENS_REMAINING, MAX_TOKENS, TOKENS_TOTAL, TOKENS_ENGAGED, TOKENS_CONSUMED, DATE_OF_BIRTH) 
                 VALUES (:id, :name, :phone, :address, :domain, :grade, :cvUrl, :diplomaUrl, :faculty, 20, 20, 20, 0, 0, :dob)`,
                { id, name, phone, address, domain, grade, cvUrl, diplomaUrl, faculty, dob }
            );

            studentIds.push(id);
            if (i % 50 === 0) {
                await conn.commit();
                console.log(`   Processed ${i} students...`);
            }
        }
        await conn.commit();

        // --- 4. APPS & INTERVIEWS ---
        const studentsPerCompany = 50;
        for (let c = 0; c < companyIds.length; c++) {
            const companyId = companyIds[c];
            const companyName = targetCompanies[c][1] || targetCompanies[c].NAME || "";
            const isDjibouti = companyName.toLowerCase().includes("djibouti telecom");
            const jobIdRes = await conn.execute(`SELECT ID FROM (SELECT ID FROM JOBS WHERE COMPANY_ID = :companyId ORDER BY ID) WHERE ROWNUM = 1`, { companyId });
            const jobId = jobIdRes.rows[0][0] || jobIdRes.rows[0].ID;

            let slotCounter = 0, dayCounter = 0;
            for (let s = c * studentsPerCompany; s < (c + 1) * studentsPerCompany; s++) {
                const studentId = studentIds[s], appId = `APP_SIM_${c}_${s}`, status = isDjibouti ? 'PENDING' : 'ACCEPTED';
                await conn.execute(`INSERT INTO APPLICATIONS (ID, JOB_ID, STUDENT_ID, STATUS, CREATED_AT, SOURCE) VALUES (:id, :jobId, :studentId, :status, SYSTIMESTAMP, 'DIRECT')`, { id: appId, jobId, studentId, status });

                if (!isDjibouti) {
                    const dt = new Date(`${CONFIG.INTERVIEW_DAYS[dayCounter]}T08:00:00`);
                    dt.setMinutes(dt.getMinutes() + (slotCounter * CONFIG.SLOT_DURATION_MIN));
                    const room = `Salle ${companyName}`;
                    await conn.execute(
                        `INSERT INTO INTERVIEWS (ID, COMPANY_ID, STUDENT_ID, APPLICATION_ID, TITLE, DATE_TIME, STATUS, SOURCE, ROOM) 
                         VALUES (:id, :cid, :sid, :aid, 'Entretien Simulation', :dt, 'ACCEPTED', 'DIRECT', :room)`,
                        { id: `INT_SIM_${c}_${s}`, cid: companyId, sid: studentId, aid: appId, dt, room }
                    );
                    slotCounter++; if (slotCounter >= CONFIG.SLOTS_PER_DAY) { slotCounter = 0; dayCounter++; }
                }
            }
            await conn.commit();
            console.log(`   Done ${companyName}`);
        }
        console.log("✅ SIMULATION COMPLETE!");
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        if (conn) await conn.close();
        await closePool();
    }
}
runSimulation();
