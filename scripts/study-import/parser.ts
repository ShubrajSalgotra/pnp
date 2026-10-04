import fs from "fs";
import path from "path";
import { Chess } from "chess.js";

import {
  PGNHeaders,
  RawStudyLesson,
  StudyMove,
  StudyVariation,
} from "./types";

// ============================================================
// CONSTANTS
// ============================================================

const PGN_DIRECTORY = path.join(
  process.cwd(),
  "scripts",
  "study-import",
  "pgn",
);

// Standard starting position
const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// ============================================================
// READ FILE
// ============================================================

export function readPGN(filename: string): string {
  const filePath = path.join(
    PGN_DIRECTORY,
    filename,
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `PGN file not found: ${filePath}`,
    );
  }

  return fs.readFileSync(
    filePath,
    "utf-8",
  );
}

// ============================================================
// SPLIT PGN
// ============================================================

export function splitPGN(
  pgn: string,
): string[] {
  return pgn
    .replace(/\r\n/g, "\n")
    .split(/\n(?=\[Event\s)/)
    .map((block) => block.trim())
    .filter(Boolean);
}

// ============================================================
// PARSE HEADERS
// ============================================================

export function parseHeaders(
  block: string,
): PGNHeaders {
  const headers: PGNHeaders = {};

  for (const line of block.split("\n")) {
    const match = line.match(
      /^\[([A-Za-z0-9_]+)\s+"(.*)"\]$/,
    );

    if (!match) continue;

    const [, key, value] = match;

    headers[key] = value;
  }

  return headers;
}

// ============================================================
// EXTRACT MOVETEXT
// ============================================================

export function extractMoveText(
  block: string,
): string {
  const lines = block.split("\n");

  return lines
    .filter((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return false;
      }

      return !(
        trimmed.startsWith("[") &&
        trimmed.endsWith("]")
      );
    })
    .join(" ")
    .trim();
}

// ============================================================
// NORMALIZE TEXT
// ============================================================

