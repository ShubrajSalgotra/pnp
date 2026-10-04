import { PGNHeaders, RawPuzzle, ParsedPuzzle } from "./types";

import { createId, normalizeText } from "./parser";

// ============================================================
// CLASSIFICATION RESULT
// ============================================================

interface ClassificationResult {
  moduleId: string;
  moduleName: string;

  sectionId: string | null;
  sectionName: string | null;

  topicId: string | null;
  topicName: string | null;

  difficulty: string | null;
}

// ============================================================
// EXTRACT NUMBERED NAME
// ============================================================

function extractNumberedName(value?: string): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^\s*\d+(?:\.\d+)*\s*[.)]\s*(.+?)\s*$/);

  if (!match) {
    return null;
  }

  return normalizeText(match[1]);
}

// ============================================================
// DETECT SECTION
// ============================================================

function detectSection(headers: PGNHeaders): string | null {
  const white = headers["White"];

  if (!white) {
    return null;
  }

  /*
   * Section-style headers use ")" after the number.
   *
   * Examples:
   * 1) Introduction
   * 2) Summary Of Tactical Motifs
   * 5.1) Intermediate Exercises I
   * 8) Advanced Exercises
   *
   * Topic-style headers such as:
   * 2. Mate in One
   * 4. Double Attack
   *
   * do not match this pattern.
   */

  if (!/^\s*\d+(?:\.\d+)*\s*\)/.test(white)) {
    return null;
  }

  return normalizeText(white);
}

// ============================================================
// DETECT DIFFICULTY
// ============================================================

function detectDifficulty(headers: PGNHeaders): string | null {
  const values = [
    headers["Difficulty"],
    headers["Level"],
    headers["Section"],
    headers["White"],
    headers["Category"],
  ];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const text = normalizeText(value).toLowerCase();

    if (/\beasy\b/.test(text)) {
      return "easy";
    }

    if (/\bintermediate\b/.test(text)) {
      return "intermediate";
    }

    if (/\badvanced\b/.test(text)) {
      return "advanced";
    }

    if (/\bbeginner\b/.test(text)) {
      return "beginner";
    }

    if (/\bmedium\b/.test(text)) {
      return "medium";
    }

    if (/\bhard\b/.test(text)) {
      return "hard";
    }

    if (/\bexpert\b/.test(text)) {
      return "expert";
    }
  }

  return null;
}

// ============================================================
// DETECT TOPIC
// ============================================================

function detectTopic(headers: PGNHeaders): string | null {
  /*
   * Explicit topic metadata has highest priority.
   */

  const explicitCandidates = [
    headers["Topic"],
    headers["Theme"],
    headers["Motif"],
  ];

  for (const candidate of explicitCandidates) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeText(candidate);

    if (normalized) {
      return normalized;
    }
  }

  /*
   * Some PGNs store topics in the White header.
   *
   * Example:
   * 2. Mate in One
   * 4. Double Attack
   */

  const white = headers["White"];

  if (!white) {
    return null;
  }

  const topic = extractNumberedName(white);

  if (!topic) {
    return null;
  }

  const lowerTopic = topic.toLowerCase();

  /*
   * These are difficulty sections,
   * not tactical topics.
   */

  if (
    lowerTopic.includes("easy exercises") ||
    lowerTopic.includes("intermediate exercises") ||
    lowerTopic.includes("advanced exercises")
  ) {
    return null;
  }

  /*
   * These are general sections,
   * not tactical topics.
   */

  if (
    lowerTopic === "introduction" ||
    lowerTopic === "summary of tactical motifs"
  ) {
    return null;
  }

  return topic;
}

// ============================================================
// DETECT MODULE NAME
// ============================================================

function detectModuleName(filename: string, headers: PGNHeaders): string {
  /*
   * Prefer explicit collection/book/study metadata.
   */

  const candidates = [
    headers["Collection"],
    headers["Book"],
    headers["Study"],
    headers["Source"],
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeText(candidate);

    if (!normalized) {
      continue;
    }

    if (normalized === "?" || normalized === "*") {
      continue;
    }

    return normalized;
  }

  /*
   * Generic fallback:
   * use the PGN filename.
   */

  return normalizeText(filename.replace(/\.pgn$/i, ""));
}

// ============================================================
// CLASSIFY ONE PUZZLE
// ============================================================

export function classifyPuzzle(
  puzzle: RawPuzzle,
  filename: string,
): ClassificationResult {
  const headers = puzzle.headers;

  const moduleName = detectModuleName(filename, headers);

  const sectionName = detectSection(headers);

  const topicName = detectTopic(headers);

  const difficulty = detectDifficulty(headers);

  return {
    moduleId: createId(moduleName),

    moduleName,

    sectionId: sectionName ? createId(sectionName) : null,

    sectionName,

    topicId: topicName ? createId(topicName) : null,

    topicName,

    difficulty,
  };
}

// ============================================================
// CLASSIFY ALL PUZZLES
// ============================================================

export function classifyPuzzles(
  puzzles: RawPuzzle[],
  filename: string,
): ParsedPuzzle[] {
  return puzzles.map((puzzle) => {
    const classification = classifyPuzzle(puzzle, filename);

    return {
      ...puzzle,
      ...classification,
    };
  });
}
