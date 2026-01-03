import oracledb from "oracledb";
import { withConnection, addSystemLog } from "./coreDb.js";
import { deleteFileFromUrl } from "../utils/fileUtils.js";
import { admin as firebaseAdmin } from "../firebase/firebaseAdmin.js";

/**
 * ADMIN SERVICES
 */
export async function getAdminStats() {
    return withConnection(async (conn) => {
        const students = await conn.execute(`SELECT COUNT(*) as CNT FROM USERS WHERE USER_TYPE = 'student'`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const companies = await conn.execute(`SELECT COUNT(*) as CNT FROM USERS WHERE USER_TYPE = 'company'`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const pending = await conn.execute(`SELECT COUNT(*) as CNT FROM USERS WHERE USER_TYPE = 'company' AND STATUS = 'pending'`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const active = await conn.execute(`SELECT COUNT(*) as CNT FROM USERS WHERE USER_TYPE = 'company' AND STATUS = 'approved'`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const apps = await conn.execute(`SELECT COUNT(*) as CNT FROM APPLICATIONS`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const interviews = await conn.execute(`SELECT COUNT(*) as CNT FROM INTERVIEWS`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        return {
            totalStudents: students.rows[0].CNT,
            totalCompanies: companies.rows[0].CNT,
            pendingCompanies: pending.rows[0].CNT,
            activeCompanies: active.rows[0].CNT,
            totalApplications: apps.rows[0].CNT,
            totalInterviews: interviews.rows[0].CNT
        };
    });
}

export async function getAllStudentsAdmin() {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT U.ID, U.DISPLAY_NAME, U.EMAIL, U.STATUS, U.PHOTO_URL, S.CV_URL, S.DIPLOMA_URL, S.DOMAINE, S.GRADE, S.DATE_OF_BIRTH FROM USERS U LEFT JOIN STUDENTS S ON U.ID = S.ID WHERE U.USER_TYPE = 'student' ORDER BY U.CREATED_AT DESC`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({
            id: r.ID,
            displayName: r.DISPLAY_NAME,
            email: r.EMAIL,
            status: r.STATUS,
            photoUrl: r.PHOTO_URL,
            cvUrl: r.CV_URL,
            diplomaUrl: r.DIPLOMA_URL,
            domaine: r.DOMAINE,
            grade: r.GRADE,
            dateOfBirth: r.DATE_OF_BIRTH
        }));
    });
}

export async function getAllCompaniesAdmin() {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT U.ID, C.NAME, U.EMAIL, U.STATUS, U.PHOTO_URL, C.DOMAINE, C.ADDRESS FROM USERS U LEFT JOIN COMPANIES C ON U.ID = C.ID WHERE U.USER_TYPE = 'company' ORDER BY CASE WHEN U.STATUS = 'pending' THEN 0 ELSE 1 END, U.CREATED_AT DESC`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({
            id: r.ID,
            name: r.NAME || "N/A",
            email: r.EMAIL,
            status: r.STATUS,
            logoUrl: r.PHOTO_URL,
            domaine: r.DOMAINE,
            address: r.ADDRESS
        }));
    });
}

export async function getAllApplicationsAdmin() {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
      SELECT A.ID, J.TITLE, S.FULLNAME, U.PHOTO_URL, A.STATUS, A.CREATED_AT, C.NAME, C.ID as COMPANY_ID, I.DATE_TIME, S.CV_URL, S.DIPLOMA_URL, UC.PHOTO_URL as COMPANY_LOGO, U.EMAIL, S.DOMAINE, S.GRADE, S.DATE_OF_BIRTH
      FROM APPLICATIONS A 
      JOIN JOBS J ON A.JOB_ID = J.ID 
      JOIN STUDENTS S ON A.STUDENT_ID = S.ID 
      JOIN USERS U ON S.ID = U.ID
      JOIN COMPANIES C ON J.COMPANY_ID = C.ID
      JOIN USERS UC ON C.ID = UC.ID
      LEFT JOIN INTERVIEWS I ON A.ID = I.APPLICATION_ID
      ORDER BY A.CREATED_AT DESC
    `, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        return res.rows.map(r => ({
            id: r.ID,
            jobTitle: r.TITLE,
            applicantName: r.FULLNAME,
            applicantPhoto: r.PHOTO_URL,
            status: r.STATUS,
            createdAt: r.CREATED_AT,
            companyName: r.NAME,
            companyId: r.COMPANY_ID,
            interviewDate: r.DATE_TIME,
            cvUrl: r.CV_URL,
            diplomaUrl: r.DIPLOMA_URL,
            companyLogo: r.COMPANY_LOGO,
            applicantEmail: r.EMAIL,
            applicantDomaine: r.DOMAINE,
            applicantGrade: r.GRADE,
            applicantDateOfBirth: r.DATE_OF_BIRTH
        }));
    });
}

export async function getAllInterviewsAdmin() {
    return withConnection(async (conn) => {
        const res = await conn.execute(`
      SELECT I.ID, I.TITLE, C.NAME, S.FULLNAME, I.DATE_TIME, I.STATUS, I.MEET_LINK, U.PHOTO_URL, I.COMPANY_ID, I.ROOM, E.RATING, E.COMMENTS, S.DATE_OF_BIRTH
      FROM INTERVIEWS I
      JOIN COMPANIES C ON I.COMPANY_ID = C.ID
      JOIN STUDENTS S ON I.STUDENT_ID = S.ID
      JOIN USERS U ON S.ID = U.ID
      LEFT JOIN EVALUATIONS E ON I.APPLICATION_ID = E.APPLICATION_ID
      ORDER BY I.DATE_TIME DESC
    `, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        return res.rows.map(r => ({
            id: r.ID,
            title: r.TITLE,
            companyName: r.NAME,
            studentName: r.FULLNAME,
            dateTime: r.DATE_TIME,
            status: r.STATUS,
            meetLink: r.MEET_LINK,
            studentPhoto: r.PHOTO_URL,
            companyId: r.COMPANY_ID,
            room: r.ROOM,
            score: r.RATING, // Map for frontend
            remarks: r.COMMENTS, // Map for frontend
            studentDateOfBirth: r.DATE_OF_BIRTH
        }));
    });
}

export async function getSystemLogs() {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT ID, ADMIN_ID, ACTION, DETAILS, CREATED_AT FROM SYSTEM_LOGS ORDER BY CREATED_AT DESC FETCH NEXT 50 ROWS ONLY`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const logs = [];
        for (const r of res.rows) {
            let details = r.DETAILS;
            if (details && typeof details.getData === 'function') {
                details = await details.getData();
            }
            try { details = JSON.parse(details); } catch (e) { }
            logs.push({ id: r.ID, adminId: r.ADMIN_ID, action: r.ACTION, details: details, createdAt: r.CREATED_AT });
        }
        return logs;
    });
}

export async function getSystemSettings() {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT SETTING_KEY, SETTING_VALUE FROM SYSTEM_SETTINGS`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        // Map [ { SETTING_KEY: 'k', SETTING_VALUE: 'v' } ] -> { k: v }
        const settings = {};
        for (const row of res.rows) {
            settings[row.SETTING_KEY] = row.SETTING_VALUE;
        }
        return settings;
    });
}

export async function updateSystemSetting(key, value) {
    return withConnection(async (conn) => {
        await conn.execute(`UPDATE SYSTEM_SETTINGS SET SETTING_VALUE = :value WHERE SETTING_KEY = :key`, { key, value });
        await conn.commit();
        await addSystemLog('ADMIN', 'UPDATE_SETTING', { key, value });
    });
}

export async function globalSearchAdmin(query) {
    return withConnection(async (conn) => {
        const q = `%${query.toLowerCase()}%`;
        const students = await conn.execute(
            `SELECT ID, DISPLAY_NAME, EMAIL FROM USERS WHERE USER_TYPE = 'student' AND (LOWER(DISPLAY_NAME) LIKE :q OR LOWER(EMAIL) LIKE :q) FETCH NEXT 5 ROWS ONLY`,
            { q },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const companies = await conn.execute(
            `SELECT ID, DISPLAY_NAME, EMAIL FROM USERS WHERE USER_TYPE = 'company' AND (LOWER(DISPLAY_NAME) LIKE :q OR LOWER(EMAIL) LIKE :q) FETCH NEXT 5 ROWS ONLY`,
            { q },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const jobs = await conn.execute(
            `SELECT ID, TITLE, COMPANY_ID FROM JOBS WHERE LOWER(TITLE) LIKE :q FETCH NEXT 5 ROWS ONLY`,
            { q },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return {
            students: students.rows.map(r => ({ id: r.ID, name: r.DISPLAY_NAME, email: r.EMAIL, type: 'student' })),
            companies: companies.rows.map(r => ({ id: r.ID, name: r.DISPLAY_NAME, email: r.EMAIL, type: 'company' })),
            jobs: jobs.rows.map(r => ({ id: r.ID, title: r.TITLE, companyId: r.COMPANY_ID, type: 'job' }))
        };
    });
}

export async function getPendingCompanies() {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT U.ID, C.NAME, U.EMAIL, U.PHOTO_URL, C.DOMAINE FROM USERS U JOIN COMPANIES C ON U.ID = C.ID WHERE U.STATUS = 'pending'`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({ id: r.ID, name: r.NAME, email: r.EMAIL, logoUrl: r.PHOTO_URL, domaine: r.DOMAINE }));
    });
}

