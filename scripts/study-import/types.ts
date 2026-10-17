export interface PGNHeaders {
  [key: string]: string;
}

export interface StudyMove {
  ply: number;
  moveNumber: number;
  color: "white" | "black";
  san: string;
  uci: string | null;
  comment: string | null;
  nags: string[];
}

export interface StudyVariation {
  parentPly: number | null;
  moves: string[];
  raw: string;
}

export interface RawStudyLesson {
  id: string;
  title: string;
  studyName: string;
  source: string;

  chapterUrl: string | null;

  fen: string | null;
  sideToMove: "white" | "black" | null;

  introComment: string | null;

  moves: StudyMove[];
  variations: StudyVariation[];

  rawMoveText: string;

  headers: PGNHeaders;
}

export interface ClassifiedStudyLesson extends RawStudyLesson {
  studyId: string;
  studyTitle: string;

  ratingMin: number | null;
  ratingMax: number | null;

  lessonOrder: number;
}

export interface StudyMaterial {
  id: string;
  title: string;
  source: string;

  ratingMin: number | null;
  ratingMax: number | null;

  lessonCount: number;
}

export interface StudyLessonDocument {
  id: string;

  studyId: string;
  studyTitle: string;

  title: string;
  lessonOrder: number;

  source: string;
  chapterUrl: string | null;

  ratingMin: number | null;
  ratingMax: number | null;

  fen: string | null;
  sideToMove: "white" | "black" | null;

  introComment: string | null;

  moves: StudyMove[];
  variations: StudyVariation[];

  rawMoveText: string;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ParsedStudyFile {
  filename: string;
  study: StudyMaterial;
  lessons: ClassifiedStudyLesson[];
}
