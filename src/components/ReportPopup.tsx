import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Download, FileText, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { Button } from './ui/Button';
import { ChessReport, GameReportRequest, ReportGenerationProgress } from '../types/report';
import { reportService } from '../services/reportService';
import ReportDisplay from './ReportDisplay';

interface ReportPopupProps {
  isOpen: boolean;
  onClose: () => void;
  report: ChessReport | null;
  initialPlatform: 'lichess' | 'chess.com';
  initialUsername: string;
  onSaveAndAnalyze: (request: GameReportRequest) => Promise<void>;
  isRefreshing: boolean;
  progress: ReportGenerationProgress | null;
  message: string | null;
  error: string | null;
  /** Self reports (dashboard) vs opponent reports (analyze). */
  mode?: 'self' | 'opponent';
}

type CachedPdf = {
  blob: Blob;
  filename: string;
  url: string;
};

/** Keep built PDFs across reopen so Download is instant the second time. */
const pdfCache = new Map<string, CachedPdf>();

function reportCacheKey(report: ChessReport): string {
  const generatedAt =
    report.generatedAt instanceof Date
      ? report.generatedAt.toISOString()
      : String(report.generatedAt);
  return `${report.userId || ''}:${report.username}:${report.gameCount}:${generatedAt}`;
}

