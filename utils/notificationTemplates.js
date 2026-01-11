export const NOTIFICATION_TEMPLATES = {

    NEW_APPLICATION: (studentName, jobTitle) => ({
        title: "Nouvelle Candidature",
        message: `${studentName} a candidaté pour votre offre "${jobTitle}".`
    }),
    APPLICATION_ACCEPTED: (studentName, companyName, jobTitle) => ({
        title: "Candidature Acceptée !",
        message: `M./Mme ${studentName}, ${companyName} a accepté votre candidature pour le poste ${jobTitle}.`
    }),
    INTERVIEW_ACCEPTED: (date, room, companyName) => ({
        title: "Entretien Confirmé",
        message: `Entretien programmé le ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} Salle ${room} avec ${companyName}.`
    }),
    QUOTA_REACHED: (jobTitle) => ({
        title: "Offre Clôturée",
        message: `L'offre "${jobTitle}" est complète. Votre jeton a été remboursé.`
    }),
    INVITATION: (companyName, jobTitle) => ({
        title: "Nouvelle Invitation",
        message: `${companyName} vous invite à postuler pour le poste "${jobTitle}".`
    }),
    INVITATION_ACCEPTED: (studentName, jobTitle) => ({
        title: "Invitation Acceptée",
        message: `Le candidat ${studentName} a accepté l'invitation pour "${jobTitle}".`
    }),
    REMINDER_STUDENT: (date, companyName) => ({
        title: "Rappel Entretien",
        message: `Rappel : Entretien avec ${companyName} demain à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`
    }),
    // ADMIN TEMPLATES
    NEW_APPLICATION_ADMIN: (studentName, companyName, jobTitle) => ({
        title: "Nouvelle Candidature",
        message: `${studentName} a postulé chez ${companyName} pour "${jobTitle}".`
    }),
    INTERVIEW_SCHEDULED_ADMIN: (studentName, companyName, date) => ({
        title: "Entretien Programmé",
        message: `Entretien prévu entre ${studentName} et ${companyName} le ${date.toLocaleDateString('fr-FR')}.`
    }),
    NEW_COMPANY_ADMIN: (companyName) => ({
        title: "Nouvelle Entreprise",
        message: `${companyName} vient de s'inscrire et attend validation.`
    }),
    NEW_STUDENT_ADMIN: (studentName) => ({
        title: "Nouvel Étudiant",
        message: `${studentName} vient de s'inscrire.`
    }),
    APPLICATION_CANCELLED: (studentName, jobTitle) => ({
        title: "Candidature Annulée",
        message: `${studentName} a annulé sa candidature pour le poste "${jobTitle}".`
    })
};
