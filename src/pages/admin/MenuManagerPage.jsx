import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  Sparkles,
  RefreshCw,
  FolderPlus,
  Layers,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

export function MenuManagerPage({ selectedBusinessId }) {
  const [activeBizId, setActiveBizId] = useState(selectedBusinessId || 2); // Default to King's Burguer (2) or selected
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [toastMessage, setToastMessage] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [isSyncingDb, setIsSyncingDb] = useState(false);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  // Product Form
  const [prodForm, setProdForm] = useState({
    business_id: 2,
    category_id: '',
    name: '',
    description: '',
    price: '',
    image_url: '',
    order_index: 1,
    availability: 1
  });

  // Category Form
  const [catForm, setCatForm] = useState({
    business_id: 2,
    name: '',
    order_index: 1,
    active: 1
  });

  useEffect(() => {
    if (selectedBusinessId) {
      setActiveBizId(selectedBusinessId);
    }
  }, [selectedBusinessId]);

  useEffect(() => {
    loadAll();
    checkDbStatus();
  }, [activeBizId]);

  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const checkDbStatus = async () => {
    try {
      const status = await api.getStatus();
      setDbStatus(status);
      return status;
    } catch (e) {
      console.warn('Erro ao consultar status do banco:', e);
      return null;
    }
  };

  const handleManualSyncDb = async () => {
    try {
      setIsSyncingDb(true);
      const res = await api.syncDatabase();
      showToast(res.message || 'Banco sincronizado com sucesso!');
      await checkDbStatus();
      await loadAll();
    } catch (err) {
      showToast('Erro ao sincronizar banco: ' + err.message, true);
    } finally {
      setIsSyncingDb(false);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [bizList, catList, prodList] = await Promise.all([
        api.getBusinesses(),
        api.getCategories(activeBizId),
        api.getProducts(activeBizId)
      ]);
      setBusinesses(bizList);
      setCategories(catList);
      setProducts(prodList);
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar dados do cardápio: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetBurguerMenu = async () => {
    if (!confirm("Deseja restaurar o cardápio oficial completo do KING'S BURGUER? Isso sincronizará as 4 categorias e os 9 itens com fotos e preços.")) {
      return;
    }
    try {
      setLoading(true);
      await api.resetBurguerMenu();
      showToast("Cardápio oficial do King's Burguer restaurado e salvo com sucesso!");
      await loadAll();
    } catch (err) {
      showToast('Erro ao restaurar cardápio: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Disponibilidade do Produto
  const handleToggleProductAvailability = async (prod) => {
    try {
      const newAvail = prod.availability === 1 ? 0 : 1;
      await api.updateProduct(prod.id, { ...prod, availability: newAvail });
      setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, availability: newAvail } : p));
      showToast(newAvail === 1 ? `"${prod.name}" marcado como DISPONÍVEL` : `"${prod.name}" marcado como ESGOTADO`);
    } catch (err) {
      showToast('Erro ao alterar disponibilidade: ' + err.message, true);
    }
  };

  // Salvar Produto
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodForm.name || !prodForm.price) {
      alert('Nome e Preço são obrigatórios!');
      return;
    }

    try {
      const payload = {
        ...prodForm,
        business_id: activeBizId,
        category_id: prodForm.category_id ? Number(prodForm.category_id) : null,
        price: Number(prodForm.price),
        order_index: Number(prodForm.order_index || 1)
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
        showToast(`Produto "${payload.name}" atualizado com sucesso!`);
      } else {
        await api.createProduct(payload);
        showToast(`Produto "${payload.name}" cadastrado com sucesso!`);
      }
      setIsProductModalOpen(false);
      loadAll();
    } catch (err) {
      showToast('Erro ao salvar produto: ' + err.message, true);
    }
  };

  // Salvar Categoria
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name) {
      alert('O nome da categoria é obrigatório!');
      return;
    }

    try {
      const payload = {
        ...catForm,
        business_id: activeBizId,
        order_index: Number(catForm.order_index || 1)
      };

      if (editingCategory) {
        await api.updateCategory(editingCategory.id, payload);
        showToast(`Categoria "${payload.name}" atualizada com sucesso!`);
      } else {
        await api.createCategory(payload);
        showToast(`Categoria "${payload.name}" criada com sucesso!`);
      }
      setIsCategoryModalOpen(false);
      loadAll();
    } catch (err) {
      showToast('Erro ao salvar categoria: ' + err.message, true);
    }
  };

  // Excluir Produto
  const handleDeleteProduct = async (prod) => {
    if (!confirm(`Excluir o produto "${prod.name}" do cardápio?`)) return;
    try {
      await api.deleteProduct(prod.id);
      showToast(`Produto "${prod.name}" removido com sucesso.`);
      loadAll();
    } catch (err) {
      showToast('Erro ao excluir: ' + err.message, true);
    }
  };

  // Excluir Categoria
  const handleDeleteCategory = async (cat) => {
    if (!confirm(`Excluir a categoria "${cat.name}"? Os produtos vinculados a ela ficarão sem categoria definida.`)) return;
    try {
      await api.deleteCategory(cat.id);
      showToast(`Categoria "${cat.name}" removida.`);
      loadAll();
    } catch (err) {
      showToast('Erro ao excluir categoria: ' + err.message, true);
    }
  };

  const openProductModal = (prod = null) => {
    if (prod) {
      setEditingProduct(prod);
      setProdForm({
        business_id: prod.business_id,
        category_id: prod.category_id || '',
        name: prod.name,
        description: prod.description || '',
        price: prod.price,
        image_url: prod.image_url || '',
        order_index: prod.order_index || 1,
        availability: prod.availability !== undefined ? prod.availability : 1
      });
    } else {
      setEditingProduct(null);
      setProdForm({
        business_id: activeBizId,
        category_id: categories[0]?.id || '',
        name: '',
        description: '',
        price: '',
        image_url: '',
        order_index: (products.length || 0) + 1,
        availability: 1
      });
    }
    setIsProductModalOpen(true);
  };

  const openCategoryModal = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCatForm({
        business_id: cat.business_id,
        name: cat.name,
        order_index: cat.order_index || 1,
        active: cat.active !== undefined ? cat.active : 1
      });
    } else {
      setEditingCategory(null);
      setCatForm({
        business_id: activeBizId,
        name: '',
        order_index: (categories.length || 0) + 1,
        active: 1
      });
    }
    setIsCategoryModalOpen(true);
  };

  // Filtragem
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = selectedCatId === 'all' || String(p.category_id) === String(selectedCatId);
    return matchSearch && matchCat;
  });

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

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-wider">GESTOR DO CARDÁPIO DIGITAL</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Adicione, edite ou pause produtos e categorias em tempo real para o cardápio público
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Number(activeBizId) === 2 && (
            <button
              onClick={handleResetBurguerMenu}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-md cursor-pointer"
              title="Restaura os 9 produtos oficiais do King's Burguer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Restaurar Cardápio Oficial</span>
            </button>
          )}

          <button
            onClick={() => openCategoryModal()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-slate-400" />
            <span>Nova Categoria</span>
          </button>

          <button
            onClick={() => openProductModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Database Connection Diagnostic Banner */}
      {dbStatus && !dbStatus.database_connected && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 text-amber-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <h3 className="font-extrabold text-sm text-amber-300">
                Atenção: Banco de Dados não conectado na Vercel!
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualSyncDb}
                disabled={isSyncingDb}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDb ? 'animate-spin' : ''}`} />
                <span>{isSyncingDb ? 'Testando...' : 'Testar Conexão Novamente'}</span>
              </button>
            </div>
          </div>
          <div className="text-xs text-amber-200/90 space-y-1.5 bg-slate-950/70 p-3.5 rounded-xl border border-amber-500/20">
            <p>
              O sistema está operando em <strong>memória temporária</strong> porque a variável de ambiente <code className="bg-amber-900/60 px-1.5 py-0.5 rounded font-mono text-amber-300">DATABASE_URL</code> não foi configurada no painel da Vercel.
            </p>
            <p className="text-amber-300 font-semibold">
              Qualquer produto ou alteração feita agora voltará ao padrão assim que a página for atualizada.
            </p>
            <div className="pt-2 text-slate-300 border-t border-amber-500/20 mt-2">
              <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider">Como salvar permanentemente (Supabase + Vercel):</span>
              <ol className="list-decimal list-inside space-y-1 mt-1 text-[11px] text-slate-300">
                <li>Acesse o painel da <strong>Vercel</strong> (<span className="text-amber-300">vercel.com</span>) e abra seu projeto.</li>
                <li>Vá em <strong>Settings &gt; Environment Variables</strong>.</li>
                <li>Crie a variável com o nome <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-amber-300">DATABASE_URL</code> e cole a string de conexão do Supabase (porta 6543 / Modo Transaction Pooler).</li>
                <li>Realize um novo Deploy (ou aguarde o deploy automático) para carregar o banco.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {dbStatus && dbStatus.database_connected && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold">Banco de Dados Conectado:</span>
            <span className="text-slate-300">{dbStatus.database_type === 'postgresql' ? 'Supabase PostgreSQL' : 'SQLite Local'}</span>
            <span className="text-emerald-400 font-mono text-[11px]">({dbStatus.tables_status?.products || 0} produtos persistidos no banco)</span>
          </div>
          <button
            onClick={handleManualSyncDb}
            disabled={isSyncingDb}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-500/30 text-[11px] font-semibold transition-all cursor-pointer"
            title="Sincroniza tabelas e sequências do PostgreSQL"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingDb ? 'animate-spin' : ''}`} />
            <span>{isSyncingDb ? 'Sincronizando...' : 'Sincronizar Banco'}</span>
          </button>
        </div>
      )}

      {/* Seletor de Operações */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(businesses && businesses.length > 0 ? businesses : [
          { id: 1, name: "KING'S AÇAÍ", slug: 'acai', icon: '🍧' },
          { id: 2, name: "KING'S BURGUER", slug: 'burguer', icon: '🍔' },
          { id: 3, name: "KING'S PIZZA", slug: 'pizza', icon: '🍕' }
        ]).map(b => (
          <button
            key={b.id}
            onClick={() => setActiveBizId(b.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
              Number(activeBizId) === Number(b.id)
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <span>{b.icon || (b.slug === 'acai' ? '🍧' : b.slug === 'burguer' ? '🍔' : '🍕')}</span>
            <span>{b.name}</span>
          </button>
        ))}
      </div>

      {/* Categorias da Operação */}
      <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Categorias Ativas ({categories.length})
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCatId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              selectedCatId === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            Todas as Categorias ({products.length})
          </button>

          {categories.map(c => {
            const count = products.filter(p => p.category_id === c.id).length;
            const isSelected = String(selectedCatId) === String(c.id);

            return (
              <div
                key={c.id}
                className={`flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <button
                  onClick={() => setSelectedCatId(isSelected ? 'all' : c.id)}
                  className="cursor-pointer"
                >
                  {c.name} <span className="opacity-60 text-[10px]">({count})</span>
                </button>
                <div className="flex items-center pl-1 border-l border-slate-800/80">
                  <button
                    onClick={() => openCategoryModal(c)}
                    className="p-1 hover:text-amber-400 text-slate-500 cursor-pointer"
                    title="Editar Categoria"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(c)}
                    className="p-1 hover:text-rose-400 text-slate-500 cursor-pointer"
                    title="Excluir Categoria"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barra de Busca de Produtos */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar produto por nome ou ingrediente..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Grid de Produtos */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Carregando catálogo...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 space-y-3">
          <UtensilsCrossed className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-xs">Nenhum produto cadastrado nesta categoria ou operação.</p>
          {Number(activeBizId) === 2 && (
            <button
              onClick={handleResetBurguerMenu}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md"
            >
              Restaurar 9 Produtos Oficiais do Burguer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(p => {
            const isAvailable = p.availability !== 0;
            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isAvailable
                    ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700 shadow-md'
                    : 'bg-slate-950/80 border-slate-800/50 opacity-60'
                }`}
              >
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                    <img
                      src={p.image_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80'}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => handleToggleProductAvailability(p)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-md cursor-pointer ${
                          isAvailable
                            ? 'bg-emerald-500/90 text-slate-950 hover:bg-emerald-400'
                            : 'bg-rose-500/90 text-white hover:bg-rose-400'
                        }`}
                        title="Clique para alternar disponibilidade"
                      >
                        {isAvailable ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{isAvailable ? 'Disponível' : 'Esgotado'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      {p.category_name || categories.find(c => c.id === p.category_id)?.name || 'Geral'}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-100 mt-1">{p.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {p.description || 'Sem descrição cadastrada.'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-base font-black text-amber-400 font-mono">
                    {formatCurrency(p.price)}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openProductModal(p)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
                      title="Editar Produto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs transition-colors cursor-pointer"
                      title="Excluir Produto"
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

      {/* Modal de Produto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-extrabold text-base text-slate-100">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nome do Item *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Kings Double Bacon"
                  value={prodForm.name}
                  onChange={e => setProdForm({ ...prodForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Categoria *</label>
                  <select
                    value={prodForm.category_id}
                    onChange={e => setProdForm({ ...prodForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Selecione...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 32.90"
                    value={prodForm.price}
                    onChange={e => setProdForm({ ...prodForm, price: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">URL da Imagem</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={prodForm.image_url}
                  onChange={e => setProdForm({ ...prodForm, image_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Descrição / Ingredientes</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Pão brioche, 2 blends 120g, cheddar cremoso..."
                  value={prodForm.description}
                  onChange={e => setProdForm({ ...prodForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Ordem</label>
                  <input
                    type="number"
                    value={prodForm.order_index}
                    onChange={e => setProdForm({ ...prodForm, order_index: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Disponibilidade</label>
                  <select
                    value={prodForm.availability}
                    onChange={e => setProdForm({ ...prodForm, availability: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                  >
                    <option value={1}>Disponível para venda</option>
                    <option value={0}>Esgotado / Pausado</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Categoria */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-extrabold text-base text-slate-100">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nome da Categoria *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hambúrguer Artesanal"
                  value={catForm.name}
                  onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Ordem de Exibição</label>
                <input
                  type="number"
                  value={catForm.order_index}
                  onChange={e => setCatForm({ ...catForm, order_index: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
