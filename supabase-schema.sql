-- ==============================================================================
-- KING'S GESTÃO & DELIVERY - SCHEMA COMPLETO PARA SUPABASE (POSTGRESQL)
-- ==============================================================================
-- Como usar:
-- 1. Acesse o painel do seu projeto no Supabase (https://app.supabase.com)
-- 2. Vá em "SQL Editor" na barra lateral esquerda
-- 3. Cole todo o conteúdo deste arquivo e clique no botão verde "RUN"
-- ==============================================================================

-- COMPATIBILIDADE DE FUNÇÕES SQLITE (Para relatórios e filtros funcionarem 100%)
CREATE OR REPLACE FUNCTION strftime(format text, val timestamptz, modifier text DEFAULT NULL)
RETURNS text AS $$
BEGIN
  IF format = '%Y-%m' THEN
    IF modifier = '-1 month' THEN
      RETURN to_char(val - INTERVAL '1 month', 'YYYY-MM');
    ELSE
      RETURN to_char(val, 'YYYY-MM');
    END IF;
  ELSIF format = '%H' THEN
    RETURN to_char(val, 'HH24');
  ELSE
    RETURN to_char(val, 'YYYY-MM-DD');
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION strftime(format text, val text, modifier text DEFAULT NULL)
RETURNS text AS $$
BEGIN
  IF val = 'now' THEN
    IF modifier = '-1 month' THEN
      RETURN to_char(NOW() - INTERVAL '1 month', 'YYYY-MM');
    ELSE
      RETURN to_char(NOW(), 'YYYY-MM');
    END IF;
  ELSE
    RETURN strftime(format, val::timestamptz, modifier);
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION date(val timestamptz, modifier text DEFAULT NULL)
RETURNS date AS $$
BEGIN
  IF modifier = '-1 day' THEN
    RETURN (val - INTERVAL '1 day')::date;
  ELSIF modifier = '-7 days' THEN
    RETURN (val - INTERVAL '7 days')::date;
  ELSE
    RETURN val::date;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION date(val text, modifier text DEFAULT NULL, modifier2 text DEFAULT NULL)
RETURNS date AS $$
BEGIN
  IF val = 'now' THEN
    IF modifier = '-1 day' OR modifier2 = '-1 day' THEN
      RETURN (NOW() - INTERVAL '1 day')::date;
    ELSIF modifier = '-7 days' OR modifier2 = '-7 days' THEN
      RETURN (NOW() - INTERVAL '7 days')::date;
    ELSE
      RETURN CURRENT_DATE;
    END IF;
  ELSE
    RETURN date(val::timestamptz, modifier);
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION julianday(val text)
RETURNS double precision AS $$
BEGIN
  IF val = 'now' THEN
    RETURN EXTRACT(EPOCH FROM NOW()) / 86400.0 + 2440587.5;
  ELSE
    RETURN EXTRACT(EPOCH FROM val::timestamptz) / 86400.0 + 2440587.5;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION julianday(val timestamptz)
RETURNS double precision AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM val) / 86400.0 + 2440587.5;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. TABELA DE OPERAÇÕES DA MARCA KING'S
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  tagline VARCHAR(255),
  icon VARCHAR(50),
  color VARCHAR(50),
  active INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'open', -- 'open', 'closed', 'coming_soon'
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

-- 2. CATEGORIAS DE PRODUTOS
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_index INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

-- 3. PRODUTOS DO CARDÁPIO
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  active INTEGER DEFAULT 1,
  availability INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. GRUPOS DE ADICIONAIS / COMPLEMENTOS
CREATE TABLE IF NOT EXISTS product_addon_groups (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  min_choices INTEGER DEFAULT 0,
  max_choices INTEGER DEFAULT 10,
  free_choices INTEGER DEFAULT 0,
  required INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0
);

