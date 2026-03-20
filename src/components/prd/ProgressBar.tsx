import { useState, useEffect } from 'react';

interface ProgressBarProps {
  active: boolean;
  startedAt: number; // timestamp from store — survives page navigation
  label: string;
  steps?: string[];
}

export function ProgressBar({ active, startedAt, label, steps }: ProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const defaultSteps = [
    'Veriler hazirlaniyor...',
    'LLM\'e gonderiliyor...',
    'PRD yaziliyor...',
    'Komponentler eslestiriliyor...',
    'Puanlama yapiliyor...',
  ];

  const stepList = steps || defaultSteps;

  useEffect(() => {
    if (!active) {
      if (progress > 0) {
        setProgress(100);
        const timer = setTimeout(() => { setProgress(0); setCurrentStep(0); }, 600);
        return () => clearTimeout(timer);
      }
      return;
    }

    // Sayfa degisip geri gelindiginde elapsed time'dan progress hesapla
    function calcFromElapsed() {
      if (!startedAt) return;
      const elapsed = (Date.now() - startedAt) / 1000;
      // Logaritmik ilerleme — 95%'e asimptotik yaklas
      const p = Math.min(95, 95 * (1 - Math.exp(-elapsed / 60)));
      setProgress(p);
      setCurrentStep(Math.min(stepList.length - 1, Math.floor(elapsed / (60 / stepList.length))));
    }

    // Initial hesapla (sayfa geri gelme durumu icin)
    calcFromElapsed();

    const interval = setInterval(calcFromElapsed, 500);
    return () => clearInterval(interval);
  }, [active, startedAt, stepList.length]);

  if (!active && progress === 0) return null;

  return (
    <div className="prd-progress">
      <div className="prd-progress__header">
        <span className="prd-progress__label">{label}</span>
        <span className="prd-progress__percent">{Math.round(progress)}%</span>
      </div>
      <div className="prd-progress__track">
        <div className="prd-progress__fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="prd-progress__step">{stepList[currentStep]}</div>
    </div>
  );
}
