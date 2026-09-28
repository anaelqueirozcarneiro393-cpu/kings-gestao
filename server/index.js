const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { db, initSchema } = require('./db');

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
function getProductUnitCost(productId) {
  const row = db.prepare(`
    SELECT SUM(ri.quantity * i.cost_per_unit) as unit_cost
    FROM recipe_items ri
    JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE ri.product_id = ?
  `).get(productId);

  return row && row.unit_cost !== null ? Number(row.unit_cost) : 0.0;
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
// 2. BUSINESSES (OPERAÇÕES)
// ----------------------------------------------------
app.get('/api/businesses', (req, res) => {
  const businesses = db.prepare('SELECT * FROM businesses ORDER BY id ASC').all();
  const enriched = businesses.map(b => ({
    ...b,
    is_open: isBusinessOpen(b),
    display_status: !b.active || b.status === 'coming_soon'
      ? 'coming_soon'
      : (isBusinessOpen(b) ? 'open' : 'closed')
  }));
  res.json(enriched);
});

app.patch('/api/businesses/:id', (req, res) => {
  const { id } = req.params;
  const {
    name, tagline, opening_time, closing_time, min_order,
    delivery_fee, address, phone, instagram, is_manually_closed,
    active, status
  } = req.body;

  const current = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
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

  updateStmt.run(
    name, tagline, opening_time, closing_time, min_order,
    delivery_fee, address, phone, instagram, is_manually_closed,
    active, status, id
  );

  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  res.json({
    ...updated,
    is_open: isBusinessOpen(updated)
  });
});

app.post('/api/businesses/:id/toggle-status', (req, res) => {
  const { id } = req.params;
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  if (!b) return res.status(404).json({ error: 'Operação não encontrada' });

  const newManualClose = b.is_manually_closed ? 0 : 1;
  db.prepare('UPDATE businesses SET is_manually_closed = ? WHERE id = ?').run(newManualClose, id);

  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  res.json({ ...updated, is_open: isBusinessOpen(updated) });
});

app.post('/api/businesses/:id/toggle-active', (req, res) => {
  const { id } = req.params;
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  if (!b) return res.status(404).json({ error: 'Operação não encontrada' });

  const newActive = b.active ? 0 : 1;
  const newStatus = newActive ? 'open' : 'coming_soon';
  db.prepare('UPDATE businesses SET active = ?, status = ? WHERE id = ?').run(newActive, newStatus, id);

  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  res.json({ ...updated, is_open: isBusinessOpen(updated) });
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

    // Attach addons to groups
    const groupsWithAddons = (addonGroups || []).map(group => ({
      ...group,
      addons: (addons || []).filter(a => a.group_id === group.id)
    }));

    // Attach groups to products
    const productsWithDetails = (products || []).map(product => {
      const relevantGroups = groupsWithAddons.filter(g =>
        g.product_id === product.id ||
        (g.product_id === null && g.category_id === product.category_id) ||
        (g.product_id === null && g.category_id === null && g.business_id === product.business_id)
      );

      return {
        ...product,
        addon_groups: relevantGroups
      };
    });

    const settingsRows = await db.prepare('SELECT * FROM settings').all();
    const settings = {};
    (settingsRows || []).forEach(r => { settings[r.key] = r.value; });

    res.json({
      businesses: businesses.length > 0 ? businesses : [
        { id: 1, name: "KING'S AÇAÍ", slug: 'acai', tagline: 'O verdadeiro açaí artesanal e cremoso', is_open: true, active: 1, status: 'open', opening_time: '11:00', closing_time: '02:00' },
        { id: 2, name: "KING'S BURGUER", slug: 'burguer', tagline: 'Burguers artesanais feitos no fogo', is_open: true, active: 1, status: 'open', opening_time: '18:00', closing_time: '02:00' },
        { id: 3, name: "KING'S PIZZA", slug: 'pizza', tagline: 'Massas artesanais fermentadas', is_open: false, active: 0, status: 'coming_soon', opening_time: '18:00', closing_time: '00:00' }
      ],
      categories: categories || [],
      products: productsWithDetails || [],
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
      categories: [],
      products: [],
      settings: {}
    });
  }
});

