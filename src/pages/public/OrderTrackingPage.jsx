import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, CheckCircle, Package, Truck, Check, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const STATUS_STEPS = [
  { key: 'novo', label: 'Pedido Recebido', desc: 'Aguardando confirmação da cozinha' },
  { key: 'confirmado', label: 'Confirmado', desc: 'Pedido aceito pela loja' },
  { key: 'preparando', label: 'Em Preparação', desc: 'Sendo preparado com carinho' },
  { key: 'pronto', label: 'Pronto', desc: 'Finalizado e embalado' },
  { key: 'saiu_entrega', label: 'Saiu para Entrega', desc: 'Em rota até o seu endereço' },
  { key: 'entregue', label: 'Entregue', desc: 'Bom apetite!' },
];

export function OrderTrackingPage({ orderNumber, onBackToMenu }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderNumber) {
      loadOrder();
      const interval = setInterval(loadOrder, 10000); // 10s polling for live tracking
      return () => clearInterval(interval);
    }
  }, [orderNumber]);

  const loadOrder = async () => {
    try {
      const data = await api.getOrderById(orderNumber);
      setOrder(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Carregando status do pedido #{orderNumber}...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center p-4 text-center">
        <p className="text-sm text-slate-300 mb-4">Pedido #{orderNumber} não encontrado.</p>
        <button
          onClick={onBackToMenu}
          className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
        >
          Voltar ao Cardápio
        </button>
      </div>
    );
  }

  const isCancelled = order.status === 'cancelado';
  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === order.status);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 p-4 sm:p-6 flex justify-center">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToMenu}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Cardápio</span>
          </button>
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            Pedido #{order.order_number}
          </span>
        </div>

        {/* Card de Status */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-black text-slate-100">
              {isCancelled ? 'Pedido Cancelado' : STATUS_STEPS[currentStepIdx]?.label || order.status}
            </h1>
            <p className="text-xs text-slate-400">
              {isCancelled ? 'Este pedido foi cancelado pelo estabelecimento.' : STATUS_STEPS[currentStepIdx]?.desc}
            </p>
          </div>

          {/* Stepper Visual */}
          {!isCancelled && (
            <div className="space-y-4 pt-2">
              {STATUS_STEPS.map((s, idx) => {
                const isPassed = currentStepIdx >= idx;
                const isCurrent = currentStepIdx === idx;

                return (
                  <div key={s.key} className="flex items-start gap-3 relative">
                    {/* Linha conectora */}
                    {idx < STATUS_STEPS.length - 1 && (
                      <div className={`absolute left-3.5 top-7 bottom-0 w-0.5 -mb-4 ${
                        currentStepIdx > idx ? 'bg-amber-500' : 'bg-slate-800'
                      }`} />
                    )}

                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 shadow-lg shadow-amber-500/30'
                        : isPassed
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-slate-950 border border-slate-800 text-slate-600'
                    }`}>
                      {isPassed && !isCurrent ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                    </div>

                    <div className="pt-0.5">
                      <div className={`text-xs font-bold ${isCurrent ? 'text-amber-400' : isPassed ? 'text-slate-200' : 'text-slate-500'}`}>
                        {s.label}
                      </div>
                      <div className="text-[11px] text-slate-500">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumo do Pedido */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Resumo dos Itens</h2>
          <div className="divide-y divide-slate-800 text-xs">
            {order.items?.map((item, idx) => (
              <div key={idx} className="py-2.5 first:pt-0 space-y-0.5">
                <div className="flex justify-between font-semibold text-slate-200">
                  <span>{item.quantity}x {item.product_name}</span>
                  <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                </div>
                {item.addons?.map((a, aIdx) => (
                  <div key={aIdx} className="text-[11px] text-slate-400 pl-3">
                    + {a.name}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-200">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.delivery_type === 'delivery' && (
              <div className="flex justify-between text-slate-400">
                <span>Taxa de Entrega:</span>
                <span className="font-mono text-slate-200">{formatCurrency(order.delivery_fee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-slate-100 pt-1 border-t border-slate-800">
              <span>Total Pago/A Pagar:</span>
              <span className="font-mono text-amber-400">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
