import React from 'react';
import { ChessReport } from '../types/report';
import PositionDisplay from './PositionDisplay';
import {
  Target,
  BookOpen,
  Search,
  ExternalLink,
  Crosshair,
  Swords,
  ShieldAlert,
  ListChecks,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

interface ReportDisplayProps {
  report: ChessReport;
  onBack?: () => void;
}

const skillLabel = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();

const priorityStyles: Record<string, string> = {
  high: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  medium:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  low: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
};

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report }) => {
  const isOpponent = Boolean(report.scoutIntel);
  const scout = report.scoutIntel;

  const getGameAndOpponentInfo = (gameId: string): string => {
    const game = report.rawGameData.find((g) => g.id === gameId);
    if (!game) return `Game ${gameId}`;

    const gameIndex = report.rawGameData.findIndex((g) => g.id === gameId) + 1;
    const opponentName =
      game.white.name.toLowerCase() === report.username.toLowerCase()
        ? game.black.name
        : game.white.name;

    return `Game ${gameIndex} vs ${opponentName}`;
  };

  const getGameById = (gameId: string) =>
    report.rawGameData.find((g) => g.id === gameId) ||
    report.rawGameData.find((g) => g.id?.includes(gameId) || gameId.includes(g.id));

  const getPositionPly = (moveNumber: number, playerColor?: 'white' | 'black'): number => {
    const basePly = Math.max(0, (moveNumber - 1) * 2);
    return playerColor === 'black' ? basePly + 1 : basePly;
  };

  const getGamePositionUrl = (
    gameId: string,
    moveNumber: number,
    playerColor?: 'white' | 'black'
  ): string | null => {
    const game = getGameById(gameId);
    if (!game?.url) return null;

    const ply = getPositionPly(moveNumber, playerColor);
    const baseUrl = game.url.split('#')[0].split('?')[0];

    if (game.site === 'lichess') return `${baseUrl}#${ply}`;
    if (game.site === 'chess.com') {
      const analysisUrl = baseUrl.replace('/game/', '/analysis/game/');
      return `${analysisUrl}?tab=analysis&move=${ply}`;
    }
    return game.url;
  };

  const generatedLabel =
    report.generatedAt instanceof Date
      ? report.generatedAt.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : String(report.generatedAt);

  const kpis = [
    {
      label: 'Win rate',
      value: `${report.executiveSummary.winRate}%`,
      hint: `${report.executiveSummary.totalGames} games`,
    },
    {
      label: 'Accuracy',
      value: `${report.executiveSummary.averageAccuracy}%`,
      hint: 'avg when available',
    },
    {
      label: 'Rating',
      value: String(report.executiveSummary.overallRating || '—'),
      hint: report.executiveSummary.timeControlPreference,
    },
    {
      label: isOpponent ? 'Exploit first' : '#1 focus',
      value:
        report.recurringWeaknesses[0]?.title.split(' ').slice(0, 3).join(' ') ||
        (isOpponent ? 'Patterns' : 'Strategy'),
      hint: report.executiveSummary.favoriteOpenings[0] || 'Openings mix',
    },
  ];

  return (
    <div className="report-shell bg-[#F4F8F5] text-[#123826] dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 sm:py-6">
        <article className="overflow-hidden rounded-2xl border border-primary-200/70 bg-white shadow-[0_10px_40px_rgba(18,56,38,0.08)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
          {/* Hero band */}
          <header className="relative overflow-hidden border-b border-primary-100 bg-gradient-to-br from-[#185637] via-[#2C8A55] to-[#1f6d43] px-6 py-7 text-white sm:px-8">
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 85% 20%, rgba(230,173,32,0.45), transparent 40%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.12), transparent 35%)',
              }}
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/90">
                  {isOpponent ? 'Opponent dossier' : 'Performance report'}
                </p>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {report.username}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-50/90">
                  {isOpponent && scout?.battlePlanHeadline
                    ? scout.battlePlanHeadline
                    : 'Concrete patterns from your games — what to fix next, with positions you can reopen.'}
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-100/80">
                  Pawnsposes
                </p>
                <p className="mt-1 text-sm text-white/90">
                  {report.platform} · {report.gameCount} games
                </p>
                <p className="text-xs text-emerald-100/70">{generatedLabel}</p>
              </div>
            </div>
          </header>

          <div className="space-y-8 px-5 py-6 sm:px-8 sm:py-8">
            {/* KPI strip */}
            <section aria-label="Key metrics">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-slate-200/90 bg-[#F4F8F5]/80 px-3 py-3 transition-colors duration-200 hover:border-primary-300 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-primary-700"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {kpi.label}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                      {kpi.value}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {kpi.hint}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Insights */}
            <section>
              <SectionHeader
                icon={<Sparkles className="h-4 w-4" />}
                title={isOpponent ? 'Scouting read' : 'Coach insights'}
              />
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {report.executiveSummary.keyInsights.map((insight, index) => (
                  <li
                    key={index}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                  >
                    <span className="mr-2 font-mono text-xs font-semibold text-primary-700 dark:text-primary-300">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {insight}
                  </li>
                ))}
              </ul>
              {report.executiveSummary.strengthAreas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.executiveSummary.strengthAreas.map((area) => (
                    <span
                      key={area}
                      className="inline-flex items-center rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-900 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-200"
                    >
                      {isOpponent ? `Danger · ${area}` : area}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Opponent battle plan */}
            {isOpponent && scout && (
              <section>
                <SectionHeader icon={<Swords className="h-4 w-4" />} title="Battle plan" />
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <BattleCard
                    title="How to beat them"
                    icon={<Crosshair className="h-4 w-4 text-primary-600" />}
                    items={scout.howToBeatThem}
                  />
                  <BattleCard
                    title="Your edges"
                    icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
                    items={scout.yourEdges}
                  />
                  <BattleCard
                    title="Danger zones"
                    icon={<ShieldAlert className="h-4 w-4 text-rose-600" />}
                    items={scout.dangerZones}
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <PrepCard
                    title="When they have White"
                    recommendation={scout.prepVsTheirWhite.recommendation}
                    why={scout.prepVsTheirWhite.why}
                    ideas={scout.prepVsTheirWhite.keyIdeas}
                  />
                  <PrepCard
                    title="When they have Black"
                    recommendation={scout.prepVsTheirBlack.recommendation}
                    why={scout.prepVsTheirBlack.why}
                    ideas={scout.prepVsTheirBlack.keyIdeas}
                  />
                </div>
                {typeof scout.predictabilityScore === 'number' && (
                  <div className="mt-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span>Predictability</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {scout.predictabilityScore}/100
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-amber-400 transition-[width] duration-500"
                        style={{ width: `${Math.min(100, scout.predictabilityScore)}%` }}
                      />
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Weaknesses */}
            <section>
              <SectionHeader
                icon={<Search className="h-4 w-4" />}
                title={isOpponent ? 'Exploitable habits' : 'Recurring weaknesses'}
              />
              <div className="mt-3 space-y-4">
                {report.recurringWeaknesses.slice(0, 3).map((weakness, index) => {
                  const example = weakness.examples?.[0];
                  const positionUrl = example
                    ? getGamePositionUrl(example.gameId, example.moveNumber, example.playerColor)
                    : null;

                  return (
                    <div
                      key={`${weakness.title}-${index}`}
                      className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-600 font-mono text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {weakness.title}
                          </h3>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {weakness.description}
                          </p>
                          {weakness.technicalImprovement && (
                            <p className="mt-2 text-sm font-medium text-primary-800 dark:text-primary-300">
                              {weakness.technicalImprovement}
                            </p>
                          )}
                        </div>
                      </div>

                      {example && (
                        <div className="grid gap-4 p-4 lg:grid-cols-2">
                          <div className="space-y-2 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Example · {getGameAndOpponentInfo(example.gameId)} · Move{' '}
                              {example.moveNumber}
                            </p>
                            {positionUrl && (
                              <a
                                href={positionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary-700 underline-offset-2 transition-colors duration-200 hover:text-primary-900 hover:underline dark:text-primary-300"
                              >
                                Open exact position
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <p className="leading-relaxed text-slate-700 dark:text-slate-200">
                              <span className="font-semibold text-rose-700 dark:text-rose-300">
                                Mistake:{' '}
                              </span>
                              {example.mistake}
                            </p>
                            <p className="leading-relaxed text-slate-700 dark:text-slate-200">
                              <span className="font-semibold text-primary-800 dark:text-primary-300">
                                Better:{' '}
                              </span>
                              {example.betterMove}
                            </p>
                          </div>
                          {example.fenPosition && (
                            <div className="flex justify-center lg:justify-end">
                              <PositionDisplay
                                fen={example.fenPosition}
                                lastMove={example.lastMove}
                                fromSquare={example.fromSquare}
                                toSquare={example.toSquare}
                                title={`${example.playerColor === 'black' ? 'Black' : 'White'} to move`}
                                size={200}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Phase review */}
            <section>
              <SectionHeader icon={<Target className="h-4 w-4" />} title="Phase review" />
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <PhasePanel
                  title="Middlegame"
                  rating={report.middleGameAnalysis.overallRating}
                  rows={Object.entries(report.middleGameAnalysis.patterns).map(([skill, rating]) => ({
                    label: skillLabel(skill),
                    value: rating,
                    detail: `${rating}/10`,
                  }))}
                  footer={report.middleGameAnalysis.recommendations.slice(0, 2).join(' · ')}
                />
                <PhasePanel
                  title="Endgame"
                  rating={report.endgameAnalysis.overallRating}
                  rows={report.endgameAnalysis.endgameTypes.slice(0, 4).map((eg) => ({
                    label: eg.type,
                    value: eg.performance,
                    detail: `${eg.gamesPlayed}g · ${eg.successRate}%`,
                  }))}
                  footer={report.endgameAnalysis.commonMistakes.slice(0, 2).join(' · ')}
                />
              </div>
            </section>

            {/* Action plan */}
            <section>
              <SectionHeader
                icon={<ListChecks className="h-4 w-4" />}
                title={isOpponent ? 'Pre-game checklist' : 'Action plan'}
              />
              <div className="mt-3 space-y-2">
                {report.improvementPlan.immediateActions.slice(0, 4).map((action, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 transition-colors duration-200 hover:border-primary-300 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-primary-700"
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        priorityStyles[action.priority] || priorityStyles.medium
                      }`}
                    >
                      {action.priority}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white">{action.action}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {action.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{action.timeframe}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Resources */}
            <section>
              <SectionHeader icon={<BookOpen className="h-4 w-4" />} title="Study resources" />
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ResourceCard
                  eyebrow="Master game"
                  title={report.improvementPlan.resources.masterGame.players}
                  body={report.improvementPlan.resources.masterGame.description}
                  meta={report.improvementPlan.resources.masterGame.relevantConcept}
                />
                <ResourceCard
                  eyebrow="Watch"
                  title={report.improvementPlan.resources.recommendedVideo.title}
                  body={report.improvementPlan.resources.recommendedVideo.description}
                  meta={`${report.improvementPlan.resources.recommendedVideo.channel}${
                    report.improvementPlan.resources.recommendedVideo.duration
                      ? ` · ${report.improvementPlan.resources.recommendedVideo.duration}`
                      : ''
                  }`}
                  href={report.improvementPlan.resources.recommendedVideo.url}
                />
              </div>
            </section>
          </div>

          <footer className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
            Generated by Pawnsposes · {generatedLabel}
          </footer>
        </article>
      </div>
    </div>
  );
};

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-[#185637] dark:text-primary-300">
      <span className="text-primary-600 dark:text-primary-400">{icon}</span>
      {title}
    </h2>
  );
}

function BattleCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        {icon}
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((item, i) => (
          <li key={i} className="text-sm leading-snug text-slate-600 dark:text-slate-300">
            <span className="mr-1.5 font-mono text-[10px] text-slate-400">{i + 1}.</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrepCard({
  title,
  recommendation,
  why,
  ideas,
}: {
  title: string;
  recommendation: string;
  why: string;
  ideas: string[];
}) {
  return (
    <div className="rounded-xl border border-primary-200/80 bg-primary-50/40 p-4 dark:border-primary-900 dark:bg-primary-950/20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-800 dark:text-primary-300">
        {title}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{recommendation}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{why}</p>
      {ideas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {ideas.slice(0, 3).map((idea) => (
            <li key={idea} className="text-xs text-slate-600 dark:text-slate-400">
              · {idea}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhasePanel({
  title,
  rating,
  rows,
  footer,
}: {
  title: string;
  rating: number;
  rows: Array<{ label: string; value: number; detail: string }>;
  footer?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <span className="font-mono text-sm font-semibold text-primary-700 dark:text-primary-300">
          {rating}/10
        </span>
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-700 dark:text-slate-200">{row.label}</span>
              <span className="shrink-0 font-mono text-slate-500">{row.detail}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-primary-600 transition-[width] duration-500 dark:bg-primary-400"
                style={{ width: `${Math.min(100, (row.value / 10) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {footer && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {footer}
        </p>
      )}
    </div>
  );
}

function ResourceCard({
  eyebrow,
  title,
  body,
  meta,
  href,
}: {
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
      {meta && <p className="mt-2 text-xs text-slate-500">{meta}</p>}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block cursor-pointer rounded-xl border border-slate-200 p-4 transition-colors duration-200 hover:border-primary-400 hover:bg-primary-50/40 dark:border-slate-700 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">{content}</div>
  );
}

export default ReportDisplay;
