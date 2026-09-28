import React, { useState, useEffect } from 'react';
import { FlaskConical, Plus, Trash2, Save, Calculator, AlertCircle, Check } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatPercent, formatQuantityUnit } from '../../utils/formatters';

export function RecipesPage({ selectedBusinessId, initialProductId }) {
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(initialProductId || '');
  const [recipeData, setRecipeData] = useState(null);
  const [recipeItems, setRecipeItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New item draft
  const [newIngredientId, setNewIngredientId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  useEffect(() => {
    loadProductsAndIngredients();
  }, [selectedBusinessId]);

  useEffect(() => {
    if (selectedProductId) {
      loadRecipe(selectedProductId);
    }
  }, [selectedProductId]);

  const loadProductsAndIngredients = async () => {
    try {
      const [pData, iData] = await Promise.all([
        api.getProducts(selectedBusinessId || ''),
        api.getIngredients(selectedBusinessId || '')
      ]);
      setProducts(pData);
      setIngredients(iData);

      if (!selectedProductId && pData.length > 0) {
        setSelectedProductId(pData[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadRecipe = async (prodId) => {
    try {
      setLoading(true);
      const data = await api.getRecipe(prodId);
      setRecipeData(data);
      setRecipeItems(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIngredient = () => {
    if (!newIngredientId || !newQuantity) return;
    const ing = ingredients.find(i => i.id === Number(newIngredientId));
    if (!ing) return;

    // Check if already in recipe
    if (recipeItems.some(item => item.ingredient_id === ing.id)) {
      alert('Este ingrediente já faz parte da ficha técnica.');
      return;
    }

    const qty = Number(newQuantity);
    const itemCost = qty * ing.cost_per_unit;

    const newItem = {
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      ingredient_unit: ing.unit,
      cost_per_unit: ing.cost_per_unit,
      quantity: qty,
      item_cost: itemCost
    };

    setRecipeItems(prev => [...prev, newItem]);
    setNewIngredientId('');
    setNewQuantity('');
  };

  const handleRemoveIngredient = (ingredientId) => {
    setRecipeItems(prev => prev.filter(i => i.ingredient_id !== ingredientId));
  };

  const handleUpdateItemQty = (ingredientId, newQty) => {
    setRecipeItems(prev => prev.map(item => {
      if (item.ingredient_id === ingredientId) {
        const qty = Number(newQty) || 0;
        return {
          ...item,
          quantity: qty,
          item_cost: qty * item.cost_per_unit
        };
      }
      return item;
    }));
  };

  const handleSaveRecipe = async () => {
    try {
      setSaving(true);
      await api.saveRecipe(selectedProductId, recipeItems.map(i => ({
        ingredient_id: i.ingredient_id,
        quantity: i.quantity
      })));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      loadRecipe(selectedProductId);
    } catch (err) {
      alert('Erro ao salvar ficha técnica: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Live dynamic math
  const currentProduct = products.find(p => p.id === Number(selectedProductId));
  const productPrice = currentProduct ? currentProduct.price : 0;
  const totalCost = recipeItems.reduce((sum, item) => sum + (Number(item.item_cost) || 0), 0);
  const cmvPercent = productPrice > 0 ? (totalCost / productPrice) * 100 : 0;
  const grossProfit = productPrice - totalCost;
  const grossMarginPercent = productPrice > 0 ? (grossProfit / productPrice) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Fichas Técnicas & Receitas
          </h1>
          <p className="text-xs text-slate-400">
            Composição detalhada dos produtos, cálculo automatizado de CMV e margem bruta real
          </p>
        </div>

        {/* Seletor de Produto */}
        <div className="w-full sm:w-72">
          <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
            Selecione o Produto
          </label>
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 focus:outline-none focus:border-amber-500/50"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.business_name}) - {formatCurrency(p.price)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentProduct && (
        <>
          {/* Cartões de Indicadores Econômicos da Ficha Técnica */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Preço Venda</span>
              <div className="font-mono text-xl font-bold text-slate-100">
                {formatCurrency(productPrice)}
              </div>
              <span className="text-[10px] text-slate-500">Praticado no cardápio</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Custo Total Insumos</span>
              <div className="font-mono text-xl font-bold text-amber-400">
                {formatCurrency(totalCost)}
              </div>
              <span className="text-[10px] text-slate-500">{recipeItems.length} insumos alocados</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">CMV Unitário %</span>
              <div className={`font-mono text-xl font-bold ${cmvPercent > 45 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatPercent(cmvPercent)}
              </div>
              <span className="text-[10px] text-slate-500">Ideal: entre 28% e 42%</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Lucro Bruto Unitário</span>
              <div className="font-mono text-xl font-bold text-slate-100">
                {formatCurrency(grossProfit)}
              </div>
              <span className="text-[10px] text-slate-500">Por unidade vendida</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1 col-span-2 lg:col-span-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Margem Bruta %</span>
              <div className="font-mono text-xl font-bold text-slate-100">
                {formatPercent(grossMarginPercent)}
              </div>
              <span className="text-[10px] text-slate-500">Margem de contribuição</span>
            </div>
          </div>

          {/* Composição da Ficha Técnica */}
          <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-amber-400" />
                  <span>Ingredientes & Proporções de {currentProduct.name}</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Os valores são calculados com precisão direta a partir do custo por grama, ml ou unidade do insumo.
                </p>
              </div>

              <button
                onClick={handleSaveRecipe}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer self-start sm:self-auto"
              >
                {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Gravando...' : saveSuccess ? 'Ficha Salva!' : 'Salvar Ficha Técnica'}</span>
              </button>
            </div>

            {/* Adicionar Insumo */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-end gap-3 text-xs">
              <div className="flex-1 w-full">
                <label className="block text-slate-400 mb-1">Selecionar Insumo / Ingrediente</label>
                <select
                  value={newIngredientId}
                  onChange={e => setNewIngredientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
                >
                  <option value="">Escolha um ingrediente cadastrado...</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit}) - Custo base: {formatCurrency(ing.cost_per_unit)}/{ing.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-36">
                <label className="block text-slate-400 mb-1">Qtd na Unidade</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Ex: 400 (g) ou 1 (un)"
                  value={newQuantity}
                  onChange={e => setNewQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleAddIngredient}
                disabled={!newIngredientId || !newQuantity}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                + Incluir Insumo
              </button>
            </div>

            {/* Tabela de Insumos da Ficha */}
            {recipeItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-800">
                Nenhum ingrediente adicionado a esta ficha técnica ainda. Adicione acima para calcular o CMV real.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Ingrediente</th>
                      <th className="py-2.5 px-3 text-center">Unidade</th>
                      <th className="py-2.5 px-3 font-mono text-center">Qtd Utilizada</th>
                      <th className="py-2.5 px-3 font-mono text-right">Custo Unitário</th>
                      <th className="py-2.5 px-3 font-mono text-right">Custo no Produto</th>
                      <th className="py-2.5 px-3 text-right">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {recipeItems.map(item => (
                      <tr key={item.ingredient_id} className="hover:bg-slate-900/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-100">
                          {item.ingredient_name}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                          {item.ingredient_unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => handleUpdateItemQty(item.ingredient_id, e.target.value)}
                            className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-center text-slate-200 text-xs font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-right">
                          {formatCurrency(item.cost_per_unit)} / {item.ingredient_unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400 text-right">
                          {formatCurrency(item.item_cost)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleRemoveIngredient(item.ingredient_id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-800 font-bold bg-slate-950/40">
                      <td colSpan="4" className="py-3 px-3 text-right text-slate-300 uppercase text-[11px]">
                        Custo Total da Ficha Técnica:
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-400 text-right text-sm">
                        {formatCurrency(totalCost)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
