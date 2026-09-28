import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { PublicMenuPage } from './pages/public/PublicMenuPage';
import { OrderTrackingPage } from './pages/public/OrderTrackingPage';
import { LoginPage } from './pages/admin/LoginPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { DashboardPage } from './pages/admin/DashboardPage';
import { OrdersPage } from './pages/admin/OrdersPage';
import { KdsPage } from './pages/admin/KdsPage';
import { CashRegisterPage } from './pages/admin/CashRegisterPage';
import { ProductsPage } from './pages/admin/ProductsPage';
import { RecipesPage } from './pages/admin/RecipesPage';
import { CmvPage } from './pages/admin/CmvPage';
import { StockPage } from './pages/admin/StockPage';
import { InventoryAuditPage } from './pages/admin/InventoryAuditPage';
import { CouriersPage } from './pages/admin/CouriersPage';
import { CustomersPage } from './pages/admin/CustomersPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { FinancePage } from './pages/admin/FinancePage';
import { SettingsPage } from './pages/admin/SettingsPage';

export function App() {
  const { isAuthenticated, loading } = useAuth();

  // Navigation State Baseada na URL
  // /cardapio ou / -> Cardápio Digital Público
  // /admin -> Painel Operacional / Login
  const getInitialMode = () => {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/admin') || path.startsWith('/login')) {
      return 'admin';
    }
    return 'public_menu'; // /cardapio e / abrem direto o cardápio público
  };

  const [currentMode, setCurrentMode] = useState(getInitialMode);
  const [trackingOrderNumber, setTrackingOrderNumber] = useState(null);

  // Sincroniza histórico e botões de avançar/voltar do navegador
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.startsWith('/admin') || path.startsWith('/login')) {
        setCurrentMode('admin');
      } else {
        setCurrentMode('public_menu');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (mode) => {
    setCurrentMode(mode);
    if (mode === 'admin' || mode === 'admin_login') {
      window.history.pushState(null, '', '/admin');
    } else if (mode === 'public_menu') {
      window.history.pushState(null, '', '/cardapio');
    }
  };

  // Admin sub-routes
  const [adminRoute, setAdminRoute] = useState('dashboard');
  const [selectedBusinessId, setSelectedBusinessId] = useState(null); // null = Visão Geral (TOTAL KING'S)
  const [targetRecipeProductId, setTargetRecipeProductId] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Customer Order Tracking View
  if (currentMode === 'order_tracking' && trackingOrderNumber) {
    return (
      <OrderTrackingPage
        orderNumber={trackingOrderNumber}
        onBackToMenu={() => navigateTo('public_menu')}
      />
    );
  }

  // Customer Digital Menu View (/cardapio e /)
  if (currentMode === 'public_menu') {
    return (
      <PublicMenuPage
        onOpenTracking={(orderNum) => {
          setTrackingOrderNumber(orderNum);
          setCurrentMode('order_tracking');
        }}
        onNavigateAdmin={() => navigateTo('admin')}
      />
    );
  }

  // Admin Login View (/admin quando deslogado)
  if (currentMode === 'admin_login' || (!isAuthenticated && currentMode === 'admin')) {
    return (
      <LoginPage
        onBackToMenu={() => navigateTo('public_menu')}
      />
    );
  }

  // Admin Authenticated View (/admin quando autenticado)
  return (
    <AdminLayout
      currentRoute={adminRoute}
      onNavigate={(route) => {
        setAdminRoute(route);
      }}
      selectedBusinessId={selectedBusinessId}
      onSelectBusiness={(bId) => setSelectedBusinessId(bId)}
      onNavigatePublicMenu={() => navigateTo('public_menu')}
    >
      {adminRoute === 'dashboard' && (
        <DashboardPage
          selectedBusinessId={selectedBusinessId}
          onNavigateToOrders={() => setAdminRoute('orders')}
          onNavigateToStock={() => setAdminRoute('stock')}
        />
      )}

      {adminRoute === 'orders' && (
        <OrdersPage selectedBusinessId={selectedBusinessId} />
      )}

      {adminRoute === 'kds' && (
        <KdsPage selectedBusinessId={selectedBusinessId} />
      )}

      {adminRoute === 'cash' && (
        <CashRegisterPage />
      )}

      {adminRoute === 'products' && (
        <ProductsPage
          selectedBusinessId={selectedBusinessId}
          onNavigateToRecipe={(prodId) => {
            setTargetRecipeProductId(prodId);
            setAdminRoute('recipes');
          }}
        />
      )}

      {adminRoute === 'recipes' && (
        <RecipesPage
          selectedBusinessId={selectedBusinessId}
          initialProductId={targetRecipeProductId}
        />
      )}

      {adminRoute === 'cmv' && (
        <CmvPage selectedBusinessId={selectedBusinessId} />
      )}

      {adminRoute === 'stock' && (
        <StockPage selectedBusinessId={selectedBusinessId} />
      )}

      {adminRoute === 'inventory_audit' && (
        <InventoryAuditPage selectedBusinessId={selectedBusinessId} />
      )}

      {adminRoute === 'couriers' && (
        <CouriersPage />
      )}

      {adminRoute === 'customers' && (
        <CustomersPage />
      )}

      {adminRoute === 'reports' && (
        <ReportsPage />
      )}

      {adminRoute === 'finance' && (
        <FinancePage selectedBusinessId={selectedBusinessId} />
      )}

      {adminRoute === 'settings' && (
        <SettingsPage />
      )}
    </AdminLayout>
  );
}

export default App;
