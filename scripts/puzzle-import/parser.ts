import fs from "fs";
import path from "path";
import { Chess } from "chess.js";

import { PGNHeaders, ParsedPGNBlock, RawPuzzle, PuzzleSide } from "./types";

// ============================================================
// PGN DIRECTORY
// ============================================================

const PGN_DIRECTORY = path.join(
  process.cwd(),
  "scripts",
  "puzzle-import",
  "pgn",
);

// ============================================================
// READ FILE
// ============================================================

export function readPGN(filename: string): string {
  const filePath = path.join(PGN_DIRECTORY, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`PGN file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf-8");
}

// ============================================================
// SPLIT PGN
// ============================================================

export function splitPGN(pgn: string): string[] {
  return pgn
    .replace(/\r\n/g, "\n")
    .split(/\n(?=\[Event )/)
    .map((block) => block.trim())
    .filter(Boolean);
}

// ============================================================
// PARSE HEADERS
// ============================================================

export function parseHeaders(block: string): PGNHeaders {
  const headers: PGNHeaders = {};

  const lines = block.split("\n");

  for (const line of lines) {
    const match = line.match(/^\[([A-Za-z0-9_]+)\s+"(.*)"\]$/);

    if (!match) {
      continue;
    }

    const [, key, value] = match;

    headers[key] = value;
  }

  return headers;
}

// ============================================================
// EXTRACT MOVETEXT
// ============================================================

export function extractMoveText(block: string): string {
  const lines = block.split("\n");

  const moveLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Ignore PGN headers
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      continue;
    }

    if (!trimmed) {
      continue;
    }

    moveLines.push(trimmed);
  }

  return moveLines.join(" ");
}

// ============================================================
// REMOVE COMMENTS
// ============================================================

export function removeComments(text: string): string {
  return text.replace(/\{[\s\S]*?\}/g, " ").replace(/;[^\n]*/g, " ");
}

// ============================================================
// REMOVE VARIATIONS
// ============================================================

export function removeVariations(text: string): string {
  let result = text;

  let previous = "";

  while (result !== previous) {
    previous = result;

    result = result.replace(/\([^()]*\)/g, " ");
  }

  return result;
}

// ============================================================
// CLEAN MOVETEXT
// ============================================================

export function cleanMoveText(text: string): string {
  return removeVariations(removeComments(text))
    .replace(/\$\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// EXTRACT SAN MOVES
// ============================================================

export function extractSANMoves(block: string): string[] {
  const rawText = extractMoveText(block);

  const cleanText = cleanMoveText(rawText);

  if (!cleanText) {
    return [];
  }

  const tokens = cleanText.split(/\s+/);

  const moves: string[] = [];

  for (const token of tokens) {
    // Move number
    if (/^\d+\.(?:\.\.)?$/.test(token)) {
      continue;
    }

    // Result
    if (
      token === "1-0" ||
      token === "0-1" ||
      token === "1/2-1/2" ||
      token === "*"
    ) {
      continue;
    }

    // NAG
    if (/^\$\d+$/.test(token)) {
      continue;
    }

    moves.push(token);
  }

  return moves;
}

// ============================================================
// GET FEN
// ============================================================

export function getFEN(headers: PGNHeaders): string | null {
  const fen = headers["FEN"];

  if (!fen) {
    return null;
  }

  return fen.trim();
}

// ============================================================
// SIDE TO MOVE
// ============================================================

export function getSideToMove(fen: string): PuzzleSide {
  const parts = fen.split(/\s+/);

  return parts[1] === "b" ? "black" : "white";
}

// ============================================================
// VALIDATE FEN
// ============================================================

export function isValidFEN(fen: string): boolean {
  try {
    new Chess(fen);

    return true;
  } catch {
    return false;
  }
}

// ============================================================
// SAN → UCI
// ============================================================

export function convertSANToUCI(fen: string, sanMoves: string[]): string[] {
  const chess = new Chess(fen);

  const uciMoves: string[] = [];

  for (const san of sanMoves) {
    try {
      const move = chess.move(san);

      if (!move) {
        break;
      }

      const promotion = move.promotion ? move.promotion : "";

      uciMoves.push(`${move.from}${move.to}${promotion}`);
    } catch {
      break;
    }
  }

  return uciMoves;
}

// ============================================================
// NORMALIZE TEXT
// ============================================================

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

// ============================================================
// CREATE ID
// ============================================================

export function createId(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// PROBLEM NUMBER
// ============================================================

export function extractProblemNumber(headers: PGNHeaders): number | null {
  const values = [
    headers["Black"],
    headers["White"],
    headers["Round"],
    headers["Problem"],
    headers["Number"],
  ].filter(Boolean) as string[];

  for (const value of values) {
    const match = value.match(/(?:problem|exercise|puzzle)?\s*#?\s*(\d+)/i);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

// ============================================================
// TITLE
// ============================================================

export function extractTitle(headers: PGNHeaders): string {
  const candidates = [
    headers["Black"],
    headers["White"],
    headers["Round"],
    headers["Problem"],
  ];

  for (const value of candidates) {
    if (value && normalizeText(value)) {
      return normalizeText(value);
    }
  }

  return "Untitled Puzzle";
}

// ============================================================
// PARSE ONE BLOCK
// ============================================================

export function parseBlock(block: string, source: string): RawPuzzle | null {
  const headers = parseHeaders(block);

  const fen = getFEN(headers);

  /*
   * A block without FEN is not treated
   * as a puzzle.
   */

  if (!fen) {
    return null;
  }

  /*
   * Invalid FEN.
   */

  if (!isValidFEN(fen)) {
    return null;
  }

  const solutionSan = extractSANMoves(block);

  /*
   * No moves = no playable puzzle.
   */

  if (solutionSan.length === 0) {
    return null;
  }

  const solutionMoves = convertSANToUCI(fen, solutionSan);

  /*
   * If first move cannot be validated,
   * don't import the puzzle.
   */

  if (solutionMoves.length === 0) {
    return null;
  }

  const sideToMove = getSideToMove(fen);

  const problemNumber = extractProblemNumber(headers);

  const title = extractTitle(headers);

  const id = createId([source, problemNumber ?? "", title, fen].join("-"));

  return {
    id,

    title,

    fen,

    sideToMove,

    solutionSan,

    solutionMoves,

    source,

    sourceProblemNumber: problemNumber,

    headers,
  };
}

// ============================================================
// PARSE COMPLETE PGN
// ============================================================

export function parsePGN(filename: string): RawPuzzle[] {
  const pgn = readPGN(filename);

  const blocks = splitPGN(pgn);

  const puzzles: RawPuzzle[] = [];

  for (const block of blocks) {
    const puzzle = parseBlock(block, filename);

    if (puzzle) {
      puzzles.push(puzzle);
    }
  }

  return puzzles;
}
