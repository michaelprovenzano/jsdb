class DB {
  constructor(name, opts) {
    if (!opts) opts = {};
    this.name = name;
    this.verbose = opts.verbose || false;

    this._tables = {};

    this.save = this.save.bind(this);
    this.loadFromLocalStorage = this.loadFromLocalStorage.bind(this);
    this.loadFromFile = this.loadFromFile.bind(this);
  }

  save() {
    let stringDB = this.stringify();
    window.localStorage.setItem(this.name, stringDB);
  }

  replacerFunc() {
    const visited = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (visited.has(value)) {
          return;
        }
        visited.add(value);
      }
      return value;
    };
  }

  load(data, migrationFile) {
    console.log(`Loading state for database: "${this.name}"`);

    // Reset the database
    this.dropAllTables();

    // Run migration file
    migrationFile(this);

    // Populate database
    let db = JSON.parse(data);
    let tableKeys = Object.keys(db._tables);
    tableKeys = this.sortKeysByReferences(tableKeys, db);

    // Add the records
    for (let key of tableKeys) {
      let curTable = this._tables[key];
      let records = Object.values(db._tables[key]._records);
      curTable.insert(records);
    }

    return this;
  }

  sortKeysByReferences(tableKeys, db) {
    let sortedKeys = [];
    tableKeys.forEach(key => {
      let curTable = db._tables[key];
      let refs = curTable.schema.refs;
      if (!refs) refs = {};
      let tableRefs = Object.values(refs);
      if (tableRefs.length === 0) return sortedKeys.push(key);

      let safeIndex = -1;
      tableRefs.forEach(ref => {
        let refIndex = sortedKeys.indexOf(ref.table);
        if (refIndex === -1) return;
        if (refIndex > safeIndex) safeIndex = refIndex;
      });

      safeIndex === -1 ? sortedKeys.push(key) : sortedKeys.splice(safeIndex + 1, 0, key);
    });

    return sortedKeys;
  }

  dropAllTables() {
    let tableKeys = Object.keys(this._tables);
    tableKeys.forEach(key => this.dropTable(key));
  }

  loadFromLocalStorage() {
    let db = window.localStorage.getItem(this.name);
    if (!db) return this;
    this.load(db);
  }

  loadFromFile(file) {
    if (!file) return this;
    this.load(file);
  }

  exists(dbName) {
    let db = window.localStorage.getItem(dbName);
    if (db) return true;
  }

  createTable(name, schema) {
    let newTable = new Table(schema);

    newTable.db = this;
    newTable.name = name;
    newTable.schema.table = newTable;

    this._tables[name] = newTable;
    this[name] = new Query(newTable);
  }

  dropTable(name) {
    delete this[name];
    delete this._tables[name];
  }

  migration(tableName, fn) {
    let schema = new Schema();
    let tableSchema = fn(schema);
    this.createTable(tableName, tableSchema);
    return this;
  }

  error(msg) {
    if (this.verbose) console.error(msg);
  }

  stringify() {
    return JSON.stringify(this, this.replacerFunc());
  }
}

module.exports = DB;
