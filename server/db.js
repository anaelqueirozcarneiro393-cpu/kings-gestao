require('dotenv').config();
const { Pool, types } = require('pg');
const path = require('path');
const fs = require('fs');

// Garante que o PostgreSQL retorne colunas NUMERIC e BIGINT como números em vez de strings
if (types) {
  types.setTypeParser(1700, val => (val === null ? null : parseFloat(val)));
  types.setTypeParser(20, val => (val === null ? null : parseInt(val, 10)));
}

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
const isPostgres = Boolean(databaseUrl);

let pool = null;
let sqliteDb = null;

if (isPostgres) {
  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    console.log('[DB] Conectado ao PostgreSQL (Supabase)');
  } catch (err) {
    console.error('[DB] Erro ao instanciar pool do PostgreSQL:', err.message);
  }
} else {
  try {
    const Database = require('better-sqlite3');
    const dbDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'kings.db');
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    console.log('[DB] Conectado ao SQLite local');
  } catch (err) {
    console.warn('[DB] SQLite better-sqlite3 indisponível localmente:', err.message);
  }
}

// Converte parâmetros posicionais '?' do SQLite para '$1, $2, $3' do PostgreSQL
// e traduz funções de data do SQLite para sintaxe nativa do PostgreSQL
function formatSqlForPg(sql) {
  let s = sql;

  // Tradução de strftime para to_char do Postgres
  s = s.replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*'now'\s*,\s*'localtime'\s*,\s*'-1 month'\s*\)/gi, "to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM')");
  s = s.replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*'now'\s*,\s*'localtime'\s*\)/gi, "to_char(CURRENT_DATE, 'YYYY-MM')");
  s = s.replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*([a-zA-Z0-9_\.]+)(?:\s*,\s*'localtime')?\s*\)/gi, "to_char($1, 'YYYY-MM')");
  s = s.replace(/strftime\s*\(\s*'%H'\s*,\s*([a-zA-Z0-9_\.]+)(?:\s*,\s*'localtime')?\s*\)/gi, "to_char($1, 'HH24')");

  // Tradução de date(...) do SQLite para CURRENT_DATE e DATE(...) do Postgres
  s = s.replace(/date\s*\(\s*'now'\s*,\s*'localtime'\s*,\s*'-1 day'\s*\)/gi, "(CURRENT_DATE - INTERVAL '1 day')");
  s = s.replace(/date\s*\(\s*'now'\s*,\s*'localtime'\s*,\s*'-7 days'\s*\)/gi, "(CURRENT_DATE - INTERVAL '7 days')");
  s = s.replace(/date\s*\(\s*'now'\s*,\s*'localtime'\s*\)/gi, "CURRENT_DATE");
  s = s.replace(/date\s*\(\s*([a-zA-Z0-9_\.]+)\s*,\s*'localtime'\s*\)/gi, "DATE($1)");
  s = s.replace(/date\s*\(\s*([a-zA-Z0-9_\.]+)\s*\)/gi, "DATE($1)");

  // Tradução de JULIANDAY para Postgres
  s = s.replace(/ROUND\s*\(\s*JULIANDAY\('now'\)\s*-\s*JULIANDAY\(([^)]+)\)\s*\)/gi, "ROUND(EXTRACT(EPOCH FROM (NOW() - $1)) / 86400)");

  // Substitui '?' por '$1, $2, ...'
  let paramIndex = 1;
  return s.replace(/\?/g, () => `$${paramIndex++}`);
}

