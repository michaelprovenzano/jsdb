class Query {
  constructor(table) {
    this.table = table;
    this.query = {};
  }

  select(fields) {
    this.query.select = fields;
  }

  where(options) {
    this.query.where = options;
  }

  insert(records) {
    this.query.newRecords = records;
  }

  delete() {
    this.query.delete = true;
  }

  update(newValuesObject) {
    this.query.updatedRecord = newValuesObject;
  }

  go() {
    let records = this.table.records;

    if (this.query.where) records = filterRecords();
    if (this.query.newRecords) return this.table.insert(this.query.newRecords);
    if (this.query.updatedRecord) return this.table.update(records, this.query.updatedRecord);
    if (this.query.delete) return this.table.delete(records);

    this.query = {};
  }

  filterRecords() {
    let queryKeys = Object.keys(this.query.where);
    return this.table.records.filter(record => {
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
}
