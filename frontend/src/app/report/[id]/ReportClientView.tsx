"use client";

import { useEffect, useState } from 'react';
import { useThreatStore } from '@/store/useThreatStore';
import ResultsPanel from '@/features/analyzer/components/ResultsPanel';
import { ScanResult } from '@/types';

export default function ReportClientView({ scanData }: { scanData: ScanResult }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    useThreatStore.getState().viewSharedReport(scanData);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    
    // Limpiar el estado al desmontar para no ensuciar la sesión local
    return () => {
      useThreatStore.getState().resetState();
    };
  }, [scanData]);

  if (!mounted) return null;

  return <ResultsPanel isReadOnly={true} />;
}