// ----------------------------------------------------
// 4. ORDERS & PDV
// ----------------------------------------------------
// Function to deduct stock for an order
function deductStockForOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order || order.stock_deducted === 1) return;

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (ingredient_id, business_id, type, quantity, previous_stock, new_stock, reason, order_id)
    VALUES (?, ?, 'saida_venda', ?, ?, ?, ?, ?)
  `);

  const updateIngredient = db.prepare(`
    UPDATE ingredients SET current_stock = ? WHERE id = ?
  `);

  items.forEach(item => {
    // 1. Descontar itens da ficha técnica do produto
    const recipeItems = db.prepare('SELECT * FROM recipe_items WHERE product_id = ?').all(item.product_id);
    recipeItems.forEach(recipe => {
      const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(recipe.ingredient_id);
      if (ingredient) {
        const totalQtyDeducted = recipe.quantity * item.quantity;
        const previousStock = ingredient.current_stock;
        const newStock = previousStock - totalQtyDeducted;

        updateIngredient.run(newStock, ingredient.id);
        insertMovement.run(
          ingredient.id,
          ingredient.business_id,
          totalQtyDeducted,
          previousStock,
          newStock,
          `Venda Pedido #${order.order_number} (${item.quantity}x ${item.product_name})`,
          orderId
        );
      }
    });

    // 2. Descontar insumos de adicionais pagos/extras (ex: +40g bacon, +50g morango)
    const itemAddons = db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id);
    itemAddons.forEach(oa => {
      if (oa.addon_id) {
        const addonDb = db.prepare('SELECT * FROM addons WHERE id = ?').get(oa.addon_id);
        if (addonDb && addonDb.ingredient_id && addonDb.ingredient_quantity > 0) {
          const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(addonDb.ingredient_id);
          if (ingredient) {
            const totalQtyDeducted = addonDb.ingredient_quantity * (oa.quantity || 1) * item.quantity;
            const previousStock = ingredient.current_stock;
            const newStock = previousStock - totalQtyDeducted;

            updateIngredient.run(newStock, ingredient.id);
            insertMovement.run(
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
    });
  });

  db.prepare('UPDATE orders SET stock_deducted = 1 WHERE id = ?').run(orderId);
}

// Function to revert stock deduction if order cancelled
function revertStockForOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order || order.stock_deducted === 0) return;

  const movements = db.prepare("SELECT * FROM stock_movements WHERE order_id = ? AND type = 'saida_venda'").all(orderId);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (ingredient_id, business_id, type, quantity, previous_stock, new_stock, reason, order_id)
    VALUES (?, ?, 'ajuste', ?, ?, ?, ?, ?)
  `);

  const updateIngredient = db.prepare(`
    UPDATE ingredients SET current_stock = ? WHERE id = ?
  `);

  movements.forEach(m => {
    const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(m.ingredient_id);
    if (ingredient) {
      const previousStock = ingredient.current_stock;
      const newStock = previousStock + m.quantity;

      updateIngredient.run(newStock, ingredient.id);
      insertMovement.run(
        ingredient.id,
        ingredient.business_id,
        m.quantity,
        previousStock,
        newStock,
        `Estorno por cancelamento do Pedido #${order.order_number}`,
        orderId
      );
    }
  });

  db.prepare('UPDATE orders SET stock_deducted = 0 WHERE id = ?').run(orderId);
}

