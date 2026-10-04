import { ClassifiedStudyLesson, RawStudyLesson, StudyMaterial } from "./types";

import { createId, normalizeText } from "./parser";

// ============================================================
// RATING RANGE
// ============================================================

export function extractRatingRange(studyName: string): {
  ratingMin: number | null;
  ratingMax: number | null;
} {
  const match = studyName.match(/(\d{3,4})\s*-\s*(\d{3,4})/);

  if (!match) {
    return {
      ratingMin: null,
      ratingMax: null,
    };
  }

  return {
    ratingMin: Number(match[1]),
    ratingMax: Number(match[2]),
  };
}

// ============================================================
// STUDY NAME
// ============================================================

export function extractStudyName(
  lessons: RawStudyLesson[],
  filename: string,
): string {
  if (lessons.length > 0) {
    return normalizeText(lessons[0].studyName);
  }

  return normalizeText(filename.replace(/\.pgn$/i, ""));
}

// ============================================================
// CREATE STUDY
// ============================================================

export function classifyStudy(
  lessons: RawStudyLesson[],
  filename: string,
): {
  study: StudyMaterial;
  lessons: ClassifiedStudyLesson[];
} {
  const studyTitle = extractStudyName(lessons, filename);

  const { ratingMin, ratingMax } = extractRatingRange(studyTitle);

  const studyId = createId(studyTitle);

  const classifiedLessons = lessons.map((lesson, index) => ({
    ...lesson,

    studyId,

    studyTitle,

    ratingMin,

    ratingMax,

    lessonOrder: index + 1,
  }));

  return {
    study: {
      id: studyId,
      title: studyTitle,
      source: filename,

      ratingMin,
      ratingMax,

      lessonCount: classifiedLessons.length,
    },

    lessons: classifiedLessons,
  };
}
