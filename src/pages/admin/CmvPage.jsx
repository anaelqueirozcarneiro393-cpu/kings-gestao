import React, { useState, useEffect } from 'react';
import { TrendingUp, Info, Receipt, Filter, DollarSign, ArrowUpRight } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';

export function CmvPage({ selectedBusinessId }) {
  const [period, setPeriod] = useState('mes_atual'); // hoje, 7dias, mes_atual, mes_anterior
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('products'); // 'products', 'categories', 'operations'

  useEffect(() => {
    loadCmv();
  }, [period, selectedBusinessId]);

  const loadCmv = async () => {
    try {
      setLoading(true);
      const res = await api.getCmvReport({
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

  const products = data?.products || [];
  const summary = data?.summary || {
    total_sales: 0,
    realized_cmv: 0,
    gross_profit: 0,
    cmv_percent: 0,
    gross_margin_percent: 0
  };

  // Group by category
  const categoriesMap = {};
  products.forEach(p => {
    const cat = p.category_name || 'Geral';
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = {
        name: cat,
        business_name: p.business_name,
        products_count: 0,
        total_price: 0,
        total_cost: 0,
      };
    }
    categoriesMap[cat].products_count += 1;
    categoriesMap[cat].total_price += p.sale_price;
    categoriesMap[cat].total_cost += p.cost_reais;
  });

  const categoriesList = Object.values(categoriesMap).map(c => {
    const cmvPct = c.total_price > 0 ? (c.total_cost / c.total_price) * 100 : 0;
    const grossProfit = c.total_price - c.total_cost;
    const marginPct = c.total_price > 0 ? (grossProfit / c.total_price) * 100 : 0;
    return {
      ...c,
      avg_price: c.total_price / c.products_count,
      avg_cost: c.total_cost / c.products_count,
      cmv_percent: cmvPct,
      gross_profit: grossProfit,
      margin_percent: marginPct
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Análise Transparente de CMV
          </h1>
          <p className="text-xs text-slate-400">
            Custo das Mercadorias Vendidas, margem de contribuição e lucratividade unitária real
          </p>
        </div>

        {/* Filtro Temporal */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto scrollbar-none">
          {[
            { id: 'hoje', label: 'CMV Diário (Hoje)' },
            { id: '7dias', label: 'CMV Semanal (7d)' },
            { id: 'mes_atual', label: 'CMV Mensal' },
            { id: 'mes_anterior', label: 'Mês Anterior' }
          ].map(opt => (
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

      {/* Banner Educativo de Fórmulas Transparentes */}
      <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-[11px]">
          <Info className="w-4 h-4 shrink-0" />
          <span>Metodologia & Fórmulas Transparentes de Cálculo KING'S</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="font-bold text-slate-200 block mb-0.5">CMV (R$):</span>
            <span className="text-slate-400 font-mono">Soma do custo de cada grama/ml/unidade da ficha técnica</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="font-bold text-slate-200 block mb-0.5">CMV (%):</span>
            <span className="text-amber-400 font-mono font-bold">(Custo Insumos ÷ Preço de Venda) × 100</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="font-bold text-slate-200 block mb-0.5">Margem Bruta (%):</span>
            <span className="text-emerald-400 font-mono font-bold">(Lucro Bruto ÷ Preço de Venda) × 100</span>
          </div>
        </div>
      </div>

      {/* Resumo Realizado do Período */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-400">Vendas no Período</span>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-100">
            {formatCurrency(summary.total_sales)}
          </div>
          <span className="text-[10px] text-slate-500">Pedidos concluídos</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-400">CMV Realizado (R$)</span>
          <div className="font-mono text-xl sm:text-2xl font-bold text-amber-400">
            {formatCurrency(summary.realized_cmv)}
          </div>
          <span className="text-[10px] text-slate-500">Custo efetivo dos produtos vendidos</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-400">CMV Realizado (%)</span>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-100">
            {formatPercent(summary.cmv_percent)}
          </div>
          <span className="text-[10px] text-slate-500">Impacto sobre o faturamento</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-400">Lucro Bruto das Vendas</span>
          <div className="font-mono text-xl sm:text-2xl font-bold text-emerald-400">
            {formatCurrency(summary.gross_profit)}
          </div>
          <span className="text-[10px] text-slate-500">Margem: {formatPercent(summary.gross_margin_percent)}</span>
        </div>
      </div>

      {/* Seletor de Modo de Visualização */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('products')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'products'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-900 border border-slate-800 text-slate-400'
            }`}
          >
            Visualizar por Produto
          </button>
          <button
            onClick={() => setViewMode('categories')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'categories'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-900 border border-slate-800 text-slate-400'
            }`}
          >
            Visualizar por Categoria
          </button>
        </div>
      </div>

      {/* Tabela de Produtos ou Categorias */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-md">
        {viewMode === 'products' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">Operação</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 font-mono text-right">Preço de Venda</th>
                  <th className="py-3 px-4 font-mono text-right">Custo / CMV (R$)</th>
                  <th className="py-3 px-4 font-mono text-right">CMV %</th>
                  <th className="py-3 px-4 font-mono text-right">Lucro Bruto</th>
                  <th className="py-3 px-4 font-mono text-right">Margem %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {products.map(p => (
                  <tr key={p.product_id} className="hover:bg-slate-900/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-100">{p.name}</td>
                    <td className="py-3 px-4 text-slate-300">{p.business_name}</td>
                    <td className="py-3 px-4 text-slate-400">{p.category_name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-100 text-right">
                      {formatCurrency(p.sale_price)}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-400 text-right">
                      {formatCurrency(p.cmv_reais)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-right">
                      <span className={`px-2 py-0.5 rounded ${
                        p.cmv_percent > 45 ? 'bg-rose-500/10 text-rose-400' :
                        p.cmv_percent > 35 ? 'bg-amber-500/10 text-amber-300' :
                        'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {formatPercent(p.cmv_percent)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-100 text-right">
                      {formatCurrency(p.gross_profit)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 text-right">
                      {formatPercent(p.gross_margin_percent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Operação</th>
                  <th className="py-3 px-4 text-center">Nº Produtos</th>
                  <th className="py-3 px-4 font-mono text-right">Preço Médio</th>
                  <th className="py-3 px-4 font-mono text-right">Custo Médio</th>
                  <th className="py-3 px-4 font-mono text-right">CMV % Médio</th>
                  <th className="py-3 px-4 font-mono text-right">Margem Média %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {categoriesList.map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-100">{c.name}</td>
                    <td className="py-3 px-4 text-slate-300">{c.business_name}</td>
                    <td className="py-3 px-4 text-center text-slate-400">{c.products_count}</td>
                    <td className="py-3 px-4 font-mono text-slate-100 text-right">{formatCurrency(c.avg_price)}</td>
                    <td className="py-3 px-4 font-mono text-amber-400 text-right">{formatCurrency(c.avg_cost)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-right">
                      <span className={c.cmv_percent > 45 ? 'text-rose-400' : 'text-emerald-400'}>
                        {formatPercent(c.cmv_percent)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200 text-right">{formatPercent(c.margin_percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
