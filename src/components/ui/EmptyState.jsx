import React from 'react';
import { Inbox, AlertCircle, ShoppingBag, DollarSign, Package } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Nenhum dado encontrado',
  description = 'Não há registros para o período ou operação selecionada.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 text-sm font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all duration-200"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
