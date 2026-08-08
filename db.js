class InMemoryDB {
  constructor() {
    this.tables = { users: [], wallets: [], payment_methods: [] };
    this.autoIncrement = { users: 0, wallets: 0, payment_methods: 0 };
    console.log('Database tables initialized successfully.');
  }
  run(sql, params = [], callback) {
    try {
      const sqlLower = sql.trim().toLowerCase();
      if (sqlLower.startsWith('create table')) { if (callback) callback.call({ lastID: 0 }, null); return; }
      if (sqlLower.startsWith('insert into')) {
        const tableMatch = sql.match(/insert into (\w+)/i);
        if (!tableMatch) { if (callback) callback.call({}, new Error('Invalid INSERT')); return; }
        const table = tableMatch[1];
        const colMatch = sql.match(/\(([^)]+)\)\s+values\s+\(([^)]+)\)/i);
        if (!colMatch) { if (callback) callback.call({}, new Error('Invalid INSERT syntax')); return; }
        const columns = colMatch[1].split(',').map(c => c.trim());
        const valueParts = colMatch[2].split(',').map(v => v.trim());
        const row = { id: ++this.autoIncrement[table] };
        let pi = 0;
        columns.forEach((col, i) => { row[col] = valueParts[i] === '?' ? params[pi++] : valueParts[i].replace(/'/g, ''); });
        if (table === 'users' && this.tables.users.find(u => u.phone_number === row.phone_number)) {
          if (callback) callback.call({}, new Error('UNIQUE constraint failed: users.phone_number')); return;
        }
        if (!this.tables[table]) this.tables[table] = [];
        this.tables[table].push(row);
        if (callback) callback.call({ lastID: row.id }, null); return;
      }
      if (sqlLower.startsWith('update')) {
        const tableMatch = sql.match(/update (\w+)\s+set/i);
        const setMatch = sql.match(/set\s+(\w+)\s*=\s*\?/i);
        const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
        if (tableMatch && setMatch && whereMatch) {
          const row = this.tables[tableMatch[1]].find(r => String(r[whereMatch[1]]) === String(params[1]));
          if (row) row[setMatch[1]] = params[0];
        }
        if (callback) callback.call({}, null); return;
      }
      if (sqlLower.startsWith('delete')) {
        const tableMatch = sql.match(/from\s+(\w+)/i);
        const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i);
        if (tableMatch && whereMatch) {
          this.tables[tableMatch[1]] = this.tables[tableMatch[1]].filter(r => String(r[whereMatch[1]]) !== String(params[0]));
        }
        if (callback) callback.call({}, null); return;
      }
      if (callback) callback.call({}, null);
    } catch (err) { if (callback) callback.call({}, err); }
  }
  get(sql, params = [], callback) {
    try {
      if (sql.toLowerCase().includes('join')) { callback(null, this.tables.users.find(u => u.phone_number === params[0]) || null); return; }
      const tableMatch = sql.match(/from\s+(\w+)/i);
      if (!tableMatch) { callback(new Error('Invalid SELECT'), null); return; }
      const whereMatch = sql.match(/where\s+(?:\w+\.)?(\w+)\s*=\s*\?/i);
      if (whereMatch) { callback(null, this.tables[tableMatch[1]].find(r => String(r[whereMatch[1]]) === String(params[0])) || null); }
      else { callback(null, this.tables[tableMatch[1]][0] || null); }
    } catch (err) { callback(err, null); }
  }
  all(sql, params = [], callback) {
    try {
      const tableMatch = sql.match(/from\s+(\w+)/i);
      if (!tableMatch) { callback(new Error('Invalid SELECT'), []); return; }
      const whereMatch = sql.match(/where\s+(?:\w+\.)?(\w+)\s*=\s*\?/i);
      if (whereMatch) { callback(null, (this.tables[tableMatch[1]] || []).filter(r => String(r[whereMatch[1]]) === String(params[0]))); }
      else { callback(null, this.tables[tableMatch[1]] || []); }
    } catch (err) { callback(err, []); }
  }
}
const db = new InMemoryDB();
module.exports = db;
