import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, WriteBatch } from "firebase-admin/firestore";

import fs from "fs";
import path from "path";

import { ParsedPuzzle } from "./types";

// ============================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json");

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service account file not found:\n${serviceAccountPath}`,
    );
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf-8"),
  );

  initializeApp({
    credential: cert(serviceAccount),
  });

  return getFirestore();
}

// ============================================================
// TYPES
// ============================================================

interface ImportStats {
  modules: number;
  topics: number;
  puzzles: number;
}

// ============================================================
// IMPORT PUZZLES
// ============================================================

export async function importPuzzles(
  puzzles: ParsedPuzzle[],
): Promise<ImportStats> {
  const db = initializeFirebaseAdmin();

  const stats: ImportStats = {
    modules: 0,
    topics: 0,
    puzzles: 0,
  };

  // ----------------------------------------------------------
  // Collect modules
  // ----------------------------------------------------------

  const modules = new Map<
    string,
    {
      id: string;
      name: string;
      source: string;
      puzzleCount: number;
    }
  >();

  // ----------------------------------------------------------
  // Collect topics
  // ----------------------------------------------------------

  const topics = new Map<
    string,
    {
      id: string;
      moduleId: string;
      name: string;
      puzzleCount: number;
    }
  >();

  for (const puzzle of puzzles) {
    // ------------------------------
    // Module
    // ------------------------------

    if (!modules.has(puzzle.moduleId)) {
      modules.set(puzzle.moduleId, {
        id: puzzle.moduleId,
        name: puzzle.moduleName,
        source: puzzle.source,
        puzzleCount: 0,
      });
    }

    modules.get(puzzle.moduleId)!.puzzleCount++;

    // ------------------------------
    // Topic
    // ------------------------------

    if (puzzle.topicId && puzzle.topicName) {
      if (!topics.has(puzzle.topicId)) {
        topics.set(puzzle.topicId, {
          id: puzzle.topicId,
          moduleId: puzzle.moduleId,
          name: puzzle.topicName,
          puzzleCount: 0,
        });
      }

      topics.get(puzzle.topicId)!.puzzleCount++;
    }
  }

  // ==========================================================
  // MODULES
  // ==========================================================

  let batch: WriteBatch = db.batch();
  let operationCount = 0;

  for (const module of modules.values()) {
    const ref = db.collection("puzzleModules").doc(module.id);

    batch.set(
      ref,
      {
        id: module.id,
        name: module.name,
        slug: module.id,
        source: module.source,
        puzzleCount: module.puzzleCount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    operationCount++;
    stats.modules++;

    if (operationCount === 450) {
      await batch.commit();

      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  // ==========================================================
  // TOPICS
  // ==========================================================

  batch = db.batch();
  operationCount = 0;

  for (const topic of topics.values()) {
    const ref = db.collection("puzzleTopics").doc(topic.id);

    batch.set(
      ref,
      {
        id: topic.id,
        moduleId: topic.moduleId,
        name: topic.name,
        slug: topic.id,
        puzzleCount: topic.puzzleCount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    operationCount++;
    stats.topics++;

    if (operationCount === 450) {
      await batch.commit();

      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  // ==========================================================
  // PUZZLES
  // ==========================================================

  batch = db.batch();
  operationCount = 0;

  for (const puzzle of puzzles) {
    const ref = db.collection("puzzles").doc(puzzle.id);

    batch.set(
      ref,
      {
        id: puzzle.id,

        moduleId: puzzle.moduleId,

        topicId: puzzle.topicId,
        topicName: puzzle.topicName,

        sectionId: puzzle.sectionId,
        sectionName: puzzle.sectionName,

        difficulty: puzzle.difficulty,

        title: puzzle.title,

        fen: puzzle.fen,
        sideToMove: puzzle.sideToMove,

        solutionMoves: puzzle.solutionMoves,
        solutionSan: puzzle.solutionSan,

        source: puzzle.source,
        sourceProblemNumber: puzzle.sourceProblemNumber,

        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    operationCount++;
    stats.puzzles++;

    if (operationCount === 450) {
      await batch.commit();

      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return stats;
}
