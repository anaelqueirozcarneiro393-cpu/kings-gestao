import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Copy, Check, MapPin, Sparkles, Ticket, Flame } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

export function CartDrawer({ isOpen, onClose, onOrderPlaced }) {
  const {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartSubtotal,
    cartTotal,
    deliveryType,
    setDeliveryType,
    deliveryFee,
    setDeliveryFee,
    coupon,
    setCoupon,
    discount
  } = useCart();

  const [step, setStep] = useState('cart'); // 'cart' or 'checkout'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [paymentChange, setPaymentChange] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState([]);

  // Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState(null); // { text, isError }

  const handleApplyCoupon = async (e) => {
    if (e) e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponMessage(null);

    try {
      const res = await api.validateCoupon({
        code: couponInput.trim(),
        subtotal: cartSubtotal,
        business_id: items[0]?.business_id,
        delivery_type: deliveryType,
        customer_phone: customerPhone,
        items
      });
      setCoupon(res);
      setCouponInput('');
      setCouponMessage({ text: res.message, isError: false });
    } catch (err) {
      setCouponMessage({ text: err.message || 'Cupom inválido ou não aplicável', isError: true });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCoupon(null);
    setCouponMessage(null);
  };

  // Auto-fill from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kings_customer_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setCustomerName(parsed.name);
        if (parsed.phone) setCustomerPhone(parsed.phone);
        if (parsed.address) setDeliveryAddress(parsed.address);
        if (parsed.neighborhood) setDeliveryNeighborhood(parsed.neighborhood);
      }
    } catch (e) {
      console.error(e);
    }

    // Load delivery zones
    api.getDeliveryZones().then(zones => {
      setDeliveryZones(zones);
      if (zones.length > 0 && !deliveryNeighborhood) {
        setDeliveryNeighborhood(zones[0].name);
        setDeliveryFee(zones[0].fee);
      }
    }).catch(() => {});
  }, []);

  if (!isOpen) return null;

  const handleNeighborhoodChange = (neighborhoodName) => {
    setDeliveryNeighborhood(neighborhoodName);
    const matchedZone = deliveryZones.find(z => z.name.toLowerCase() === neighborhoodName.toLowerCase());
    if (matchedZone) {
      setDeliveryFee(matchedZone.fee);
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText('pix@kingsgastronomia.com.br');
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  // Catálogo de Order Bumps para Açaí e Burguer
  const ORDER_BUMP_CATALOG = [
    {
      id: 'bump_coca',
      product_id: 109,
      business_id: 2,
      business_name: "KING'S BURGUER",
      business_slug: 'burguer',
      name: 'Coca-Cola 350ml Geladinha',
      subtitle: 'Lata 350ml trincando de gelada',
      price: 6.00,
      image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
      icon: '🥤'
    },
    {
      id: 'bump_batata',
      product_id: 107,
      business_id: 2,
      business_name: "KING'S BURGUER",
      business_slug: 'burguer',
      name: 'Batata Frita 150g Crocante',
      subtitle: 'Sequinha e dourada à perfeição',
      price: 12.90,
      image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
      icon: '🍟'
    },
    {
      id: 'bump_cheddar_bacon',
      product_id: 108,
      business_id: 2,
      business_name: "KING'S BURGUER",
      business_slug: 'burguer',
      name: 'Batata 200g + Cheddar & Bacon',
      subtitle: 'Batata coberta com cheddar cremoso e bacon',
      price: 17.90,
      image_url: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80',
      icon: '🥓'
    },
    {
      id: 'bump_nutella',
      product_id: 201,
      business_id: 1,
      business_name: "KING'S AÇAÍ",
      business_slug: 'acai',
      name: 'Pote Extra Nutella Pura 50g',
      subtitle: 'Creme de avelã para turbinar seu açaí',
      price: 6.00,
      image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
      icon: '🍫'
    },
    {
      id: 'bump_morango',
      product_id: 202,
      business_id: 1,
      business_name: "KING'S AÇAÍ",
      business_slug: 'acai',
      name: 'Porção Extra Morangos Frescos',
      subtitle: 'Morangos selecionados fatiados',
      price: 5.00,
      image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
      icon: '🍓'
    },
    {
      id: 'bump_agua',
      product_id: 203,
      business_id: 1,
      business_name: "KING'S AÇAÍ",
      business_slug: 'acai',
      name: 'Água Mineral Crystal 500ml',
      subtitle: 'Geladinha e refrescante',
      price: 4.00,
      image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
      icon: '💧'
    }
  ];

  const cartBusinessId = items[0]?.business_id || 2;
  const availableBumps = ORDER_BUMP_CATALOG.filter(bump => {
    const matchBiz = Number(bump.business_id) === Number(cartBusinessId);
    const inCart = items.some(i => Number(i.product_id) === Number(bump.product_id) || i.product_name === bump.name);
    return matchBiz && !inCart;
  }).slice(0, 2);

  const handleAddBump = (bump) => {
    addToCart(
      {
        id: bump.product_id,
        name: bump.name,
        price: bump.price,
        image_url: bump.image_url
      },
      {
        id: bump.business_id,
        name: bump.business_name,
        slug: bump.business_slug
      },
      1,
      [],
      'Order Bump adicionado no carrinho'
    );
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      alert('Por favor informe seu nome e WhatsApp para contato.');
      return;
    }
    if (deliveryType === 'delivery' && !deliveryAddress) {
      alert('Por favor informe o endereço de entrega completo.');
      return;
    }

    try {
      setLoading(true);

      // Save customer profile for next time
      try {
        localStorage.setItem('kings_customer_profile', JSON.stringify({
          name: customerName,
          phone: customerPhone,
          address: deliveryAddress,
          neighborhood: deliveryNeighborhood
        }));
      } catch (err) {
        console.error(err);
      }

      const res = await api.createPublicOrder({
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        delivery_neighborhood: deliveryNeighborhood,
        delivery_fee: deliveryType === 'delivery' ? deliveryFee : 0,
        discount: discount,
        coupon_code: coupon ? coupon.code : null,
        notes: orderNotes,
        payment_method: paymentMethod,
        payment_change: Number(paymentChange) || 0,
        items
      });

      if (res.success) {
        clearCart();
        onClose();
        onOrderPlaced(res.order);
      }
    } catch (err) {
      alert('Erro ao enviar pedido: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">
                {step === 'cart' ? "Seu Pedido KING'S" : 'Finalizar Pedido'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4 text-slate-500">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">Seu carrinho está vazio</h3>
                <p className="text-xs text-slate-400 max-w-xs mb-6">
                  Navegue entre o Açaí, Burguer e monte seu combo perfeito em um só pedido.
                </p>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs hover:bg-amber-500/20 transition-all cursor-pointer"
                >
                  Ver Cardápio
                </button>
              </div>
            ) : step === 'cart' ? (
              <div className="space-y-4">
                {/* Lista de Itens no Carrinho */}
                <div className="divide-y divide-slate-800/80">
                  {items.map(item => (
                    <div key={item.cart_item_id} className="py-3.5 first:pt-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-100">{item.product_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
                              {item.business_name}
                            </span>
                          </div>
                          {item.addons && item.addons.length > 0 && (
                            <div className="text-[11px] text-slate-400 mt-0.5 space-y-0.5 pl-1">
                              {item.addons.map((a, idx) => (
                                <div key={idx}>+ {a.name} {a.unit_price > 0 && `(${formatCurrency(a.unit_price)})`}</div>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-[10px] italic text-slate-500 pl-1 mt-0.5">
                              Obs: {item.notes}
                            </div>
                          )}
                        </div>
                        <span className="font-mono font-bold text-xs text-amber-400 whitespace-nowrap">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>

                      {/* Controles de Quantidade */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => removeFromCart(item.cart_item_id)}
                          className="text-[11px] text-rose-400/80 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remover</span>
                        </button>
                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(item.cart_item_id, item.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-slate-200">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.cart_item_id, item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Bumps / Recomendações Especiais */}
                {availableBumps.length > 0 && (
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Aproveite e turbine seu pedido!
                      </span>
                    </div>

                    <div className="space-y-2">
                      {availableBumps.map(bump => (
                        <div
                          key={bump.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900/80 to-slate-900 border border-amber-500/30 hover:border-amber-500/60 transition-all duration-200"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-xl flex-shrink-0">{bump.icon}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-100 truncate">{bump.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{bump.subtitle}</div>
                              <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                                + {formatCurrency(bump.price)}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddBump(bump)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all whitespace-nowrap cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Adicionar</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modalidade de Entrega / Retirada */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Como deseja receber?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('delivery')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        deliveryType === 'delivery'
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div>🛵 Entrega</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">+ {formatCurrency(deliveryFee)}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType('pickup')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        deliveryType === 'pickup'
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div>🏪 Retirada</div>
                      <div className="text-[10px] text-emerald-400 font-normal mt-0.5">Sem taxa</div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Formulário de Checkout */
              <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4 text-xs">
                {/* Auto-fill indicator */}
                {customerName && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Seus dados foram preenchidos automaticamente do seu último pedido!</span>
                  </div>
                )}

                {/* Dados Pessoais */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Seu Nome *</label>
                    <input
                      type="text"
                      required
                      placeholder="Como devemos te chamar?"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">WhatsApp / Telefone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="(11) 98765-4321"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 text-xs"
                    />
                  </div>
                </div>

                {/* Endereço se entrega */}
                {deliveryType === 'delivery' && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">Endereço de Entrega</div>

                    {deliveryZones.length > 0 && (
                      <div>
                        <label className="block text-slate-400 mb-1">Seu Bairro (para cálculo da taxa) *</label>
                        <select
                          value={deliveryNeighborhood}
                          onChange={(e) => handleNeighborhoodChange(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500/50 text-xs cursor-pointer"
                        >
                          {deliveryZones.map(zone => (
                            <option key={zone.id} value={zone.name}>
                              {zone.name} — Taxa: R$ {zone.fee.toFixed(2)} ({zone.estimated_minutes})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-400 mb-1">Rua, Número e Complemento *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Av. Paulista, 1500 - Bloco B, Apto 42"
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Forma de Pagamento */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider text-[11px]">Forma de Pagamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'PIX', label: 'PIX', sub: 'Chave instantânea' },
                      { id: 'DINHEIRO', label: 'Dinheiro', sub: 'No momento da entrega' },
                      { id: 'CARTAO_DEBITO', label: 'Cartão Débito', sub: 'Máquina na entrega' },
                      { id: 'CARTAO_CREDITO', label: 'Cartão Crédito', sub: 'Máquina na entrega' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPaymentMethod(p.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          paymentMethod === p.id
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="font-bold">{p.label}</div>
                        <div className="text-[10px] text-slate-500">{p.sub}</div>
                      </button>
                    ))}
                  </div>

                  {paymentMethod === 'PIX' && (
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-2">
                      <div className="text-slate-300">
                        Chave PIX: <span className="font-mono text-amber-300 font-bold">pix@kingsgastronomia.com.br</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPix ? 'Chave Copiada!' : 'Copiar Chave PIX'}</span>
                      </button>
                    </div>
                  )}

                  {paymentMethod === 'DINHEIRO' && (
                    <div>
                      <label className="block text-slate-400 mb-1">Precisa de troco para quanto?</label>
                      <input
                        type="number"
                        placeholder="Ex: 50 ou 100 (deixe em branco se não precisar)"
                        value={paymentChange}
                        onChange={e => setPaymentChange(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Observações Gerais */}
                <div>
                  <label className="block text-slate-400 mb-1">Observações gerais para a entrega</label>
                  <input
                    type="text"
                    placeholder="Ex: Tocar o interfone 42, deixar na portaria..."
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 text-xs"
                  />
                </div>
              </form>
            )}
          </div>

          {/* Footer com Totais e Botão Avançar / Confirmar */}
          {items.length > 0 && (
            <div className="p-5 border-t border-slate-800 bg-slate-950 space-y-3">
              {/* Cupom de Desconto */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                {coupon ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-emerald-400 font-mono tracking-wider">
                          {coupon.code}
                        </div>
                        <div className="text-[10px] text-slate-400">{coupon.description || 'Desconto ativo'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        -{formatCurrency(discount)}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="p-1 hover:text-rose-400 text-slate-500 cursor-pointer"
                        title="Remover cupom"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Ticket className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Cupom de desconto"
                          value={couponInput}
                          onChange={e => setCouponInput(e.target.value.toUpperCase())}
                          className="w-full pl-8 pr-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 uppercase font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                      >
                        {couponLoading ? '...' : 'Aplicar'}
                      </button>
                    </div>
                    {couponMessage && (
                      <p className={`text-[10px] mt-1.5 ${couponMessage.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {couponMessage.text}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(cartSubtotal)}</span>
                </div>
                {deliveryType === 'delivery' && (
                  <div className="flex justify-between text-slate-400">
                    <span>Taxa de Entrega ({deliveryNeighborhood || 'Bairro'}):</span>
                    <span className="font-mono text-slate-200">{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Desconto ({coupon?.code}):</span>
                    <span className="font-mono">-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-100 pt-1 border-t border-slate-800/80">
                  <span>Total:</span>
                  <span className="font-mono text-amber-400">{formatCurrency(cartTotal)}</span>
                </div>
              </div>

              {step === 'cart' ? (
                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <span>Continuar para Entrega</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('cart')}
                    className="py-3 px-3 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{loading ? 'Enviando...' : 'Confirmar Pedido'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
