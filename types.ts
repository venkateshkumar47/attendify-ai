
export type AttendanceStatus = 'Present' | 'Absent' | 'Late';

export interface Student {
  id: string;
  name: string;
  email: string;
  grade: string;
  admissionDate: string;
}

export interface AttendanceRecord {
  studentId: string;
  date: string;
  status: AttendanceStatus;
}

export interface AttendanceStats {
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  attendanceRate: number;
}
