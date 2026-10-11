import React, { useEffect, useState } from "react";

import { auth } from "../services/firebase";

import {
  getLeaderboard,
  getUserLeaderboardRank,
} from "../services/practiceService";

import type { LeaderboardEntry } from "../types/practice";

/* =========================================================
   TYPES
========================================================= */

type LeaderboardPeriod =
  | "weekly"
  | "monthly"
  | "allTime";

/* =========================================================
   COMPONENT
========================================================= */

const Leaderboard: React.FC = () => {
  const [period, setPeriod] =
    useState<LeaderboardPeriod>("weekly");

  const [entries, setEntries] =
    useState<LeaderboardEntry[]>([]);

  const [userRank, setUserRank] =
    useState<number | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  /* =======================================================
     LOAD LEADERBOARD
  ======================================================== */

  useEffect(() => {
    const loadLeaderboard =
      async () => {
        const user =
          auth.currentUser;

        if (!user) {
          setError(
            "Please sign in to view the leaderboard.",
          );

          setIsLoading(false);

          return;
        }

        setIsLoading(true);
        setError(null);

        try {
          const [
            leaderboard,
            rank,
          ] = await Promise.all([
            getLeaderboard(
              period,
              50,
            ),
            getUserLeaderboardRank(
              period,
              user.uid,
            ),
          ]);

          setEntries(
            leaderboard,
          );

          setUserRank(rank);
        } catch (error) {
          console.error(
            "Could not load leaderboard:",
            error,
          );

          setError(
            "Could not load the leaderboard. Please try again.",
          );
        } finally {
          setIsLoading(false);
        }
      };

    void loadLeaderboard();
  }, [period]);

  /* =======================================================
     CURRENT USER
  ======================================================== */

  const currentUserId =
    auth.currentUser?.uid;

  const currentUserEntry =
    entries.find(
      (entry) =>
        entry.userId ===
        currentUserId,
    );

  /* =======================================================
     PODIUM
  ======================================================== */

  const first =
    entries[0];

  const second =
    entries[1];

  const third =
    entries[2];

  /* =======================================================
     RENDER
  ======================================================== */

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-slate-900 bg-slate-950">

        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Pawnsposes
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Leaderboard
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Compete with other students, stay consistent,
                and climb your league.
              </p>

            </div>

            {/* Your position */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4">

              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Your position
              </p>

              <div className="mt-1 flex items-baseline gap-2">

                <span className="text-2xl font-bold text-white">
                  {userRank
                    ? `#${userRank}`
                    : "—"}
                </span>

                <span className="text-xs text-slate-500">
                  {currentUserEntry
                    ? `${currentUserEntry.points} points`
                    : "Keep training"}
                </span>

              </div>

            </div>

          </div>

        </div>

      </header>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">

        {/* ===================================================
            PERIOD TABS
        ==================================================== */}

        <div className="mb-6 flex w-full gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-1.5 sm:w-fit">

          {(
            [
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
              ["allTime", "All Time"],
            ] as const
          ).map(
            ([
              value,
              label,
            ]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setPeriod(
                    value,
                  )
                }
                className={[
                  "rounded-xl px-4 py-2.5 text-xs font-semibold transition",
                  period ===
                  value
                    ? "bg-emerald-400 text-slate-950"
                    : "text-slate-500 hover:bg-slate-800 hover:text-white",
                ].join(" ")}
              >
                {label}
              </button>
            ),
          )}

        </div>

        {/* ===================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ===================================================
            LOADING
        ==================================================== */}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">

            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />

            <p className="mt-4 text-xs text-slate-500">
              Loading leaderboard…
            </p>

          </div>
        ) : entries.length === 0 ? (

          /* =================================================
             EMPTY STATE
          ================================================== */

          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-16 text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-2xl">
              ♟
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              No rankings yet
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Complete practice challenges to earn points
              and appear on the leaderboard.
            </p>

          </div>

        ) : (

          <>

            {/* =================================================
                TOP 3
            ================================================== */}

            <section className="mb-6">

              <div className="grid items-end gap-3 sm:grid-cols-3">

                {/* SECOND */}

                <PodiumCard
                  entry={second}
                  rank={2}
                  currentUserId={
                    currentUserId
                  }
                />

                {/* FIRST */}

                <PodiumCard
                  entry={first}
                  rank={1}
                  currentUserId={
                    currentUserId
                  }
                  featured
                />

                {/* THIRD */}

                <PodiumCard
                  entry={third}
                  rank={3}
                  currentUserId={
                    currentUserId
                  }
                />

              </div>

            </section>

            {/* =================================================
                LIST
            ================================================== */}

            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

              <div className="border-b border-slate-800 px-4 py-4 sm:px-5">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      Rankings
                    </p>

                    <h2 className="mt-1 text-sm font-semibold">
                      Top students
                    </h2>

                  </div>

                  <span className="text-[10px] text-slate-600">
                    {entries.length} students
                  </span>

                </div>

              </div>

              <div>

                {entries.map(
                  (
                    entry,
                    index,
                  ) => {
                    const rank =
                      index + 1;

                    const isCurrentUser =
                      entry.userId ===
                      currentUserId;

                    return (
                      <div
                        key={
                          entry.userId
                        }
                        className={[
                          "flex items-center gap-3 border-b border-slate-800 px-4 py-4 last:border-b-0 sm:px-5",
                          isCurrentUser
                            ? "bg-emerald-400/5"
                            : "hover:bg-slate-800/40",
                        ].join(" ")}
                      >

                        {/* Rank */}

                        <div className="w-9 shrink-0 text-center">

                          <span
                            className={[
                              "text-sm font-bold",
                              rank <=
                              3
                                ? "text-emerald-400"
                                : "text-slate-500",
                            ].join(" ")}
                          >
                            {rank}
                          </span>

                        </div>

                        {/* Avatar */}

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                          {getInitials(
                            entry.displayName,
                          )}
                        </div>

                        {/* Name */}

                        <div className="min-w-0 flex-1">

                          <div className="flex items-center gap-2">

                            <p className="truncate text-sm font-semibold text-white">
                              {
                                entry.displayName
                              }
                            </p>

                            {isCurrentUser && (
                              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                                You
                              </span>
                            )}

                          </div>

                          <p className="mt-0.5 text-[10px] text-slate-600">
                            {
                              entry.league
                            }
                          </p>

                        </div>

                        {/* Points */}

                        <div className="text-right">

                          <p className="text-sm font-bold text-white">
                            {
                              entry.points
                            }
                          </p>

                          <p className="text-[9px] uppercase tracking-wider text-slate-600">
                            points
                          </p>

                        </div>

                      </div>
                    );
                  },
                )}

              </div>

            </section>

            {/* =================================================
                YOUR CARD
            ================================================== */}

            {currentUserEntry && (
              <section className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">

                <div className="flex items-center justify-between gap-4">

                  <div className="flex min-w-0 items-center gap-3">

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400 font-bold text-slate-950">
                      {getInitials(
                        currentUserEntry.displayName,
                      )}
                    </div>

                    <div className="min-w-0">

                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
                        Your current standing
                      </p>

                      <p className="mt-1 truncate text-sm font-semibold">
                        {
                          currentUserEntry.displayName
                        }
                      </p>

                    </div>

                  </div>

                  <div className="text-right">

                    <p className="text-xl font-bold text-emerald-400">
                      {userRank
                        ? `#${userRank}`
                        : "—"}
                    </p>

                    <p className="text-[9px] text-slate-600">
                      {
                        currentUserEntry.points
                      }{" "}
                      points
                    </p>

                  </div>

                </div>

              </section>
            )}

          </>
        )}

      </main>

    </div>
  );
};

