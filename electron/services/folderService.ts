import { randomUUID } from 'crypto';
import { getDatabase } from './database';

export interface Folder {
  id: string;
  name: string;
  created_at: string;
}

export function listFolders(): Folder[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM folders ORDER BY created_at DESC');
  return stmt.all() as Folder[];
}

export function createFolder(name: string): Folder {
  const db = getDatabase();
  const id = randomUUID();
  const stmt = db.prepare('INSERT INTO folders (id, name) VALUES (?, ?)');
  stmt.run(id, name);
  
  const selectStmt = db.prepare('SELECT * FROM folders WHERE id = ?');
  return selectStmt.get(id) as Folder;
}

export function updateFolder(id: string, name: string): Folder {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE folders SET name = ? WHERE id = ?');
  stmt.run(name, id);
  
  const selectStmt = db.prepare('SELECT * FROM folders WHERE id = ?');
  const folder = selectStmt.get(id) as Folder;
  
  if (!folder) {
    throw new Error('Folder not found');
  }
  
  return folder;
}

export function deleteFolder(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM folders WHERE id = ?');
  stmt.run(id);
}