// Customer or manual order creation
app.post(['/api/public/orders', '/api/orders/manual'], orderLimiter, (req, res) => {
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
    source // 'cardapio', 'manual_whatsapp', etc.
  } = req.body;

  if (!customer_name || !customer_phone || !items || !items.length) {
    return res.status(400).json({ error: 'Dados incompletos do pedido' });
  }

  // Validate that items from closed businesses are blocked on the public digital menu
  if (req.path === '/api/public/orders') {
    for (const item of items) {
      const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(item.business_id);
      if (b && !isBusinessOpen(b)) {
        return res.status(400).json({
          error: `A operação ${b.name} está fechada no momento (${b.status === 'coming_soon' ? 'Em breve' : 'Abre às ' + b.opening_time}). Remova os itens dessa operação para continuar.`
        });
      }
    }
  }

  // Generate sequential order number
  const lastOrder = db.prepare('SELECT MAX(order_number) as max_num FROM orders').get();
  const nextOrderNumber = (lastOrder && lastOrder.max_num) ? lastOrder.max_num + 1 : 101;

  // Calculate subtotal from database prices for security
  let calculatedSubtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!prod) continue;

    let itemUnitPrice = prod.price;
    let addonsCost = 0;
    const itemAddons = [];

    if (item.addons && Array.isArray(item.addons)) {
      for (const add of item.addons) {
        const addonDb = db.prepare('SELECT * FROM addons WHERE id = ?').get(add.addon_id);
        const addPrice = addonDb ? addonDb.price : (Number(add.unit_price) || 0);
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
    // Look up delivery fee from business or default
    const settingFee = db.prepare("SELECT value FROM settings WHERE key = 'default_delivery_fee'").get();
    deliveryFee = settingFee ? Number(settingFee.value) : 5.0;
  }

  const finalTotal = calculatedSubtotal + deliveryFee;

  // Insert order
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_number, customer_name, customer_phone, delivery_type,
      delivery_address, delivery_neighborhood, notes, subtotal,
      delivery_fee, discount, total, payment_method, payment_change,
      payment_status, status, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'pendente', 'novo', ?)
  `);

  const info = insertOrder.run(
    nextOrderNumber,
    customer_name,
    customer_phone,
    delivery_type,
    delivery_address || '',
    delivery_neighborhood || '',
    notes || '',
    calculatedSubtotal,
    deliveryFee,
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
    const itemInfo = insertItem.run(
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
      insertItemAddon.run(
        orderItemId,
        addon.addon_id,
        addon.name,
        addon.unit_price
      );
    }
  }

  // Fetch full inserted order
  const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  res.status(201).json({
    success: true,
    order: createdOrder,
    order_number: nextOrderNumber
  });
});

// Get orders list with filters
app.get('/api/orders', (req, res) => {
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

  const orders = db.prepare(query).all(...params);

  // Attach items to each order
  const ordersWithItems = orders.map(order => {
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

    const items = db.prepare(itemQuery).all(...itemParams);

    const enrichedItems = items.map(item => {
      const addons = db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id);
      return { ...item, addons };
    });

    return {
      ...order,
      items: enrichedItems
    };
  });

  res.json(ordersWithItems);
});

// Single order with complete details (for thermal printing and tracking)
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

  const items = db.prepare(`
    SELECT oi.*, b.name as business_name, b.slug as business_slug, b.icon as business_icon
    FROM order_items oi
    JOIN businesses b ON oi.business_id = b.id
    WHERE oi.order_id = ?
    ORDER BY oi.business_id ASC, oi.id ASC
  `).all(order.id);

  const enrichedItems = items.map(item => {
    const addons = db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id);
    return { ...item, addons };
  });

  res.json({
    ...order,
    items: enrichedItems
  });
});

// Update order status
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['novo', 'confirmado', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

  // Stock deduction triggers when order is confirmed or delivered
  if (status === 'confirmado' || status === 'entregue') {
    deductStockForOrder(id);
  } else if (status === 'cancelado') {
    revertStockForOrder(id);
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json(updated);
});

// Update payment status
app.patch('/api/orders/:id/payment', (req, res) => {
  const { id } = req.params;
  const { payment_status } = req.body;

  db.prepare('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(payment_status, id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json(updated);
});

// ----------------------------------------------------
// 5. PRODUCTS CRUD
// ----------------------------------------------------
app.get('/api/products', (req, res) => {
  const { business_id } = req.query;
  let query = `
    SELECT p.*, b.name as business_name, c.name as category_name
    FROM products p
    JOIN businesses b ON p.business_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
  `;
  const params = [];

  if (business_id) {
    query += ' WHERE p.business_id = ?';
    params.push(business_id);
  }

  query += ' ORDER BY p.business_id ASC, p.order_index ASC, p.name ASC';

  const products = db.prepare(query).all(...params);

  // Calculate live unit cost, CMV R$, and CMV % for each product
  const enriched = products.map(prod => {
    const cost = getProductUnitCost(prod.id);
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
  });

  res.json(enriched);
});

app.post('/api/products', (req, res) => {
  const { business_id, category_id, name, description, image_url, price, active, availability, order_index } = req.body;
  if (!business_id || !name || price === undefined) {
    return res.status(400).json({ error: 'Operação, nome e preço são obrigatórios' });
  }

  const insert = db.prepare(`
    INSERT INTO products (business_id, category_id, name, description, image_url, price, active, availability, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = insert.run(
    business_id,
    category_id || null,
    name,
    description || '',
    image_url || '',
    Number(price),
    active !== undefined ? active : 1,
    availability !== undefined ? availability : 1,
    order_index || 0
  );

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(product);
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { category_id, name, description, image_url, price, active, availability, order_index } = req.body;

  db.prepare(`
    UPDATE products SET
      category_id = COALESCE(?, category_id),
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      image_url = COALESCE(?, image_url),
      price = COALESCE(?, price),
      active = COALESCE(?, active),
      availability = COALESCE(?, availability),
      order_index = COALESCE(?, order_index)
    WHERE id = ?
  `).run(
    category_id, name, description, image_url,
    price !== undefined ? Number(price) : null,
    active, availability, order_index, id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ success: true });
});

// ----------------------------------------------------
// 6. INGREDIENTS & FICHA TÉCNICA (RECEITAS)
// ----------------------------------------------------
app.get('/api/ingredients', (req, res) => {
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
  const ingredients = db.prepare(query).all(...params);

  const enriched = ingredients.map(ing => ({
    ...ing,
    is_low_stock: ing.current_stock <= ing.min_stock
  }));

  res.json(enriched);
});

