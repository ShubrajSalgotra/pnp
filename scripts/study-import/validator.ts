
import {
  ClassifiedStudyLesson,
} from "./types";

import {
  isValidFEN,
} from "./parser";

export interface StudyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================
// VALIDATE ONE LESSON
// ============================================================

export function validateLesson(
  lesson: ClassifiedStudyLesson,
): StudyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ----------------------------------------------------------
  // BASIC FIELDS
  // ----------------------------------------------------------

  if (!lesson.id) {
    errors.push("Missing lesson ID.");
  }

  if (!lesson.studyId) {
    errors.push("Missing study ID.");
  }

  if (!lesson.title) {
    errors.push("Missing lesson title.");
  }

  // ----------------------------------------------------------
  // FEN
  //
  // Non-standard FEN is allowed in Study.
  // Some study chapters are diagrams/positions that are
  // not playable chess positions.
  // ----------------------------------------------------------

  if (lesson.fen) {
    if (!isValidFEN(lesson.fen)) {
      warnings.push(
        `Non-standard FEN preserved: ${lesson.title}`,
      );
    }
  }

  // ----------------------------------------------------------
  // MOVES
  //
  // No moves is valid for:
  // - position explanation
  // - introductory chapter
  // - summary chapter
  // - diagram/position lesson
  // ----------------------------------------------------------

  if (lesson.moves.length === 0) {
    warnings.push(
      `No mainline moves found: ${lesson.title}`,
    );
  }

  // ----------------------------------------------------------
  // MOVE VALIDATION
  // ----------------------------------------------------------

  for (const move of lesson.moves) {
    if (!move.san) {
      errors.push(
        `Empty SAN move at ply ${move.ply}`,
      );
    }
  }

  // ----------------------------------------------------------
  // RATING RANGE
  // ----------------------------------------------------------

  if (
    lesson.ratingMin !== null &&
    lesson.ratingMax !== null &&
    lesson.ratingMin > lesson.ratingMax
  ) {
    errors.push(
      `Invalid rating range: ${lesson.ratingMin}-${lesson.ratingMax}`,
    );
  }

  // ----------------------------------------------------------
  // RESULT
  // ----------------------------------------------------------

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// VALIDATE ALL
// ============================================================

export function validateLessons(
  lessons: ClassifiedStudyLesson[],
): {
  validLessons: ClassifiedStudyLesson[];
  invalidLessons: ClassifiedStudyLesson[];
} {
  const validLessons: ClassifiedStudyLesson[] = [];
  const invalidLessons: ClassifiedStudyLesson[] = [];

  for (const lesson of lessons) {
    const result =
      validateLesson(lesson);

    if (result.valid) {
      validLessons.push(lesson);
    } else {
      invalidLessons.push(lesson);

      console.error(
        `\n❌ ${lesson.title}`,
      );

      for (const error of result.errors) {
        console.error(
          `   ${error}`,
        );
      }
    }

    for (const warning of result.warnings) {
      console.warn(
        `⚠️  ${lesson.title}: ${warning}`,
      );
    }
  }

  return {
    validLessons,
    invalidLessons,
  };
}