import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingBag, User, Phone, MapPin, DollarSign, Check } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

export function NewManualOrderModal({ isOpen, onClose, onOrderCreated }) {
  const [businesses, setBusinesses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [source, setSource] = useState('manual_whatsapp');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [paymentChange, setPaymentChange] = useState('');
  const [orderItems, setOrderItems] = useState([]);

  // Item Picker State
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bData, pData] = await Promise.all([
        api.getBusinesses(),
        api.getProducts()
      ]);
      setBusinesses(bData.filter(b => b.active));
      setProducts(pData);
      if (bData.length > 0) {
        setSelectedBusinessId(bData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => !selectedBusinessId || p.business_id === Number(selectedBusinessId));

  const handleAddItem = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === Number(selectedProductId));
    if (!prod) return;

    const b = businesses.find(b => b.id === prod.business_id);

    const newItem = {
      product_id: prod.id,
      product_name: prod.name,
      business_id: prod.business_id,
      business_name: b ? b.name : '',
      unit_price: prod.price,
      quantity: itemQuantity,
      subtotal: prod.price * itemQuantity,
      notes: itemNotes,
      addons: []
    };

    setOrderItems(prev => [...prev, newItem]);
    setSelectedProductId('');
    setItemQuantity(1);
    setItemNotes('');
  };

  const handleRemoveItem = (index) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const deliveryFee = deliveryType === 'delivery' ? 5.0 : 0.0;
  const total = subtotal + deliveryFee;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      alert('Informe o nome e telefone do cliente');
      return;
    }
    if (orderItems.length === 0) {
      alert('Adicione ao menos um produto ao pedido');
      return;
    }

    try {
      setSaving(true);
      const res = await api.createManualOrder({
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        delivery_neighborhood: deliveryNeighborhood,
        notes,
        payment_method: paymentMethod,
        payment_change: Number(paymentChange) || 0,
        source,
        items: orderItems
      });

      if (res.success) {
        onOrderCreated(res.order);
        onClose();
      }
    } catch (err) {
      alert('Erro ao criar pedido: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Novo Pedido Manual (PDV)</h2>
              <p className="text-xs text-slate-400">WhatsApp, Balcão ou Telefone - Atualiza estoque e DRE</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Origem do Pedido */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Canal de Entrada</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'manual_whatsapp', label: 'WhatsApp', icon: '💬' },
                { id: 'manual_balcao', label: 'Balcão / Loja', icon: '🏪' },
                { id: 'manual_telefone', label: 'Telefone', icon: '📞' },
                { id: 'manual_outro', label: 'Outro Canal', icon: '📝' }
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSource(c.id)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    source === c.id
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dados do Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Cliente *</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Oliveira"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Telefone / WhatsApp *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Ex: (11) 98765-4321"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          </div>

          {/* Entrega vs Retirada */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Modalidade</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryType('delivery')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  deliveryType === 'delivery'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                🛵 Entrega (+ R$ 5,00)
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType('pickup')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  deliveryType === 'pickup'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                🏪 Retirada no Balcão (Grátis)
              </button>
            </div>
          </div>

          {deliveryType === 'delivery' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Endereço Completo</label>
                <input
                  type="text"
                  placeholder="Rua, Número, Complemento"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bairro</label>
                <input
                  type="text"
                  placeholder="Bairro"
                  value={deliveryNeighborhood}
                  onChange={e => setDeliveryNeighborhood(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          )}

          {/* Adicionar Itens ao Pedido */}
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              <span>Adicionar Produtos ao Pedido</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Operação</label>
                <select
                  value={selectedBusinessId}
                  onChange={e => {
                    setSelectedBusinessId(e.target.value);
                    setSelectedProductId('');
                  }}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
                >
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">Produto</label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">Selecione o produto...</option>
                  {filteredProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Qtd</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={e => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-center text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!selectedProductId}
                    className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </div>
              </div>
            </div>

            {selectedProductId && (
              <div>
                <input
                  type="text"
                  placeholder="Observação do item (ex: sem cebola, morango separado)"
                  value={itemNotes}
                  onChange={e => setItemNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                />
              </div>
            )}

            {/* Lista de Itens Adicionados */}
            {orderItems.length > 0 && (
              <div className="mt-3 divide-y divide-slate-800/80 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                    <div>
                      <span className="font-semibold text-slate-200">{item.quantity}x {item.product_name}</span>
                      <span className="text-[10px] text-amber-400 ml-2">({item.business_name})</span>
                      {item.notes && <div className="text-[10px] italic text-slate-400">Obs: {item.notes}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium text-slate-200">{formatCurrency(item.subtotal)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO_DEBITO">Cartão de Débito</option>
                <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              </select>
            </div>

            {paymentMethod === 'DINHEIRO' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Troco para quanto?</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 50.00"
                  value={paymentChange}
                  onChange={e => setPaymentChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Observações Gerais */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Observações Gerais do Pedido</label>
            <textarea
              rows="2"
              placeholder="Ex: Campainha não funciona, ligar ao chegar..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>
        </form>

        {/* Footer com Resumo Financeiro e Envio */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs space-y-0.5">
            <div className="text-slate-400">Subtotal: <span className="font-mono text-slate-200">{formatCurrency(subtotal)}</span></div>
            {deliveryType === 'delivery' && (
              <div className="text-slate-400">Taxa de Entrega: <span className="font-mono text-slate-200">{formatCurrency(deliveryFee)}</span></div>
            )}
            <div className="text-sm font-bold text-amber-400">
              Total do Pedido: <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || orderItems.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Lançando...' : 'Lançar Pedido'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
