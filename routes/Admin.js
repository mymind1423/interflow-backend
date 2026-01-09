import express from "express";
import { body } from "express-validator";
import {
  listPendingCompanies,
  approveCompany,
  rejectCompany,
  getStats,
  getStudents,
  getCompanies,
  deleteEntity,
  getApplications,
  getInterviews,
  listCompanyJobs,
  listStudentApplications,
  listStudentInterviews,
  remindInterview,
  getLogs,
  getSettings,
  updateSetting,
  updateProfile,
  search,
  getLiveManagerData,
  getJobs // Import new controller
} from "../controllers/adminController.js";
import { verifyAuth } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { auditLogger } from "../middleware/auditMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = express.Router();

// Base security for all admin routes
router.use(verifyAuth, requireAdmin);
router.use(auditLogger); // Dynamic logging for mutations

const idRule = [body("id").notEmpty().withMessage("ID is required")];

router.get("/companies/pending", listPendingCompanies);
router.post("/companies/approve", idRule, validateRequest, approveCompany);
router.post("/companies/reject", idRule, validateRequest, rejectCompany);

router.get("/stats", getStats);
router.get("/students", getStudents);
router.get("/companies", getCompanies);
router.post("/users/delete", idRule, validateRequest, deleteEntity);
router.get("/applications", getApplications);
router.get("/interviews", getInterviews);
router.get("/jobs", getJobs);

router.get("/companies/:id/jobs", listCompanyJobs);
router.get("/students/:id/applications", listStudentApplications);
router.get("/students/:id/interviews", listStudentInterviews);
router.post("/interviews/:id/remind", remindInterview);

router.get("/settings", getSettings);
router.post("/settings/update", updateSetting);
router.get("/logs", getLogs);
router.post("/profile/update", updateProfile);
router.get("/search", search);
router.get("/live-manager", getLiveManagerData);

export default router;
