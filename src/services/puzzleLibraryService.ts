import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "../services/firebase";
import {
  PuzzleDocument,
  PuzzleModule,
  PuzzleTopic,
} from "../types/puzzleLibrary";

class PuzzleLibraryService {
  /**
   * Get all puzzle modules.
   *
   * Example:
   * 1001 Chess Exercises for Beginners
   * The Woodpecker Method
   */
  async getModules(): Promise<PuzzleModule[]> {
    const modulesRef = collection(db, "puzzleModules");

    const snapshot = await getDocs(query(modulesRef, orderBy("name", "asc")));

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as PuzzleModule[];
  }

  /**
   * Get topics belonging to a module.
   */
  async getTopics(moduleId: string): Promise<PuzzleTopic[]> {
    const topicsRef = collection(db, "puzzleTopics");

    const snapshot = await getDocs(
      query(
        topicsRef,
        where("moduleId", "==", moduleId),
        orderBy("name", "asc"),
      ),
    );

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as PuzzleTopic[];
  }

  /**
   * Get a small number of puzzles for testing.
   *
   * We intentionally use a limit here.
   * During development we don't want to load all 2,207 puzzles.
   */
  async getTestPuzzles(count = 2): Promise<PuzzleDocument[]> {
    const puzzlesRef = collection(db, "puzzles");

    const snapshot = await getDocs(
      query(puzzlesRef, orderBy("id", "asc"), limit(count)),
    );

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as PuzzleDocument[];
  }

  /**
   * Get a single puzzle by its ID.
   */
  async getPuzzleById(puzzleId: string): Promise<PuzzleDocument | null> {
    const puzzleRef = doc(db, "puzzles", puzzleId);

    const snapshot = await getDoc(puzzleRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as PuzzleDocument;
  }

  /**
   * Get puzzles belonging to a topic.
   */
  async getPuzzlesByTopic(
    topicId: string,
    count = 50,
  ): Promise<PuzzleDocument[]> {
    const puzzlesRef = collection(db, "puzzles");

    const snapshot = await getDocs(
      query(
        puzzlesRef,
        where("topicId", "==", topicId),
        orderBy("id", "asc"),
        limit(count),
      ),
    );

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as PuzzleDocument[];
  }

  /**
   * Get puzzles belonging to a module.
   */
  async getPuzzlesByModule(
    moduleId: string,
    count = 50,
  ): Promise<PuzzleDocument[]> {
    const puzzlesRef = collection(db, "puzzles");

    const snapshot = await getDocs(
      query(
        puzzlesRef,
        where("moduleId", "==", moduleId),
        orderBy("id", "asc"),
        limit(count),
      ),
    );

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as PuzzleDocument[];
  }
}

export const puzzleLibraryService = new PuzzleLibraryService();