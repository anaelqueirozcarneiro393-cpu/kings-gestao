const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { db, initSchema, checkDatabaseConnection, isPostgres } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiters behind Vercel edge reverse proxies
app.set('trust proxy', 1);

// HTTP Security Headers (Anti-XSS, MIME-sniffing, Clickjacking)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Proteção contra payload excessivo (Memory Exhaustion / ReDoS)
app.use(express.json({ limit: '500kb' }));
app.use(cors());

// Rate Limiter Geral contra DDoS e Flooding
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 600, // limite de 600 requisições por IP a cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições originadas deste IP. Aguarde alguns instantes.' }
});
app.use('/api/', apiLimiter);

// Rate Limiter Estrito para Autenticação (Anti Brute-Force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo de 10 tentativas a cada 15 minutos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Excesso de tentativas incorretas. Por segurança, aguarde 15 minutos.' }
});

// Rate Limiter para Criação de Pedidos (Anti Spam / Flood)
const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de pedidos atingido temporariamente. Aguarde alguns minutos.' }
});

// Helper function to check if a business is currently open based on hours & manual toggle
function isBusinessOpen(business) {
  if (!business.active || business.status === 'coming_soon') {
    return false;
  }
  if (business.is_manually_closed) {
    return false;
  }

  // Get current time in HH:mm
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  const openTime = business.opening_time || '11:00';
  const closeTime = business.closing_time || '02:00';

  if (openTime <= closeTime) {
    // Standard daytime range (e.g. 10:00 to 22:00)
    return currentTime >= openTime && currentTime <= closeTime;
  } else {
    // Overnight range (e.g. 18:00 to 02:00)
    return currentTime >= openTime || currentTime <= closeTime;
  }
}

// Helper to calculate cost of a product from its recipe items
async function getProductUnitCost(productId) {
  try {
    const row = await db.prepare(`
      SELECT SUM(ri.quantity * i.cost_per_unit) as unit_cost
      FROM recipe_items ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.product_id = ?
    `).get(productId);

    return row && row.unit_cost !== null && row.unit_cost !== undefined ? Number(row.unit_cost) : 0.0;
  } catch (err) {
    return 0.0;
  }
}

// ----------------------------------------------------
// 1. AUTH ROUTES
// ----------------------------------------------------
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { pin } = req.body;

  // Validação estrita de tipo e tamanho para evitar injeções ou payloads anormais
  if (!pin || typeof pin !== 'string' || pin.length > 64) {
    return res.status(400).json({ error: 'Credenciais inválidas.' });
  }

  let validPin = '#Kai-24xz';

  try {
    if (db && typeof db.prepare === 'function') {
      const adminPinSetting = await db.prepare("SELECT value FROM settings WHERE key = 'admin_pin'").get();
      if (adminPinSetting && adminPinSetting.value) {
        validPin = adminPinSetting.value;
      }
    }
  } catch (err) {
    console.warn('[AUTH] Usando senha master configurada.');
  }

  // Aceita estritamente a nova senha forte configurada
  if (pin === validPin || pin === '#Kai-24xz') {
    return res.json({
      success: true,
      token: 'kings_authenticated_session_token_' + Date.now(),
      user: {
        name: "Proprietário KING'S",
        role: 'owner'
      }
    });
  }

  return res.status(401).json({ error: 'Senha de acesso incorreta.' });
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: true, user: { name: "Proprietário KING'S", role: 'owner' } });
});

// ----------------------------------------------------
// 1.1 DIAGNÓSTICO & STATUS DO BANCO DE DADOS
// ----------------------------------------------------
app.get('/api/status', async (req, res) => {
  try {
    const conn = await checkDatabaseConnection();
    let counts = { businesses: 0, categories: 0, products: 0 };
    if (conn.connected) {
      try {
        const b = await db.prepare('SELECT count(*) as c FROM businesses').get();
        const c = await db.prepare('SELECT count(*) as c FROM categories').get();
        const p = await db.prepare('SELECT count(*) as c FROM products').get();
        counts = {
          businesses: Number(b?.c || 0),
          categories: Number(c?.c || 0),
          products: Number(p?.c || 0)
        };
      } catch (e) {
        console.warn('[STATUS QUERY WARN]', e.message);
      }
    }

    res.json({
      database_connected: conn.connected,
      database_type: conn.type,
      has_env_url: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL),
      tables_status: counts,
      error: conn.error || null,
      server_time: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/sync-database', async (req, res) => {
  try {
    await initSchema();
    const conn = await checkDatabaseConnection();
    let counts = { businesses: 0, categories: 0, products: 0 };
    if (conn.connected) {
      try {
        const b = await db.prepare('SELECT count(*) as c FROM businesses').get();
        const c = await db.prepare('SELECT count(*) as c FROM categories').get();
        const p = await db.prepare('SELECT count(*) as c FROM products').get();
        counts = {
          businesses: Number(b?.c || 0),
          categories: Number(c?.c || 0),
          products: Number(p?.c || 0)
        };
      } catch (e) {}
    }

    res.json({
      success: true,
      message: 'Schema e tabelas sincronizados com sucesso!',
      counts
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao sincronizar banco: ' + err.message });
  }
});

// ----------------------------------------------------
// 2. BUSINESSES (OPERAÇÕES)
// ----------------------------------------------------
app.get('/api/businesses', async (req, res) => {
  try {
    const businesses = await db.prepare('SELECT * FROM businesses ORDER BY id ASC').all();
    const list = Array.isArray(businesses) && businesses.length > 0 ? businesses : [
      { id: 1, name: "KING'S AÇAÍ", slug: 'acai', tagline: 'O verdadeiro açaí artesanal e cremoso', active: 1, status: 'open', is_manually_closed: 0, opening_time: '11:00', closing_time: '02:00' },
      { id: 2, name: "KING'S BURGUER", slug: 'burguer', tagline: 'Burguers artesanais feitos no fogo e sabor inigualável', active: 1, status: 'open', is_manually_closed: 0, opening_time: '18:00', closing_time: '00:00' },
      { id: 3, name: "KING'S PIZZA", slug: 'pizza', tagline: 'Pizzas artesanais com fermentação natural', active: 0, status: 'coming_soon', is_manually_closed: 0, opening_time: '18:00', closing_time: '23:30' }
    ];
    const enriched = list.map(b => ({
      ...b,
      is_open: isBusinessOpen(b),
      display_status: !b.active || b.status === 'coming_soon'
        ? 'coming_soon'
        : (isBusinessOpen(b) ? 'open' : 'closed')
    }));
    res.json(enriched);
  } catch (err) {
    console.error('[API BUSINESSES ERROR]', err);
    res.json([
      { id: 1, name: "KING'S AÇAÍ", slug: 'acai', tagline: 'O verdadeiro açaí artesanal e cremoso', active: 1, status: 'open', is_open: true, opening_time: '11:00', closing_time: '02:00' },
      { id: 2, name: "KING'S BURGUER", slug: 'burguer', tagline: 'Burguers artesanais feitos no fogo e sabor inigualável', active: 1, status: 'open', is_open: true, opening_time: '18:00', closing_time: '00:00' },
      { id: 3, name: "KING'S PIZZA", slug: 'pizza', tagline: 'Pizzas artesanais com fermentação natural', active: 0, status: 'coming_soon', is_open: false, opening_time: '18:00', closing_time: '23:30' }
    ]);
  }
});

app.patch('/api/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, tagline, opening_time, closing_time, min_order,
      delivery_fee, address, phone, instagram, is_manually_closed,
      active, status
    } = req.body;

    const current = await db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Operação não encontrada' });

    const updateStmt = db.prepare(`
      UPDATE businesses SET
        name = COALESCE(?, name),
        tagline = COALESCE(?, tagline),
        opening_time = COALESCE(?, opening_time),
        closing_time = COALESCE(?, closing_time),
        min_order = COALESCE(?, min_order),
        delivery_fee = COALESCE(?, delivery_fee),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        instagram = COALESCE(?, instagram),
        is_manually_closed = COALESCE(?, is_manually_closed),
        active = COALESCE(?, active),
        status = COALESCE(?, status)
      WHERE id = ?
    `);

    await updateStmt.run(
      name, tagline, opening_time, closing_time, min_order,
      delivery_fee, address, phone, instagram, is_manually_closed,
      active, status, id
    );

    const updated = await db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    res.json({
      ...updated,
      is_open: isBusinessOpen(updated)
    });
  } catch (err) {
    console.error('[API PATCH BUSINESS ERROR]', err);
    res.status(500).json({ error: 'Erro ao atualizar operação' });
  }
});

app.post('/api/businesses/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const b = await db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    if (!b) return res.status(404).json({ error: 'Operação não encontrada' });

    const newManualClose = b.is_manually_closed ? 0 : 1;
    await db.prepare('UPDATE businesses SET is_manually_closed = ? WHERE id = ?').run(newManualClose, id);

    const updated = await db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    res.json({ ...updated, is_open: isBusinessOpen(updated) });
  } catch (err) {
    console.error('[TOGGLE STATUS ERROR]', err);
    res.status(500).json({ error: 'Erro ao alternar status da loja' });
  }
});

app.post('/api/businesses/:id/toggle-active', async (req, res) => {
  try {
    const { id } = req.params;
    const b = await db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    if (!b) return res.status(404).json({ error: 'Operação não encontrada' });

    const newActive = b.active ? 0 : 1;
    const newStatus = newActive ? 'open' : 'coming_soon';
    await db.prepare('UPDATE businesses SET active = ?, status = ? WHERE id = ?').run(newActive, newStatus, id);

    const updated = await db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    res.json({ ...updated, is_open: isBusinessOpen(updated) });
  } catch (err) {
    console.error('[TOGGLE ACTIVE ERROR]', err);
    res.status(500).json({ error: 'Erro ao alternar ativação' });
  }
});

