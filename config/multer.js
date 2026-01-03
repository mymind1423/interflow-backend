import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.resolve("uploads");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const allowedDocs = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const allowedImages = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

const fileFilter = (allowed) => (req, file, cb) => {
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Unsupported file type"));
  }
  cb(null, true);
};

const buildStorage = () => {
  return multer.memoryStorage();
};

const allowedMixed = [...allowedDocs, ...allowedImages];

export const uploadCv = multer({
  storage: buildStorage(),
  fileFilter: fileFilter(allowedMixed),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadDiploma = multer({
  storage: buildStorage(),
  fileFilter: fileFilter(allowedMixed),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadLogo = multer({
  storage: buildStorage(),
  fileFilter: fileFilter(allowedImages),
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadAvatar = multer({
  storage: buildStorage(),
  fileFilter: fileFilter(allowedImages),
  limits: { fileSize: 2 * 1024 * 1024 },
});