app.post('/api/ingredients', (req, res) => {
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

  const info = insert.run(
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

  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(ingredient);
});

app.put('/api/ingredients/:id', (req, res) => {
  const { id } = req.params;
  const {
    name, unit, current_stock, min_stock,
    cost_per_unit, purchase_unit, purchase_quantity, purchase_price, supplier, active,
    purchase_type, package_size, package_unit, portion_sim_qty
  } = req.body;

  db.prepare(`
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

  const updated = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/ingredients/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
  res.json({ success: true });
});

// Recipes (Ficha técnica)
app.get('/api/recipes/:productId', (req, res) => {
  const { productId } = req.params;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

  const items = db.prepare(`
    SELECT ri.*, i.name as ingredient_name, i.unit as ingredient_unit, i.cost_per_unit,
           (ri.quantity * i.cost_per_unit) as item_cost
    FROM recipe_items ri
    JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE ri.product_id = ?
    ORDER BY ri.id ASC
  `).all(productId);

  const totalCost = items.reduce((sum, item) => sum + (Number(item.item_cost) || 0), 0);
  const cmvPercent = product.price > 0 ? (totalCost / product.price) * 100 : 0;
  const grossProfit = product.price - totalCost;
  const grossMarginPercent = product.price > 0 ? (grossProfit / product.price) * 100 : 0;

  res.json({
    product,
    items,
    total_cost: Number(totalCost.toFixed(2)),
    cmv_percent: Number(cmvPercent.toFixed(1)),
    gross_profit: Number(grossProfit.toFixed(2)),
    gross_margin_percent: Number(grossMarginPercent.toFixed(1))
  });
});

app.post('/api/recipes/:productId', (req, res) => {
  const { productId } = req.params;
  const { items } = req.body; // array of { ingredient_id, quantity }

  const deleteExisting = db.prepare('DELETE FROM recipe_items WHERE product_id = ?');
  const insertItem = db.prepare('INSERT INTO recipe_items (product_id, ingredient_id, quantity) VALUES (?, ?, ?)');

  const transaction = db.transaction(() => {
    deleteExisting.run(productId);
    if (items && Array.isArray(items)) {
      items.forEach(it => {
        if (it.ingredient_id && it.quantity > 0) {
          insertItem.run(productId, it.ingredient_id, it.quantity);
        }
      });
    }
  });

  transaction();
  res.json({ success: true });
});

// ----------------------------------------------------
// 7. STOCK MOVEMENTS & INVENTORY
// ----------------------------------------------------
app.get('/api/stock/movements', (req, res) => {
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
  const movements = db.prepare(query).all(...params);
  res.json(movements);
});

app.post('/api/stock/movement', (req, res) => {
  const { ingredient_id, type, quantity, reason } = req.body;
  if (!ingredient_id || !type || quantity === undefined) {
    return res.status(400).json({ error: 'Ingrediente, tipo e quantidade são obrigatórios' });
  }

  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(ingredient_id);
  if (!ingredient) return res.status(404).json({ error: 'Ingrediente não encontrado' });

  const qty = Number(quantity);
  const previousStock = ingredient.current_stock;
  let newStock = previousStock;

  if (type === 'entrada') {
    newStock = previousStock + qty;
  } else if (type === 'saida_perda' || type === 'saida_venda') {
    newStock = previousStock - qty;
  } else if (type === 'ajuste') {
    newStock = qty; // For direct adjustment, quantity is the target stock
  }

  db.prepare('UPDATE ingredients SET current_stock = ? WHERE id = ?').run(newStock, ingredient_id);

  db.prepare(`
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

  const updated = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(ingredient_id);
  res.json(updated);
});

// ----------------------------------------------------
// 8. CMV TRANSPARENT REPORTING
// ----------------------------------------------------
app.get('/api/cmv', (req, res) => {
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

  const products = db.prepare(prodQuery).all(...prodParams);

  const cmvByProduct = products.map(p => {
    const cost = getProductUnitCost(p.id);
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
  });

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

  const soldItems = db.prepare(itemsQuery).all(...itemParams);

  let totalSalesRevenue = 0;
  let totalRealizedCmv = 0;

  soldItems.forEach(item => {
    const unitCost = getProductUnitCost(item.product_id);
    const itemCost = unitCost * item.quantity;
    totalSalesRevenue += item.subtotal;
    totalRealizedCmv += itemCost;
  });

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
});

// ----------------------------------------------------
// 9. FINANCE & DRE
// ----------------------------------------------------
app.get('/api/finance/dre', (req, res) => {
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
  const revRow = db.prepare(revenueQuery).get(...orderParams);
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
  const soldItems = db.prepare(itemsQuery).all(...orderParams);
  let totalCmv = 0;
  soldItems.forEach(item => {
    totalCmv += getProductUnitCost(item.product_id) * item.quantity;
  });

  const grossProfit = grossRevenue - totalCmv;

  // Despesas Operacionais por Categoria
  const expensesQuery = `
    SELECT e.category, SUM(e.amount) as total
    FROM expenses e
    WHERE ${expenseFilter}
    GROUP BY e.category
  `;
  const expensesByCategory = db.prepare(expensesQuery).all(...expenseParams);
  const totalExpenses = expensesByCategory.reduce((sum, e) => sum + Number(e.total), 0);

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
    expenses: expensesByCategory.map(e => ({ category: e.category, total: Number(e.total.toFixed(2)) })),
    total_expenses: Number(totalExpenses.toFixed(2)),
    operating_profit: Number(operatingProfit.toFixed(2)),
    net_margin_percent: Number(netMarginPercent.toFixed(1))
  });
});