const db = {
  isPostgres,
  
  prepare(sql) {
    if (isPostgres && pool) {
      const pgSql = formatSqlForPg(sql);
      return {
        async all(...params) {
          const flatParams = params.flat();
          try {
            const res = await pool.query(pgSql, flatParams);
            return res.rows;
          } catch (err) {
            console.error('[DB PG ALL ERROR]', pgSql, flatParams, err.message);
            throw err;
          }
        },
        async get(...params) {
          const flatParams = params.flat();
          try {
            const res = await pool.query(pgSql, flatParams);
            return res.rows[0] || null;
          } catch (err) {
            console.error('[DB PG GET ERROR]', pgSql, flatParams, err.message);
            throw err;
          }
        },
        async run(...params) {
          const flatParams = params.flat();
          let runSql = pgSql;
          const isInsert = /^\s*insert\s+into/i.test(runSql);
          if (isInsert && !/returning/i.test(runSql)) {
            runSql += ' RETURNING id';
          }
          try {
            const res = await pool.query(runSql, flatParams);
            const lastInsertRowid = res.rows && res.rows[0] ? res.rows[0].id : null;
            return { lastInsertRowid, changes: res.rowCount };
          } catch (err) {
            console.error('[DB PG RUN ERROR]', runSql, flatParams, err.message);
            throw err;
          }
        }
      };
    } else if (sqliteDb) {
      const stmt = sqliteDb.prepare(sql);
      return {
        all: (...params) => stmt.all(...params.flat()),
        get: (...params) => stmt.get(...params.flat()),
        run: (...params) => stmt.run(...params.flat())
      };
    } else {
      // Fallback gracioso para ambiente inicializando
      return {
        all: async () => [],
        get: async () => null,
        run: async () => ({ lastInsertRowid: 1, changes: 0 })
      };
    }
  },

  async query(sql, params = []) {
    if (isPostgres && pool) {
      const pgSql = formatSqlForPg(sql);
      const res = await pool.query(pgSql, params.flat());
      return res.rows;
    } else if (sqliteDb) {
      return sqliteDb.prepare(sql).all(...params.flat());
    }
    return [];
  }
};

