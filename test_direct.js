
import oracledb from "oracledb";
import dotenv from "dotenv";
dotenv.config();

const { ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING } = process.env;

async function runDirect() {
    console.log("Attempting direct connection...");
    console.log("User:", ORACLE_USER);
    console.log("ConnectString:", ORACLE_CONNECT_STRING);

    let conn;
    try {
        const start = Date.now();
        conn = await oracledb.getConnection({
            user: ORACLE_USER,
            password: ORACLE_PASSWORD,
            connectString: ORACLE_CONNECT_STRING
        });
        const dur = Date.now() - start;
        console.log(`Connected! Took ${dur}ms`);
        await conn.execute("SELECT 1 FROM DUAL");
        console.log("Query executed.");
    } catch (err) {
        console.error("Direct Connection Failed:", err);
    } finally {
        if (conn) {
            await conn.close();
            console.log("Closed.");
        }
    }
}

runDirect();
