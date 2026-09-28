const { db } = require('./db');

// Update Batata: Pacote de 2kg por R$ 23,90
db.prepare(`
  UPDATE ingredients SET
    purchase_type = 'pacote_peso',
    package_size = 2,
    package_unit = 'kg',
    purchase_price = 23.90,
    cost_per_unit = 0.01195,
    portion_sim_qty = 150
  WHERE name LIKE '%Batata%'
`).run();

// Update Blend Bovino: R$ 34,90 o kg
db.prepare(`
  UPDATE ingredients SET
    purchase_type = 'peso_kg',
    package_size = 1,
    package_unit = 'kg',
    purchase_price = 34.90,
    cost_per_unit = 0.0349,
    portion_sim_qty = 160
  WHERE name LIKE '%Blend Bovino%'
`).run();

// Update Bacon: Pacote 1kg por R$ 38,00
db.prepare(`
  UPDATE ingredients SET
    purchase_type = 'pacote_peso',
    package_size = 1,
    package_unit = 'kg',
    purchase_price = 38.00,
    cost_per_unit = 0.038,
    portion_sim_qty = 50
  WHERE name LIKE '%Bacon%'
`).run();

// Update Pao Brioche: Fardo com 12 por R$ 21,60 (R$ 1,80 a unidade)
db.prepare(`
  UPDATE ingredients SET
    purchase_type = 'caixa_unidades',
    package_size = 12,
    package_unit = 'un',
    purchase_price = 21.60,
    cost_per_unit = 1.80,
    portion_sim_qty = 1
  WHERE name LIKE '%Pão%'
`).run();

// Update Açaí: Caixa 10kg por R$ 180,00
db.prepare(`
  UPDATE ingredients SET
    purchase_type = 'pacote_peso',
    package_size = 10,
    package_unit = 'kg',
    purchase_price = 180.00,
    cost_per_unit = 0.018,
    portion_sim_qty = 400
  WHERE name LIKE '%Açaí Puro%'
`).run();

console.log('Sample ingredients updated with exact packaging examples!');
