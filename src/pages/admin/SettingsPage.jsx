import React, { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Power,
  Shield,
  Check,
  MapPin,
  DollarSign,
  Store,
  Download,
  Database,
  CreditCard,
  Plus,
  Trash2,
  Phone
} from 'lucide-react';
import { api } from '../../services/api';

export function SettingsPage() {
  const [businesses, setBusinesses] = useState([]);
  const [settings, setSettings] = useState({});
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delivery zone modal / form
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneFee, setNewZoneFee] = useState('');
  const [newZoneTime, setNewZoneTime] = useState('30-45 min');
  const [addingZone, setAddingZone] = useState(false);

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const [bData, sData, zData] = await Promise.all([
        api.getBusinesses(),
        api.getSettings(),
        api.getDeliveryZones().catch(() => [])
      ]);
      setBusinesses(bData);
      setSettings(sData);
      setDeliveryZones(zData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (bizId) => {
    try {
      await api.toggleBusinessStatus(bizId);
      loadSettingsData();
    } catch (err) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleToggleActive = async (bizId) => {
    try {
      await api.toggleBusinessActive(bizId);
      loadSettingsData();
    } catch (err) {
      alert('Erro ao ativar/desativar operação: ' + err.message);
    }
  };

  const handleUpdateHours = async (bizId, opening_time, closing_time) => {
    try {
      await api.updateBusiness(bizId, { opening_time, closing_time });
      loadSettingsData();
    } catch (err) {
      alert('Erro ao atualizar horários: ' + err.message);
    }
  };

  const handleSaveGeneralSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      await api.updateSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert('Erro ao salvar configurações: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddDeliveryZone = async (e) => {
    e.preventDefault();
    if (!newZoneName || !newZoneFee) return;
    setAddingZone(true);
    try {
      await api.createDeliveryZone({
        name: newZoneName,
        fee: parseFloat(newZoneFee) || 0,
        estimated_minutes: newZoneTime
      });
      setNewZoneName('');
      setNewZoneFee('');
      const updated = await api.getDeliveryZones();
      setDeliveryZones(updated);
    } catch (err) {
      alert(err.message || 'Erro ao adicionar taxa por bairro');
    } finally {
      setAddingZone(false);
    }
  };

  const handleDeleteDeliveryZone = async (id) => {
    if (!confirm('Deseja excluir este bairro de entrega?')) return;
    try {
      await api.deleteDeliveryZone(id);
      const updated = await api.getDeliveryZones();
      setDeliveryZones(updated);
    } catch (err) {
      alert(err.message || 'Erro ao excluir taxa por bairro');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Configurações da Marca KING'S
          </h1>
          <p className="text-xs text-slate-400">
            Controle de horários de funcionamento, taxas por bairro, maquininhas de cartão e backup de dados.
          </p>
        </div>

        {/* 1-Click Backup Button */}
        <div>
          <a
            href="/api/backup"
            download
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Fazer Backup em 1 Clique (.db)</span>
          </a>
        </div>
      </div>

      {/* Operações & Horários */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Gerenciamento das 3 Operações
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {businesses.map(b => {
            const isComingSoon = !b.active || b.status === 'coming_soon';

            return (
              <div
                key={b.id}
                className={`p-5 rounded-2xl border bg-slate-900/80 shadow-md space-y-4 ${
                  isComingSoon ? 'border-dashed border-slate-800' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{b.slug === 'acai' ? '🍧' : b.slug === 'burguer' ? '🍔' : '🍕'}</span>
                    <span className="font-bold text-sm text-slate-100">{b.name}</span>
                  </div>
                  {isComingSoon ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                      Em breve
                    </span>
                  ) : b.is_open ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                      Loja Aberta
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-400 font-bold">
                      Loja Fechada
                    </span>
                  )}
                </div>

                {/* Status Toggle se ativo */}
                {!isComingSoon ? (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Interruptor Manual:</span>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(b.id)}
                        className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                          b.is_manually_closed
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        }`}
                      >
                        {b.is_manually_closed ? 'Abrir Forçado' : 'Fechar Manualmente'}
                      </button>
                    </div>

                    {/* Horários */}
                    <div className="space-y-1.5">
                      <label className="block text-slate-400 font-medium">Horário Programado</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[10px] text-slate-500">Abertura</span>
                          <input
                            type="time"
                            defaultValue={b.opening_time}
                            onBlur={e => handleUpdateHours(b.id, e.target.value, b.closing_time)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500">Fechamento</span>
                          <input
                            type="time"
                            defaultValue={b.closing_time}
                            onBlur={e => handleUpdateHours(b.id, b.opening_time, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Área de ativação para KING'S PIZZA */
                  <div className="pt-2 border-t border-slate-800/80 text-xs space-y-3">
                    <p className="text-slate-400 text-[11px]">
                      Operação cadastrada no banco de dados e pronta para entrar em produção sem necessidade de migração.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(b.id)}
                      className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      🚀 Ativar Operação King's Pizza
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gerenciamento de Bairros e Taxas de Entrega */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Bairros & Taxas de Entrega Dinâmicas
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            Usado no checkout público do cardápio
          </span>
        </div>

        {/* Form para adicionar bairro */}
        <form onSubmit={handleAddDeliveryZone} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Nome do Bairro (ex: Centro)"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            className="sm:col-span-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            required
          />
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">R$</span>
            <input
              type="number"
              step="0.50"
              min="0"
              placeholder="Taxa (ex: 6.00)"
              value={newZoneFee}
              onChange={(e) => setNewZoneFee(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={addingZone}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Bairro</span>
          </button>
        </form>

        {/* Lista de Bairros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {deliveryZones.map(zone => (
            <div
              key={zone.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
            >
              <div>
                <div className="font-bold text-slate-100">{zone.name}</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Estimado: {zone.estimated_minutes || '30-45 min'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-amber-400">
                  R$ {zone.fee.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteDeliveryZone(zone.id)}
                  className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configurações Gerais & Maquininha */}
      <form onSubmit={handleSaveGeneralSettings} className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md space-y-5">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4 h-4 text-amber-400" />
          <span>Configurações Operacionais & Maquininhas de Cartão</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nome Fantasia da Marca</label>
            <input
              type="text"
              value={settings.brand_name || "KING'S"}
              onChange={e => setSettings({ ...settings, brand_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">WhatsApp de Pedidos da Loja</label>
            <input
              type="text"
              placeholder="(11) 99999-9999"
              value={settings.whatsapp_phone || "11999999999"}
              onChange={e => setSettings({ ...settings, whatsapp_phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Taxa Máquina de Cartão - Débito (%)</label>
            <input
              type="number"
              step="0.01"
              value={settings.card_fee_debit || "1.50"}
              onChange={e => setSettings({ ...settings, card_fee_debit: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Taxa Máquina de Cartão - Crédito (%)</label>
            <input
              type="number"
              step="0.01"
              value={settings.card_fee_credit || "3.20"}
              onChange={e => setSettings({ ...settings, card_fee_credit: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Chave PIX para Recebimentos</label>
            <input
              type="text"
              value={settings.pix_key || "pix@kingsgastronomia.com.br"}
              onChange={e => setSettings({ ...settings, pix_key: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nome do Favorecido do PIX</label>
            <input
              type="text"
              value={settings.pix_name || "KING'S GESTAO E ALIMENTOS LTDA"}
              onChange={e => setSettings({ ...settings, pix_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">PIN de Segurança do Painel</label>
            <input
              type="password"
              value={settings.admin_pin || "1234"}
              onChange={e => setSettings({ ...settings, admin_pin: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono tracking-widest focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={savingSettings}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : null}
            <span>{savingSettings ? 'Gravando...' : saveSuccess ? 'Configurações Atualizadas!' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
