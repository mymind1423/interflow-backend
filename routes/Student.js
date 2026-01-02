import express from "express";
import { getStats, getCompanies, getRecentJobs, apply, myApplications, getCompanyJobs, toggleSave, getSaved, getInterviews, withdrawApplication, checkIn, getFeedback } from "../controllers/studentController.js";
import { getInvitations, acceptInvitation, rejectInvitation } from "../controllers/studentInvitationController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/stats", verifyAuth, getStats);
router.get("/companies", verifyAuth, getCompanies);
router.get("/jobs", verifyAuth, getRecentJobs);
router.post("/apply", verifyAuth, apply);
router.get("/applications", verifyAuth, myApplications);
router.post("/applications/delete", verifyAuth, withdrawApplication);
router.get("/companies/:companyId/jobs", verifyAuth, getCompanyJobs);

router.post("/save-job", verifyAuth, toggleSave);
router.get("/saved-jobs", verifyAuth, getSaved);
router.get("/interviews", verifyAuth, getInterviews);
router.post("/interviews/:id/check-in", verifyAuth, checkIn);
router.get("/interviews/:id/feedback", verifyAuth, getFeedback);

// New Invitation Routes
router.get("/invitations", verifyAuth, getInvitations);
router.post("/invitations/accept", verifyAuth, acceptInvitation);
router.post("/invitations/reject", verifyAuth, rejectInvitation);

export default router;
