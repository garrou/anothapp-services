import db from "../config/db.js";
import Note from "../models/note.js";

export default class NoteRepository {
    /**
     * @returns {Promise<Note[]>}
     */
    getNotes = async () => {
        const res = await db.query(`
            SELECT id, name
            FROM notes
            ORDER BY id
        `);
        return res.rows.map((row) => new Note(row));
    }
}