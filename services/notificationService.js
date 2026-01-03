import oracledb from "oracledb";
import { withConnection } from "./coreDb.js";
import { v4 as uuidv4 } from 'uuid';

export async function createNotification(userId, type, title, message, relatedId = null) {
    return withConnection(async (conn) => {
        const id = uuidv4();
        await conn.execute(
            `INSERT INTO NOTIFICATIONS (ID, USER_ID, TYPE, TITLE, MESSAGE, IS_READ, RELATED_ID, CREATED_AT) 
             VALUES (:id, :userId, :type, :title, :message, 0, :relatedId, SYSTIMESTAMP)`,
            { id, userId, type, title, message, relatedId }
        );
        await conn.commit();
        return id;
    });
}

export async function getUserNotifications(userId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT ID, TYPE, TITLE, MESSAGE, IS_READ, RELATED_ID, CREATED_AT FROM NOTIFICATIONS WHERE USER_ID = :userId ORDER BY CREATED_AT DESC FETCH NEXT 50 ROWS ONLY`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({
            id: r.ID,
            type: r.TYPE,
            title: r.TITLE,
            message: r.MESSAGE,
            isRead: r.IS_READ === 1,
            relatedId: r.RELATED_ID,
            createdAt: r.CREATED_AT
        }));
    });
}

export async function markNotificationRead(id) {
    return withConnection(async (conn) => {
        await conn.execute(`UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE ID = :id`, { id });
        await conn.commit();
    });
}

export async function markAllNotificationsRead(userId) {
    return withConnection(async (conn) => {
        await conn.execute(`UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE USER_ID = :userId`, { userId });
        await conn.commit();
    });
}

export async function notifyAdmins(title, message, type = 'info', relatedId = null) {
    return withConnection(async (conn) => {
        const admins = await conn.execute(`SELECT ID FROM USERS WHERE USER_TYPE = 'admin'`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        for (const r of admins.rows) {
            // We use the exported createNotification but since we are inside withConnection, 
            // we should be careful about transaction nesting if createNotification uses withConnection too.
            // createNotification USES withConnection. 
            // So we should NOT call createNotification inside simple loop if it creates new connection.
            // BUT coreDb.js withConnection handles nesting? No, usually not.
            // BETTER: manually insert or refactor createNotification to accept conn.

            // Let's just do manual insert for now to be safe and fast, or call createNotification ensuring it works.
            // coreDb.js withConnection: creates new connection from pool. It DOES NOT reuse existing if passed.
            // So calling createNotification here would use a NEW connection. That is fine, just slightly inefficient.
            // However, we are inside a withConnection(conn).
            // It is safe to use `await createNotification(...)` because it gets its own connection.

            await createNotification(r.ID, type, title, message, relatedId);
        }
    });
}

export async function deleteNotification(id) {
    return withConnection(async (conn) => {
        await conn.execute(`DELETE FROM NOTIFICATIONS WHERE ID = :id`, { id });
        await conn.commit();
    });
}
