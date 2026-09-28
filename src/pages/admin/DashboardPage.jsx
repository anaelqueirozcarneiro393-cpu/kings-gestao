import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  Printer,
  ChevronRight,
  Package,
  Layers,
  Sparkles,
  Calendar
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatPercent, formatDateTime } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';
import { ThermalReceipt } from '../../components/admin/ThermalReceipt';

export function DashboardPage({ selectedBusinessId, onNavigateToOrders, onNavigateToStock }) {
  const [period, setPeriod] = useState('hoje'); // hoje, ontem, 7dias, mes_atual, mes_anterior
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printingOrder, setPrintingOrder] = useState(null);

  useEffect(() => {
    loadDashboard();

    const handleUpdate = () => loadDashboard();
    window.addEventListener('kings_order_updated', handleUpdate);
    return () => window.removeEventListener('kings_order_updated', handleUpdate);
  }, [period, selectedBusinessId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard({
        period,
        business_id: selectedBusinessId || ''
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = data?.metrics || {
    revenue: 0,
    orders_count: 0,
    ticket_medio: 0,
    cmv: 0,
    cmv_percent: 0,
    gross_profit: 0,
    expenses: 0,
    net_profit: 0
  };

  const periodOptions = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'ontem', label: 'Ontem' },
    { id: '7dias', label: 'Últimos 7 dias' },
    { id: 'mes_atual', label: 'Este Mês' },
    { id: 'mes_anterior', label: 'Mês Anterior' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Period Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Dashboard Executivo
          </h1>
          <p className="text-xs text-slate-400">
            {selectedBusinessId
              ? `Visão analítica filtrada para a operação selecionada`
              : 'Visão agregada consolidada de toda a marca KING\'S'}
          </p>
        </div>

        {/* Filtros de Período */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto scrollbar-none shadow-sm">
          {periodOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                period === opt.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Principal de KPIs Financeiros e Operacionais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Faturamento */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Faturamento</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-100">
            {formatCurrency(metrics.revenue)}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>{metrics.orders_count} pedidos</span>
            <span className="font-mono">TM: {formatCurrency(metrics.ticket_medio)}</span>
          </div>
        </div>

        {/* CMV (Custo das Mercadorias Vendidas) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">CMV Realizado</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-amber-400">
            {formatCurrency(metrics.cmv)}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>CMV % sobre Venda</span>
            <span className="font-mono font-bold text-amber-300">{formatPercent(metrics.cmv_percent)}</span>
          </div>
        </div>

        {/* Lucro Bruto */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Lucro Bruto</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-100">
            {formatCurrency(metrics.gross_profit)}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>Margem Bruta</span>
            <span className="font-mono text-slate-300">
              {metrics.revenue > 0 ? formatPercent((metrics.gross_profit / metrics.revenue) * 100) : '0%'}
            </span>
          </div>
        </div>

        {/* Lucro Líquido / Operacional */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Lucro Operacional</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className={`font-mono text-xl sm:text-2xl font-bold ${metrics.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(metrics.net_profit)}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>Despesas: {formatCurrency(metrics.expenses)}</span>
            <span className="font-mono text-slate-300">
              {metrics.revenue > 0 ? formatPercent((metrics.net_profit / metrics.revenue) * 100) : '0%'}
            </span>
          </div>
        </div>
      </div>

      {/* Cards Separados: KING'S AÇAÍ, KING'S BURGUER, KING'S PIZZA e TOTAL KING'S */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Desempenho por Unidade de Negócio
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">Filtro: {periodOptions.find(p => p.id === period)?.label}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card TOTAL KING'S */}
          <div className="p-5 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-slate-900 to-slate-950 shadow-lg space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm text-slate-100">TOTAL KING'S</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase">
                Consolidado
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Faturamento Bruto</div>
              <div className="font-mono text-xl font-bold text-slate-100">
                {formatCurrency(data?.total_kings?.revenue)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs text-slate-400 font-mono">
              <div>
                <span className="block text-[10px] uppercase text-slate-500">Pedidos</span>
                <span className="text-slate-200 font-semibold">{data?.total_kings?.orders_count || 0}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-slate-500">Lucro Líquido</span>
                <span className="text-emerald-400 font-semibold">{formatCurrency(data?.total_kings?.net_profit)}</span>
              </div>
            </div>
          </div>

          {/* Cards das Operações */}
          {data?.businesses?.map(b => {
            const isComingSoon = !b.active || b.status === 'coming_soon';

            return (
              <div
                key={b.id}
                className={`p-5 rounded-2xl border bg-slate-900/80 shadow-md space-y-3 ${
                  isComingSoon ? 'border-dashed border-slate-800 opacity-80' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{b.slug === 'acai' ? '🍧' : b.slug === 'burguer' ? '🍔' : '🍕'}</span>
                    <span className="font-bold text-sm text-slate-200">{b.name}</span>
                  </div>
                  {isComingSoon ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 uppercase">
                      Em breve
                    </span>
                  ) : b.is_open ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                      Aberta
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Fechada
                    </span>
                  )}
                </div>

                {isComingSoon ? (
                  <div className="py-2 text-center text-xs text-slate-500 space-y-1">
                    <p>Operação cadastrada na arquitetura.</p>
                    <p className="text-[10px] text-amber-400/80">Ativável em Configurações</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-400">Faturamento</div>
                      <div className="font-mono text-lg font-bold text-slate-100">
                        {formatCurrency(b.metrics?.revenue)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400 font-mono">
                      <div>
                        <span className="block text-[10px] uppercase text-slate-500">CMV %</span>
                        <span className="text-amber-400 font-semibold">{formatPercent(b.metrics?.cmv_percent)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-slate-500">Lucro Bruto</span>
                        <span className="text-slate-200 font-semibold">{formatCurrency(b.metrics?.gross_profit)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Seção Inferior: Pedidos Recentes + Top Produtos + Alertas de Estoque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Pedidos Recentes */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Pedidos Recentes
            </h2>
            <button
              onClick={onNavigateToOrders}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              <span>Ver todos os pedidos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {data?.recent_orders?.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nenhum pedido no período"
              description="Quando os pedidos forem realizados pelo cardápio ou balcão, aparecerão listados aqui em tempo real."
            />
          ) : (
            <div className="divide-y divide-slate-800/80">
              {data?.recent_orders?.map(order => (
                <div key={order.id} className="py-3 first:pt-0 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100">#{order.order_number}</span>
                      <span className="font-semibold text-slate-200">{order.customer_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${
                        order.status === 'entregue' ? 'bg-emerald-500/20 text-emerald-300' :
                        order.status === 'cancelado' ? 'bg-rose-500/20 text-rose-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {formatDateTime(order.created_at)} • {order.delivery_type === 'delivery' ? 'Entrega' : 'Retirada'} • {order.payment_method}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {formatCurrency(order.total)}
                    </span>
                    <button
                      onClick={async () => {
                        const fullOrder = await api.getOrderById(order.id);
                        setPrintingOrder(fullOrder);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Imprimir cupom térmico"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coluna 2: Alertas de Estoque Baixo & Top Produtos */}
        <div className="space-y-6">
          {/* Card Alerta de Estoque Baixo */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Estoque Baixo</span>
              </div>
              <button
                onClick={onNavigateToStock}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Gerenciar
              </button>
            </div>

            {data?.low_stock?.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                <Package className="w-8 h-8 mx-auto text-emerald-400/60 mb-2" />
                <span>Todos os insumos estão acima do nível mínimo de segurança.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.low_stock?.map(ing => (
                  <div key={ing.id} className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{ing.name}</div>
                      <div className="text-[10px] text-slate-400">{ing.business_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-rose-400">
                        {ing.current_stock} {ing.unit}
                      </div>
                      <div className="text-[10px] text-slate-500">Mín: {ing.min_stock} {ing.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card Top Produtos Vendidos */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Produtos Mais Vendidos
            </h2>

            {data?.top_products?.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                <span>Nenhuma venda registrada no período selecionado.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.top_products?.map((prod, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-mono text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-200">{prod.product_name}</div>
                        <div className="text-[10px] text-slate-400">{prod.business_name}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-slate-100">{prod.total_qty} un</div>
                      <div className="text-[10px] text-amber-400">{formatCurrency(prod.total_revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Impressão Térmica se acionado */}
      {printingOrder && (
        <ThermalReceipt
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  );
}
