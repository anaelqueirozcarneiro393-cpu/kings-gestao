import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  ChefHat,
  Wallet,
  UtensilsCrossed,
  FlaskConical,
  TrendingUp,
  Package,
  ClipboardCheck,
  Bike,
  Users,
  BarChart3,
  DollarSign,
  Settings,
  ExternalLink,
  LogOut,
  Plus,
  Bell,
  BellOff,
  Clock,
  Ticket
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { playNewOrderChime } from '../../utils/audio';
import { OperationSelector } from './OperationSelector';
import { NewManualOrderModal } from './NewManualOrderModal';

export function AdminLayout({
  children,
  currentRoute,
  onNavigate,
  selectedBusinessId,
  onSelectBusiness,
  onNavigatePublicMenu
}) {
  const { user, logout } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const prevCountRef = useRef(0);

  useEffect(() => {
    loadBusinesses();
    checkNewOrders();
    const interval = setInterval(checkNewOrders, 6000); // 6s polling for incoming orders
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  const loadBusinesses = async () => {
    try {
      const data = await api.getBusinesses();
      setBusinesses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const checkNewOrders = async () => {
    try {
      const orders = await api.getOrders({ status: 'novo' });
      const count = orders.length;

      if (count > prevCountRef.current && prevCountRef.current !== 0) {
        if (soundEnabled) {
          playNewOrderChime();
        }
      }
      prevCountRef.current = count;
      setNewOrdersCount(count);
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Pedidos & PDV', icon: ShoppingBag, badge: newOrdersCount > 0 ? newOrdersCount : null },
    { id: 'kds', label: 'Cozinha (KDS)', icon: ChefHat },
    { id: 'cash', label: 'Frente de Caixa', icon: Wallet },
    { id: 'menu_manager', label: 'Gestor de Cardápio', icon: UtensilsCrossed },
    { id: 'coupons', label: 'Cupons de Desconto', icon: Ticket },
    { id: 'recipes', label: 'Fichas Técnicas', icon: FlaskConical },
    { id: 'cmv', label: 'CMV & Margens', icon: TrendingUp },
    { id: 'stock', label: 'Estoque & Insumos', icon: Package },
    { id: 'inventory_audit', label: 'Balanço Físico', icon: ClipboardCheck },
    { id: 'couriers', label: 'Entregadores', icon: Bike },
    { id: 'customers', label: 'Clientes (CRM)', icon: Users },
    { id: 'reports', label: 'Relatórios & Curva ABC', icon: BarChart3 },
    { id: 'finance', label: 'Financeiro & DRE', icon: DollarSign },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="w-full md:w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col shrink-0">
        {/* Logo / Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-amber-500/20">
              K
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-wider text-slate-100">KING'S</div>
              <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-widest leading-none">
                Gestão Interna
              </div>
            </div>
          </div>
          <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-600" />
            <span>{currentTime || '12:00'}</span>
          </div>
        </div>

        {/* Botão Novo Pedido Manual (+ WhatsApp/Balcão) */}
        <div className="p-3">
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Pedido</span>
          </button>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-210px)]">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-mono text-[10px] flex items-center justify-center font-bold animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-3 border-t border-slate-800/80 space-y-1 bg-slate-950/80">
          <button
            onClick={onNavigatePublicMenu}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-400 hover:text-amber-300 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Cardápio Público</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header com Seletor de Operações & Controles */}
        <header className="sticky top-0 z-30 bg-[#0b0f17]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Seletor de Operação */}
          <OperationSelector
            businesses={businesses}
            selectedBusinessId={selectedBusinessId}
            onSelectBusiness={(id) => {
              onSelectBusiness(id);
              loadBusinesses();
            }}
          />

          {/* Som & Perfil */}
          <div className="flex items-center gap-3 text-xs">
            {/* Toggle de Alerta Sonoro */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playNewOrderChime();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
              title={soundEnabled ? 'Alerta sonoro ativo para novos pedidos' : 'Alerta sonoro mudo'}
            >
              {soundEnabled ? <Bell className="w-3.5 h-3.5 text-amber-400" /> : <BellOff className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-medium hidden sm:inline">
                {soundEnabled ? 'Som Ativo' : 'Som Mudo'}
              </span>
            </button>

            <span className="hidden sm:inline font-medium text-slate-300">
              {user?.name || "Proprietário KING'S"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold uppercase">
              Operação Master
            </span>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Modal de Pedido Manual */}
      <NewManualOrderModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onOrderCreated={() => {
          checkNewOrders();
          if (currentRoute === 'orders' || currentRoute === 'dashboard') {
            window.dispatchEvent(new CustomEvent('kings_order_updated'));
          }
        }}
      />
    </div>
  );
}
