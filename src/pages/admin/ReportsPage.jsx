import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, CreditCard, PieChart, TrendingUp, DollarSign, Calendar, Layers } from 'lucide-react';
import { api } from '../../services/api';

export function ReportsPage() {
  const [period, setPeriod] = useState('mes_atual');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics({ period });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const periodOptions = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'ontem', label: 'Ontem' },
    { id: '7dias', label: 'Últimos 7 Dias' },
    { id: 'mes_atual', label: 'Mês Atual' },
    { id: 'mes_anterior', label: 'Mês Anterior' },
  ];

  // Calculate ABC classification
  const productsWithAbc = () => {
    if (!data?.products_abc || data.products_abc.length === 0) return [];
    const totalRev = data.products_abc.reduce((acc, p) => acc + p.total_revenue, 0);
    if (totalRev === 0) return data.products_abc;

    let accumulated = 0;
    return data.products_abc.map(p => {
      accumulated += p.total_revenue;
      const share = (accumulated / totalRev) * 100;
      let curve = 'C';
      if (share <= 70) curve = 'A';
      else if (share <= 90) curve = 'B';
      return { ...p, curve };
    });
  };

  const maxHourOrders = data?.hours?.reduce((max, h) => Math.max(max, h.orders_count), 0) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide">
              Relatórios Avançados & Curva ABC
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Análise aprofundada de horários de pico, faturamento por canal, formas de pagamento e rentabilidade por produto.
          </p>
        </div>

        {/* Filtro de Período */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
          {periodOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                period === opt.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="py-20 text-center text-xs text-slate-500">Erro ao carregar dados analíticos</div>
      ) : (
        <div className="space-y-6">
          {/* Seção 1: Horários de Pico & Distribuições */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Horários de Pico */}
            <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    Horários de Pico (Volume de Pedidos)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Por hora do dia</span>
              </div>

              {(!data.hours || data.hours.length === 0) ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhum pedido registrado no período selecionado.
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {data.hours.map(h => {
                    const percent = Math.round((h.orders_count / maxHourOrders) * 100);
                    return (
                      <div key={h.hour} className="flex items-center gap-3 text-xs">
                        <span className="w-12 font-mono font-bold text-slate-400 text-right">
                          {h.hour}:00
                        </span>
                        <div className="flex-1 bg-slate-900 rounded-lg h-6 overflow-hidden relative">
                          <div
                            className="bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-lg transition-all"
                            style={{ width: `${percent}%` }}
                          />
                          <span className="absolute inset-y-0 left-2.5 flex items-center text-[11px] font-bold text-slate-100 drop-shadow">
                            {h.orders_count} {h.orders_count === 1 ? 'pedido' : 'pedidos'}
                          </span>
                        </div>
                        <span className="w-24 text-right font-mono font-semibold text-slate-300">
                          R$ {h.revenue.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Formas de Pagamento e Canais */}
            <div className="space-y-6">
              {/* Formas de Pagamento */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-teal-400" />
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                    Formas de Pagamento
                  </h3>
                </div>

                {(!data.payment_methods || data.payment_methods.length === 0) ? (
                  <div className="py-6 text-center text-xs text-slate-500">Sem dados</div>
                ) : (
                  <div className="space-y-2.5">
                    {data.payment_methods.map(pm => (
                      <div key={pm.payment_method} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-900/60 border border-slate-850">
                        <div>
                          <div className="font-semibold text-slate-200">
                            {pm.payment_method === 'PIX' ? 'PIX Instantâneo' :
                             pm.payment_method === 'DINHEIRO' ? 'Dinheiro em Espécie' :
                             pm.payment_method === 'CARTAO_DEBITO' ? 'Cartão de Débito' :
                             pm.payment_method === 'CARTAO_CREDITO' ? 'Cartão de Crédito' : pm.payment_method}
                          </div>
                          <div className="text-[10px] text-slate-500">{pm.orders_count} pedidos</div>
                        </div>
                        <div className="font-mono font-bold text-slate-100">
                          R$ {pm.revenue.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Origem dos Pedidos */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                    Canais de Venda
                  </h3>
                </div>

                {(!data.sources || data.sources.length === 0) ? (
                  <div className="py-6 text-center text-xs text-slate-500">Sem dados</div>
                ) : (
                  <div className="space-y-2.5">
                    {data.sources.map(s => (
                      <div key={s.source} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-900/60 border border-slate-850">
                        <div>
                          <div className="font-semibold text-slate-200 capitalize">
                            {s.source === 'cardapio_online' ? 'Cardápio Digital Web' : 'Balcão / WhatsApp'}
                          </div>
                          <div className="text-[10px] text-slate-500">{s.count} pedidos</div>
                        </div>
                        <div className="font-mono font-bold text-slate-100">
                          R$ {s.revenue.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção 2: Curva ABC de Produtos & Lucratividade */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    Curva ABC de Produtos & Margem Real
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Classificação por faturamento: Curva A (80% da receita), Curva B (15%), Curva C (5%).
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  Curva A (Carro-chefe)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                  Curva B (Médio)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold">
                  Curva C (Baixo)
                </span>
              </div>
            </div>

            {(!data.products_abc || data.products_abc.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Nenhum produto vendido no período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Classe</th>
                      <th className="py-3 px-4">Produto</th>
                      <th className="py-3 px-4">Operação</th>
                      <th className="py-3 px-4 text-center">Qtd Vendida</th>
                      <th className="py-3 px-4 text-right">Faturamento</th>
                      <th className="py-3 px-4 text-right">Custo Insumos</th>
                      <th className="py-3 px-4 text-right">Lucro Bruto</th>
                      <th className="py-3 px-4 text-right">Margem %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {productsWithAbc().map(p => {
                      const isClassA = p.curve === 'A';
                      const isClassB = p.curve === 'B';

                      return (
                        <tr key={p.product_id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4">
                            <span className={`inline-block w-6 h-6 rounded-md text-center leading-6 font-bold font-mono text-xs ${
                              isClassA
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : isClassB
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {p.curve}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-100">{p.product_name}</td>
                          <td className="py-3 px-4 text-slate-400 font-semibold">{p.business_name}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">{p.total_qty} un</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                            R$ {p.total_revenue.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-rose-400">
                            R$ {p.total_cost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            R$ {p.gross_profit.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            <span className={p.margin_percent >= 60 ? 'text-emerald-400' : p.margin_percent >= 45 ? 'text-amber-400' : 'text-rose-400'}>
                              {p.margin_percent.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
