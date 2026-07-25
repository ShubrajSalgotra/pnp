import { ChessReport } from '../types/report';

export const PRACTICE_OPPONENT_STORAGE_KEY = 'pawnsposes-practice-opponent';

export function persistPracticeOpponent(report: ChessReport) {
  sessionStorage.setItem(
    PRACTICE_OPPONENT_STORAGE_KEY,
    JSON.stringify({
      ...report,
      generatedAt:
        report.generatedAt instanceof Date
          ? report.generatedAt.toISOString()
          : report.generatedAt,
    })
  );
}

export function loadPracticeOpponent(): ChessReport | null {
  try {
    const raw = sessionStorage.getItem(PRACTICE_OPPONENT_STORAGE_KEY);
    if (!raw) return null;
    const report = JSON.parse(raw) as ChessReport;
    return {
      ...report,
      generatedAt: new Date(report.generatedAt),
    };
  } catch {
    return null;
  }
}
