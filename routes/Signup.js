import express from "express";
import { body } from "express-validator";
import { signupCompany, signupStudent } from "../controllers/signupController.js";
import { verifyTokenOnly } from "../middleware/verifyTokenOnly.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = express.Router();

const studentRules = [
  body("email").isEmail().withMessage("Invalid email"),
  body("fullname").isLength({ min: 2 }).withMessage("Full name is required"),
  body("phone").isLength({ min: 8 }).withMessage("Phone is required"),
  body("address").isLength({ min: 3 }).withMessage("Address is required"),
  body("faculty").optional().isLength({ min: 2 }).withMessage("Faculty is required"),
  body("domaine").optional().isLength({ min: 2 }).withMessage("Domain is required"),
  body("grade").optional().isLength({ min: 2 }).withMessage("Grade is required"),
  body("dateOfBirth").optional().isISO8601().toDate().withMessage("Invalid date of birth"),
  body("cvUrl")
    .optional({ checkFalsy: true, nullable: true })
    .isURL({ require_tld: false })
    .withMessage("CV URL invalid"),
  body("diplomaUrl")
    .optional({ checkFalsy: true, nullable: true })
    .isURL({ require_tld: false })
    .withMessage("Diploma URL invalid"),
];

const companyRules = [
  body("email").isEmail().withMessage("Invalid email"),
  body("name").isLength({ min: 2 }).withMessage("Company name is required"),
  body("address").isLength({ min: 3 }).withMessage("Address is required"),
  body("domaine").optional().isLength({ min: 2 }).withMessage("Domain is required"),
  body("logoUrl")
    .optional({ checkFalsy: true, nullable: true })
    .isURL({ require_tld: false })
    .withMessage("Logo URL invalid"),
  body("photoUrl")
    .optional({ checkFalsy: true, nullable: true })
    .isURL({ require_tld: false })
    .withMessage("Photo URL invalid"),
];

router.post("/student", verifyTokenOnly, studentRules, validateRequest, signupStudent);
router.post("/company", verifyTokenOnly, companyRules, validateRequest, signupCompany);

export default router;
