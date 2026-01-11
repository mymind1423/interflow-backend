import oracledb from "oracledb";

/**
 * Scheduler Service
 * Handles automated interview scheduling for Djibouti Campus (Balbala).
 * Parameters: 08:00 - 12:00, 20 min slots.
 * Rooms: Dynamic (Salle + Company Name).
 */

const START_HOUR = 8;
const START_MIN = 0;
const END_HOUR = 12;
const END_MIN = 0;
const SLOT_DURATION_MS = 20 * 60 * 1000;

// Feb 15 to Feb 19, 2026 
const YEAR = 2026;
const TARGET_MONTH = 1; // February (0-indexed)
const DAYS = [15, 16, 17, 18, 19];

export async function findBestSlot(conn, studentId, companyId, source = 'APPLICATION') {
    // 0. Date Range (Feb 15 - Feb 19, 2026)
    const startRange = new Date(YEAR, TARGET_MONTH, 15, 0, 0, 0);
    const endRange = new Date(YEAR, TARGET_MONTH, 19, 23, 59, 59);

    // 1. Fetch Existing Commitments
    // Company Interviews
    const companyInts = await conn.execute(
        `SELECT DATE_TIME FROM INTERVIEWS 
         WHERE COMPANY_ID = :id AND STATUS != 'CANCELLED'
         AND DATE_TIME >= :startRange AND DATE_TIME <= :endRange`,
        { id: companyId, startRange, endRange },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Student Interviews
    const studentInts = await conn.execute(
        `SELECT DATE_TIME FROM INTERVIEWS 
         WHERE STUDENT_ID = :id AND STATUS != 'CANCELLED'
         AND DATE_TIME >= :startRange AND DATE_TIME <= :endRange`,
        { id: studentId, startRange, endRange },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Global Interviews for Quota counting
    const allInts = await conn.execute(
        `SELECT DATE_TIME, SOURCE FROM INTERVIEWS 
         WHERE STATUS != 'CANCELLED' 
         AND DATE_TIME >= :startRange AND DATE_TIME <= :endRange`,
        { startRange, endRange },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Fetch Company Name for Room Name
    const coRes = await conn.execute(`SELECT NAME FROM COMPANIES WHERE ID = :id`, { id: companyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const companyName = coRes.rows[0]?.NAME || 'Entreprise';

    const companyBusy = new Set(companyInts.rows.map(r => new Date(r.DATE_TIME || r[0]).getTime()));
    const studentBusy = new Set(studentInts.rows.map(r => new Date(r.DATE_TIME || r[0]).getTime()));

    const dailyCounts = {}; // dayString -> { total: number, apps: number }

    allInts.rows.forEach(r => {
        const dateObj = new Date(r.DATE_TIME || r[0]);
        const src = r.SOURCE || r[1]; // 'APPLICATION' or 'INVITATION'

        // Daily Counts (Key: "Month-Day")
        const dayKey = `${dateObj.getMonth()}-${dateObj.getDate()}`;
        if (!dailyCounts[dayKey]) dailyCounts[dayKey] = { total: 0, apps: 0 };

        dailyCounts[dayKey].total++;
        if (src === 'APPLICATION') {
            dailyCounts[dayKey].apps++;
        }
    });

    // 2. Iterate Slots
    for (const day of DAYS) {
        // Quota Check
        const dayKey = `${TARGET_MONTH}-${day}`;
        const counts = dailyCounts[dayKey] || { total: 0, apps: 0 };

        // Hard Limit: 60 Total (Assuming max 60 total across all companies if needed, but here rooms are dynamic)
        // User said: "chaque entrprise une salle", so global room conflict is less an issue than global day overload if any.
        // Let's keep a high enough limit.
        if (counts.total >= 500) continue; // High enough for many companies

        // Simulation parameters: 12 slots per day per company.
        const baseDate = new Date(YEAR, TARGET_MONTH, day, START_HOUR, START_MIN, 0);

        // 8:00 to 12:00 (12 slots of 20 mins)
        for (let i = 0; i < 12; i++) {
            const slotTime = new Date(baseDate.getTime() + (i * SLOT_DURATION_MS));
            const timeMs = slotTime.getTime();

            // Checks
            if (companyBusy.has(timeMs)) continue;
            if (studentBusy.has(timeMs)) continue;

            // Room logic: "Chaque entreprise une salle"
            const assignedRoom = `Salle ${companyName}`;
            return {
                startTime: slotTime,
                roomName: assignedRoom,
                roomId: assignedRoom
            };
        }
    }

    throw new Error("Aucun créneau disponible (Salles complètes ou incompatibilité d'agenda).");
}
