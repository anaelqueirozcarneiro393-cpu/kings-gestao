const { db, isPostgres } = require('../server/db');

async function seedBurguerMenu() {
  console.log('[SEED] Iniciando atualização completa do cardápio King\'s Burguer no banco...');

  try {
    // 1. Assegurar categorias exatas de King's Burguer (business_id = 2)
    // Deletar categorias antigas que não são mais usadas pelo burguer após reatribuir
    const categoriesData = [
      { id: 10, business_id: 2, name: 'Combos Individuais', order_index: 1, discount_badge: '20% OFF' },
      { id: 11, business_id: 2, name: 'Combos para 2', order_index: 2, discount_badge: '30% OFF' },
      { id: 12, business_id: 2, name: 'Hambúrguer Artesanal', order_index: 3, discount_badge: '20% OFF' },
      { id: 13, business_id: 2, name: 'Acompanhamentos', order_index: 4, discount_badge: '30% OFF' },
      { id: 14, business_id: 2, name: 'Bebidas', order_index: 5, discount_badge: null }
    ];

    for (const cat of categoriesData) {
      if (isPostgres) {
        await db.prepare(`
          INSERT INTO categories (id, business_id, name, order_index, active)
          VALUES (?, ?, ?, ?, 1)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            order_index = EXCLUDED.order_index,
            active = 1
        `).run(cat.id, cat.business_id, cat.name, cat.order_index);
      } else {
        await db.prepare(`
          INSERT OR REPLACE INTO categories (id, business_id, name, order_index, active)
          VALUES (?, ?, ?, ?, 1)
        `).run(cat.id, cat.business_id, cat.name, cat.order_index);
      }
    }
    console.log('[SEED] Categorias do King\'s Burguer atualizadas.');

    // 2. Lista oficial de produtos conforme fotos do usuário
    const productsData = [
      // --- COMBOS INDIVIDUAIS (Category 10) ---
      {
        id: 110,
        business_id: 2,
        category_id: 10,
        name: "Combo King's Double Bacon",
        description: "1 King's Double Bacon + 1 porção de Batata 150g + 1 Coca-Cola 350ml.",
        price: 44.90,
        image_url: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80",
        order_index: 1
      },
      {
        id: 111,
        business_id: 2,
        category_id: 10,
        name: "Combo King's Egg Bacon",
        description: "1 King's Egg Bacon + 1 porção de Batata 150g + 1 Coca-Cola 350ml.",
        price: 39.90,
        image_url: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
        order_index: 2
      },
      {
        id: 112,
        business_id: 2,
        category_id: 10,
        name: "Combo King's Bacon",
        description: "1 King's Bacon + 1 porção de Batata 150g + 1 Coca-Cola 350ml.",
        price: 34.90,
        image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
        order_index: 3
      },
      {
        id: 113,
        business_id: 2,
        category_id: 10,
        name: "Combo King's Classic",
        description: "1 King's Classic + 1 porção de Batata 150g + 1 Coca-Cola 350ml.",
        price: 29.90,
        image_url: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80",
        order_index: 4
      },
      {
        id: 114,
        business_id: 2,
        category_id: 10,
        name: "Combo King's BBQ",
        description: "1 King's BBQ + 1 porção de Batata Frita 150g + 1 Coca-Cola 350ml.",
        price: 26.90,
        image_url: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=600&q=80",
        order_index: 5
      },

      // --- COMBOS PARA 2 (Category 11) ---
      {
        id: 115,
        business_id: 2,
        category_id: 11,
        name: "Combo Casal Supremo",
        description: "1 King's Egg Bacon + 1 King's Double Bacon + 1 Batata 200g com cheddar e bacon crocante + 2 Coca-Cola 350ml.",
        price: 77.90,
        image_url: "https://images.unsplash.com/photo-1521305916504-4a1121188589?auto=format&fit=crop&w=600&q=80",
        order_index: 1
      },
      {
        id: 116,
        business_id: 2,
        category_id: 11,
        name: "Combo Casal Bacon",
        description: "2 King's Bacon + 1 Batata 200g com cheddar e bacon crocante + 2 Coca-Cola 350ml.",
        price: 67.90,
        image_url: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80",
        order_index: 2
      },
      {
        id: 101,
        business_id: 2,
        category_id: 11,
        name: "2 king's classic + Coca lata 350ml",
        description: "2 king's classic com: Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue (cada unidade) + 1 Coca lata 350ml",
        price: 39.90,
        image_url: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
        order_index: 3
      },

      // --- HAMBÚRGUER ARTESANAL (Category 12) ---
      {
        id: 103,
        business_id: 2,
        category_id: 12,
        name: "Kings Double Bacon",
        description: "Pão brioche, dois hambúrgueres de 120g cada, queijo cheddar cremoso, bacon crocante, cebola roxa e molho barbecue.",
        price: 32.90,
        image_url: "https://images.unsplash.com/photo-1582196016295-f8c8bd4b3e99?auto=format&fit=crop&w=600&q=80",
        order_index: 1
      },
      {
        id: 105,
        business_id: 2,
        category_id: 12,
        name: "Kings Egg Bacon",
        description: "Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, ovo, alface, tomate, cebola roxa e molho barbecue.",
        price: 29.90,
        image_url: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=600&q=80",
        order_index: 2
      },
      {
        id: 106,
        business_id: 2,
        category_id: 12,
        name: "Kings Bacon",
        description: "Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, bacon crocante, alface, tomate, cebola roxa e molho barbecue.",
        price: 24.90,
        image_url: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=80",
        order_index: 3
      },
      {
        id: 104,
        business_id: 2,
        category_id: 12,
        name: "Kings Classic",
        description: "Pão brioche, hambúrguer artesanal de 160g, queijo cheddar cremoso, alface, tomate, cebola roxa e molho barbecue.",
        price: 19.90,
        image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
        order_index: 4
      },
      {
        id: 117,
        business_id: 2,
        category_id: 12,
        name: "King's BBQ",
        description: "Pão brioche, carne artesanal de 160g, cheddar cremoso e molho barbecue.",
        price: 15.90,
        image_url: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80",
        order_index: 5
      },

      // --- ACOMPANHAMENTOS (Category 13) ---
      {
        id: 118,
        business_id: 2,
        category_id: 13,
        name: "Batata King's 300g + Cheddar & Bacon",
        description: "300g de batata frita, coberta com cheddar cremoso e bacon crocante.",
        price: 24.90,
        image_url: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=600&q=80",
        order_index: 1
      },
      {
        id: 108,
        business_id: 2,
        category_id: 13,
        name: "Batata Frita 200g+ Cheddar e Bacon Crocante",
        description: "180g de batatas fritas, cobertas com queijo cheddar cremoso e bacon crocante.",
        price: 17.90,
        image_url: "https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80",
        order_index: 2
      },
      {
        id: 119,
        business_id: 2,
        category_id: 13,
        name: "Batata Cheddar",
        description: "Batata 150g + Cheddar",
        price: 14.90,
        image_url: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80",
        order_index: 3
      },
      {
        id: 107,
        business_id: 2,
        category_id: 13,
        name: "Batata Frita 150g",
        description: "Batatas Fritas Sequinhas, Crocantes por Fora e Macias por Dentro. Cortadas No Ponto Certo e Douradas À Perfeição, São O Acompanhamento Ideal Para Hambúrgueres.",
        price: 11.90,
        image_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
        order_index: 4
      },

      // --- BEBIDAS (Category 14) ---
      {
        id: 120,
        business_id: 2,
        category_id: 14,
        name: "2 Coca 350ml",
        description: "2 Coca-Cola lata 350ml estupidamente geladas.",
        price: 10.00,
        image_url: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80",
        order_index: 1
      },
      {
        id: 109,
        business_id: 2,
        category_id: 14,
        name: "Coca-Cola 350ml",
        description: "Lata 350ml estupidamente gelada.",
        price: 6.00,
        image_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80",
        order_index: 2
      }
    ];

    // Deletar produtos antigos obsoletos de burguer (como o 102 que era combo genérico)
    await db.prepare('DELETE FROM products WHERE business_id = 2 AND id = 102').run();

    for (const prod of productsData) {
      if (isPostgres) {
        await db.prepare(`
          INSERT INTO products (id, business_id, category_id, name, description, image_url, price, active, availability, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
          ON CONFLICT (id) DO UPDATE SET
            business_id = EXCLUDED.business_id,
            category_id = EXCLUDED.category_id,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image_url = EXCLUDED.image_url,
            price = EXCLUDED.price,
            active = 1,
            availability = 1,
            order_index = EXCLUDED.order_index
        `).run(prod.id, prod.business_id, prod.category_id, prod.name, prod.description, prod.image_url, prod.price, prod.order_index);
      } else {
        await db.prepare(`
          INSERT OR REPLACE INTO products (id, business_id, category_id, name, description, image_url, price, active, availability, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
        `).run(prod.id, prod.business_id, prod.category_id, prod.name, prod.description, prod.image_url, prod.price, prod.order_index);
      }
    }

    console.log(`[SEED] ${productsData.length} produtos do King's Burguer inseridos/atualizados com sucesso!`);
    console.log('[SEED] Concluído com êxito!');
    process.exit(0);
  } catch (err) {
    console.error('[SEED ERRO]', err);
    process.exit(1);
  }
}

seedBurguerMenu();
