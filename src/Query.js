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
