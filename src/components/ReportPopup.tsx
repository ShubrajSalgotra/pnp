import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, Loader2, X } from 'lucide-react';
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
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

  const isFormView = viewMode === 'form' || !report;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm dark:bg-black/70 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-[#F4F8F5] shadow-xl ring-1 ring-black/10 dark:bg-slate-950 dark:ring-white/10"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-primary-200/70 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
              {isOpponent ? 'Opponent report' : 'Your report'}
            </p>
            <h2 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {isFormView
                ? isOpponent
                  ? 'New opponent'
                  : 'Generate report'
                : previewTitle}
            </h2>
            {!isFormView && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Report opens instantly · PDF builds on download
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showViewer && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isBuildingPdf}
                className="inline-flex cursor-pointer items-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-wait disabled:opacity-70"
              >
                {isBuildingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isBuildingPdf ? 'Preparing…' : 'Download PDF'}
              </button>
            )}

            {report && (
              <button
                type="button"
                onClick={openNewReportForm}
                className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileText className="mr-1.5 h-4 w-4" />
                New
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Close report popup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          {isFormView ? (
            <div className="mx-auto max-w-lg">
              <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                {isOpponent ? 'Scout an opponent' : 'Generate your report'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {isOpponent
                  ? 'Pull recent games and generate a battle plan, opening targets, and full analysis.'
                  : 'Pull your recent games and generate a full strength-and-weakness analysis.'}
              </p>

              <div className="mt-8 space-y-5">
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Platform</legend>
                  <div className="flex gap-6">
                    {(['lichess', 'chess.com'] as const).map((value) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-100"
                      >
                        <input
                          type="radio"
                          name="platform"
                          value={value}
                          checked={formData.platform === value}
                          onChange={() => handleFormChange('platform', value)}
                          className="accent-primary-600"
                          disabled={isRefreshing}
                        />
                        {value === 'lichess' ? 'Lichess' : 'Chess.com'}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label
                    htmlFor="report-username"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Username
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="report-username"
                      type="text"
                      value={formData.username}
                      onChange={(e) => handleFormChange('username', e.target.value)}
                      placeholder={isOpponent ? 'Opponent username' : 'Your chess username'}
                      className={`flex-1 ${fieldClass}`}
                      disabled={isRefreshing}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={validateUsername}
                      disabled={!formData.username || isValidating || isRefreshing}
                      className="cursor-pointer"
                    >
                      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validate'}
                    </Button>
                  </div>
                  {validationResult === true && (
                    <p className="mt-2 text-xs text-primary-700 dark:text-primary-300">Username found.</p>
                  )}
                  {validationResult === false && (
                    <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">Username not found.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="report-games"
                      className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      Games
                    </label>
                    <input
                      id="report-games"
                      type="number"
                      min={1}
                      max={100}
                      value={formData.gameCount}
                      onChange={(event) =>
                        handleFormChange('gameCount', parseInt(event.target.value, 10) || 1)
                      }
                      className={fieldClass}
                      disabled={isRefreshing}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="report-rated"
                      className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      Filter
                    </label>
                    <select
                      id="report-rated"
                      value={formData.rated === undefined ? 'all' : formData.rated ? 'rated' : 'unrated'}
                      onChange={(event) => {
                        const value = event.target.value;
                        handleFormChange('rated', value === 'all' ? undefined : value === 'rated');
                      }}
                      className={`h-[42px] ${fieldClass}`}
                      disabled={isRefreshing}
                    >
                      <option value="all">All</option>
                      <option value="rated">Rated</option>
                      <option value="unrated">Unrated</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Usually ~{Math.max(1, Math.ceil(estimatedTime / 60))} min · recommended 20–40 games
                </p>

                {(pdfError || error) && (
                  <p className="text-sm text-rose-700 dark:text-rose-300">{pdfError || error}</p>
                )}
                {message && (
                  <p className="text-sm text-primary-800 dark:text-primary-200">{message}</p>
                )}

                {isRefreshing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>
                        {progress?.message ||
                          (isOpponent
                            ? 'Building opponent dossier…'
                            : 'Preparing your report…')}
                      </span>
                      <span>{progress?.progress ?? 5}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-primary-600 transition-all duration-300 dark:bg-primary-400"
                        style={{ width: `${progress?.progress ?? 5}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={generateReport}
                    disabled={isRefreshing || !formData.username.trim() || validationResult === false}
                    className="flex-1 cursor-pointer"
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating…
                      </>
                    ) : isOpponent ? (
                      'Generate dossier'
                    ) : (
                      'Generate report'
                    )}
                  </Button>
                  {report && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setViewMode('viewer')}
                      disabled={isRefreshing}
                      className="cursor-pointer"
                    >
                      Back
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-primary-200/70 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-primary-100 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FileText className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                  Report
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{pdfFilename}</div>
              </div>

              <div className="bg-white p-3 dark:bg-slate-950 sm:p-4">
                {pdfError && (
                  <div className="mb-3 text-sm text-rose-700 dark:text-rose-300">{pdfError}</div>
                )}
                {isBuildingPdf && (
                  <div className="mb-3 flex items-center gap-2 text-sm text-primary-800 dark:text-primary-200">
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
