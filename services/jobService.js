import oracledb from "oracledb";
import { withConnection, addSystemLog, notifyUser } from "./coreDb.js";
import { logTokenTransaction } from "./tokenService.js";
import { NOTIFICATION_TEMPLATES } from "../utils/notificationTemplates.js";
import { randomUUID } from "crypto";

/**
 * JOBS & APPLICATIONS
 */
export async function createJob(job) {
    return withConnection(async (conn) => {
        const id = randomUUID();
        await conn.execute(
            `INSERT INTO JOBS (ID, COMPANY_ID, TITLE, DESCRIPTION, LOCATION, TYPE, SALARY) 
       VALUES (:id, :companyId, :title, :description, :location, :type, :salary)`,
            { ...job, id }
        );
        await conn.commit();
        return { id };
    });
}

export async function getRecentJobs(limit = 6, studentId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
      SELECT J.ID, J.COMPANY_ID, J.TITLE, J.DESCRIPTION, J.LOCATION, J.TYPE, J.SALARY, J.CREATED_AT, 
             J.INTERVIEW_QUOTA, J.ACCEPTED_COUNT, J.IS_ACTIVE,
             C.NAME, U.PHOTO_URL, 
      (SELECT COUNT(*) FROM SAVED_JOBS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId) as IS_SAVED,
      (SELECT STATUS FROM APPLICATIONS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId FETCH NEXT 1 ROWS ONLY) as APPLICATION_STATUS,
      (SELECT STATUS FROM INVITATIONS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId FETCH NEXT 1 ROWS ONLY) as INVITE_STATUS,
      (SELECT I.TITLE FROM APPLICATIONS A JOIN INTERVIEWS I ON A.ID = I.APPLICATION_ID WHERE A.JOB_ID = J.ID AND A.STUDENT_ID = :studentId FETCH NEXT 1 ROWS ONLY) as INTERVIEW_TITLE,
      (SELECT COUNT(*) FROM APPLICATIONS WHERE JOB_ID = J.ID) as TOTAL_APPLICATIONS,
      (SELECT COUNT(*) FROM INVITATIONS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId) as HAS_INVITE
      FROM JOBS J JOIN COMPANIES C ON J.COMPANY_ID = C.ID JOIN USERS U ON C.ID = U.ID
      WHERE J.IS_ACTIVE = 1
      ORDER BY J.CREATED_AT DESC FETCH NEXT :limit ROWS ONLY`,
            { limit, studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return res.rows.map(r => ({
            id: r.ID,
            companyId: r.COMPANY_ID,
            title: r.TITLE,
            description: r.DESCRIPTION,
            location: r.LOCATION,
            type: r.TYPE,
            salary: r.SALARY,
            createdAt: r.CREATED_AT,
            interviewQuota: r.INTERVIEW_QUOTA,
            acceptedCount: r.ACCEPTED_COUNT,
            isActive: r.IS_ACTIVE,
            companyName: r.NAME,
            companyLogo: r.PHOTO_URL,
            isSaved: r.IS_SAVED > 0,
            applicationStatus: (r.INVITE_STATUS === 'PENDING') ? 'INVITED' : r.APPLICATION_STATUS,
            isApplied: !!r.APPLICATION_STATUS,
            isInvited: r.INVITE_STATUS === 'PENDING',
            wasInvited: r.HAS_INVITE > 0,
            applicationCount: r.TOTAL_APPLICATIONS
        }));
    });
}

export async function getStudentStats(userId) {
    return withConnection(async (conn) => {
        // Applications: Count only those that are NOT from invitations
        const apps = await conn.execute(`
            SELECT COUNT(*) as CNT 
            FROM APPLICATIONS A
            WHERE STUDENT_ID = :userId
            AND NOT EXISTS (
                SELECT 1 FROM INVITATIONS I 
                WHERE I.STUDENT_ID = A.STUDENT_ID 
                AND I.JOB_ID = A.JOB_ID
            )
        `, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        const interviews = await conn.execute(`SELECT COUNT(*) as CNT FROM INTERVIEWS WHERE STUDENT_ID = :userId`, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const saved = await conn.execute(`SELECT COUNT(*) as CNT FROM SAVED_JOBS WHERE STUDENT_ID = :userId`, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        // Processed: Only voluntary applications
        const processed = await conn.execute(`
            SELECT COUNT(*) as CNT 
            FROM APPLICATIONS A 
            WHERE STUDENT_ID = :userId 
            AND STATUS != 'PENDING'
            AND NOT EXISTS (
                SELECT 1 FROM INVITATIONS I 
                WHERE I.STUDENT_ID = A.STUDENT_ID 
                AND I.JOB_ID = A.JOB_ID
            )
        `, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        // Invitations: Count all invitations (Pending, Accepted, Rejected)
        const invitations = await conn.execute(`SELECT COUNT(*) as CNT FROM INVITATIONS WHERE STUDENT_ID = :userId`, { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        return {
            applications: apps.rows[0].CNT,
            interviews: interviews.rows[0].CNT,
            savedJobs: saved.rows[0].CNT,
            processedApplications: processed.rows[0].CNT + invitations.rows[0].CNT,
            invitations: invitations.rows[0].CNT
        };
    });
}

export async function getAllCompanies() {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT U.ID, C.NAME, U.PHOTO_URL, C.DOMAINE, C.ADDRESS FROM USERS U JOIN COMPANIES C ON U.ID = C.ID WHERE U.STATUS = 'approved'`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({ id: r.ID, name: r.NAME, logoUrl: r.PHOTO_URL, domaine: r.DOMAINE, address: r.ADDRESS }));
    });
}