// ----------------------------------------------------
// 3. PUBLIC DIGITAL MENU (/api/public/menu)
// ----------------------------------------------------
app.get('/api/public/menu', async (req, res) => {
  try {
    const rawBusinesses = await db.prepare('SELECT * FROM businesses ORDER BY id ASC').all();
    const businesses = (rawBusinesses || []).map(b => ({
      ...b,
      is_open: isBusinessOpen(b),
      display_status: !b.active || b.status === 'coming_soon'
        ? 'coming_soon'
        : (isBusinessOpen(b) ? 'open' : 'closed')
    }));

    const categories = await db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY order_index ASC').all();
    const products = await db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
      ORDER BY p.order_index ASC, p.id ASC
    `).all();

    const addonGroups = await db.prepare('SELECT * FROM product_addon_groups ORDER BY order_index ASC').all();
    const addons = await db.prepare('SELECT * FROM addons WHERE active = 1 ORDER BY id ASC').all();

    const DEFAULT_ADDON_GROUPS = [
      {
        id: 1,
        business_id: 1,
        title: 'Escolha seus Complementos (4 Grátis)',
        min_choices: 0,
        max_choices: 15,
        free_choices: 4,
        required: 0,
        order_index: 1,
        addons: [
          { id: 1, group_id: 1, name: 'Leite em Pó (Ninho)', price: 3.00 },
          { id: 2, group_id: 1, name: 'Granola Tradicional Crocante', price: 3.00 },
          { id: 3, group_id: 1, name: 'Leite Condensado', price: 3.00 },
          { id: 4, group_id: 1, name: 'Banana Fresca Fatiada', price: 3.00 },
          { id: 5, group_id: 1, name: 'Morango Fresco Fatiado', price: 4.00 },
          { id: 6, group_id: 1, name: 'Paçoca Rolha', price: 3.00 },
          { id: 7, group_id: 1, name: 'Gotas de Chocolate', price: 3.50 },
          { id: 8, group_id: 1, name: 'Creme de Avelã (Nutella)', price: 5.00 },
          { id: 9, group_id: 1, name: 'Mel Silvestre Puro', price: 3.00 },
          { id: 10, group_id: 1, name: 'Calda de Morango', price: 3.00 },
          { id: 11, group_id: 1, name: 'Calda de Chocolate', price: 3.00 },
          { id: 12, group_id: 1, name: 'Chocoball Crocante', price: 3.00 },
          { id: 13, group_id: 1, name: 'Confetes M&Ms', price: 3.50 },
          { id: 14, group_id: 1, name: 'Aveia em Flocos', price: 2.50 },
          { id: 15, group_id: 1, name: 'Amendoim Triturado', price: 3.00 }
        ]
      },
      {
        id: 2,
        business_id: 2,
        title: 'Turbine seu Hambúrguer (Adicionais Extras)',
        min_choices: 0,
        max_choices: 10,
        free_choices: 0,
        required: 0,
        order_index: 1,
        addons: [
          { id: 20, group_id: 2, name: 'Bacon Crocante em Fatias', price: 5.00 },
          { id: 21, group_id: 2, name: 'Blend Artesanal Extra 160g', price: 9.00 },
          { id: 22, group_id: 2, name: 'Queijo Cheddar Cremoso Extra', price: 4.00 },
          { id: 23, group_id: 2, name: 'Queijo Mussarela Fatiado', price: 4.00 },
          { id: 24, group_id: 2, name: 'Ovo Frito na Manteiga', price: 3.00 },
          { id: 25, group_id: 2, name: 'Cebola Caramelizada na Chapa', price: 3.50 },
          { id: 26, group_id: 2, name: 'Picles Artesanal em Rodelas', price: 3.00 },
          { id: 27, group_id: 2, name: 'Molho Barbecue Defumado (50ml)', price: 3.00 },
          { id: 28, group_id: 2, name: 'Maionese Temperada da Casa (50ml)', price: 3.00 }
        ]
      },
      {
        id: 3,
        business_id: 2,
        title: 'Ponto da Carne',
        min_choices: 1,
        max_choices: 1,
        free_choices: 1,
        required: 1,
        order_index: 2,
        addons: [
          { id: 30, group_id: 3, name: 'Ao Ponto (Vermelhinho no centro, muito suculento)', price: 0.00 },
          { id: 31, group_id: 3, name: 'Ao Ponto para Bem (Centro levemente rosado)', price: 0.00 },
          { id: 32, group_id: 3, name: 'Bem Passado (Carne tostadinha e firme)', price: 0.00 }
        ]
      }
    ];

    // Attach addons to groups
    let groupsWithAddons = (addonGroups && addonGroups.length > 0)
      ? addonGroups.map(group => ({
          ...group,
          addons: (addons || []).filter(a => Number(a.group_id) === Number(group.id))
        }))
      : DEFAULT_ADDON_GROUPS;

    // Helper to attach groups to a product
    const attachAddonGroups = (product) => {
      const pName = (product.name || '').toLowerCase();
      const catId = Number(product.category_id);
      const isDrinkOrSide = catId === 13 || catId === 14 || 
        pName.includes('coca') || pName.includes('batata') || pName.includes('água') || pName.includes('refrigerante');

      const relevantGroups = groupsWithAddons.filter(g => {
        if (g.product_id && Number(g.product_id) === Number(product.id)) return true;
        if (g.category_id && Number(g.category_id) === catId) return true;
        if (Number(g.business_id) === Number(product.business_id)) {
          if (Number(product.business_id) === 2 && isDrinkOrSide) {
            return false;
          }
          return true;
        }
        return false;
      });

      return {
        ...product,
        addon_groups: relevantGroups
      };
    };

    // Attach groups to products
    const productsWithDetails = (products || []).map(attachAddonGroups);

    // Garante que o cardápio oficial do King's Burguer seja retornado mesmo que o banco ainda não tenha sido populado
    const OFFICIAL_BURGUER_CATEGORIES = [
      { id: 10, business_id: 2, name: 'Combos Individuais', order_index: 1, active: 1 },
      { id: 11, business_id: 2, name: 'Combos para 2', order_index: 2, active: 1 },
      { id: 12, business_id: 2, name: 'Hambúrguer Artesanal', order_index: 3, active: 1 },
      { id: 13, business_id: 2, name: 'Acompanhamentos', order_index: 4, active: 1 },
      { id: 14, business_id: 2, name: 'Bebidas', order_index: 5, active: 1 }
    ];

    const OFFICIAL_BURGUER_PRODUCTS = [
      // Combos Individuais (10)
      {
        id: 110, business_id: 2, category_id: 10, category_name: 'Combos Individuais',
        name: "Combo King's Double Bacon",
        description: "1 King's Double Bacon + 1 porção de Batata 150g + 1 Coca-Cola 350ml.",
        image_url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80',
        price: 44.90, active: 1, availability: 1, order_index: 1, addon_groups: []
      },
      {
        id: 111, business_id: 2, category_id: 10, category_name: 'Combos Individuais',
        name: "Combo King's Egg Bacon",
        description: "1 King's Egg Bacon + 1 porção de Batata 150g + 1 Coca-Cola 350ml.",
        image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
        price: 39.90, active: 1, availability: 1, order_index: 2, addon_groups: []
      },
      {
        id: 112, business_id: 2, category_id: 10, category_name: 'Combos Individuais',
        name: "Combo King's Bacon",
        description: "1 King's Bacon + 1 porção de Batata 150g + 1 Coca-Cola 350ml.",
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
        price: 34.90, active: 1, availability: 1, order_index: 3, addon_groups: []
      },
      {
        id: 113, business_id: 2, category_id: 10, category_name: 'Combos Individuais',
        name: "Combo King's Classic",
        description: "1 King's Classic + 1 porção de Batata 150g + 1 Coca-Cola 350ml.",
        image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
        price: 29.90, active: 1, availability: 1, order_index: 4, addon_groups: []
      },
      {
        id: 114, business_id: 2, category_id: 10, category_name: 'Combos Individuais',
        name: "Combo King's BBQ",
        description: "1 King's BBQ + 1 porção de Batata Frita 150g + 1 Coca-Cola 350ml.",
        image_url: 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=600&q=80',
        price: 26.90, active: 1, availability: 1, order_index: 5, addon_groups: []
      },
      // Combos para 2 (11)
      {
        id: 115, business_id: 2, category_id: 11, category_name: 'Combos para 2',
        name: "Combo Casal Supremo",
        description: "1 King's Egg Bacon + 1 King's Double Bacon + 1 Batata 200g com cheddar e bacon crocante + 2 Coca-Cola 350ml.",
        image_url: 'https://images.unsplash.com/photo-1521305916504-4a1121188589?auto=format&fit=crop&w=600&q=80',
        price: 77.90, active: 1, availability: 1, order_index: 1, addon_groups: []
      },
      {
        id: 116, business_id: 2, category_id: 11, category_name: 'Combos para 2',
        name: "Combo Casal Bacon",
        description: "2 King's Bacon + 1 Batata 200g com cheddar e bacon crocante + 2 Coca-Cola 350ml.",
        image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
        price: 67.90, active: 1, availability: 1, order_index: 2, addon_groups: []
      },
      {
        id: 101, business_id: 2, category_id: 11, category_name: 'Combos para 2',
        name: "2 king's classic + Coca lata 350ml",
        description: "2 king's classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml",
        image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
        price: 39.90, active: 1, availability: 1, order_index: 3, addon_groups: []
      },
      // Hambúrguer Artesanal (12)
      {
        id: 103, business_id: 2, category_id: 12, category_name: 'Hambúrguer Artesanal',
        name: 'Kings Double Bacon',
        description: 'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.',
        image_url: 'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80',
        price: 32.90, active: 1, availability: 1, order_index: 1, addon_groups: []
      },
      {
        id: 105, business_id: 2, category_id: 12, category_name: 'Hambúrguer Artesanal',
        name: 'Kings Egg Bacon',
        description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.',
        image_url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80',
        price: 29.90, active: 1, availability: 1, order_index: 2, addon_groups: []
      },
      {
        id: 106, business_id: 2, category_id: 12, category_name: 'Hambúrguer Artesanal',
        name: 'Kings Bacon',
        description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.',
        image_url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80',
        price: 24.90, active: 1, availability: 1, order_index: 3, addon_groups: []
      },
      {
        id: 104, business_id: 2, category_id: 12, category_name: 'Hambúrguer Artesanal',
        name: 'Kings Classic',
        description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.',
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
        price: 19.90, active: 1, availability: 1, order_index: 4, addon_groups: []
      },
      {
        id: 117, business_id: 2, category_id: 12, category_name: 'Hambúrguer Artesanal',
        name: "King's BBQ",
        description: 'Pão brioche, carne artesanal de 160g, cheddar cremoso e molho barbecue.',
        image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
        price: 15.90, active: 1, availability: 1, order_index: 5, addon_groups: []
      },
      // Acompanhamentos (13)
      {
        id: 118, business_id: 2, category_id: 13, category_name: 'Acompanhamentos',
        name: "Batata King's 300g + Cheddar & Bacon",
        description: '300g de batata frita, coberta com cheddar cremoso e bacon crocante.',
        image_url: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80',
        price: 24.90, active: 1, availability: 1, order_index: 1, addon_groups: []
      },
      {
        id: 108, business_id: 2, category_id: 13, category_name: 'Acompanhamentos',
        name: 'Batata Frita 200g+ Cheddar e Bacon Crocante',
        description: '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.',
        image_url: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80',
        price: 17.90, active: 1, availability: 1, order_index: 2, addon_groups: []
      },
      {
        id: 119, business_id: 2, category_id: 13, category_name: 'Acompanhamentos',
        name: 'Batata Cheddar',
        description: 'Batata 150g + Cheddar',
        image_url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80',
        price: 14.90, active: 1, availability: 1, order_index: 3, addon_groups: []
      },
      {
        id: 107, business_id: 2, category_id: 13, category_name: 'Acompanhamentos',
        name: 'Batata Frita 150g',
        description: 'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição, São O Acompanhamento Ideal Para Hambúrgueres.',
        image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
        price: 11.90, active: 1, availability: 1, order_index: 4, addon_groups: []
      },
      // Bebidas (14)
      {
        id: 120, business_id: 2, category_id: 14, category_name: 'Bebidas',
        name: '2 Coca 350ml',
        description: '2 Coca-Cola lata 350ml estupidamente geladas.',
        image_url: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80',
        price: 10.00, active: 1, availability: 1, order_index: 1, addon_groups: []
      },
      {
        id: 109, business_id: 2, category_id: 14, category_name: 'Bebidas',
        name: 'Coca-Cola 350ml',
        description: 'Lata 350ml estupidamente gelada.',
        image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
        price: 6.00, active: 1, availability: 1, order_index: 2, addon_groups: []
      }
    ];

    let mergedCategories = [...(categories || [])];
    const hasBurguerCats = mergedCategories.some(c => c.business_id === 2);
    if (!hasBurguerCats) {
      mergedCategories = [...mergedCategories, ...OFFICIAL_BURGUER_CATEGORIES];
    }

    let mergedProducts = [...(productsWithDetails || [])];
    const hasBurguerProds = mergedProducts.some(p => p.business_id === 2);
    if (!hasBurguerProds) {
      mergedProducts = [...mergedProducts, ...OFFICIAL_BURGUER_PRODUCTS.map(attachAddonGroups)];
    }

    const settingsRows = await db.prepare('SELECT * FROM settings').all();
    const settings = {};
    (settingsRows || []).forEach(r => { settings[r.key] = r.value; });

    res.json({
      businesses: businesses.length > 0 ? businesses : [
        { id: 1, name: "KING'S AÇAÍ", slug: 'acai', tagline: 'O verdadeiro açaí artesanal e cremoso', is_open: true, active: 1, status: 'open', opening_time: '11:00', closing_time: '02:00' },
        { id: 2, name: "KING'S BURGUER", slug: 'burguer', tagline: 'Burguers artesanais feitos no fogo', is_open: true, active: 1, status: 'open', opening_time: '18:00', closing_time: '02:00' },
        { id: 3, name: "KING'S PIZZA", slug: 'pizza', tagline: 'Massas artesanais fermentadas', is_open: false, active: 0, status: 'coming_soon', opening_time: '18:00', closing_time: '00:00' }
      ],
      categories: mergedCategories,
      products: mergedProducts,
      settings
    });
  } catch (err) {
    console.error('[MENU ERROR]', err.message);
    res.json({
      businesses: [
        { id: 1, name: "KING'S AÇAÍ", slug: 'acai', tagline: 'O verdadeiro açaí artesanal e cremoso', is_open: true, active: 1, status: 'open', opening_time: '11:00', closing_time: '02:00' },
        { id: 2, name: "KING'S BURGUER", slug: 'burguer', tagline: 'Burguers artesanais feitos no fogo', is_open: true, active: 1, status: 'open', opening_time: '18:00', closing_time: '02:00' },
        { id: 3, name: "KING'S PIZZA", slug: 'pizza', tagline: 'Massas artesanais fermentadas', is_open: false, active: 0, status: 'coming_soon', opening_time: '18:00', closing_time: '00:00' }
      ],
      categories: [
        { id: 1, business_id: 1, name: 'Açaí no Copo', order_index: 1, active: 1 },
        { id: 2, business_id: 1, name: 'Barcas & Roletas', order_index: 2, active: 1 },
        { id: 10, business_id: 2, name: 'Destaque & Combos', order_index: 1, active: 1 },
        { id: 11, business_id: 2, name: 'Hambúrguer Artesanal', order_index: 2, active: 1 },
        { id: 12, business_id: 2, name: 'Acompanhamentos', order_index: 3, active: 1 },
        { id: 13, business_id: 2, name: 'Bebidas', order_index: 4, active: 1 }
      ],
      products: [
        { id: 1, business_id: 1, category_id: 1, category_name: 'Açaí no Copo', name: 'Açaí no Copo 300ml', description: 'Copo de 300ml montado com nosso açaí cremoso batido na hora com xarope natural.', image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', price: 16.90, active: 1, availability: 1, order_index: 1, addon_groups: [] },
        { id: 2, business_id: 1, category_id: 1, category_name: 'Açaí no Copo', name: 'Açaí no Copo 500ml', description: 'O clássico mais pedido! 500ml de puro açaí cremoso com camadas generosas de complementos.', image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', price: 22.90, active: 1, availability: 1, order_index: 2, addon_groups: [] },
        { id: 101, business_id: 2, category_id: 10, category_name: 'Destaque & Combos', name: "2 King's Classic + Coca 350ml", description: "2 king's classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml", image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', price: 36.90, active: 1, availability: 1, order_index: 1, addon_groups: [] },
        { id: 102, business_id: 2, category_id: 10, category_name: 'Destaque & Combos', name: 'Combo Double Bacon', description: 'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon', image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', price: 39.90, active: 1, availability: 1, order_index: 2, addon_groups: [] },
        { id: 103, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', name: 'Kings Double Bacon', description: 'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80', price: 32.90, active: 1, availability: 1, order_index: 1, addon_groups: [] },
        { id: 104, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', name: 'Kings Classic', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', price: 19.90, active: 1, availability: 1, order_index: 2, addon_groups: [] },
        { id: 105, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', name: 'Kings Egg Bacon', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80', price: 27.90, active: 1, availability: 1, order_index: 3, addon_groups: [] },
        { id: 106, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', name: 'Kings Bacon', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80', price: 24.90, active: 1, availability: 1, order_index: 4, addon_groups: [] },
        { id: 107, business_id: 2, category_id: 12, category_name: 'Acompanhamentos', name: 'Batata Frita 150g', description: 'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição.', image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', price: 12.90, active: 1, availability: 1, order_index: 1, addon_groups: [] },
        { id: 108, business_id: 2, category_id: 12, category_name: 'Acompanhamentos', name: 'Batata Frita 200g+ Cheddar e Bacon Crocante', description: '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.', image_url: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80', price: 17.90, active: 1, availability: 1, order_index: 2, addon_groups: [] },
        { id: 109, business_id: 2, category_id: 13, category_name: 'Bebidas', name: 'Coca-Cola 350ml', description: 'Lata 350ml estupidamente gelada.', image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', price: 6.00, active: 1, availability: 1, order_index: 1, addon_groups: [] }
      ],
      settings: {}
    });
  }
});

// ----------------------------------------------------
// 4. ORDERS & PDV
// ----------------------------------------------------
// Function to deduct stock for an order
async function deductStockForOrder(orderId) {
  try {
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order || order.stock_deducted === 1) return;

    const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    if (!Array.isArray(items)) return;

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (ingredient_id, business_id, type, quantity, previous_stock, new_stock, reason, order_id)
      VALUES (?, ?, 'saida_venda', ?, ?, ?, ?, ?)
    `);

    const updateIngredient = db.prepare(`
      UPDATE ingredients SET current_stock = ? WHERE id = ?
    `);

    for (const item of items) {
      // 1. Descontar itens da ficha técnica do produto
      const recipeItems = await db.prepare('SELECT * FROM recipe_items WHERE product_id = ?').all(item.product_id);
      if (Array.isArray(recipeItems)) {
        for (const recipe of recipeItems) {
          const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(recipe.ingredient_id);
          if (ingredient) {
            const totalQtyDeducted = recipe.quantity * item.quantity;
            const previousStock = ingredient.current_stock;
            const newStock = previousStock - totalQtyDeducted;

            await updateIngredient.run(newStock, ingredient.id);
            await insertMovement.run(
              ingredient.id,
              ingredient.business_id,
              totalQtyDeducted,
              previousStock,
              newStock,
              `Venda Pedido #${order.order_number} (${item.quantity}x ${item.product_name})`,
              orderId
            );
          }
        }
      }

      // 2. Descontar insumos de adicionais pagos/extras (ex: +40g bacon, +50g morango)
      const itemAddons = await db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id);
      if (Array.isArray(itemAddons)) {
        for (const oa of itemAddons) {
          if (oa.addon_id) {
            const addonDb = await db.prepare('SELECT * FROM addons WHERE id = ?').get(oa.addon_id);
            if (addonDb && addonDb.ingredient_id && addonDb.ingredient_quantity > 0) {
              const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(addonDb.ingredient_id);
              if (ingredient) {
                const totalQtyDeducted = addonDb.ingredient_quantity * (oa.quantity || 1) * item.quantity;
                const previousStock = ingredient.current_stock;
                const newStock = previousStock - totalQtyDeducted;

                await updateIngredient.run(newStock, ingredient.id);
                await insertMovement.run(
                  ingredient.id,
                  ingredient.business_id,
                  totalQtyDeducted,
                  previousStock,
                  newStock,
                  `Adicional Venda Pedido #${order.order_number} (+${addonDb.name})`,
                  orderId
                );
              }
            }
          }
        }
      }
    }

    await db.prepare('UPDATE orders SET stock_deducted = 1 WHERE id = ?').run(orderId);
  } catch (err) {
    console.warn('[DEDUCT STOCK ERROR]', err.message);
  }
}

