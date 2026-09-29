import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, Flame, ArrowRight, RefreshCw, AlertTriangle, Bike, Store, Printer } from 'lucide-react';
import { api } from '../../services/api';
import { playNewOrderChime } from '../../utils/audio';
import { ThermalReceipt } from '../../components/admin/ThermalReceipt';

export function KdsPage({ selectedBusinessId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [lastCount, setLastCount] = useState(0);
  const [printingOrder, setPrintingOrder] = useState(null);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000); // 5s auto-refresh for kitchen
    return () => clearInterval(interval);
  }, [selectedBusinessId]);

  const loadOrders = async () => {
    try {
      const data = await api.getKdsOrders();
      // Filter if business selected
      const filtered = selectedBusinessId
        ? data.filter(o => o.items && o.items.some(i => i.business_id === selectedBusinessId))
        : data;

      if (lastCount !== 0 && filtered.length > lastCount) {
        playNewOrderChime();
      }
      setLastCount(filtered.length);
      setOrders(filtered);
    } catch (err) {
      console.error('Erro ao carregar KDS:', err);
    } finally {
      setLoading(false);
    }
  };

  const advanceStatus = async (order) => {
    let nextStatus = 'preparando';
    if (order.status === 'preparando') nextStatus = 'pronto';
    else if (order.status === 'novo') nextStatus = 'preparando';

    setUpdatingId(order.id);
    try {
      await api.updateOrderStatus(order.id, nextStatus);
      await loadOrders();
    } catch (err) {
      alert(err.message || 'Erro ao atualizar pedido');
    } finally {
      setUpdatingId(null);
    }
  };

  const getTimerBadge = (minutes) => {
    if (minutes < 15) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <Clock className="w-3.5 h-3.5" />
          {minutes} min
        </span>
      );
    }
    if (minutes <= 25) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5" />
          {minutes} min
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
        {minutes} min (ATRASADO)
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide">
              KDS • Tela de Produção da Cozinha
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visualização ao vivo de pedidos em fila e produção. Atualização automática a cada 5s.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{orders.length} pedidos na fila</span>
          </div>
          <button
            onClick={loadOrders}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Atualizar agora"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="py-24 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80">
          <ChefHat className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">Cozinha livre!</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Nenhum pedido pendente ou em preparo no momento. Novos pedidos aparecerão aqui automaticamente com alerta sonoro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(order => {
            const isPreparing = order.status === 'preparando';
            return (
              <div
                key={order.id}
                className={`flex flex-col justify-between rounded-2xl border transition-all ${
                  isPreparing
                    ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                {/* Header do Card */}
                <div className="p-4 border-b border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-lg font-black text-amber-400">
                      #{order.order_number}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrintingOrder(order);
                        }}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Imprimir comanda de cozinha"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                      {getTimerBadge(order.elapsed_minutes)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="font-semibold text-slate-200">
                      {order.customer_name || 'Cliente Balcão'}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                      {order.delivery_type === 'retirada' ? (
                        <>
                          <Store className="w-3.5 h-3.5 text-blue-400" />
                          Retirada
                        </>
                      ) : (
                        <>
                          <Bike className="w-3.5 h-3.5 text-emerald-400" />
                          Entrega
                        </>
                      )}
                    </span>
                  </div>

                  {order.notes && (
                    <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
                      ⚠️ Obs: {order.notes}
                    </div>
                  )}
                </div>

                {/* Itens do Pedido */}
                <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-72">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="border-b border-slate-900 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                          {item.quantity}x
                        </span>
                        <div className="flex-1">
                          <div className="font-bold text-slate-100 text-sm leading-tight">
                            {item.product_name}
                          </div>
                          {item.business_name && (
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                              {item.business_name}
                            </div>
                          )}

                          {/* Complementos e adicionais */}
                          {item.addons && item.addons.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {item.addons.map((add, aIdx) => (
                                <div key={aIdx} className="text-xs text-amber-300/90 flex items-center gap-1.5">
                                  <span className="text-amber-500 font-bold">+</span>
                                  <span>{add.addon_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ações / Avanço de Produção */}
                <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 rounded-b-2xl">
                  {order.status === 'novo' || order.status === 'confirmado' ? (
                    <button
                      onClick={() => advanceStatus(order)}
                      disabled={updatingId === order.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Flame className="w-4 h-4" />
                      <span>{updatingId === order.id ? 'Iniciando...' : 'Iniciar Preparo'}</span>
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </button>
                  ) : (
                    <button
                      onClick={() => advanceStatus(order)}
                      disabled={updatingId === order.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{updatingId === order.id ? 'Finalizando...' : 'Marcar Pronto'}</span>
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Impressão Térmica da Cozinha */}
      {printingOrder && (
        <ThermalReceipt
          order={printingOrder}
          initialView="cozinha"
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  );
}
