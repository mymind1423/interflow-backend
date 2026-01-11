import { getConnection } from "../config/db.js";

export const getSettings = async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(`SELECT KEY, VALUE, DESCRIPTION FROM SETTINGS`);

        // Convert array of objects to a simpler key-value object if preferred, 
        // or just return the array. Let's return a key-value object.
        const settings = {};
        result.rows.forEach(row => {
            settings[row[0] || row.KEY] = row[1] || row.VALUE;
        });

        res.json(settings);
    } catch (err) {
        console.error("Error fetching settings:", err);
        res.status(500).json({ error: "Failed to fetch settings" });
    } finally {
        if (conn) await conn.close();
    }
};

export const updateSetting = async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    let conn;

    try {
        conn = await getConnection();
        await conn.execute(
            `UPDATE SETTINGS SET VALUE = :value WHERE KEY = :key`,
            { value: String(value), key }
        );
        await conn.commit();
        res.json({ message: "Setting updated successfully" });
    } catch (err) {
        console.error("Error updating setting:", err);
        res.status(500).json({ error: "Failed to update setting" });
    } finally {
        if (conn) await conn.close();
    }
};
