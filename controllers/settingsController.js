import * as settingsService from '../services/settingsService.js';

export async function getSettings(req, res) {
    try {
        const settings = await settingsService.getSettings();
        res.json(settings);
    } catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ message: "Erreur lors de la récupération des paramètres" });
    }
}

export async function updateSettings(req, res) {
    try {
        const newSettings = req.body;
        await settingsService.updateSettings(newSettings);
        res.json({ message: "Paramètres mis à jour avec succès" });
    } catch (error) {
        console.error("Error updating settings:", error);
        res.status(500).json({ message: "Erreur lors de la mise à jour des paramètres" });
    }
}
