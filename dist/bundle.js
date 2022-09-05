class Schema {
  constructor(table) {
    this.validation = {};
    this.props = [];
    this.table = table;
    this.uniqueKeys = {};
    this.refs = {};
    this.defaults = {};

    this.string = this.string.bind(this);
    this.isString = this.isString.bind(this);
    this.addValidation = this.addValidation.bind(this);
    this.isValid = this.isValid.bind(this);
  }

  string(value) {
    this.props.push(value);
    this.addValidation(value, 'isString');
    return this;
  }

  isString(value) {
    return typeof value === 'string';
  }

  integer(value) {
    this.props.push(value);
    this.addValidation(value, 'isInteger');
    return this;
  }

  isInteger(value) {
    return (typeof value === 'number' && Number.isInteger(value)) || Number.isNaN(value);
  }

  float(value) {
    this.props.push(value);
    this.addValidation(value, 'isFloat');
    return this;
  }

  isFloat(value) {
    return typeof value === 'number' && !Number.isNaN(value);
  }

  boolean(value) {
    this.props.push(value);
    this.addValidation(value, 'isBoolean');
    return this;
  }

  isBoolean(value) {
    return typeof value === 'boolean';
  }

  notNullable() {
    this.addValidation(this.currentValue(), 'isNotNull');
    return this;
  }

  isNotNull(value) {
    return typeof value !== null;
  }

  references(field) {
    if (!this.refs[this.currentValue()]) this.refs[this.currentValue()] = {};
    this.refs[this.currentValue()].field = field;
    this.addValidation(this.currentValue(), 'isReferenceValid');
    return this;
  }

  isReferenceValid(value, key) {
    if (value === null || value === undefined || value === '') return true;
    let isValid = false;
    let currentReference = this.refs[key];
    if (!currentReference) return true;

    let table = this.table;

    if (currentReference.table) table = this.table.db[currentReference.table];
    let hasRef = table.indexed[currentReference.field];
    if (!hasRef) {
      this.table.db.error('Referenced fields must be UNIQUE');
      return false;
    }
    if (hasRef.hasOwnProperty(value)) isValid = true;

    return isValid;
  }

  fromTable(table) {
    if (!this.refs[this.currentValue()]) this.refs[this.currentValue()] = {};
    this.refs[this.currentValue()].table = table;
    return this;
  }

  unique() {
    this.uniqueKeys[this.currentValue()] = true;
    this.addValidation(this.currentValue(), 'isUnique');
    return this;
  }

  isUnique(value, key) {
    if (this.table.indexed[key] === undefined) return true;

    return !this.table.indexed[key].hasOwnProperty(value);
  }

  currentValue() {
    return this.props[this.props.length - 1];
  }

  addValidation(value, fn) {
    if (!this.validation[value]) this.validation[value] = [];
    this.validation[value].push({
      fn: fn,
    });
  }

  default(value) {
    this.defaults[this.currentValue()] = value;
    return this;
  }

  setDefaults(record) {
    let newRecord = {};

    let keys = Object.keys(this.validation);
    keys.forEach(key => {
      if (!record.hasOwnProperty(key)) return (newRecord[key] = this.defaults[key]);
      newRecord[key] = record[key];
    });

    return newRecord;
  }

  normalize(record) {
    // console.log('Normalize raw: ', record);
    // TODO: More robust testing and features for this method
    let keys = Object.keys(this.validation);
    let normalizedRecord = {};

    for (let key of keys) {
      if (!record.hasOwnProperty(key)) continue;

      let type = this.validation[key][0].fn;
      normalizedRecord[key] = record[key];
      // console.log('Normalizing: ' + key, 'Type Recieved: ' + typeof record[key], 'Type Expected: ' + type);
      if (type === 'isInteger') {
        if (typeof record[key] === 'string') record[key] = parseFloat(record[key]);
        if (
          typeof parseInt(record[key]) === 'number' &&
          Number.isInteger(parseFloat(record[key]))
        ) {
          normalizedRecord[key] = parseInt(record[key]);
        } else if (Number.isNaN(record[key])) {
          normalizedRecord[key] = null;
        }
      } else if (type === 'isString') {
        if (typeof record[key] === 'number') normalizedRecord[key] = record[key] + '';
        if (typeof record[key] === 'undefined') normalizedRecord[key] = '';
      } else if (type === 'boolean') {
        if (typeof record[key] === 'boolean') continue;
        if (typeof record[key] === 'string') {
          if (record[key].toLowerCase() === 'true') {
            normalizedRecord[key] = true;
          } else if (record[key].toLowerCase() === 'false') {
            normalizedRecord[key] = false;
          } else {
            record[key] ? (normalizedRecord[key] = true) : (normalizedRecord[key] = false);
          }
        }
      } else {
        if (record.hasOwnProperty(key)) normalizedRecord[key] = record[key];
      }
    }

    // console.log('After:', normalizedRecord);

    return normalizedRecord;
  }

  isValid(record) {
    let keys = Object.keys(this.validation);

    let isValid = true;
    for (let key of keys) {
      let isNullable =
        Object.values(this.validation[key]).filter(val => val.fn === 'isNotNull').length === 0;
      this.validation[key].forEach((check, i) => {
        if (!record.hasOwnProperty(key)) return;
        // console.log('Validating: ' + key, record[key], check.fn);
        if (!this[check.fn](record[key], key)) {
          // console.warn('Invalid: ' + key, record[key], check.fn);
          isValid = false;

          if (isNullable && record[key] === null) return (isValid = true);
          this.table.db.error(
            `Validation check [${check.fn}] failed for VALUE(${typeof record[key]}) [${
              record[key]
            }] of KEY [${key}]`
          );
        }
      });
    }

    return isValid;
  }

  removeId(record) {
    let newRecord = {};

    let keys = Object.keys(record);
    keys.forEach(key => {
      if (key !== 'id') newRecord[key] = record[key];
    });

    return newRecord;
  }
}

