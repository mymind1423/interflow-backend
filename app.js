import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

import signupRoutes from "./routes/Signup.js";
import uploadRoutes from "./routes/Upload.js";
import profileRoutes from "./routes/Profile.js";
import verifyRoutes from "./routes/Verify.js";
import adminRoutes from "./routes/Admin.js";
import notificationRoutes from "./routes/Notifications.js";
import studentRoutes from "./routes/Student.js";
import companyRoutes from "./routes/Company.js";
import aiRoutes from "./routes/AI.js";
import { verifyAuth } from "./middleware/authMiddleware.js";
import { checkMaintenanceMode } from "./middleware/maintenanceMiddleware.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { getProfile } from "./controllers/profileController.js";

dotenv.config();

const app = express();
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.resolve("uploads");

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use("/uploads", express.static(UPLOAD_ROOT));

// Optional: Global maintenance check for authenticated routes
// For now, let's just stick it in front of common user routes

app.use("/api/signup", signupRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/notifications", verifyAuth, checkMaintenanceMode, notificationRoutes);
app.use("/api/student", verifyAuth, checkMaintenanceMode, studentRoutes);
app.use("/api/company", verifyAuth, checkMaintenanceMode, companyRoutes);
app.use("/api/ai", verifyAuth, checkMaintenanceMode, aiRoutes);

import { verifyTokenOnly } from "./middleware/verifyTokenOnly.js";

app.get("/api/userinfo", verifyTokenOnly, getProfile);



app.use(notFoundHandler);
app.use(errorHandler);

export default app;