-- 5. OPÇÕES DE ADICIONAIS
CREATE TABLE IF NOT EXISTS addons (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES product_addon_groups(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price NUMERIC(10,2) DEFAULT 0.00,
  cost NUMERIC(10,2) DEFAULT 0.00,
  ingredient_id INTEGER,
  ingredient_quantity NUMERIC(10,3) DEFAULT 0,
  ingredient_unit VARCHAR(20) DEFAULT 'g',
  active INTEGER DEFAULT 1
);

-- 6. INSUMOS / ESTOQUE
CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  unit VARCHAR(20) NOT NULL, -- 'g', 'ml', 'un'
  current_stock NUMERIC(12,3) DEFAULT 0.000,
  min_stock NUMERIC(12,3) DEFAULT 0.000,
  cost_per_unit NUMERIC(12,4) NOT NULL, -- custo na unidade base (R$/g, R$/ml, R$/un)
  purchase_unit VARCHAR(30), -- 'kg', 'L', 'caixa', 'pacote', 'un'
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

-- 7. FICHA TÉCNICA / RECEITAS
CREATE TABLE IF NOT EXISTS recipe_items (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, ingredient_id)
);

-- 8. ENTREGADORES / MOTOBOYS
CREATE TABLE IF NOT EXISTS couriers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  daily_fee NUMERIC(10,2) DEFAULT 50.00,
  fee_per_delivery NUMERIC(10,2) DEFAULT 4.00,
  active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. ZONAS DE ENTREGA E TAXAS POR BAIRRO
CREATE TABLE IF NOT EXISTS delivery_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  fee NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  estimated_minutes VARCHAR(50) DEFAULT '30-45 min',
  active INTEGER DEFAULT 1
);

-- 10. PEDIDOS GERAIS
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number INTEGER UNIQUE NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  delivery_type VARCHAR(30) NOT NULL, -- 'delivery', 'pickup'
  delivery_address TEXT,
  delivery_neighborhood VARCHAR(100),
  notes TEXT,
  kitchen_notes TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) DEFAULT 0.00,
  discount NUMERIC(10,2) DEFAULT 0.00,
  total NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO'
  payment_change NUMERIC(10,2) DEFAULT 0.00,
  payment_status VARCHAR(30) DEFAULT 'pendente', -- 'pendente', 'pago'
  status VARCHAR(30) NOT NULL DEFAULT 'novo', -- 'novo', 'confirmado', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'
  stock_deducted INTEGER DEFAULT 0,
  source VARCHAR(50) DEFAULT 'cardapio',
  courier_id INTEGER REFERENCES couriers(id) ON DELETE SET NULL,
  ready_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. ITENS DO PEDIDO
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name VARCHAR(150) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  notes TEXT
);

-- 12. ADICIONAIS DO ITEM DO PEDIDO
CREATE TABLE IF NOT EXISTS order_item_addons (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  addon_id INTEGER,
  addon_name VARCHAR(100) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER DEFAULT 1
);

-- 13. MOVIMENTAÇÕES DE ESTOQUE
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'entrada', 'saida_venda', 'saida_perda', 'ajuste'
  quantity NUMERIC(12,3) NOT NULL,
  previous_stock NUMERIC(12,3) NOT NULL,
  new_stock NUMERIC(12,3) NOT NULL,
  reason TEXT,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. DESPESAS FINANCEIRAS / DRE
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  description VARCHAR(200) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  observation TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. TURNOS DE CAIXA (FRENTE DE CAIXA)
CREATE TABLE IF NOT EXISTS cash_shifts (
  id SERIAL PRIMARY KEY,
  operator_name VARCHAR(100) NOT NULL DEFAULT 'Proprietário',
  opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ,
  initial_float NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  final_cash_counted NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed'
  notes TEXT
);

