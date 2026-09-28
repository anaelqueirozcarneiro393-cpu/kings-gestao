import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, UtensilsCrossed, Check, X, FlaskConical } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';

export function ProductsPage({ selectedBusinessId, onNavigateToRecipe }) {
  const [products, setProducts] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    business_id: '',
    name: '',
    description: '',
    price: '',
    image_url: '',
    order_index: 0,
    availability: 1
  });

  useEffect(() => {
    loadData();
  }, [selectedBusinessId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pData, bData] = await Promise.all([
        api.getProducts(selectedBusinessId || ''),
        api.getBusinesses()
      ]);
      setProducts(pData);
      setBusinesses(bData.filter(b => b.active));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (prod = null) => {
    if (prod) {
      setEditingProduct(prod);
      setFormData({
        business_id: prod.business_id,
        name: prod.name,
        description: prod.description || '',
        price: prod.price,
        image_url: prod.image_url || '',
        order_index: prod.order_index || 0,
        availability: prod.availability !== undefined ? prod.availability : 1
      });
    } else {
      setEditingProduct(null);
      setFormData({
        business_id: selectedBusinessId || (businesses[0]?.id || ''),
        name: '',
        description: '',
        price: '',
        image_url: '',
        order_index: 0,
        availability: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.business_id) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, formData);
      } else {
        await api.createProduct(formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert('Erro ao salvar produto: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await api.deleteProduct(id);
        loadData();
      } catch (err) {
        alert('Erro ao excluir produto: ' + err.message);
      }
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Cardápio & Produtos
          </h1>
          <p className="text-xs text-slate-400">
            Cadastro de itens, preços de venda, disponibilidade e acompanhamento de margem
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-amber-500/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-md">
        {filteredProducts.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="Nenhum produto cadastrado"
            description="Cadastre produtos para compor os cardápios de cada operação da KING'S."
            actionLabel="Cadastrar Produto"
            onAction={() => handleOpenModal()}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">Operação</th>
                  <th className="py-3 px-4 font-mono text-right">Preço Venda</th>
                  <th className="py-3 px-4 font-mono text-right">Custo Insumos</th>
                  <th className="py-3 px-4 font-mono text-right">CMV %</th>
                  <th className="py-3 px-4 font-mono text-right">Lucro Bruto</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-900/90 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-base">
                            🍴
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-100">{p.name}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">{p.description}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-300">
                      {p.business_name}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-100 text-right">
                      {formatCurrency(p.price)}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300 text-right">
                      {p.cost > 0 ? (
                        formatCurrency(p.cost)
                      ) : (
                        <span className="text-[10px] text-amber-500/80 italic">Sem ficha</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-right">
                      {p.cmv_percent > 0 ? (
                        <span className={p.cmv_percent > 45 ? 'text-rose-400' : 'text-emerald-400'}>
                          {formatPercent(p.cmv_percent)}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-100 text-right">
                      {p.gross_profit > 0 ? formatCurrency(p.gross_profit) : '-'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        p.availability
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {p.availability ? 'Disponível' : 'Pausado'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onNavigateToRecipe(p.id)}
                          className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors"
                          title="Ficha Técnica & Receita"
                        >
                          <FlaskConical className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(p)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Editar produto"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
                          title="Excluir produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição de Produto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <h2 className="text-base font-bold text-slate-100">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Operação *</label>
                <select
                  disabled={Boolean(editingProduct)}
                  value={formData.business_id}
                  onChange={e => setFormData({ ...formData, business_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
                >
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Clássico King, Açaí 500ml..."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Preço de Venda (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="22.90"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Descrição Comercial</label>
                <textarea
                  rows="2"
                  placeholder="Ingredientes e detalhes visíveis no cardápio..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">URL da Imagem / Foto</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.image_url}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.availability === 1}
                    onChange={e => setFormData({ ...formData, availability: e.target.checked ? 1 : 0 })}
                    className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0"
                  />
                  <span className="text-slate-200">Disponível para venda no cardápio</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