export function normalizeText(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

// ============================================================
// CREATE ID
// ============================================================

export function createId(
  value: string,
): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// FEN
// ============================================================

export function getFEN(
  headers: PGNHeaders,
): string | null {
  const fen = headers["FEN"];

  if (!fen) {
    return null;
  }

  return fen.trim();
}

// ============================================================
// EFFECTIVE START FEN
//
// If PGN has FEN → use it.
// If PGN is Standard and has no FEN → use standard board.
// ============================================================

export function getEffectiveFEN(
  headers: PGNHeaders,
): string | null {
  const fen = getFEN(headers);

  if (fen) {
    return fen;
  }

  const variant = normalizeText(
    headers["Variant"] ?? "",
  ).toLowerCase();

  if (
    !variant ||
    variant === "standard"
  ) {
    return STANDARD_START_FEN;
  }

  return null;
}

// ============================================================
// SIDE TO MOVE
// ============================================================

export function getSideToMove(
  fen: string | null,
): "white" | "black" | null {
  if (!fen) {
    return null;
  }

  const parts = fen.split(/\s+/);

  return parts[1] === "b"
    ? "black"
    : "white";
}

// ============================================================
// VALIDATE FEN
// ============================================================

export function isValidFEN(
  fen: string,
): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// REMOVE PGN COMMAND ANNOTATIONS
//
// Example:
// [%cal Gf3e2]
// [%clk 0:05:00]
// ============================================================

export function removeClockAnnotations(
  comment: string,
): string {
  return comment
    .replace(/\[%[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// EXTRACT COMMENT RANGES
// ============================================================

interface CommentRange {
  start: number;
  end: number;
  text: string;
}

function extractCommentRanges(
  text: string,
): CommentRange[] {
  const ranges: CommentRange[] = [];

  let depth = 0;
  let start = -1;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    const char = text[i];

    if (char === "{") {
      if (depth === 0) {
        start = i;
      }

      depth++;
      continue;
    }

    if (
      char === "}" &&
      depth > 0
    ) {
      depth--;

      if (
        depth === 0 &&
        start !== -1
      ) {
        ranges.push({
          start,
          end: i,
          text: text.slice(
            start + 1,
            i,
          ),
        });

        start = -1;
      }
    }
  }

  return ranges;
}

// ============================================================
// REMOVE COMMENTS
// ============================================================

export function removeComments(
  text: string,
): string {
  return text.replace(
    /\{[\s\S]*?\}/g,
    " ",
  );
}

// ============================================================
// REMOVE VARIATIONS
// ============================================================

export function removeVariations(
  text: string,
): string {
  let result = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(") {
      depth++;
      continue;
    }

    if (char === ")") {
      if (depth > 0) {
        depth--;
      }

      continue;
    }

    if (depth === 0) {
      result += char;
    }
  }

  return result;
}

// ============================================================
// CLEAN MAINLINE
// ============================================================

export function cleanMainline(
  text: string,
): string {
  return removeVariations(
    removeComments(text),
  )
    .replace(/\$\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// TOKENIZE MAINLINE
// ============================================================

export function tokenizeMainline(
  text: string,
): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\s+/)
    .filter((token) => {
      // Move numbers
      if (
        /^\d+\.(?:\.\.)?$/.test(token)
      ) {
        return false;
      }

      // Results
      if (
        token === "1-0" ||
        token === "0-1" ||
        token === "1/2-1/2" ||
        token === "*"
      ) {
        return false;
      }

      // NAG
      if (/^\$\d+$/.test(token)) {
        return false;
      }

      return true;
    });
}

// ============================================================
// EXTRACT NAGS
// ============================================================

function extractNags(
  comment: string,
): string[] {
  return [
    ...comment.matchAll(
      /\$(\d+)/g,
    ),
  ].map(
    (match) => `$${match[1]}`,
  );
}

// ============================================================
// COMMENT BEFORE FIRST MOVE
// ============================================================

function extractIntroComment(
  moveText: string,
): string | null {
  const firstMoveIndex =
    moveText.search(
      /\d+\.(?:\.\.)?\s*[A-Za-z]/,
    );

  // Position-only lesson
  // Everything is effectively an intro/comment.
  if (firstMoveIndex === -1) {
    const comments =
      extractCommentRanges(
        moveText,
      );

    if (comments.length === 0) {
      return null;
    }

    const text = comments
      .map((comment) =>
        removeClockAnnotations(
          comment.text,
        ),
      )
      .filter(Boolean)
      .join("\n\n");

    return text || null;
  }

  const prefix =
    moveText.slice(
      0,
      firstMoveIndex,
    );

  const comments =
    extractCommentRanges(prefix);

  if (comments.length === 0) {
    return null;
  }

  const text = comments
    .map((comment) =>
      removeClockAnnotations(
        comment.text,
      ),
    )
    .filter(Boolean)
    .join("\n\n");

  return text || null;
}

// ============================================================
// CLEAN SAN TOKEN
// ============================================================

function cleanSANToken(
  token: string,
): string | null {
  const value = token
    .replace(
      /^\d+\.(?:\.\.)?/,
      "",
    )
    .trim();

  if (!value) {
    return null;
  }

  if (
    value === "1-0" ||
    value === "0-1" ||
    value === "1/2-1/2" ||
    value === "*"
  ) {
    return null;
  }

  if (/^\$\d+$/.test(value)) {
    return null;
  }

  return value;
}

// ============================================================
// PARSE MAINLINE MOVES
// ============================================================

function parseMainlineMoves(
  moveText: string,
  startingFen: string | null,
): StudyMove[] {
  const clean =
    cleanMainline(moveText);

  const tokens =
    tokenizeMainline(clean);

  const moves: StudyMove[] = [];

  let chess: Chess | null = null;

  // Start chess engine from actual position
  if (
    startingFen &&
    isValidFEN(startingFen)
  ) {
    chess = new Chess(
      startingFen,
    );
  }

  let ply = 0;

  for (const rawToken of tokens) {
    const san =
      cleanSANToken(rawToken);

    if (!san) {
      continue;
    }

    // If we have a chess position,
    // use its actual turn/move number.
    const color =
      chess?.turn() === "b"
        ? "black"
        : "white";

    const moveNumber =
      chess
        ? chess.moveNumber()
        : Math.floor(
            ply / 2,
          ) + 1;

    let uci: string | null =
      null;

    if (chess) {
      try {
        const move =
          chess.move(san);

        if (move) {
          uci =
            `${move.from}${move.to}${
              move.promotion ?? ""
            }`;
        }
      } catch {
        // Keep SAN even if
        // a specific move cannot
        // be replayed.
        uci = null;
      }
    }

    ply++;

    moves.push({
      ply,
      moveNumber,
      color,
      san,
      uci,
      comment: null,
      nags: [],
    });
  }

  return moves;
}

// ============================================================
// ATTACH MAINLINE COMMENTS
// ============================================================

function attachMainlineComments(
  moveText: string,
  moves: StudyMove[],
): void {
  const withoutVariations =
    removeVariations(
      moveText,
    );

  const comments =
    extractCommentRanges(
      withoutVariations,
    );

  for (const comment of comments) {
    const beforeComment =
      withoutVariations.slice(
        0,
        comment.start,
      );

    const tokens =
      tokenizeMainline(
        cleanMainline(
          beforeComment,
        ),
      );

    const moveIndex =
      tokens.length - 1;

    const cleanedComment =
      removeClockAnnotations(
        comment.text,
      );

    if (!cleanedComment) {
      continue;
    }

    // Comment before first move
    if (moveIndex < 0) {
      continue;
    }

    if (
      moveIndex >= 0 &&
      moveIndex < moves.length
    ) {
      moves[
        moveIndex
      ].comment =
        cleanedComment;

      moves[
        moveIndex
      ].nags =
        extractNags(
          comment.text,
        );
    }
  }
}

// ============================================================
// EXTRACT VARIATIONS
// ============================================================

export function extractVariations(
  moveText: string,
): StudyVariation[] {
  const variations: StudyVariation[] =
    [];

  let depth = 0;
  let start = -1;

  for (
    let i = 0;
    i < moveText.length;
    i++
  ) {
    const char = moveText[i];

    if (char === "(") {
      if (depth === 0) {
        start = i;
      }

      depth++;
      continue;
    }

    if (
      char === ")" &&
      depth > 0
    ) {
      depth--;

      if (
        depth === 0 &&
        start !== -1
      ) {
        const raw =
          moveText.slice(
            start + 1,
            i,
          );

        const cleaned =
          cleanMainline(raw);

        variations.push({
          parentPly: null,
          moves:
            tokenizeMainline(
              cleaned,
            ),
          raw,
        });

        start = -1;
      }
    }
  }

  return variations;
}

// ============================================================
// DETERMINE LESSON TYPE
// ============================================================

function getLessonType(
  headers: PGNHeaders,
  fen: string | null,
  moves: StudyMove[],
): string {
  const variant =
    normalizeText(
      headers["Variant"] ?? "",
    ).toLowerCase();

  if (
    fen &&
    moves.length > 0
  ) {
    return "interactive";
  }

  if (
    fen &&
    moves.length === 0
  ) {
    return "position";
  }

  if (
    (!variant ||
      variant === "standard") &&
    moves.length > 0
  ) {
    return "game";
  }

  return "unknown";
}

// ============================================================
// PARSE ONE BLOCK
// ============================================================

export function parseBlock(
  block: string,
  source: string,
  lessonOrder: number,
): RawStudyLesson | null {
  const headers =
    parseHeaders(block);

  const studyName =
    normalizeText(
      headers["StudyName"] ??
        source,
    );

  const title =
    normalizeText(
      headers["ChapterName"] ??
        headers["Event"] ??
        `Lesson ${lessonOrder}`,
    );

  // ----------------------------------------------------------
  // Original FEN
  // ----------------------------------------------------------

  const originalFen = getFEN(headers);

  if (originalFen && !isValidFEN(originalFen)) {
    console.warn(`⚠️ Non-standard FEN preserved: ${title}`);
  }

  // ----------------------------------------------------------
  // Effective FEN
  //
  // FEN lesson:
  //     use its FEN
  //
  // Standard game:
  //     use standard starting position
  // ----------------------------------------------------------

  const effectiveFen =
    getEffectiveFEN(
      headers,
    );

  // ----------------------------------------------------------
  // MOVETEXT
  // ----------------------------------------------------------

  const moveText =
    extractMoveText(block);

  // ----------------------------------------------------------
  // MAINLINE MOVES
  // ----------------------------------------------------------

  const moves =
    parseMainlineMoves(
      moveText,
      effectiveFen,
    );

  // ----------------------------------------------------------
  // COMMENTS
  // ----------------------------------------------------------

  attachMainlineComments(
    moveText,
    moves,
  );

  // ----------------------------------------------------------
  // VARIATIONS
  // ----------------------------------------------------------

  const variations =
    extractVariations(
      moveText,
    );

  // ----------------------------------------------------------
  // INTRO COMMENT
  // ----------------------------------------------------------

  const introComment =
    extractIntroComment(
      moveText,
    );

  // ----------------------------------------------------------
  // LESSON TYPE
  // ----------------------------------------------------------

  const lessonType =
    getLessonType(
      headers,
      originalFen,
      moves,
    );

  // ----------------------------------------------------------
  // ID
  // ----------------------------------------------------------

  const id = createId(
    [
      studyName,
      lessonOrder,
      title,
      headers["ChapterURL"] ??
        "",
    ].join("-"),
  );

  // ----------------------------------------------------------
  // RETURN
  // ----------------------------------------------------------

  return {
    id,

    title,

    studyName,

    source,

    chapterUrl:
      headers["ChapterURL"] ??
      null,

    // IMPORTANT:
    // Standard games now get
    // the standard starting FEN.
    fen: effectiveFen,

    sideToMove:
      getSideToMove(
        effectiveFen,
      ),

    introComment,

    moves,

    variations,

    rawMoveText: moveText,

    headers: {
      ...headers,
      LessonType:
        lessonType,
    },
  };
}

// ============================================================
// PARSE COMPLETE PGN
// ============================================================

export function parsePGN(
  filename: string,
): RawStudyLesson[] {
  const pgn =
    readPGN(filename);

  const blocks =
    splitPGN(pgn);

  const lessons: RawStudyLesson[] =
    [];

  blocks.forEach(
    (
      block,
      index,
    ) => {
      const lesson =
        parseBlock(
          block,
          filename,
          index + 1,
        );

      if (lesson) {
        lessons.push(
          lesson,
        );
      }
    },
  );

  return lessons;
}