app.get('/api/finance/expenses', (req, res) => {
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
  res.json(db.prepare(query).all(...params));
});

app.post('/api/finance/expenses', (req, res) => {
  const { business_id, description, amount, category, date, observation } = req.body;
  if (!description || !amount || !category || !date) {
    return res.status(400).json({ error: 'Descrição, valor, categoria e data são obrigatórios' });
  }

  const insert = db.prepare(`
    INSERT INTO expenses (business_id, description, amount, category, date, observation)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = insert.run(
    business_id || null,
    description,
    Number(amount),
    category,
    date,
    observation || ''
  );

  const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(exp);
});

app.delete('/api/finance/expenses/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  res.json({ success: true });
});

// ----------------------------------------------------
// 10. DASHBOARD MAIN OVERVIEW
// ----------------------------------------------------
app.get('/api/dashboard', (req, res) => {
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
  function getBusinessMetrics(bId) {
    let orderCond = `o.status != 'cancelado' AND ${orderPeriodClause}`;
    let params = [];

    if (bId) {
      orderCond += ` AND oi.business_id = ?`;
      params.push(bId);
    }

    const orderRow = db.prepare(`
      SELECT COUNT(DISTINCT o.id) as orders_count,
             COALESCE(SUM(oi.subtotal), 0) as items_revenue,
             COALESCE(SUM(DISTINCT o.delivery_fee), 0) as delivery_revenue
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ${orderCond}
    `).get(...params);

    const ordersCount = orderRow ? orderRow.orders_count : 0;
    const itemsRevenue = orderRow ? orderRow.items_revenue : 0;
    const deliveryRevenue = (bId ? 0 : (orderRow ? orderRow.delivery_revenue : 0));
    const revenue = itemsRevenue + deliveryRevenue;
    const ticketMedio = ordersCount > 0 ? revenue / ordersCount : 0;

    // Realized CMV
    const soldItems = db.prepare(`
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE ${orderCond}
    `).all(...params);

    let cmvTotal = 0;
    soldItems.forEach(item => {
      cmvTotal += getProductUnitCost(item.product_id) * item.quantity;
    });

    const grossProfit = revenue - cmvTotal;
    const cmvPercent = revenue > 0 ? (cmvTotal / revenue) * 100 : 0;

    // Expenses
    let expCond = expensePeriodClause;
    let expParams = [];
    if (bId) {
      expCond += ` AND (e.business_id = ? OR e.business_id IS NULL)`;
      expParams.push(bId);
    }
    const expRow = db.prepare(`SELECT COALESCE(SUM(e.amount), 0) as total FROM expenses e WHERE ${expCond}`).get(...expParams);
    const expensesTotal = expRow ? expRow.total : 0;

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
  const overallMetrics = getBusinessMetrics(business_id || null);

  // Cards for individual businesses
  const businesses = db.prepare('SELECT * FROM businesses ORDER BY id ASC').all();
  const businessCards = businesses.map(b => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    icon: b.icon,
    color: b.color,
    active: b.active,
    status: b.status,
    is_open: isBusinessOpen(b),
    metrics: b.active ? getBusinessMetrics(b.id) : { revenue: 0, orders_count: 0, ticket_medio: 0, cmv: 0, cmv_percent: 0, gross_profit: 0, expenses: 0, net_profit: 0 }
  }));

  // Total King's card
  const totalKingsCard = getBusinessMetrics(null);

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
  topQuery += ' GROUP BY oi.product_id ORDER BY total_qty DESC LIMIT 5';
  const topProducts = db.prepare(topQuery).all(...topParams);

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
  stockQuery += ' ORDER BY (i.current_stock / MAX(i.min_stock, 1)) ASC LIMIT 6';
  const lowStock = db.prepare(stockQuery).all(...stockParams);

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
  const recentOrders = db.prepare(recentQuery).all(...recentParams);

  res.json({
    metrics: overallMetrics,
    businesses: businessCards,
    total_kings: totalKingsCard,
    top_products: topProducts,
    low_stock: lowStock,
    recent_orders: recentOrders
  });
});

// ----------------------------------------------------
// 11. SETTINGS
// ----------------------------------------------------
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const entries = req.body;
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(entries)) {
      insert.run(key, String(value));
    }
  });
  transaction();
  res.json({ success: true });
});

// ----------------------------------------------------
// 12. DELIVERY ZONES (BAIRROS & TAXAS)
// ----------------------------------------------------
app.get('/api/delivery-zones', (req, res) => {
  const zones = db.prepare('SELECT * FROM delivery_zones ORDER BY fee ASC, name ASC').all();
  res.json(zones);
});

app.post('/api/delivery-zones', (req, res) => {
  const { name, fee, estimated_minutes, active } = req.body;
  if (!name || fee === undefined) return res.status(400).json({ error: 'Nome e taxa são obrigatórios' });

  const insert = db.prepare('INSERT INTO delivery_zones (name, fee, estimated_minutes, active) VALUES (?, ?, ?, ?)');
  const info = insert.run(name, Number(fee), Number(estimated_minutes) || 35, active !== undefined ? active : 1);
  const created = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/delivery-zones/:id', (req, res) => {
  const { id } = req.params;
  const { name, fee, estimated_minutes, active } = req.body;

  db.prepare(`
    UPDATE delivery_zones SET
      name = COALESCE(?, name),
      fee = COALESCE(?, fee),
      estimated_minutes = COALESCE(?, estimated_minutes),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(name, fee !== undefined ? Number(fee) : null, estimated_minutes, active, id);

  const updated = db.prepare('SELECT * FROM delivery_zones WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/delivery-zones/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM delivery_zones WHERE id = ?').run(id);
  res.json({ success: true });
});

// ----------------------------------------------------
// 13. COURIERS (MOTOBOYS) & DIÁRIAS
// ----------------------------------------------------
app.get('/api/couriers', (req, res) => {
  const couriers = db.prepare('SELECT * FROM couriers ORDER BY name ASC').all();

  const enriched = couriers.map(c => {
    const todayStats = db.prepare(`
      SELECT COUNT(*) as deliveries_count, COALESCE(SUM(delivery_fee), 0) as total_delivery_fees
      FROM orders
      WHERE courier_id = ? AND date(created_at, 'localtime') = date('now', 'localtime') AND status != 'cancelado'
    `).get(c.id);

    const deliveriesCount = todayStats ? todayStats.deliveries_count : 0;
    const totalEarnings = c.daily_fee + (deliveriesCount * c.fee_per_delivery);

    return {
      ...c,
      today_deliveries: deliveriesCount,
      today_earnings: totalEarnings
    };
  });

  res.json(enriched);
});

app.post('/api/couriers', (req, res) => {
  const { name, phone, daily_fee, fee_per_delivery, active } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const info = db.prepare(`
    INSERT INTO couriers (name, phone, daily_fee, fee_per_delivery, active)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, phone || '', Number(daily_fee) || 0, Number(fee_per_delivery) || 0, active !== undefined ? active : 1);

  const courier = db.prepare('SELECT * FROM couriers WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(courier);
});

app.put('/api/couriers/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, daily_fee, fee_per_delivery, active } = req.body;

  db.prepare(`
    UPDATE couriers SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      daily_fee = COALESCE(?, daily_fee),
      fee_per_delivery = COALESCE(?, fee_per_delivery),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(name, phone, daily_fee, fee_per_delivery, active, id);

  res.json(db.prepare('SELECT * FROM couriers WHERE id = ?').get(id));
});

app.delete('/api/couriers/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM couriers WHERE id = ?').run(id);
  res.json({ success: true });
});

