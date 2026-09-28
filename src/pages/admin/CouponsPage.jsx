import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Calendar,
  Users,
  Percent,
  DollarSign,
  AlertCircle,
  Clock,
  ShieldCheck,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

export function CouponsPage({ selectedBusinessId }) {
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  // Form State
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage', // 'percentage' or 'fixed'
    discount_value: '',
    min_order_value: '',
    max_discount_value: '',
    usage_limit: '',
    expires_at: '',
    active: 1,
    business_id: '',
    delivery_type: 'all', // 'all', 'delivery', 'pickup'
    only_first_order: 0,
    included_product_ids: [],
    excluded_product_ids: []
  });

  useEffect(() => {
    loadData();
  }, [selectedBusinessId]);

  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [couponsList, prodsList, bizList] = await Promise.all([
        api.getCoupons(),
        api.getProducts(selectedBusinessId || ''),
        api.getBusinesses()
      ]);
      setCoupons(couponsList);
      setProducts(prodsList);
      setBusinesses(bizList);
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar cupons: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (coupon = null) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setForm({
        code: coupon.code,
        description: coupon.description || '',
        discount_type: coupon.discount_type || 'percentage',
        discount_value: coupon.discount_value,
        min_order_value: coupon.min_order_value || '',
        max_discount_value: coupon.max_discount_value || '',
        usage_limit: coupon.usage_limit || '',
        expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : '',
        active: coupon.active !== undefined ? coupon.active : 1,
        business_id: coupon.business_id || '',
        delivery_type: coupon.delivery_type || 'all',
        only_first_order: coupon.only_first_order || 0,
        included_product_ids: coupon.included_product_ids
          ? coupon.included_product_ids.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        excluded_product_ids: coupon.excluded_product_ids
          ? coupon.excluded_product_ids.split(',').map(s => s.trim()).filter(Boolean)
          : []
      });
    } else {
      setEditingCoupon(null);
      setForm({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: '',
        min_order_value: '',
        max_discount_value: '',
        usage_limit: '',
        expires_at: '',
        active: 1,
        business_id: selectedBusinessId || '',
        delivery_type: 'all',
        only_first_order: 0,
        included_product_ids: [],
        excluded_product_ids: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code || !form.discount_value) {
      alert('Código e valor do desconto são obrigatórios!');
      return;
    }

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_value: form.min_order_value ? Number(form.min_order_value) : 0,
        max_discount_value: form.max_discount_value ? Number(form.max_discount_value) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        expires_at: form.expires_at ? `${form.expires_at}T23:59:59` : null,
        active: Number(form.active),
        business_id: form.business_id ? Number(form.business_id) : null,
        delivery_type: form.delivery_type,
        only_first_order: Number(form.only_first_order),
        included_product_ids: form.included_product_ids.join(','),
        excluded_product_ids: form.excluded_product_ids.join(',')
      };

      if (editingCoupon) {
        await api.updateCoupon(editingCoupon.id, payload);
        showToast(`Cupom "${payload.code}" atualizado com sucesso!`);
      } else {
        await api.createCoupon(payload);
        showToast(`Cupom "${payload.code}" criado com sucesso!`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      showToast('Erro ao salvar cupom: ' + err.message, true);
    }
  };

  const handleToggle = async (coupon) => {
    try {
      await api.toggleCoupon(coupon.id);
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: c.active ? 0 : 1 } : c));
      showToast(`Cupom "${coupon.code}" ${coupon.active ? 'desativado' : 'ativado'}!`);
    } catch (err) {
      showToast('Erro ao alterar status: ' + err.message, true);
    }
  };

  const handleDelete = async (coupon) => {
    if (!confirm(`Tem certeza que deseja excluir o cupom "${coupon.code}"?`)) return;
    try {
      await api.deleteCoupon(coupon.id);
      showToast(`Cupom "${coupon.code}" excluído com sucesso.`);
      loadData();
    } catch (err) {
      showToast('Erro ao excluir: ' + err.message, true);
    }
  };

  const toggleIncludeProduct = (prodId) => {
    const idStr = String(prodId);
    setForm(prev => {
      const exists = prev.included_product_ids.includes(idStr);
      const newInc = exists
        ? prev.included_product_ids.filter(id => id !== idStr)
        : [...prev.included_product_ids, idStr];
      // Se incluiu, remove de excluídos
      const newExc = prev.excluded_product_ids.filter(id => id !== idStr);
      return { ...prev, included_product_ids: newInc, excluded_product_ids: newExc };
    });
  };

  const toggleExcludeProduct = (prodId) => {
    const idStr = String(prodId);
    setForm(prev => {
      const exists = prev.excluded_product_ids.includes(idStr);
      const newExc = exists
        ? prev.excluded_product_ids.filter(id => id !== idStr)
        : [...prev.excluded_product_ids, idStr];
      // Se excluiu, remove de incluídos
      const newInc = prev.included_product_ids.filter(id => id !== idStr);
      return { ...prev, excluded_product_ids: newExc, included_product_ids: newInc };
    });
  };

  // Filtragem
  const filteredCoupons = coupons.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeCount = coupons.filter(c => c.active === 1).length;
  const totalUses = coupons.reduce((sum, c) => sum + (c.used_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold border ${
          toastMessage.isError ? 'bg-rose-950 border-rose-800 text-rose-200' : 'bg-emerald-950 border-emerald-800 text-emerald-200'
        }`}>
          {toastMessage.isError ? <AlertCircle className="w-5 h-5 text-rose-400" /> : <Check className="w-5 h-5 text-emerald-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Ticket className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-wider">CUPONS DE DESCONTO</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Crie campanhas 100% personalizáveis com regras por pedido, produtos incluídos/excluídos e limite de uso
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Cupom</span>
        </button>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Cupons Ativos</span>
            <div className="text-2xl font-black text-slate-100">{activeCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total de Utilizações</span>
            <div className="text-2xl font-black text-emerald-400 font-mono">{totalUses}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Regras Personalizadas</span>
            <div className="text-xs text-slate-300 font-semibold mt-1">Inclusão/Exclusão Ativa</div>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar cupom por código ou descrição..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Lista de Cupons */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Carregando cupons...</div>
      ) : filteredCoupons.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 space-y-3">
          <Ticket className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-xs">Nenhum cupom cadastrado no momento.</p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md"
          >
            Cadastrar Primeiro Cupom
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map(coupon => {
            const isPercentage = coupon.discount_type === 'percentage';
            const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
            const isExhausted = coupon.usage_limit && coupon.used_count >= coupon.usage_limit;
            const incIds = coupon.included_product_ids ? coupon.included_product_ids.split(',').filter(Boolean) : [];
            const excIds = coupon.excluded_product_ids ? coupon.excluded_product_ids.split(',').filter(Boolean) : [];

            return (
              <div
                key={coupon.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                  coupon.active && !isExpired && !isExhausted
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-md'
                    : 'bg-slate-950/80 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Code & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        {coupon.code}
                      </span>
                      {coupon.active && !isExpired && !isExhausted ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                          {isExpired ? 'Expirado' : isExhausted ? 'Esgotado' : 'Inativo'}
                        </span>
                      )}
                    </div>

                    <div className="text-base font-black text-slate-100 font-mono">
                      {isPercentage ? `${coupon.discount_value}% OFF` : `-${formatCurrency(coupon.discount_value)}`}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {coupon.description || 'Sem descrição cadastrada.'}
                  </p>

                  {/* Tags das Regras Personalizáveis */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {coupon.min_order_value > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        Mínimo: {formatCurrency(coupon.min_order_value)}
                      </span>
                    )}

                    {coupon.max_discount_value > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        Teto: {formatCurrency(coupon.max_discount_value)}
                      </span>
                    )}

                    {coupon.delivery_type === 'delivery' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        Só Delivery
                      </span>
                    )}

                    {coupon.delivery_type === 'pickup' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        Só Balcão
                      </span>
                    )}

                    {coupon.only_first_order === 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        1º Pedido Apenas
                      </span>
                    )}

                    {incIds.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {incIds.length} Itens Inclusos
                      </span>
                    )}

                    {excIds.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        {excIds.length} Itens Excluídos
                      </span>
                    )}
                  </div>

                  {/* Informações de Uso e Expiração */}
                  <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-800/60">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-500" />
                      <span>{coupon.used_count || 0} {coupon.usage_limit ? `/ ${coupon.usage_limit}` : 'usos'}</span>
                    </span>
                    {coupon.expires_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Até {new Date(coupon.expires_at).toLocaleDateString('pt-BR')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleToggle(coupon)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                      coupon.active
                        ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {coupon.active ? 'Pausar' : 'Ativar'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenModal(coupon)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
                      title="Editar Regras do Cupom"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs transition-colors cursor-pointer"
                      title="Excluir Cupom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição 100% Personalizável */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-amber-400" />
                <h2 className="font-extrabold text-base text-slate-100">
                  {editingCoupon ? `Editar Cupom: ${editingCoupon.code}` : 'Criar Novo Cupom Personalizável'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Seção 1: Configuração do Desconto */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" />
                  <span>1. Regra de Desconto</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Código do Cupom *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: KINGS10"
                      value={form.code}
                      onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono font-bold tracking-wider focus:outline-none focus:border-amber-500 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Tipo de Desconto</label>
                    <select
                      value={form.discount_type}
                      onChange={e => setForm({ ...form, discount_type: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="percentage">Porcentagem (% OFF)</option>
                      <option value="fixed">Valor Fixo (R$)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      {form.discount_type === 'percentage' ? 'Valor (%) *' : 'Valor (R$) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder={form.discount_type === 'percentage' ? 'Ex: 10' : 'Ex: 15.00'}
                      value={form.discount_value}
                      onChange={e => setForm({ ...form, discount_value: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Descrição Explicativa</label>
                  <input
                    type="text"
                    placeholder="Ex: 10% de desconto na primeira compra de hambúrgueres"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Seção 2: Condições do Pedido */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span>2. Condições & Limitações</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Pedido Mínimo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00 (sem mínimo)"
                      value={form.min_order_value}
                      onChange={e => setForm({ ...form, min_order_value: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Teto Máximo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Sem limite de teto"
                      value={form.max_discount_value}
                      onChange={e => setForm({ ...form, max_discount_value: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Limite Total de Usos</label>
                    <input
                      type="number"
                      placeholder="Ilimitado"
                      value={form.usage_limit}
                      onChange={e => setForm({ ...form, usage_limit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Operação</label>
                    <select
                      value={form.business_id}
                      onChange={e => setForm({ ...form, business_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Todas as Operações (King's)</option>
                      {businesses.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Tipo de Entrega</label>
                    <select
                      value={form.delivery_type}
                      onChange={e => setForm({ ...form, delivery_type: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="all">Delivery e Balcão</option>
                      <option value="delivery">Apenas Delivery (Entrega)</option>
                      <option value="pickup">Apenas Retirada no Balcão</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Data de Expiração</label>
                    <input
                      type="date"
                      value={form.expires_at}
                      onChange={e => setForm({ ...form, expires_at: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.only_first_order === 1}
                      onChange={e => setForm({ ...form, only_first_order: e.target.checked ? 1 : 0 })}
                      className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 font-semibold">
                      Válido exclusivamente para o primeiro pedido do cliente (validado pelo WhatsApp)
                    </span>
                  </label>
                </div>
              </div>

              {/* Seção 3: Inclusão e Exclusão de Produtos Específicos */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                  <span>3. Incluir ou Excluir Produtos Específicos</span>
                  <span className="text-[10px] text-slate-400 lowercase font-normal">
                    (deixe vazio para aplicar a todo o cardápio)
                  </span>
                </h3>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 border border-slate-800/80 rounded-xl p-2 bg-slate-900/50">
                  {products.map(prod => {
                    const isIncluded = form.included_product_ids.includes(String(prod.id));
                    const isExcluded = form.excluded_product_ids.includes(String(prod.id));

                    return (
                      <div
                        key={prod.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                          isIncluded
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : isExcluded
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{prod.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({formatCurrency(prod.price)})</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleIncludeProduct(prod.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              isIncluded
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-emerald-300'
                            }`}
                          >
                            {isIncluded ? 'Incluso ✓' : '+ Incluir'}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleExcludeProduct(prod.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              isExcluded
                                ? 'bg-rose-500 text-white border-rose-400'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-300'
                            }`}
                          >
                            {isExcluded ? 'Excluído ✕' : '- Excluir'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md"
                >
                  Salvar Cupom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
