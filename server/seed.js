const { db } = require('./db');

function seedDatabase() {
  const businessCount = db.prepare('SELECT COUNT(*) as count FROM businesses').get().count;

  if (businessCount === 0) {
    console.log('Seeding initial businesses...');

    // 1. Inserir as 3 Operações da KING'S
    const insertBusiness = db.prepare(`
      INSERT INTO businesses (name, slug, tagline, icon, color, active, status, opening_time, closing_time, min_order, delivery_fee, address, phone, instagram)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const acaiId = insertBusiness.run(
      "KING'S AÇAÍ",
      'acai',
      'O verdadeiro açaí artesanal e cremoso',
      'acai',
      '#9333ea', // Roxo premium
      1,
      'open',
      '11:00',
      '02:00',
      15.0,
      5.0,
      'Av. Principal, 1000 - Centro',
      '(11) 99999-1001',
      '@kingsacai.oficial'
    ).lastInsertRowid;

    const burguerId = insertBusiness.run(
      "KING'S BURGUER",
      'burguer',
      'Burguers artesanais feitos no fogo e sabor inigualável',
      'burger',
      '#f59e0b', // Âmbar / Dourado
      1,
      'open',
      '18:00',
      '02:00',
      20.0,
      6.0,
      'Av. Principal, 1000 - Centro',
      '(11) 99999-1002',
      '@kingsburguer.oficial'
    ).lastInsertRowid;

    const pizzaId = insertBusiness.run(
      "KING'S PIZZA",
      'pizza',
      'Pizzas artesanais com fermentação natural',
      'pizza',
      '#ef4444', // Vermelho pizza
      0, // active = 0 conforme requisito
      'coming_soon', // marcado como Em breve
      '18:00',
      '23:30',
      30.0,
      7.0,
      'Av. Principal, 1000 - Centro',
      '(11) 99999-1003',
      '@kingspizza.oficial'
    ).lastInsertRowid;

    // 2. Inserir Categorias
    const insertCategory = db.prepare(`
      INSERT INTO categories (business_id, name, order_index, active) VALUES (?, ?, ?, 1)
    `);

    // Categorias Açaí
    const catAcaiCopo = insertCategory.run(acaiId, 'Açaí no Copo', 1).lastInsertRowid;
    const catAcaiBarca = insertCategory.run(acaiId, 'Barcas & Roletas', 2).lastInsertRowid;
    const catAcaiBebidas = insertCategory.run(acaiId, 'Bebidas Geladas', 3).lastInsertRowid;

    // Categorias Burguer Oficiais
    const catBurguerCombos = insertCategory.run(burguerId, 'Destaque & Combos', 1).lastInsertRowid;
    const catBurguerArtesanal = insertCategory.run(burguerId, 'Hambúrguer Artesanal', 2).lastInsertRowid;
    const catBurguerAcomp = insertCategory.run(burguerId, 'Acompanhamentos', 3).lastInsertRowid;
    const catBurguerBebidas = insertCategory.run(burguerId, 'Bebidas', 4).lastInsertRowid;

    // Categorias Pizza (estrutura pronta para quando ativar)
    const catPizzaTrad = insertCategory.run(pizzaId, 'Pizzas Tradicionais', 1).lastInsertRowid;
    const catPizzaEsp = insertCategory.run(pizzaId, 'Pizzas Especiais', 2).lastInsertRowid;

    // 3. Inserir Ingredientes / Insumos
    // Requisito 9: Unidades: g, kg, ml, L, unidade. Conversões corretas sem arredondamento prematuro.
    // Exemplo: 10kg açaí por R$ 180 -> R$ 0,018/g
    const insertIngredient = db.prepare(`
      INSERT INTO ingredients (business_id, name, unit, current_stock, min_stock, cost_per_unit, purchase_unit, purchase_quantity, purchase_price, supplier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insumos Açaí
    const ingAcai = insertIngredient.run(acaiId, 'Açaí Puro Médio (Polpa Base)', 'g', 12000, 3000, 0.018, 'kg', 10, 180.0, 'Distribuidora Frutos do Pará').lastInsertRowid;
    const ingLeitePo = insertIngredient.run(acaiId, 'Leite em Pó Ninho', 'g', 2500, 600, 0.038, 'kg', 1, 38.0, 'Nestlé Distribuição').lastInsertRowid;
    const ingMorango = insertIngredient.run(acaiId, 'Morango Fresco Higienizado', 'g', 1800, 500, 0.024, 'kg', 2, 48.0, 'Ceasa Frutas').lastInsertRowid;
    const ingGranola = insertIngredient.run(acaiId, 'Granola Tradicional Crocante', 'g', 3500, 800, 0.018, 'kg', 1, 18.0, 'Grãos & Cia').lastInsertRowid;
    const ingBanana = insertIngredient.run(acaiId, 'Banana Prata Fatiada', 'g', 2000, 500, 0.007, 'kg', 3, 21.0, 'Ceasa Frutas').lastInsertRowid;
    const ingNutella = insertIngredient.run(acaiId, 'Nutella Original', 'g', 1500, 400, 0.065, 'kg', 3, 195.0, 'Ferrero Brasil').lastInsertRowid;
    const ingCopo300 = insertIngredient.run(acaiId, 'Copo Descartável 300ml', 'un', 150, 40, 0.35, 'un', 100, 35.0, 'Embalagens Silva').lastInsertRowid;
    const ingCopo500 = insertIngredient.run(acaiId, 'Copo Descartável 500ml', 'un', 220, 50, 0.45, 'un', 100, 45.0, 'Embalagens Silva').lastInsertRowid;
    const ingCopo700 = insertIngredient.run(acaiId, 'Copo Descartável 700ml', 'un', 110, 30, 0.55, 'un', 100, 55.0, 'Embalagens Silva').lastInsertRowid;
    const ingTampa = insertIngredient.run(acaiId, 'Tampa Plástica Transparente Bolha', 'un', 380, 80, 0.25, 'un', 100, 25.0, 'Embalagens Silva').lastInsertRowid;
    const ingColher = insertIngredient.run(acaiId, 'Colher Reforçada Sobremesa', 'un', 350, 100, 0.12, 'un', 100, 12.0, 'Embalagens Silva').lastInsertRowid;

    // Insumos Burguer
    const ingPaoBrioche = insertIngredient.run(burguerId, 'Pão de Brioche Artesanal', 'un', 80, 25, 1.80, 'un', 50, 90.0, 'Panificadora Rei').lastInsertRowid;
    const ingBlend160 = insertIngredient.run(burguerId, 'Blend Bovino 160g (Fraldinha/Peito)', 'g', 14400, 3200, 0.035, 'kg', 10, 350.0, 'Frigorífico Boi Gordo').lastInsertRowid;
    const ingCheddar = insertIngredient.run(burguerId, 'Queijo Cheddar Fatiado Especial', 'un', 180, 40, 0.80, 'kg', 2, 80.0, 'Laticínios Nobre').lastInsertRowid;
    const ingBacon = insertIngredient.run(burguerId, 'Bacon Defumado em Fatias Crocantes', 'g', 2800, 800, 0.045, 'kg', 3, 135.0, 'Frigorífico Boi Gordo').lastInsertRowid;
    const ingOvo = insertIngredient.run(burguerId, 'Ovo Caipira Grande', 'un', 60, 20, 0.85, 'un', 30, 25.5, 'Granja São Bento').lastInsertRowid;
    const ingMaionese = insertIngredient.run(burguerId, 'Maionese Especial da Casa', 'g', 2200, 500, 0.015, 'kg', 2, 30.0, 'Produção Própria').lastInsertRowid;
    const ingBatataCong = insertIngredient.run(burguerId, 'Batata Palito Pré-Frita Congelada', 'g', 18000, 4000, 0.012, 'kg', 10, 120.0, 'Distribuidora FoodService').lastInsertRowid;
    const ingEmbalagemBurguer = insertIngredient.run(burguerId, 'Embalagem Térmica Antivazamento King', 'un', 140, 40, 0.85, 'un', 100, 85.0, 'Embalagens Silva').lastInsertRowid;
    const ingEmbalagemBatata = insertIngredient.run(burguerId, 'Envelope Kraft Batata Frita', 'un', 120, 30, 0.40, 'un', 100, 40.0, 'Embalagens Silva').lastInsertRowid;

    // 4. Inserir Produtos
    const insertProduct = db.prepare(`
      INSERT INTO products (business_id, category_id, name, description, image_url, price, active, availability, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Produtos Açaí
    const prodAcai300 = insertProduct.run(
      acaiId,
      catAcaiCopo,
      'Açaí no Copo 300ml',
      'Copo de 300ml montado com nosso açaí cremoso batido na hora com xarope natural.',
      'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
      16.90,
      1,
      1,
      1
    ).lastInsertRowid;

    const prodAcai500 = insertProduct.run(
      acaiId,
      catAcaiCopo,
      'Açaí no Copo 500ml',
      'O clássico mais pedido! 500ml de puro açaí cremoso com camadas generosas de complementos.',
      'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
      22.90,
      1,
      1,
      2
    ).lastInsertRowid;

    const prodAcai700 = insertProduct.run(
      acaiId,
      catAcaiCopo,
      'Açaí no Copo 700ml',
      'Tamanho família individual. 700ml para saciar toda a sua vontade de açaí com máxima energia.',
      'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
      28.90,
      1,
      1,
      3
    ).lastInsertRowid;

    const prodAguaSemGas = insertProduct.run(
      acaiId,
      catAcaiBebidas,
      'Água Mineral Crystal 500ml',
      'Água mineral natural sem gás gelada.',
      'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
      4.50,
      1,
      1,
      10
    ).lastInsertRowid;

    // Produtos Burguer Oficiais
    const prodComboClassic = insertProduct.run(
      burguerId,
      catBurguerCombos,
      '2 King''s Classic + Coca 350ml',
      '2 king''s classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml',
      'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
      36.90,
      1,
      1,
      1
    ).lastInsertRowid;

    const prodComboDoubleBacon = insertProduct.run(
      burguerId,
      catBurguerCombos,
      'Combo Double Bacon',
      'Pão brioche, 2 hamburgueres de 120g cada, Queijo Cheddar cremoso, bacon crocante, cebola roxa e molho barbecue + 180g de batata com Cheddar e bacon',
      'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
      39.90,
      1,
      1,
      2
    ).lastInsertRowid;

    const prodDoubleBacon = insertProduct.run(
      burguerId,
      catBurguerArtesanal,
      'Kings Double Bacon',
      'Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.',
      'https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80',
      32.90,
      1,
      1,
      1
    ).lastInsertRowid;

    const prodClassic = insertProduct.run(
      burguerId,
      catBurguerArtesanal,
      'Kings Classic',
      'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.',
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
      19.90,
      1,
      1,
      2
    ).lastInsertRowid;

    const prodEggBacon = insertProduct.run(
      burguerId,
      catBurguerArtesanal,
      'Kings Egg Bacon',
      'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.',
      'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80',
      27.90,
      1,
      1,
      3
    ).lastInsertRowid;

    const prodBacon = insertProduct.run(
      burguerId,
      catBurguerArtesanal,
      'Kings Bacon',
      'Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.',
      'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80',
      24.90,
      1,
      1,
      4
    ).lastInsertRowid;

    const prodBatata150 = insertProduct.run(
      burguerId,
      catBurguerAcomp,
      'Batata Frita 150g',
      'Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição, São O Acompanhamento Ideal Para Hambúrgueres, Carnes e Refeições Rápidas, Ou Perfeitas Para Saborear Como Um Petisco Saboroso a Qualquer Hora Do Dia.',
      'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
      12.90,
      1,
      1,
      1
    ).lastInsertRowid;

    const prodBatataCheddarBacon = insertProduct.run(
      burguerId,
      catBurguerAcomp,
      'Batata Frita 200g+ Cheddar e Bacon Crocante',
      '180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.',
      'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80',
      17.90,
      1,
      1,
      2
    ).lastInsertRowid;

    const prodCocaLata = insertProduct.run(
      burguerId,
      catBurguerBebidas,
      'Coca-Cola 350ml',
      'Lata 350ml estupidamente gelada.',
      'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
      6.00,
      1,
      1,
      1
    ).lastInsertRowid;

    // 5. Inserir Fichas Técnicas / Receitas
    // Requisito 10: Cada produto deve possuir uma ficha técnica.
    // Exemplo: AÇAÍ 500ML: Açaí 400g, Leite em pó 30g, Morango 50g, Granola 20g, Copo 1 un, Tampa 1 un.
    const insertRecipeItem = db.prepare(`
      INSERT INTO recipe_items (product_id, ingredient_id, quantity) VALUES (?, ?, ?)
    `);

    // Ficha Técnica Açaí 500ml
    insertRecipeItem.run(prodAcai500, ingAcai, 400); // 400g a R$ 0.018 = R$ 7.20
    insertRecipeItem.run(prodAcai500, ingLeitePo, 30); // 30g a R$ 0.038 = R$ 1.14
    insertRecipeItem.run(prodAcai500, ingMorango, 50); // 50g a R$ 0.024 = R$ 1.20
    insertRecipeItem.run(prodAcai500, ingGranola, 20); // 20g a R$ 0.018 = R$ 0.36
    insertRecipeItem.run(prodAcai500, ingCopo500, 1); // 1 un a R$ 0.45 = R$ 0.45
    insertRecipeItem.run(prodAcai500, ingTampa, 1); // 1 un a R$ 0.25 = R$ 0.25
    insertRecipeItem.run(prodAcai500, ingColher, 1); // 1 un a R$ 0.12 = R$ 0.12
    // Custo Total Estimado Açaí 500ml: ~ R$ 10.72 | Preço: R$ 22.90 | CMV: 46.8% | Lucro Bruto: R$ 12.18

    // Ficha Técnica Açaí 300ml
    insertRecipeItem.run(prodAcai300, ingAcai, 250);
    insertRecipeItem.run(prodAcai300, ingLeitePo, 20);
    insertRecipeItem.run(prodAcai300, ingGranola, 15);
    insertRecipeItem.run(prodAcai300, ingCopo300, 1);
    insertRecipeItem.run(prodAcai300, ingTampa, 1);
    insertRecipeItem.run(prodAcai300, ingColher, 1);

    // Ficha Técnica Açaí 700ml
    insertRecipeItem.run(prodAcai700, ingAcai, 550);
    insertRecipeItem.run(prodAcai700, ingLeitePo, 40);
    insertRecipeItem.run(prodAcai700, ingMorango, 70);
    insertRecipeItem.run(prodAcai700, ingGranola, 30);
    insertRecipeItem.run(prodAcai700, ingCopo700, 1);
    insertRecipeItem.run(prodAcai700, ingTampa, 1);
    insertRecipeItem.run(prodAcai700, ingColher, 1);

    // Ficha Técnica 2 King's Classic + Coca
    insertRecipeItem.run(prodComboClassic, ingPaoBrioche, 2);
    insertRecipeItem.run(prodComboClassic, ingBlend160, 320);
    insertRecipeItem.run(prodComboClassic, ingCheddar, 4);
    insertRecipeItem.run(prodComboClassic, ingEmbalagemBurguer, 2);

    // Ficha Técnica Kings Classic
    insertRecipeItem.run(prodClassic, ingPaoBrioche, 1);
    insertRecipeItem.run(prodClassic, ingBlend160, 160);
    insertRecipeItem.run(prodClassic, ingCheddar, 2);
    insertRecipeItem.run(prodClassic, ingEmbalagemBurguer, 1);

    // Ficha Técnica Kings Bacon
    insertRecipeItem.run(prodBacon, ingPaoBrioche, 1);
    insertRecipeItem.run(prodBacon, ingBlend160, 160);
    insertRecipeItem.run(prodBacon, ingCheddar, 2);
    insertRecipeItem.run(prodBacon, ingBacon, 50);
    insertRecipeItem.run(prodBacon, ingEmbalagemBurguer, 1);

    // Ficha Técnica Batata Frita
    insertRecipeItem.run(prodBatata150, ingBatataCong, 150);
    insertRecipeItem.run(prodBatata150, ingEmbalagemBatata, 1);

    // 6. Inserir Grupos de Adicionais e Adicionais
    // Requisito 8: Açaí 500ml: 4 complementos grátis, depois pagos (Leite em pó, morango, nutella...)
    const insertAddonGroup = db.prepare(`
      INSERT INTO product_addon_groups (business_id, product_id, category_id, title, min_choices, max_choices, free_choices, required, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAddon = db.prepare(`
      INSERT INTO addons (group_id, business_id, name, price, cost, active) VALUES (?, ?, ?, ?, ?, 1)
    `);

    // Grupos de adicionais para Açaí
    const grpAcaiGratis = insertAddonGroup.run(acaiId, null, catAcaiCopo, 'Escolha até 4 complementos inclusos (Grátis)', 0, 4, 4, 0, 1).lastInsertRowid;
    insertAddon.run(grpAcaiGratis, acaiId, 'Leite em Pó', 0.0, 0.40);
    insertAddon.run(grpAcaiGratis, acaiId, 'Granola Crocante', 0.0, 0.30);
    insertAddon.run(grpAcaiGratis, acaiId, 'Banana Prata Fatiada', 0.0, 0.35);
    insertAddon.run(grpAcaiGratis, acaiId, 'Paçoca Rolha Esfarelada', 0.0, 0.40);
    insertAddon.run(grpAcaiGratis, acaiId, 'Calda de Chocolate', 0.0, 0.25);
    insertAddon.run(grpAcaiGratis, acaiId, 'Calda de Morango', 0.0, 0.25);

    const grpAcaiEspeciais = insertAddonGroup.run(acaiId, null, catAcaiCopo, 'Adicionais Especiais (Turbine seu copo)', 0, 6, 0, 0, 2).lastInsertRowid;
    insertAddon.run(grpAcaiEspeciais, acaiId, 'Morango Fresco em Pedaços (+50g)', 4.50, 1.20);
    insertAddon.run(grpAcaiEspeciais, acaiId, 'Nutella Original (+40g)', 6.00, 2.60);
    insertAddon.run(grpAcaiEspeciais, acaiId, 'Leite Condensado Moça', 3.00, 0.80);
    insertAddon.run(grpAcaiEspeciais, acaiId, 'Creme de Ninho da Casa', 4.00, 1.10);
    insertAddon.run(grpAcaiEspeciais, acaiId, 'Gotas de Chocolate Nobre', 3.50, 0.90);

    // Grupos de adicionais para Burguers
    const grpPontoCarne = insertAddonGroup.run(burguerId, null, catBurguerArtesanal, 'Ponto da Carne do Blend', 1, 1, 1, 1, 1).lastInsertRowid;
    insertAddon.run(grpPontoCarne, burguerId, 'Ao Ponto (Rosado no centro e suculento)', 0.0, 0.0);
    insertAddon.run(grpPontoCarne, burguerId, 'Bem Passado', 0.0, 0.0);
    insertAddon.run(grpPontoCarne, burguerId, 'Ao Ponto para Mal (Vermelho no centro)', 0.0, 0.0);

    const grpBurguerTurbine = insertAddonGroup.run(burguerId, null, catBurguerArtesanal, 'Turbine seu Burguer', 0, 4, 0, 0, 2).lastInsertRowid;
    insertAddon.run(grpBurguerTurbine, burguerId, 'Bacon Crocante Extra (+40g)', 5.00, 1.80);
    insertAddon.run(grpBurguerTurbine, burguerId, 'Queijo Cheddar Extra (2 Fatias)', 4.00, 1.60);
    insertAddon.run(grpBurguerTurbine, burguerId, 'Ovo Caipira Frito na Chapa', 3.50, 0.85);
    insertAddon.run(grpBurguerTurbine, burguerId, 'Pote Extra de Maionese da Casa', 3.00, 0.45);

    // 7. Configurações Iniciais
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('brand_name', "KING'S");
    insertSetting.run('admin_pin', '1234');
    insertSetting.run('auto_print_enabled', 'false');
    insertSetting.run('pix_key', 'pix@kingsgastronomia.com.br');
    insertSetting.run('pix_name', "KING'S GESTAO E ALIMENTOS LTDA");
    insertSetting.run('default_delivery_fee', '5.00');

    console.log('Database seeded successfully with clean business structure and real catalog recipes!');
  } else {
    console.log('Database already has records, skipping seed.');
  }
}

seedDatabase();
