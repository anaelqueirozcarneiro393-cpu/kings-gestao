import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  AlertTriangle,
  ArrowUpDown,
  History,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Calculator,
  Sparkles,
  Info,
  Scale,
  ShoppingBag
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatQuantityUnit, formatDateTime } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';

// Formatos de compra comuns no setor gastronômico
const PURCHASE_TYPES = [
  {
    id: 'pacote_peso',
    name: 'Pacote / Saco c/ Peso',
    icon: '📦',
    desc: 'Ex: Batata (R$ 23,90 pacote de 2kg), Bacon (R$ 38 pct 1kg), Farinha (saco 5kg)'
  },
  {
    id: 'peso_kg',
    name: 'Por Quilo / A Granel',
    icon: '🥩',
    desc: 'Ex: Carne bovina (R$ 34,90 o kg), Queijo a granel, Hortifrúti pesado'
  },
  {
    id: 'liquido_litro',
    name: 'Líquido / Galão / Garrafa',
    icon: '🧴',
    desc: 'Ex: Óleo (galão 18L por R$ 130), Xarope (5L), Molho (galão 3kg/L)'
  },
  {
    id: 'caixa_unidades',
    name: 'Caixa / Fardo c/ Unidades',
    icon: '📦',
    desc: 'Ex: Pão (fardo c/ 12 por R$ 21,60), Copos (cx c/ 100), Embalagens (cx c/ 100)'
  },
  {
    id: 'unidade_direta',
    name: 'Unidade Simples',
    icon: '🏷️',
    desc: 'Ex: Bebida em lata (R$ 3,20 a lata), Água mineral'
  }
];