export async function applyToJob(userId, jobId, coverLetter) {
    return withConnection(async (conn) => {
        // 1. Check Tokens
        const tokenRes = await conn.execute(
            `SELECT TOKENS_REMAINING FROM STUDENTS WHERE ID = :userId FOR UPDATE`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (tokenRes.rows.length === 0) throw new Error("Student not found");

        const tokensRemaining = tokenRes.rows[0].TOKENS_REMAINING || 0;

        if (tokensRemaining <= 0) {
            throw new Error(`Plus de jetons disponibles. Vous avez utilisé tous vos jetons.`);
        }

        // 2. Check Job Active Status and Quota (Double Check)
        const jobRes = await conn.execute(
            `SELECT COMPANY_ID, IS_ACTIVE, INTERVIEW_QUOTA, ACCEPTED_COUNT FROM JOBS WHERE ID = :jobId`,
            { jobId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (jobRes.rows.length === 0) throw new Error("Job not found");

        const job = jobRes.rows[0];
        const companyId = job.COMPANY_ID;
        const isActive = job.IS_ACTIVE;
        const quota = job.INTERVIEW_QUOTA;
        const accepted = job.ACCEPTED_COUNT;

        if (isActive === 0) {
            throw new Error("Cette offre n'est plus active.");
        }

        // Check Application Quota
        const appCountRes = await conn.execute(
            `SELECT COUNT(*) as CNT FROM APPLICATIONS WHERE JOB_ID = :jobId`,
            { jobId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const currentApps = appCountRes.rows[0].CNT;

        if (currentApps >= quota) {
            throw new Error("Cette offre a atteint son quota de candidatures.");
        }

        // 3. Check duplicate
        const check = await conn.execute(
            `SELECT ID FROM APPLICATIONS WHERE STUDENT_ID = :userId AND JOB_ID = :jobId`,
            { userId, jobId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (check.rows.length > 0) throw new Error("Vous avez déjà postulé à cette offre.");

        const id = randomUUID();

        // 4. Deduct Token
        await logTokenTransaction(userId, -1, "Application: " + job.TITLE, conn);

        await conn.execute(
            `INSERT INTO APPLICATIONS (ID, JOB_ID, STUDENT_ID, COVER_LETTER, STATUS, CREATED_AT) VALUES (:id, :jobId, :userId, :coverLetter, 'PENDING', SYSTIMESTAMP)`,
            { id, jobId, userId, coverLetter: coverLetter || "" }
        );
        await conn.commit();
        await addSystemLog(userId, 'JOB_APPLICATION', { jobId });

        // Notify Company
        const coUserRes = await conn.execute(
            `SELECT ID FROM USERS WHERE ID = :companyId`,
            { companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (coUserRes.rows.length > 0) {
            const coUserId = coUserRes.rows[0].ID;
            await notifyUser(coUserId, NOTIFICATION_TEMPLATES.NEW_APPLICATION.title, NOTIFICATION_TEMPLATES.NEW_APPLICATION.message);
        }

        return { status: 'APPLIED', tokensRemaining: tokensRemaining - 1 };
    });
}

// Helper: Close Company Offers (Saturation Logic)
async function closeCompanyOffers(conn, companyId) {
    const pendingApps = await conn.execute(
        `SELECT A.ID, A.STUDENT_ID 
         FROM APPLICATIONS A JOIN JOBS J ON A.JOB_ID = J.ID 
         WHERE J.COMPANY_ID = :companyId AND A.STATUS = 'PENDING'`,
        { companyId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    for (const row of pendingApps.rows) {
        const pid = row.ID;
        const psid = row.STUDENT_ID;

        await conn.execute(`UPDATE APPLICATIONS SET STATUS = 'REJECTED_QUOTA' WHERE ID = :pid`, { pid });
        await logTokenTransaction(psid, -1, "Application Cancelled (Quota Reached)", conn);
        await addSystemLog(psid, 'SYSTEM_CANCEL', { companyId, reason: 'Quota Reached' });
        await notifyUser(psid, NOTIFICATION_TEMPLATES.QUOTA_REACHED.title, NOTIFICATION_TEMPLATES.QUOTA_REACHED.message);
    }
}

export async function updateApplicationStatus(id, companyId, status, interviewData = null) {
    return withConnection(async (conn) => {
        // 1. Get Application Details & Company Quota
        const check = await conn.execute(
            `SELECT A.ID, A.STUDENT_ID, J.TITLE, J.ID as JOB_ID, C.INTERVIEW_QUOTA
       FROM APPLICATIONS A 
       JOIN JOBS J ON A.JOB_ID = J.ID 
       JOIN COMPANIES C ON J.COMPANY_ID = C.ID
       WHERE A.ID = :id AND J.COMPANY_ID = :companyId FOR UPDATE`,
            { id, companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (check.rows.length === 0) throw new Error("Unauthorized");

        const row = check.rows[0];
        const appId = row.ID;
        const studentId = row.STUDENT_ID;
        const jobTitle = row.TITLE;
        const quota = row.INTERVIEW_QUOTA;

        // 2. STATUS LOGIC
        if (status === 'ACCEPTED') {
            const usageRes = await conn.execute(
                `SELECT COUNT(*) as CNT FROM INTERVIEWS WHERE COMPANY_ID = :companyId AND STATUS IN ('ACCEPTED', 'COMPLETED')`,
                { companyId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            const acceptedCount = usageRes.rows[0].CNT;

            if (acceptedCount >= quota) {
                throw new Error(`Quota global atteint (${quota}). Impossible d'accepter plus de candidats.`);
            }

            const { findBestSlot } = await import("./schedulerService.js");
            const slot = await findBestSlot(conn, studentId, companyId);

            const interviewId = randomUUID();
            const insertParams = {
                id: interviewId,
                companyId,
                studentId,
                appId,
                title: `Entretien: ${jobTitle}`,
                dt: slot.startTime,
                link: '',
                room: slot.roomName || 'Salle d\'attente'
            };

            await conn.execute(
                `INSERT INTO INTERVIEWS (ID, COMPANY_ID, STUDENT_ID, APPLICATION_ID, TITLE, DATE_TIME, MEET_LINK, ROOM, STATUS) 
             VALUES (:id, :companyId, :studentId, :appId, :title, :dt, :link, :room, 'ACCEPTED')`,
                insertParams
            );

            await logTokenTransaction(studentId, 0, "Interview Accepted (Engagement -> Consumed)", conn);
            // Updating engagement/consumed counts specifically still needed if we track them separately in columns
            // But if we move to pure history, we might not need columns. For now maintain columns for compatibility
            await conn.execute(`UPDATE STUDENTS SET TOKENS_ENGAGED = TOKENS_ENGAGED - 1, TOKENS_CONSUMED = TOKENS_CONSUMED + 1 WHERE ID = :studentId`, { studentId });

            if (acceptedCount + 1 >= quota) {
                await closeCompanyOffers(conn, companyId);
            }

            const notif = NOTIFICATION_TEMPLATES.INTERVIEW_ACCEPTED(slot.startTime, slot.roomName);
            await notifyUser(studentId, notif.title, notif.message);

        } else if (status === 'REJECTED' || status === 'CANCELLED') {
            await conn.execute(`UPDATE STUDENTS SET TOKENS_ENGAGED = TOKENS_ENGAGED - 1 WHERE ID = :studentId`, { studentId });
        }

        await conn.execute(`UPDATE APPLICATIONS SET STATUS = :status WHERE ID = :id`, { id, status });
        await conn.commit();
        return { success: true };
    });
}

export async function getStudentApplications(userId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
            SELECT A.ID, J.TITLE, C.NAME, U.PHOTO_URL, A.STATUS, A.CREATED_AT,
            (SELECT TITLE FROM INTERVIEWS WHERE APPLICATION_ID = A.ID FETCH NEXT 1 ROWS ONLY) as INTERVIEW_TITLE
            FROM APPLICATIONS A 
            JOIN JOBS J ON A.JOB_ID = J.ID 
            JOIN COMPANIES C ON J.COMPANY_ID = C.ID 
            JOIN USERS U ON C.ID = U.ID
            WHERE A.STUDENT_ID = :userId 
            AND NOT EXISTS (
                SELECT 1 FROM INVITATIONS I 
                WHERE I.STUDENT_ID = A.STUDENT_ID 
                AND I.JOB_ID = A.JOB_ID
            )
            ORDER BY A.CREATED_AT DESC`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({
            id: r.ID,
            jobTitle: r.TITLE,
            companyName: r.NAME,
            companyLogo: r.PHOTO_URL,
            // Custom Logic: If interview title identifies as an invitation, override status
            status: r.STATUS,
            createdAt: r.CREATED_AT
        }));
    });
}

export async function getCompanyApplications(companyId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
      SELECT A.ID, J.TITLE, S.FULLNAME, U.PHOTO_URL, A.STATUS, A.CREATED_AT, S.CV_URL, S.DIPLOMA_URL, A.COVER_LETTER,
      S.DOMAINE, S.GRADE, S.FACULTY, S.PHONE, S.ADDRESS, S.DATE_OF_BIRTH, U.EMAIL
      FROM APPLICATIONS A 
      JOIN JOBS J ON A.JOB_ID = J.ID 
      JOIN STUDENTS S ON A.STUDENT_ID = S.ID 
      JOIN USERS U ON S.ID = U.ID
      WHERE J.COMPANY_ID = :companyId ORDER BY A.CREATED_AT DESC`,
            { companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({
            id: r.ID,
            jobTitle: r.TITLE,
            applicantName: r.FULLNAME,
            applicantPhoto: r.PHOTO_URL,
            status: r.STATUS,
            createdAt: r.CREATED_AT,
            cvUrl: r.CV_URL,
            diplomaUrl: r.DIPLOMA_URL,
            coverLetter: r.COVER_LETTER,
            domaine: r.DOMAINE,
            grade: r.GRADE,
            faculty: r.FACULTY,
            phone: r.PHONE,
            address: r.ADDRESS,
            dateOfBirth: r.DATE_OF_BIRTH,
            email: r.EMAIL
        }));
    });
}

export async function getCompanyJobs(companyId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
      SELECT J.ID, J.COMPANY_ID, J.TITLE, J.DESCRIPTION, J.LOCATION, J.TYPE, J.SALARY, J.CREATED_AT,
             J.INTERVIEW_QUOTA,
             (SELECT COUNT(*) 
              FROM INTERVIEWS I 
              JOIN APPLICATIONS A ON I.APPLICATION_ID = A.ID 
              WHERE A.JOB_ID = J.ID AND I.STATUS IN ('ACCEPTED', 'COMPLETED')) as ACCEPTED_COUNT, 
             J.IS_ACTIVE,
             (SELECT COUNT(*) FROM APPLICATIONS WHERE JOB_ID = J.ID) as APPLICATION_COUNT 
      FROM JOBS J WHERE COMPANY_ID = :companyId ORDER BY CREATED_AT DESC`,
            { companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return res.rows.map(r => ({
            id: r.ID,
            companyId: r.COMPANY_ID,
            title: r.TITLE,
            description: r.DESCRIPTION,
            location: r.LOCATION,
            type: r.TYPE,
            salary: r.SALARY,
            createdAt: r.CREATED_AT,
            interviewQuota: r.INTERVIEW_QUOTA,
            acceptedCount: r.ACCEPTED_COUNT,
            isActive: r.IS_ACTIVE,
            applicationCount: r.APPLICATION_COUNT
        }));
    });
}

export async function updateJob(job) {
    return withConnection(async (conn) => {
        await conn.execute(
            `UPDATE JOBS SET TITLE = :title, DESCRIPTION = :description, LOCATION = :location, TYPE = :type, SALARY = :salary WHERE ID = :id AND COMPANY_ID = :companyId`,
            {
                title: job.title,
                description: job.description,
                location: job.location,
                type: job.type,
                salary: job.salary,
                id: job.id,
                companyId: job.companyId
            }
        );
        await conn.commit();
        return { success: true };
    });
}

export async function deleteJob(id, companyId) {
    return withConnection(async (conn) => {
        await conn.execute(`DELETE FROM JOBS WHERE ID = :id AND COMPANY_ID = :companyId`, { id, companyId });
        await conn.commit();
        return { success: true };
    });
}

export async function toggleSavedJob(studentId, jobId) {
    return withConnection(async (conn) => {
        const check = await conn.execute(
            `SELECT STUDENT_ID FROM SAVED_JOBS WHERE STUDENT_ID = :studentId AND JOB_ID = :jobId`,
            { studentId, jobId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        let saved = false;
        if (check.rows.length > 0) {
            await conn.execute(`DELETE FROM SAVED_JOBS WHERE STUDENT_ID = :studentId AND JOB_ID = :jobId`, { studentId, jobId });
            saved = false;
        } else {
            await conn.execute(`INSERT INTO SAVED_JOBS (STUDENT_ID, JOB_ID) VALUES (:studentId, :jobId)`, { studentId, jobId });
            saved = true;
        }
        await conn.commit();
        return { success: true, saved };
    });
}

export async function deleteApplication(id, studentId) {
    return withConnection(async (conn) => {
        const check = await conn.execute(
            `SELECT ID, STATUS FROM APPLICATIONS WHERE ID = :id AND STUDENT_ID = :studentId`,
            { id, studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (check.rows.length === 0) return { error: "Not found or unauthorized" };

        const status = check.rows[0].STATUS;

        await conn.execute(`DELETE FROM APPLICATIONS WHERE ID = :id`, { id });

        if (status === 'PENDING') {
            await logTokenTransaction(studentId, 1, "Application Withdrawn", conn);
        }

        await conn.commit();
        return { success: true };
    });
}

export async function getStudentSavedJobs(studentId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
      SELECT J.ID, J.COMPANY_ID, J.TITLE, J.DESCRIPTION, J.LOCATION, J.TYPE, J.SALARY, J.CREATED_AT, 
             J.INTERVIEW_QUOTA, J.ACCEPTED_COUNT, J.IS_ACTIVE,
             C.NAME, U.PHOTO_URL,
             (SELECT COUNT(*) FROM APPLICATIONS WHERE JOB_ID = J.ID) as TOTAL_APPLICATIONS,
             (SELECT STATUS FROM APPLICATIONS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId FETCH NEXT 1 ROWS ONLY) as APP_STATUS,
             (SELECT I.TITLE FROM APPLICATIONS A JOIN INTERVIEWS I ON A.ID = I.APPLICATION_ID WHERE A.JOB_ID = J.ID AND A.STUDENT_ID = :studentId FETCH NEXT 1 ROWS ONLY) as INTERVIEW_TITLE,
             (SELECT STATUS FROM INVITATIONS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId FETCH NEXT 1 ROWS ONLY) as INVITE_STATUS,
             (SELECT COUNT(*) FROM INVITATIONS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId) as HAS_INVITE
      FROM SAVED_JOBS S 
      JOIN JOBS J ON S.JOB_ID = J.ID 
      JOIN COMPANIES C ON J.COMPANY_ID = C.ID 
      JOIN USERS U ON C.ID = U.ID
      WHERE S.STUDENT_ID = :studentId 
      ORDER BY S.CREATED_AT DESC`,
            { studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return res.rows.map(r => ({
            id: r.ID,
            companyId: r.COMPANY_ID,
            title: r.TITLE,
            description: r.DESCRIPTION,
            location: r.LOCATION,
            type: r.TYPE,
            salary: r.SALARY,
            createdAt: r.CREATED_AT,
            interviewQuota: r.INTERVIEW_QUOTA,
            acceptedCount: r.ACCEPTED_COUNT,
            isActive: r.IS_ACTIVE,
            company: r.NAME,
            companyLogo: r.PHOTO_URL,
            applicationCount: r.TOTAL_APPLICATIONS,
            applicationStatus: (r.INVITE_STATUS === 'PENDING') ? 'INVITED' : r.APP_STATUS,
            isApplied: !!r.APP_STATUS,
            isInvited: r.INVITE_STATUS === 'PENDING',
            wasInvited: r.HAS_INVITE > 0
        }));
    });
}

/**
 * COMPANY TALENT POOL
 */
export async function getAllStudentsForCompany(companyId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
            SELECT S.ID, S.FULLNAME, U.PHOTO_URL, S.PHONE, S.DOMAINE, S.GRADE, S.FACULTY, S.CV_URL, S.DIPLOMA_URL, S.DATE_OF_BIRTH,
            (SELECT COUNT(*) FROM APPLICATIONS A 
             JOIN JOBS J ON A.JOB_ID = J.ID 
             WHERE A.STUDENT_ID = S.ID AND J.COMPANY_ID = :companyId) as HAS_APPLIED,
            (SELECT COUNT(*) FROM INVITATIONS I 
             WHERE I.STUDENT_ID = S.ID AND I.COMPANY_ID = :companyId AND I.STATUS = 'PENDING') as HAS_PENDING_INVITE,
            (SELECT A.ID FROM APPLICATIONS A 
             JOIN JOBS J ON A.JOB_ID = J.ID 
             WHERE A.STUDENT_ID = S.ID AND J.COMPANY_ID = :companyId 
             FETCH NEXT 1 ROWS ONLY) as EXISTING_APP_ID
            FROM STUDENTS S 
            JOIN USERS U ON S.ID = U.ID 
            WHERE S.DOMAINE IS NOT NULL AND S.GRADE IS NOT NULL
            AND (SELECT COUNT(*) FROM APPLICATIONS A JOIN JOBS J ON A.JOB_ID = J.ID WHERE A.STUDENT_ID = S.ID AND J.COMPANY_ID = :companyId) = 0
            ORDER BY S.FULLNAME ASC`,
            { companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return res.rows.map(r => ({
            id: r.ID,
            name: r.FULLNAME,
            photo: r.PHOTO_URL,
            phone: r.PHONE,
            domain: r.DOMAINE,
            grade: r.GRADE,
            faculty: r.FACULTY,
            cvUrl: r.CV_URL,
            diplomaUrl: r.DIPLOMA_URL,
            dateOfBirth: r.DATE_OF_BIRTH,
            hasApplied: r.HAS_APPLIED > 0,
            hasPendingInvite: r.HAS_PENDING_INVITE > 0
        }));
    });
}



// Deprecated: inviteStudent replaced by inviteStudentV2 in invitationService.js
export async function inviteStudent(companyId, studentId, jobId) {
    throw new Error("Use invitationService.inviteStudentV2 instead");
}

export async function getStudentInterviews(userId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
        SELECT I.ID, I.COMPANY_ID, I.STUDENT_ID, I.APPLICATION_ID, I.TITLE, I.DATE_TIME, I.STATUS, I.ROOM, 
               C.NAME, U.PHOTO_URL, A.STATUS as APP_STATUS
        FROM INTERVIEWS I 
        JOIN COMPANIES C ON I.COMPANY_ID = C.ID 
        JOIN USERS U ON C.ID = U.ID 
        LEFT JOIN APPLICATIONS A ON I.APPLICATION_ID = A.ID
        WHERE I.STUDENT_ID = :userId`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return res.rows.map(r => ({
            id: r.ID,
            companyId: r.COMPANY_ID,
            studentId: r.STUDENT_ID,
            appId: r.APPLICATION_ID,
            title: r.TITLE,
            date: r.DATE_TIME,
            status: r.STATUS,
            room: r.ROOM,
            companyName: r.NAME,
            companyLogo: r.PHOTO_URL,
            sourceStatus: r.APP_STATUS, // 'INVITED' or 'ACCEPTED'
            checkedIn: r.STATUS === 'CHECKED_IN'
        }));
    });
}

export async function getJobsByCompany(companyId, studentId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
            SELECT J.*, 
            (SELECT COUNT(*) FROM SAVED_JOBS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId) as IS_SAVED,
            (SELECT COUNT(*) FROM APPLICATIONS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId) as IS_APPLIED,
            (SELECT STATUS FROM INVITATIONS WHERE JOB_ID = J.ID AND STUDENT_ID = :studentId FETCH NEXT 1 ROWS ONLY) as INVITE_STATUS
            FROM JOBS J WHERE J.COMPANY_ID = :companyId ORDER BY J.CREATED_AT DESC`,
            { companyId, studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        // Note: J.* expands to columns. OUT_FORMAT_OBJECT returns keys.
        // We know standard columns: ID, COMPANY_ID, TITLE, DESCRIPTION, LOCATION, TYPE, SALARY, CREATED_AT...
        return res.rows.map(r => ({
            id: r.ID,
            title: r.TITLE,
            description: r.DESCRIPTION,
            location: r.LOCATION,
            type: r.TYPE,
            salary: r.SALARY,
            createdAt: r.CREATED_AT,
            isSaved: r.IS_SAVED > 0,
            isApplied: r.IS_APPLIED > 0,
            isInvited: r.INVITE_STATUS === 'PENDING',
            applicationStatus: (r.INVITE_STATUS === 'PENDING') ? 'INVITED' : (r.IS_APPLIED > 0 ? 'PENDING' : null)
        }));
    });
}

export async function getCompanyInterviews(companyId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
      SELECT I.ID, I.STUDENT_ID, I.APPLICATION_ID, I.TITLE, I.DATE_TIME, I.MEET_LINK, I.STATUS, 
             S.FULLNAME, U.PHOTO_URL, S.PHONE, S.DOMAINE, S.GRADE, S.FACULTY, S.DATE_OF_BIRTH, I.ROOM,
             E.RATING, E.COMMENTS
      FROM INTERVIEWS I 
      JOIN STUDENTS S ON I.STUDENT_ID = S.ID 
      JOIN USERS U ON S.ID = U.ID 
      LEFT JOIN EVALUATIONS E ON I.APPLICATION_ID = E.APPLICATION_ID
      WHERE I.COMPANY_ID = :companyId`,
            { companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        return res.rows.map(r => ({
            id: r.ID,
            studentId: r.STUDENT_ID,
            appId: r.APPLICATION_ID,
            title: r.TITLE,
            dateTime: r.DATE_TIME,
            meetLink: r.MEET_LINK,
            status: r.STATUS,
            studentName: r.FULLNAME,
            studentPhoto: r.PHOTO_URL,
            studentPhone: r.PHONE,
            studentDomaine: r.DOMAINE,
            studentGrade: r.GRADE,
            studentFaculty: r.FACULTY,
            studentDateOfBirth: r.DATE_OF_BIRTH,
            room: r.ROOM,
            score: r.RATING, // Renamed from rating for frontend compatibility
            remarks: r.COMMENTS, // Renamed from comment for frontend compatibility
            rating: r.RATING, // Keep explicitly for safety
            comment: r.COMMENTS // Keep explicitly for safety
        }));
    });
}

export async function updateInterviewStatusService(id, companyId, status) {
    return withConnection(async (conn) => {
        const check = await conn.execute(
            `SELECT ID FROM INTERVIEWS WHERE ID = :id AND COMPANY_ID = :companyId`,
            { id, companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (check.rows.length === 0) throw new Error("Unauthorized or not found");

        await conn.execute(`UPDATE INTERVIEWS SET STATUS = :status WHERE ID = :id`, { id, status });
        await conn.commit();
        return { success: true };
    });
}

export async function getInterviewById(id) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT STUDENT_ID, TITLE FROM INTERVIEWS WHERE ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows[0] ? { studentId: res.rows[0].STUDENT_ID, title: res.rows[0].TITLE } : null;
    });
}

// NEW: Save Evaluation linked to Application
export async function saveCompanyEvaluation(companyId, studentId, rating, comment) {
    return withConnection(async (conn) => {
        // Find latest application for this pair to attach evaluation to
        // Ideally, frontend should pass applicationId, but for backward compat we try to find it
        const appRes = await conn.execute(
            `SELECT A.ID FROM APPLICATIONS A JOIN JOBS J ON A.JOB_ID = J.ID WHERE A.STUDENT_ID = :studentId AND J.COMPANY_ID = :companyId ORDER BY A.CREATED_AT DESC FETCH NEXT 1 ROWS ONLY`,
            { studentId, companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (appRes.rows.length === 0) throw new Error("Aucune candidature trouvée pour cet étudiant chez vous.");
        const applicationId = appRes.rows[0].ID;

        const validRating = (rating && Number(rating) >= 1 && Number(rating) <= 10) ? Number(rating) : null;
        const id = randomUUID();

        // Check if exists for this application
        const check = await conn.execute(
            `SELECT ID FROM EVALUATIONS WHERE APPLICATION_ID = :applicationId`,
            { applicationId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (check.rows.length > 0) {
            await conn.execute(
                `UPDATE EVALUATIONS SET RATING = :rating, COMMENTS = :comments, UPDATED_AT = SYSTIMESTAMP WHERE APPLICATION_ID = :applicationId`,
                { applicationId, rating: validRating, comments: comment }
            );
        } else {
            await conn.execute(
                `INSERT INTO EVALUATIONS (ID, APPLICATION_ID, COMPANY_ID, STUDENT_ID, RATING, COMMENTS) 
                 VALUES (:id, :applicationId, :companyId, :studentId, :rating, :comments)`,
                { id, applicationId, companyId, studentId, rating: validRating, comments: comment }
            );
        }
        await conn.commit();
        return { success: true };
    });
}

export async function getCompanyEvaluation(companyId, studentId) {
    return withConnection(async (conn) => {
        // Fetch latest evaluation for this student from this company
        const res = await conn.execute(
            `SELECT RATING, COMMENTS FROM EVALUATIONS 
             WHERE COMPANY_ID = :companyId AND STUDENT_ID = :studentId 
             ORDER BY CREATED_AT DESC FETCH NEXT 1 ROWS ONLY`,
            { companyId, studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (res.rows.length === 0) return { rating: 0, comment: '' };
        return { rating: res.rows[0].RATING, comment: res.rows[0].COMMENTS };
    });
}
// NEW: Student Check-In
export async function studentCheckIn(interviewId, studentId) {
    return withConnection(async (conn) => {
        // Verify ownership
        const check = await conn.execute(
            `SELECT COMPANY_ID, TITLE FROM INTERVIEWS WHERE ID = :interviewId AND STUDENT_ID = :studentId`,
            { interviewId, studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (check.rows.length === 0) throw new Error("Unauthorized or not found");

        const companyId = check.rows[0].COMPANY_ID;
        const title = check.rows[0].TITLE;

        // Perform Check-In: Update Status
        await conn.execute(`UPDATE INTERVIEWS SET STATUS = 'CHECKED_IN' WHERE ID = :interviewId`, { interviewId });

        // Notify Company
        const coUserRes = await conn.execute(`SELECT ID FROM USERS WHERE ID = :companyId`, { companyId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        if (coUserRes.rows.length > 0) {
            await notifyUser(coUserRes.rows[0].ID, "Candidat présent", `Le candidat pour ${title} est prêt (Check-in effectué).`);
        }

        await conn.commit();
        return { success: true };
    });
}

// NEW: Get Feedback
export async function getInterviewFeedback(interviewId, studentId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT E.COMMENTS, E.RATING 
             FROM INTERVIEWS I
             JOIN EVALUATIONS E ON I.APPLICATION_ID = E.APPLICATION_ID
             WHERE I.ID = :interviewId AND I.STUDENT_ID = :studentId`,
            { interviewId, studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (res.rows.length === 0) return { remarks: "Pas de feedback." };
        return { remarks: res.rows[0].COMMENTS, score: res.rows[0].RATING };
    });
}
