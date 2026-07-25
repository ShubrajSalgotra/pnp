import React, { useEffect, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ChessReport, GameReportRequest, ReportGenerationProgress } from '../types/report';
import { PlayerAnalysisProfile } from '../types/profileAnalysis';
import { useAuth } from '../contexts/AuthContext';
import { reportService } from '../services/reportService';
import { userDataService } from '../services/userDataService';
import { profileAnalysisService } from '../services/profileAnalysisService';
import OpponentDashboardPopup from '../components/OpponentDashboardPopup';

const GameAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
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

  return (
    <div className="section-shell space-y-10 py-8">
      <section className="aurora-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
          Opponent intelligence
        </p>
        <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Analyze Opponents
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
              Scout how to beat them, where you have the edge, and which openings to target.
            </p>
          </div>
          <Button type="button" onClick={openNewReportPopup} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Scout opponent
          </Button>
        </div>
      </section>

      <section className="aurora-subtle border-t border-primary-200/70 pt-8 dark:border-slate-700/80">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Saved dossiers</h2>

        <div className="mt-6 divide-y divide-primary-100 dark:divide-slate-800">
          {savedReports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => openExistingReport(report)}
              className="group grid w-full cursor-pointer gap-2 px-1 py-4 text-left transition-colors duration-200 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-900/40 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center sm:gap-4"
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{report.username}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {report.platform} · {report.gameCount} games
                </p>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Win rate{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {report.executiveSummary.winRate}%
                </span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {report.scoutIntel ? (
                  <>
                    Predictability{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {report.scoutIntel.predictabilityScore}
                    </span>
                  </>
                ) : (
                  <>
                    Accuracy{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {report.executiveSummary.averageAccuracy}%
                    </span>
                  </>
                )}
              </div>
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 transition-colors duration-200 group-hover:text-primary-900 dark:text-primary-300">
                Open
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          ))}
          {savedReports.length === 0 && (
            <p className="py-8 text-sm text-slate-600 dark:text-slate-400">
              No dossiers yet. Scout an opponent to get started.
            </p>
          )}
        </div>
      </section>

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
