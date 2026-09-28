const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

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

function initSchema() {
  try {
    if (isPostgres && pool) {
      pool.query(`
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
        ALTER TABLE coupons DISABLE ROW LEVEL SECURITY;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
      `).catch(err => console.warn('[DB SCHEMA INIT PG]', err.message));
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
    }
  } catch (err) {
    console.warn('[DB INIT SCHEMA]', err.message);
  }
}

// Inicializa schema automaticamente
initSchema();

module.exports = {
  db,
  initSchema
};