class Table {
  constructor(schema) {
    this.table = {};
    this.schema = schema;
    this.isTable = true;
    this.indexed = {};

    this.insert = this.insert.bind(this);
    this.where = this.where.bind(this);
    this.select = this.select.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  insert(records) {
    let returnedRecords = [];
    if (!records) return returnedRecords;

    // Put single records in an array
    if (!Array.isArray(records)) {
      if (typeof records !== 'object') return returnedRecords;
      if (Object.keys(records).length === 0) return returnedRecords;
      records = [records];
    }

    records.forEach(r => {
      let newRecord = this.addRecord(r);
      if (!newRecord)
        return this.db.error(
          `     Failed validation for record on UPDATE in TABLE[${this.name}].`,
          records
        );
      returnedRecords.push(newRecord);
    });

    return returnedRecords;
  }

  where(query) {
    let where = record => {
      if (!query) query = {};
      let queryKeys = Object.keys(query);
      let isMatch = true;

      if (query)
        queryKeys.forEach(key => {
          // Handle basic get
          if (typeof query[key] !== 'object') {
            if (query[key] !== record[key]) isMatch = false;

            // Handle NOT, LESS THAN, GREATER THAN
          } else if (Object.is(query[key], null)) {
            if (Object.is(record[key], null)) isMatch = false;
          } else if (Object.is(query[key], undefined)) {
            if (Object.is(record[key], undefined)) isMatch = false;
          } else {
            if (query[key].hasOwnProperty('not')) {
              if (query[key].not === record[key]) isMatch = false;
            } else if (query[key].hasOwnProperty('lt')) {
              if (query[key].lt < record[key]) isMatch = false;
            } else if (query[key].hasOwnProperty('lte')) {
              if (query[key].lte <= record[key]) isMatch = false;
            } else if (query[key].hasOwnProperty('gt')) {
              if (query[key].gt > record[key]) isMatch = false;
            } else if (query[key].hasOwnProperty('gte')) {
              if (query[key].gte >= record[key]) isMatch = false;
            }
          }
        });

      return isMatch;
    };

    return {
      select: (...props) => {
        if (arguments.length > 0) return this.select(where, ...props);
        return this.select(where);
      },
      update: newRecord => {
        if (arguments.length > 0) return this.update(where, newRecord);
        return this.update(where);
      },
      delete: () => this.delete(where),
    };
  }

  select() {
    let table = Object.values(this.table);
    if (arguments.length > 0) {
      let args = {};
      [...arguments].forEach(arg => {
        if (typeof arg === 'string') args[arg] = true;
      });

      if (typeof arguments[0] === 'function') {
        table = table.filter(arguments[0]);
      }

      if (Object.keys(args).length === 0) return table;

      let newTable = [];
      for (let i = 0; i < table.length; i++) {
        let record = table[i];
        let newRecord = { ...record };
        let keys = Object.keys(record);
        keys.forEach(key => {
          if (!args[key]) delete newRecord[key];
        });
        newTable.push(newRecord);
      }

      table = newTable;
    }
    return table;
  }

  update() {
    if (arguments.length === 0) return;

    let query = () => true;
    let newRecord = arguments[0];
    if (arguments.length > 1) {
      query = arguments[0];
      newRecord = arguments[1];
    }

    // Run onSave
    if (this.schema.onSave) newRecord = this.schema.onSave(newRecord);

    // Normalize and Validate
    newRecord = this.schema.normalize(newRecord);
    let isValid = this.schema.isValid(newRecord);
    if (!isValid) return;

    let uniqueKeys = Object.keys(this.schema.uniqueKeys);
    let table = Object.values(this.table);
    let records = []; // For returning the new records

    for (let i = table.length - 1; i >= 0; i--) {
      let thisRecord = table[i];
      if (query(thisRecord)) {
        let keys = Object.keys(newRecord);
        keys.forEach(key => {
          if (key === 'id') return; // Temp fix until ids are added as primary keys

          // Update indexed keys
          if (uniqueKeys.includes(key)) {
            delete this.indexed[key][thisRecord[key]];
            this.indexed[key][newRecord[key]] = true;
          }
          this.table[thisRecord.__id][key] = newRecord[key];
        });
        this.table[thisRecord.__id].updated_at = new Date();
        records.push(this.table[thisRecord.__id]);
      }
    }

    return records;
  }

  delete() {
    let query = () => true;
    if (arguments.length > 0) query = arguments[0];

    let table = Object.values(this.table);
    for (let i = table.length - 1; i > -1; i--) {
      let thisRecord = table[i];
      let keys = Object.keys(thisRecord);
      if (query(thisRecord)) {
        keys.forEach(key => {
          if (this.indexed[key]) delete this.indexed[key][thisRecord[key]]; // Remove indexed keys on delete
        });
        delete this.table[thisRecord.__id];
      }
    }

    return null;
  }

  addRecord(record) {
    let { schema, table } = this;

    // Prevent adding and id to new records (for database migrations)
    if (record.hasOwnProperty('id')) record = this.schema.removeId(record);

    // Run onSave
    if (schema.onSave) record = schema.onSave(record);

    // Normalize and Validate
    record = schema.normalize(record);
    let isValid = schema.isValid(record);
    if (!isValid)
      return this.db.error(
        `        Failed validation for record on INSERT into TABLE[${this.name}].`,
        record
      );

    // Set Defaults
    record = schema.setDefaults(record);

    // Index object if unique
    let isIndexed = this.indexRecord(record);
    if (isIndexed) return null;

    // Write record
    record.__id = this.UUID();
    if (!this.indexed.__id) this.indexed.__id = {};
    this.indexed.__id[record.__id] = true;

    record.created_at = new Date();
    record.updated_at = new Date();
    table[record.__id] = record;

    return record;
  }

  indexRecord(record) {
    let { schema } = this;
    Object.keys(record).forEach(key => {
      if (key === 'id') return; // Temp fix until ids are able to be added as primary keys
      if (!schema.uniqueKeys[key]) return;
      if (this.indexed[key] === undefined) this.indexed[key] = {};

      if (this.indexed[key].hasOwnProperty(record[key]) && key !== '__id') {
        this.db.error(`Duplicate value for UNIQUE KEY [${key}]`);
        return true;
      }

      this.indexed[key][record[key]] = true;
    });
    return false;
  }

  UUID() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (dt + Math.random() * 16) % 16 | 0;
      dt = Math.floor(dt / 16);
      return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    return uuid;
  }

  dropColumn(name) {
    delete this[name];
  }
}

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
