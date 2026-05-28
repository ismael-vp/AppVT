import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/lib/api';

export function useScriptAnalyzer() {
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [scriptExplanation, setScriptExplanation] = useState<string | null>(null);
  const [isExplainingScript, setIsExplainingScript] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleExplainScript = async (scriptUrl: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setSelectedScript(scriptUrl);
    setScriptExplanation(null);
    setIsExplainingScript(true);
    try {
      const response = await axios.post(`${API_URL}/api/explain-script`, {
        script_url: scriptUrl
      }, { signal: abortControllerRef.current.signal });
      setScriptExplanation(response.data.explanation);
    } catch (error) {
      if (axios.isCancel(error)) return;
      setScriptExplanation("Hubo un error al generar la explicación con IA.");
    } finally {
      setIsExplainingScript(false);
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const closeScriptModal = () => setSelectedScript(null);

  return {
    selectedScript,
    scriptExplanation,
    isExplainingScript,
    handleExplainScript,
    closeScriptModal
  };
}
