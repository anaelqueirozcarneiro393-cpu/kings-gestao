let db = null;

try {
  const Database = require('better-sqlite3');
  const dbDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'kings.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.warn('[DB] SQLite better-sqlite3 indisponível ou rodando em ambiente serverless:', err.message);
}

// Initialize database schema
function initSchema() {
  db.exec(`
    -- Tabela de Operações / Negócios da Marca KING'S
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      tagline TEXT,
      icon TEXT,
      color TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'coming_soon'
      is_manually_closed INTEGER DEFAULT 0,
      opening_time TEXT DEFAULT '11:00',
      closing_time TEXT DEFAULT '02:00',
      min_order REAL DEFAULT 0,
      delivery_fee REAL DEFAULT 5.0,
      address TEXT,
      phone TEXT,
      instagram TEXT,
      banner_url TEXT,
      logo_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Categorias de Produtos
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
    );

    -- Produtos
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      category_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      price REAL NOT NULL,
      active INTEGER DEFAULT 1,
      availability INTEGER DEFAULT 1, -- 1=Disponível, 0=Pausado
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
    );

    -- Grupos de Adicionais / Complementos
    CREATE TABLE IF NOT EXISTS product_addon_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      product_id INTEGER, -- Se NULL, aplica a todos os produtos da categoria ou da operação
      category_id INTEGER,
      title TEXT NOT NULL,
      min_choices INTEGER DEFAULT 0,
      max_choices INTEGER DEFAULT 10,
      free_choices INTEGER DEFAULT 0,
      required INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
    );

    -- Opções de Adicionais / Complementos
    CREATE TABLE IF NOT EXISTS addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL DEFAULT 0.0,
      cost REAL DEFAULT 0.0,
      ingredient_id INTEGER,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES product_addon_groups (id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
    );

    -- Ingredientes / Insumos
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL, -- 'g', 'ml', 'un'
      current_stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      cost_per_unit REAL NOT NULL, -- custo na unidade base (R$/g, R$/ml, R$/un)
      purchase_unit TEXT, -- 'kg', 'L', 'caixa', 'un'
      purchase_quantity REAL,
      purchase_price REAL,
      supplier TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
    );

    -- Ficha Técnica / Receita (Itens que compõem um produto)
    CREATE TABLE IF NOT EXISTS recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity REAL NOT NULL, -- na unidade base do ingrediente
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE,
      UNIQUE(product_id, ingredient_id)
    );

    -- Pedidos Gerais KING'S (Suporta itens de múltiplas operações no mesmo pedido)
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number INTEGER UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_type TEXT NOT NULL, -- 'delivery', 'pickup'
      delivery_address TEXT,
      delivery_neighborhood TEXT,
      notes TEXT,
      subtotal REAL NOT NULL,
      delivery_fee REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL, -- 'PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO'
      payment_change REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'pendente', -- 'pendente', 'pago'
      status TEXT NOT NULL DEFAULT 'novo', -- 'novo', 'confirmado', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'
      stock_deducted INTEGER DEFAULT 0,
      source TEXT DEFAULT 'cardapio', -- 'cardapio', 'manual_whatsapp', 'manual_balcao', 'manual_telefone'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Itens do Pedido
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
    );

    -- Adicionais escolhidos para o item do pedido
    CREATE TABLE IF NOT EXISTS order_item_addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL,
      addon_id INTEGER,
      addon_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE
    );

    -- Movimentações de Estoque
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'entrada', 'saida_venda', 'saida_perda', 'ajuste'
      quantity REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      reason TEXT,
      order_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE
    );

    -- Despesas Financeiras
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER, -- Pode ser NULL se for despesa corporativa da marca KING'S
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL, -- 'Ingredientes/Insumos', 'Embalagens', 'Gás', 'Energia', 'Publicidade', 'Entregadores', 'Taxas/Impostos', 'Salários', 'Aluguel', 'Outros'
      date TEXT NOT NULL,
      observation TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE SET NULL
    );

    -- Configurações Gerais
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Índices para velocidade máxima
    -- Zonas de Entrega e Bairros
    CREATE TABLE IF NOT EXISTS delivery_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      fee REAL NOT NULL DEFAULT 5.0,
      estimated_minutes INTEGER DEFAULT 40,
      active INTEGER DEFAULT 1
    );

    -- Motoboys / Entregadores
    CREATE TABLE IF NOT EXISTS couriers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      daily_fee REAL DEFAULT 50.0,
      fee_per_delivery REAL DEFAULT 4.0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Turnos de Caixa (Abertura, Troco Inicial, Fechamento)
    CREATE TABLE IF NOT EXISTS cash_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_name TEXT NOT NULL DEFAULT 'Proprietário',
      opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT,
      initial_float REAL NOT NULL DEFAULT 0.0,
      final_cash_counted REAL,
      status TEXT DEFAULT 'open', -- 'open', 'closed'
      notes TEXT
    );

    -- Movimentações de Gaveta (Sangria e Suprimento)
    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'sangria', 'suprimento'
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES cash_shifts (id) ON DELETE CASCADE
    );

    -- Balanços e Auditorias Físicas de Estoque
    CREATE TABLE IF NOT EXISTS inventory_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER,
      audit_date TEXT DEFAULT CURRENT_TIMESTAMP,
      operator TEXT DEFAULT 'Proprietário',
      notes TEXT,
      FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_audit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      system_stock REAL NOT NULL,
      physical_stock REAL NOT NULL,
      variance REAL NOT NULL,
      unit_cost REAL NOT NULL,
      variance_value REAL NOT NULL,
      FOREIGN KEY (audit_id) REFERENCES inventory_audits (id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE
    );

    -- Índices para velocidade máxima
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_business ON order_items (business_id);
    CREATE INDEX IF NOT EXISTS idx_products_business ON products (business_id);
    CREATE INDEX IF NOT EXISTS idx_ingredients_business ON ingredients (business_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);
    CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts (status);
  `);
}

