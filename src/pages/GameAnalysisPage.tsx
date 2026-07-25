import React, { useEffect, useState } from 'react';
import { ArrowRight, Plus, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ChessReport, GameReportRequest, ReportGenerationProgress } from '../types/report';
import { useAuth } from '../contexts/AuthContext';
import { reportService } from '../services/reportService';
import { userDataService } from '../services/userDataService';
import ReportPopup from '../components/ReportPopup';

const GameAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [savedReports, setSavedReports] = useState<ChessReport[]>([]);
  const [activeReport, setActiveReport] = useState<ChessReport | null>(null);
  const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<ReportGenerationProgress | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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

  const handleGenerateOpponentReport = async (request: GameReportRequest) => {
    if (!currentUser?.id) {
      setAnalysisError('Sign in to save opponent reports to your account.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setAnalysisProgress(null);
    reportService.setProgressCallback(setAnalysisProgress);

    try {
      const report = await reportService.generateReport(request);
      const normalizedReport = reviveReport({
        ...report,
        userId: currentUser.id,
      });
      const nextReports = await userDataService.upsertOpponentReport(currentUser.id, normalizedReport);
      await userDataService.saveReport(currentUser.id, normalizedReport, 'opponent');
      setSavedReports(nextReports);
      setActiveReport(normalizedReport);
      setAnalysisMessage(`Analyzed ${normalizedReport.gameCount} games for ${normalizedReport.username}.`);
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
    setIsReportPopupOpen(true);
  };

  const openExistingReport = (report: ChessReport) => {
    setActiveReport(report);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setAnalysisProgress(null);
    setIsReportPopupOpen(true);
  };

  return (
    <div className="section-shell space-y-8 py-8">
      <section className="aurora-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">Opponent intelligence</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-slate-900 sm:text-4xl dark:text-white">Analyze Opponents</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-700 sm:text-base dark:text-slate-300">
              Keep a reusable library of opponent reports, compare patterns quickly, and open full tactical summaries in one click.
            </p>
          </div>
          <Button type="button" onClick={openNewReportPopup} className="cursor-pointer bg-primary-600 text-white hover:bg-primary-700">
            <Plus className="mr-2 h-4 w-4" />
            Generate new report
          </Button>
        </div>
      </section>

      <section className="aurora-subtle pt-6">
        <div className="mb-4 pb-3">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Saved reports</h2>
        </div>
        <div className="divide-y divide-primary-200/70 dark:divide-slate-700/80">
        {savedReports.map((report) => {
          const isSelected = activeReport?.id === report.id;

          return (
            <button
              key={report.id}
              type="button"
              onClick={() => openExistingReport(report)}
              className={`group grid w-full cursor-pointer gap-3 px-1 py-4 text-left transition sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center ${
                isSelected ? 'bg-primary-50/70 dark:bg-slate-800/60' : 'hover:bg-white/50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-xl bg-emerald-100/80 p-2 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{report.username}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {report.platform} · {report.gameCount} games analyzed
                  </p>
                </div>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Win rate <span className="ml-1 font-semibold text-slate-900 dark:text-white">{report.executiveSummary.winRate}%</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Accuracy <span className="ml-1 font-semibold text-slate-900 dark:text-white">{report.executiveSummary.averageAccuracy}%</span>
              </div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-300">
                Open
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
        {savedReports.length === 0 && (
          <p className="py-6 text-sm text-slate-600 dark:text-slate-300">No reports saved yet. Generate your first opponent report here.</p>
        )}
        </div>
      </section>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Use "Generate new report" to open the same report form and viewer popup as the dashboard, including opponent ID, game count, and game type filters.
      </p>

      <ReportPopup
        isOpen={isReportPopupOpen}
        onClose={() => setIsReportPopupOpen(false)}
        report={activeReport}
        initialPlatform="lichess"
        initialUsername=""
        onSaveAndAnalyze={handleGenerateOpponentReport}
        isRefreshing={isAnalyzing}
        progress={analysisProgress}
        message={analysisMessage}
        error={analysisError}
        mode="opponent"
      />
    </div>
  );
};

export default GameAnalysisPage;