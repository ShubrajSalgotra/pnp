export type PuzzleSide = "white" | "black";

export interface PGNHeaders {
  [key: string]: string;
}

export interface ParsedPGNBlock {
  headers: PGNHeaders;
  moveText: string;
}

export interface RawPuzzle {
  id: string;

  title: string;

  fen: string;

  sideToMove: PuzzleSide;

  solutionSan: string[];

  solutionMoves: string[];

  source: string;

  sourceProblemNumber: number | null;

  headers: PGNHeaders;
}

export interface ClassifiedPuzzle {
  moduleId: string;
  moduleName: string;

  sectionId: string | null;
  sectionName: string | null;

  topicId: string | null;
  topicName: string | null;

  difficulty: string | null;
}

export interface ParsedPuzzle extends RawPuzzle, ClassifiedPuzzle {}

export interface PuzzleModule {
  id: string;
  name: string;
}

export interface PuzzleTopic {
  id: string;
  moduleId: string;

  name: string;

  difficulty: string | null;

  puzzleCount: number;
}

export interface ParsedPuzzleFile {
  filename: string;

  module: PuzzleModule;

  puzzles: ParsedPuzzle[];
}