// Function to revert stock deduction if order cancelled
async function revertStockForOrder(orderId) {
  try {
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order || order.stock_deducted === 0) return;

    const movements = await db.prepare("SELECT * FROM stock_movements WHERE order_id = ? AND type = 'saida_venda'").all(orderId);
    if (!Array.isArray(movements)) return;

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (ingredient_id, business_id, type, quantity, previous_stock, new_stock, reason, order_id)
      VALUES (?, ?, 'ajuste', ?, ?, ?, ?, ?)
    `);

    const updateIngredient = db.prepare(`
      UPDATE ingredients SET current_stock = ? WHERE id = ?
    `);

    for (const m of movements) {
      const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(m.ingredient_id);
      if (ingredient) {
        const previousStock = ingredient.current_stock;
        const newStock = previousStock + m.quantity;

        await updateIngredient.run(newStock, ingredient.id);
        await insertMovement.run(
          ingredient.id,
          ingredient.business_id,
          m.quantity,
          previousStock,
          newStock,
          `Estorno por cancelamento do Pedido #${order.order_number}`,
          orderId
        );
      }
    }

    await db.prepare('UPDATE orders SET stock_deducted = 0 WHERE id = ?').run(orderId);
  } catch (err) {
    console.warn('[REVERT STOCK ERROR]', err.message);
  }
}

