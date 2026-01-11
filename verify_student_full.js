import oracledb from "oracledb";
import { initializePool, getConnection, closePool } from "./config/db.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function verifyStudent() {
    try {
        await initializePool();
        const conn = await getConnection();

        const studentResult = await conn.execute(
            `SELECT * FROM STUDENTS FETCH FIRST 1 ROWS ONLY`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const student = studentResult.rows[0];

        const userResult = await conn.execute(
            `SELECT * FROM USERS WHERE ID = :id`,
            { id: student.ID },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const user = userResult.rows[0];

        const output = { student, user };
        fs.writeFileSync("student_check.json", JSON.stringify(output, null, 2));
        console.log("Details written to student_check.json");

        await conn.close();
        await closePool();
    } catch (err) {
        console.error(err);
    }
}

verifyStudent();
