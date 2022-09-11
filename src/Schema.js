class Schema {
  constructor(opts) {
    if (!opts) opts = {};

    this.validation = opts.validation || {};
    this.props = opts.props || [];
    this.uniqueKeys = opts.uniqueKeys || {};
    this.refs = opts.refs || {};
    this.defaults = opts.defaults || {};
    this._increments = opts._increments || {};

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
      if (record[key] !== undefined) return;
      record[key] = UUID();
    });

    return record;
  }

  increment(value) {
    this.props.push(value);
    this.addValidation(value, 'isIncrement');
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
      if (record[key] !== undefined) return;

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
      } else if (type === 'isUUID' && isNewRecord && !record[key]) {
        value = UUID();
      } else if (type === 'isIncrement' && isNewRecord && !record[key]) {
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
