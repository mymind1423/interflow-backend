import { randomUUID } from "crypto";
import oracledb from "oracledb";
import { withConnection } from "./coreDb.js";
import { createNotification } from "./dbService.js";

export async function inviteStudentV2(companyId, studentId, jobId) {
    return withConnection(async (conn) => {
        // 1. Check Job Validity & Quota
        const jobRes = await conn.execute(
            `SELECT ID, TITLE, INTERVIEW_QUOTA, ACCEPTED_COUNT FROM JOBS WHERE ID = :jobId AND COMPANY_ID = :companyId AND IS_ACTIVE = 1`,
            { jobId, companyId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (jobRes.rows.length === 0) throw new Error("Offre non trouvée ou inactive.");
        const job = jobRes.rows[0];

        // 2. Check if already invited or applied
        const checkApp = await conn.execute(
            `SELECT ID FROM APPLICATIONS WHERE STUDENT_ID = :studentId AND JOB_ID = :jobId`,
            { studentId, jobId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (checkApp.rows.length > 0) throw new Error("Ce candidat a déjà postulé.");

        const checkInv = await conn.execute(
            `SELECT ID FROM INVITATIONS WHERE STUDENT_ID = :studentId AND JOB_ID = :jobId`,
            { studentId, jobId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (checkInv.rows.length > 0) throw new Error("Ce candidat a déjà été invité.");

        // 3. Create Invitation
        const id = randomUUID();
        await conn.execute(
            `INSERT INTO INVITATIONS (ID, COMPANY_ID, STUDENT_ID, JOB_ID, STATUS, MESSAGE) VALUES (:id, :companyId, :studentId, :jobId, 'PENDING', :message)`,
            { id, companyId, studentId, jobId, message: "Nous aimerions vous rencontrer." }
        );

        // 4. Notify Student
        await createNotification(studentId, 'invitation', "Nouvelle Invitation", `L'entreprise vous invite à postuler pour "${job.TITLE}".`, id);

        await conn.commit();
        return { success: true };
    });
}

export async function getStudentInvitationsV2(studentId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
            SELECT I.ID, I.STATUS, I.CREATED_AT, C.NAME as COMPANY_NAME, J.TITLE as JOB_TITLE, U.PHOTO_URL as COMPANY_LOGO, I.JOB_ID
            FROM INVITATIONS I
            JOIN COMPANIES C ON I.COMPANY_ID = C.ID
            JOIN USERS U ON C.ID = U.ID
            JOIN JOBS J ON I.JOB_ID = J.ID
            WHERE I.STUDENT_ID = :studentId
            ORDER BY I.CREATED_AT DESC
        `, { studentId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        return res.rows.map(r => ({
            id: r.ID,
            status: r.STATUS,
            createdAt: r.CREATED_AT,
            companyName: r.COMPANY_NAME,
            jobTitle: r.JOB_TITLE,
            companyLogo: r.COMPANY_LOGO,
            jobId: r.JOB_ID
        }));
    });
}

export async function acceptInvitationV2(invitationId, studentId) {
    return withConnection(async (conn) => {
        // 1. Get Invitation
        const res = await conn.execute(
            `SELECT * FROM INVITATIONS WHERE ID = :invitationId AND STUDENT_ID = :studentId FOR UPDATE`,
            { invitationId, studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (res.rows.length === 0) throw new Error("Invitation not found");
        const inv = res.rows[0];

        if (inv.STATUS !== 'PENDING') throw new Error("Invitation déjà traitée.");

        // 1b. Get Job Details for Title
        const jobRes = await conn.execute(
            `SELECT TITLE FROM JOBS WHERE ID = :jobId`,
            { jobId: inv.JOB_ID },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const jobTitle = jobRes.rows[0]?.TITLE || "Poste";

        // 2. Create Application (Accepted immediately)
        const appId = randomUUID();
        await conn.execute(
            `INSERT INTO APPLICATIONS (ID, JOB_ID, STUDENT_ID, STATUS, CREATED_AT) VALUES (:appId, :jobId, :studentId, 'ACCEPTED', SYSTIMESTAMP)`,
            { appId, jobId: inv.JOB_ID, studentId }
        );

        // 3. Create Interview (Accepted)
        const { findBestSlot } = await import("./schedulerService.js");
        const slot = await findBestSlot(conn, studentId, inv.COMPANY_ID);
        const interviewId = randomUUID();

        await conn.execute(
            `INSERT INTO INTERVIEWS (ID, COMPANY_ID, STUDENT_ID, APPLICATION_ID, TITLE, DATE_TIME, STATUS, ROOM) 
             VALUES (:interviewId, :companyId, :studentId, :appId, :title, :dt, 'ACCEPTED', :room)`,
            {
                interviewId,
                companyId: inv.COMPANY_ID,
                studentId,
                appId,
                title: `Entretien: ${jobTitle} (Suite Invitation)`,
                dt: slot.startTime,
                room: slot.roomName
            }
        );

        // 4. Update Invitation Status
        await conn.execute(`UPDATE INVITATIONS SET STATUS = 'ACCEPTED', UPDATED_AT = SYSTIMESTAMP WHERE ID = :invitationId`, { invitationId });

        // 5. Notify Company
        await createNotification(inv.COMPANY_ID, 'info', "Invitation Acceptée", "Le candidat a accepté votre invitation. L'entretien est planifié.", interviewId);

        await conn.commit();
        return { success: true };
    });
}

export async function rejectInvitationV2(invitationId, studentId) {
    return withConnection(async (conn) => {
        await conn.execute(
            `UPDATE INVITATIONS SET STATUS = 'REJECTED', UPDATED_AT = SYSTIMESTAMP WHERE ID = :invitationId AND STUDENT_ID = :studentId`,
            { invitationId, studentId }
        );
        await conn.commit();
        return { success: true };
    });
}
