import React, { useState, useEffect } from 'react';
import { ShoppingBag, Clock, MapPin, Phone, AlertCircle, ChevronRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/formatters';
import { ProductModal } from '../../components/public/ProductModal';
import { CartDrawer } from '../../components/public/CartDrawer';

export function PublicMenuPage({ onOpenTracking, onNavigateAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState('acai');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Modals
  const [modalProduct, setModalProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  const { addToCart, cartItemCount, cartSubtotal } = useCart();

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      setLoading(true);
      const res = await api.getPublicMenu();
      setData(res);
      if (res.businesses && res.businesses.length > 0) {
        // Find default active or first business
        const defaultBiz = res.businesses.find(b => b.slug === 'acai') || res.businesses[0];
        setSelectedSlug(defaultBiz.slug);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Carregando cardápios KING'S...</p>
        </div>
      </div>
    );
  }

  const activeBusinesses = (data?.businesses && data.businesses.length > 0) ? data.businesses : [
    { id: 1, name: "KING'S AÇAÍ", slug: 'acai', tagline: 'O verdadeiro açaí artesanal e cremoso', is_open: true, active: 1, status: 'open', opening_time: '11:00', closing_time: '02:00' },
    { id: 2, name: "KING'S BURGUER", slug: 'burguer', tagline: 'Hambúrgueres artesanais feitos no fogo', is_open: true, active: 1, status: 'open', opening_time: '18:00', closing_time: '02:00' },
    { id: 3, name: "KING'S PIZZA", slug: 'pizza', tagline: 'Massas artesanais fermentadas e recheios nobres', is_open: false, active: 0, status: 'coming_soon', opening_time: '18:00', closing_time: '00:00' }
  ];

  const currentBusiness = activeBusinesses.find(b => b.slug === selectedSlug) || activeBusinesses.find(b => b.slug === 'acai') || activeBusinesses[0];
  const isComingSoon = selectedSlug === 'pizza';
  const isOpen = currentBusiness?.is_open;

  // Filter categories and products for the selected business
  const businessCategories = data?.categories?.filter(c => c.business_id === currentBusiness?.id) || [];
  const businessProducts = data?.products?.filter(p => p.business_id === currentBusiness?.id) || [];

  const filteredProducts = selectedCategory
    ? businessProducts.filter(p => p.category_id === selectedCategory)
    : businessProducts;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 pb-28">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-sm shadow-md shadow-amber-500/20">
              K
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider text-slate-100">KING'S</span>
              <span className="text-[10px] text-amber-400 font-semibold block uppercase tracking-widest leading-none">
                Delivery & Gastronomia
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{formatCurrency(cartSubtotal)}</span>
              {cartItemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold border-2 border-[#0b0f17]">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Seletor de Operações: Açaí, Burguer, Pizza */}
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none border-t border-slate-800/60 bg-slate-900/60">
          {data?.businesses?.map(b => {
            const isSelected = selectedSlug === b.slug;
            const isBizComingSoon = !b.active || b.status === 'coming_soon';

            return (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedSlug(b.slug);
                  setSelectedCategory(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-[1.02]'
                    : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>{b.slug === 'acai' ? '🍧' : b.slug === 'burguer' ? '🍔' : '🍕'}</span>
                <span>{b.name}</span>
                {isBizComingSoon ? (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                    isSelected ? 'bg-slate-950 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    Em breve
                  </span>
                ) : !b.is_open ? (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                    isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    Fechado
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </header>

      {/* Banner / Info da Operação Selecionada */}
      <div className="max-w-4xl mx-auto px-4 mt-4">
        <div className="p-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 relative overflow-hidden shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                  {currentBusiness?.name}
                </h1>
                {isComingSoon ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                    Em Breve
                  </span>
                ) : isOpen ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Aberto agora
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Fechado no momento
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{currentBusiness?.tagline}</p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 mt-3">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Horário: {currentBusiness?.opening_time} às {currentBusiness?.closing_time}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Entrega e Retirada</span>
                </div>
              </div>
            </div>

            {/* Aviso de Fechado se for o caso */}
            {!isComingSoon && !isOpen && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs max-w-xs">
                <div className="font-bold flex items-center gap-1.5 mb-0.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>Operação Fechada</span>
                </div>
                <span>Você pode explorar o cardápio. Os pedidos abrirão às {currentBusiness?.opening_time}.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo do Cardápio */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {isComingSoon ? (
          /* Estado Em Breve para a Pizza */
          <div className="py-16 text-center space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-4xl mx-auto shadow-xl shadow-amber-500/5">
              🍕
            </div>
            <h2 className="text-2xl font-bold text-slate-100">King's Pizza</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Nossa operação de pizzas artesanais está em fase final de preparação e estará disponível em breve com massa de fermentação natural e sabores exclusivos!
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-amber-400 border border-slate-700">
                Lançamento em Breve • Fique Atento
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Categorias Pills */}
            {businessCategories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 mb-6">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === null
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Todos os Itens
                </button>
                {businessCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Grid de Produtos */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                Nenhum produto cadastrado nesta categoria.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map(prod => (
                  <div
                    key={prod.id}
                    className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 hover:border-slate-700/80 transition-all flex flex-col justify-between group shadow-sm hover:shadow-md"
                  >
                    <div className="flex gap-4">
                      {/* Foto */}
                      {prod.image_url ? (
                        <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-950 shrink-0">
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-xl bg-slate-800/50 flex items-center justify-center shrink-0 text-2xl">
                          {currentBusiness?.slug === 'acai' ? '🍧' : '🍔'}
                        </div>
                      )}

                      {/* Textos */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
                          {prod.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {prod.description}
                        </p>
                      </div>
                    </div>

                    {/* Preço e Botão */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-amber-400">
                        {formatCurrency(prod.price)}
                      </span>

                      <button
                        onClick={() => {
                          if (!isOpen) {
                            alert(`A operação ${currentBusiness?.name} está fechada no momento e abre às ${currentBusiness?.opening_time}. Você poderá fazer pedidos assim que a loja abrir.`);
                            return;
                          }
                          setModalProduct(prod);
                        }}
                        disabled={!isOpen}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isOpen
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isOpen ? '+ Adicionar' : 'Fechado'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Barra Flutuante de Carrinho no Mobile/Desktop */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-5 inset-x-0 z-40 max-w-md mx-auto px-4">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full flex items-center justify-between p-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-slate-950 text-amber-400 text-xs flex items-center justify-center font-bold">
                {cartItemCount}
              </span>
              <span className="text-xs">Ver Carrinho KING'S</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{formatCurrency(cartSubtotal)}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Modal de Detalhes do Produto */}
      <ProductModal
        product={modalProduct}
        business={currentBusiness}
        isOpen={Boolean(modalProduct)}
        onClose={() => setModalProduct(null)}
        onAddToCart={(prod, biz, qty, addons, notes) => {
          addToCart(prod, biz, qty, addons, notes);
        }}
      />

      {/* Gaveta do Carrinho e Checkout */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onOrderPlaced={(order) => {
          setPlacedOrder(order);
          if (onOpenTracking) {
            onOpenTracking(order.order_number);
          }
        }}
      />

      {/* Modal de Confirmação de Pedido */}
      {placedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-100">Pedido #{placedOrder.order_number} Confirmado!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Recebemos seu pedido com sucesso na cozinha da KING'S.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-left space-y-1">
              <div><span className="text-slate-400">Cliente:</span> <span className="font-semibold text-slate-200">{placedOrder.customer_name}</span></div>
              <div><span className="text-slate-400">Total:</span> <span className="font-mono font-bold text-amber-400">{formatCurrency(placedOrder.total)}</span></div>
              <div><span className="text-slate-400">Pagamento:</span> <span className="uppercase text-slate-200">{placedOrder.payment_method}</span></div>
            </div>

            <div className="space-y-2 pt-1">
              {(() => {
                const storePhone = "11999999999";
                const msg = `👑 *PEDIDO #${placedOrder.order_number} - KING'S*\n` +
                  `👤 *Cliente:* ${placedOrder.customer_name}\n` +
                  `📍 *Local:* ${placedOrder.delivery_type === 'retirada' ? 'Retirada no Balcão' : `${placedOrder.delivery_address || ''} (${placedOrder.delivery_neighborhood || ''})`}\n` +
                  `💳 *Pagamento:* ${placedOrder.payment_method}\n` +
                  `💰 *Total:* R$ ${Number(placedOrder.total || 0).toFixed(2)}\n\n` +
                  `Aguardando confirmação! Obrigado!`;
                const waUrl = `https://wa.me/55${storePhone}?text=${encodeURIComponent(msg)}`;

                return (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar Pedido no WhatsApp da Loja</span>
                  </a>
                );
              })()}

              <button
                onClick={() => {
                  const orderNum = placedOrder.order_number;
                  setPlacedOrder(null);
                  if (onOpenTracking) onOpenTracking(orderNum);
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Acompanhar Status ao Vivo na Tela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
