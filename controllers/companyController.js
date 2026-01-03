import {
    getCompanyJobs,
    createJob,
    getCompanyApplications,
    updateApplicationStatus,
    deleteJob as deleteJobService,
    updateJob as updateJobService,
    getCompanyInterviews,
    saveCompanyEvaluation,
    getCompanyEvaluation,
    updateInterviewStatusService,
    getInterviewById,
    createNotification
} from "../services/dbService.js";

export async function getJobs(req, res, next) {
    try {
        const jobs = await getCompanyJobs(req.user.uid);
        res.json(jobs);
    } catch (err) {
        next(err);
    }
}

export async function createNewJob(req, res, next) {
    try {
        const job = {
            ...req.body,
            companyId: req.user.uid
        };
        const result = await createJob(job);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function getApplications(req, res, next) {
    try {
        const apps = await getCompanyApplications(req.user.uid);
        res.json(apps);
    } catch (err) {
        next(err);
    }
}

export async function updateStatus(req, res, next) {
    try {
        const { id, status, interviewData } = req.body;
        const result = await updateApplicationStatus(id, req.user.uid, status, interviewData);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function deleteJob(req, res, next) {
    try {
        const { id } = req.body;
        const result = await deleteJobService(id, req.user.uid);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function updateJob(req, res, next) {
    try {
        const job = { ...req.body, companyId: req.user.uid };
        const result = await updateJobService(job);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function getInterviews(req, res, next) {
    try {
        const interviews = await getCompanyInterviews(req.user.uid);
        res.json(interviews);
    } catch (err) {
        next(err);
    }
}

export async function saveEvaluation(req, res, next) {
    try {
        const { studentId, rating, comment, score, remarks } = req.body;
        // Support both naming conventions
        const finalRating = rating || score;
        const finalComment = comment || remarks;

        const result = await saveCompanyEvaluation(req.user.uid, studentId, finalRating, finalComment);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

// ...

export async function getEvaluation(req, res, next) {
    try {
        const { studentId } = req.params;
        const result = await getCompanyEvaluation(req.user.uid, studentId);
        res.json(result || { rating: 0, comment: '' });
    } catch (err) {
        next(err);
    }
}

export async function getStudentPublicProfile(req, res, next) {
    try {
        const { studentId } = req.params;
        const { getProfileById } = await import("../services/dbService.js");
        const profile = await getProfileById(studentId);
        if (!profile) return res.status(404).json({ error: "Student not found" });
        res.json(profile);
    } catch (err) {
        next(err);
    }
}

export async function updateInterviewState(req, res, next) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await updateInterviewStatusService(id, req.user.uid, status);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function notifyInterviewStudent(req, res, next) {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'CALL'/'ENTER_ROOM' or 'DELAY'/'DELAYED_NEXT'

        const interview = await getInterviewById(id);
        if (!interview) return res.status(404).json({ error: "Interview not found" });

        let title, message;
        if (type === 'CALL' || type === 'ENTER_ROOM') {
            title = "C'est à votre tour !";
            message = `L'entreprise est prête pour votre entretien "${interview.title}". Veuillez rejoindre la salle/lien immédiatement.`;
        } else if (type === 'DELAY' || type === 'DELAYED_NEXT') {
            title = "Retard signalé";
            message = `Le recruteur a un léger retard pour "${interview.title}". Merci de patienter 5-10 minutes.`;
        }

        await createNotification(interview.studentId, 'info', title, message, id);
        res.json({ success: true, message: "Notification sent" });
    } catch (err) {
        next(err);
    }
}

export async function getStudentList(req, res, next) {
    try {
        const { getAllStudentsForCompany } = await import("../services/dbService.js");
        const students = await getAllStudentsForCompany(req.user.uid);
        res.json(students);
    } catch (err) {
        next(err);
    }
}

export async function inviteStudent(req, res, next) {
    try {
        const { studentId, jobId } = req.body;
        const { inviteStudentV2 } = await import("../services/dbService.js");
        const result = await inviteStudentV2(req.user.uid, studentId, jobId);
        res.json(result);
    } catch (err) {
        next(err);
    }
}
