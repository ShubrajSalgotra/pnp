import fs from "fs";
import path from "path";

import { cert, getApps, initializeApp } from "firebase-admin/app";

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

import { ClassifiedStudyLesson, StudyMaterial } from "./types";

// ============================================================
// FIREBASE ADMIN
// ============================================================

function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json");

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `serviceAccountKey.json not found at ${serviceAccountPath}`,
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
// IMPORT STUDY
// ============================================================

export async function importStudy(
  study: StudyMaterial,
  lessons: ClassifiedStudyLesson[],
): Promise<{
  studyWritten: boolean;
  lessonsWritten: number;
}> {
  const db = getFirebaseAdmin();

  const batchLimit = 450;

  let batch = db.batch();
  let operationCount = 0;

  // ----------------------------------------------------------
  // STUDY DOCUMENT
  // ----------------------------------------------------------

  const studyRef = db.collection("studyMaterials").doc(study.id);

  batch.set(
    studyRef,
    {
      id: study.id,
      title: study.title,
      source: study.source,

      ratingMin: study.ratingMin,
      ratingMax: study.ratingMax,

      lessonCount: study.lessonCount,

      updatedAt: FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  operationCount++;

  // ----------------------------------------------------------
  // LESSON DOCUMENTS
  // ----------------------------------------------------------

  for (const lesson of lessons) {
    const lessonRef = db.collection("studyLessons").doc(lesson.id);

    batch.set(
      lessonRef,
      {
        id: lesson.id,

        studyId: lesson.studyId,
        studyTitle: lesson.studyTitle,

        title: lesson.title,
        lessonOrder: lesson.lessonOrder,

        source: lesson.source,
        chapterUrl: lesson.chapterUrl,

        ratingMin: lesson.ratingMin,
        ratingMax: lesson.ratingMax,

        fen: lesson.fen,
        sideToMove: lesson.sideToMove,

        introComment: lesson.introComment,

        moves: lesson.moves,
        variations: lesson.variations,

        rawMoveText: lesson.rawMoveText,

        updatedAt: FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    operationCount++;

    if (operationCount >= batchLimit) {
      await batch.commit();

      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return {
    studyWritten: true,
    lessonsWritten: lessons.length,
  };
}