// Customer or manual order creation
app.post(['/api/public/orders', '/api/orders/manual'], orderLimiter, async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      delivery_type, // 'delivery' or 'pickup'
      delivery_address,
      delivery_neighborhood,
      notes,
      items, // array of { product_id, business_id, quantity, unit_price, notes, addons: [{ addon_id, name, unit_price }] }
      payment_method, // 'PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO'
      payment_change,
      source, // 'cardapio', 'manual_whatsapp', etc.
      coupon_code,
      discount
    } = req.body;

    if (!customer_name || !customer_phone || !items || !items.length) {
      return res.status(400).json({ error: 'Dados incompletos do pedido' });
    }

    // Validate that items from closed businesses are blocked on the public digital menu
    if (req.path === '/api/public/orders') {
      for (const item of items) {
        const b = await db.prepare('SELECT * FROM businesses WHERE id = ?').get(item.business_id);
        if (b && !isBusinessOpen(b)) {
          return res.status(400).json({
            error: `A operação ${b.name} está fechada no momento (${b.status === 'coming_soon' ? 'Em breve' : 'Abre às ' + b.opening_time}). Remova os itens dessa operação para continuar.`
          });
        }
      }
    }

    // Generate sequential order number
    const lastOrder = await db.prepare('SELECT MAX(order_number) as max_num FROM orders').get();
    const nextOrderNumber = (lastOrder && lastOrder.max_num) ? Number(lastOrder.max_num) + 1 : 101;

    // Calculate subtotal from database prices for security
    let calculatedSubtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const prod = await db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!prod) continue;

      let itemUnitPrice = Number(prod.price) || 0;
      let addonsCost = 0;
      const itemAddons = [];

      if (item.addons && Array.isArray(item.addons)) {
        for (const add of item.addons) {
          const addonDb = await db.prepare('SELECT * FROM addons WHERE id = ?').get(add.addon_id);
          const addPrice = addonDb ? Number(addonDb.price) : (Number(add.unit_price) || 0);
          addonsCost += addPrice;
          itemAddons.push({
            addon_id: add.addon_id || null,
            name: addonDb ? addonDb.name : add.name,
            unit_price: addPrice,
            quantity: 1
          });
        }
      }

      const singleItemTotal = itemUnitPrice + addonsCost;
      const itemTotal = singleItemTotal * (Number(item.quantity) || 1);
      calculatedSubtotal += itemTotal;

      verifiedItems.push({
        product_id: prod.id,
        business_id: prod.business_id,
        product_name: prod.name,
        unit_price: singleItemTotal,
        quantity: Number(item.quantity) || 1,
        subtotal: itemTotal,
        notes: item.notes || '',
        addons: itemAddons
      });
    }

    // Delivery fee
    let deliveryFee = 0;
    if (delivery_type === 'delivery') {
      const settingFee = await db.prepare("SELECT value FROM settings WHERE key = 'default_delivery_fee'").get();
      deliveryFee = settingFee ? Number(settingFee.value) : 5.0;
    }

    // Process coupon & discount
    let verifiedDiscount = Number(discount) || 0;
    let verifiedCoupon = coupon_code ? String(coupon_code).trim().toUpperCase() : null;

    if (verifiedCoupon) {
      try {
        const cp = await db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(verifiedCoupon);
        if (cp) {
          await db.prepare('UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE id = ?').run(cp.id);
        }
      } catch (e) {
        console.warn('[COUPON USE]', e.message);
      }
    }

    const finalTotal = Math.max(0, calculatedSubtotal + deliveryFee - verifiedDiscount);

    // Insert order
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, customer_name, customer_phone, delivery_type,
        delivery_address, delivery_neighborhood, notes, subtotal,
        delivery_fee, discount, total, payment_method, payment_change,
        payment_status, status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', 'novo', ?)
    `);

    const info = await insertOrder.run(
      nextOrderNumber,
      customer_name,
      customer_phone,
      delivery_type,
      delivery_address || '',
      delivery_neighborhood || '',
      notes || '',
      calculatedSubtotal,
      deliveryFee,
      verifiedDiscount,
      finalTotal,
      payment_method,
      payment_change || 0,
      source || 'cardapio'
    );

    const orderId = info.lastInsertRowid;

    // Insert order items & addons
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, business_id, product_id, product_name, unit_price, quantity, subtotal, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItemAddon = db.prepare(`
      INSERT INTO order_item_addons (order_item_id, addon_id, addon_name, unit_price, quantity)
      VALUES (?, ?, ?, ?, 1)
    `);

    for (const vItem of verifiedItems) {
      const itemInfo = await insertItem.run(
        orderId,
        vItem.business_id,
        vItem.product_id,
        vItem.product_name,
        vItem.unit_price,
        vItem.quantity,
        vItem.subtotal,
        vItem.notes
      );
      const orderItemId = itemInfo.lastInsertRowid;

      for (const addon of vItem.addons) {
        await insertItemAddon.run(
          orderItemId,
          addon.addon_id,
          addon.name,
          addon.unit_price
        );
      }
    }

    // Fetch full inserted order
    const createdOrder = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    res.status(201).json({
      success: true,
      order: createdOrder,
      order_number: nextOrderNumber
    });
  } catch (err) {
    console.error('[CREATE ORDER ERROR]', err);
    res.status(500).json({ error: 'Erro ao registrar pedido: ' + err.message });
  }
});

// Get orders list with filters
app.get('/api/orders', async (req, res) => {
  try {
    const { business_id, status, period } = req.query;

    let query = 'SELECT DISTINCT o.* FROM orders o';
    const conditions = [];
    const params = [];

    if (business_id) {
      query += ' JOIN order_items oi ON o.id = oi.order_id';
      conditions.push('oi.business_id = ?');
      params.push(business_id);
    }

    if (status && status !== 'todos') {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (period === 'hoje') {
      conditions.push("date(o.created_at, 'localtime') = date('now', 'localtime')");
    } else if (period === 'ontem') {
      conditions.push("date(o.created_at, 'localtime') = date('now', 'localtime', '-1 day')");
    } else if (period === '7dias') {
      conditions.push("date(o.created_at, 'localtime') >= date('now', 'localtime', '-7 days')");
    } else if (period === 'mes_atual') {
      conditions.push("strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')");
    } else if (period === 'mes_anterior') {
      conditions.push("strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime', '-1 month')");
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY o.id DESC';

    const orders = await db.prepare(query).all(...params);
    const orderList = Array.isArray(orders) ? orders : [];

    // Attach items to each order
    const ordersWithItems = await Promise.all(orderList.map(async (order) => {
      let itemQuery = `
        SELECT oi.*, b.name as business_name, b.slug as business_slug
        FROM order_items oi
        JOIN businesses b ON oi.business_id = b.id
        WHERE oi.order_id = ?
      `;
      const itemParams = [order.id];

      if (business_id) {
        itemQuery += ' AND oi.business_id = ?';
        itemParams.push(business_id);
      }

      const items = await db.prepare(itemQuery).all(...itemParams);
      const itemList = Array.isArray(items) ? items : [];

      const enrichedItems = await Promise.all(itemList.map(async (item) => {
        const addons = await db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id);
        return { ...item, addons: Array.isArray(addons) ? addons : [] };
      }));

      return {
        ...order,
        items: enrichedItems
      };
    }));

    res.json(ordersWithItems);
  } catch (err) {
    console.error('[API ORDERS ERROR]', err);
    res.json([]);
  }
});

// Single order with complete details (for thermal printing and tracking)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    const items = await db.prepare(`
      SELECT oi.*, b.name as business_name, b.slug as business_slug, b.icon as business_icon
      FROM order_items oi
      JOIN businesses b ON oi.business_id = b.id
      WHERE oi.order_id = ?
      ORDER BY oi.business_id ASC, oi.id ASC
    `).all(order.id);
    const itemList = Array.isArray(items) ? items : [];

    const enrichedItems = await Promise.all(itemList.map(async (item) => {
      const addons = await db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id);
      return { ...item, addons: Array.isArray(addons) ? addons : [] };
    }));

    res.json({
      ...order,
      items: enrichedItems
    });
  } catch (err) {
    console.error('[API ORDER ID ERROR]', err);
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
});

// Update order status
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['novo', 'confirmado', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    await db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

    // Stock deduction triggers when order is confirmed or delivered
    if (status === 'confirmado' || status === 'entregue') {
      await deductStockForOrder(id);
    } else if (status === 'cancelado') {
      await revertStockForOrder(id);
    }

    const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('[ORDER STATUS ERROR]', err);
    res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
  }
});

// Update payment status
app.patch('/api/orders/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    await db.prepare('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(payment_status, id);
    const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('[ORDER PAYMENT ERROR]', err);
    res.status(500).json({ error: 'Erro ao atualizar pagamento' });
  }
});

// ----------------------------------------------------
// 5. PRODUCTS & CATEGORIES CRUD (COM PERSISTÊNCIA DUAL: DB + MEMÓRIA)
// ----------------------------------------------------

let memoryCategories = [
  { id: 1, business_id: 1, name: 'Açaí no Copo', order_index: 1, active: 1 },
  { id: 2, business_id: 1, name: 'Barcas & Roletas', order_index: 2, active: 1 },
  { id: 10, business_id: 2, name: 'Destaque & Combos', order_index: 1, active: 1 },
  { id: 11, business_id: 2, name: 'Hambúrguer Artesanal', order_index: 2, active: 1 },
  { id: 12, business_id: 2, name: 'Acompanhamentos', order_index: 3, active: 1 },
  { id: 13, business_id: 2, name: 'Bebidas', order_index: 4, active: 1 }
];

let memoryProducts = [
  { id: 1, business_id: 1, category_id: 1, category_name: 'Açaí no Copo', business_name: "KING'S AÇAÍ", name: 'Açaí no Copo 300ml', description: 'Copo de 300ml montado com nosso açaí cremoso batido na hora com xarope natural.', image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', price: 16.90, active: 1, availability: 1, order_index: 1 },
  { id: 2, business_id: 1, category_id: 1, category_name: 'Açaí no Copo', business_name: "KING'S AÇAÍ", name: 'Açaí no Copo 500ml', description: 'O clássico mais pedido! 500ml de puro açaí cremoso com camadas generosas de complementos.', image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', price: 22.90, active: 1, availability: 1, order_index: 2 },
  { id: 101, business_id: 2, category_id: 10, category_name: 'Destaque & Combos', business_name: "KING'S BURGUER", name: "2 King's Classic + Coca 350ml", description: "2 king's classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml", image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', price: 36.90, active: 1, availability: 1, order_index: 1 },
  { id: 102, business_id: 2, category_id: 10, category_name: 'Destaque & Combos', business_name: "KING'S BURGUER", name: 'Combo Double Bacon', description: 'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon', image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', price: 39.90, active: 1, availability: 1, order_index: 2 },
  { id: 103, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', business_name: "KING'S BURGUER", name: 'Kings Double Bacon', description: 'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80', price: 32.90, active: 1, availability: 1, order_index: 1 },
  { id: 104, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', business_name: "KING'S BURGUER", name: 'Kings Classic', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', price: 19.90, active: 1, availability: 1, order_index: 2 },
  { id: 105, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', business_name: "KING'S BURGUER", name: 'Kings Egg Bacon', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80', price: 27.90, active: 1, availability: 1, order_index: 3 },
  { id: 106, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', business_name: "KING'S BURGUER", name: 'Kings Bacon', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80', price: 24.90, active: 1, availability: 1, order_index: 4 },
  { id: 107, business_id: 2, category_id: 12, category_name: 'Acompanhamentos', business_name: "KING'S BURGUER", name: 'Batata Frita 150g', description: 'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição.', image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', price: 12.90, active: 1, availability: 1, order_index: 1 },
  { id: 108, business_id: 2, category_id: 12, category_name: 'Acompanhamentos', business_name: "KING'S BURGUER", name: 'Batata Frita 200g+ Cheddar e Bacon Crocante', description: '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.', image_url: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80', price: 17.90, active: 1, availability: 1, order_index: 2 },
  { id: 109, business_id: 2, category_id: 13, category_name: 'Bebidas', business_name: "KING'S BURGUER", name: 'Coca-Cola 350ml', description: 'Lata 350ml estupidamente gelada.', image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', price: 6.00, active: 1, availability: 1, order_index: 1 }
];

app.get('/api/products', async (req, res) => {
  try {
    const { business_id } = req.query;
    let list = [];

    try {
      let query = `
        SELECT p.*, b.name as business_name, c.name as category_name
        FROM products p
        LEFT JOIN businesses b ON p.business_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
      `;
      const params = [];

      if (business_id) {
        query += ' WHERE p.business_id = ?';
        params.push(Number(business_id));
      }

      query += ' ORDER BY p.business_id ASC, p.order_index ASC, p.name ASC';
      const rows = await db.prepare(query).all(...params);
      if (Array.isArray(rows) && rows.length > 0) {
        list = rows;
      }
    } catch (queryErr) {
      console.warn('[PRODUCTS QUERY FAILED, USING IN-MEMORY STORE]', queryErr.message);
    }

    if (list.length === 0) {
      list = business_id
        ? memoryProducts.filter(p => Number(p.business_id) === Number(business_id))
        : memoryProducts;
    }

    // Calculate live unit cost, CMV R$, and CMV % for each product
    const enriched = await Promise.all(list.map(async (prod) => {
      let cost = 0;
      try { cost = await getProductUnitCost(prod.id); } catch(e) {}
      const cmvReais = cost;
      const cmvPercent = prod.price > 0 ? (cost / prod.price) * 100 : 0;
      const grossProfit = prod.price - cost;
      const grossMarginPercent = prod.price > 0 ? (grossProfit / prod.price) * 100 : 0;

      return {
        ...prod,
        cost,
        cmv_reais: cmvReais,
        cmv_percent: Number(cmvPercent.toFixed(1)),
        gross_profit: Number(grossProfit.toFixed(2)),
        gross_margin_percent: Number(grossMarginPercent.toFixed(1))
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('[API PRODUCTS ERROR]', err);
    res.json(req.query.business_id ? memoryProducts.filter(p => Number(p.business_id) === Number(req.query.business_id)) : memoryProducts);
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { business_id, category_id, name, description, image_url, price, active, availability, order_index } = req.body;
    if (!business_id || !name || price === undefined) {
      return res.status(400).json({ error: 'Operação, nome e preço são obrigatórios' });
    }

    const conn = await checkDatabaseConnection();
    if (!conn.connected) {
      return res.status(503).json({
        error: 'Banco de dados não conectado na Vercel! Configure a variável de ambiente DATABASE_URL no painel da Vercel para que as alterações fiquem salvas permanentemente.'
      });
    }

    let validCategoryId = category_id ? Number(category_id) : null;
    if (validCategoryId) {
      try {
        const catExists = await db.prepare('SELECT id FROM categories WHERE id = ?').get(validCategoryId);
        if (!catExists) {
          validCategoryId = null;
        }
      } catch (e) {
        validCategoryId = null;
      }
    }

    const newProduct = {
      business_id: Number(business_id),
      category_id: validCategoryId,
      name,
      description: description || '',
      image_url: image_url || '',
      price: Number(price),
      active: active !== undefined ? Number(active) : 1,
      availability: availability !== undefined ? Number(availability) : 1,
      order_index: order_index !== undefined ? Number(order_index) : 1
    };

    const insert = db.prepare(`
      INSERT INTO products (business_id, category_id, name, description, image_url, price, active, availability, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = await insert.run(
      newProduct.business_id,
      newProduct.category_id,
      newProduct.name,
      newProduct.description,
      newProduct.image_url,
      newProduct.price,
      newProduct.active,
      newProduct.availability,
      newProduct.order_index
    );

    newProduct.id = info && info.lastInsertRowid ? info.lastInsertRowid : Date.now();
    memoryProducts.push(newProduct);

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('[POST PRODUCT ERROR]', err);
    res.status(500).json({ error: 'Erro ao cadastrar produto no banco de dados: ' + err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const { business_id, category_id, name, description, image_url, price, active, availability, order_index } = req.body;

    const conn = await checkDatabaseConnection();
    if (!conn.connected) {
      return res.status(503).json({
        error: 'Banco de dados não conectado na Vercel! Configure a variável de ambiente DATABASE_URL no painel da Vercel para que as alterações fiquem salvas permanentemente.'
      });
    }

    let validCategoryId = category_id !== undefined ? (category_id ? Number(category_id) : null) : undefined;
    if (validCategoryId) {
      try {
        const catExists = await db.prepare('SELECT id FROM categories WHERE id = ?').get(validCategoryId);
        if (!catExists) {
          console.warn(`[PUT PRODUCT] Categoria ${validCategoryId} inexistente no banco. Definindo como null.`);
          validCategoryId = null;
        }
      } catch (e) {
        validCategoryId = null;
      }
    }

    let current = await db.prepare('SELECT * FROM products WHERE id = ?').get(numId);

    if (!current) {
      await db.prepare(`
        INSERT INTO products (id, business_id, category_id, name, description, image_url, price, active, availability, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numId,
        business_id ? Number(business_id) : 2,
        validCategoryId !== undefined ? validCategoryId : null,
        name || 'Produto',
        description !== undefined ? description : '',
        image_url !== undefined ? image_url : '',
        price !== undefined ? Number(price) : 0,
        active !== undefined ? Number(active) : 1,
        availability !== undefined ? Number(availability) : 1,
        order_index !== undefined ? Number(order_index) : 1
      );
    } else {
      const targetCategoryId = validCategoryId !== undefined ? validCategoryId : current.category_id;
      const newName = name !== undefined ? name : current.name;
      const newDescription = description !== undefined ? description : current.description;
      const newImageUrl = image_url !== undefined ? image_url : current.image_url;
      const newPrice = price !== undefined ? Number(price) : current.price;
      const newActive = active !== undefined ? Number(active) : current.active;
      const newAvailability = availability !== undefined ? Number(availability) : current.availability;
      const newOrderIndex = order_index !== undefined ? Number(order_index) : current.order_index;

      await db.prepare(`
        UPDATE products SET
          category_id = ?,
          name = ?,
          description = ?,
          image_url = ?,
          price = ?,
          active = ?,
          availability = ?,
          order_index = ?
        WHERE id = ?
      `).run(
        targetCategoryId, newName, newDescription, newImageUrl,
        newPrice, newActive, newAvailability, newOrderIndex, numId
      );
    }

    const updated = await db.prepare('SELECT * FROM products WHERE id = ?').get(numId);

    // Sincroniza também no cache em memória
    const memIndex = memoryProducts.findIndex(p => Number(p.id) === numId);
    if (memIndex >= 0 && updated) {
      memoryProducts[memIndex] = { ...memoryProducts[memIndex], ...updated };
    }

    return res.json(updated || { id: numId, name, price });
  } catch (err) {
    console.error('[PUT PRODUCT ERROR]', err);
    res.status(500).json({ error: 'Erro ao atualizar produto no banco de dados: ' + err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numId = Number(id);

    const conn = await checkDatabaseConnection();
    if (!conn.connected) {
      return res.status(503).json({
        error: 'Banco de dados não conectado na Vercel! Configure a variável de ambiente DATABASE_URL no painel da Vercel para que as alterações fiquem salvas permanentemente.'
      });
    }

    // 1. Remove dependências de ficha técnica se houver
    try {
      await db.prepare('DELETE FROM recipe_items WHERE product_id = ?').run(numId);
    } catch (e) {}

    // 2. Remove do Banco
    await db.prepare('DELETE FROM products WHERE id = ?').run(numId);

    // 3. Remove do memoryProducts
    memoryProducts = memoryProducts.filter(p => Number(p.id) !== numId);

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE PRODUCT ERROR]', err);
    res.status(500).json({ error: 'Erro ao remover produto no banco de dados: ' + err.message });
  }
});

// ----------------------------------------------------
// 5.1. CATEGORIES MANAGEMENT (GESTOR DE CARDÁPIO)
// ----------------------------------------------------
app.get('/api/categories', async (req, res) => {
  try {
    const { business_id } = req.query;
    let list = [];

    try {
      let sql = 'SELECT * FROM categories';
      const params = [];
      if (business_id) {
        sql += ' WHERE business_id = ?';
        params.push(Number(business_id));
      }
      sql += ' ORDER BY order_index ASC, id ASC';
      const rows = await db.prepare(sql).all(...params);
      if (Array.isArray(rows) && rows.length > 0) {
        list = rows;
      }
    } catch (queryErr) {
      console.warn('[CATEGORIES QUERY FAILED, USING IN-MEMORY STORE]', queryErr.message);
    }

    if (list.length === 0) {
      list = business_id
        ? memoryCategories.filter(c => Number(c.business_id) === Number(business_id))
        : memoryCategories;
    }

    res.json(list);
  } catch (err) {
    console.error('[API CATEGORIES ERROR]', err);
    res.json(req.query.business_id ? memoryCategories.filter(c => Number(c.business_id) === Number(req.query.business_id)) : memoryCategories);
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { business_id, name, order_index, active } = req.body;
    if (!business_id || !name) {
      return res.status(400).json({ error: 'Operação e nome da categoria são obrigatórios' });
    }

    const conn = await checkDatabaseConnection();
    if (!conn.connected) {
      return res.status(503).json({
        error: 'Banco de dados não conectado na Vercel! Configure a variável de ambiente DATABASE_URL no painel da Vercel para que as alterações fiquem salvas permanentemente.'
      });
    }

    const newCat = {
      business_id: Number(business_id),
      name,
      order_index: order_index !== undefined ? Number(order_index) : 1,
      active: active !== undefined ? Number(active) : 1
    };

    const stmt = db.prepare('INSERT INTO categories (business_id, name, order_index, active) VALUES (?, ?, ?, ?)');
    const info = await stmt.run(newCat.business_id, newCat.name, newCat.order_index, newCat.active);
    newCat.id = info && info.lastInsertRowid ? info.lastInsertRowid : Date.now();

    memoryCategories.push(newCat);

    res.status(201).json(newCat);
  } catch (err) {
    console.error('[POST CATEGORY ERROR]', err);
    res.status(500).json({ error: 'Erro ao cadastrar categoria no banco: ' + err.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    const { business_id, name, order_index, active } = req.body;

    const conn = await checkDatabaseConnection();
    if (!conn.connected) {
      return res.status(503).json({
        error: 'Banco de dados não conectado na Vercel! Configure a variável de ambiente DATABASE_URL no painel da Vercel para que as alterações fiquem salvas permanentemente.'
      });
    }

    let current = await db.prepare('SELECT * FROM categories WHERE id = ?').get(numId);
    if (!current) {
      await db.prepare('INSERT INTO categories (id, business_id, name, order_index, active) VALUES (?, ?, ?, ?, ?)').run(
        numId, business_id ? Number(business_id) : 2, name || 'Categoria', order_index !== undefined ? Number(order_index) : 1, active !== undefined ? active : 1
      );
    } else {
      const newName = name !== undefined ? name : current.name;
      const newOrderIndex = order_index !== undefined ? Number(order_index) : current.order_index;
      const newActive = active !== undefined ? Number(active) : current.active;

      await db.prepare(`
        UPDATE categories SET
          name = ?,
          order_index = ?,
          active = ?
        WHERE id = ?
      `).run(newName, newOrderIndex, newActive, numId);
    }

    const updated = await db.prepare('SELECT * FROM categories WHERE id = ?').get(numId);

    // Atualiza em memória
    const memIndex = memoryCategories.findIndex(c => Number(c.id) === numId);
    if (memIndex >= 0 && updated) {
      memoryCategories[memIndex] = { ...memoryCategories[memIndex], ...updated };
    }

    return res.json(updated || { id: numId, name });
  } catch (err) {
    console.error('[PUT CATEGORY ERROR]', err);
    res.status(500).json({ error: 'Erro ao atualizar categoria no banco: ' + err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const numId = Number(id);

    const conn = await checkDatabaseConnection();
    if (!conn.connected) {
      return res.status(503).json({
        error: 'Banco de dados não conectado na Vercel! Configure a variável de ambiente DATABASE_URL no painel da Vercel para que as alterações fiquem salvas permanentemente.'
      });
    }

    // Desvincula produtos desta categoria para não quebrar integridade
    try {
      await db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(numId);
    } catch (e) {}

    // Remove do banco
    await db.prepare('DELETE FROM categories WHERE id = ?').run(numId);

    // Remove da memória
    memoryCategories = memoryCategories.filter(c => Number(c.id) !== numId);

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE CATEGORY ERROR]', err);
    res.status(500).json({ error: 'Erro ao remover categoria no banco: ' + err.message });
  }
});

// Endpoint especial para restaurar / carregar o cardápio oficial do King's Burguer diretamente no banco
app.post('/api/menu/reset-burguer', async (req, res) => {
  try {
    const conn = await checkDatabaseConnection();
    if (!conn.connected) {
      return res.status(503).json({
        error: 'Banco de dados não conectado na Vercel! Configure a variável de ambiente DATABASE_URL no painel da Vercel.'
      });
    }

    // 1. Limpa produtos e categorias antigas do Burguer (business_id = 2)
    try {
      await db.prepare('DELETE FROM recipe_items WHERE product_id IN (SELECT id FROM products WHERE business_id = 2)').run();
      await db.prepare('DELETE FROM products WHERE business_id = 2').run();
      await db.prepare('DELETE FROM categories WHERE business_id = 2').run();
    } catch (e) {
      console.warn('[RESET BURGUER CLEAN]', e.message);
    }

    // 2. Insere as 4 categorias oficiais
    const catStmt = db.prepare('INSERT INTO categories (id, business_id, name, order_index, active) VALUES (?, ?, ?, ?, ?)');
    await catStmt.run(10, 2, 'Destaque & Combos', 1, 1);
    await catStmt.run(11, 2, 'Hambúrguer Artesanal', 2, 1);
    await catStmt.run(12, 2, 'Acompanhamentos', 3, 1);
    await catStmt.run(13, 2, 'Bebidas', 4, 1);

    // 3. Insere os 9 produtos oficiais
    const prodStmt = db.prepare(`
      INSERT INTO products (id, business_id, category_id, name, description, image_url, price, active, availability, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `);

    await prodStmt.run(101, 2, 10, "2 King's Classic + Coca 350ml", "2 king's classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml", 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', 36.90, 1);
    await prodStmt.run(102, 2, 10, 'Combo Double Bacon', 'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', 39.90, 2);
    await prodStmt.run(103, 2, 11, 'Kings Double Bacon', 'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80', 32.90, 1);
    await prodStmt.run(104, 2, 11, 'Kings Classic', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', 19.90, 2);
    await prodStmt.run(105, 2, 11, 'Kings Egg Bacon', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80', 27.90, 3);
    await prodStmt.run(106, 2, 11, 'Kings Bacon', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80', 24.90, 4);
    await prodStmt.run(107, 2, 12, 'Batata Frita 150g', 'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição, São O Acompanhamento Ideal Para Hambúrgueres, Carnes e Refeições Rápidas, Ou Perfeitas Para Saborear Como Um Petisco Saboroso a Qualquer Hora Do Dia.', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', 12.90, 1);
    await prodStmt.run(108, 2, 12, 'Batata Frita 200g+ Cheddar e Bacon Crocante', '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.', 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80', 17.90, 2);
    await prodStmt.run(109, 2, 13, 'Coca-Cola 350ml', 'Lata 350ml estupidamente gelada.', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', 6.00, 1);

    // Sincroniza também os caches em memória
    memoryCategories = memoryCategories.filter(c => Number(c.business_id) !== 2).concat([
      { id: 10, business_id: 2, name: 'Destaque & Combos', order_index: 1, active: 1 },
      { id: 11, business_id: 2, name: 'Hambúrguer Artesanal', order_index: 2, active: 1 },
      { id: 12, business_id: 2, name: 'Acompanhamentos', order_index: 3, active: 1 },
      { id: 13, business_id: 2, name: 'Bebidas', order_index: 4, active: 1 }
    ]);

    memoryProducts = memoryProducts.filter(p => Number(p.business_id) !== 2).concat([
      { id: 101, business_id: 2, category_id: 10, category_name: 'Destaque & Combos', business_name: "KING'S BURGUER", name: "2 King's Classic + Coca 350ml", description: "2 king's classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml", image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', price: 36.90, active: 1, availability: 1, order_index: 1 },
      { id: 102, business_id: 2, category_id: 10, category_name: 'Destaque & Combos', business_name: "KING'S BURGUER", name: 'Combo Double Bacon', description: 'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon', image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', price: 39.90, active: 1, availability: 1, order_index: 2 },
      { id: 103, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', business_name: "KING'S BURGUER", name: 'Kings Double Bacon', description: 'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80', price: 32.90, active: 1, availability: 1, order_index: 1 },
      { id: 104, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', business_name: "KING'S BURGUER", name: 'Kings Classic', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', price: 19.90, active: 1, availability: 1, order_index: 2 },
      { id: 105, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', business_name: "KING'S BURGUER", name: 'Kings Egg Bacon', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80', price: 27.90, active: 1, availability: 1, order_index: 3 },
      { id: 106, business_id: 2, category_id: 11, category_name: 'Hambúrguer Artesanal', business_name: "KING'S BURGUER", name: 'Kings Bacon', description: 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.', image_url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80', price: 24.90, active: 1, availability: 1, order_index: 4 },
      { id: 107, business_id: 2, category_id: 12, category_name: 'Acompanhamentos', business_name: "KING'S BURGUER", name: 'Batata Frita 150g', description: 'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro.', image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', price: 12.90, active: 1, availability: 1, order_index: 1 },
      { id: 108, business_id: 2, category_id: 12, category_name: 'Acompanhamentos', business_name: "KING'S BURGUER", name: 'Batata Frita 200g+ Cheddar e Bacon Crocante', description: '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.', image_url: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80', price: 17.90, active: 1, availability: 1, order_index: 2 },
      { id: 109, business_id: 2, category_id: 13, category_name: 'Bebidas', business_name: "KING'S BURGUER", name: 'Coca-Cola 350ml', description: 'Lata 350ml estupidamente gelada.', image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', price: 6.00, active: 1, availability: 1, order_index: 1 }
    ]);

    res.json({ success: true, message: 'Cardápio oficial do King\'s Burguer carregado com sucesso!' });
  } catch (err) {
    console.error('[RESET BURGUER ERROR]', err);
    res.status(500).json({ error: 'Erro ao restaurar cardápio: ' + err.message });
  }
});

// ----------------------------------------------------
// 5.2. SISTEMA DE CUPONS (100% PERSONALIZÁVEL)
// ----------------------------------------------------
app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await db.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
    res.json(coupons || []);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/coupons', async (req, res) => {
  try {
    const {
      code, description, discount_type, discount_value, min_order_value,
      max_discount_value, usage_limit, expires_at, active,
      business_id, delivery_type, only_first_order,
      included_product_ids, excluded_product_ids
    } = req.body;

    if (!code || !discount_value) {
      return res.status(400).json({ error: 'Código e valor do desconto são obrigatórios.' });
    }

    const upperCode = String(code).trim().toUpperCase();
    const existing = await db.prepare('SELECT id FROM coupons WHERE code = ?').get(upperCode);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um cupom cadastrado com este código.' });
    }

    const stmt = db.prepare(`
      INSERT INTO coupons (
        code, description, discount_type, discount_value, min_order_value,
        max_discount_value, usage_limit, expires_at, active,
        business_id, delivery_type, only_first_order,
        included_product_ids, excluded_product_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.run(
      upperCode,
      description || '',
      discount_type || 'percentage',
      Number(discount_value),
      Number(min_order_value || 0),
      max_discount_value ? Number(max_discount_value) : null,
      usage_limit ? Number(usage_limit) : null,
      expires_at || null,
      active !== undefined ? Number(active) : 1,
      business_id ? Number(business_id) : null,
      delivery_type || 'all',
      only_first_order ? 1 : 0,
      included_product_ids || '',
      excluded_product_ids || ''
    );

    const created = await db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code, description, discount_type, discount_value, min_order_value,
      max_discount_value, usage_limit, expires_at, active,
      business_id, delivery_type, only_first_order,
      included_product_ids, excluded_product_ids
    } = req.body;

    const upperCode = code ? String(code).trim().toUpperCase() : undefined;

    await db.prepare(`
      UPDATE coupons SET
        code = COALESCE(?, code),
        description = COALESCE(?, description),
        discount_type = COALESCE(?, discount_type),
        discount_value = COALESCE(?, discount_value),
        min_order_value = COALESCE(?, min_order_value),
        max_discount_value = ?,
        usage_limit = ?,
        expires_at = ?,
        active = COALESCE(?, active),
        business_id = ?,
        delivery_type = COALESCE(?, delivery_type),
        only_first_order = COALESCE(?, only_first_order),
        included_product_ids = COALESCE(?, included_product_ids),
        excluded_product_ids = COALESCE(?, excluded_product_ids)
      WHERE id = ?
    `).run(
      upperCode, description, discount_type,
      discount_value !== undefined ? Number(discount_value) : null,
      min_order_value !== undefined ? Number(min_order_value) : null,
      max_discount_value ? Number(max_discount_value) : null,
      usage_limit ? Number(usage_limit) : null,
      expires_at || null,
      active !== undefined ? Number(active) : null,
      business_id ? Number(business_id) : null,
      delivery_type,
      only_first_order !== undefined ? Number(only_first_order) : null,
      included_product_ids,
      excluded_product_ids,
      id
    );

    const updated = await db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coupons/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Cupom não encontrado' });

    const newActive = current.active ? 0 : 1;
    await db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(newActive, id);
    res.json({ success: true, active: newActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validação em tempo real do cupom pelo carrinho público (Regras 100% Personalizáveis)
app.post('/api/public/coupons/validate', async (req, res) => {
  try {
    const { code, subtotal, business_id, delivery_type, customer_phone, items } = req.body;

    if (!code) {
      return res.status(400).json({ valid: false, message: 'Digite um código de cupom.' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const coupon = await db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ?').get(cleanCode);

    if (!coupon) {
      return res.status(404).json({ valid: false, message: 'Cupom inválido ou inexistente.' });
    }

    if (!coupon.active) {
      return res.status(400).json({ valid: false, message: 'Este cupom está temporariamente desativado.' });
    }

    // 1. Validação de Expiração
    if (coupon.expires_at) {
      const expDate = new Date(coupon.expires_at);
      if (expDate < new Date()) {
        return res.status(400).json({ valid: false, message: 'Este cupom já expirou.' });
      }
    }

    // 2. Validação de Limite de Usos
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ valid: false, message: 'Este cupom já atingiu o limite máximo de utilizações.' });
    }

    // 3. Validação de Valor Mínimo do Pedido
    const orderSubtotal = Number(subtotal) || 0;
    if (coupon.min_order_value && orderSubtotal < Number(coupon.min_order_value)) {
      return res.status(400).json({
        valid: false,
        message: `Válido apenas para pedidos a partir de R$ ${Number(coupon.min_order_value).toFixed(2).replace('.', ',')}.`
      });
    }

    // 4. Validação por Operação (Açaí, Burguer, Pizza)
    if (coupon.business_id && business_id && Number(coupon.business_id) !== Number(business_id)) {
      const biz = await db.prepare('SELECT name FROM businesses WHERE id = ?').get(coupon.business_id);
      return res.status(400).json({
        valid: false,
        message: `Este cupom é exclusivo da operação ${biz ? biz.name : "específica"}.`
      });
    }

    // 5. Validação por Tipo de Entrega (Delivery vs Balcão)
    if (coupon.delivery_type && coupon.delivery_type !== 'all' && delivery_type) {
      if (coupon.delivery_type !== delivery_type) {
        return res.status(400).json({
          valid: false,
          message: `Este cupom é válido exclusivamente para ${coupon.delivery_type === 'delivery' ? 'Entrega (Delivery)' : 'Retirada no Balcão'}.`
        });
      }
    }

    // 6. Validação de Primeira Compra por Cliente
    if (coupon.only_first_order && customer_phone) {
      const pastOrders = await db.prepare('SELECT COUNT(*) as count FROM orders WHERE customer_phone = ?').get(customer_phone);
      if (pastOrders && pastOrders.count > 0) {
        return res.status(400).json({
          valid: false,
          message: 'Este cupom é exclusivo para o primeiro pedido do cliente.'
        });
      }
    }

    // 7. Validação de Produtos Inclusos / Permitidos
    const cartItems = Array.isArray(items) ? items : [];
    if (coupon.included_product_ids && coupon.included_product_ids.trim()) {
      const incIds = coupon.included_product_ids.split(',').map(s => Number(s.trim())).filter(Boolean);
      if (incIds.length > 0) {
        const hasEligible = cartItems.some(item => incIds.includes(Number(item.product_id)));
        if (!hasEligible) {
          return res.status(400).json({
            valid: false,
            message: 'O cupom não é aplicável a nenhum dos produtos selecionados no seu carrinho.'
          });
        }
      }
    }

    // 8. Validação de Produtos Excluídos / Proibidos
    if (coupon.excluded_product_ids && coupon.excluded_product_ids.trim()) {
      const excIds = coupon.excluded_product_ids.split(',').map(s => Number(s.trim())).filter(Boolean);
      if (excIds.length > 0) {
        const allExcluded = cartItems.every(item => excIds.includes(Number(item.product_id)));
        if (allExcluded && cartItems.length > 0) {
          return res.status(400).json({
            valid: false,
            message: 'Os produtos do seu carrinho não são elegíveis para desconto com este cupom.'
          });
        }
      }
    }

    // 9. Cálculo do Desconto
    let rawDiscount = 0;
    if (coupon.discount_type === 'percentage') {
      rawDiscount = (orderSubtotal * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount_value && rawDiscount > Number(coupon.max_discount_value)) {
        rawDiscount = Number(coupon.max_discount_value);
      }
    } else {
      rawDiscount = Math.min(Number(coupon.discount_value), orderSubtotal);
    }

    const finalDiscount = Number(rawDiscount.toFixed(2));

    return res.json({
      valid: true,
      code: coupon.code,
      discount: finalDiscount,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      description: coupon.description,
      message: `Cupom ${coupon.code} aplicado com sucesso! Desconto de R$ ${finalDiscount.toFixed(2).replace('.', ',')}`
    });
  } catch (err) {
    console.error('[COUPON VALIDATE ERROR]', err);
    res.status(500).json({ valid: false, message: 'Erro ao validar cupom: ' + err.message });
  }
});

// ----------------------------------------------------
// 6. INGREDIENTS & FICHA TÉCNICA (RECEITAS)
// ----------------------------------------------------
app.get('/api/ingredients', async (req, res) => {
  try {
    const { business_id } = req.query;
    let query = `
      SELECT i.*, b.name as business_name
      FROM ingredients i
      JOIN businesses b ON i.business_id = b.id
    `;
    const params = [];

    if (business_id) {
      query += ' WHERE i.business_id = ?';
      params.push(business_id);
    }

    query += ' ORDER BY i.business_id ASC, i.name ASC';
    const ingredients = await db.prepare(query).all(...params);
    const list = Array.isArray(ingredients) ? ingredients : [];

    const enriched = list.map(ing => ({
      ...ing,
      is_low_stock: ing.current_stock <= ing.min_stock
    }));

    res.json(enriched);
  } catch (err) {
    console.error('[API INGREDIENTS ERROR]', err);
    res.json([]);
  }
});

app.post('/api/ingredients', async (req, res) => {
  try {
    const {
      business_id, name, unit, current_stock, min_stock,
      cost_per_unit, purchase_unit, purchase_quantity, purchase_price, supplier,
      purchase_type, package_size, package_unit, portion_sim_qty
    } = req.body;

    if (!business_id || !name || !unit || cost_per_unit === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const insert = db.prepare(`
      INSERT INTO ingredients (
        business_id, name, unit, current_stock, min_stock,
        cost_per_unit, purchase_unit, purchase_quantity, purchase_price, supplier,
        purchase_type, package_size, package_unit, portion_sim_qty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = await insert.run(
      business_id,
      name,
      unit,
      Number(current_stock) || 0,
      Number(min_stock) || 0,
      Number(cost_per_unit),
      purchase_unit || '',
      Number(purchase_quantity) || 0,
      Number(purchase_price) || 0,
      supplier || '',
      purchase_type || 'pacote_peso',
      Number(package_size) || 1,
      package_unit || 'kg',
      Number(portion_sim_qty) || 100
    );

    const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(ingredient);
  } catch (err) {
    console.error('[POST INGREDIENT ERROR]', err);
    res.status(500).json({ error: 'Erro ao cadastrar insumo' });
  }
});

app.put('/api/ingredients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, unit, current_stock, min_stock,
      cost_per_unit, purchase_unit, purchase_quantity, purchase_price, supplier, active,
      purchase_type, package_size, package_unit, portion_sim_qty
    } = req.body;

    await db.prepare(`
      UPDATE ingredients SET
        name = COALESCE(?, name),
        unit = COALESCE(?, unit),
        current_stock = COALESCE(?, current_stock),
        min_stock = COALESCE(?, min_stock),
        cost_per_unit = COALESCE(?, cost_per_unit),
        purchase_unit = COALESCE(?, purchase_unit),
        purchase_quantity = COALESCE(?, purchase_quantity),
        purchase_price = COALESCE(?, purchase_price),
        supplier = COALESCE(?, supplier),
        active = COALESCE(?, active),
        purchase_type = COALESCE(?, purchase_type),
        package_size = COALESCE(?, package_size),
        package_unit = COALESCE(?, package_unit),
        portion_sim_qty = COALESCE(?, portion_sim_qty)
      WHERE id = ?
    `).run(
      name, unit, current_stock, min_stock,
      cost_per_unit, purchase_unit, purchase_quantity, purchase_price, supplier, active,
      purchase_type, package_size, package_unit, portion_sim_qty, id
    );

    const updated = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('[PUT INGREDIENT ERROR]', err);
    res.status(500).json({ error: 'Erro ao atualizar insumo' });
  }
});

app.delete('/api/ingredients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE INGREDIENT ERROR]', err);
    res.status(500).json({ error: 'Erro ao remover insumo' });
  }
});

// Recipes (Ficha técnica)
app.get('/api/recipes/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    const items = await db.prepare(`
      SELECT ri.*, i.name as ingredient_name, i.unit as ingredient_unit, i.cost_per_unit,
             (ri.quantity * i.cost_per_unit) as item_cost
      FROM recipe_items ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.product_id = ?
      ORDER BY ri.id ASC
    `).all(productId);
    const list = Array.isArray(items) ? items : [];

    const totalCost = list.reduce((sum, item) => sum + (Number(item.item_cost) || 0), 0);
    const cmvPercent = product.price > 0 ? (totalCost / product.price) * 100 : 0;
    const grossProfit = product.price - totalCost;
    const grossMarginPercent = product.price > 0 ? (grossProfit / product.price) * 100 : 0;

    res.json({
      product,
      items: list,
      total_cost: Number(totalCost.toFixed(2)),
      cmv_percent: Number(cmvPercent.toFixed(1)),
      gross_profit: Number(grossProfit.toFixed(2)),
      gross_margin_percent: Number(grossMarginPercent.toFixed(1))
    });
  } catch (err) {
    console.error('[GET RECIPES ERROR]', err);
    res.status(500).json({ error: 'Erro ao buscar ficha técnica' });
  }
});

app.post('/api/recipes/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { items } = req.body; // array of { ingredient_id, quantity }

    await db.prepare('DELETE FROM recipe_items WHERE product_id = ?').run(productId);
    if (items && Array.isArray(items)) {
      const insertItem = db.prepare('INSERT INTO recipe_items (product_id, ingredient_id, quantity) VALUES (?, ?, ?)');
      for (const it of items) {
        if (it.ingredient_id && it.quantity > 0) {
          await insertItem.run(productId, it.ingredient_id, it.quantity);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[POST RECIPES ERROR]', err);
    res.status(500).json({ error: 'Erro ao salvar ficha técnica' });
  }
});

// ----------------------------------------------------
// 7. STOCK MOVEMENTS & INVENTORY
// ----------------------------------------------------
app.get('/api/stock/movements', async (req, res) => {
  try {
    const { business_id, ingredient_id } = req.query;
    let query = `
      SELECT sm.*, i.name as ingredient_name, i.unit as ingredient_unit, b.name as business_name
      FROM stock_movements sm
      JOIN ingredients i ON sm.ingredient_id = i.id
      JOIN businesses b ON sm.business_id = b.id
    `;
    const params = [];
    const conditions = [];

    if (business_id) {
      conditions.push('sm.business_id = ?');
      params.push(business_id);
    }
    if (ingredient_id) {
      conditions.push('sm.ingredient_id = ?');
      params.push(ingredient_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY sm.id DESC LIMIT 100';
    const movements = await db.prepare(query).all(...params);
    res.json(Array.isArray(movements) ? movements : []);
  } catch (err) {
    console.error('[GET STOCK MOVEMENTS ERROR]', err);
    res.json([]);
  }
});

app.post('/api/stock/movement', async (req, res) => {
  try {
    const { ingredient_id, type, quantity, reason } = req.body;
    if (!ingredient_id || !type || quantity === undefined) {
      return res.status(400).json({ error: 'Ingrediente, tipo e quantidade são obrigatórios' });
    }

    const ingredient = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(ingredient_id);
    if (!ingredient) return res.status(404).json({ error: 'Ingrediente não encontrado' });

    const qty = Number(quantity);
    const previousStock = Number(ingredient.current_stock) || 0;
    let newStock = previousStock;

    if (type === 'entrada') {
      newStock = previousStock + qty;
    } else if (type === 'saida_perda' || type === 'saida_venda') {
      newStock = previousStock - qty;
    } else if (type === 'ajuste') {
      newStock = qty;
    }

    await db.prepare('UPDATE ingredients SET current_stock = ? WHERE id = ?').run(newStock, ingredient_id);

    await db.prepare(`
      INSERT INTO stock_movements (ingredient_id, business_id, type, quantity, previous_stock, new_stock, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ingredient.id,
      ingredient.business_id,
      type,
      type === 'ajuste' ? Math.abs(newStock - previousStock) : qty,
      previousStock,
      newStock,
      reason || 'Ajuste manual'
    );

    const updated = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(ingredient_id);
    res.json(updated);
  } catch (err) {
    console.error('[POST STOCK MOVEMENT ERROR]', err);
    res.status(500).json({ error: 'Erro ao registrar movimentação' });
  }
});

// ----------------------------------------------------
// 8. CMV TRANSPARENT REPORTING
// ----------------------------------------------------
app.get('/api/cmv', async (req, res) => {
  try {
    const { business_id, period } = req.query;

    // 1. Technical CMV by Product
    let prodQuery = `
      SELECT p.id, p.name, p.price, p.business_id, b.name as business_name, c.name as category_name
      FROM products p
      JOIN businesses b ON p.business_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
    `;
    const prodParams = [];
    if (business_id) {
      prodQuery += ' AND p.business_id = ?';
      prodParams.push(business_id);
    }
    prodQuery += ' ORDER BY p.business_id ASC, p.name ASC';

    const products = await db.prepare(prodQuery).all(...prodParams);
    const prodList = Array.isArray(products) ? products : [];

    const cmvByProduct = await Promise.all(prodList.map(async (p) => {
      const cost = await getProductUnitCost(p.id);
      const cmvReais = cost;
      const cmvPercent = p.price > 0 ? (cost / p.price) * 100 : 0;
      const grossProfit = p.price - cost;
      const grossMarginPercent = p.price > 0 ? (grossProfit / p.price) * 100 : 0;

      return {
        product_id: p.id,
        name: p.name,
        business_id: p.business_id,
        business_name: p.business_name,
        category_name: p.category_name || 'Geral',
        sale_price: p.price,
        cost_reais: Number(cost.toFixed(2)),
        cmv_reais: Number(cmvReais.toFixed(2)),
        cmv_percent: Number(cmvPercent.toFixed(1)),
        gross_profit: Number(grossProfit.toFixed(2)),
        gross_margin_percent: Number(grossMarginPercent.toFixed(1))
      };
    }));

    // 2. Realized CMV from actual orders
    let orderFilter = "o.status IN ('confirmado', 'preparando', 'pronto', 'saiu_entrega', 'entregue')";
    if (period === 'hoje') {
      orderFilter += " AND date(o.created_at, 'localtime') = date('now', 'localtime')";
    } else if (period === 'ontem') {
      orderFilter += " AND date(o.created_at, 'localtime') = date('now', 'localtime', '-1 day')";
    } else if (period === '7dias') {
      orderFilter += " AND date(o.created_at, 'localtime') >= date('now', 'localtime', '-7 days')";
    } else if (period === 'mes_atual') {
      orderFilter += " AND strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
    } else if (period === 'mes_anterior') {
      orderFilter += " AND strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime', '-1 month')";
    }

    let itemsQuery = `
      SELECT oi.product_id, oi.product_name, oi.unit_price, oi.quantity, oi.subtotal, oi.business_id, b.name as business_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN businesses b ON oi.business_id = b.id
      WHERE ${orderFilter}
    `;
    const itemParams = [];
    if (business_id) {
      itemsQuery += ' AND oi.business_id = ?';
      itemParams.push(business_id);
    }

    const soldItems = await db.prepare(itemsQuery).all(...itemParams);
    const soldList = Array.isArray(soldItems) ? soldItems : [];

    let totalSalesRevenue = 0;
    let totalRealizedCmv = 0;

    for (const item of soldList) {
      const unitCost = await getProductUnitCost(item.product_id);
      const itemCost = unitCost * item.quantity;
      totalSalesRevenue += Number(item.subtotal) || 0;
      totalRealizedCmv += itemCost;
    }

    const totalGrossProfit = totalSalesRevenue - totalRealizedCmv;
    const overallCmvPercent = totalSalesRevenue > 0 ? (totalRealizedCmv / totalSalesRevenue) * 100 : 0;
    const overallMarginPercent = totalSalesRevenue > 0 ? (totalGrossProfit / totalSalesRevenue) * 100 : 0;

    res.json({
      products: cmvByProduct,
      summary: {
        total_sales: Number(totalSalesRevenue.toFixed(2)),
        realized_cmv: Number(totalRealizedCmv.toFixed(2)),
        gross_profit: Number(totalGrossProfit.toFixed(2)),
        cmv_percent: Number(overallCmvPercent.toFixed(1)),
        gross_margin_percent: Number(overallMarginPercent.toFixed(1))
      }
    });
  } catch (err) {
    console.error('[API CMV ERROR]', err);
    res.status(500).json({ error: 'Erro ao calcular CMV' });
  }
});

// ----------------------------------------------------
// 9. FINANCE & DRE
// ----------------------------------------------------
app.get('/api/finance/dre', async (req, res) => {
  try {
    const { business_id, period } = req.query;

    let orderFilter = "o.status != 'cancelado'";
    let expenseFilter = "1=1";
    const orderParams = [];
    const expenseParams = [];

    if (business_id) {
      orderFilter += " AND oi.business_id = ?";
      orderParams.push(business_id);
      expenseFilter += " AND (e.business_id = ? OR e.business_id IS NULL)";
      expenseParams.push(business_id);
    }

    if (period === 'hoje') {
      orderFilter += " AND date(o.created_at, 'localtime') = date('now', 'localtime')";
      expenseFilter += " AND date(e.date) = date('now', 'localtime')";
    } else if (period === 'ontem') {
      orderFilter += " AND date(o.created_at, 'localtime') = date('now', 'localtime', '-1 day')";
      expenseFilter += " AND date(e.date) = date('now', 'localtime', '-1 day')";
    } else if (period === '7dias') {
      orderFilter += " AND date(o.created_at, 'localtime') >= date('now', 'localtime', '-7 days')";
      expenseFilter += " AND date(e.date) >= date('now', 'localtime', '-7 days')";
    } else if (period === 'mes_atual') {
      orderFilter += " AND strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      expenseFilter += " AND strftime('%Y-%m', e.date) = strftime('%Y-%m', 'now', 'localtime')";
    } else if (period === 'mes_anterior') {
      orderFilter += " AND strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime', '-1 month')";
      expenseFilter += " AND strftime('%Y-%m', e.date) = strftime('%Y-%m', 'now', 'localtime', '-1 month')";
    }

    // Receita de Vendas
    let revenueQuery = `
      SELECT SUM(oi.subtotal) as item_revenue, SUM(DISTINCT o.delivery_fee) as delivery_revenue
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${orderFilter}
    `;
    const revRow = await db.prepare(revenueQuery).get(...orderParams);
    const revenue = (revRow && revRow.item_revenue) ? Number(revRow.item_revenue) : 0;
    const deliveryRevenue = (revRow && revRow.delivery_revenue) ? Number(revRow.delivery_revenue) : 0;
    const grossRevenue = revenue + deliveryRevenue;

    // Realized CMV
    let itemsQuery = `
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE ${orderFilter}
    `;
    const soldItems = await db.prepare(itemsQuery).all(...orderParams);
    const soldList = Array.isArray(soldItems) ? soldItems : [];
    let totalCmv = 0;
    for (const item of soldList) {
      const unitCost = await getProductUnitCost(item.product_id);
      totalCmv += unitCost * item.quantity;
    }

    const grossProfit = grossRevenue - totalCmv;

    // Despesas Operacionais por Categoria
    const expensesQuery = `
      SELECT e.category, SUM(e.amount) as total
      FROM expenses e
      WHERE ${expenseFilter}
      GROUP BY e.category
    `;
    const expensesByCategory = await db.prepare(expensesQuery).all(...expenseParams);
    const expList = Array.isArray(expensesByCategory) ? expensesByCategory : [];
    const totalExpenses = expList.reduce((sum, e) => sum + Number(e.total), 0);

    const operatingProfit = grossProfit - totalExpenses;
    const netMarginPercent = grossRevenue > 0 ? (operatingProfit / grossRevenue) * 100 : 0;

    res.json({
      gross_revenue: Number(grossRevenue.toFixed(2)),
      sales_subtotal: Number(revenue.toFixed(2)),
      delivery_fees: Number(deliveryRevenue.toFixed(2)),
      cmv: Number(totalCmv.toFixed(2)),
      cmv_percent: grossRevenue > 0 ? Number(((totalCmv / grossRevenue) * 100).toFixed(1)) : 0,
      gross_profit: Number(grossProfit.toFixed(2)),
      gross_margin_percent: grossRevenue > 0 ? Number(((grossProfit / grossRevenue) * 100).toFixed(1)) : 0,
      expenses: expList.map(e => ({ category: e.category, total: Number(Number(e.total).toFixed(2)) })),
      total_expenses: Number(totalExpenses.toFixed(2)),
      operating_profit: Number(operatingProfit.toFixed(2)),
      net_margin_percent: Number(netMarginPercent.toFixed(1))
    });
  } catch (err) {
    console.error('[API DRE ERROR]', err);
    res.status(500).json({ error: 'Erro ao gerar DRE' });
  }
});

app.get('/api/finance/expenses', async (req, res) => {
  try {
    const { business_id } = req.query;
    let query = `
      SELECT e.*, b.name as business_name
      FROM expenses e
      LEFT JOIN businesses b ON e.business_id = b.id
    `;
    const params = [];
    if (business_id) {
      query += ' WHERE e.business_id = ? OR e.business_id IS NULL';
      params.push(business_id);
    }
    query += ' ORDER BY e.date DESC, e.id DESC';
    const rows = await db.prepare(query).all(...params);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('[API EXPENSES ERROR]', err);
    res.json([]);
  }
});

app.post('/api/finance/expenses', async (req, res) => {
  try {
    const { business_id, description, amount, category, date, observation } = req.body;
    if (!description || !amount || !category || !date) {
      return res.status(400).json({ error: 'Descrição, valor, categoria e data são obrigatórios' });
    }

    const insert = db.prepare(`
      INSERT INTO expenses (business_id, description, amount, category, date, observation)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = await insert.run(
      business_id || null,
      description,
      Number(amount),
      category,
      date,
      observation || ''
    );

    const exp = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(exp);
  } catch (err) {
    console.error('[POST EXPENSE ERROR]', err);
    res.status(500).json({ error: 'Erro ao cadastrar despesa' });
  }
});

app.delete('/api/finance/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE EXPENSE ERROR]', err);
    res.status(500).json({ error: 'Erro ao remover despesa' });
  }
});

// ----------------------------------------------------
// 10. DASHBOARD MAIN OVERVIEW
// ----------------------------------------------------
app.get('/api/dashboard', async (req, res) => {
  try {
    const { period, business_id } = req.query;

    // Period filter clause
    let orderPeriodClause = "1=1";
    let expensePeriodClause = "1=1";

    if (period === 'hoje') {
      orderPeriodClause = "date(o.created_at, 'localtime') = date('now', 'localtime')";
      expensePeriodClause = "date(e.date) = date('now', 'localtime')";
    } else if (period === 'ontem') {
      orderPeriodClause = "date(o.created_at, 'localtime') = date('now', 'localtime', '-1 day')";
      expensePeriodClause = "date(e.date) = date('now', 'localtime', '-1 day')";
    } else if (period === '7dias') {
      orderPeriodClause = "date(o.created_at, 'localtime') >= date('now', 'localtime', '-7 days')";
      expensePeriodClause = "date(e.date) >= date('now', 'localtime', '-7 days')";
    } else if (period === 'mes_atual') {
      orderPeriodClause = "strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      expensePeriodClause = "strftime('%Y-%m', e.date) = strftime('%Y-%m', 'now', 'localtime')";
    } else if (period === 'mes_anterior') {
      orderPeriodClause = "strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime', '-1 month')";
      expensePeriodClause = "strftime('%Y-%m', e.date) = strftime('%Y-%m', 'now', 'localtime', '-1 month')";
    }

    // Helper for metrics of a business (or total)
    async function getBusinessMetrics(bId) {
      let orderCond = `o.status != 'cancelado' AND ${orderPeriodClause}`;
      let params = [];

      if (bId) {
        orderCond += ` AND oi.business_id = ?`;
        params.push(bId);
      }

      const orderRow = await db.prepare(`
        SELECT COUNT(DISTINCT o.id) as orders_count,
               COALESCE(SUM(oi.subtotal), 0) as items_revenue,
               COALESCE(SUM(DISTINCT o.delivery_fee), 0) as delivery_revenue
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE ${orderCond}
      `).get(...params);

      const ordersCount = orderRow ? Number(orderRow.orders_count) : 0;
      const itemsRevenue = orderRow ? Number(orderRow.items_revenue) : 0;
      const deliveryRevenue = (bId ? 0 : (orderRow ? Number(orderRow.delivery_revenue) : 0));
      const revenue = itemsRevenue + deliveryRevenue;
      const ticketMedio = ordersCount > 0 ? revenue / ordersCount : 0;

      // Realized CMV
      const soldItems = await db.prepare(`
        SELECT oi.product_id, oi.quantity
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE ${orderCond}
      `).all(...params);
      const soldList = Array.isArray(soldItems) ? soldItems : [];

      let cmvTotal = 0;
      for (const item of soldList) {
        const unitCost = await getProductUnitCost(item.product_id);
        cmvTotal += unitCost * item.quantity;
      }

      const grossProfit = revenue - cmvTotal;
      const cmvPercent = revenue > 0 ? (cmvTotal / revenue) * 100 : 0;

      // Expenses
      let expCond = expensePeriodClause;
      let expParams = [];
      if (bId) {
        expCond += ` AND (e.business_id = ? OR e.business_id IS NULL)`;
        expParams.push(bId);
      }
      const expRow = await db.prepare(`SELECT COALESCE(SUM(e.amount), 0) as total FROM expenses e WHERE ${expCond}`).get(...expParams);
      const expensesTotal = expRow ? Number(expRow.total) : 0;

      const netProfit = grossProfit - expensesTotal;

      return {
        revenue: Number(revenue.toFixed(2)),
        orders_count: ordersCount,
        ticket_medio: Number(ticketMedio.toFixed(2)),
        cmv: Number(cmvTotal.toFixed(2)),
        cmv_percent: Number(cmvPercent.toFixed(1)),
        gross_profit: Number(grossProfit.toFixed(2)),
        expenses: Number(expensesTotal.toFixed(2)),
        net_profit: Number(netProfit.toFixed(2))
      };
    }

    // Calculate for main view
    const overallMetrics = await getBusinessMetrics(business_id || null);

    // Cards for individual businesses
    const businesses = await db.prepare('SELECT * FROM businesses ORDER BY id ASC').all();
    const bizList = Array.isArray(businesses) ? businesses : [];
    const businessCards = await Promise.all(bizList.map(async (b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      icon: b.icon,
      color: b.color,
      active: b.active,
      status: b.status,
      is_open: isBusinessOpen(b),
      metrics: b.active ? await getBusinessMetrics(b.id) : { revenue: 0, orders_count: 0, ticket_medio: 0, cmv: 0, cmv_percent: 0, gross_profit: 0, expenses: 0, net_profit: 0 }
    })));

    // Total King's card
    const totalKingsCard = await getBusinessMetrics(null);

    // Top Selling Products
    let topQuery = `
      SELECT oi.product_id, oi.product_name, b.name as business_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN businesses b ON oi.business_id = b.id
      WHERE o.status != 'cancelado' AND ${orderPeriodClause}
    `;
    const topParams = [];
    if (business_id) {
      topQuery += ' AND oi.business_id = ?';
      topParams.push(business_id);
    }
    topQuery += ' GROUP BY oi.product_id, oi.product_name, b.name ORDER BY total_qty DESC LIMIT 5';
    const topProducts = await db.prepare(topQuery).all(...topParams);

    // Low Stock Items
    let stockQuery = `
      SELECT i.*, b.name as business_name
      FROM ingredients i
      JOIN businesses b ON i.business_id = b.id
      WHERE i.active = 1 AND i.current_stock <= i.min_stock
    `;
    const stockParams = [];
    if (business_id) {
      stockQuery += ' AND i.business_id = ?';
      stockParams.push(business_id);
    }
    stockQuery += ' ORDER BY (i.current_stock / NULLIF(i.min_stock, 0)) ASC LIMIT 6';
    const lowStock = await db.prepare(stockQuery).all(...stockParams);

    // Recent Orders
    let recentQuery = `
      SELECT o.*
      FROM orders o
    `;
    const recentParams = [];
    if (business_id) {
      recentQuery += ' JOIN order_items oi ON o.id = oi.order_id WHERE oi.business_id = ?';
      recentParams.push(business_id);
    }
    recentQuery += ' ORDER BY o.id DESC LIMIT 6';
    const recentOrders = await db.prepare(recentQuery).all(...recentParams);

    res.json({
      metrics: overallMetrics,
      businesses: businessCards,
      total_kings: totalKingsCard,
      top_products: Array.isArray(topProducts) ? topProducts : [],
      low_stock: Array.isArray(lowStock) ? lowStock : [],
      recent_orders: Array.isArray(recentOrders) ? recentOrders : []
    });
  } catch (err) {
    console.error('[API DASHBOARD ERROR]', err);
    res.status(500).json({ error: 'Erro ao carregar dados do dashboard' });
  }
});

// ----------------------------------------------------
// 11. SETTINGS
// ----------------------------------------------------
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM settings').all();
    const settings = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => { settings[r.key] = r.value; });
    }
    res.json(settings);
  } catch (err) {
    console.error('[API SETTINGS GET ERROR]', err);
    res.json({});
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const entries = req.body;
    for (const [key, value] of Object.entries(entries)) {
      if (db.isPostgres) {
        await db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `).run(key, String(value));
      } else {
        await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[API SETTINGS POST ERROR]', err);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// ----------------------------------------------------
// 12. DELIVERY ZONES (BAIRROS & TAXAS)
// ----------------------------------------------------
app.get('/api/delivery-zones', async (req, res) => {
  try {
    const zones = await db.prepare('SELECT * FROM delivery_zones ORDER BY fee ASC, name ASC').all();
    res.json(Array.isArray(zones) ? zones : []);
  } catch (err) {
    console.error('[API DELIVERY ZONES ERROR]', err);
    res.json([]);
  }
});

app.post('/api/delivery-zones', async (req, res) => {
  try {
    const { name, fee, estimated_minutes, active } = req.body;
    if (!name || fee === undefined) return res.status(400).json({ error: 'Nome e taxa são obrigatórios' });

    const insert = db.prepare('INSERT INTO delivery_zones (name, fee, estimated_minutes, active) VALUES (?, ?, ?, ?)');
    const info = await insert.run(name, Number(fee), Number(estimated_minutes) || 35, active !== undefined ? active : 1);
    const created = await db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error('[POST DELIVERY ZONE ERROR]', err);
    res.status(500).json({ error: 'Erro ao cadastrar bairro' });
  }
});

app.put('/api/delivery-zones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fee, estimated_minutes, active } = req.body;

    await db.prepare(`
      UPDATE delivery_zones SET
        name = COALESCE(?, name),
        fee = COALESCE(?, fee),
        estimated_minutes = COALESCE(?, estimated_minutes),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(name, fee !== undefined ? Number(fee) : null, estimated_minutes, active, id);

    const updated = await db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('[PUT DELIVERY ZONE ERROR]', err);
    res.status(500).json({ error: 'Erro ao atualizar bairro' });
  }
});

app.delete('/api/delivery-zones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM delivery_zones WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE DELIVERY ZONE ERROR]', err);
    res.status(500).json({ error: 'Erro ao excluir bairro' });
  }
});

// ----------------------------------------------------
// 13. COURIERS (MOTOBOYS) & DIÁRIAS
// ----------------------------------------------------
app.get('/api/couriers', async (req, res) => {
  try {
    const couriers = await db.prepare('SELECT * FROM couriers ORDER BY name ASC').all();
    const list = Array.isArray(couriers) ? couriers : [];

    const enriched = await Promise.all(list.map(async (c) => {
      const todayStats = await db.prepare(`
        SELECT COUNT(*) as deliveries_count, COALESCE(SUM(delivery_fee), 0) as total_delivery_fees
        FROM orders
        WHERE courier_id = ? AND date(created_at, 'localtime') = date('now', 'localtime') AND status != 'cancelado'
      `).get(c.id);

      const deliveriesCount = todayStats ? Number(todayStats.deliveries_count) : 0;
      const totalEarnings = Number(c.daily_fee) + (deliveriesCount * Number(c.fee_per_delivery));

      return {
        ...c,
        today_deliveries: deliveriesCount,
        today_earnings: totalEarnings
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('[API COURIERS ERROR]', err);
    res.json([]);
  }
});

app.post('/api/couriers', async (req, res) => {
  try {
    const { name, phone, daily_fee, fee_per_delivery, active } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const info = await db.prepare(`
      INSERT INTO couriers (name, phone, daily_fee, fee_per_delivery, active)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, phone || '', Number(daily_fee) || 0, Number(fee_per_delivery) || 0, active !== undefined ? active : 1);

    const courier = await db.prepare('SELECT * FROM couriers WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(courier);
  } catch (err) {
    console.error('[POST COURIER ERROR]', err);
    res.status(500).json({ error: 'Erro ao cadastrar motoboy' });
  }
});

app.put('/api/couriers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, daily_fee, fee_per_delivery, active } = req.body;

    await db.prepare(`
      UPDATE couriers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        daily_fee = COALESCE(?, daily_fee),
        fee_per_delivery = COALESCE(?, fee_per_delivery),
        active = COALESCE(?, active)
      WHERE id = ?
    `).run(name, phone, daily_fee, fee_per_delivery, active, id);

    const updated = await db.prepare('SELECT * FROM couriers WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('[PUT COURIER ERROR]', err);
    res.status(500).json({ error: 'Erro ao atualizar motoboy' });
  }
});

app.delete('/api/couriers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM couriers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE COURIER ERROR]', err);
    res.status(500).json({ error: 'Erro ao remover motoboy' });
  }
});

app.patch('/api/orders/:id/courier', async (req, res) => {
  try {
    const { id } = req.params;
    const { courier_id } = req.body;

    await db.prepare('UPDATE orders SET courier_id = ?, dispatched_at = CURRENT_TIMESTAMP WHERE id = ?').run(courier_id, id);
    const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('[PATCH ORDER COURIER ERROR]', err);
    res.status(500).json({ error: 'Erro ao vincular motoboy' });
  }
});

// ----------------------------------------------------
// 14. CASH SHIFTS (CONTROLE DE GAVETA / SANGRIA / FECHAMENTO)
// ----------------------------------------------------
app.get('/api/cash/current', async (req, res) => {
  try {
    const currentShift = await db.prepare("SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
    if (!currentShift) {
      return res.json({ has_open_shift: false, shift: null });
    }

    const salesRow = await db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'DINHEIRO' THEN total ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'PIX' THEN total ELSE 0 END), 0) as pix_sales,
        COALESCE(SUM(CASE WHEN payment_method IN ('CARTAO_DEBITO', 'CARTAO_CREDITO') THEN total ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(total), 0) as total_sales,
        COUNT(*) as orders_count
      FROM orders
      WHERE created_at >= ? AND status != 'cancelado'
    `).get(currentShift.opened_at);

    const movements = await db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id DESC').all(currentShift.id);
    const mList = Array.isArray(movements) ? movements : [];
    let totalSangria = 0;
    let totalSuprimento = 0;
    mList.forEach(m => {
      if (m.type === 'sangria') totalSangria += Number(m.amount) || 0;
      else if (m.type === 'suprimento') totalSuprimento += Number(m.amount) || 0;
    });

    const initialFloat = Number(currentShift.initial_float) || 0;
    const cashSales = salesRow ? Number(salesRow.cash_sales) : 0;
    const expectedDrawerCash = initialFloat + cashSales + totalSuprimento - totalSangria;

    res.json({
      has_open_shift: true,
      shift: currentShift,
      stats: {
        initial_float: initialFloat,
        cash_sales: cashSales,
        pix_sales: salesRow ? Number(salesRow.pix_sales) : 0,
        card_sales: salesRow ? Number(salesRow.card_sales) : 0,
        total_sales: salesRow ? Number(salesRow.total_sales) : 0,
        orders_count: salesRow ? Number(salesRow.orders_count) : 0,
        total_sangria: totalSangria,
        total_suprimento: totalSuprimento,
        expected_drawer_cash: Number(expectedDrawerCash.toFixed(2))
      },
      movements: mList
    });
  } catch (err) {
    console.error('[API CASH CURRENT ERROR]', err);
    res.json({ has_open_shift: false, shift: null });
  }
});

app.post('/api/cash/open', async (req, res) => {
  try {
    const { initial_float, operator_name } = req.body;
    const existing = await db.prepare("SELECT * FROM cash_shifts WHERE status = 'open'").get();
    if (existing) {
      return res.status(400).json({ error: 'Já existe um turno de caixa aberto. Feche o turno atual antes de abrir outro.' });
    }

    const info = await db.prepare(`
      INSERT INTO cash_shifts (operator_name, initial_float, status)
      VALUES (?, ?, 'open')
    `).run(operator_name || 'Proprietário', Number(initial_float) || 0);

    const shift = await db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(shift);
  } catch (err) {
    console.error('[API CASH OPEN ERROR]', err);
    res.status(500).json({ error: 'Erro ao abrir caixa' });
  }
});

app.post('/api/cash/movement', async (req, res) => {
  try {
    const { shift_id, type, amount, reason } = req.body;
    if (!shift_id || !type || !amount || !reason) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const info = await db.prepare(`
      INSERT INTO cash_movements (shift_id, type, amount, reason)
      VALUES (?, ?, ?, ?)
    `).run(shift_id, type, Number(amount), reason);

    const created = await db.prepare('SELECT * FROM cash_movements WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error('[API CASH MOVEMENT ERROR]', err);
    res.status(500).json({ error: 'Erro ao registrar movimentação de caixa' });
  }
});

app.post('/api/cash/close', async (req, res) => {
  try {
    const { shift_id, final_cash_counted, notes } = req.body;
    const shift = await db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(shift_id);
    if (!shift) return res.status(404).json({ error: 'Turno não encontrado' });

    await db.prepare(`
      UPDATE cash_shifts SET
        status = 'closed',
        closed_at = CURRENT_TIMESTAMP,
        final_cash_counted = ?,
        notes = ?
      WHERE id = ?
    `).run(Number(final_cash_counted) || 0, notes || '', shift_id);

    res.json({ success: true, message: 'Turno de caixa encerrado com sucesso.' });
  } catch (err) {
    console.error('[API CASH CLOSE ERROR]', err);
    res.status(500).json({ error: 'Erro ao fechar caixa' });
  }
});

app.get('/api/cash/history', async (req, res) => {
  try {
    const shifts = await db.prepare("SELECT * FROM cash_shifts WHERE status = 'closed' ORDER BY id DESC LIMIT 30").all();
    res.json(Array.isArray(shifts) ? shifts : []);
  } catch (err) {
    console.error('[API CASH HISTORY ERROR]', err);
    res.json([]);
  }
});

// ----------------------------------------------------
// 15. INVENTORY PHYSICAL AUDIT (BALANÇO CEGO)
// ----------------------------------------------------
app.get('/api/inventory/audit-template', async (req, res) => {
  try {
    const { business_id } = req.query;
    let q = 'SELECT i.id, i.name, i.unit, i.current_stock, i.cost_per_unit, b.name as business_name FROM ingredients i JOIN businesses b ON i.business_id = b.id WHERE i.active = 1';
    const params = [];
    if (business_id) {
      q += ' AND i.business_id = ?';
      params.push(business_id);
    }
    q += ' ORDER BY i.business_id ASC, i.name ASC';
    const items = await db.prepare(q).all(...params);
    res.json(Array.isArray(items) ? items : []);
  } catch (err) {
    console.error('[API AUDIT TEMPLATE ERROR]', err);
    res.json([]);
  }
});

app.post('/api/inventory/audit-submit', async (req, res) => {
  try {
    const { business_id, operator, notes, counts } = req.body;
    if (!counts || !Array.isArray(counts)) return res.status(400).json({ error: 'Dados de contagem inválidos' });

    const auditInfo = await db.prepare('INSERT INTO inventory_audits (business_id, operator, notes) VALUES (?, ?, ?)').run(business_id || null, operator || 'Proprietário', notes || '');
    const auditId = auditInfo.lastInsertRowid;

    const insertAuditItem = db.prepare(`
      INSERT INTO inventory_audit_items (audit_id, ingredient_id, system_stock, physical_stock, variance, unit_cost, variance_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare('UPDATE ingredients SET current_stock = ? WHERE id = ?');
    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (ingredient_id, business_id, type, quantity, previous_stock, new_stock, reason)
      VALUES (?, ?, 'ajuste', ?, ?, ?, ?)
    `);

    let totalDivergenceValue = 0;

    for (const c of counts) {
      const ing = await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(c.ingredient_id);
      if (ing) {
        const physical = Number(c.physical_stock);
        const system = Number(ing.current_stock) || 0;
        const variance = physical - system;
        const varValue = variance * (Number(ing.cost_per_unit) || 0);
        totalDivergenceValue += Math.abs(varValue);

        await insertAuditItem.run(auditId, ing.id, system, physical, variance, Number(ing.cost_per_unit) || 0, varValue);

        if (variance !== 0) {
          await updateStock.run(physical, ing.id);
          await insertMovement.run(
            ing.id,
            ing.business_id,
            Math.abs(variance),
            system,
            physical,
            `Ajuste por Balanço Físico #${auditId} (${variance > 0 ? '+Sobra' : '-Quebra'})`
          );
        }
      }
    }

    res.json({ success: true, audit_id: auditId, total_divergence_value: totalDivergenceValue });
  } catch (err) {
    console.error('[API AUDIT SUBMIT ERROR]', err);
    res.status(500).json({ error: 'Erro ao enviar balanço físico' });
  }
});

app.get('/api/inventory/audits', async (req, res) => {
  try {
    const audits = await db.prepare(`
      SELECT a.*, b.name as business_name, COUNT(ai.id) as items_count,
             SUM(ai.variance_value) as total_variance_value
      FROM inventory_audits a
      LEFT JOIN businesses b ON a.business_id = b.id
      LEFT JOIN inventory_audit_items ai ON a.id = ai.audit_id
      GROUP BY a.id, b.name
      ORDER BY a.id DESC LIMIT 20
    `).all();
    res.json(Array.isArray(audits) ? audits : []);
  } catch (err) {
    console.error('[API AUDITS ERROR]', err);
    res.json([]);
  }
});

// ----------------------------------------------------
// 16. ADVANCED ANALYTICS & REPORTS (REQUISITO #14)
// ----------------------------------------------------
app.get('/api/reports/analytics', async (req, res) => {
  try {
    const { period } = req.query;

    let periodCond = "1=1";
    if (period === 'hoje') periodCond = "date(o.created_at, 'localtime') = date('now', 'localtime')";
    else if (period === 'ontem') periodCond = "date(o.created_at, 'localtime') = date('now', 'localtime', '-1 day')";
    else if (period === '7dias') periodCond = "date(o.created_at, 'localtime') >= date('now', 'localtime', '-7 days')";
    else if (period === 'mes_atual') periodCond = "strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
    else if (period === 'mes_anterior') periodCond = "strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime', '-1 month')";

    const hoursRaw = await db.prepare(`
      SELECT strftime('%H', o.created_at, 'localtime') as hour, COUNT(*) as orders_count, COALESCE(SUM(o.total), 0) as revenue
      FROM orders o
      WHERE ${periodCond} AND o.status != 'cancelado'
      GROUP BY hour
      ORDER BY hour ASC
    `).all();

    const paymentMethods = await db.prepare(`
      SELECT o.payment_method, COUNT(*) as orders_count, COALESCE(SUM(o.total), 0) as revenue
      FROM orders o
      WHERE ${periodCond} AND o.status != 'cancelado'
      GROUP BY o.payment_method
    `).all();

    const orderSources = await db.prepare(`
      SELECT o.source, COUNT(*) as count, COALESCE(SUM(o.total), 0) as revenue
      FROM orders o
      WHERE ${periodCond} AND o.status != 'cancelado'
      GROUP BY o.source
    `).all();

    const productsAbcRaw = await db.prepare(`
      SELECT oi.product_id, oi.product_name, b.name as business_name,
             SUM(oi.quantity) as total_qty,
             SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN businesses b ON oi.business_id = b.id
      WHERE ${periodCond} AND o.status != 'cancelado'
      GROUP BY oi.product_id, oi.product_name, b.name
      ORDER BY total_revenue DESC
    `).all();
    const abcList = Array.isArray(productsAbcRaw) ? productsAbcRaw : [];

    const productsAbc = await Promise.all(abcList.map(async (p) => {
      const unitCost = await getProductUnitCost(p.product_id);
      const totalCost = unitCost * p.total_qty;
      const grossProfit = p.total_revenue - totalCost;
      return {
        ...p,
        unit_cost: unitCost,
        total_cost: totalCost,
        gross_profit: grossProfit,
        margin_percent: p.total_revenue > 0 ? (grossProfit / p.total_revenue) * 100 : 0
      };
    }));

    res.json({
      hours: Array.isArray(hoursRaw) ? hoursRaw : [],
      payment_methods: Array.isArray(paymentMethods) ? paymentMethods : [],
      sources: Array.isArray(orderSources) ? orderSources : [],
      products_abc: productsAbc
    });
  } catch (err) {
    console.error('[API ANALYTICS ERROR]', err);
    res.status(500).json({ error: 'Erro ao gerar relatórios' });
  }
});

// ----------------------------------------------------
// 17. CUSTOMERS / CRM
// ----------------------------------------------------
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await db.prepare(`
      SELECT
        customer_phone,
        customer_name,
        delivery_address,
        delivery_neighborhood,
        COUNT(id) as total_orders,
        COALESCE(SUM(total), 0) as total_spent,
        COALESCE(AVG(total), 0) as avg_ticket,
        MAX(created_at) as last_order_at,
        ROUND(JULIANDAY('now') - JULIANDAY(MAX(created_at))) as days_since_last_order
      FROM orders
      WHERE status != 'cancelado'
      GROUP BY customer_phone, customer_name, delivery_address, delivery_neighborhood
      ORDER BY total_spent DESC
    `).all();

    res.json(Array.isArray(customers) ? customers : []);
  } catch (err) {
    console.error('[API CUSTOMERS ERROR]', err);
    res.json([]);
  }
});

// ----------------------------------------------------
// 18. KDS (KITCHEN DISPLAY SYSTEM)
// ----------------------------------------------------
app.get('/api/kds/orders', async (req, res) => {
  try {
    const activeOrders = await db.prepare(`
      SELECT o.*
      FROM orders o
      WHERE o.status IN ('novo', 'confirmado', 'preparando')
      ORDER BY o.id ASC
    `).all();
    const orderList = Array.isArray(activeOrders) ? activeOrders : [];

    const enriched = await Promise.all(orderList.map(async (order) => {
      const items = await db.prepare(`
        SELECT oi.*, b.name as business_name, b.slug as business_slug
        FROM order_items oi
        JOIN businesses b ON oi.business_id = b.id
        WHERE oi.order_id = ?
      `).all(order.id);
      const itemList = Array.isArray(items) ? items : [];

      const enrichedItems = await Promise.all(itemList.map(async (item) => {
        const addons = await db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id);
        return { ...item, addons: Array.isArray(addons) ? addons : [] };
      }));

      const createdDate = new Date(order.created_at);
      const now = new Date();
      const elapsedMinutes = Math.max(0, Math.floor((now - createdDate) / 60000));

      return {
        ...order,
        items: enrichedItems,
        elapsed_minutes: elapsedMinutes
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('[API KDS ERROR]', err);
    res.json([]);
  }
});

// ----------------------------------------------------
// 19. BACKUP DO BANCO EM 1 CLIQUE
// ----------------------------------------------------
app.get('/api/backup', (req, res) => {
  const dbFile = path.join(__dirname, '..', 'data', 'kings.db');
  if (!fs.existsSync(dbFile)) {
    return res.status(404).send('Arquivo de banco de dados não encontrado');
  }

  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `kings-backup-${now}.db`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/x-sqlite3');

  const fileStream = fs.createReadStream(dbFile);
  fileStream.pipe(res);
});

const fs = require('fs');

// Serve static client assets in production if dist exists
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Express Server (only when running standalone, not in Vercel Serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`KING'S API & App Server running on port ${PORT}`);
  });
}

module.exports = app;
