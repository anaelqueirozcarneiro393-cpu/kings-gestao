import React, { useState } from 'react';
import { X, Plus, Minus, Check, AlertCircle, Sparkles, Flame } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export function ProductModal({ product, business, isOpen, onClose, onAddToCart }) {
  if (!isOpen || !product) return null;

  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [notes, setNotes] = useState('');

  // Handle Addon selection logic
  const handleToggleAddon = (group, addon) => {
    const isAlreadySelected = selectedAddons.some(a => a.id === addon.id);

    if (isAlreadySelected) {
      // Remove
      setSelectedAddons(prev => prev.filter(a => a.id !== addon.id));
    } else {
      // Check group max limits
      const groupAddonIds = (group.addons || []).map(a => a.id);
      const currentlySelectedInGroup = selectedAddons.filter(a => groupAddonIds.includes(a.id));

      if (group.max_choices && currentlySelectedInGroup.length >= group.max_choices) {
        if (group.max_choices === 1) {
          // If radio-like single choice, replace previous
          const filtered = selectedAddons.filter(a => !groupAddonIds.includes(a.id));
          setSelectedAddons([...filtered, { ...addon, group_id: group.id }]);
          return;
        } else {
          alert(`Você já selecionou o limite máximo de ${group.max_choices} opções para este grupo.`);
          return;
        }
      }

      setSelectedAddons(prev => [...prev, { ...addon, group_id: group.id }]);
    }
  };

  // Process addons considering free_choices per group (e.g. Açaí: 4 free, 5th+ paid; Burguer: all paid)
  const getProcessedAddons = () => {
    if (!product.addon_groups || product.addon_groups.length === 0) {
      return selectedAddons;
    }

    const processed = [];

    for (const group of product.addon_groups) {
      const groupAddonIds = (group.addons || []).map(a => a.id);
      const selectedInGroup = selectedAddons.filter(a => groupAddonIds.includes(a.id));
      const freeLimit = Number(group.free_choices) || 0;

      if (freeLimit > 0) {
        // Ordena por menor valor para dar a maior vantagem ao cliente
        const sorted = [...selectedInGroup].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        sorted.forEach((addon, index) => {
          if (index < freeLimit) {
            // Grátis (dentro da cota de 4)
            processed.push({
              ...addon,
              price: 0,
              original_price: Number(addon.price) || 0,
              is_free: true
            });
          } else {
            // Pago extra além da cota
            processed.push({
              ...addon,
              price: Number(addon.price) || 0,
              is_free: false
            });
          }
        });
      } else {
        // Todos pagos (ex: Burguer)
        selectedInGroup.forEach(addon => {
          processed.push({
            ...addon,
            price: Number(addon.price) || 0,
            is_free: false
          });
        });
      }
    }

    return processed;
  };

  const processedAddons = getProcessedAddons();
  const addonsTotal = processedAddons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const unitPrice = (Number(product.price) || 0) + addonsTotal;
  const totalPrice = unitPrice * quantity;

  const handleConfirm = () => {
    // Check required addon groups
    if (product.addon_groups) {
      for (const group of product.addon_groups) {
        if (group.required) {
          const groupAddonIds = (group.addons || []).map(a => a.id);
          const count = selectedAddons.filter(a => groupAddonIds.includes(a.id)).length;
          if (count < (group.min_choices || 1)) {
            alert(`Por favor, faça a escolha obrigatória no grupo "${group.title}".`);
            return;
          }
        }
      }
    }

    onAddToCart(product, business, quantity, processedAddons, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header com imagem se houver */}
        <div className="relative">
          {product.image_url ? (
            <div className="h-48 w-full bg-slate-950 overflow-hidden">
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/60" />
            </div>
          ) : (
            <div className="h-20 bg-gradient-to-r from-amber-600/20 to-slate-900 border-b border-slate-800" />
          )}

          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors backdrop-blur-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações do Produto */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-100">{product.name}</h2>
              <span className="text-base font-bold text-amber-400 font-mono whitespace-nowrap">
                {formatCurrency(product.price)}
              </span>
            </div>
            {product.description && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{product.description}</p>
            )}
          </div>

          {/* Grupos de Adicionais / Complementos */}
          {product.addon_groups && product.addon_groups.map(group => {
            const groupAddonIds = (group.addons || []).map(a => a.id);
            const selectedCount = selectedAddons.filter(a => groupAddonIds.includes(a.id)).length;
            const freeLimit = Number(group.free_choices) || 0;

            return (
              <div key={group.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">{group.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {group.required ? 'Obrigatório' : 'Opcional'} • Escolha {group.min_choices > 0 ? `ao menos ${group.min_choices}` : ''} até {group.max_choices} ({selectedCount}/{group.max_choices})
                    </p>
                  </div>
                  {group.required && selectedCount < (group.min_choices || 1) && (
                    <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
                      Obrigatório
                    </span>
                  )}
                </div>

                {/* Banner de Adicionais Grátis para Açaí */}
                {freeLimit > 0 && (
                  <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold">{freeLimit} Adicionais Grátis inclusos!</span>
                        <p className="text-[10px] text-slate-400">
                          {selectedCount < freeLimit
                            ? `Você ainda tem direito a mais ${freeLimit - selectedCount} adicionais grátis!`
                            : selectedCount === freeLimit
                            ? 'Você atingiu o limite dos 4 grátis. Adicionais extras serão cobrados.'
                            : `4 grátis + ${selectedCount - freeLimit} extra(s) pago(s)`}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-emerald-300 font-extrabold text-[11px] bg-emerald-900/80 px-2 py-0.5 rounded-lg border border-emerald-500/30 shrink-0">
                      {Math.min(selectedCount, freeLimit)}/{freeLimit} grátis
                    </span>
                  </div>
                )}

                {/* Mensagem informativa para Hambúrguer (todos adicionais pagos) */}
                {freeLimit === 0 && (
                  <div className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Turbine seu lanche (adicionais extras cobrados à parte)</span>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  {group.addons && group.addons.map(addon => {
                    const isSelected = selectedAddons.some(a => a.id === addon.id);
                    const processedItem = processedAddons.find(a => a.id === addon.id);

                    // Badge de Preço / Grátis
                    let priceLabel = '';
                    let badgeClass = 'text-slate-400 font-mono';

                    if (freeLimit > 0) {
                      if (isSelected) {
                        if (processedItem?.is_free) {
                          priceLabel = '✓ Grátis (Incluso)';
                          badgeClass = 'text-emerald-400 font-bold';
                        } else {
                          priceLabel = `+ ${formatCurrency(addon.price)} (Extra)`;
                          badgeClass = 'text-amber-400 font-bold font-mono';
                        }
                      } else {
                        if (selectedCount < freeLimit) {
                          priceLabel = 'Grátis';
                          badgeClass = 'text-emerald-400 font-semibold';
                        } else {
                          priceLabel = `+ ${formatCurrency(addon.price)}`;
                          badgeClass = 'text-slate-400 font-mono';
                        }
                      }
                    } else {
                      if (addon.price > 0) {
                        priceLabel = `+ ${formatCurrency(addon.price)}`;
                        badgeClass = isSelected ? 'text-amber-400 font-bold font-mono' : 'text-slate-400 font-mono';
                      } else {
                        priceLabel = 'Incluso';
                        badgeClass = 'text-emerald-400 font-semibold';
                      }
                    }

                    return (
                      <label
                        key={addon.id}
                        onClick={() => handleToggleAddon(group, addon)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 font-medium shadow-sm'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                            isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-700 bg-slate-950'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="font-medium">{addon.name}</span>
                        </div>
                        <span className={`text-[11px] ${badgeClass}`}>
                          {priceLabel}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observações especiais para este item
            </label>
            <textarea
              rows="2"
              placeholder="Ex: sem cebola roxa, morango no fundo, carne bem passada..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer com Quantidade e Botão Adicionar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          {/* Seletor de Quantidade */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center font-bold text-xs text-slate-100">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(q => q + 1)}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Botão Adicionar */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-between px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <span>Adicionar ao Pedido</span>
            <span className="font-mono text-sm">{formatCurrency(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
