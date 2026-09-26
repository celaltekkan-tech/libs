import type { Student } from '../types/api';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type RootStackParamList = {
  StudentLookup: undefined;
  ReasonSelect: { student: Student };
  MyNotes: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
  About: undefined;
};
