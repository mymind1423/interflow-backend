import oracledb from "oracledb";
import { withConnection, normalizeUser, addSystemLog } from "./coreDb.js";
import { notifyAdmins } from "./dbService.js";
import { replaceFile, deleteFileFromUrl } from "../utils/fileUtils.js";
import { admin as firebaseAdmin } from "../firebase/firebaseAdmin.js";

/**
 * AUTH & PROFILE
 */
export async function getUserById(id) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT * FROM USERS WHERE id = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return normalizeUser(res.rows[0]);
    });
}

export async function checkUserExists(id) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT COUNT(*) as CNT FROM USERS WHERE ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows[0].CNT > 0;
    });
}

export async function getUserStatus(id) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT STATUS FROM USERS WHERE ID = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows[0] ? res.rows[0].STATUS : null;
    });
}

export async function getUserByEmail(email) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT * FROM USERS WHERE lower(email) = lower(:email)`,
            { email },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return normalizeUser(res.rows[0]);
    });
}

export async function isPhoneRegistered(phone) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT COUNT(*) as CNT FROM STUDENTS WHERE PHONE = :phone`,
            { phone },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows[0].CNT > 0;
    });
}

export async function createStudentProfile(payload) {
    const { id, email, fullname, phone, address, faculty, domaine, grade, cvUrl, diplomaUrl, dateOfBirth } = payload;
    return withConnection(async (conn) => {
        try {
            await conn.execute(
                `INSERT INTO USERS (ID, USER_TYPE, EMAIL, DISPLAY_NAME, STATUS) VALUES (:id, 'student', :email, :fullname, 'approved')`,
                { id, email, fullname }
            );
        } catch (e) {
            // Ignore if user already exists (might be created by trigger or separate auth flow)
            if (e.code !== 'ORA-00001') throw e;
            // Update the user type just in case it was created without it
            await conn.execute(
                `UPDATE USERS SET USER_TYPE = 'student', STATUS = 'approved', DISPLAY_NAME = :fullname WHERE ID = :id`,
                { id, fullname }
            );
        }
        await conn.execute(
            `INSERT INTO STUDENTS (ID, FULLNAME, PHONE, ADDRESS, FACULTY, DOMAINE, GRADE, CV_URL, DIPLOMA_URL, DATE_OF_BIRTH, TOKENS_REMAINING, MAX_TOKENS)
       VALUES (:id, :fullname, :phone, :address, :faculty, :domaine, :grade, :cvUrl, :diplomaUrl, :dateOfBirth, 5, 5)`,
            {
                id: id || null,
                fullname: fullname || null,
                phone: phone || null,
                address: address || null,
                faculty: faculty || null,
                domaine: domaine || null,
                grade: grade || null,
                cvUrl: cvUrl || null,
                diplomaUrl: diplomaUrl || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
            }
        );
        await conn.commit();
        await addSystemLog('SYSTEM', 'NEW_STUDENT', { id, email, fullname });
        await notifyAdmins('Nouvelle Inscription', `${fullname} s'est inscrit en tant qu'étudiant.`, 'student_signup', id);
        return { id };
    });
}

export async function createCompanyProfile(payload) {
    const { id, email, name, address, domaine, logoUrl } = payload;
    return withConnection(async (conn) => {
        try {
            await conn.execute(
                `INSERT INTO USERS (ID, USER_TYPE, EMAIL, DISPLAY_NAME, PHOTO_URL, STATUS) VALUES (:id, 'company', :email, :name, :logoUrl, 'pending')`,
                { id, email, name, logoUrl }
            );
        } catch (e) {
            if (e.code !== 'ORA-00001') throw e;
            await conn.execute(
                `UPDATE USERS SET USER_TYPE = 'company', STATUS = 'pending', DISPLAY_NAME = :name WHERE ID = :id`,
                { id, name }
            );
        }
        await conn.execute(
            `INSERT INTO COMPANIES (ID, NAME, ADDRESS, DOMAINE) VALUES (:id, :name, :address, :domaine)`,
            { id: id || null, name: name || null, address: address || null, domaine: domaine || null }
        );
        await conn.commit();
        await addSystemLog('SYSTEM', 'NEW_COMPANY', { id, email, name });
        await notifyAdmins('Demande de Validation', `L'entreprise ${name} souhaite rejoindre la plateforme.`, 'company_signup', id);
        return { id };
    });
}

