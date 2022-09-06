function UUID() {
  var dt = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  return uuid;
}

class Query {
  constructor(table) {
    this.table = table;
    this.query = {};
  }

  select() {
    let fields = [];
    if (arguments) fields = [...arguments];

    this.query.select = fields;
    return this;
  }

  where(options) {
    this.query.where = options;
    return this;
  }

  insert(records) {
    if (!records) records = [];
    this.query.newRecords = records;
    return this;
  }

  delete() {
    this.query.delete = true;
    return this;
  }

  update(newValuesObject) {
    this.query.updatedRecord = newValuesObject;
    return this;
  }

  go() {
    let records = Object.values(this.table._records);
    let query = this.query;

    // Handle filtering
    if (query.where) records = this.filterRecords(records);
    if (query.select) records = this.filterFields(records);

    // Reset query object before returning
    this.query = {};

    // Manipulate the records and return values
    if (query.newRecords) return this.table.insert(query.newRecords);
    if (query.updatedRecord) return this.table.update(records, query.updatedRecord); //TODO: modify the table object to modify the records passed in
    if (query.delete) return this.table.delete(records);

    return records;
  }

  filterRecords(records) {
    let query = this.query.where;
    let queryKeys = Object.keys(query);
    return records.filter(record => {
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
    });
  }

  filterFields(records) {
    if (this.query.select.length === 0) return records;

    return records.map(record => {
      let newRecord = {};
      for (let field of this.query.select) {
        newRecord[field] = record[field];
      }

      return newRecord;
    });
  }
}