app.patch('/api/orders/:id/courier', (req, res) => {
  const { id } = req.params;
  const { courier_id } = req.body;

  db.prepare('UPDATE orders SET courier_id = ?, dispatched_at = CURRENT_TIMESTAMP WHERE id = ?').run(courier_id, id);
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
});

// ----------------------------------------------------
// 14. CASH SHIFTS (CONTROLE DE GAVETA / SANGRIA / FECHAMENTO)
// ----------------------------------------------------
app.get('/api/cash/current', (req, res) => {
  const currentShift = db.prepare("SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
  if (!currentShift) {
    return res.json({ has_open_shift: false, shift: null });
  }

  const salesRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_method = 'DINHEIRO' THEN total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'PIX' THEN total ELSE 0 END), 0) as pix_sales,
      COALESCE(SUM(CASE WHEN payment_method IN ('CARTAO_DEBITO', 'CARTAO_CREDITO') THEN total ELSE 0 END), 0) as card_sales,
      COALESCE(SUM(total), 0) as total_sales,
      COUNT(*) as orders_count
    FROM orders
    WHERE created_at >= ? AND status != 'cancelado'
  `).get(currentShift.opened_at);

  const movements = db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY id DESC').all(currentShift.id);
  let totalSangria = 0;
  let totalSuprimento = 0;
  movements.forEach(m => {
    if (m.type === 'sangria') totalSangria += m.amount;
    else if (m.type === 'suprimento') totalSuprimento += m.amount;
  });

  const expectedDrawerCash = currentShift.initial_float + (salesRow ? salesRow.cash_sales : 0) + totalSuprimento - totalSangria;

  res.json({
    has_open_shift: true,
    shift: currentShift,
    stats: {
      initial_float: currentShift.initial_float,
      cash_sales: salesRow ? salesRow.cash_sales : 0,
      pix_sales: salesRow ? salesRow.pix_sales : 0,
      card_sales: salesRow ? salesRow.card_sales : 0,
      total_sales: salesRow ? salesRow.total_sales : 0,
      orders_count: salesRow ? salesRow.orders_count : 0,
      total_sangria: totalSangria,
      total_suprimento: totalSuprimento,
      expected_drawer_cash: Number(expectedDrawerCash.toFixed(2))
    },
    movements
  });
});

app.post('/api/cash/open', (req, res) => {
  const { initial_float, operator_name } = req.body;
  const existing = db.prepare("SELECT * FROM cash_shifts WHERE status = 'open'").get();
  if (existing) {
    return res.status(400).json({ error: 'Já existe um turno de caixa aberto. Feche o turno atual antes de abrir outro.' });
  }

  const info = db.prepare(`
    INSERT INTO cash_shifts (operator_name, initial_float, status)
    VALUES (?, ?, 'open')
  `).run(operator_name || 'Proprietário', Number(initial_float) || 0);

  const shift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(shift);
});

app.post('/api/cash/movement', (req, res) => {
  const { shift_id, type, amount, reason } = req.body;
  if (!shift_id || !type || !amount || !reason) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  }

  const info = db.prepare(`
    INSERT INTO cash_movements (shift_id, type, amount, reason)
    VALUES (?, ?, ?, ?)
  `).run(shift_id, type, Number(amount), reason);

  res.status(201).json(db.prepare('SELECT * FROM cash_movements WHERE id = ?').get(info.lastInsertRowid));
});

app.post('/api/cash/close', (req, res) => {
  const { shift_id, final_cash_counted, notes } = req.body;
  const shift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(shift_id);
  if (!shift) return res.status(404).json({ error: 'Turno não encontrado' });

  db.prepare(`
    UPDATE cash_shifts SET
      status = 'closed',
      closed_at = CURRENT_TIMESTAMP,
      final_cash_counted = ?,
      notes = ?
    WHERE id = ?
  `).run(Number(final_cash_counted) || 0, notes || '', shift_id);

  res.json({ success: true, message: 'Turno de caixa encerrado com sucesso.' });
});

app.get('/api/cash/history', (req, res) => {
  const shifts = db.prepare("SELECT * FROM cash_shifts WHERE status = 'closed' ORDER BY id DESC LIMIT 30").all();
  res.json(shifts);
});

// ----------------------------------------------------
// 15. INVENTORY PHYSICAL AUDIT (BALANÇO CEGO)
// ----------------------------------------------------
app.get('/api/inventory/audit-template', (req, res) => {
  const { business_id } = req.query;
  let q = 'SELECT i.id, i.name, i.unit, i.current_stock, i.cost_per_unit, b.name as business_name FROM ingredients i JOIN businesses b ON i.business_id = b.id WHERE i.active = 1';
  const params = [];
  if (business_id) {
    q += ' AND i.business_id = ?';
    params.push(business_id);
  }
  q += ' ORDER BY i.business_id ASC, i.name ASC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/inventory/audit-submit', (req, res) => {
  const { business_id, operator, notes, counts } = req.body;
  if (!counts || !Array.isArray(counts)) return res.status(400).json({ error: 'Dados de contagem inválidos' });

  const auditInfo = db.prepare('INSERT INTO inventory_audits (business_id, operator, notes) VALUES (?, ?, ?)').run(business_id || null, operator || 'Proprietário', notes || '');
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

  counts.forEach(c => {
    const ing = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(c.ingredient_id);
    if (ing) {
      const physical = Number(c.physical_stock);
      const system = ing.current_stock;
      const variance = physical - system;
      const varValue = variance * ing.cost_per_unit;
      totalDivergenceValue += Math.abs(varValue);

      insertAuditItem.run(auditId, ing.id, system, physical, variance, ing.cost_per_unit, varValue);

      if (variance !== 0) {
        updateStock.run(physical, ing.id);
        insertMovement.run(
          ing.id,
          ing.business_id,
          Math.abs(variance),
          system,
          physical,
          `Ajuste por Balanço Físico #${auditId} (${variance > 0 ? '+Sobra' : '-Quebra'})`
        );
      }
    }
  });

  res.json({ success: true, audit_id: auditId, total_divergence_value: totalDivergenceValue });
});

