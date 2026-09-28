-- ==============================================================================
-- ATUALIZAÇÃO DO CARDÁPIO REAL - KING'S BURGUER
-- Execute este script no SQL Editor do Supabase para atualizar o cardápio
-- ==============================================================================

-- 1. Obter ou garantir a operação KING'S BURGUER (business_id = 2)
INSERT INTO businesses (id, name, slug, tagline, icon, color, active, status, is_manually_closed, opening_time, closing_time, min_order, delivery_fee)
VALUES (2, 'KING''S BURGUER', 'burguer', 'Hambúrgueres artesanais feitos no fogo', '🍔', '#f59e0b', 1, 'open', 0, '18:00', '02:00', 20.00, 6.00)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  active = 1,
  status = 'open';

-- 2. Limpar categorias antigas do Burguer para organizar limpo
-- (Remove também os produtos antigos associados a essa operação)
DELETE FROM recipe_items WHERE product_id IN (SELECT id FROM products WHERE business_id = 2);
DELETE FROM products WHERE business_id = 2;
DELETE FROM categories WHERE business_id = 2;

-- 3. Inserir as Categorias Oficiais
INSERT INTO categories (id, business_id, name, order_index, active) VALUES
  (10, 2, 'Destaque & Combos', 1, 1),
  (11, 2, 'Hambúrguer Artesanal', 2, 1),
  (12, 2, 'Acompanhamentos', 3, 1),
  (13, 2, 'Bebidas', 4, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  order_index = EXCLUDED.order_index,
  active = 1;

-- 4. Inserir os Produtos Oficiais com Preços e Descrições Reais
INSERT INTO products (id, business_id, category_id, name, description, image_url, price, active, availability, order_index) VALUES
  -- Combos & Destaques
  (
    101, 2, 10,
    '2 King''s Classic + Coca 350ml',
    '2 king''s classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml',
    'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
    36.90, 1, 1, 1
  ),
  (
    102, 2, 10,
    'Combo Double Bacon',
    'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon',
    'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
    39.90, 1, 1, 2
  ),

  -- Hambúrguer Artesanal
  (
    103, 2, 11,
    'Kings Classic',
    'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.',
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
    19.90, 1, 1, 1
  ),
  (
    104, 2, 11,
    'Kings Bacon',
    'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.',
    'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80',
    24.90, 1, 1, 2
  ),
  (
    105, 2, 11,
    'Kings Egg Bacon',
    'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.',
    'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80',
    27.90, 1, 1, 3
  ),
  (
    106, 2, 11,
    'Kings Double Bacon',
    'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.',
    'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80',
    32.90, 1, 1, 4
  ),

  -- Acompanhamentos
  (
    107, 2, 12,
    'Batata Frita 150g',
    'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição, São O Acompanhamento Ideal Para Hambúrgueres, Carnes e Refeições Rápidas, Ou Perfeitas Para Saborear Como Um Petisco Saboroso a Qualquer Hora Do Dia.',
    'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
    12.90, 1, 1, 1
  ),
  (
    108, 2, 12,
    'Batata Frita 200g+ Cheddar e Bacon Crocante',
    '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.',
    'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80',
    17.90, 1, 1, 2
  ),

  -- Bebidas
  (
    109, 2, 13,
    'Coca-Cola 350ml',
    'Lata 350ml estupidamente gelada.',
    'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    6.00, 1, 1, 1
  )
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  price = EXCLUDED.price,
  active = EXCLUDED.active,
  availability = EXCLUDED.availability,
  order_index = EXCLUDED.order_index;

-- 5. Atualizar as sequências para novos cadastros manuais continuarem funcionando normalmente
SELECT setval('categories_id_seq', (SELECT GREATEST(MAX(id), 20) FROM categories));
SELECT setval('products_id_seq', (SELECT GREATEST(MAX(id), 120) FROM products));
