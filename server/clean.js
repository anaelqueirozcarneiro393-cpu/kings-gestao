const { db } = require('./db');

function clean() {
  db.prepare('DELETE FROM order_item_addons').run();
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM stock_movements').run();
  db.prepare('DELETE FROM orders').run();
  db.prepare('DELETE FROM expenses').run();
  db.prepare('UPDATE ingredients SET current_stock = 12000 WHERE id = 1').run();
  db.prepare('UPDATE ingredients SET current_stock = 14400 WHERE id = 13').run();
  try {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run('orders');
  } catch {}
  console.log('Database cleanly reset for production with authentic zero data (empty states)!');
}

clean();