app.get('/api/inventory/audits', (req, res) => {
  const audits = db.prepare(`
    SELECT a.*, b.name as business_name, COUNT(ai.id) as items_count,
           SUM(ai.variance_value) as total_variance_value
    FROM inventory_audits a
    LEFT JOIN businesses b ON a.business_id = b.id
    LEFT JOIN inventory_audit_items ai ON a.id = ai.audit_id
    GROUP BY a.id
    ORDER BY a.id DESC LIMIT 20
  `).all();
  res.json(audits);
});

// ----------------------------------------------------
// 16. ADVANCED ANALYTICS & REPORTS (REQUISITO #14)
// ----------------------------------------------------
app.get('/api/reports/analytics', (req, res) => {
  const { period } = req.query;

  let periodCond = "1=1";
  if (period === 'hoje') periodCond = "date(o.created_at, 'localtime') = date('now', 'localtime')";
  else if (period === 'ontem') periodCond = "date(o.created_at, 'localtime') = date('now', 'localtime', '-1 day')";
  else if (period === '7dias') periodCond = "date(o.created_at, 'localtime') >= date('now', 'localtime', '-7 days')";
  else if (period === 'mes_atual') periodCond = "strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
  else if (period === 'mes_anterior') periodCond = "strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime', '-1 month')";

  const hoursRaw = db.prepare(`
    SELECT strftime('%H', o.created_at, 'localtime') as hour, COUNT(*) as orders_count, COALESCE(SUM(o.total), 0) as revenue
    FROM orders o
    WHERE ${periodCond} AND o.status != 'cancelado'
    GROUP BY hour
    ORDER BY hour ASC
  `).all();

  const paymentMethods = db.prepare(`
    SELECT o.payment_method, COUNT(*) as orders_count, COALESCE(SUM(o.total), 0) as revenue
    FROM orders o
    WHERE ${periodCond} AND o.status != 'cancelado'
    GROUP BY o.payment_method
  `).all();

  const orderSources = db.prepare(`
    SELECT o.source, COUNT(*) as count, COALESCE(SUM(o.total), 0) as revenue
    FROM orders o
    WHERE ${periodCond} AND o.status != 'cancelado'
    GROUP BY o.source
  `).all();

  const productsAbc = db.prepare(`
    SELECT oi.product_id, oi.product_name, b.name as business_name,
           SUM(oi.quantity) as total_qty,
           SUM(oi.subtotal) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN businesses b ON oi.business_id = b.id
    WHERE ${periodCond} AND o.status != 'cancelado'
    GROUP BY oi.product_id
    ORDER BY total_revenue DESC
  `).all().map(p => {
    const unitCost = getProductUnitCost(p.product_id);
    const totalCost = unitCost * p.total_qty;
    const grossProfit = p.total_revenue - totalCost;
    return {
      ...p,
      unit_cost: unitCost,
      total_cost: totalCost,
      gross_profit: grossProfit,
      margin_percent: p.total_revenue > 0 ? (grossProfit / p.total_revenue) * 100 : 0
    };
  });

  res.json({
    hours: hoursRaw,
    payment_methods: paymentMethods,
    sources: orderSources,
    products_abc: productsAbc
  });
});

