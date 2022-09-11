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
    record = schema.handleIncrements(record);
    record = schema.handleUUID(record);

    // Write record
    record.__id = UUID();
    if (!this._indexed.__id) this._indexed.__id = {};
    this._indexed.__id[record.__id] = true;

    record.created_at = new Date();
    record.updated_at = new Date();
    this._records[record.__id] = record;

    // Index object if unique
    let isIndexed = this.indexRecord(record);
    if (isIndexed) return null;

    return record;
  }

  indexRecord(record) {
    let { schema } = this;
    Object.keys(record).forEach(key => {
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