export async function getProfileById(id) {
    return withConnection(async (conn) => {
        const user = await getUserById(id);
        if (!user) return null;

        if (user.userType === "student") {
            const res = await conn.execute(
                `SELECT * FROM STUDENTS WHERE id = :id`,
                { id },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            const s = res.rows[0];

            const tokenRes = await conn.execute(
                `SELECT TOKENS_REMAINING, MAX_TOKENS FROM STUDENTS WHERE ID = :id`,
                { id },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            const remaining = tokenRes.rows[0] ? tokenRes.rows[0].TOKENS_REMAINING : 5;
            const max = tokenRes.rows[0] ? tokenRes.rows[0].MAX_TOKENS : 5;

            return {
                ...user,
                fullname: s.FULLNAME,
                phone: s.PHONE,
                address: s.ADDRESS,
                domaine: s.DOMAINE,
                grade: s.GRADE,
                cvUrl: s.CV_URL,
                diplomaUrl: s.DIPLOMA_URL,
                faculty: s.FACULTY,
                dateOfBirth: s.DATE_OF_BIRTH,
                tokensRemaining: remaining,
                maxTokens: max
            };
        } else if (user.userType === "company") {
            const res = await conn.execute(
                `SELECT NAME, ADDRESS, DOMAINE, INTERVIEW_QUOTA FROM COMPANIES WHERE id = :id`,
                { id },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            const c = res.rows[0];
            const usageRes = await conn.execute(
                `SELECT COUNT(*) as CNT FROM APPLICATIONS A JOIN JOBS J ON A.JOB_ID = J.ID WHERE J.COMPANY_ID = :id`,
                { id },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            const usage = usageRes.rows[0].CNT;

            return {
                ...user,
                name: c.NAME,
                address: c.ADDRESS,
                domaine: c.DOMAINE,
                quota: { total: c.INTERVIEW_QUOTA, used: usage, remaining: c.INTERVIEW_QUOTA - usage }
            };
        }
        return user;
    });
}

export async function updateUserProfile(id, payload) {
    return withConnection(async (conn) => {
        const user = await getUserById(id);
        if (!user) return null;

        // Handle File replacements
        const currentProfile = await getProfileById(id);
        if (payload.photoUrl !== undefined) await replaceFile(currentProfile.photoUrl, payload.photoUrl);
        if (payload.logoUrl !== undefined) await replaceFile(currentProfile.photoUrl, payload.logoUrl);

        if (user.userType === 'student') {
            if (payload.cvUrl !== undefined) await replaceFile(currentProfile.cvUrl, payload.cvUrl);
            if (payload.diplomaUrl !== undefined) await replaceFile(currentProfile.diplomaUrl, payload.diplomaUrl);
        }

        // 1. Automatic Synchronization of Display Name <-> Entity Name
        if (user.userType === 'student') {
            // If displayName is updated but fullname isn't, sync fullname
            if (payload.displayName && !payload.fullname) {
                payload.fullname = payload.displayName;
            }
            // If fullname is updated but displayName isn't, sync displayName
            if (payload.fullname && !payload.displayName) {
                payload.displayName = payload.fullname;
            }
        } else if (user.userType === 'company') {
            // If displayName is updated but name isn't, sync name
            if (payload.displayName && !payload.name) {
                payload.name = payload.displayName;
            }
            // If name is updated but displayName isn't, sync displayName
            if (payload.name && !payload.displayName) {
                payload.displayName = payload.name;
            }
        }

        // 2. Dynamic Update for USERS
        const userUpdates = [];
        const userParams = { id };

        if (payload.displayName !== undefined) {
            userUpdates.push('DISPLAY_NAME = :displayName');
            userParams.displayName = payload.displayName;
        }

        const newPhoto = payload.photoUrl !== undefined ? payload.photoUrl : payload.logoUrl;
        if (newPhoto !== undefined) {
            userUpdates.push('PHOTO_URL = :photo');
            userParams.photo = newPhoto;
        }

        if (userUpdates.length > 0) {
            // Always update timestamp if we touch the user record
            userUpdates.push('UPDATED_AT = SYSTIMESTAMP');
            await conn.execute(`UPDATE USERS SET ${userUpdates.join(', ')} WHERE ID = :id`, userParams);
        }

        // 3. Dynamic Update for Sub-tables (STUDENTS / COMPANIES)
        if (user.userType === 'student') {
            const fields = [];
            const params = { id };
            const map = {
                fullname: 'FULLNAME', phone: 'PHONE', address: 'ADDRESS',
                domaine: 'DOMAINE', grade: 'GRADE', cvUrl: 'CV_URL', diplomaUrl: 'DIPLOMA_URL', faculty: 'FACULTY',
                dateOfBirth: 'DATE_OF_BIRTH'
            };

            for (const [key, col] of Object.entries(map)) {
                if (payload[key] !== undefined) {
                    fields.push(`${col} = :${key}`);
                    if (key === 'dateOfBirth' && payload[key]) {
                        params[key] = new Date(payload[key]);
                    } else {
                        params[key] = payload[key];
                    }
                }
            }

            if (fields.length > 0) {
                await conn.execute(`UPDATE STUDENTS SET ${fields.join(', ')} WHERE ID = :id`, params);

                // Explicitly update USERS.DISPLAY_NAME if FULLNAME was updated
                // This ensures redundancy but guarantees the sync happens effectively
                if (payload.fullname) {
                    await conn.execute(`UPDATE USERS SET DISPLAY_NAME = :fullname WHERE ID = :id`, { fullname: payload.fullname, id });
                }
            }
        } else if (user.userType === 'company') {
            const fields = [];
            const params = { id };
            const map = { name: 'NAME', address: 'ADDRESS', domaine: 'DOMAINE' };

            for (const [key, col] of Object.entries(map)) {
                if (payload[key] !== undefined) {
                    fields.push(`${col} = :${key}`);
                    params[key] = payload[key];
                }
            }

            if (fields.length > 0) {
                await conn.execute(`UPDATE COMPANIES SET ${fields.join(', ')} WHERE ID = :id`, params);
            }
        }

        await conn.commit();
        return { success: true };
    });
}

export async function deleteUser(id) {
    return withConnection(async (conn) => {
        const user = await getUserById(id);

        if (user) {
            if (user.photoUrl) await deleteFileFromUrl(user.photoUrl);

            // Disconnect user (revoke tokens) & Delete from Firebase
            try {
                await firebaseAdmin.auth().revokeRefreshTokens(id);
                await firebaseAdmin.auth().deleteUser(id);
            } catch (e) {
                console.warn(`Firebase cleanup failed for ${id}:`, e.message);
            }
        }

        // Delete from DB
        await conn.execute(`DELETE FROM USERS WHERE ID = :id`, { id });
        await conn.commit();
        await addSystemLog('ADMIN', 'DELETE_USER', { id });
        return { success: true };
    });
}

export async function getStudentProfileForAI(userId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT S.FULLNAME, S.DOMAINE, S.GRADE, S.CV_URL FROM STUDENTS S WHERE S.ID = :userId`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows[0] ? { fullname: res.rows[0].FULLNAME, domaine: res.rows[0].DOMAINE, grade: res.rows[0].GRADE, cvUrl: res.rows[0].CV_URL } : null;
    });
}

export async function approveUserTest(email) {
    return withConnection(async (conn) => {
        await conn.execute(`UPDATE USERS SET STATUS = 'approved' WHERE EMAIL = :email`, { email });
        await conn.commit();
    });
}

export async function getUserStatusByEmail(email) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT STATUS FROM USERS WHERE EMAIL = :email`,
            { email },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows[0] ? res.rows[0].STATUS : null;
    });
}

export async function makeUserAdmin(email) {
    return withConnection(async (conn) => {
        await conn.execute(`UPDATE USERS SET USER_TYPE = 'admin' WHERE EMAIL = :email`, { email });
        await conn.commit();
    });
}

export async function updateAdminProfile(id, displayName) {
    return withConnection(async (conn) => {
        await conn.execute(`UPDATE USERS SET DISPLAY_NAME = :displayName WHERE ID = :id`, { displayName, id });
        await conn.commit();
    });
}

export async function getAllUsers() {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT ID, USER_TYPE, EMAIL, DISPLAY_NAME, PHOTO_URL, STATUS FROM USERS`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(normalizeUser);
    });
}