const ReportPopup: React.FC<ReportPopupProps> = ({
  isOpen,
  onClose,
  report,
  initialPlatform,
  initialUsername,
  onSaveAndAnalyze,
  isRefreshing,
  progress,
  message,
  error,
  mode = 'self',
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('chess-report.pdf');
  const [isBuildingPdf, setIsBuildingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'viewer' | 'form'>('viewer');
  const [formData, setFormData] = useState<GameReportRequest>({
    platform: initialPlatform,
    username: initialUsername,
    gameCount: report?.gameCount || 20,
    rated: undefined,
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<boolean | null>(null);
  const [cachedPdfUrl, setCachedPdfUrl] = useState<string | null>(null);

  const isOpponent = mode === 'opponent';

  useEffect(() => {
    if (!isOpen) {
      setPdfError(null);
      setIsBuildingPdf(false);
      setViewMode('viewer');
      setValidationResult(null);
      setIsValidating(false);
      setCachedPdfUrl(null);
      return;
    }

    if (!report) {
      setPdfError(null);
      setIsBuildingPdf(false);
      setViewMode('form');
      setFormData({
        platform: initialPlatform,
        username: initialUsername,
        gameCount: 20,
        rated: undefined,
      });
      setValidationResult(null);
      setIsValidating(false);
      setCachedPdfUrl(null);
      return;
    }

    // Instant open: show HTML report immediately. PDF is built only on Download.
    setPdfError(null);
    setIsBuildingPdf(false);
    setViewMode('viewer');
    setFormData({
      platform: report.platform,
      username: report.username,
      gameCount: report.gameCount,
      rated: undefined,
    });

    const cached = pdfCache.get(reportCacheKey(report));
    if (cached) {
      setPdfFilename(cached.filename);
      setCachedPdfUrl(cached.url);
    } else {
      setPdfFilename(`${report.username}-chess-report.pdf`);
      setCachedPdfUrl(null);
    }
  }, [isOpen, report, initialPlatform, initialUsername]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const previewTitle = useMemo(() => {
    if (viewMode === 'form' || !report) {
      return isOpponent ? 'Create Opponent Report' : 'Create Your Report';
    }

    return isOpponent ? `Opponent report · ${report.username}` : `Report for ${report.username}`;
  }, [isOpponent, report, viewMode]);

  const openNewReportForm = () => {
    setPdfError(null);
    setIsBuildingPdf(false);
    setViewMode('form');
  };

  const showViewer = viewMode === 'viewer' && !!report;

  const ensurePdf = useCallback(async (): Promise<CachedPdf> => {
    if (!report) {
      throw new Error('No report available to export.');
    }

    const key = reportCacheKey(report);
    const existing = pdfCache.get(key);
    if (existing) {
      return existing;
    }

    const captureElement = reportRef.current;
    if (!captureElement) {
      throw new Error('The report is still loading. Try again in a moment.');
    }

    const result = await reportService.generateReportPdfBlob(captureElement, report);
    const url = URL.createObjectURL(result.blob);
    const cached: CachedPdf = {
      blob: result.blob,
      filename: result.filename,
      url,
    };
    pdfCache.set(key, cached);
    setPdfFilename(cached.filename);
    setCachedPdfUrl(cached.url);
    return cached;
  }, [report]);

  const handleDownloadPdf = async () => {
    if (!report || isBuildingPdf) return;

    setPdfError(null);
    setIsBuildingPdf(true);
    try {
      const cached = await ensurePdf();
      const anchor = document.createElement('a');
      anchor.href = cached.url;
      anchor.download = cached.filename;
      anchor.click();
    } catch (generationError) {
      setPdfError(
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate the PDF.'
      );
    } finally {
      setIsBuildingPdf(false);
    }
  };

  const handleFormChange = (field: keyof GameReportRequest, value: GameReportRequest[keyof GameReportRequest]) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setValidationResult(null);
    setPdfError(null);
  };

  const validateUsername = async () => {
    if (!formData.username) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const isValid = await reportService.validateUserExists(formData.platform, formData.username);
      setValidationResult(isValid);
      if (!isValid) {
        setPdfError(`User "${formData.username}" not found on ${formData.platform}`);
      }
    } catch (validationError) {
      console.error('Username validation error:', validationError);
      setPdfError('Failed to validate username');
    } finally {
      setIsValidating(false);
    }
  };

  const generateReport = async () => {
    if (!formData.username || formData.gameCount < 1 || formData.gameCount > 100) {
      setPdfError('Please enter a valid username and game count (1-100)');
      return;
    }

    await onSaveAndAnalyze(formData);
  };

  const estimatedTime = reportService.estimateGenerationTime(formData.gameCount);

  if (!isOpen) {
    return null;
  }

  const fieldClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-primary-400 dark:focus:ring-primary-400/30';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md dark:bg-black/75">
      <div className="relative flex max-h-[95vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-slate-950 dark:ring-white/10">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-primary-50 via-white to-primary-50 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary-700 dark:text-primary-300">
              <Sparkles className="h-4 w-4" />
              {isOpponent ? 'Opponent report' : 'Report viewer'}
            </div>
            <h2 className="mt-1 truncate font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">
              {previewTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {viewMode === 'form'
                ? isOpponent
                  ? 'Enter an opponent’s chess account to generate a scouting report.'
                  : 'Generate a fresh report from this popup.'
                : 'Report opens instantly · PDF is built only when you download.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {showViewer && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isBuildingPdf}
                className="inline-flex cursor-pointer items-center rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-70 dark:bg-primary-500 dark:hover:bg-primary-400"
              >
                {isBuildingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isBuildingPdf ? 'Preparing PDF…' : 'Download PDF'}
              </button>
            )}

            {report && (
              <button
                type="button"
                onClick={openNewReportForm}
                className="inline-flex cursor-pointer items-center rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-800 shadow-sm transition hover:bg-primary-50 dark:border-slate-600 dark:bg-slate-900 dark:text-primary-200 dark:hover:bg-slate-800"
              >
                <FileText className="mr-2 h-4 w-4" />
                {isOpponent ? 'New opponent report' : 'Generate new report'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close report popup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900/80 sm:p-6">
          {viewMode === 'form' || !report ? (
            <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/40">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
                <BarChart3 className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                {isOpponent ? 'Opponent Setup' : 'Report Setup'}
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-100">
                  {isOpponent
                    ? 'Enter the opponent’s chess username. When the report is ready, it opens in this viewer.'
                    : 'Enter your chess account details. When the report is ready, it opens instantly in this viewer.'}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Chess Platform
                  </label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center text-sm text-slate-800 dark:text-slate-100">
                      <input
                        type="radio"
                        name="platform"
                        value="lichess"
                        checked={formData.platform === 'lichess'}
                        onChange={(e) => handleFormChange('platform', e.target.value as 'lichess' | 'chess.com')}
                        className="mr-2 accent-primary-600"
                        disabled={isRefreshing}
                      />
                      Lichess
                    </label>
                    <label className="flex cursor-pointer items-center text-sm text-slate-800 dark:text-slate-100">
                      <input
                        type="radio"
                        name="platform"
                        value="chess.com"
                        checked={formData.platform === 'chess.com'}
                        onChange={(e) => handleFormChange('platform', e.target.value as 'lichess' | 'chess.com')}
                        className="mr-2 accent-primary-600"
                        disabled={isRefreshing}
                      />
                      Chess.com
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {isOpponent ? 'Opponent username' : 'Username'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => handleFormChange('username', e.target.value)}
                      placeholder={isOpponent ? 'Enter opponent username' : 'Enter chess username'}
                      className={`flex-1 ${fieldClass}`}
                      disabled={isRefreshing}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={validateUsername}
                      disabled={!formData.username || isValidating || isRefreshing}
                      className="cursor-pointer dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validate'}
                    </Button>
                  </div>
                  {validationResult === true && (
                    <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">Username found.</p>
                  )}
                  {validationResult === false && (
                    <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">Username not found.</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Games to analyze (1-100)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.gameCount}
                    onChange={(event) => handleFormChange('gameCount', parseInt(event.target.value, 10) || 1)}
                    className={fieldClass}
                    disabled={isRefreshing}
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Recommended: 20–50 games · estimated ~{Math.ceil(estimatedTime / 60)} min
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Game type
                  </label>
                  <select
                    value={formData.rated === undefined ? 'all' : formData.rated ? 'rated' : 'unrated'}
                    onChange={(event) => {
                      const value = event.target.value;
                      handleFormChange('rated', value === 'all' ? undefined : value === 'rated');
                    }}
                    className={`h-11 ${fieldClass}`}
                    disabled={isRefreshing}
                  >
                    <option value="all">All Games</option>
                    <option value="rated">Rated Games Only</option>
                    <option value="unrated">Unrated Games Only</option>
                  </select>
                </div>

                <Button
                  type="button"
                  onClick={generateReport}
                  disabled={isRefreshing || !formData.username.trim() || validationResult === false}
                  className="w-full cursor-pointer"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {isOpponent ? 'Create opponent report' : 'Generate report'}
                    </>
                  )}
                </Button>

                {isRefreshing && progress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      <span>{progress.message}</span>
                      <span>{progress.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-primary-600 transition-all dark:bg-primary-400"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {message && (
                  <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                    {message}
                  </p>
                )}
                {error && (
                  <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
                    {error}
                  </p>
                )}
                {pdfError && (
                  <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
                    {pdfError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/40">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FileText className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                  Report
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{pdfFilename}</div>
              </div>

              <div className="bg-white p-3 dark:bg-slate-950 sm:p-4">
                {pdfError && (
                  <div className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
                    {pdfError}
                  </div>
                )}
                {isBuildingPdf && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-900 dark:bg-primary-500/15 dark:text-primary-100">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Building PDF for download…
                  </div>
                )}
                <div ref={reportRef} className="report-viewer-root">
                  <ReportDisplay report={report} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReportPopup;
