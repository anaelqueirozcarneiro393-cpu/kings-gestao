const { db } = require('./db');

function seedAdvanced() {
  console.log('Seeding advanced restaurant operational data...');

  // 1. Delivery Zones (Bairros e Taxas)
  const zoneCount = db.prepare('SELECT COUNT(*) as count FROM delivery_zones').get().count;
  if (zoneCount === 0) {
    const insertZone = db.prepare('INSERT INTO delivery_zones (name, fee, estimated_minutes, active) VALUES (?, ?, ?, 1)');
    insertZone.run('Centro', 5.0, 30);
    insertZone.run('Jardim das Flores', 6.5, 35);
    insertZone.run('Bela Vista', 8.0, 40);
    insertZone.run('Parque Industrial', 10.0, 45);
    insertZone.run('Vila Nova', 7.0, 35);
    console.log('Delivery zones seeded!');
  }

  // 2. Couriers (Motoboys)
  const courierCount = db.prepare('SELECT COUNT(*) as count FROM couriers').get().count;
  if (courierCount === 0) {
    const insertCourier = db.prepare('INSERT INTO couriers (name, phone, daily_fee, fee_per_delivery, active) VALUES (?, ?, ?, ?, 1)');
    insertCourier.run('Lucas Silva (MOTO 01)', '(11) 98111-2233', 50.0, 4.0);
    insertCourier.run('Marcos Rocha (MOTO 02)', '(11) 98222-3344', 50.0, 4.0);
    insertCourier.run('Entregador Terceirizado / Diarista', '(11) 98333-4455', 60.0, 5.0);
    console.log('Couriers seeded!');
  }

  // 3. Connect Addons with Ingredients for precise stock deduction
  const baconIng = db.prepare("SELECT id FROM ingredients WHERE name LIKE '%Bacon%'").get();
  if (baconIng) {
    db.prepare("UPDATE addons SET ingredient_id = ?, ingredient_quantity = 40, ingredient_unit = 'g' WHERE name LIKE '%Bacon Crocante Extra%'").run(baconIng.id);
  }

  const morangoIng = db.prepare("SELECT id FROM ingredients WHERE name LIKE '%Morango%'").get();
  if (morangoIng) {
    db.prepare("UPDATE addons SET ingredient_id = ?, ingredient_quantity = 50, ingredient_unit = 'g' WHERE name LIKE '%Morango Fresco%'").run(morangoIng.id);
  }

  const nutellaIng = db.prepare("SELECT id FROM ingredients WHERE name LIKE '%Nutella%'").get();
  if (nutellaIng) {
    db.prepare("UPDATE addons SET ingredient_id = ?, ingredient_quantity = 40, ingredient_unit = 'g' WHERE name LIKE '%Nutella%'").run(nutellaIng.id);
  }

  const cheddarIng = db.prepare("SELECT id FROM ingredients WHERE name LIKE '%Cheddar%'").get();
  if (cheddarIng) {
    db.prepare("UPDATE addons SET ingredient_id = ?, ingredient_quantity = 2, ingredient_unit = 'un' WHERE name LIKE '%Cheddar Extra%'").run(cheddarIng.id);
  }

  const ovoIng = db.prepare("SELECT id FROM ingredients WHERE name LIKE '%Ovo%'").get();
  if (ovoIng) {
    db.prepare("UPDATE addons SET ingredient_id = ?, ingredient_quantity = 1, ingredient_unit = 'un' WHERE name LIKE '%Ovo Caipira%'").run(ovoIng.id);
  }

  // 4. Default Operational Settings
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('card_fee_credit', '3.2');
  insertSetting.run('card_fee_debit', '1.8');
  insertSetting.run('card_fee_pix', '0.0');
  insertSetting.run('whatsapp_store_phone', '5511999991000');
  insertSetting.run('is_kitchen_paused', 'false');
  insertSetting.run('auto_sound_alert', 'true');

  console.log('Advanced restaurant operational data ready!');
}

seedAdvanced();
