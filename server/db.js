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
function formatSqlForPg(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
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
  if (sqliteDb) {
    // schema local SQLite se necessário
  }
}

module.exports = {
  db,
  initSchema
};
