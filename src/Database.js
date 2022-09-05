class DB {
  constructor(name, opts) {
    if (!opts) opts = {};
    this.name = name;
    this.verbose = opts.verbose || false;

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

  load(data) {
    console.log(`Loading state for database: "${this.name}"`);

    let db = JSON.parse(data);

    let keys = Object.keys(db);
    let tableKeys = [];
    let records = {};
    let recordIds = {};

    // Guard against non-tables
    keys.forEach(key => {
      if (typeof db[key] === 'object' && db[key].isTable) tableKeys.push(key);
    });

    // Sort by references
    let sortedKeys = [];

    tableKeys.forEach(key => {
      let refs = this[key].schema.refs;
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

    // Reset the database
    for (let key of sortedKeys) {
      // Cache records
      records[key] = [...Object.values(db[key].table)];

      // Cache references
      let refs = this[key].schema.refs;

      // Replace foreign Ids
      records[key].forEach(record => {
        let recordKeys = Object.keys(record);
        recordKeys.forEach(recordKey => {
          if (Object.keys(refs).length === 0) return;
          if (!refs.hasOwnProperty(recordKey) || recordKey === 'id') return;

          let refTable = refs[recordKey].table;
          let refField = refs[recordKey].field;

          if (!recordIds[refTable][refField]) return;
          // console.log(`Replacing key: ${recordKey} | ${record[recordKey]} > ${recordIds[refTable][refField][record[recordKey]]}`);

          record[recordKey] = recordIds[refTable][refField][record[recordKey]];
        });
        return record;
      });

      // Delete current records
      this[key].delete();
      this[key].indexed = {};

      // Cache old record ids
      let oldRecordIds = [];
      records[key].forEach(r => oldRecordIds.push(r.__id));

      // Add saved records
      let newRecords = this[key].insert(records[key]);

      // Cache new record ids
      let newRecordIds = [];
      newRecords.forEach(r => newRecordIds.push(r.__id));

      // Cache OLD_ID:NEW_ID relationship
      recordIds[key] = {};
      records[key].forEach((record, i) => {
        let recordKeys = Object.keys(record);
        recordKeys.forEach(recordKey => {
          if (!refs.hasOwnProperty(recordKey) && recordKey !== 'id') return;
          if (!recordIds[key][recordKey]) recordIds[key][recordKey] = {};
          recordIds[key][recordKey][oldRecordIds[i]] = newRecordIds[i];
        });
      });
    }

    return this;
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
    this[name] = new Table(schema);
    this[name].db = this;
    this[name].name = name;
    this[name].schema.table = this[name];
  }

  dropTable(name) {
    delete this[name];
  }

  migration(tableName, fn) {
    let schema = new Schema();

    // By default set the id to unique
    // TODO: Change keys to dynamic and allow primary key assignment
    schema.uniqueKeys.__id = true;
    schema.validation.__id = [
      {
        fn: 'isUnique',
      },
      {
        fn: 'isNotNull',
      },
    ];

    let tableSchema = fn(schema);
    this.createTable(tableName, tableSchema);
    return this;
  }

  getTableNames() {
    let names = [];
    let keys = Object.keys(this);
    for (let key of keys) {
      if (typeof this[key] !== 'object') continue;
      if (this[key].isTable) names.push(key);
    }
    return names;
  }

  error(msg) {
    if (this.verbose) console.error(msg);
  }

  stringify() {
    return JSON.stringify(this, this.replacerFunc());
  }
}

module.exports = DB;
