
import { getStudentInvitationsV2, acceptInvitationV2, rejectInvitationV2 } from "../services/dbService.js";

export async function getInvitations(req, res, next) {
    try {
        const invitations = await getStudentInvitationsV2(req.user.uid);
        res.json(invitations);
    } catch (err) {
        next(err);
    }
}

export async function acceptInvitation(req, res, next) {
    try {
        const { id } = req.body;
        const result = await acceptInvitationV2(id, req.user.uid);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function rejectInvitation(req, res, next) {
    try {
        const { id } = req.body;
        const result = await rejectInvitationV2(id, req.user.uid);
        res.json(result);
    } catch (err) {
        next(err);
    }
}
