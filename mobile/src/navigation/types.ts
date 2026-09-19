import type { Student } from '../types/api';

export type RootStackParamList = {
  StudentLookup: undefined;
  ReasonSelect: { student: Student };
  MyNotes: undefined;
};