async function initSchema() {
  try {
    if (isPostgres && pool) {
      await pool.query(`
        -- 1. OPERAÇÕES
        CREATE TABLE IF NOT EXISTS businesses (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(50) NOT NULL UNIQUE,
          tagline VARCHAR(255),
          icon VARCHAR(50),
          color VARCHAR(50),
          active INTEGER NOT NULL DEFAULT 1,
          status VARCHAR(30) NOT NULL DEFAULT 'open',
          is_manually_closed INTEGER DEFAULT 0,
          opening_time VARCHAR(10) DEFAULT '11:00',
          closing_time VARCHAR(10) DEFAULT '02:00',
          min_order NUMERIC(10,2) DEFAULT 0.00,
          delivery_fee NUMERIC(10,2) DEFAULT 5.00,
          address TEXT,
          phone VARCHAR(50),
          instagram VARCHAR(100),
          banner_url TEXT,
          logo_url TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. CATEGORIAS
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL,
          name VARCHAR(100) NOT NULL,
          order_index INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1
        );

        -- 3. PRODUTOS
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL,
          category_id INTEGER,
          name VARCHAR(150) NOT NULL,
          description TEXT,
          image_url TEXT,
          price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
          active INTEGER DEFAULT 1,
          availability INTEGER DEFAULT 1,
          order_index INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- 4. ADICIONAIS E GRUPOS
        CREATE TABLE IF NOT EXISTS product_addon_groups (
          id SERIAL PRIMARY KEY,
          business_id INTEGER,
          product_id INTEGER,
          category_id INTEGER,
          title VARCHAR(100) NOT NULL,
          min_choices INTEGER DEFAULT 0,
          max_choices INTEGER DEFAULT 10,
          free_choices INTEGER DEFAULT 0,
          required INTEGER DEFAULT 0,
          order_index INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS addons (
          id SERIAL PRIMARY KEY,
          group_id INTEGER,
          business_id INTEGER,
          name VARCHAR(100) NOT NULL,
          price NUMERIC(10,2) DEFAULT 0.00,
          cost NUMERIC(10,2) DEFAULT 0.00,
          ingredient_id INTEGER,
          ingredient_quantity NUMERIC(10,3) DEFAULT 0,
          ingredient_unit VARCHAR(20) DEFAULT 'g',
          active INTEGER DEFAULT 1
        );

        -- 5. INSUMOS E RECEITAS
        CREATE TABLE IF NOT EXISTS ingredients (
          id SERIAL PRIMARY KEY,
          business_id INTEGER,
          name VARCHAR(150) NOT NULL,
          unit VARCHAR(20) NOT NULL,
          current_stock NUMERIC(12,3) DEFAULT 0.000,
          min_stock NUMERIC(12,3) DEFAULT 0.000,
          cost_per_unit NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
          purchase_unit VARCHAR(30),
          purchase_quantity NUMERIC(10,2),
          purchase_price NUMERIC(10,2),
          purchase_type VARCHAR(50) DEFAULT 'pacote_peso',
          package_size NUMERIC(10,2) DEFAULT 1,
          package_unit VARCHAR(20) DEFAULT 'kg',
          portion_sim_qty NUMERIC(10,2) DEFAULT 100,
          supplier VARCHAR(150),
          active INTEGER DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS recipe_items (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          ingredient_id INTEGER NOT NULL,
          quantity NUMERIC(10,3) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- 6. ENTREGADORES E ZONAS
        CREATE TABLE IF NOT EXISTS couriers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(50),
          daily_fee NUMERIC(10,2) DEFAULT 50.00,
          fee_per_delivery NUMERIC(10,2) DEFAULT 4.00,
          active INTEGER DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS delivery_zones (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          fee NUMERIC(10,2) NOT NULL DEFAULT 5.00,
          estimated_minutes VARCHAR(50) DEFAULT '30-45 min',
          active INTEGER DEFAULT 1
        );

        -- 7. PEDIDOS E ITENS
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          order_number INTEGER UNIQUE NOT NULL,
          customer_name VARCHAR(150) NOT NULL,
          customer_phone VARCHAR(50) NOT NULL,
          delivery_type VARCHAR(30) NOT NULL,
          delivery_address TEXT,
          delivery_neighborhood VARCHAR(100),
          notes TEXT,
          kitchen_notes TEXT,
          subtotal NUMERIC(10,2) NOT NULL,
          delivery_fee NUMERIC(10,2) DEFAULT 0.00,
          discount NUMERIC(10,2) DEFAULT 0.00,
          total NUMERIC(10,2) NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          payment_change NUMERIC(10,2) DEFAULT 0.00,
          payment_status VARCHAR(30) DEFAULT 'pendente',
          status VARCHAR(30) NOT NULL DEFAULT 'novo',
          stock_deducted INTEGER DEFAULT 0,
          source VARCHAR(50) DEFAULT 'cardapio',
          coupon_code VARCHAR(50),
          courier_id INTEGER,
          ready_at TIMESTAMPTZ,
          dispatched_at TIMESTAMPTZ,
          delivered_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL,
          business_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name VARCHAR(150) NOT NULL,
          unit_price NUMERIC(10,2) NOT NULL,
          quantity INTEGER NOT NULL,
          subtotal NUMERIC(10,2) NOT NULL,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS order_item_addons (
          id SERIAL PRIMARY KEY,
          order_item_id INTEGER NOT NULL,
          addon_id INTEGER,
          addon_name VARCHAR(100) NOT NULL,
          unit_price NUMERIC(10,2) DEFAULT 0.00,
          quantity INTEGER DEFAULT 1
        );

        -- 8. CUPONS E CONFIGURAÇÕES
        CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          description TEXT,
          discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
          discount_value NUMERIC(10,2) NOT NULL,
          min_order_value NUMERIC(10,2) DEFAULT 0.00,
          max_discount_value NUMERIC(10,2),
          usage_limit INTEGER,
          used_count INTEGER DEFAULT 0,
          starts_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMPTZ,
          active INTEGER DEFAULT 1,
          business_id INTEGER,
          delivery_type VARCHAR(30) DEFAULT 'all',
          only_first_order INTEGER DEFAULT 0,
          included_product_ids TEXT,
          excluded_product_ids TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id SERIAL PRIMARY KEY,
          business_id INTEGER,
          description VARCHAR(200) NOT NULL,
          amount NUMERIC(10,2) NOT NULL,
          category VARCHAR(50) NOT NULL,
          date VARCHAR(20) NOT NULL,
          observation TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cash_shifts (
          id SERIAL PRIMARY KEY,
          operator_name VARCHAR(100) NOT NULL,
          opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          closed_at TIMESTAMPTZ,
          initial_float NUMERIC(10,2) NOT NULL,
          final_cash_counted NUMERIC(10,2),
          status VARCHAR(20) DEFAULT 'open',
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS cash_movements (
          id SERIAL PRIMARY KEY,
          shift_id INTEGER NOT NULL,
          type VARCHAR(20) NOT NULL,
          amount NUMERIC(10,2) NOT NULL,
          reason VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_audits (
          id SERIAL PRIMARY KEY,
          business_id INTEGER,
          audit_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          operator VARCHAR(100),
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS inventory_audit_items (
          id SERIAL PRIMARY KEY,
          audit_id INTEGER NOT NULL,
          ingredient_id INTEGER NOT NULL,
          system_stock NUMERIC(12,3),
          physical_stock NUMERIC(12,3),
          variance NUMERIC(12,3),
          unit_cost NUMERIC(12,4),
          variance_value NUMERIC(10,2)
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
          id SERIAL PRIMARY KEY,
          ingredient_id INTEGER NOT NULL,
          business_id INTEGER,
          type VARCHAR(30) NOT NULL,
          quantity NUMERIC(12,3) NOT NULL,
          previous_stock NUMERIC(12,3),
          new_stock NUMERIC(12,3),
          reason VARCHAR(255),
          order_id INTEGER,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        -- SEED DAS OPERAÇÕES DA MARCA KING'S (Açaí e Burguer abertos, Pizza em breve)
        INSERT INTO businesses (id, name, slug, tagline, icon, color, active, status, is_manually_closed, opening_time, closing_time, min_order, delivery_fee, address, phone, instagram)
        VALUES 
          (1, 'KING''S AÇAÍ', 'acai', 'O verdadeiro açaí artesanal e cremoso', 'acai', '#9333ea', 1, 'open', 0, '11:00', '02:00', 15.00, 5.00, 'Av. Principal, 1000 - Centro', '(11) 99999-1001', '@kingsacai.oficial'),
          (2, 'KING''S BURGUER', 'burguer', 'Burguers artesanais feitos no fogo e sabor inigualável', 'burger', '#f59e0b', 1, 'open', 0, '18:00', '00:00', 20.00, 6.00, 'Av. Principal, 1000 - Centro', '(11) 99999-1002', '@kingsburguer.oficial'),
          (3, 'KING''S PIZZA', 'pizza', 'Pizzas artesanais com fermentação natural', 'pizza', '#ef4444', 0, 'coming_soon', 0, '18:00', '23:30', 30.00, 7.00, 'Av. Principal, 1000 - Centro', '(11) 99999-1003', '@kingspizza.oficial')
        ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          active = EXCLUDED.active,
          status = EXCLUDED.status;

        -- SEED DAS CATEGORIAS
        INSERT INTO categories (id, business_id, name, order_index, active)
        VALUES
          (1, 1, 'Açaí no Copo', 1, 1),
          (2, 1, 'Barcas & Roletas', 2, 1),
          (10, 2, 'Destaque & Combos', 1, 1),
          (11, 2, 'Hambúrguer Artesanal', 2, 1),
          (12, 2, 'Acompanhamentos', 3, 1),
          (13, 2, 'Bebidas', 4, 1)
        ON CONFLICT (id) DO NOTHING;

        -- SEED DOS PRODUTOS OFICIAIS
        INSERT INTO products (id, business_id, category_id, name, description, image_url, price, active, availability, order_index)
        VALUES
          (1, 1, 1, 'Açaí no Copo 300ml', 'Copo de 300ml montado com nosso açaí cremoso batido na hora com xarope natural.', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', 16.90, 1, 1, 1),
          (2, 1, 1, 'Açaí no Copo 500ml', 'O clássico mais pedido! 500ml de puro açaí cremoso com camadas generosas de complementos.', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', 22.90, 1, 1, 2),
          (101, 2, 10, '2 King''s Classic + Coca 350ml', '2 king''s classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', 36.90, 1, 1, 1),
          (102, 2, 10, 'Combo Double Bacon', 'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', 39.90, 1, 1, 2),
          (103, 2, 11, 'Kings Double Bacon', 'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80', 32.90, 1, 1, 1),
          (104, 2, 11, 'Kings Classic', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', 19.90, 1, 1, 2),
          (105, 2, 11, 'Kings Egg Bacon', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80', 27.90, 1, 1, 3),
          (106, 2, 11, 'Kings Bacon', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80', 24.90, 1, 1, 4),
          (107, 2, 12, 'Batata Frita 150g', 'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição.', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', 12.90, 1, 1, 1),
          (108, 2, 12, 'Batata Frita 200g+ Cheddar e Bacon Crocante', '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.', 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80', 17.90, 1, 1, 2),
          (109, 2, 13, 'Coca-Cola 350ml', 'Lata 350ml estupidamente gelada.', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', 6.00, 1, 1, 1)
        ON CONFLICT (id) DO NOTHING;

        -- SEED DE CONFIGURAÇÕES INICIAIS
        INSERT INTO settings (key, value) VALUES
          ('admin_pin', '#Kai-24xz'),
          ('store_name', 'KING''S GESTÃO'),
          ('whatsapp_notification_phone', '5511999999999'),
          ('default_delivery_fee', '5.00')
        ON CONFLICT (key) DO NOTHING;

        -- SEED DE GRUPOS DE ADICIONAIS (Açaí: 4 grátis, Burguer: pagos)
        INSERT INTO product_addon_groups (id, business_id, title, min_choices, max_choices, free_choices, required, order_index)
        VALUES
          (1, 1, 'Escolha seus Complementos (4 Grátis)', 0, 15, 4, 0, 1),
          (2, 2, 'Turbine seu Hambúrguer (Adicionais Extras)', 0, 10, 0, 0, 1),
          (3, 2, 'Ponto da Carne', 1, 1, 1, 1, 2)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          free_choices = EXCLUDED.free_choices,
          max_choices = EXCLUDED.max_choices,
          min_choices = EXCLUDED.min_choices,
          required = EXCLUDED.required;

        -- SEED DE ADICIONAIS / COMPLEMENTOS
        INSERT INTO addons (id, group_id, business_id, name, price, active)
        VALUES
          (1, 1, 1, 'Leite em Pó (Ninho)', 3.00, 1),
          (2, 1, 1, 'Granola Tradicional Crocante', 3.00, 1),
          (3, 1, 1, 'Leite Condensado', 3.00, 1),
          (4, 1, 1, 'Banana Fresca Fatiada', 3.00, 1),
          (5, 1, 1, 'Morango Fresco Fatiado', 4.00, 1),
          (6, 1, 1, 'Paçoca Rolha', 3.00, 1),
          (7, 1, 1, 'Gotas de Chocolate', 3.50, 1),
          (8, 1, 1, 'Creme de Avelã (Nutella)', 5.00, 1),
          (9, 1, 1, 'Mel Silvestre Puro', 3.00, 1),
          (10, 1, 1, 'Calda de Morango', 3.00, 1),
          (11, 1, 1, 'Calda de Chocolate', 3.00, 1),
          (12, 1, 1, 'Chocoball Crocante', 3.00, 1),
          (13, 1, 1, 'Confetes M&Ms', 3.50, 1),
          (14, 1, 1, 'Aveia em Flocos', 2.50, 1),
          (15, 1, 1, 'Amendoim Triturado', 3.00, 1),
          (20, 2, 2, 'Bacon Crocante em Fatias', 5.00, 1),
          (21, 2, 2, 'Blend Artesanal Extra 160g', 9.00, 1),
          (22, 2, 2, 'Queijo Cheddar Cremoso Extra', 4.00, 1),
          (23, 2, 2, 'Queijo Mussarela Fatiado', 4.00, 1),
          (24, 2, 2, 'Ovo Frito na Manteiga', 3.00, 1),
          (25, 2, 2, 'Cebola Caramelizada na Chapa', 3.50, 1),
          (26, 2, 2, 'Picles Artesanal em Rodelas', 3.00, 1),
          (27, 2, 2, 'Molho Barbecue Defumado (50ml)', 3.00, 1),
          (28, 2, 2, 'Maionese Temperada da Casa (50ml)', 3.00, 1),
          (30, 3, 2, 'Ao Ponto (Vermelhinho no centro, muito suculento)', 0.00, 1),
          (31, 3, 2, 'Ao Ponto para Bem (Centro levemente rosado)', 0.00, 1),
          (32, 3, 2, 'Bem Passado (Carne tostadinha e firme)', 0.00, 1)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          active = EXCLUDED.active;
      `);

      // Ajustar sequences com segurança (não quebra se o nome da sequence for ligeiramente diferente)
      try {
        await pool.query(`
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'products_id_seq') THEN
              PERFORM setval('products_id_seq', (SELECT GREATEST(COALESCE(MAX(id), 1), 200) FROM products));
            END IF;
            IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'categories_id_seq') THEN
              PERFORM setval('categories_id_seq', (SELECT GREATEST(COALESCE(MAX(id), 1), 50) FROM categories));
            END IF;
            IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'product_addon_groups_id_seq') THEN
              PERFORM setval('product_addon_groups_id_seq', (SELECT GREATEST(COALESCE(MAX(id), 1), 20) FROM product_addon_groups));
            END IF;
            IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'addons_id_seq') THEN
              PERFORM setval('addons_id_seq', (SELECT GREATEST(COALESCE(MAX(id), 1), 100) FROM addons));
            END IF;
          END $$;
        `);
      } catch (seqErr) {
        console.warn('[DB SEQ WARN]', seqErr.message);
      }

      console.log('[DB] Schema e dados oficiais sincronizados com sucesso.');
    } else if (sqliteDb) {
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS coupons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          description TEXT,
          discount_type TEXT NOT NULL DEFAULT 'percentage',
          discount_value REAL NOT NULL,
          min_order_value REAL DEFAULT 0.00,
          max_discount_value REAL,
          usage_limit INTEGER,
          used_count INTEGER DEFAULT 0,
          starts_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT,
          active INTEGER DEFAULT 1,
          business_id INTEGER,
          delivery_type TEXT DEFAULT 'all',
          only_first_order INTEGER DEFAULT 0,
          included_product_ids TEXT,
          excluded_product_ids TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try {
        sqliteDb.exec(`ALTER TABLE orders ADD COLUMN coupon_code TEXT;`);
      } catch (e) {
        // Coluna já existe
      }

      // Sincroniza produtos do Burguer no SQLite local se faltarem
      try {
        const prodCount = sqliteDb.prepare('SELECT count(*) as c FROM products WHERE business_id = 2').get();
        if (!prodCount || prodCount.c === 0) {
          const insertProd = sqliteDb.prepare(`
            INSERT OR IGNORE INTO products (id, business_id, category_id, name, description, image_url, price, active, availability, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertProd.run(101, 2, 10, "2 King's Classic + Coca 350ml", "2 king's classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml", 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', 36.90, 1, 1, 1);
          insertProd.run(102, 2, 10, 'Combo Double Bacon', 'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', 39.90, 1, 1, 2);
          insertProd.run(103, 2, 11, 'Kings Double Bacon', 'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80', 32.90, 1, 1, 1);
          insertProd.run(104, 2, 11, 'Kings Classic', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', 19.90, 1, 1, 2);
          insertProd.run(105, 2, 11, 'Kings Egg Bacon', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80', 27.90, 1, 1, 3);
          insertProd.run(106, 2, 11, 'Kings Bacon', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80', 24.90, 1, 1, 4);
          insertProd.run(107, 2, 12, 'Batata Frita 150g', 'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição.', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', 12.90, 1, 1, 1);
          insertProd.run(108, 2, 12, 'Batata Frita 200g+ Cheddar e Bacon Crocante', '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.', 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80', 17.90, 1, 1, 2);
          insertProd.run(109, 2, 13, 'Coca-Cola 350ml', 'Lata 350ml estupidamente gelada.', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', 6.00, 1, 1, 1);
        }
      } catch (e) {}
    }
  } catch (err) {
    console.warn('[DB INIT SCHEMA]', err.message);
  }
}

// Função para diagnóstico e verificação do status da conexão com o banco
async function checkDatabaseConnection() {
  if (isPostgres && pool) {
    try {
      const res = await pool.query('SELECT 1 as ping');
      return { connected: true, type: 'postgresql', ping: res.rows[0]?.ping || 1 };
    } catch (err) {
      return { connected: false, type: 'postgresql', error: err.message };
    }
  } else if (sqliteDb) {
    try {
      const res = sqliteDb.prepare('SELECT 1 as ping').get();
      return { connected: true, type: 'sqlite', ping: res.ping };
    } catch (err) {
      return { connected: false, type: 'sqlite', error: err.message };
    }
  }
  return {
    connected: false,
    type: 'none',
    error: 'Nenhuma conexão ativa. Variável DATABASE_URL não configurada no ambiente e SQLite local indisponível.'
  };
}

// Inicializa schema automaticamente
initSchema();

module.exports = {
  db,
  initSchema,
  checkDatabaseConnection,
  isPostgres
};
