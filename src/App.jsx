import { useCallback, useRef, useState } from 'react';
import RankChart from './components/RankChart.jsx';
import Controls from './components/Controls.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import { useAnimation, SPEED_PRESETS } from './hooks/useAnimation.js';
import { exportAnimation } from './utils/videoExport.js';
import standings from './data/standings.json';

export default function App() {
  const total = standings.matchweeks.length;
  const svgRef = useRef(null);

  const anim = useAnimation({
    totalFrames: total,
    initialSpeed: SPEED_PRESETS.normal,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = useCallback(async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    setExportProgress(0);
    anim.pause();
    try {
      await exportAnimation({
        svg: svgRef.current,
        totalFrames: total,
        renderFrame: (i) => anim.setFrame(i),
        onProgress: setExportProgress,
        filename: 'syrian-league-race.webm',
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('فشل تصدير الفيديو. راجع وحدة التحكم للتفاصيل.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [anim, total]);

  return (
    <div className="min-h-screen flex flex-col items-center gap-4 p-4 sm:p-6">
      <header className="w-full max-w-full text-center">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#066b4f' }}>
          سباق ترتيب الدوري السوري الممتاز
        </h1>
        <p className="text-sm mt-1" style={{ color: '#095e47' }}>
          {`${standings.teams.length} فريق · ${total} جولة`}
        </p>
      </header>

      <main
        className="w-full max-w-full aspect-[2800/1350] rounded-2xl overflow-hidden shadow-2xl border"
        style={{ background: '#f9f9f9', borderColor: '#066b4f33' }}
      >
        <RankChart data={standings} frame={anim.frame} svgRef={svgRef} />
      </main>

      <section className="w-full max-w-full flex flex-col gap-3">
        <ProgressBar
          frame={anim.frame}
          total={total}
          onSeek={anim.setFrame}
        />
        <Controls
          isPlaying={anim.isPlaying}
          speed={anim.speed}
          onPlayToggle={anim.toggle}
          onStepBack={() => anim.step(-1)}
          onStepForward={() => anim.step(1)}
          onReset={anim.reset}
          onSpeedChange={anim.setSpeed}
          onExport={handleExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
        />
      </section>
    </div>
  );
}
