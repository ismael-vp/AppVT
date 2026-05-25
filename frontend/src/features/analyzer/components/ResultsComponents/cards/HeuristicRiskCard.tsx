import React from 'react';


interface HeuristicRiskCardProps {
  hasDangerousForm?: boolean;
  isTyposquatting?: boolean;
  targetBrand?: string | null;
  hostname?: string | null;
}

export default function HeuristicRiskCard({
  hasDangerousForm,
  isTyposquatting,
  targetBrand,
  hostname,
}: HeuristicRiskCardProps) {
  if (!hasDangerousForm && !isTyposquatting) {
    return null;
  }

  return (
    <div>
      <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5 space-y-5">
        {hasDangerousForm && (
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-2" />
              <div>
                <p className="text-sm font-medium text-zinc-200 mb-0.5">Formulario sospechoso</p>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                  Formulario que podría capturar credenciales o datos personales.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-red-500/80 bg-red-500/5 px-2 py-0.5 rounded border border-red-500/20 shrink-0">
              Riesgo alto
            </span>
          </div>
        )}
        {hasDangerousForm && isTyposquatting && (
          <div className="border-t border-zinc-800/50 w-full" />
        )}
        {isTyposquatting && (
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-2" />
              <div>
                <p className="text-sm font-medium text-zinc-200 mb-0.5">Dominio engañoso</p>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
                  Imita a {targetBrand?.toLowerCase()}.com para inducir a confusión ({hostname}).
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-orange-500/80 bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/20 shrink-0">
              Riesgo medio
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