/* =========================================================
   PODIUM CARD
========================================================= */

interface PodiumCardProps {
  entry?:
    | LeaderboardEntry
    | undefined;

  rank: number;

  currentUserId:
    | string
    | undefined;

  featured?: boolean;
}

const PodiumCard: React.FC<
  PodiumCardProps
> = ({
  entry,
  rank,
  currentUserId,
  featured = false,
}) => {
  if (!entry) {
    return (
      <div
        className={[
          "hidden rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center sm:block",
          featured
            ? "min-h-[190px]"
            : "min-h-[160px]",
        ].join(" ")}
      />
    );
  }

  const isCurrentUser =
    entry.userId ===
    currentUserId;

  return (
    <div
      className={[
        "rounded-2xl border p-5 text-center transition",
        featured
          ? "border-emerald-500/30 bg-slate-900 sm:-translate-y-3"
          : "border-slate-800 bg-slate-900",
        isCurrentUser
          ? "ring-1 ring-emerald-400/40"
          : "",
      ].join(" ")}
    >

      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-300">
        {rank === 1
          ? "♛"
          : rank === 2
            ? "♜"
            : "♝"}
      </div>

      <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">
        {rank === 1
          ? "Champion"
          : rank === 2
            ? "Runner-up"
            : "Third place"}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-white">
        {entry.displayName}
      </p>

      {isCurrentUser && (
        <span className="mt-2 inline-block rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
          You
        </span>
      )}

      <p className="mt-3 text-2xl font-bold text-emerald-400">
        {entry.points}
      </p>

      <p className="text-[9px] uppercase tracking-wider text-slate-600">
        points
      </p>

    </div>
  );
};

/* =========================================================
   HELPERS
========================================================= */

const getInitials = (
  name: string,
) => {
  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return "?";
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
};

export default Leaderboard;