function runMigrations() {
  const ingCols = db.prepare("PRAGMA table_info(ingredients)").all().map(c => c.name);
  if (!ingCols.includes('purchase_type')) db.exec("ALTER TABLE ingredients ADD COLUMN purchase_type TEXT DEFAULT 'pacote_peso'");
  if (!ingCols.includes('package_size')) db.exec("ALTER TABLE ingredients ADD COLUMN package_size REAL DEFAULT 1");
  if (!ingCols.includes('package_unit')) db.exec("ALTER TABLE ingredients ADD COLUMN package_unit TEXT DEFAULT 'kg'");
  if (!ingCols.includes('portion_sim_qty')) db.exec("ALTER TABLE ingredients ADD COLUMN portion_sim_qty REAL DEFAULT 100");

  const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
  if (!orderCols.includes('courier_id')) db.exec("ALTER TABLE orders ADD COLUMN courier_id INTEGER");
  if (!orderCols.includes('ready_at')) db.exec("ALTER TABLE orders ADD COLUMN ready_at TEXT");
  if (!orderCols.includes('dispatched_at')) db.exec("ALTER TABLE orders ADD COLUMN dispatched_at TEXT");
  if (!orderCols.includes('delivered_at')) db.exec("ALTER TABLE orders ADD COLUMN delivered_at TEXT");
  if (!orderCols.includes('kitchen_notes')) db.exec("ALTER TABLE orders ADD COLUMN kitchen_notes TEXT");

  const addonCols = db.prepare("PRAGMA table_info(addons)").all().map(c => c.name);
  if (!addonCols.includes('ingredient_quantity')) db.exec("ALTER TABLE addons ADD COLUMN ingredient_quantity REAL DEFAULT 0");
  if (!addonCols.includes('ingredient_unit')) db.exec("ALTER TABLE addons ADD COLUMN ingredient_unit TEXT DEFAULT 'g'");
}

if (db) {
  initSchema();
  runMigrations();
}

module.exports = {
  db,
  initSchema
};
