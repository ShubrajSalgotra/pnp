import { Chess } from "chess.js";

import { ParsedPuzzle } from "./types";

// ============================================================
// VALIDATE ONE PUZZLE
// ============================================================

export interface SingleValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePuzzle(puzzle: ParsedPuzzle): SingleValidationResult {
  const errors: string[] = [];

  // ----------------------------------------------------------
  // ID
  // ----------------------------------------------------------

  if (!puzzle.id) {
    errors.push("Missing puzzle ID");
  }

  // ----------------------------------------------------------
  // MODULE
  // ----------------------------------------------------------

  if (!puzzle.moduleId) {
    errors.push("Missing module ID");
  }

  if (!puzzle.moduleName) {
    errors.push("Missing module name");
  }

  // ----------------------------------------------------------
  // FEN
  // ----------------------------------------------------------

  if (!puzzle.fen) {
    errors.push("Missing FEN");
  } else {
    try {
      new Chess(puzzle.fen);
    } catch {
      errors.push("Invalid FEN");
    }
  }

  // ----------------------------------------------------------
  // SOLUTION
  // ----------------------------------------------------------

  if (!puzzle.solutionSan || puzzle.solutionSan.length === 0) {
    errors.push("Missing SAN solution");
  }

  if (!puzzle.solutionMoves || puzzle.solutionMoves.length === 0) {
    errors.push("Missing UCI solution");
  }

  // ----------------------------------------------------------
  // SOLUTION LENGTH
  // ----------------------------------------------------------

  if (puzzle.solutionSan.length !== puzzle.solutionMoves.length) {
    errors.push("SAN/UCI move count mismatch");
  }

  // ----------------------------------------------------------
  // SIDE
  // ----------------------------------------------------------

  if (puzzle.sideToMove !== "white" && puzzle.sideToMove !== "black") {
    errors.push("Invalid side to move");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// VALIDATE ALL PUZZLES
// ============================================================

export type InvalidPuzzle = {
  puzzle: ParsedPuzzle;
  errors: string[];
};

export interface ValidationResults {
  valid: ParsedPuzzle[];
  invalid: InvalidPuzzle[];
}

export function validatePuzzles(puzzles: ParsedPuzzle[]): ValidationResults {
  const valid: ParsedPuzzle[] = [];

  const invalid: InvalidPuzzle[] = [];

  for (const puzzle of puzzles) {
    const result = validatePuzzle(puzzle);

    if (result.valid) {
      valid.push(puzzle);
    } else {
      invalid.push({
        puzzle,
        errors: result.errors,
      });
    }
  }

  return {
    valid,
    invalid,
  };
}
