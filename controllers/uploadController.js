import { uploadToBucket } from "../services/ociService.js";
import { ValidationError } from "../utils/errors.js";

function ensureFile(req) {
  if (!req.file) {
    throw new ValidationError("Upload failed", [{ field: "file", message: "File is required" }]);
  }
}

import path from "path";

// ... ensureFile ...

function generateFilename(req) {
  const ext = path.extname(req.file.originalname) || "";
  const uid = req.uid || "anonymous";
  return `${uid}-${Date.now()}${ext}`;
}

export async function uploadCvFile(req, res, next) {
  try {
    ensureFile(req);
    const filename = generateFilename(req);
    const url = await uploadToBucket(req.file.buffer, filename, "cv");
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function uploadDiplomaFile(req, res, next) {
  try {
    ensureFile(req);
    const filename = generateFilename(req);
    const url = await uploadToBucket(req.file.buffer, filename, "diploma");
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function uploadLogoFile(req, res, next) {
  try {
    ensureFile(req);
    const filename = generateFilename(req);
    const url = await uploadToBucket(req.file.buffer, filename, "logo");
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatarFile(req, res, next) {
  try {
    ensureFile(req);
    const filename = generateFilename(req);
    const url = await uploadToBucket(req.file.buffer, filename, "avatars");
    res.json({ url });
  } catch (err) {
    next(err);
  }
}
