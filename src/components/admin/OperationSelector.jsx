import React from 'react';
import { Layers, Sparkles, Clock, AlertCircle } from 'lucide-react';

export function OperationSelector({ businesses = [], selectedBusinessId, onSelectBusiness }) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto scrollbar-none shadow-inner">
      {/* Opção Visão Geral (TOTAL KING'S) */}
      <button
        type="button"
        onClick={() => onSelectBusiness(null)}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer ${
          selectedBusinessId === null
            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>Visão Geral (TOTAL KING'S)</span>
      </button>

      {/* Operações Individuais */}
      {businesses.map((b) => {
        const isSelected = selectedBusinessId === b.id;
        const isComingSoon = !b.active || b.status === 'coming_soon';

        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelectBusiness(b.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer ${
              isSelected
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            {/* Ícones específicos */}
            {b.slug === 'acai' && <span>🍧</span>}
            {b.slug === 'burguer' && <span>🍔</span>}
            {b.slug === 'pizza' && <span>🍕</span>}

            <span>{b.name}</span>

            {/* Badges de Status */}
            {isComingSoon ? (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                isSelected ? 'bg-slate-900/80 text-amber-300' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                Em breve
              </span>
            ) : b.is_open ? (
              <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-950' : 'bg-emerald-400 animate-pulse'}`} title="Operação Aberta" />
            ) : (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                isSelected ? 'bg-slate-900/80 text-amber-300' : 'bg-slate-800 text-slate-400'
              }`}>
                Abre {b.opening_time}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