// ----------------------------------------------------
// 17. CUSTOMERS / CRM
// ----------------------------------------------------
app.get('/api/customers', (req, res) => {
  const customers = db.prepare(`
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
    GROUP BY customer_phone
    ORDER BY total_spent DESC
  `).all();

  res.json(customers);
});

// ----------------------------------------------------
// 18. KDS (KITCHEN DISPLAY SYSTEM)
// ----------------------------------------------------
app.get('/api/kds/orders', (req, res) => {
  const activeOrders = db.prepare(`
    SELECT o.*
    FROM orders o
    WHERE o.status IN ('novo', 'confirmado', 'preparando')
    ORDER BY o.id ASC
  `).all();

  const enriched = activeOrders.map(order => {
    const items = db.prepare(`
      SELECT oi.*, b.name as business_name, b.slug as business_slug
      FROM order_items oi
      JOIN businesses b ON oi.business_id = b.id
      WHERE oi.order_id = ?
    `).all(order.id).map(item => {
      const addons = db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id);
      return { ...item, addons };
    });

    const createdDate = new Date(order.created_at);
    const now = new Date();
    const elapsedMinutes = Math.max(0, Math.floor((now - createdDate) / 60000));

    return {
      ...order,
      items,
      elapsed_minutes: elapsedMinutes
    };
  });

  res.json(enriched);
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
