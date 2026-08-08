// In-memory database - works on all cloud platforms without native compilation
class InMemoryDB {
  constructor() {
    this.tables = {
      users: [],
      wallets: [],
      payment_methods: []
    };
    this.autoIncrement = {
      users: 0,
      wallets: 0,
      payment_methods: 0
    };
    console.log('Database tables initialized successfully.');
  }

  run(sql, params = [], callback) {
    try {
      const sqlLower = sql.trim().toLowerCase();

      if (sqlLower.startsWith('create table')) {
        if (callback) callback.call({ lastID: 0 }, null);
        return;
      }

      if (sqlLower.startsWith('insert into')) {
        const tableMatch = sql.match(/insert into (\w+)/i);
        if (!tableMatch) {
          if (callback) callback.call({}, new Error('Invalid INSERT'));
          return;
        }
        const table = tableMatch[1];

        const colMatch = sql.match(/\(([^)]+)\)\s+values\s+\(([^)]+)\)/i);
        if (!colMatch) {
          if (callback) callback.call({}, new Error('Invalid INSERT syntax'));
          return;
        }

        const columns = colMatch[1].split(',').map(c => c.trim());
        const row = { id: ++this.autoIncrement[table] };

        let paramIndex = 0;
        columns.forEach((col) => {
          const valPlaceholders = sql.match(/values\s*\(([^)]+)\)/i)[1].split(',').map(v => v.trim());
          const valForCol = valPlaceholders[columns.indexOf(col)];
          if (valForCol === '?') {
            row[col] = params[paramIndex++];
          } else {
            // Literal value like 'USDT'
            row[col] = valForCol.replace(/'/g, '');
          }
        });

        // Check unique constraint for phone_number
        if (table === 'users') {
          const existing = this.tables.users.find(u => u.phone_number === row.phone_number);
          if (existing) {
            if (callback) callback.call({}, new Error('UNIQUE constraint failed: users.phone_number'));
            return;
          }
        }

        if (!this.tables[table]) this.tables[table] = [];
        this.tables[table].push(row);
        if (callback) callback.call({ lastID: row.id }, null);
        return;
      }

      if (sqlLower.startsWith('update')) {
        const tableMatch = sql.match(/update (\w+)\s+set/i);
        if (!tableMatch) {
          if (callback) callback.call({}, new Error('Invalid UPDATE'));
          return;
        }
        const table = tableMatch[1];

        const setMatch = sql.match(/set\s+(\w+)\s*=\s*\?/i);
        const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);

        if (setMatch && whereMatch) {
          const setCol = setMatch[1];
          const whereCol = whereMatch[1];
          const setValue = params[0];
          const whereValue = params[1];

          const row = this.tables[table].find(r => String(r[whereCol]) === String(whereValue));
          if (row) {
            row[setCol] = setValue;
          }
        }

        if (callback) callback.call({}, null);
        return;
      }

      if (sqlLower.startsWith('delete')) {
        const tableMatch = sql.match(/from\s+(\w+)/i);
        const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
        if (tableMatch && whereMatch) {
          const table = tableMatch[1];
          const col = whereMatch[1];
          const val = params[0];
          this.tables[table] = this.tables[table].filter(r => String(r[col]) !== String(val));
        }
        if (callback) callback.call({}, null);
        return;
      }

      if (callback) callback.call({}, null);
    } catch (err) {
      if (callback) callback.call({}, err);
    }
  }

  get(sql, params = [], callback) {
    try {
      const sqlLower = sql.trim().toLowerCase();

      // Handle JOIN queries (for forgot-password)
      if (sqlLower.includes('join')) {
        const phoneParam = params[0];
        const user = this.tables.users.find(u => u.phone_number === phoneParam);
        callback(null, user || null);
        return;
      }

      const tableMatch = sql.match(/from\s+(\w+)/i);
      if (!tableMatch) {
        callback(new Error('Invalid SELECT'), null);
        return;
      }
      const table = tableMatch[1];

      const whereMatch = sql.match(/where\s+(?:\w+\.)?(\w+)\s*=\s*\?/i);
      if (whereMatch) {
        const col = whereMatch[1];
        const val = params[0];
        const row = this.tables[table].find(r => String(r[col]) === String(val));
        callback(null, row || null);
      } else {
        callback(null, this.tables[table][0] || null);
      }
    } catch (err) {
      callback(err, null);
    }
  }

  all(sql, params = [], callback) {
    try {
      const tableMatch = sql.match(/from\s+(\w+)/i);
      if (!tableMatch) {
        callback(new Error('Invalid SELECT'), []);
        return;
      }
      const table = tableMatch[1];

      const whereMatch = sql.match(/where\s+(?:\w+\.)?(\w+)\s*=\s*\?/i);
      if (whereMatch) {
        const col = whereMatch[1];
        const val = params[0];
        const rows = (this.tables[table] || []).filter(r => String(r[col]) === String(val));
        callback(null, rows);
      } else {
        callback(null, this.tables[table] || []);
      }
    } catch (err) {
      callback(err, []);
    }
  }
}

const db = new InMemoryDB();
module.exports = db;
