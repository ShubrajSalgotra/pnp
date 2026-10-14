import React, { useEffect, useState } from 'react';
import { ArrowRight, Bot, Plus, Search, Swords, UserCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatCard } from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import { ChessReport, GameReportRequest, ReportGenerationProgress } from '../types/report';
import { PlayerAnalysisProfile } from '../types/profileAnalysis';
import { useAuth } from '../contexts/AuthContext';
import { reportService } from '../services/reportService';
import { userDataService } from '../services/userDataService';
import { profileAnalysisService } from '../services/profileAnalysisService';
import OpponentDashboardPopup from '../components/OpponentDashboardPopup';
import { persistPracticeOpponent } from '../utils/practiceOpponent';
import { useNavigate } from 'react-router-dom';

const GameAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [savedReports, setSavedReports] = useState<ChessReport[]>([]);
  const [activeReport, setActiveReport] = useState<ChessReport | null>(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<ReportGenerationProgress | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [yourProfile, setYourProfile] = useState<PlayerAnalysisProfile | null>(null);

  const reviveReport = (report: ChessReport): ChessReport => ({
    ...report,
    generatedAt: report.generatedAt instanceof Date ? report.generatedAt : new Date(report.generatedAt),
  });

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      if (!currentUser?.id) {
        if (isMounted) setSavedReports([]);
        return;
      }

      const reports = await userDataService.loadOpponentReports(currentUser.id);
      if (isMounted) setSavedReports(reports);
    };

    void loadReports();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let isMounted = true;
    profileAnalysisService
      .loadProfile(currentUser?.id)
      .then((profile) => {
        if (isMounted) setYourProfile(profile);
      })
      .catch(() => {
        if (isMounted) setYourProfile(null);
      });
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const handleGenerateOpponentReport = async (request: GameReportRequest) => {
    if (!currentUser?.id) {
      setAnalysisError('Sign in to save opponent dossiers to your account.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setAnalysisProgress(null);
    reportService.setProgressCallback(setAnalysisProgress);

    try {
      const report = await reportService.generateOpponentReport(request, {
        yourStrengths: yourProfile?.report?.executiveSummary.strengthAreas,
      });
      const normalizedReport = reviveReport({
        ...report,
        userId: currentUser.id,
      });
      const nextReports = await userDataService.upsertOpponentReport(currentUser.id, normalizedReport);
      await userDataService.saveReport(currentUser.id, normalizedReport, 'opponent');
      setSavedReports(nextReports);
      setActiveReport(normalizedReport);
      setAnalysisMessage(`Scouting dossier ready for ${normalizedReport.username}.`);
    } catch (reportError) {
      setAnalysisError(reportError instanceof Error ? reportError.message : 'Could not analyze opponent.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openNewReportPopup = () => {
    setActiveReport(null);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setAnalysisProgress(null);
    setIsDashboardOpen(true);
  };

  const openExistingReport = (report: ChessReport) => {
    setActiveReport(report);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setAnalysisProgress(null);
    setIsDashboardOpen(true);
  };

  const handlePracticeAgainstOpponent = (e: React.MouseEvent, report: ChessReport) => {
    e.stopPropagation();
    persistPracticeOpponent(report);
    navigate('/analyze/practice');
  };

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="SCOUTING & PREPARATION"
        title="Analyze Opponents"
        description="Scout opponent opening repertoires, predictable blunders, and play practice games against their simulated style."
        actions={
          <Button
            type="button"
            onClick={openNewReportPopup}
            className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white font-semibold flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Scout New Opponent</span>
          </Button>
        }
      />

      {/* Scouting Metric Highlights */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Saved Opponent Dossiers"
          value={savedReports.length}
          subtitle="Ready for tournament preparation"
          icon={<Swords className="h-5 w-5" />}
          iconBg="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-emerald-400"
        />
        <StatCard
          title="Your Linked Profile"
          value={yourProfile?.username ? `@${yourProfile.username}` : 'Not connected'}
          subtitle={yourProfile?.platform ? `${yourProfile.platform} account linked` : 'Connect in Dashboard'}
          icon={<UserCheck className="h-5 w-5" />}
          iconBg="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
        />
        <StatCard
          title="Analysis Engine"
          value="Stockfish + AI"
          subtitle="Deep game mining & opening classification"
          icon={<Bot className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
        />
      </section>

      {/* Saved Opponents Section */}
      <section className="space-y-4">
        <SectionHeader
          title="Saved Scouting Dossiers"
          description="Click any dossier to view full breakdown, opening recommendations, and custom preparation lines."
        />

        {savedReports.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No Opponent Dossiers Yet"
            description="Enter a Chess.com or Lichess username to pull their game archive, detect opening weaknesses, and generate a customized game plan."
            action={
              <Button
                type="button"
                onClick={openNewReportPopup}
                className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Scout Your First Opponent
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedReports.map((report) => (
              <div
                key={report.id}
                onClick={() => openExistingReport(report)}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/90 cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-emerald-400">
                        {report.platform} · {report.gameCount} games
                      </span>
                      <h3 className="mt-0.5 font-display text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-emerald-400 transition-colors">
                        {report.username}
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {report.executiveSummary.winRate}% WR
                    </span>
                  </div>

                  {report.scoutIntel && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Predictability:
                      </span>
                      <span className="rounded bg-primary-100/80 px-1.5 py-0.2 font-bold text-primary-800 dark:bg-primary-500/20 dark:text-emerald-300">
                        {report.scoutIntel.predictabilityScore}
                      </span>
                    </div>
                  )}

                  {report.executiveSummary?.favoriteOpenings &&
                    report.executiveSummary.favoriteOpenings.length > 0 && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                        Main line: {report.executiveSummary.favoriteOpenings[0]}
                      </p>
                    )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => handlePracticeAgainstOpponent(e, report)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>Practice Bot</span>
                  </button>

                  <div className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Open Dossier</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Opponent Scout Modal */}
      <OpponentDashboardPopup
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        report={activeReport}
        onAnalyze={handleGenerateOpponentReport}
        isAnalyzing={isAnalyzing}
        progress={analysisProgress}
        message={analysisMessage}
        error={analysisError}
        yourProfile={yourProfile}
      />
    </div>
  );
};

export default GameAnalysisPage;
