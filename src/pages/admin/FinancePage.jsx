import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, ArrowUpRight, ArrowDownRight, Receipt, Calendar, PieChart, X } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';

const EXPENSE_CATEGORIES = [
  'Ingredientes/Insumos',
  'Embalagens',
  'Gás',
  'Energia',
  'Publicidade & Marketing',
  'Entregadores / Motoboys',
  'Taxas de Cartão & Impostos',
  'Salários & Equipe',
  'Aluguel & Condomínio',
  'Outros Gastos Operacionais'
];

export function FinancePage({ selectedBusinessId }) {
  const [period, setPeriod] = useState('mes_atual');
  const [dre, setDre] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Despesa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    business_id: '',
    description: '',
    amount: '',
    category: EXPENSE_CATEGORIES[0],
    date: new Date().toISOString().slice(0, 10),
    observation: ''
  });

  useEffect(() => {
    loadFinanceData();
  }, [period, selectedBusinessId]);

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      const [dreData, expData, bData] = await Promise.all([
        api.getDre({ period, business_id: selectedBusinessId || '' }),
        api.getExpenses(selectedBusinessId || ''),
        api.getBusinesses()
      ]);
      setDre(dreData);
      setExpenses(expData);
      setBusinesses(bData.filter(b => b.active));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.category || !formData.date) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    try {
      await api.createExpense({
        ...formData,
        amount: Number(formData.amount),
        business_id: formData.business_id ? Number(formData.business_id) : null
      });
      setIsModalOpen(false);
      setFormData({
        business_id: '',
        description: '',
        amount: '',
        category: EXPENSE_CATEGORIES[0],
        date: new Date().toISOString().slice(0, 10),
        observation: ''
      });
      loadFinanceData();
    } catch (err) {
      alert('Erro ao registrar despesa: ' + err.message);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (confirm('Deseja excluir este lançamento de despesa?')) {
      try {
        await api.deleteExpense(id);
        loadFinanceData();
      } catch (err) {
        alert('Erro ao excluir: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Financeiro & DRE Operacional
          </h1>
          <p className="text-xs text-slate-400">
            Demonstrativo de Resultado do Exercício, receitas, CMV e controle rigoroso de despesas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto scrollbar-none">
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: '7dias', label: '7 Dias' },
              { id: 'mes_atual', label: 'Este Mês' },
              { id: 'mes_anterior', label: 'Mês Anterior' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  period === opt.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-amber-500/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>+ Lançar Despesa</span>
          </button>
        </div>
      </div>

      {/* DRE (Demonstrativo de Resultado) Estruturado */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <Receipt className="w-4 h-4 text-amber-400" />
          <span>DRE - Demonstrativo de Resultado Operacional</span>
        </h2>

        <div className="space-y-2 text-xs">
          {/* Receita Bruta */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 font-semibold">
            <span className="text-slate-200">(+) RECEITA BRUTA TOTAL</span>
            <span className="font-mono text-emerald-400 text-sm font-bold">
              {formatCurrency(dre?.gross_revenue)}
            </span>
          </div>

          {/* Detalhes da Receita */}
          <div className="pl-6 space-y-1 text-slate-400 text-[11px]">
            <div className="flex justify-between">
              <span>• Vendas de Produtos / Cardápio:</span>
              <span className="font-mono">{formatCurrency(dre?.sales_subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>• Taxas de Entrega Recebidas:</span>
              <span className="font-mono">{formatCurrency(dre?.delivery_fees)}</span>
            </div>
          </div>

          {/* (-) CMV */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 text-amber-300">
            <span>(-) CUSTO DAS MERCADORIAS VENDIDAS (CMV)</span>
            <span className="font-mono font-bold">
              - {formatCurrency(dre?.cmv)} ({formatPercent(dre?.cmv_percent)})
            </span>
          </div>

          {/* (=) Lucro Bruto */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-100">
            <span>(=) LUCRO BRUTO OPERACIONAL</span>
            <span className="font-mono text-amber-400 text-sm">
              {formatCurrency(dre?.gross_profit)} ({formatPercent(dre?.gross_margin_percent)})
            </span>
          </div>

          {/* (-) Despesas Operacionais */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 text-rose-300">
            <span>(-) DESPESAS OPERACIONAIS FIXAS & VARIÁVEIS</span>
            <span className="font-mono font-bold">
              - {formatCurrency(dre?.total_expenses)}
            </span>
          </div>

          {/* Desdobramento de Despesas */}
          {dre?.expenses && dre.expenses.length > 0 && (
            <div className="pl-6 space-y-1 text-slate-400 text-[11px]">
              {dre.expenses.map((exp, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>• {exp.category}:</span>
                  <span className="font-mono">{formatCurrency(exp.total)}</span>
                </div>
              ))}
            </div>
          )}

          {/* (=) Lucro Líquido */}
          <div className={`flex items-center justify-between p-4 rounded-xl border-2 font-black text-sm mt-3 ${
            (dre?.operating_profit || 0) >= 0
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
          }`}>
            <span className="tracking-wide">(=) RESULTADO OPERACIONAL LÍQUIDO FINAL</span>
            <div className="text-right font-mono">
              <div>{formatCurrency(dre?.operating_profit)}</div>
              <div className="text-[10px] font-normal opacity-80">
                Margem Líquida: {formatPercent(dre?.net_margin_percent)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lançamentos de Despesas */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md space-y-4">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center justify-between">
          <span>Livro de Lançamentos de Despesas</span>
          <span className="text-xs text-slate-400 font-normal">{expenses.length} lançamentos</span>
        </h2>

        {expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma despesa registrada"
            description="Cadastre despesas como embalagens, luz, gás, entregadores ou insumos para manter a DRE 100% precisa."
            actionLabel="+ Cadastrar Despesa"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Operação</th>
                  <th className="py-2.5 px-3 font-mono text-right">Valor (R$)</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-900/80 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{e.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-100">{e.description}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {e.business_name || 'Geral KING\'S'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-400 text-right">
                      - {formatCurrency(e.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo Lançamento de Despesa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <h2 className="text-base font-bold text-slate-100">Registrar Saída / Despesa</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Descrição do Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compra de 500 copos, Conta de energia elétrica, Taxa motoboy..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="150.00"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Categoria *</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Alocar à Operação</label>
                <select
                  value={formData.business_id}
                  onChange={e => setFormData({ ...formData, business_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
                >
                  <option value="">Geral KING'S (Corporativo)</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observações Adicionais</label>
                <textarea
                  rows="2"
                  placeholder="Número de nota fiscal, forma de pagamento, etc."
                  value={formData.observation}
                  onChange={e => setFormData({ ...formData, observation: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
