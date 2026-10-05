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
  Phone,
  Printer
} from 'lucide-react';
import { api } from '../../services/api';
import { ThermalReceipt } from '../../components/admin/ThermalReceipt';

export function SettingsPage() {
  const [businesses, setBusinesses] = useState([]);
  const [settings, setSettings] = useState({});
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testPrintingOrder, setTestPrintingOrder] = useState(null);
  const [printerWidth, setPrinterWidth] = useState(() => localStorage.getItem('kings_printer_width') || '80mm');
  const [defaultTicketView, setDefaultTicketView] = useState(() => localStorage.getItem('kings_printer_default_view') || 'completa');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => localStorage.getItem('kings_autoprint_enabled') === 'true');

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
        api.getBusinesses().catch(() => []),
        api.getSettings().catch(() => ({})),
        api.getDeliveryZones().catch(() => [])
      ]);
      setBusinesses(Array.isArray(bData) ? bData : []);
      setSettings(sData && typeof sData === 'object' && !Array.isArray(sData) ? sData : {});
      setDeliveryZones(Array.isArray(zData) ? zData : []);
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
                  R$ {Number(zone.fee || 0).toFixed(2)}
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
            <label className="block text-slate-300 font-semibold mb-1">Usuário / Login do Painel</label>
            <input
              type="text"
              value={settings.admin_username || "admin"}
              onChange={e => setSettings({ ...settings, admin_username: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Senha Forte de Acesso ao Painel</label>
            <input
              type="text"
              value={settings.admin_password || settings.admin_pin || "#Kings@2026!Master#"}
              onChange={e => setSettings({ ...settings, admin_password: e.target.value, admin_pin: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Senha forte recomendada: <span className="font-mono text-amber-400">#Kings@2026!Master#</span>
            </p>
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

      {/* Configuração da Impressora Térmica */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Impressora Térmica & Comandas
              </h2>
              <p className="text-xs text-slate-400">
                Configurações de impressão física (Epson, Bematech, Elgin, Bluetooth 58mm/80mm)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTestPrintingOrder({
                id: 9999,
                order_number: 101,
                customer_name: 'Cliente Demonstração',
                customer_phone: '(11) 98765-4321',
                delivery_type: 'delivery',
                delivery_address: 'Av. Paulista, 1500 - Apto 42',
                delivery_neighborhood: 'Bela Vista',
                delivery_fee: 5.00,
                discount: 0.00,
                subtotal: 59.80,
                total: 64.80,
                payment_method: 'PIX',
                payment_status: 'pago',
                notes: 'Campainha não toca, favor bater no portão',
                created_at: new Date().toISOString(),
                items: [
                  {
                    product_name: "Kings Double Bacon",
                    business_name: "KING'S BURGUER",
                    quantity: 1,
                    subtotal: 37.90,
                    notes: 'Sem cebola crua',
                    addons: [
                      { name: 'Ao Ponto (Suculento)', unit_price: 0 },
                      { name: 'Blend Artesanal Extra 160g', unit_price: 9.00 },
                      { name: 'Bacon Crocante em Fatias', unit_price: 5.00 }
                    ]
                  },
                  {
                    product_name: "Açaí no Copo 500ml",
                    business_name: "KING'S AÇAÍ",
                    quantity: 1,
                    subtotal: 22.90,
                    addons: [
                      { name: 'Leite em Pó (Ninho)', unit_price: 0 },
                      { name: 'Granola Crocante', unit_price: 0 },
                      { name: 'Banana Fatiada', unit_price: 0 },
                      { name: 'Leite Condensado', unit_price: 0 },
                      { name: 'Nutella Pura Extra', unit_price: 5.00 }
                    ]
                  }
                ]
              });
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Testar Impressão da Bobina</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Largura da Bobina */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-bold text-slate-200 block uppercase tracking-wider text-[11px]">
              Tamanho do Papel / Bobina
            </span>
            <p className="text-[11px] text-slate-400">Escolha a largura da sua impressora física.</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPrinterWidth('80mm');
                  localStorage.setItem('kings_printer_width', '80mm');
                }}
                className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                  printerWidth === '80mm'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div>80mm</div>
                <div className="text-[10px] text-slate-500 font-normal">Padrão balcão</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrinterWidth('58mm');
                  localStorage.setItem('kings_printer_width', '58mm');
                }}
                className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                  printerWidth === '58mm'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div>58mm</div>
                <div className="text-[10px] text-slate-500 font-normal">Mini Bluetooth</div>
              </button>
            </div>
          </div>

          {/* Via Padrão */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-bold text-slate-200 block uppercase tracking-wider text-[11px]">
              Via Padrão ao Abrir
            </span>
            <p className="text-[11px] text-slate-400">Tipo de cupom padrão exibido primeiro.</p>
            <select
              value={defaultTicketView}
              onChange={(e) => {
                setDefaultTicketView(e.target.value);
                localStorage.setItem('kings_printer_default_view', e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-semibold focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              <option value="completa">🧾 Via Completa (Balcão / Cliente)</option>
              <option value="cozinha">👨‍🍳 Via de Cozinha (Sem preços)</option>
              <option value="entrega">🛵 Via de Entrega (Motoboy)</option>
              <option value="duas_vias">✂️ 2 Vias (Cozinha + Entrega com picote)</option>
            </select>
          </div>

          {/* Auto-Impressão */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="font-bold text-slate-200 block uppercase tracking-wider text-[11px]">
              Auto-impressão no Gestor
            </span>
            <p className="text-[11px] text-slate-400">Abrir comanda assim que novo pedido chega.</p>
            <button
              type="button"
              onClick={() => {
                const next = !autoPrintEnabled;
                setAutoPrintEnabled(next);
                localStorage.setItem('kings_autoprint_enabled', String(next));
              }}
              className={`w-full py-2.5 px-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                autoPrintEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              {autoPrintEnabled ? '✓ Auto-impressão ATIVADA' : '✗ Auto-impressão DESATIVADA'}
            </button>
          </div>
        </div>

        {/* Dicas de Configuração do Navegador */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
          <span className="font-bold text-amber-400 block mb-1">💡 Dica para Impressão Térmica Perfeita:</span>
          <span>
            Na janela de impressão do Chrome/Edge (Ctrl+P), selecione sua impressora térmica, clique em <strong>"Mais definições"</strong> e <strong>desmarque a opção "Cabeçalhos e rodapés"</strong>. Isso evita que o navegador imprima URLs ou datas nas bordas do papel térmico!
          </span>
        </div>
      </div>

      {/* Modal de Teste de Impressão */}
      {testPrintingOrder && (
        <ThermalReceipt
          order={testPrintingOrder}
          initialView={defaultTicketView}
          onClose={() => setTestPrintingOrder(null)}
        />
      )}
    </div>
  );
}
