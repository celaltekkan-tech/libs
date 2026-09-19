import client from './client';
import type { TeacherNote, TeacherNotePayload } from '../types/api';

interface Envelope<T> {
  success: boolean;
  data: T;
}

export async function getTagOptions(): Promise<string[]> {
  const { data } = await client.get<Envelope<string[]>>('/api/teacher-notes/tag-options');
  return data.data;
}

export async function createTeacherNote(payload: TeacherNotePayload): Promise<void> {
  await client.post('/api/teacher-notes', payload);
}

export async function listMyTeacherNotes(): Promise<TeacherNote[]> {
  const { data } = await client.get<Envelope<TeacherNote[]>>('/api/teacher-notes/mine');
  return data.data;
}
