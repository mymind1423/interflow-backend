
import jwt from "jsonwebtoken";
import crypto from "crypto";
import oracledb from "oracledb";
import { withConnection } from "../config/db.js";
import { AuthError, ForbiddenError } from "../utils/errors.js";

// Secret for signing JWTs (in prod use env var)
const JWT_SECRET = process.env.JWT_SECRET || "offline_secret_key_12345";
const HASH_SALT = "random_salt_value";

// Simple hash helper (for demo purposes)
const hashPassword = (password) => {
    return crypto.createHash("sha256").update(password + HASH_SALT).digest("hex");
};

export const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyLocalToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw new AuthError("Invalid or expired session");
    }
};

/**
 * LOGIN
 */
export async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) throw new AuthError("Email and password required");

        const user = await withConnection(async (conn) => {
            const result = await conn.execute(
                `SELECT ID, EMAIL, PASSWORD_HASH, USER_TYPE, STATUS, DISPLAY_NAME FROM USERS WHERE LOWER(EMAIL) = LOWER(:email)`,
                { email },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            return result.rows[0];
        });

        if (!user) {
            throw new AuthError("Invalid credentials");
        }

        // Verify Password
        // Handle legacy users (no password) -> In our case, we fail or maybe allow empty?
        // We enforce password check.
        const inputHash = hashPassword(password);

        // For now, if user has NO password hash (migrated from Firebase), we might need a workaround.
        // But user asked for "functional creation", so new users will have it. 
        // Existing users will fail until renewed. 
        // Let's assume strict check.
        if (!user.PASSWORD_HASH || user.PASSWORD_HASH !== inputHash) {
            throw new AuthError("Invalid credentials");
        }

        const token = generateToken({ uid: user.ID, email: user.EMAIL, userType: user.USER_TYPE });

        res.json({
            token, user: {
                uid: user.ID,
                email: user.EMAIL,
                userType: user.USER_TYPE,
                displayName: user.DISPLAY_NAME,
                status: user.STATUS
            }
        });

    } catch (err) {
        next(err);
    }
}

/**
 * SIGNUP HELPER (to be called by existing signup routes or new one)
 * We need to inject the password handling into existing signup flows.
 */
export async function createLocalUser({ id, email, password, displayName, userType }) {
    const passwordHash = hashPassword(password);
    return withConnection(async (conn) => {
        // Insert bare minimum into USERS here? 
        // Actually, the existing userService handles INSERTing into USERS.
        // We might need to UPDATE the password after creation, OR modify userService.
        // Let's stick with updating since we don't want to break existing services too much.

        // This helper will be called *before* existing service calls? 
        // No, current flow is: Frontend -> /api/signup -> Validates -> Service.create...
        // We will create a new registration endpoint that handles everything.
    });
}
// Actually, I'll export the hash function to be used in controllers
export { hashPassword };
