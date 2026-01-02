
import oracledb from "oracledb";
import { withConnection } from "./coreDb.js";
import { randomUUID } from "crypto";

export async function logTokenTransaction(studentId, amount, reason, conn) {
    const id = randomUUID();
    // Use the provided connection if part of a larger transaction, or create a new one
    const execute = async (c) => {
        await c.execute(
            `INSERT INTO TOKEN_HISTORY (ID, STUDENT_ID, AMOUNT, REASON) VALUES (:id, :studentId, :amount, :reason)`,
            { id, studentId, amount, reason }
        );

        // Update the aggregate balance in STUDENTS (source of truth for quick access)
        if (amount < 0) {
            await c.execute(`UPDATE STUDENTS SET TOKENS_REMAINING = TOKENS_REMAINING + :amount, TOKENS_CONSUMED = TOKENS_CONSUMED - :amount WHERE ID = :studentId`, { amount, studentId });
        } else {
            await c.execute(`UPDATE STUDENTS SET TOKENS_REMAINING = TOKENS_REMAINING + :amount WHERE ID = :studentId`, { amount, studentId });
        }
    };

    if (conn) {
        await execute(conn);
    } else {
        await withConnection(async (c) => {
            await execute(c);
            await c.commit();
        });
    }
}

export async function getTokenHistory(studentId) {
    return withConnection(async (conn) => {
        const res = await conn.execute(
            `SELECT AMOUNT, REASON, CREATED_AT FROM TOKEN_HISTORY WHERE STUDENT_ID = :studentId ORDER BY CREATED_AT DESC`,
            { studentId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return res.rows.map(r => ({
            amount: r.AMOUNT,
            reason: r.REASON,
            date: r.CREATED_AT
        }));
    });
}
