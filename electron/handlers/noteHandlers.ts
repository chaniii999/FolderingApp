import { IpcMain } from 'electron';
import * as noteService from '../services/noteService';

export function noteHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('note:list', async (_event, folderId: string) => {
    try {
      return noteService.listNotes(folderId);
    } catch (error) {
      console.error('Error listing notes:', error);
      throw error;
    }
  });

  ipcMain.handle('note:get', async (_event, id: string) => {
    try {
      return noteService.getNote(id);
    } catch (error) {
      console.error('Error getting note:', error);
      throw error;
    }
  });

  ipcMain.handle('note:create', async (_event, folderId: string, title: string, content: string) => {
    try {
      return noteService.createNote(folderId, title, content);
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  });

  ipcMain.handle('note:update', async (_event, id: string, title: string, content: string) => {
    try {
      return noteService.updateNote(id, title, content);
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  });

  ipcMain.handle('note:delete', async (_event, id: string) => {
    try {
      noteService.deleteNote(id);
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  });
}