export function StockPage({ selectedBusinessId }) {
  const [ingredients, setIngredients] = useState([]);
  const [movements, setMovements] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' or 'movements'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isIngModalOpen, setIsIngModalOpen] = useState(false);
  const [editingIng, setEditingIng] = useState(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedIngForMovement, setSelectedIngForMovement] = useState(null);

  // Form State for Ingredient
  const [ingForm, setIngForm] = useState({
    business_id: '',
    name: '',
    unit: 'g', // unidade da receita: 'g', 'ml', 'un'
    current_stock: 0,
    min_stock: 0,
    purchase_type: 'pacote_peso',
    purchase_price: '', // R$ pago
    package_size: '', // ex: 2 (para 2kg), 18 (para 18L), 100 (para 100 copos)
    package_unit: 'kg', // 'kg', 'g', 'L', 'ml', 'un'
    portion_sim_qty: '150', // quantidade para simulação da porção
    cost_per_unit: 0,
    supplier: ''
  });

  // Movement Form
  const [movementForm, setMovementForm] = useState({
    type: 'entrada',
    entry_mode: 'packages', // 'packages' or 'base_units'
    packages_count: '',
    quantity: '',
    reason: ''
  });

  useEffect(() => {
    loadData();
  }, [selectedBusinessId, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [iData, bData] = await Promise.all([
        api.getIngredients(selectedBusinessId || '').catch(() => []),
        api.getBusinesses().catch(() => [])
      ]);
      setIngredients(Array.isArray(iData) ? iData : []);
      setBusinesses(Array.isArray(bData) ? bData.filter(b => b.active) : []);

      if (activeTab === 'movements') {
        const mData = await api.getStockMovements({ business_id: selectedBusinessId || '' }).catch(() => []);
        setMovements(Array.isArray(mData) ? mData : []);
      }
    } catch (err) {
      console.error(err);
      setIngredients([]);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper de cálculo automático e inteligente do custo unitário
  const computeCostAndSim = (form) => {
    const price = Number(form.purchase_price) || 0;
    const pkgSize = Number(form.package_size) || 1;
    const type = form.purchase_type;
    let baseUnit = 'g';
    let costPerBaseUnit = 0;
    let costPerKgOrL = 0;
    let totalBaseUnitsInPackage = 1;

    if (type === 'pacote_peso') {
      baseUnit = 'g';
      if (form.package_unit === 'kg') {
        totalBaseUnitsInPackage = pkgSize * 1000;
        costPerKgOrL = pkgSize > 0 ? price / pkgSize : 0;
      } else {
        totalBaseUnitsInPackage = pkgSize;
        costPerKgOrL = pkgSize > 0 ? (price / pkgSize) * 1000 : 0;
      }
      costPerBaseUnit = totalBaseUnitsInPackage > 0 ? price / totalBaseUnitsInPackage : 0;
    } else if (type === 'peso_kg') {
      baseUnit = 'g';
      costPerKgOrL = price; // preço é diretamente o do kg
      totalBaseUnitsInPackage = 1000;
      costPerBaseUnit = price / 1000;
    } else if (type === 'liquido_litro') {
      baseUnit = 'ml';
      if (form.package_unit === 'L') {
        totalBaseUnitsInPackage = pkgSize * 1000;
        costPerKgOrL = pkgSize > 0 ? price / pkgSize : 0;
      } else {
        totalBaseUnitsInPackage = pkgSize;
        costPerKgOrL = pkgSize > 0 ? (price / pkgSize) * 1000 : 0;
      }
      costPerBaseUnit = totalBaseUnitsInPackage > 0 ? price / totalBaseUnitsInPackage : 0;
    } else if (type === 'caixa_unidades') {
      baseUnit = 'un';
      totalBaseUnitsInPackage = pkgSize;
      costPerBaseUnit = pkgSize > 0 ? price / pkgSize : 0;
    } else if (type === 'unidade_direta') {
      baseUnit = 'un';
      totalBaseUnitsInPackage = 1;
      costPerBaseUnit = price;
    }

    const simQty = Number(form.portion_sim_qty) || 0;
    const simCost = simQty * costPerBaseUnit;
    const yieldCount = simQty > 0 && totalBaseUnitsInPackage > 0 ? (totalBaseUnitsInPackage / simQty) : 0;

    return {
      baseUnit,
      costPerBaseUnit,
      costPerKgOrL,
      totalBaseUnitsInPackage,
      simCost,
      yieldCount
    };
  };

  const currentCalc = computeCostAndSim(ingForm);

  const handleOpenIngModal = (ing = null) => {
    if (ing) {
      setEditingIng(ing);
      setIngForm({
        business_id: ing.business_id,
        name: ing.name,
        unit: ing.unit,
        current_stock: ing.current_stock,
        min_stock: ing.min_stock,
        purchase_type: ing.purchase_type || (ing.unit === 'g' ? 'pacote_peso' : ing.unit === 'ml' ? 'liquido_litro' : 'caixa_unidades'),
        purchase_price: ing.purchase_price || '',
        package_size: ing.package_size || ing.purchase_quantity || (ing.unit === 'g' ? 1 : 1),
        package_unit: ing.package_unit || ing.purchase_unit || (ing.unit === 'g' ? 'kg' : ing.unit === 'ml' ? 'L' : 'un'),
        portion_sim_qty: ing.portion_sim_qty || (ing.unit === 'g' ? 150 : 1),
        cost_per_unit: ing.cost_per_unit,
        supplier: ing.supplier || ''
      });
    } else {
      setEditingIng(null);
      setIngForm({
        business_id: selectedBusinessId || (businesses[0]?.id || ''),
        name: '',
        unit: 'g',
        current_stock: 0,
        min_stock: 0,
        purchase_type: 'pacote_peso',
        purchase_price: '',
        package_size: 2, // ex padrão 2kg de batata
        package_unit: 'kg',
        portion_sim_qty: 150,
        cost_per_unit: 0,
        supplier: ''
      });
    }
    setIsIngModalOpen(true);
  };

  const handleSaveIng = async (e) => {
    e.preventDefault();
    if (!ingForm.name || !ingForm.purchase_price) {
      alert('Informe o nome e o preço de compra do insumo');
      return;
    }

    const calc = computeCostAndSim(ingForm);

    const payload = {
      ...ingForm,
      unit: calc.baseUnit,
      cost_per_unit: calc.costPerBaseUnit,
      purchase_quantity: Number(ingForm.package_size) || 1,
      purchase_unit: ingForm.package_unit
    };

    try {
      if (editingIng) {
        await api.updateIngredient(editingIng.id, payload);
      } else {
        await api.createIngredient(payload);
      }
      setIsIngModalOpen(false);
      loadData();
    } catch (err) {
      alert('Erro ao salvar insumo: ' + err.message);
    }
  };

  const handleDeleteIng = async (id) => {
    if (confirm('Deseja excluir este ingrediente?')) {
      try {
        await api.deleteIngredient(id);
        loadData();
      } catch (err) {
        alert('Erro ao excluir: ' + err.message);
      }
    }
  };

  const handleOpenMovement = (ing) => {
    setSelectedIngForMovement(ing);
    setMovementForm({
      type: 'entrada',
      entry_mode: 'packages',
      packages_count: '1',
      quantity: '',
      reason: ''
    });
    setIsMovementModalOpen(true);
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();

    let finalQuantity = Number(movementForm.quantity);

    // Se estiver em modo de pacotes para entrada
    if (movementForm.type === 'entrada' && movementForm.entry_mode === 'packages' && selectedIngForMovement) {
      const pkgCount = Number(movementForm.packages_count) || 0;
      if (pkgCount <= 0) {
        alert('Informe a quantidade de pacotes/embalagens');
        return;
      }

      // Calcula quantas unidades base tem no pacote
      const pkgSize = selectedIngForMovement.package_size || selectedIngForMovement.purchase_quantity || 1;
      const pkgUnit = selectedIngForMovement.package_unit || selectedIngForMovement.purchase_unit;
      let unitsPerPkg = pkgSize;

      if (pkgUnit === 'kg' && selectedIngForMovement.unit === 'g') unitsPerPkg = pkgSize * 1000;
      else if (pkgUnit === 'L' && selectedIngForMovement.unit === 'ml') unitsPerPkg = pkgSize * 1000;

      finalQuantity = pkgCount * unitsPerPkg;
    }

    if (!finalQuantity || finalQuantity <= 0) {
      alert('Informe uma quantidade válida');
      return;
    }

    const defaultReason = movementForm.entry_mode === 'packages' && movementForm.type === 'entrada'
      ? `Entrada de ${movementForm.packages_count} pacote(s)/embalagem(ns)`
      : movementForm.reason || 'Movimentação manual';

    try {
      await api.createStockMovement({
        ingredient_id: selectedIngForMovement.id,
        type: movementForm.type,
        quantity: finalQuantity,
        reason: movementForm.reason || defaultReason
      });
      setIsMovementModalOpen(false);
      loadData();
    } catch (err) {
      alert('Erro ao registrar movimentação: ' + err.message);
    }
  };

  const safeIngredients = Array.isArray(ingredients) ? ingredients : [];
  const filteredIngredients = safeIngredients.filter(i => {
    if (!searchQuery) return true;
    return i.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const lowStockCount = safeIngredients.filter(i => i.is_low_stock).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Estoque & Precificação de Insumos
          </h1>
          <p className="text-xs text-slate-400">
            Cadastre por pacote, quilo ou caixa. O sistema converte automaticamente para o custo exato da porção.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenIngModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Cadastrar Insumo / Pacote</span>
          </button>
        </div>
      </div>

      {/* Alerta de Estoque Crítico */}
      {lowStockCount > 0 && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Existem {lowStockCount} insumo(s) abaixo do estoque mínimo de segurança.</span>
          </div>
          <span className="text-[11px] font-mono uppercase bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 font-bold">
            Atenção Necessária
          </span>
        </div>
      )}

      {/* Tabs & Busca */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Inventário & Insumos
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'movements'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Histórico de Movimentações</span>
          </button>
        </div>

        {activeTab === 'inventory' && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {activeTab === 'inventory' ? (
        /* Tabela de Insumos com Visão Dupla: Cozinha vs Pacotes */
        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-md">
          {filteredIngredients.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum insumo cadastrado"
              description="Cadastre os insumos comprados (por pacote, quilo ou unidade) para calcular custos de porção e estoque."
              actionLabel="+ Cadastrar Primeiro Insumo"
              onAction={() => handleOpenIngModal()}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Operação</th>
                    <th className="py-3 px-4">Formato de Compra</th>
                    <th className="py-3 px-4 font-mono text-right">Custo na Receita</th>
                    <th className="py-3 px-4 font-mono text-right">Estoque Atual</th>
                    <th className="py-3 px-4 font-mono text-right">Estoque Mínimo</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredIngredients.map(ing => {
                    // Cálculo de equivalência em pacotes para o dono bater o olho
                    let packageEquivalent = null;
                    const pkgSize = ing.package_size || ing.purchase_quantity;
                    const pkgUnit = ing.package_unit || ing.purchase_unit;

                    if (pkgSize > 0) {
                      let baseFactor = 1;
                      if (pkgUnit === 'kg' && ing.unit === 'g') baseFactor = 1000;
                      else if (pkgUnit === 'L' && ing.unit === 'ml') baseFactor = 1000;

                      const unitsPerPkg = pkgSize * baseFactor;
                      if (unitsPerPkg > 0) {
                        const pkgs = ing.current_stock / unitsPerPkg;
                        packageEquivalent = `${pkgs.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pct(s)`;
                      }
                    }

                    return (
                      <tr key={ing.id} className="hover:bg-slate-900/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-100">{ing.name}</div>
                          <div className="text-[11px] text-slate-500">{ing.supplier || 'Sem fornecedor'}</div>
                        </td>

                        <td className="py-3 px-4 text-slate-300">
                          {ing.business_name}
                        </td>

                        <td className="py-3 px-4">
                          <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 inline-block">
                            <span className="font-semibold text-slate-200">
                              {ing.purchase_price ? formatCurrency(ing.purchase_price) : formatCurrency(ing.cost_per_unit)}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {ing.purchase_type === 'peso_kg'
                                ? 'por 1 kg'
                                : ing.package_size
                                ? `pacote c/ ${ing.package_size} ${ing.package_unit || ing.unit}`
                                : `por ${ing.unit}`}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-amber-400 text-right">
                          <div>
                            {ing.unit === 'g' || ing.unit === 'ml'
                              ? `R$ ${Number(ing.cost_per_unit || 0).toFixed(4)} / ${ing.unit}`
                              : `${formatCurrency(ing.cost_per_unit)} / ${ing.unit}`}
                          </div>
                          {(ing.unit === 'g' || ing.unit === 'ml') && (
                            <span className="text-[10px] font-normal text-slate-500 block">
                              {formatCurrency(ing.cost_per_unit * 1000)} / {ing.unit === 'g' ? 'kg' : 'L'}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-right">
                          <div className={ing.is_low_stock ? 'text-rose-400 font-extrabold' : 'text-slate-100'}>
                            {formatQuantityUnit(ing.current_stock, ing.unit)}
                          </div>
                          {packageEquivalent && (
                            <span className="text-[10px] font-normal text-amber-400/90 block">
                              ≈ {packageEquivalent}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-400 text-right">
                          {formatQuantityUnit(ing.min_stock, ing.unit)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ing.is_low_stock
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {ing.is_low_stock ? 'Estoque Baixo' : 'Normal'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenMovement(ing)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-[11px] transition-colors cursor-pointer"
                              title="Dar entrada ou ajustar estoque"
                            >
                              + Entrada
                            </button>
                            <button
                              onClick={() => handleOpenIngModal(ing)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                              title="Editar precificação do insumo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteIng(ing.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Excluir insumo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Histórico de Movimentações */
        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-md">
          {movements.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhuma movimentação registrada"
              description="Quando você fizer vendas, compras ou ajustes manuais, o histórico aparecerá aqui com auditoria completa."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Operação</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 font-mono text-right">Qtd Movimentada</th>
                    <th className="py-3 px-4 font-mono text-right">Estoque Resultante</th>
                    <th className="py-3 px-4">Motivo / Pedido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {movements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-900/80 transition-colors">
                      <td className="py-3 px-4 text-slate-400">{formatDateTime(m.created_at)}</td>
                      <td className="py-3 px-4 font-bold text-slate-100">{m.ingredient_name}</td>
                      <td className="py-3 px-4 text-slate-400">{m.business_name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          m.type === 'saida_venda' ? 'bg-purple-500/20 text-purple-300' :
                          m.type === 'entrada' ? 'bg-emerald-500/20 text-emerald-300' :
                          m.type === 'saida_perda' ? 'bg-rose-500/20 text-rose-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-right">
                        {m.type.includes('saida') ? `-${m.quantity}` : `+${m.quantity}`} {m.ingredient_unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200 text-right">
                        {m.new_stock} {m.ingredient_unit}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{m.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL AVANÇADO DE CADASTRO E PRECIFICAÇÃO DE INSUMO */}
      {isIngModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    {editingIng ? 'Editar Precificação do Insumo' : 'Novo Insumo & Precificação'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Configure como você compra no fornecedor e veja o custo na receita
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsIngModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveIng} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Operação e Nome */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Operação *</label>
                  <select
                    disabled={Boolean(editingIng)}
                    value={ingForm.business_id}
                    onChange={e => setIngForm({ ...ingForm, business_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {businesses.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Nome do Insumo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Batata Palito Pré-Frita, Blend Bovino, Bacon em Fatias..."
                    value={ingForm.name}
                    onChange={e => setIngForm({ ...ingForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-medium"
                  />
                </div>
              </div>

              {/* SELETOR DO FORMATO REAL DE COMPRA */}
              <div>
                <label className="block text-slate-300 font-semibold uppercase tracking-wider text-[11px] mb-2">
                  Como você compra este produto do fornecedor?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PURCHASE_TYPES.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        let newUnit = 'g';
                        let newPkgUnit = 'kg';
                        let newPkgSize = 2;
                        let newSim = 150;

                        if (type.id === 'peso_kg') {
                          newUnit = 'g';
                          newPkgUnit = 'kg';
                          newPkgSize = 1;
                          newSim = 160;
                        } else if (type.id === 'liquido_litro') {
                          newUnit = 'ml';
                          newPkgUnit = 'L';
                          newPkgSize = 5;
                          newSim = 30;
                        } else if (type.id === 'caixa_unidades') {
                          newUnit = 'un';
                          newPkgUnit = 'un';
                          newPkgSize = 100;
                          newSim = 1;
                        } else if (type.id === 'unidade_direta') {
                          newUnit = 'un';
                          newPkgUnit = 'un';
                          newPkgSize = 1;
                          newSim = 1;
                        }

                        setIngForm({
                          ...ingForm,
                          purchase_type: type.id,
                          unit: newUnit,
                          package_unit: newPkgUnit,
                          package_size: newPkgSize,
                          portion_sim_qty: newSim
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        ingForm.purchase_type === type.id
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-xs">
                        <span>{type.icon}</span>
                        <span>{type.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CAMPOS DINÂMICOS DE COMPRA E PREÇO */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Preço Pago */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      {ingForm.purchase_type === 'peso_kg' ? 'Preço por 1 kg (R$) *' : 'Preço da Embalagem / Pacote (R$) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Ex: 23.90 ou 34.90"
                      value={ingForm.purchase_price}
                      onChange={e => setIngForm({ ...ingForm, purchase_price: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-amber-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Tamanho da Embalagem (se aplicável) */}
                  {ingForm.purchase_type !== 'peso_kg' && ingForm.purchase_type !== 'unidade_direta' && (
                    <>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          {ingForm.purchase_type === 'caixa_unidades' ? 'Unidades na Caixa *' : 'Conteúdo do Pacote *'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="Ex: 2 para 2kg, 100 copos"
                          value={ingForm.package_size}
                          onChange={e => setIngForm({ ...ingForm, package_size: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Unidade da Embalagem</label>
                        <select
                          value={ingForm.package_unit}
                          onChange={e => setIngForm({ ...ingForm, package_unit: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
                        >
                          {ingForm.purchase_type === 'pacote_peso' && (
                            <>
                              <option value="kg">Quilos (kg)</option>
                              <option value="g">Gramas (g)</option>
                            </>
                          )}
                          {ingForm.purchase_type === 'liquido_litro' && (
                            <>
                              <option value="L">Litros (L)</option>
                              <option value="ml">Mililitros (ml)</option>
                            </>
                          )}
                          {ingForm.purchase_type === 'caixa_unidades' && (
                            <option value="un">Unidades (un)</option>
                          )}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* PAINEL DE CONVERSÃO EM TEMPO REAL & SIMULADOR DE PORÇÃO */}
                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-3">
                  <div className="flex items-center justify-between text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <Calculator className="w-4 h-4" />
                      <span>Cálculo Inteligente de Custo & Rendimento</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal normal-case">
                      Unidade de uso nas fichas técnicas: <strong className="text-amber-300">{currentCalc.baseUnit}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Custo por {currentCalc.baseUnit}:</span>
                      <span className="font-mono font-bold text-amber-300 text-xs">
                        R$ {currentCalc.costPerBaseUnit.toFixed(4)}
                      </span>
                    </div>

                    {(currentCalc.baseUnit === 'g' || currentCalc.baseUnit === 'ml') && (
                      <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Custo por {currentCalc.baseUnit === 'g' ? '1 kg' : '1 Litro'}:</span>
                        <span className="font-mono font-bold text-slate-200 text-xs">
                          {formatCurrency(currentCalc.costPerKgOrL)}
                        </span>
                      </div>
                    )}

                    <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Rendimento Total:</span>
                      <span className="font-mono font-bold text-slate-200 text-xs">
                        {currentCalc.totalBaseUnitsInPackage.toLocaleString('pt-BR')} {currentCalc.baseUnit} / pct
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Simular Porção:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={ingForm.portion_sim_qty}
                          onChange={e => setIngForm({ ...ingForm, portion_sim_qty: e.target.value })}
                          className="w-14 px-1 py-0.5 bg-slate-950 border border-slate-700 rounded text-center text-[11px] font-mono text-amber-300"
                        />
                        <span className="text-[10px] text-slate-400">{currentCalc.baseUnit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Resumo do Simulador */}
                  <div className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
                    <span>
                      👉 Uma porção com <strong className="text-amber-400 font-mono">{ingForm.portion_sim_qty} {currentCalc.baseUnit}</strong> custará exatamente <strong className="text-emerald-400 font-mono">{formatCurrency(currentCalc.simCost)}</strong> nos seus hambúrgueres/porções.
                    </span>
                    {currentCalc.yieldCount > 1 && (
                      <span className="text-[11px] text-slate-400 font-mono pl-2 border-l border-slate-700 whitespace-nowrap">
                        Rende ≈ {currentCalc.yieldCount.toFixed(1)} porções
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Estoque Inicial, Mínimo e Fornecedor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Estoque Atual ({currentCalc.baseUnit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 10000"
                    value={ingForm.current_stock}
                    onChange={e => setIngForm({ ...ingForm, current_stock: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {currentCalc.baseUnit === 'g' && ingForm.current_stock >= 1000 && `Equivale a ${(ingForm.current_stock / 1000).toFixed(1)} kg`}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Estoque Mínimo de Alerta ({currentCalc.baseUnit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2000"
                    value={ingForm.min_stock}
                    onChange={e => setIngForm({ ...ingForm, min_stock: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Avisa quando faltar insumo
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Fornecedor Habitual</label>
                  <input
                    type="text"
                    placeholder="Ex: Frigorífico Boi Gordo, Distribuidora..."
                    value={ingForm.supplier}
                    onChange={e => setIngForm({ ...ingForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsIngModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Salvar Precificação do Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INTELIGENTE DE ENTRADA / MOVIMENTAÇÃO DE ESTOQUE */}
      {isMovementModalOpen && selectedIngForMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div>
                <h2 className="text-base font-bold text-slate-100">Entrada / Ajuste de Estoque</h2>
                <p className="text-xs text-amber-400 font-semibold">{selectedIngForMovement.name}</p>
              </div>
              <button onClick={() => setIsMovementModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMovement} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tipo de Movimentação</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'entrada', label: '+ Entrada de Compra' },
                    { id: 'saida_perda', label: '- Perda / Descarte' },
                    { id: 'ajuste', label: '= Ajuste de Inventário' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMovementForm({ ...movementForm, type: t.id })}
                      className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        movementForm.type === t.id
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opção Rápida de Entrada por Pacotes Inteiros! */}
              {movementForm.type === 'entrada' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Como você quer lançar a compra?</span>
                    <div className="flex gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setMovementForm({ ...movementForm, entry_mode: 'packages' })}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          movementForm.entry_mode === 'packages' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                        }`}
                      >
                        Por Pacotes
                      </button>
                      <button
                        type="button"
                        onClick={() => setMovementForm({ ...movementForm, entry_mode: 'base_units' })}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          movementForm.entry_mode === 'base_units' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                        }`}
                      >
                        Direto em {selectedIngForMovement.unit}
                      </button>
                    </div>
                  </div>

                  {movementForm.entry_mode === 'packages' ? (
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">
                        Quantos pacotes/caixas de ({selectedIngForMovement.package_size || selectedIngForMovement.purchase_quantity || 1} {selectedIngForMovement.package_unit || selectedIngForMovement.purchase_unit || selectedIngForMovement.unit}) você comprou?
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          required
                          placeholder="Ex: 5"
                          value={movementForm.packages_count}
                          onChange={e => setMovementForm({ ...movementForm, packages_count: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-amber-300 font-mono font-bold text-sm focus:outline-none"
                        />
                        <span className="text-slate-300 whitespace-nowrap font-medium">pacote(s)</span>
                      </div>
                      {Number(movementForm.packages_count) > 0 && (
                        <div className="text-[11px] text-emerald-400 mt-1.5 font-mono">
                          ✓ Irá somar automaticamente: +{Number(movementForm.packages_count) * ((selectedIngForMovement.package_unit === 'kg' ? 1000 : 1) * (selectedIngForMovement.package_size || 1))} {selectedIngForMovement.unit} ao estoque!
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">
                        Quantidade em {selectedIngForMovement.unit}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder={`Quantidade em ${selectedIngForMovement.unit}`}
                        value={movementForm.quantity}
                        onChange={e => setMovementForm({ ...movementForm, quantity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono text-sm focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Se for perda ou ajuste */}
              {movementForm.type !== 'entrada' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {movementForm.type === 'ajuste' ? `Novo Estoque Físico (${selectedIngForMovement.unit})` : `Quantidade Descartada (${selectedIngForMovement.unit})`}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={`Quantidade em ${selectedIngForMovement.unit}`}
                    value={movementForm.quantity}
                    onChange={e => setMovementForm({ ...movementForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-sm focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Motivo / Justificativa</label>
                <input
                  type="text"
                  placeholder="Ex: Compra semanal Atacadão, avaria de embalagem..."
                  value={movementForm.reason}
                  onChange={e => setMovementForm({ ...movementForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
