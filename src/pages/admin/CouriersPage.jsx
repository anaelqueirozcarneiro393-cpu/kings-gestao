import React, { useState, useEffect } from 'react';
import { Bike, Plus, Phone, DollarSign, CheckCircle2, MessageCircle, Edit2, Trash2, UserCheck, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';

export function CouriersPage() {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState(null);

  // Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dailyFee, setDailyFee] = useState('50.00');
  const [feePerDelivery, setFeePerDelivery] = useState('4.00');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadCouriers();
  }, []);

  const loadCouriers = async () => {
    setLoading(true);
    try {
      const data = await api.getCouriers();
      setCouriers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setCouriers([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCourier(null);
    setName('');
    setPhone('');
    setDailyFee('50.00');
    setFeePerDelivery('4.00');
    setIsModalOpen(true);
  };

  const openEditModal = (courier) => {
    setEditingCourier(courier);
    setName(courier.name);
    setPhone(courier.phone || '');
    setDailyFee(courier.daily_fee !== undefined && courier.daily_fee !== null ? String(courier.daily_fee) : '50.00');
    setFeePerDelivery(courier.fee_per_delivery !== undefined && courier.fee_per_delivery !== null ? String(courier.fee_per_delivery) : '4.00');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name) return;

    setActionLoading(true);
    try {
      const payload = {
        name,
        phone,
        daily_fee: parseFloat(dailyFee) || 0,
        fee_per_delivery: parseFloat(feePerDelivery) || 0
      };

      if (editingCourier) {
        await api.updateCourier(editingCourier.id, payload);
      } else {
        await api.createCourier(payload);
      }

      setIsModalOpen(false);
      await loadCouriers();
    } catch (err) {
      alert(err.message || 'Erro ao salvar entregador');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Deseja realmente remover o entregador ${name}?`)) return;
    try {
      await api.deleteCourier(id);
      await loadCouriers();
    } catch (err) {
      alert(err.message || 'Erro ao deletar entregador');
    }
  };

  const couriersList = Array.isArray(couriers) ? couriers : [];
  const totalDeliveriesToday = couriersList.reduce((acc, c) => acc + (Number(c.today_deliveries) || 0), 0);
  const totalPayoutToday = couriersList.reduce((acc, c) => acc + (Number(c.today_earnings) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Bike className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide">
              Entregadores & Diárias
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão da equipe de entrega, cálculo automático de diárias e taxa por corrida.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Cadastrar Entregador</span>
        </button>
      </div>

      {/* Cards de Resumo de Hoje */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 mb-1">Entregadores Ativos</div>
          <div className="text-2xl font-black font-mono text-slate-100">
            {couriers.filter(c => c.active).length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-semibold text-emerald-400 mb-1">Entregas Realizadas Hoje</div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {totalDeliveriesToday}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-semibold text-amber-400 mb-1">Total a Pagar Hoje (Diárias + Taxas)</div>
          <div className="text-2xl font-black font-mono text-amber-400">
            R$ {totalPayoutToday.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Grid de Entregadores */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : couriers.length === 0 ? (
        <div className="py-20 text-center bg-slate-950 rounded-2xl border border-slate-800">
          <Bike className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">Nenhum entregador cadastrado</h3>
          <p className="text-xs text-slate-500 mt-1">Cadastre seus motoboys para despachar pedidos e controlar os repasses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {couriers.map(courier => {
            const cleanPhone = courier.phone?.replace(/\D/g, '') || '';
            const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

            return (
              <div
                key={courier.id}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-sm">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-100 text-sm">{courier.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{courier.phone || 'Sem telefone'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(courier)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(courier.id, courier.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Informações de Acordo Financeiro */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-850 text-xs mb-4">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Diária Fixa</span>
                      <span className="font-mono font-bold text-slate-200">R$ {Number(courier.daily_fee || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Por Entrega</span>
                      <span className="font-mono font-bold text-slate-200">+ R$ {Number(courier.fee_per_delivery || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Resumo do Dia de Hoje */}
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Entregas de hoje:</span>
                      <span className="font-mono font-bold text-amber-400">{courier.today_deliveries || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total a repassar hoje:</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        R$ {Number(courier.today_earnings || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="pt-2 border-t border-slate-900 flex items-center gap-2">
                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-600 italic">Sem WhatsApp cadastrado</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">
              {editingCourier ? 'Editar Entregador' : 'Novo Entregador'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Oliveira"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp / Telefone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Diária Fixa (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">R$</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={dailyFee}
                      onChange={(e) => setDailyFee(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Por Entrega (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">R$</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={feePerDelivery}
                      onChange={(e) => setFeePerDelivery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Salvando...' : 'Salvar Entregador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
