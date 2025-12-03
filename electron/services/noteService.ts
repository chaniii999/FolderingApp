import { randomUUID } from 'crypto';
import { getDatabase } from './database';

export interface Note {
  id: string;
  folder_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function listNotes(folderId: string): Note[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM notes WHERE folder_id = ? ORDER BY updated_at DESC');
  return stmt.all(folderId) as Note[];
}

export function getNote(id: string): Note {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM notes WHERE id = ?');
  const note = stmt.get(id) as Note;
  
  if (!note) {
    throw new Error('Note not found');
  }
  
  return note;
}

export function createNote(folderId: string, title: string, content: string): Note {
  const db = getDatabase();
  const id = randomUUID();
  const stmt = db.prepare('INSERT INTO notes (id, folder_id, title, content) VALUES (?, ?, ?, ?)');
  stmt.run(id, folderId, title, content);
  
  const selectStmt = db.prepare('SELECT * FROM notes WHERE id = ?');
  return selectStmt.get(id) as Note;
}

export function updateNote(id: string, title: string, content: string): Note {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE notes SET title = ?, content = ?, updated_at = datetime(\'now\') WHERE id = ?');
  stmt.run(title, content, id);
  
  const selectStmt = db.prepare('SELECT * FROM notes WHERE id = ?');
  const note = selectStmt.get(id) as Note;
  
  if (!note) {
    throw new Error('Note not found');
  }
  
  return note;
}

export function deleteNote(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM notes WHERE id = ?');
  stmt.run(id);
}

