import client from './client';
import type { Student } from '../types/api';

interface Envelope<T> {
  success: boolean;
  data: T;
}

export async function lookupStudentByNumber(number: string): Promise<Student> {
  const { data } = await client.get<Envelope<Student>>(`/api/students/lookup/${encodeURIComponent(number)}`);
  return data.data;
}
