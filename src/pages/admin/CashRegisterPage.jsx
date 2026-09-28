import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Unlock,
  DollarSign,
  CreditCard,
  QrCode,
  AlertCircle,
  History,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';

export function CashRegisterPage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [isMovementModal, setIsMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('sangria'); // 'sangria' | 'suprimento'
  const [isCloseShiftModal, setIsCloseShiftModal] = useState(false);

  // Form states
  const [initialFloat, setInitialFloat] = useState('100.00');
  const [operatorName, setOperatorName] = useState('Proprietário');

  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const [finalCashCounted, setFinalCashCounted] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadCashData();
  }, []);

  const loadCashData = async () => {
    setLoading(true);
    try {
      const current = await api.getCashCurrent();
      setData(current);
      const hist = await api.getCashHistory();
      setHistory(hist);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.openCashShift({
        initial_float: parseFloat(initialFloat) || 0,
        operator_name: operatorName
      });
      setIsOpenShiftModal(false);
      await loadCashData();
    } catch (err) {
      alert(err.message || 'Erro ao abrir caixa');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordMovement = async (e) => {
    e.preventDefault();
    if (!movementAmount || !movementReason) {
      alert('Informe o valor e o motivo');
      return;
    }
    setActionLoading(true);
    try {
      await api.recordCashMovement({
        shift_id: data.shift.id,
        type: movementType,
        amount: parseFloat(movementAmount),
        reason: movementReason
      });
      setIsMovementModal(false);
      setMovementAmount('');
      setMovementReason('');
      await loadCashData();
    } catch (err) {
      alert(err.message || 'Erro ao registrar movimentação');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.closeCashShift({
        shift_id: data.shift.id,
        final_cash_counted: parseFloat(finalCashCounted) || 0,
        notes: closeNotes
      });
      setIsCloseShiftModal(false);
      setFinalCashCounted('');
      setCloseNotes('');
      await loadCashData();
    } catch (err) {
      alert(err.message || 'Erro ao fechar caixa');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasOpenShift = data?.has_open_shift;
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide">
              Frente de Caixa & Gaveta
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Controle de turnos, troco inicial, sangrias, suprimentos e conferência cega de gaveta.
          </p>
        </div>

        <div>
          {hasOpenShift ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Caixa Aberto #{data.shift.id}
              </span>
              <button
                onClick={() => {
                  setFinalCashCounted(stats ? stats.expected_drawer_cash.toFixed(2) : '0.00');
                  setIsCloseShiftModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Encerrar Turno</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsOpenShiftModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Turno de Caixa</span>
            </button>
          )}
        </div>
      </div>

      {!hasOpenShift ? (
        /* Empty State / Caixa Fechado */
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto my-12">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-500">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">O Caixa Está Fechado</h2>
          <p className="text-xs text-slate-400 mt-2 mb-6">
            Abra um novo turno informando o fundo de troco inicial da gaveta para iniciar a operação e registrar vendas em dinheiro.
          </p>
          <button
            onClick={() => setIsOpenShiftModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            <span>Abrir Caixa Agora</span>
          </button>
        </div>
      ) : (
        /* Open Shift Dashboard */
        <div className="space-y-6">
          {/* Metricas Principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Dinheiro Esperado na Gaveta */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-900 border border-amber-500/40">
              <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-1">
                <span>Dinheiro na Gaveta</span>
                <Wallet className="w-4 h-4" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-100">
                R$ {stats.expected_drawer_cash.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Fundo (R$ {stats.initial_float.toFixed(2)}) + Dinheiro (+{stats.cash_sales.toFixed(2)}) + Suprim. - Sangrias
              </div>
            </div>

            {/* Vendas Dinheiro */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-bold mb-1">
                <span>Vendas em Espécie</span>
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="text-xl font-black font-mono text-slate-100">
                R$ {stats.cash_sales.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Recebido em dinheiro vivo</div>
            </div>

            {/* Vendas PIX */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-teal-400 font-bold mb-1">
                <span>Vendas no PIX</span>
                <QrCode className="w-4 h-4" />
              </div>
              <div className="text-xl font-black font-mono text-slate-100">
                R$ {stats.pix_sales.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Transferências instantâneas</div>
            </div>

            {/* Vendas Cartões */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-indigo-400 font-bold mb-1">
                <span>Vendas em Cartão</span>
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="text-xl font-black font-mono text-slate-100">
                R$ {stats.card_sales.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Débito e Crédito</div>
            </div>
          </div>

          {/* Barra de Ações Rápidas de Movimentação */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Turno iniciado por <strong className="text-slate-200">{data.shift.operator_name}</strong> em{' '}
              {new Date(data.shift.opened_at).toLocaleTimeString('pt-BR')} (Total Faturado:{' '}
              <strong className="text-amber-400">R$ {stats.total_sales.toFixed(2)}</strong> em {stats.orders_count} pedidos)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMovementType('suprimento');
                  setIsMovementModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>+ Suprimento (Entrada)</span>
              </button>

              <button
                onClick={() => {
                  setMovementType('sangria');
                  setIsMovementModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>- Sangria (Retirada)</span>
              </button>
            </div>
          </div>

          {/* Histórico de Movimentações da Gaveta no Turno Atual */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Movimentações de Gaveta do Turno Atual
              </h3>
              <span className="text-[10px] text-slate-500">{data.movements?.length || 0} lançamentos</span>
            </div>

            {(!data.movements || data.movements.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Nenhuma sangria ou suprimento registrado neste turno.
              </div>
            ) : (
              <div className="divide-y divide-slate-900">
                {data.movements.map(m => (
                  <div key={m.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${m.type === 'sangria' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {m.type === 'sangria' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-200 capitalize">
                          {m.type === 'sangria' ? 'Sangria (Retirada de Gaveta)' : 'Suprimento (Entrada de Troco)'}
                        </div>
                        <div className="text-[11px] text-slate-400">{m.reason}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-bold ${m.type === 'sangria' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {m.type === 'sangria' ? '-' : '+'} R$ {m.amount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {new Date(m.created_at).toLocaleTimeString('pt-BR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Histórico Geral de Turnos Fechados */}
      <div className="mt-8 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Histórico de Turnos Fechados
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">Últimos {history.length} turnos</span>
        </div>

        {history.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Nenhum histórico de turno registrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Turno #</th>
                  <th className="py-2.5 px-4">Operador</th>
                  <th className="py-2.5 px-4">Abertura</th>
                  <th className="py-2.5 px-4">Fechamento</th>
                  <th className="py-2.5 px-4 text-right">Fundo Inicial</th>
                  <th className="py-2.5 px-4 text-right">Dinheiro Contado</th>
                  <th className="py-2.5 px-4">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-300">
                {history.map(s => (
                  <tr key={s.id} className="hover:bg-slate-900/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-amber-400">#{s.id}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-200">{s.operator_name}</td>
                    <td className="py-2.5 px-4 text-slate-400">{new Date(s.opened_at).toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-4 text-slate-400">{s.closed_at ? new Date(s.closed_at).toLocaleString('pt-BR') : '-'}</td>
                    <td className="py-2.5 px-4 text-right font-mono">R$ {s.initial_float.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                      R$ {(s.final_cash_counted || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] truncate max-w-xs">{s.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Abrir Turno */}
      {isOpenShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Abertura de Caixa</h3>
                <p className="text-xs text-slate-400">Informe os dados para iniciar o turno</p>
              </div>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Operador
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fundo de Troco Inicial (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialFloat}
                    onChange={(e) => setInitialFloat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Valor em dinheiro colocado na gaveta no início da operação.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Abrindo...' : 'Confirmar Abertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sangria ou Suprimento */}
      {isMovementModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${movementType === 'sangria' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {movementType === 'sangria' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {movementType === 'sangria' ? 'Registrar Sangria (Retirada)' : 'Registrar Suprimento (Entrada)'}
                </h3>
                <p className="text-xs text-slate-400">
                  {movementType === 'sangria' ? 'Retirada de dinheiro da gaveta do caixa' : 'Entrada extra de troco/dinheiro'}
                </p>
              </div>
            </div>

            <form onSubmit={handleRecordMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Valor (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo / Justificativa
                </label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder={movementType === 'sangria' ? 'Ex: Pagamento do fornecedor de gelo, retirada de segurança' : 'Ex: Reforço de troco notas de R$ 2 e R$ 5'}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMovementModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-5 py-2 rounded-xl text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 ${movementType === 'sangria' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                >
                  {actionLoading ? 'Registrando...' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Fechar Turno */}
      {isCloseShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Fechamento de Caixa</h3>
                <p className="text-xs text-slate-400">Conferência física da gaveta de dinheiro</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Esperado pelo Sistema:</span>
                <strong className="text-slate-100 font-mono">R$ {stats?.expected_drawer_cash.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Faturado no Turno:</span>
                <strong className="text-amber-400 font-mono">R$ {stats?.total_sales.toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Dinheiro Físico Contado na Gaveta (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={finalCashCounted}
                    onChange={(e) => setFinalCashCounted(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                {finalCashCounted && stats && (
                  <div className="mt-2 text-xs">
                    {(() => {
                      const diff = parseFloat(finalCashCounted) - stats.expected_drawer_cash;
                      if (Math.abs(diff) < 0.05) {
                        return <span className="text-emerald-400 font-semibold">✓ Caixa bateu perfeitamente!</span>;
                      } else if (diff > 0) {
                        return <span className="text-amber-400 font-semibold">⚠️ Sobra de caixa: + R$ {diff.toFixed(2)}</span>;
                      } else {
                        return <span className="text-rose-400 font-semibold">⚠️ Falta de caixa: - R$ {Math.abs(diff).toFixed(2)}</span>;
                      }
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observações de Fechamento (opcional)
                </label>
                <textarea
                  rows="2"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Justificativa de sobra/falta ou recados para o próximo turno..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Fechando...' : 'Confirmar e Encerrar Caixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
