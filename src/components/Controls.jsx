import { SPEED_PRESETS } from '../hooks/useAnimation.js';

export default function Controls({
  isPlaying,
  speed,
  onPlayToggle,
  onStepBack,
  onStepForward,
  onReset,
  onSpeedChange,
  onExport,
  isExporting,
  exportProgress,
}) {
  const speedKey =
    Object.entries(SPEED_PRESETS).find(([, ms]) => ms === speed)?.[0] ?? 'normal';

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-3 bg-slate-900/60 backdrop-blur rounded-xl border border-slate-700/50">
      <button
        onClick={onStepBack}
        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition"
        aria-label="خطوة للخلف"
      >
        ⏮
      </button>

      <button
        onClick={onPlayToggle}
        className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition min-w-[88px]"
      >
        {isPlaying ? 'إيقاف' : 'تشغيل'}
      </button>

      <button
        onClick={onStepForward}
        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition"
        aria-label="خطوة للأمام"
      >
        ⏭
      </button>

      <button
        onClick={onReset}
        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition"
      >
        إعادة
      </button>

      <div className="flex items-center gap-1 mx-2 bg-slate-800 rounded-lg p-1">
        {Object.entries(SPEED_PRESETS).map(([key, ms]) => (
          <button
            key={key}
            onClick={() => onSpeedChange(ms)}
            className={
              'px-3 py-1.5 rounded-md text-xs font-medium transition ' +
              (speedKey === key
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white')
            }
          >
            {key === 'slow' ? 'بطيء' : key === 'normal' ? 'عادي' : 'سريع'}
          </button>
        ))}
      </div>

      <button
        onClick={onExport}
        disabled={isExporting}
        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-300 text-white text-sm font-semibold transition"
      >
        {isExporting
          ? `تسجيل... ${Math.round((exportProgress ?? 0) * 100)}%`
          : 'تصدير فيديو'}
      </button>
    </div>
  );
}
