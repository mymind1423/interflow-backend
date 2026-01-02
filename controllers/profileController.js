import {
  getProfileById,
  updateUserProfile,
  checkUserExists,
  getUserStatus,
} from "../services/dbService.js";
import { NotFoundError } from "../utils/errors.js";

export async function getProfile(req, res, next) {
  try {
    const profile = await getProfileById(req.user.uid);
    if (profile) {
      res.json(profile);
    } else {
      // Fallback: If no student/company profile, return basic User info (maybe Admin or just Auth user)
      // This covers the logic that was in userController.js
      res.json({
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.displayName || "User",
        userType: "unknown",
        status: "pending"
      });
    }
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const updated = await updateUserProfile(req.user.uid, req.body);
    if (!updated) throw new NotFoundError("User not found");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function profileExists(req, res, next) {
  try {
    const exists = await checkUserExists(req.user.uid);
    res.json({ exists });
  } catch (err) {
    next(err);
  }
}

export async function isPending(req, res, next) {
  try {
    const status = await getUserStatus(req.user.uid);
    res.json({ pending: status === "pending" });
  } catch (err) {
    next(err);
  }
}