-- 16. MOVIMENTAÇÕES DE GAVETA (SANGRIA E SUPRIMENTO)
CREATE TABLE IF NOT EXISTS cash_movements (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES cash_shifts(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL, -- 'sangria', 'suprimento'
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. AUDITORIAS E BALANÇO FÍSICO DE ESTOQUE
CREATE TABLE IF NOT EXISTS inventory_audits (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  audit_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  operator VARCHAR(100) DEFAULT 'Proprietário',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id SERIAL PRIMARY KEY,
  audit_id INTEGER NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  system_stock NUMERIC(12,3) NOT NULL,
  physical_stock NUMERIC(12,3) NOT NULL,
  variance NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(12,4) NOT NULL,
  variance_value NUMERIC(12,2) NOT NULL
);

-- 18. CONFIGURAÇÕES GERAIS
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

-- DESABILITAR RLS PARA ACESSO DIRETO DA APLICAÇÃO
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_addon_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE addons DISABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE couriers DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_addons DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audits DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audit_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- DADOS INICIAIS (SEED)
-- ==============================================================================

-- Operações
INSERT INTO businesses (id, name, slug, tagline, icon, color, active, status, is_manually_closed, opening_time, closing_time, min_order, delivery_fee)
VALUES 
  (1, 'KING''S AÇAÍ', 'acai', 'O verdadeiro açaí artesanal da realeza', '🍧', '#7e22ce', 1, 'open', 0, '11:00', '02:00', 15.00, 5.00),
  (2, 'KING''S BURGUER', 'burguer', 'Hambúrgueres artesanais feitos na brasa', '🍔', '#f59e0b', 1, 'open', 0, '18:00', '02:00', 20.00, 6.00),
  (3, 'KING''S PIZZA', 'pizza', 'Massas artesanais fermentadas e recheios nobres', '🍕', '#ef4444', 0, 'coming_soon', 1, '18:00', '00:00', 30.00, 7.00)
ON CONFLICT (id) DO NOTHING;

-- Configurações Gerais
INSERT INTO settings (key, value) VALUES
  ('brand_name', 'KING''S'),
  ('admin_pin', '#Kai-24xz'),
  ('default_delivery_fee', '5.00'),
  ('card_fee_debit', '1.50'),
  ('card_fee_credit', '3.20'),
  ('pix_key', 'pix@kingsgastronomia.com.br'),
  ('pix_name', 'KING''S GESTAO E ALIMENTOS LTDA'),
  ('whatsapp_phone', '11999999999')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Zonas de Entrega
INSERT INTO delivery_zones (name, fee, estimated_minutes, active) VALUES
  ('Centro', 5.00, '30-40 min', 1),
  ('Jardim América', 6.00, '35-45 min', 1),
  ('Vila Nova', 7.00, '40-50 min', 1),
  ('Bela Vista', 6.50, '35-45 min', 1),
  ('Parque das Flores', 8.00, '45-55 min', 1)
ON CONFLICT (name) DO NOTHING;

-- Entregadores
INSERT INTO couriers (name, phone, daily_fee, fee_per_delivery, active) VALUES
  ('Carlos Oliveira', '(11) 98765-4321', 50.00, 4.00, 1),
  ('Rafael Delivery', '(11) 97654-3210', 50.00, 4.00, 1),
  ('Marcos Santos', '(11) 99123-4567', 45.00, 4.50, 1)
ON CONFLICT DO NOTHING;

-- Categorias
INSERT INTO categories (id, business_id, name, order_index, active) VALUES
  (1, 1, 'Açaí no Copo', 1, 1),
  (2, 1, 'Barcas & Roletas', 2, 1),
  (3, 1, 'Bebidas Geladas', 3, 1),
  (4, 2, 'Destaque & Combos', 1, 1),
  (5, 2, 'Hambúrguer Artesanal', 2, 1),
  (6, 2, 'Acompanhamentos', 3, 1),
  (7, 2, 'Bebidas', 4, 1)
ON CONFLICT (id) DO NOTHING;

-- Insumos / Embalagens
INSERT INTO ingredients (id, business_id, name, unit, current_stock, min_stock, cost_per_unit, purchase_unit, purchase_quantity, purchase_price, purchase_type, package_size, package_unit, portion_sim_qty) VALUES
  (1, 1, 'Açaí Puro Médio (Polpa Base)', 'g', 12000, 3000, 0.0180, 'kg', 10, 180.00, 'pacote_peso', 10, 'kg', 400),
  (2, 1, 'Leite em Pó Ninho', 'g', 2500, 600, 0.0380, 'kg', 1, 38.00, 'pacote_peso', 1, 'kg', 30),
  (3, 1, 'Morango Fresco Higienizado', 'g', 1800, 500, 0.0240, 'kg', 2, 48.00, 'a_granel_kg', 1, 'kg', 50),
  (4, 1, 'Granola Tradicional Crocante', 'g', 3500, 800, 0.0180, 'kg', 1, 18.00, 'pacote_peso', 1, 'kg', 20),
  (5, 1, 'Banana Prata Fatiada', 'g', 2000, 500, 0.0070, 'kg', 3, 21.00, 'a_granel_kg', 1, 'kg', 50),
  (6, 1, 'Nutella Original', 'g', 1500, 400, 0.0650, 'kg', 3, 195.00, 'pacote_peso', 3, 'kg', 30),
  (7, 1, 'Copo Descartável 300ml', 'un', 150, 40, 0.3500, 'un', 100, 35.00, 'unidade_direta', 1, 'un', 1),
  (8, 1, 'Copo Descartável 500ml', 'un', 220, 50, 0.4500, 'un', 100, 45.00, 'unidade_direta', 1, 'un', 1),
  (9, 2, 'Pão de Brioche Artesanal', 'un', 120, 30, 1.8000, 'un', 50, 90.00, 'caixa_unidades', 50, 'un', 1),
  (10, 2, 'Blend Bovino 160g', 'g', 16000, 3200, 0.0349, 'kg', 1, 34.90, 'a_granel_kg', 1, 'kg', 160),
  (11, 2, 'Blend Bovino 120g', 'g', 12000, 2400, 0.0349, 'kg', 1, 34.90, 'a_granel_kg', 1, 'kg', 120),
  (12, 2, 'Queijo Cheddar Cremoso', 'g', 4000, 1000, 0.0380, 'kg', 2, 76.00, 'pacote_peso', 2, 'kg', 50),
  (13, 2, 'Bacon Crocante em Fatias', 'g', 3500, 800, 0.0450, 'kg', 3, 135.00, 'pacote_peso', 1, 'kg', 40),
  (14, 2, 'Batata Palito Pré-Frita', 'g', 20000, 4000, 0.0119, 'kg', 2, 23.90, 'pacote_peso', 2, 'kg', 150),
  (15, 2, 'Molho Barbecue Artesanal', 'g', 3000, 800, 0.0220, 'kg', 1, 22.00, 'pacote_peso', 1, 'kg', 30),
  (16, 2, 'Ovo Caipira/Granja', 'un', 60, 20, 0.7000, 'un', 30, 21.00, 'unidade_direta', 30, 'un', 1),
  (17, 2, 'Alface, Tomate e Cebola Roxa', 'g', 4000, 1000, 0.0090, 'kg', 2, 18.00, 'a_granel_kg', 1, 'kg', 40),
  (18, 2, 'Coca-Cola 350ml Lata', 'un', 80, 24, 3.2000, 'un', 12, 38.40, 'unidade_direta', 12, 'un', 1),
  (19, 2, 'Embalagem Burger / Delivery King', 'un', 150, 40, 0.8500, 'un', 100, 85.00, 'unidade_direta', 1, 'un', 1)
ON CONFLICT (id) DO NOTHING;

-- Produtos
INSERT INTO products (id, business_id, category_id, name, description, image_url, price, active, availability, order_index) VALUES
  (1, 1, 1, 'Açaí no Copo 300ml', 'Copo de 300ml montado com nosso açaí cremoso batido na hora com xarope natural.', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', 16.90, 1, 1, 1),
  (2, 1, 1, 'Açaí no Copo 500ml', 'O clássico mais pedido! 500ml de puro açaí cremoso com camadas generosas de complementos.', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', 22.90, 1, 1, 2),
  (3, 1, 1, 'Açaí no Copo 700ml', 'Tamanho família individual. 700ml para saciar toda a sua vontade de açaí.', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80', 28.90, 1, 1, 3),
  -- King's Burguer Produtos Oficiais
  (4, 2, 4, '2 King''s Classic + Coca 350ml', '2 king''s classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', 36.90, 1, 1, 1),
  (5, 2, 4, 'Combo Double Bacon', 'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', 39.90, 1, 1, 2),
  (6, 2, 5, 'Kings Double Bacon', 'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80', 32.90, 1, 1, 1),
  (7, 2, 5, 'Kings Classic', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', 19.90, 1, 1, 2),
  (8, 2, 5, 'Kings Egg Bacon', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80', 27.90, 1, 1, 3),
  (9, 2, 5, 'Kings Bacon', 'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.', 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80', 24.90, 1, 1, 4),
  (10, 2, 6, 'Batata Frita 150g', 'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição, São O Acompanhamento Ideal Para Hambúrgueres, Carnes e Refeições Rápidas, Ou Perfeitas Para Saborear Como Um Petisco Saboroso a Qualquer Hora Do Dia.', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', 12.90, 1, 1, 1),
  (11, 2, 6, 'Batata Frita 200g+ Cheddar e Bacon Crocante', '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.', 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80', 17.90, 1, 1, 2),
  (12, 2, 7, 'Coca-Cola 350ml', 'Lata 350ml estupidamente gelada.', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', 6.00, 1, 1, 1)
ON CONFLICT (id) DO NOTHING;

-- Fichas Técnicas (Receitas)
INSERT INTO recipe_items (product_id, ingredient_id, quantity) VALUES
  (1, 1, 260), -- Acai 300ml: 260g polpa
  (1, 7, 1),   -- Copo 300ml
  (2, 1, 420), -- Acai 500ml: 420g polpa
  (2, 8, 1),   -- Copo 500ml
  -- 2 King's Classic + Coca
  (4, 9, 2),   -- 2x Pao
  (4, 10, 320),-- 2x 160g Blend
  (4, 12, 60), -- Cheddar
  (4, 18, 1),  -- 1x Coca Lata
  (4, 19, 2),  -- 2x Embalagem
  -- Combo Double Bacon
  (5, 9, 1),   -- Pao
  (5, 11, 240),-- 2x 120g Blend
  (5, 12, 40), -- Cheddar
  (5, 13, 30), -- Bacon
  (5, 14, 180),-- 180g Batata
  (5, 19, 1),  -- Embalagem
  -- Kings Double Bacon
  (6, 9, 1),   -- Pao
  (6, 11, 240),-- 2x 120g Blend
  (6, 12, 40), -- Cheddar
  (6, 13, 30), -- Bacon
  (6, 19, 1),  -- Embalagem
  -- Kings Classic
  (7, 9, 1),   -- Pao
  (7, 10, 160),-- 160g Blend
  (7, 12, 30), -- Cheddar
  (7, 19, 1),  -- Embalagem
  -- Kings Egg Bacon
  (8, 9, 1),   -- Pao
  (8, 10, 160),-- 160g Blend
  (8, 12, 30), -- Cheddar
  (8, 13, 30), -- Bacon
  (8, 16, 1),  -- 1x Ovo
  (8, 19, 1),  -- Embalagem
  -- Kings Bacon
  (9, 9, 1),   -- Pao
  (9, 10, 160),-- 160g Blend
  (9, 12, 30), -- Cheddar
  (9, 13, 30), -- Bacon
  (9, 19, 1),  -- Embalagem
  -- Batatas & Bebidas
  (10, 14, 150), -- Batata 150g
  (11, 14, 180), -- Batata 180g
  (11, 12, 40),  -- Cobertura Cheddar
  (11, 13, 25),  -- Cobertura Bacon
  (12, 18, 1)    -- 1x Coca Lata
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

-- Sincronizar Sequências do PostgreSQL para novos cadastros funcionarem
SELECT setval('businesses_id_seq', (SELECT MAX(id) FROM businesses));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('ingredients_id_seq', (SELECT MAX(id) FROM ingredients));
SELECT setval('couriers_id_seq', (SELECT MAX(id) FROM couriers));
SELECT setval('delivery_zones_id_seq', (SELECT MAX(id) FROM delivery_zones));
