/**
 * Core Domain Entities and Interfaces
 * As specified in design_document.md
 */

export interface TimeLog {
  id: string; // UUID or unique string
  date: string; // YYYY-MM-DD (Unique index)
  totalHours: number; // Decimal rounded to nearest 0.1 hour (e.g. 8.0, 9.6)
  notes?: string; // Optional remarks
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

export interface PeriodOfPerformance {
  id: string;
  name: string; // e.g. "POP 1 - Prime Contract"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  targetHours?: number; // Optional target total hours
}

export interface LeaveAdjustment {
  id: string;
  date: string; // YYYY-MM-DD or YYYY-MM
  adjustmentHours: number; // Rounded to nearest 0.01 hour
  reason: string;
  createdAt: string;
}

export type ViewTab = 'calculator' | 'calendar' | 'monthly' | 'pop' | 'settings';

export interface CalculatorState {
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:MM (24-hour format)
  timeOut: string; // HH:MM (24-hour format), optional
  breakMinutes: number; // Ephemeral break minutes (e.g. 30)
  notes: string;
  customTargetHours: number; // Default e.g. 8.5
}

export interface TargetCalculation {
  hours: number;
  label: string;
  targetTimeOut: string; // HH:MM or formatted 12-hour
  remainingMinutes: number;
  isReached: boolean;
  progressPercent: number;
}
