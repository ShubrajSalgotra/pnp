import React, { useEffect, useState } from "react";
import { auth } from "../services/firebase";
import {
  getLeaderboard,
  getUserLeaderboardRank,
} from "../services/practiceService";
import type { LeaderboardEntry } from "../types/practice";
import { PageHeader } from "./layout/PageHeader";
import EmptyState from "./ui/EmptyState";
import {
  Award,
  Crown,
  Medal,
  Trophy,
} from "lucide-react";

type LeaderboardPeriod = "weekly" | "monthly" | "allTime";

const Leaderboard: React.FC = () => {
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      const user = auth.currentUser;
      if (!user) {
        setError("Please sign in to view the leaderboard.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [leaderboard, rank] = await Promise.all([
          getLeaderboard(period, 50),
          getUserLeaderboardRank(period, user.uid),
        ]);

        setEntries(leaderboard);
        setUserRank(rank);
      } catch (err) {
        console.error("Could not load leaderboard:", err);
        setError("Could not load the leaderboard. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadLeaderboard();
  }, [period]);

  const currentUserId = auth.currentUser?.uid;
  const currentUserEntry = entries.find((entry) => entry.userId === currentUserId);

  const first = entries[0];
  const second = entries[1];
  const third = entries[2];

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="COMPETITION"
        title="Student Leaderboard"
        description="Compete with fellow chess students, maintain daily training consistency, and climb the ranking divisions."
        actions={
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-5 py-3 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Your Rank
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {userRank ? `#${userRank}` : "—"}
                </span>
                <span className="text-xs font-semibold text-primary-600 dark:text-emerald-400">
                  {currentUserEntry ? `${currentUserEntry.points} pts` : "Keep training"}
                </span>
              </div>
            </div>
          </div>
        }
      />

      {/* Time Period Filter Tabs */}
      <div className="flex items-center gap-2">
        {(
          [
            ["weekly", "Weekly Arena"],
            ["monthly", "Monthly League"],
            ["allTime", "All-Time Legends"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
              period === value
                ? "bg-primary-600 text-white shadow-xs"
                : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600 dark:border-slate-700 dark:border-t-emerald-400" />
          <p className="text-xs font-semibold text-slate-500">
            Calculating current league standings…
          </p>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No Rankings in this Period"
          description="Solve practice puzzles and tactical challenges to earn points and claim your spot on the leaderboard!"
        />
      ) : (
        <div className="space-y-8">
          {/* Top 3 Podium (when at least 1 entry exists) */}
          <section className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
            {/* Runner-up: Rank 2 */}
            <PodiumCard
              entry={second}
              rank={2}
              currentUserId={currentUserId}
            />

            {/* Champion: Rank 1 */}
            <PodiumCard
              entry={first}
              rank={1}
              currentUserId={currentUserId}
              featured
            />

            {/* Third place: Rank 3 */}
            <PodiumCard
              entry={third}
              rank={3}
              currentUserId={currentUserId}
            />
          </section>

          {/* Full Rankings Table/List */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90">
            <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Standings
                </span>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Full Rankings List
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {entries.length} Students
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = entry.userId === currentUserId;

                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-4 px-6 py-3.5 transition-colors ${
                      isCurrentUser
                        ? "bg-primary-50/80 dark:bg-primary-950/20 font-semibold"
                        : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className="w-8 shrink-0 text-center font-display font-bold">
                      {rank === 1 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-xs">
                          1
                        </span>
                      ) : rank === 2 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">
                          2
                        </span>
                      ) : rank === 3 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-900/15 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                          3
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">#{rank}</span>
                      )}
                    </div>

                    {/* Initials Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                      {getInitials(entry.displayName)}
                    </div>

                    {/* Student Name & Division */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {entry.displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="rounded-full bg-primary-600 px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider text-white">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {entry.league || "Open Division"}
                      </p>
                    </div>

                    {/* Points */}
                    <div className="text-right">
                      <p className="font-display text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        {entry.points.toLocaleString()}
                      </p>
                      <p className="text-[10px] uppercase font-bold text-slate-400">
                        pts
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

/* =========================================================
   PODIUM CARD (TOP 3)
========================================================= */

interface PodiumCardProps {
  entry?: LeaderboardEntry;
  rank: number;
  currentUserId?: string;
  featured?: boolean;
}

const PodiumCard: React.FC<PodiumCardProps> = ({
  entry,
  rank,
  currentUserId,
  featured = false,
}) => {
  if (!entry) {
    return (
      <div
        className={`hidden rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/50 p-6 text-center dark:border-slate-800/80 dark:bg-slate-900/30 sm:block ${
          featured ? "min-h-[220px]" : "min-h-[190px]"
        }`}
      />
    );
  }

  const isCurrentUser = entry.userId === currentUserId;

  const rankBadge =
    rank === 1 ? (
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm dark:bg-amber-500/20 dark:text-amber-300">
        <Crown className="h-6 w-6" />
      </div>
    ) : rank === 2 ? (
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-200 text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-300">
        <Medal className="h-5 w-5" />
      </div>
    ) : (
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-900/15 text-amber-800 shadow-sm dark:bg-amber-900/30 dark:text-amber-400">
        <Award className="h-5 w-5" />
      </div>
    );

  const title = rank === 1 ? "1st · Champion" : rank === 2 ? "2nd · Runner-up" : "3rd · Bronze";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 text-center transition-all duration-200 ${
        featured
          ? "border-primary-500/30 bg-white shadow-md sm:-translate-y-3 dark:border-primary-400/30 dark:bg-slate-900"
          : "border-slate-200/90 bg-white shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90"
      } ${
        isCurrentUser
          ? "ring-2 ring-primary-500 dark:ring-emerald-400"
          : ""
      }`}
    >
      {rankBadge}

      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <p className="mt-1 truncate font-display text-base font-bold text-slate-900 dark:text-white">
        {entry.displayName}
      </p>

      {isCurrentUser && (
        <span className="mt-1.5 inline-block rounded-full bg-primary-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-800 dark:bg-primary-500/20 dark:text-emerald-300">
          You
        </span>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="font-display text-2xl font-bold text-primary-700 dark:text-emerald-400 tabular-nums">
          {entry.points.toLocaleString()}
        </p>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          points
        </span>
      </div>
    </div>
  );
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default Leaderboard;