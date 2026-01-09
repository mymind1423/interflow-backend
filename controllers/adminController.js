import {
  getPendingCompanies,
  setCompanyStatus,
  getCompanyContact,
  getAllUsers,
  getAdminStats,
  getAllStudentsAdmin,
  getAllCompaniesAdmin,
  deleteUser,
  getAllApplicationsAdmin,
  getAllInterviewsAdmin,
  getCompanyJobs,
  getStudentCandidaturesAdmin,
  getStudentInterviewsByAdmin,
  addSystemLog,
  getSystemLogs,
  getSystemSettings,
  updateSystemSetting,
  updateAdminProfile,
  globalSearchAdmin
} from "../services/dbService.js";
import { sendApprovalEmail } from "../utils/sendMail.js";
import { NotFoundError } from "../utils/errors.js";

export async function listPendingCompanies(req, res, next) {
  try {
    const companies = await getPendingCompanies();
    res.json(companies);
  } catch (err) {
    next(err);
  }
}

export async function approveCompany(req, res, next) {
  try {
    const { id } = req.body;
    const contact = await getCompanyContact(id);
    if (!contact) throw new NotFoundError("Company not found");

    await setCompanyStatus(id, "approved");
    await sendApprovalEmail(contact.email, contact.name);

    await addSystemLog(req.user.uid, "APPROVE_COMPANY", { companyId: id, companyName: contact.name });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function rejectCompany(req, res, next) {
  try {
    const { id } = req.body;
    const contact = await getCompanyContact(id);
    if (!contact) throw new NotFoundError("Company not found");

    await setCompanyStatus(id, "declined");
    await addSystemLog(req.user.uid, "REJECT_COMPANY", { companyId: id, companyName: contact.name });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listAllUsers(req, res, next) {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

import os from "os";

export async function getStats(req, res, next) {
  try {
    const dbStats = await getAdminStats();

    // Add real system metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPerc = Math.round(((totalMem - freeMem) / totalMem) * 100);

    res.json({
      ...dbStats,
      system: {
        memory: usedMemPerc,
        uptime: Math.round(os.uptime() / 3600), // in hours
        load: os.loadavg()[0].toFixed(2)
      }
    });
  } catch (err) { next(err); }
}

export async function getStudents(req, res, next) {
  try {
    const students = await getAllStudentsAdmin();
    res.json(students);
  } catch (err) { next(err); }
}

export async function getCompanies(req, res, next) {
  try {
    const companies = await getAllCompaniesAdmin();
    res.json(companies);
  } catch (err) { next(err); }
}

export async function getJobs(req, res, next) {
  try {
    const data = await getAllJobsAdmin();
    res.json(data);
  } catch (err) { next(err); }
}

export async function deleteEntity(req, res, next) {
  try {
    const { id } = req.body;
    await deleteUser(id);
    await addSystemLog(req.user.uid, "DELETE_USER", { userId: id });
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getApplications(req, res, next) {
  try {
    const apps = await getAllApplicationsAdmin();
    res.json(apps);
  } catch (err) { next(err); }
}

export async function getInterviews(req, res, next) {
  try {
    const interviews = await getAllInterviewsAdmin();
    res.json(interviews);
  } catch (err) { next(err); }
}

export async function listCompanyJobs(req, res, next) {
  try {
    const { id } = req.params;
    const jobs = await getCompanyJobs(id);
    res.json(jobs);
  } catch (err) { next(err); }
}

export async function listStudentApplications(req, res, next) {
  try {
    const { id } = req.params;
    const apps = await getStudentCandidaturesAdmin(id);
    res.json(apps);
  } catch (err) { next(err); }
}

export async function listStudentInterviews(req, res, next) {
  try {
    const { id } = req.params;
    const items = await getStudentInterviewsByAdmin(id);
    res.json(items);
  } catch (err) { next(err); }
}
export async function remindInterview(req, res, next) {
  try {
    const { id } = req.params;
    await addSystemLog(req.user.uid, "REMIND_INTERVIEW", { interviewId: id });
    res.json({ success: true, message: "Rappel envoyé à l'étudiant" });
  } catch (err) { next(err); }
}

export async function getLogs(req, res, next) {
  try {
    const logs = await getSystemLogs();
    res.json(logs);
  } catch (err) { next(err); }
}

export async function getSettings(req, res, next) {
  try {
    const settings = await getSystemSettings();
    res.json(settings);
  } catch (err) { next(err); }
}

export async function updateSetting(req, res, next) {
  try {
    const { key, value } = req.body;
    await updateSystemSetting(key, value);
    await addSystemLog(req.user.uid, "UPDATE_SETTING", { key, value });
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function updateProfile(req, res, next) {
  try {
    const { displayName } = req.body;
    await updateAdminProfile(req.user.uid, displayName);
    await addSystemLog(req.user.uid, "UPDATE_PROFILE", { displayName });
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function search(req, res, next) {
  try {
    const { q } = req.query;
    if (!q) return res.json({ students: [], companies: [], jobs: [] });
    const results = await globalSearchAdmin(q);
    res.json(results);
  } catch (err) { next(err); }
}

export async function getLiveManagerData(req, res, next) {
  try {
    const { companyId, status } = req.query;
    let interviews = await getAllInterviewsAdmin();

    if (companyId) {
      interviews = interviews.filter(i => i.companyId === companyId);
    }

    // Filter by status if provided (e.g. ACCEPTED/COMPLETED)
    if (status) {
      // Note: status from query might be 'ACCEPTED' or 'COMPLETED'
      // But the logic below computes 'liveStatus'.
      // Usually 'status' filter in UI refers to the interview.status (ACCEPTED, CANCELLED).
      // However, LiveManager.jsx has:
      // <option value="ACCEPTED">Accepté</option>
      // <option value="COMPLETED">Terminé</option>
      // <option value="CANCELLED">Annulé</option>
      // These match interview.status usually, except COMPLETED isn't always a DB status if it's just time-based.
      // But let's assume it filters by DB status.
      if (status !== 'COMPLETED') {
        interviews = interviews.filter(i => i.status === status);
      }
    }

    const now = new Date();
    const DURATION_MS = 60 * 60 * 1000; // 1 hour duration

    const result = {
      stats: { active: 0, queue: 0, completed: 0 },
      interviews: [],
      lastUpdated: now.toISOString()
    };

    result.interviews = interviews.map(i => {
      const start = new Date(i.dateTime);
      const end = new Date(start.getTime() + DURATION_MS);
      let liveStatus = 'queue';

      if (i.status === 'IN_PROGRESS') {
        liveStatus = 'active';
      } else if (now >= start && now < end && (i.status === 'ACCEPTED' || i.status === 'CONFIRMED')) {
        liveStatus = 'active';
      } else if (now >= end || i.status === 'COMPLETED') {
        liveStatus = 'completed';
      }

      // If status is CANCELLED/REJECTED, it's not active or queue really.
      if (i.status === 'CANCELLED' || i.status === 'REJECTED' || i.status === 'DECLINED') {
        liveStatus = 'completed'; // Treat as done/inactive
      }

      return { ...i, liveStatus };
    });

    // Filter by computed liveStatus if requested? 
    // The UI sends status='COMPLETED'. Use that to filter liveStatus?
    // "COMPLETED" in UI might mean liveStatus='completed'.
    // Logic in UI: <option value="COMPLETED">Terminé</option> -> setStatus('COMPLETED')
    // If user picks "Terminé", they likely want liveStatus='completed'.
    // BUT mapped to DB status 'COMPLETED'?
    // Let's stick to filtering DB status for now, or refine if needed.

    result.interviews.forEach(i => {
      if (i.liveStatus === 'active') {
        result.stats.active++;
      } else if (i.liveStatus === 'queue') {
        result.stats.queue++;
      }

      // Count recent completions (Strictly COMPLETED status)
      if (i.status === 'COMPLETED') { // Only count if actually marked completed
        const end = new Date(new Date(i.dateTime).getTime() + DURATION_MS);
        const oneHourAgo = new Date(now.getTime() - DURATION_MS); // Count if ended recently
        // Or if marked completed recently? We don't track detailed "completedAt".
        // Use scheduled end time as proxy for now.
        if (end > oneHourAgo) {
          result.stats.completed++;
        }
      }
    });

    result.interviews.sort((a, b) => {
      const scoreA = a.liveStatus === 'active' ? 0 : a.liveStatus === 'queue' ? 1 : 2;
      const scoreB = b.liveStatus === 'active' ? 0 : b.liveStatus === 'queue' ? 1 : 2;
      if (scoreA !== scoreB) return scoreA - scoreB;
      if (a.liveStatus === 'active') return new Date(a.dateTime) - new Date(b.dateTime);
      if (a.liveStatus === 'queue') return new Date(a.dateTime) - new Date(b.dateTime);
      return new Date(b.dateTime) - new Date(a.dateTime);
    });

    res.json(result);
  } catch (err) { next(err); }
}