import { admin } from "../config/firebase.js";
import { getUserById } from "../services/dbService.js";
import { AuthError, ForbiddenError } from "../utils/errors.js";

// Full auth check: Firebase token + Oracle profile
export async function verifyAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new AuthError("Missing token");

    // --- DEMO / OFFLINE MODE BYPASS ---
    if (token.startsWith("DEMO_TOKEN_")) {
      const type = token.replace("DEMO_TOKEN_", "").toLowerCase(); // 'student', 'company', 'admin'

      // Mock user data for the session
      // NOTE: For the app to fully work, this 'uid' should ideally exist in your local Oracle DB users table.
      // If not, some profile pages might show empty or errors.
      const mockUid = type === 'admin' ? 'demo_admin_id' : (type === 'company' ? 'demo_company_id' : 'demo_student_id');

      req.user = {
        uid: mockUid,
        email: `${type}@demo.local`,
        userType: type,
        status: 'approved',
      };
      console.log(`[OFFLINE MODE] Authenticated as ${type} (${mockUid})`);
      return next();
    }
    // ----------------------------------

    const decoded = await admin.auth().verifyIdToken(token);
    const userRecord = await getUserById(decoded.uid);

    // If user missing in DB but valid in Firebase (e.g. during signup/onboarding), 
    // we allow the request to proceed but mark user as 'unknown'.
    if (!userRecord) {
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        userType: 'unknown',
        status: 'pending',
      };
    } else {
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        userType: userRecord.userType,
        status: userRecord.status,
      };
    }

    next();
  } catch (err) {
    if (err instanceof AuthError || err instanceof ForbiddenError) {
      return next(err);
    }
    console.error("Auth Error:", err);
    next(new AuthError("Invalid or expired token"));
  }
}