class Schema {
  constructor() {
    this.validation = {};
    this.props = [];
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

  uuid(value) {
    this.props.push(value);
    this.addValidation(value, 'isUUID');
    if (!this._uuids) this._uuids = {};
    this._uuids[value] = true;
    return this;
  }

  isUUID() {
    return true;
  }

  handleUUID(record) {
    let keys = Object.keys(record);

    keys.forEach(key => {
      if (!this._uuids) return;
      if (!this._uuids[key]) return;
      record[key] = UUID();
    });

    return record;
  }

  increment(value) {
    this.props.push(value);
    this.addValidation(value, 'isIncrement');
    if (!this._increments) this._increments = {};
    this._increments[value] = 0;
    return this;
  }

  isIncrement() {
    return true;
  }

  handleIncrements(record) {
    let incrementsTable = this._increments;
    if (!incrementsTable) return record;

    let keys = Object.keys(incrementsTable);
    keys.forEach(key => {
      incrementsTable[key]++;

      let currentIncrement = incrementsTable[key];

      record[key] = currentIncrement;
    });

    return record;
  }

  primary() {
    this.addValidation(this.currentValue(), 'isPrimary');
    this.unique();
    return this;
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
    if (currentReference.table) table = this.table.db._tables[currentReference.table];
    let hasRef = table._indexed[currentReference.field];
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
    if (this.uniqueKeys[this.currentValue()]) return this; // prevent duplicate isUnique validation calls for primary keys
    this.uniqueKeys[this.currentValue()] = true;
    this.addValidation(this.currentValue(), 'isUnique');
    return this;
  }

  isUnique(value, key) {
    if (this.table._indexed[key] === undefined) return true;

    return !this.table._indexed[key].hasOwnProperty(value);
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

  normalize(record, isNewRecord) {
    // TODO: More robust testing and features for this method
    let keys = Object.keys(this.validation);
    let normalizedRecord = {};

    for (let key of keys) {
      if (!record.hasOwnProperty(key)) continue;

      let type = this.validation[key][0].fn;
      let value = record[key];
      if (type === 'isInteger') {
        value = this.normalizeInteger(value);
      } else if (type === 'isString') {
        value = this.normalizeString(value);
      } else if (type === 'boolean') {
        value = this.normalizeBoolen(value);
      } else if (type === 'isUUID' && isNewRecord) {
        value = UUID();
      } else if (type === 'isIncrement' && isNewRecord) {
        value = this._increments[key];
        this._increments[key] += 1;
      }

      normalizedRecord[key] = value;
    }

    return normalizedRecord;
  }

  normalizeInteger(value) {
    if (typeof value === 'string') value = parseFloat(value);

    if (typeof parseInt(value) === 'number' && Number.isInteger(parseFloat(value))) {
      return parseInt(value);
    } else if (Number.isNaN(value)) {
      return null;
    }

    return value;
  }

  normalizeString(value) {
    if (typeof value === 'number') return value + '';
    if (typeof value === 'undefined') return '';

    return value;
  }

  normalizeBoolen(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;

      return !!value;
    }
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
    if (record.__id) delete record.__id;
    return record;
  }
}

class Table {
  constructor(schema) {
    this._records = {};
    this.schema = schema;
    this.isTable = true;
    this._indexed = {};

    this.insert = this.insert.bind(this);
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

  update(records, newRecord) {
    // Run onSave
    if (this.schema.onSave) newRecord = this.schema.onSave(newRecord);

    // Normalize and Validate
    newRecord = this.schema.normalize(newRecord);
    let isValid = this.schema.isValid(newRecord);
    if (!isValid) return;

    let uniqueKeys = Object.keys(this.schema.uniqueKeys);
    let returnedRecords = []; // For returning the new records

    records.forEach(record => {
      let keys = Object.keys(newRecord);
      keys.forEach(key => {
        if (key === '__id') return;

        // Update indexed keys
        if (uniqueKeys.includes(key)) {
          delete this._indexed[key][record[key]];
          this._indexed[key][newRecord[key]] = true;
        }
        this._records[record.__id][key] = newRecord[key];
      });

      this._records[record.__id].updated_at = new Date();
      returnedRecords.push(this._records[record.__id]);
    });

    return returnedRecords;
  }

  delete(records) {
    if (!records) return null;

    records.forEach(record => {
      delete this._records[record.__id];
    });

    return null;
  }

  addRecord(record) {
    let { schema, table } = this;

    // Prevent adding and id to new records (for database migrations)
    if (record.hasOwnProperty('__id')) record = this.schema.removeId(record);

    // Run onSave
    if (schema.onSave) record = schema.onSave(record);

    // Normalize and Validate
    record = schema.normalize(record, true);
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

    record = schema.handleIncrements(record);
    record = schema.handleUUID(record);

    // Write record
    record.__id = UUID();
    if (!this._indexed.__id) this._indexed.__id = {};
    this._indexed.__id[record.__id] = true;

    record.created_at = new Date();
    record.updated_at = new Date();
    this._records[record.__id] = record;

    return record;
  }

  indexRecord(record) {
    let { schema } = this;
    Object.keys(record).forEach(key => {
      if (key === 'id') return; // Temp fix until ids are able to be added as primary keys
      if (!schema.uniqueKeys[key]) return;
      if (this._indexed[key] === undefined) this._indexed[key] = {};

      if (this._indexed[key].hasOwnProperty(record[key]) && key !== '__id') {
        this.db.error(`Duplicate value for UNIQUE KEY [${key}]`);
        return true;
      }

      this._indexed[key][record[key]] = true;
    });
    return false;
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

  load(data) {
    console.log(`Loading state for database: "${this.name}"`);

    let db = JSON.parse(data);

    let tableKeys = Object.keys(this._tables);
    let records = {};
    let recordIds = {};

    // Sort by references
    let sortedKeys = [];

    tableKeys.forEach(key => {
      let curTable = this._tables[key];
      let refs = curTable.schema.refs;
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
      let refs = curTable.schema.refs;

      // Replace foreign Ids
      records[key].forEach(record => {
        let recordKeys = Object.keys(record);
        recordKeys.forEach(recordKey => {
          if (Object.keys(refs).length === 0) return;
          if (!refs.hasOwnProperty(recordKey) || recordKey === 'id') return;

          let refTable = refs[recordKey].table;
          let refField = refs[recordKey].field;

          if (!recordIds[refTable][refField]) return;

          record[recordKey] = recordIds[refTable][refField][record[recordKey]];
        });
        return record;
      });

      // Delete current records
      curTable.delete();
      curTable.indexed = {};

      // Cache old record ids
      let oldRecordIds = [];
      records[key].forEach(r => oldRecordIds.push(r.__id));

      // Add saved records
      let newRecords = curTable.insert(records[key]);

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

  error(msg) {
    if (this.verbose) console.error(msg);
  }

  stringify() {
    return JSON.stringify(this, this.replacerFunc());
  }
}

module.exports = DB;
