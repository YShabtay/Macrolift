import type { AppState } from '../types/fitness';
import { getScheduleForDate, isDayCompleted, REST_DAY_ID, CUSTOM_DAY_ID } from './scheduleHelpers';

function escapeCsvField(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

/**
 * Builds a date-indexed CSV (one row per date with any activity) from the account's full
 * history: date, weigh-in, total calories/protein logged that day, and the workout completed
 * that day (if any) - for opening in Excel/Sheets for external analysis.
 */
export function buildAppStateCsv(appState: AppState): string {
  const { weightLogs, foodLog, workoutPlan, progress, schedule } = appState;

  const dates = new Set<string>();
  weightLogs.forEach((log) => dates.add(log.date));
  foodLog.forEach((entry) => dates.add(entry.date));
  progress.forEach((entry) => dates.add(entry.date));

  const sortedDates = Array.from(dates).sort();

  const header = ['תאריך', 'משקל (ק"ג)', 'קלוריות', 'חלבון (גר\')', 'אימון'];

  const rows = sortedDates.map((date) => {
    const weightEntry = weightLogs.find((log) => log.date === date);
    const dayFood = foodLog.filter((entry) => entry.date === date);
    const totalCalories = dayFood.reduce((sum, entry) => sum + entry.calories, 0);
    const totalProtein = dayFood.reduce((sum, entry) => sum + entry.proteinG, 0);

    let workoutLabel = '';
    const scheduleEntry = getScheduleForDate(schedule, date);
    const candidateDayIds =
      scheduleEntry && scheduleEntry.dayId !== REST_DAY_ID && scheduleEntry.dayId !== CUSTOM_DAY_ID
        ? [scheduleEntry.dayId]
        : workoutPlan.days.map((d) => d.id);

    for (const dayId of candidateDayIds) {
      if (isDayCompleted(workoutPlan, progress, date, dayId)) {
        const day = workoutPlan.days.find((d) => d.id === dayId);
        workoutLabel = day?.focus ?? day?.dayLabel ?? '';
        break;
      }
    }

    return [
      date,
      weightEntry ? String(weightEntry.weightKg) : '',
      dayFood.length > 0 ? String(totalCalories) : '',
      dayFood.length > 0 ? String(totalProtein) : '',
      workoutLabel,
    ];
  });

  const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(','));
  // Leading BOM so Excel detects UTF-8 and renders the Hebrew headers/content correctly
  // instead of mojibake - a well-known Excel quirk with plain UTF-8 CSV files.
  return `﻿${lines.join('\r\n')}`;
}
