import { Timestamp } from "firebase/firestore";

export interface PuzzleModule {
  id: string;
  name: string;
  slug: string;
  source: string;
  puzzleCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PuzzleTopic {
  id: string;
  moduleId: string;
  name: string;
  slug: string;
  puzzleCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PuzzleDocument {
  id: string;

  moduleId: string;

  topicId: string | null;
  topicName: string | null;

  sectionId: string | null;
  sectionName: string | null;

  difficulty: string | null;

  title: string;

  fen: string;
  sideToMove: "white" | "black";

  solutionMoves: string[];
  solutionSan: string[];

  source: string;
  sourceProblemNumber: number | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
