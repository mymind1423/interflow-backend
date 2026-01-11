import oracledb from 'oracledb';
import { withConnection } from './dbService.js';

// Default settings if none exist
const DEFAULT_SETTINGS = {
    general: {
        platformName: "InternFlow",
        promoName: "Promo 2026",
        contactEmail: "admin@internflow.com"
    },
    workflow: {
        retentionThreshold: 75,
        interviewSlotDuration: 30,
        autoApproveCompanies: false,
        maxApplicationsPerStudent: 5,
        validationEnabled: true
    },
    notifications: {
        emailStudentOnStatusChange: true,
        emailAdminOnNewRegistration: true,
        emailCompanyOnNewApplication: true
    },
    team: {
        allowShadowing: true,
        visibleEvaluations: false
    }
};

/**
 * Get all settings
 */
export async function getSettings() {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT KEY, VALUE FROM SETTINGS`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return DEFAULT_SETTINGS;
        }

        // Map rows to a nested object
        const settings = { ...DEFAULT_SETTINGS };
        result.rows.forEach(row => {
            const [section, key] = row.KEY.split('.');
            if (section && key) {
                if (!settings[section]) settings[section] = {};
                try {
                    settings[section][key] = JSON.parse(row.VALUE);
                } catch (e) {
                    settings[section][key] = row.VALUE;
                }
            }
        });

        return settings;
    });
}

/**
 * Update settings
 */
export async function updateSettings(newSettings) {
    return withConnection(async (conn) => {
        // Flat the object and update each field
        for (const [section, values] of Object.entries(newSettings)) {
            for (const [key, value] of Object.entries(values)) {
                const settingKey = `${section}.${key}`;
                const jsonValue = JSON.stringify(value);

                // UPSERT logic for Oracle (Merge)
                await conn.execute(
                    `MERGE INTO SETTINGS t
                     USING (SELECT :key AS key FROM dual) s
                     ON (t.KEY = s.key)
                     WHEN MATCHED THEN
                        UPDATE SET VALUE = :val, UPDATED_AT = CURRENT_TIMESTAMP
                     WHEN NOT MATCHED THEN
                        INSERT (KEY, VALUE) VALUES (:key, :val)`,
                    { key: settingKey, val: jsonValue }
                );
            }
        }
        await conn.commit();
        return { success: true };
    });
}
