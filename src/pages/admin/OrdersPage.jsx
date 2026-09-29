import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Printer,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Search,
  Phone,
  MapPin,
  ChevronRight,
  AlertCircle,
  XCircle,
  Bike
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { ThermalReceipt } from '../../components/admin/ThermalReceipt';
import { EmptyState } from '../../components/ui/EmptyState';

const STATUS_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'novo', label: 'Novos' },
  { id: 'confirmado', label: 'Confirmados' },
  { id: 'preparando', label: 'Em Preparo' },
  { id: 'pronto', label: 'Prontos' },
  { id: 'saiu_entrega', label: 'Saiu p/ Entrega' },
  { id: 'entregue', label: 'Entregues' },
  { id: 'cancelado', label: 'Cancelados' },
];

export function OrdersPage({ selectedBusinessId }) {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [couriers, setCouriers] = useState([]);
  const [autoPrint, setAutoPrint] = useState(() => {
    return localStorage.getItem('kings_autoprint_enabled') === 'true';
  });
  const [knownOrderIds, setKnownOrderIds] = useState(new Set());

  useEffect(() => {
    loadOrders();
    loadCouriers();
    const interval = setInterval(loadOrders, 6000); // 6s polling for live orders
    const handleUpdate = () => loadOrders();
    window.addEventListener('kings_order_updated', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('kings_order_updated', handleUpdate);
    };
  }, [statusFilter, selectedBusinessId, autoPrint, knownOrderIds]);

  const loadCouriers = async () => {
    try {
      const data = await api.getCouriers();
      setCouriers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignCourier = async (orderId, courierId) => {
    try {
      await api.assignOrderCourier(orderId, courierId);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Erro ao vincular entregador');
    }
  };

  const loadOrders = async () => {
    try {
      const data = await api.getOrders({
        status: statusFilter,
        business_id: selectedBusinessId || ''
      });

      // Auto-imprimir se ativado e chegar pedido novo
      if (autoPrint && knownOrderIds.size > 0 && Array.isArray(data)) {
        const brandNewOrder = data.find(o => !knownOrderIds.has(o.id) && o.status === 'novo');
        if (brandNewOrder && (!printingOrder || printingOrder.id !== brandNewOrder.id)) {
          setPrintingOrder(brandNewOrder);
        }
      }

      if (Array.isArray(data)) {
        setKnownOrderIds(new Set(data.map(o => o.id)));
      }
      setOrders(data);
      if (selectedOrder) {
        const refreshed = data.find(o => o.id === selectedOrder.id);
        if (refreshed) setSelectedOrder(refreshed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      loadOrders();
    } catch (err) {
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  const handleTogglePayment = async (orderId, currentPaymentStatus) => {
    try {
      const nextStatus = currentPaymentStatus === 'pago' ? 'pendente' : 'pago';
      await api.updatePaymentStatus(orderId, nextStatus);
      loadOrders();
    } catch (err) {
      alert('Erro ao atualizar pagamento: ' + err.message);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.customer_name?.toLowerCase().includes(q) ||
      o.order_number?.toString().includes(q) ||
      o.customer_phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Gestão de Pedidos & PDV
          </h1>
          <p className="text-xs text-slate-400">
            Acompanhamento em tempo real, fluxo de cozinha, entrega e impressão
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Botão Auto-imprimir */}
          <button
            type="button"
            onClick={() => {
              const next = !autoPrint;
              setAutoPrint(next);
              localStorage.setItem('kings_autoprint_enabled', String(next));
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              autoPrint
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Auto-imprimir: Abre a comanda automaticamente para impressão assim que chegar um novo pedido"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Auto-imprimir:</span>
            <span className={autoPrint ? 'text-emerald-400 font-extrabold' : 'text-slate-500'}>
              {autoPrint ? 'LIGADO' : 'DESLIGADO'}
            </span>
          </button>

          {/* Busca */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome, nº ou tel..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Tabs de Filtro de Status */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto scrollbar-none">
        {STATUS_FILTERS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Layout de Pedidos: Lista + Drawer/Card de Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 e 2: Lista de Pedidos */}
        <div className="lg:col-span-2 space-y-3">
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nenhum pedido encontrado"
              description="Nenhum pedido corresponde ao filtro ou busca selecionada."
            />
          ) : (
            filteredOrders.map(order => {
              const isSelected = selectedOrder?.id === order.id;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? 'border-amber-500/50 bg-slate-900 shadow-lg shadow-amber-500/5'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700/80 hover:bg-slate-900/90'
                  }`}
                >
                  {/* Linha 1: Número, Cliente, Data e Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-base font-extrabold text-amber-400">
                        #{order.order_number}
                      </span>
                      <span className="font-bold text-sm text-slate-100">
                        {order.customer_name}
                      </span>
                      <span className="text-[10px] text-slate-500 hidden sm:inline">
                        • {formatDateTime(order.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                        order.status === 'novo' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse' :
                        order.status === 'confirmado' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        order.status === 'preparando' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        order.status === 'pronto' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                        order.status === 'saiu_entrega' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                        order.status === 'entregue' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Linha 2: Resumo dos Itens */}
                  <div className="text-xs text-slate-300 line-clamp-2">
                    {order.items?.map((it, idx) => (
                      <span key={idx} className="mr-2">
                        {it.quantity}x {it.product_name}
                        {idx < order.items.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>

                  {/* Linha 3: Total, Pagamento e Ações Rápidas */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-slate-100">
                        {formatCurrency(order.total)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {order.delivery_type === 'delivery' ? '🛵 Entrega' : '🏪 Retirada'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        order.payment_status === 'pago'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/10 text-amber-300'
                      }`}>
                        {order.payment_method} ({order.payment_status})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrintingOrder(order);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Imprimir cupom térmico"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {/* Botões de Avanço Rápido de Status */}
                      {order.status === 'novo' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(order.id, 'confirmado');
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Aceitar
                        </button>
                      )}
                      {order.status === 'confirmado' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(order.id, 'preparando');
                          }}
                          className="px-3 py-1 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs transition-colors cursor-pointer"
                        >
                          Preparar
                        </button>
                      )}
                      {order.status === 'preparando' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(order.id, 'pronto');
                          }}
                          className="px-3 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-colors cursor-pointer"
                        >
                          Pronto
                        </button>
                      )}
                      {order.status === 'pronto' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(order.id, order.delivery_type === 'delivery' ? 'saiu_entrega' : 'entregue');
                          }}
                          className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                        >
                          {order.delivery_type === 'delivery' ? 'Despachar' : 'Entregar'}
                        </button>
                      )}
                      {order.status === 'saiu_entrega' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(order.id, 'entregue');
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Concluir Entrega
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Coluna 3: Painel de Detalhes do Pedido Selecionado */}
        <div>
          {selectedOrder ? (
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl space-y-5 sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="text-base font-black text-slate-100 font-mono">
                    PEDIDO #{selectedOrder.order_number}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {formatDateTime(selectedOrder.created_at)}
                  </div>
                </div>

                <button
                  onClick={() => setPrintingOrder(selectedOrder)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
              </div>

              {/* Informações do Cliente */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="font-bold text-slate-200">{selectedOrder.customer_name}</div>
                <div className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>{selectedOrder.customer_phone}</span>
                </div>
                {selectedOrder.delivery_type === 'delivery' && (
                  <>
                    <div className="text-slate-400 flex items-start gap-1.5 pt-1 border-t border-slate-800/60">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{selectedOrder.delivery_address} {selectedOrder.delivery_neighborhood && `- ${selectedOrder.delivery_neighborhood}`}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <Bike className="w-3 h-3 text-amber-400" />
                          <span>Entregador Responsável:</span>
                        </span>
                      </div>
                      <select
                        value={selectedOrder.courier_id || ''}
                        onChange={(e) => handleAssignCourier(selectedOrder.id, e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="">Selecione o Motoboy para despachar...</option>
                        {couriers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''} — Taxa: R$ {Number(c.fee_per_delivery || 0).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {selectedOrder.notes && (
                  <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-300 text-[11px] mt-1">
                    Obs: {selectedOrder.notes}
                  </div>
                )}
              </div>

              {/* Itens do Pedido */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Itens do Pedido
                </div>
                <div className="divide-y divide-slate-800/80 text-xs">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="py-2 first:pt-0 space-y-0.5">
                      <div className="flex justify-between font-semibold text-slate-200">
                        <span>{item.quantity}x {item.product_name}</span>
                        <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                      </div>
                      <span className="text-[10px] text-amber-400 block">{item.business_name}</span>
                      {item.addons?.map((add, aIdx) => (
                        <div key={aIdx} className="text-[11px] text-slate-400 pl-3">
                          + {add.name} {add.unit_price > 0 && `(${formatCurrency(add.unit_price)})`}
                        </div>
                      ))}
                      {item.notes && (
                        <div className="text-[10px] italic text-slate-500 pl-3">
                          Obs: {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totais & Pagamento */}
              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.delivery_type === 'delivery' && (
                  <div className="flex justify-between text-slate-400">
                    <span>Taxa de Entrega:</span>
                    <span className="font-mono text-slate-200">{formatCurrency(selectedOrder.delivery_fee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-100 pt-1 border-t border-slate-800">
                  <span>Total:</span>
                  <span className="font-mono text-amber-400">{formatCurrency(selectedOrder.total)}</span>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-slate-400">Status do Pagamento:</span>
                  <button
                    onClick={() => handleTogglePayment(selectedOrder.id, selectedOrder.payment_status)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                      selectedOrder.payment_status === 'pago'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {selectedOrder.payment_status === 'pago' ? '✓ Pago' : 'Pendente (Clique p/ Pagar)'}
                  </button>
                </div>
              </div>

              {/* Alteração Manual de Status */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase">
                  Alterar Status do Pedido
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['novo', 'confirmado', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'].map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer capitalize ${
                        selectedOrder.status === st
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/40 text-center text-slate-400 text-xs">
              <ShoppingBag className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <span>Selecione um pedido ao lado para visualizar os detalhes e comandas.</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Impressão Térmica */}
      {printingOrder && (
        <ThermalReceipt
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  );
}
