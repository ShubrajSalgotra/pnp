import { Chess } from 'chess.js';
import {
  STOCKFISH_ELO_MIN,
  clampStockfishElo,
  sanitizeTargetElo,
  subFloorBlunderChance,
} from '../utils/opponentRating';

type StockfishListener = (line: string) => void;

const ENGINE_PATH = '/stockfish.js';
const DEFAULT_DEPTH = 12;

class StockfishService {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private listeners = new Set<StockfishListener>();
  private commandQueue: Promise<void> = Promise.resolve();
  private generation = 0;
  /** Current UCI_Elo when LimitStrength is on; null = full strength. */
  private limitedElo: number | null = null;

  private emit(line: string) {
    this.listeners.forEach((listener) => listener(line));
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(ENGINE_PATH);
    worker.onmessage = (event: MessageEvent<string>) => {
      const line = typeof event.data === 'string' ? event.data : String(event.data);
      this.emit(line);
    };
    worker.onerror = (error) => {
      console.error('Stockfish worker error:', error);
    };
    this.worker = worker;
    return worker;
  }

  private post(command: string) {
    this.ensureWorker().postMessage(command);
  }

  private waitFor(predicate: (line: string) => boolean, timeoutMs = 30000): Promise<string> {
    const generation = this.generation;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.listeners.delete(onLine);
        reject(new Error(`Stockfish timed out waiting for response (${timeoutMs}ms)`));
      }, timeoutMs);

      const onLine = (line: string) => {
        if (this.generation !== generation) {
          window.clearTimeout(timer);
          this.listeners.delete(onLine);
          reject(new Error('Stockfish analysis cancelled'));
          return;
        }
        if (!predicate(line)) return;
        window.clearTimeout(timer);
        this.listeners.delete(onLine);
        resolve(line);
      };

      this.listeners.add(onLine);
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.commandQueue.then(task, task);
    this.commandQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      this.ensureWorker();
      this.post('uci');
      await this.waitFor((line) => line === 'uciok');
      this.post('setoption name Contempt value 0');
      this.post('isready');
      await this.waitFor((line) => line === 'readyok');
    })();

    try {
      await this.readyPromise;
    } catch (error) {
      this.readyPromise = null;
      this.terminate();
      throw error;
    }
  }

  private async applyStrengthLimit(elo: number | null): Promise<void> {
    if (elo == null) {
      this.post('setoption name UCI_LimitStrength value false');
      this.post('setoption name Skill Level value 20');
      this.limitedElo = null;
    } else {
      const clamped = clampStockfishElo(elo);
      this.post('setoption name UCI_LimitStrength value true');
      this.post(`setoption name UCI_Elo value ${clamped}`);
      // Skill Level 0 stacks with the Elo floor when targeting sub-1320 humans.
      this.post(
        `setoption name Skill Level value ${elo < STOCKFISH_ELO_MIN ? 0 : 20}`
      );
      this.limitedElo = clamped;
    }
    this.post('isready');
    await this.waitFor((line) => line === 'readyok');
  }

  /** Full-strength analysis helper — always disables UCI strength limiting. */
  private async ensureFullStrength(): Promise<void> {
    await this.applyStrengthLimit(null);
  }

  private pickWeakerLegalMove(fen: string, avoidUci: string | null): string | null {
    try {
      const chess = new Chess(fen);
      const legal = chess.moves({ verbose: true });
      if (legal.length <= 1) return null;

      const alternatives = legal.filter((move) => {
        const uci = `${move.from}${move.to}${move.promotion || ''}`;
        return uci !== avoidUci;
      });
      if (!alternatives.length) return null;

      // Bias toward quieter mistakes at low ratings: prefer non-checks slightly.
      const quiet = alternatives.filter((move) => !move.san.includes('+') && !move.san.includes('#'));
      const pool = quiet.length > 0 && Math.random() < 0.7 ? quiet : alternatives;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return `${pick.from}${pick.to}${pick.promotion || ''}`;
    } catch {
      return null;
    }
  }

  /**
   * Play a move aimed at `elo`.
   * Stockfish UCI_Elo floors at 1320 — below that we use the floor + Skill Level 0
   * and inject extra weaker moves so ~800-rated opponents aren't bumped to 1320.
   */
  async getBestMoveAtElo(
    fen: string,
    elo: number,
    moveTimeMs = 800
  ): Promise<{ bestMoveUci: string | null; elo: number; uciElo: number }> {
    return this.enqueue(async () => {
      await this.init();

      const targetElo = sanitizeTargetElo(elo);
      const uciElo = clampStockfishElo(targetElo);
      const belowFloor = targetElo < STOCKFISH_ELO_MIN;
      const thinkMs = belowFloor
        ? Math.max(80, Math.round(120 + (targetElo / STOCKFISH_ELO_MIN) * 280))
        : Math.max(100, Math.round(moveTimeMs));

      await this.applyStrengthLimit(targetElo);
      this.post('stop');
      this.post('setoption name MultiPV value 1');
      this.post(`position fen ${fen}`);
      this.post(`go movetime ${thinkMs}`);

      const bestMoveLine = await this.waitFor(
        (line) => line.startsWith('bestmove '),
        Math.max(15000, thinkMs + 5000)
      );
      const match = bestMoveLine.match(/^bestmove\s+(\S+)/);
      let bestMoveUci = match && match[1] !== '(none)' ? match[1] : null;

      if (belowFloor && bestMoveUci) {
        const blunderChance = subFloorBlunderChance(targetElo);
        if (Math.random() < blunderChance) {
          const weaker = this.pickWeakerLegalMove(fen, bestMoveUci);
          if (weaker) bestMoveUci = weaker;
        }
      }

      return {
        bestMoveUci,
        elo: targetElo,
        uciElo,
      };
    });
  }

  async evaluatePosition(
    fen: string,
    depth = DEFAULT_DEPTH
  ): Promise<{ evaluation: number; bestMoveUci: string | null; depth: number }> {
    return this.enqueue(async () => {
      await this.init();
      await this.ensureFullStrength();

      let evaluation = 0;
      let resolvedDepth = 0;
      let bestMoveUci: string | null = null;
      const generation = this.generation;

      const onInfo = (line: string) => {
        if (this.generation !== generation) return;
        if (!line.startsWith('info ') || !line.includes(' score ')) return;

        const depthMatch = line.match(/\bdepth (\d+)\b/);
        if (depthMatch) {
          resolvedDepth = Math.max(resolvedDepth, parseInt(depthMatch[1], 10));
        }

        const mateMatch = line.match(/\bscore mate (-?\d+)\b/);
        if (mateMatch) {
          const mateIn = parseInt(mateMatch[1], 10);
          evaluation = mateIn > 0 ? 100000 - mateIn * 100 : -100000 - mateIn * 100;
          return;
        }

        const cpMatch = line.match(/\bscore cp (-?\d+)\b/);
        if (cpMatch) {
          evaluation = parseInt(cpMatch[1], 10);
        }
      };

      this.listeners.add(onInfo);

      try {
        this.post('stop');
        this.post(`position fen ${fen}`);
        this.post(`go depth ${depth}`);

        const bestMoveLine = await this.waitFor(
          (line) => line.startsWith('bestmove '),
          Math.max(20000, depth * 2500)
        );
        const match = bestMoveLine.match(/^bestmove\s+(\S+)/);
        bestMoveUci = match && match[1] !== '(none)' ? match[1] : null;
      } finally {
        this.listeners.delete(onInfo);
      }

      if (this.generation !== generation) {
        throw new Error('Stockfish analysis cancelled');
      }

      // Stockfish scores are from the side to move. Convert to white-centric.
      const sideToMove = fen.split(' ')[1];
      const whiteCentric = sideToMove === 'b' ? -evaluation : evaluation;

      return {
        evaluation: whiteCentric,
        bestMoveUci,
        depth: resolvedDepth || depth,
      };
    });
  }

  /**
   * MultiPV candidate moves for more human-like bot play (UCI strings).
   * Scores are white-centric centipawns.
   */
  async getCandidateMoves(
    fen: string,
    depth = 8,
    multiPv = 3
  ): Promise<Array<{ moveUci: string; evaluation: number; depth: number }>> {
    return this.enqueue(async () => {
      await this.init();
      await this.ensureFullStrength();

      const pvCount = Math.max(1, Math.min(5, multiPv));
      const candidates = new Map<number, { moveUci: string; evaluation: number; depth: number }>();
      const generation = this.generation;
      const sideToMove = fen.split(' ')[1];

      const onInfo = (line: string) => {
        if (this.generation !== generation) return;
        if (!line.startsWith('info ') || !line.includes(' pv ')) return;

        const multipvMatch = line.match(/\bmultipv (\d+)\b/);
        const pvIndex = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
        const pvMatch = line.match(/\bpv (\S+)/);
        if (!pvMatch) return;

        let evaluation = 0;
        const mateMatch = line.match(/\bscore mate (-?\d+)\b/);
        if (mateMatch) {
          const mateIn = parseInt(mateMatch[1], 10);
          evaluation = mateIn > 0 ? 100000 - mateIn * 100 : -100000 - mateIn * 100;
        } else {
          const cpMatch = line.match(/\bscore cp (-?\d+)\b/);
          if (cpMatch) evaluation = parseInt(cpMatch[1], 10);
        }

        const depthMatch = line.match(/\bdepth (\d+)\b/);
        const resolvedDepth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
        const whiteCentric = sideToMove === 'b' ? -evaluation : evaluation;

        candidates.set(pvIndex, {
          moveUci: pvMatch[1],
          evaluation: whiteCentric,
          depth: resolvedDepth,
        });
      };

      this.listeners.add(onInfo);

      try {
        this.post('stop');
        this.post(`setoption name MultiPV value ${pvCount}`);
        this.post(`position fen ${fen}`);
        this.post(`go depth ${depth}`);
        await this.waitFor(
          (line) => line.startsWith('bestmove '),
          Math.max(20000, depth * 2500)
        );
      } finally {
        this.listeners.delete(onInfo);
        this.post('setoption name MultiPV value 1');
      }

      if (this.generation !== generation) {
        throw new Error('Stockfish analysis cancelled');
      }

      return Array.from(candidates.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value)
        .filter((c) => c.moveUci && c.moveUci !== '(none)');
    });
  }

  async newGame(): Promise<void> {
    return this.enqueue(async () => {
      await this.init();
      this.post('ucinewgame');
      this.post('isready');
      await this.waitFor((line) => line === 'readyok');
    });
  }

  /** Restore full engine strength (e.g. after practice). */
  async clearStrengthLimit(): Promise<void> {
    return this.enqueue(async () => {
      await this.init();
      await this.applyStrengthLimit(null);
    });
  }

  terminate() {
    this.generation += 1;
    this.limitedElo = null;
    if (this.worker) {
      try {
        this.worker.postMessage('stop');
        this.worker.postMessage('quit');
      } catch {
        // ignore
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.readyPromise = null;
    this.listeners.clear();
    this.commandQueue = Promise.resolve();
  }
}

export const stockfishService = new StockfishService();
export const STOCKFISH_DEPTH = DEFAULT_DEPTH;
