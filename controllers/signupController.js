import {
  createStudentProfile,
  createCompanyProfile,
  getUserByEmail,
  isPhoneRegistered,
} from "../services/dbService.js";
import { ValidationError } from "../utils/errors.js";

export async function signupStudent(req, res, next) {
  try {
    const {
      email,
      fullname,
      phone,
      address,
      faculty,
      domaine,
      grade,
      cvUrl,
      diplomaUrl,
      dateOfBirth
    } = req.body;

    // SECURITY FIX: Use the UID from the validated token, not the body
    const id = req.user.uid;

    const existingUser = await getUserByEmail(email);
    if (existingUser) throw new ValidationError("Email already exists");

    const phoneTaken = await isPhoneRegistered(phone);
    if (phoneTaken) throw new ValidationError("Phone already exists");

    await createStudentProfile({
      id,
      email,
      fullname,
      phone,
      address,
      faculty,
      domaine,
      grade,
      cvUrl,
      diplomaUrl,
      dateOfBirth
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function signupCompany(req, res, next) {
  try {
    const { email, name, address, domaine, logoUrl, photoUrl, phone, website, description } = req.body;
    const id = req.user.uid;

    const existingUser = await getUserByEmail(email);
    if (existingUser) throw new ValidationError("Email already exists");

    await createCompanyProfile({
      id,
      email,
      name,
      address,
      domaine,
      phone,
      website,
      description,
      logoUrl: logoUrl || photoUrl,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