export async function setCompanyStatus(id, status) {
    return withConnection(async (conn) => {
        await conn.execute(`UPDATE USERS SET STATUS = :status WHERE ID = :id`, { id, status });
        await conn.commit();
        await addSystemLog('ADMIN', 'SET_COMPANY_STATUS', { id, status });
    });
}

export async function getCompanyContact(id) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT EMAIL, DISPLAY_NAME FROM USERS WHERE ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows[0] ? { email: res.rows[0].EMAIL, name: res.rows[0].DISPLAY_NAME } : null;
    });
}



export async function getStudentCandidaturesAdmin(studentId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT A.ID, J.TITLE, C.NAME, A.STATUS, A.CREATED_AT FROM APPLICATIONS A JOIN JOBS J ON A.JOB_ID = J.ID JOIN COMPANIES C ON J.COMPANY_ID = C.ID WHERE A.STUDENT_ID = :studentId`,
            { studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({ id: r.ID, jobTitle: r.TITLE, companyName: r.NAME, status: r.STATUS, createdAt: r.CREATED_AT }));
    });
}

export async function getStudentInterviewsByAdmin(studentId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT I.ID, I.TITLE, C.NAME, I.DATE_TIME, I.STATUS, I.MEET_LINK 
       FROM INTERVIEWS I 
       JOIN COMPANIES C ON I.COMPANY_ID = C.ID 
       WHERE I.STUDENT_ID = :studentId`,
            { studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({
            id: r.ID,
            title: r.TITLE,
            company: r.NAME,
            date: r.DATE_TIME,
            status: r.STATUS,
            meetLink: r.MEET_LINK
        }));
    });
}
