import React, { useState, useEffect } from 'react';
import { ClipboardCheck, History, AlertCircle, Save, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';

export function InventoryAuditPage({ selectedBusinessId }) {
  const [template, setTemplate] = useState([]);
  const [counts, setCounts] = useState({});
  const [auditsHistory, setAuditsHistory] = useState([]);
  const [operator, setOperator] = useState('Proprietário');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('new_audit'); // 'new_audit' | 'history'

  useEffect(() => {
    loadTemplate();
    loadHistory();
  }, [selectedBusinessId]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const data = await api.getInventoryAuditTemplate(selectedBusinessId);
      setTemplate(data);
      // Pre-fill physical count default to current system stock so user only changes what differed
      const initialCounts = {};
      data.forEach(item => {
        initialCounts[item.id] = item.current_stock.toString();
      });
      setCounts(initialCounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await api.getInventoryAudits();
      setAuditsHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCountChange = (ingredientId, val) => {
    setCounts(prev => ({
      ...prev,
      [ingredientId]: val
    }));
  };

  const handleSubmitAudit = async (e) => {
    e.preventDefault();
    if (!confirm('Deseja finalizar o balanço físico? O estoque de todos os insumos alterados será atualizado com os novos valores contados.')) {
      return;
    }

    setSubmitting(true);
    try {
      const countsArray = template.map(item => ({
        ingredient_id: item.id,
        physical_stock: parseFloat(counts[item.id]) || 0
      }));

      const res = await api.submitInventoryAudit({
        business_id: selectedBusinessId || null,
        operator,
        notes,
        counts: countsArray
      });

      alert(`Balanço #${res.audit_id} registrado com sucesso! O estoque foi ajustado.`);
      setNotes('');
      await loadTemplate();
      await loadHistory();
      setActiveTab('history');
    } catch (err) {
      alert(err.message || 'Erro ao processar balanço físico');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations for current form
  let totalDivergencesCount = 0;
  let netVarianceValue = 0;

  template.forEach(item => {
    const physical = parseFloat(counts[item.id]);
    if (!isNaN(physical)) {
      const diff = physical - item.current_stock;
      if (Math.abs(diff) > 0.001) {
        totalDivergencesCount++;
        netVarianceValue += diff * item.cost_per_unit;
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide">
              Balanço Físico de Estoque
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Contagem física real da despensa e freezers. Identifique sobras ou quebras e alinhe o sistema em 1 clique.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            onClick={() => setActiveTab('new_audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'new_audit'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Realizar Contagem
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Histórico ({auditsHistory.length})
          </button>
        </div>
      </div>

      {activeTab === 'new_audit' ? (
        <form onSubmit={handleSubmitAudit} className="space-y-6">
          {/* Top Summary Bar */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <label className="text-slate-400 block text-[10px] uppercase font-semibold">Responsável</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-100 text-xs font-medium focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block text-[10px] uppercase font-semibold">Observação / Motivo</label>
                <input
                  type="text"
                  placeholder="Ex: Fechamento semanal, contagem mensal..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-100 text-xs font-medium focus:border-amber-500 focus:outline-none w-64"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Divergências Detectadas</div>
                <div className="font-mono text-sm font-bold text-slate-200">
                  {totalDivergencesCount} insumos ({netVarianceValue >= 0 ? '+' : '-'} R$ {Math.abs(netVarianceValue).toFixed(2)})
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || template.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'Ajustando...' : 'Finalizar e Ajustar Estoque'}</span>
              </button>
            </div>
          </div>

          {/* Tabela de Contagem de Insumos */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="py-20 flex justify-center">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : template.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                Nenhum insumo ativo encontrado para contagem.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Insumo</th>
                      <th className="py-3 px-4">Operação</th>
                      <th className="py-3 px-4 text-center">Unidade</th>
                      <th className="py-3 px-4 text-right">Estoque Sistema</th>
                      <th className="py-3 px-4 text-center w-40">Contagem Física Real</th>
                      <th className="py-3 px-4 text-right">Diferença (Qtd)</th>
                      <th className="py-3 px-4 text-right">Impacto Financeiro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300">
                    {template.map(item => {
                      const physical = parseFloat(counts[item.id]);
                      const hasCount = !isNaN(physical);
                      const diff = hasCount ? physical - item.current_stock : 0;
                      const diffValue = diff * item.cost_per_unit;
                      const hasDivergence = hasCount && Math.abs(diff) > 0.001;

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${hasDivergence ? 'bg-amber-500/5' : 'hover:bg-slate-900/30'}`}
                        >
                          <td className="py-3 px-4 font-bold text-slate-100">{item.name}</td>
                          <td className="py-3 px-4 text-slate-400 font-semibold">{item.business_name}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-400 uppercase text-[11px]">
                            {item.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-300">
                            {item.current_stock.toLocaleString('pt-BR')} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              step="any"
                              value={counts[item.id] !== undefined ? counts[item.id] : ''}
                              onChange={(e) => handleCountChange(item.id, e.target.value)}
                              className={`w-32 bg-slate-900 border text-center rounded-lg px-2.5 py-1.5 font-mono font-bold text-xs focus:outline-none ${
                                hasDivergence
                                  ? 'border-amber-500 text-amber-300'
                                  : 'border-slate-800 text-slate-100'
                              }`}
                            />
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {hasDivergence ? (
                              <span className={diff > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} {item.unit}
                              </span>
                            ) : (
                              <span className="text-slate-600">0.00</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {hasDivergence ? (
                              <span className={diffValue > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {diffValue > 0 ? `+ R$ ${diffValue.toFixed(2)}` : `- R$ ${Math.abs(diffValue).toFixed(2)}`}
                              </span>
                            ) : (
                              <span className="text-slate-600">R$ 0,00</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </form>
      ) : (
        /* Aba de Histórico de Balanços */
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Histórico de Auditorias de Estoque
            </h3>
          </div>

          {auditsHistory.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              Nenhuma auditoria realizada até o momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Auditoria #</th>
                    <th className="py-3 px-4">Data e Hora</th>
                    <th className="py-3 px-4">Operação</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4 text-center">Itens Auditados</th>
                    <th className="py-3 px-4 text-right">Divergência Total</th>
                    <th className="py-3 px-4">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {auditsHistory.map(a => (
                    <tr key={a.id} className="hover:bg-slate-900/40">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">#{a.id}</td>
                      <td className="py-3 px-4 text-slate-300">{new Date(a.created_at).toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-4 font-semibold text-slate-200">{a.business_name || 'Geral (Todas)'}</td>
                      <td className="py-3 px-4 text-slate-400">{a.operator}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-300">{a.items_count}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        R$ {(a.total_variance_value || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-xs">{a.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
