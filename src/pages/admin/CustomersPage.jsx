import React, { useState, useEffect } from 'react';
import { Users, Phone, MessageCircle, Search, MapPin, Award, ArrowUpDown, Calendar, DollarSign } from 'lucide-react';
import { api } from '../../services/api';

export function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('total_spent'); // 'total_spent' | 'total_orders' | 'last_order'

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers
    .filter(c => {
      const q = search.toLowerCase();
      return (
        (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
        (c.customer_phone && c.customer_phone.includes(q)) ||
        (c.delivery_neighborhood && c.delivery_neighborhood.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'total_spent') return b.total_spent - a.total_spent;
      if (sortBy === 'total_orders') return b.total_orders - a.total_orders;
      if (sortBy === 'last_order') return new Date(b.last_order_at) - new Date(a.last_order_at);
      return 0;
    });

  const getLoyaltyBadge = (ordersCount) => {
    if (ordersCount >= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <Award className="w-3 h-3 text-amber-400" />
          CLIENTE VIP
        </span>
      );
    }
    if (ordersCount >= 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
          RECORRENTE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        NOVO
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-wide">
              Clientes & CRM
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Base de clientes recorrentes, histórico de consumo, ticket médio e contato direto via WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou bairro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64 sm:w-80"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-semibold text-slate-400 mb-1">Total de Clientes Únicos</div>
          <div className="text-2xl font-black font-mono text-slate-100">{customers.length}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-semibold text-amber-400 mb-1">Clientes VIP (5+ pedidos)</div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {customers.filter(c => c.total_orders >= 5).length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="text-xs font-semibold text-emerald-400 mb-1">Ticket Médio Geral</div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            R$ {customers.length > 0 ? (customers.reduce((acc, c) => acc + c.avg_ticket, 0) / customers.length).toFixed(2) : '0.00'}
          </div>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Listagem de Clientes ({filteredCustomers.length})
          </span>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="total_spent">Maior Faturamento (LTV)</option>
              <option value="total_orders">Mais Pedidos</option>
              <option value="last_order">Mais Recente</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Nenhum cliente encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Bairro / Endereço</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Pedidos</th>
                  <th className="py-3 px-4 text-right">Ticket Médio</th>
                  <th className="py-3 px-4 text-right">Total Gasto (LTV)</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-300">
                {filteredCustomers.map((c, idx) => {
                  const cleanPhone = c.customer_phone?.replace(/\D/g, '') || '';
                  const waText = encodeURIComponent(`Olá ${c.customer_name || ''}! Tudo bem? Somos da KING'S. Como foi sua última experiência conosco? Estamos à disposição!`);
                  const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${waText}` : null;

                  return (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100 text-sm">
                          {c.customer_name || 'Cliente Sem Nome'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Último pedido há {c.days_since_last_order || 0} dias
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">
                        {c.customer_phone || '-'}
                      </td>

                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{c.delivery_neighborhood || c.delivery_address || 'Balcão / Retirada'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {getLoyaltyBadge(c.total_orders)}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-100">
                        {c.total_orders}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        R$ {c.avg_ticket.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400 text-sm">
                        R$ {c.total_spent.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition-colors"
                            title="Conversar no WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
