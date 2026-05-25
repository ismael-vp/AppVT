import React from 'react';
import { Shield, ExternalLink } from 'lucide-react';

interface TechStackCardProps {
  technologies?: string[];
  externalScripts?: string[];
  onExplainScript?: (url: string) => void;
}

const TechStackCard: React.FC<TechStackCardProps> = ({ 
  externalScripts = [],
  onExplainScript 
}) => {
  return (
    <div className="space-y-8">
      {/* Sección Scripts Externos */}

      {externalScripts && externalScripts.length > 0 && (
        <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Scripts externos detectados</p>
          <div className="grid grid-cols-1 gap-2">
            {externalScripts.map((script, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-[#080808] border border-zinc-800/50 rounded-lg group hover:border-zinc-700/60 transition-colors"
              >
                <span className="text-xs font-mono text-zinc-500 truncate max-w-[80%]" title={script}>
                  {script}
                </span>
                {onExplainScript && (
                  <button
                    onClick={() => onExplainScript(script)}
                    className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    Analizar
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
            Scripts de terceros. Pueden ser trackers, CDNs o inyecciones maliciosas.
          </p>
        </div>
      )}
    </div>
  );
};

export default TechStackCard;
