class Table {
    constructor(schema) {
        this.table = {}
        this.schema = schema;
        this.isTable = true;
        this.indexed = {}

        this.insert = this.insert.bind(this);
        this.where = this.where.bind(this);
        this.select = this.select.bind(this);
        this.update = this.update.bind(this);
        this.delete = this.delete.bind(this);
    }
    
    // insert
    insert(record) {
        let records = []
        if (!record) return records;
        
        if (!Array.isArray(record)) {
            // Write single records
            if (typeof record !== 'object') return records;
            if (Object.keys(record).length === 0) return records;

            let newRecord = this.addRecord(record)
            if (!newRecord) return records;

            records.push(newRecord);
        } else {
            // Write multiple records
            if (record.length === 0) return records;
            
            record.forEach(r => {
                let newRecord = this.addRecord(r)
                if (!newRecord) return this.db.error(`     Failed validation for record on UPDATE in TABLE[${this.name}].`, record);
                records.push(newRecord);
            });
        }

        return records;
    }

    where(query) {
        let where = record => {
            if (!query) query = {}
                let queryKeys = Object.keys(query)
                let isMatch = true; 

            if (query) queryKeys.forEach(key => {
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
                if (arguments.length > 0) return this.select(where,  ...props);
                return this.select(where);
            },
            update: (newRecord) => {
                if (arguments.length > 0) return this.update(where, newRecord);
                return this.update(where);
            },
            delete: () => this.delete(where)
        }
    }

    select() {
        let table = Object.values(this.table);
        if (arguments.length > 0) {
            let args = {};
            [...arguments].forEach(arg => {
                if (typeof arg === 'string') args[arg] = true;
            })

            if (typeof arguments[0] === 'function') {
                table = table.filter(arguments[0]);
            }

            if (Object.keys(args).length === 0) return table;

            let newTable = [];
            for (let i = 0; i < table.length; i++) {
                let record = table[i];
                let newRecord = {...record};
                let keys = Object.keys(record);
                keys.forEach(key => {
                    if (!args[key]) delete newRecord[key];
                })
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

        
        let uniqueKeys = Object.keys(this.schema.uniqueKeys)
        let table = Object.values(this.table);
        let records = []; // For returning the new records

        for (let i = table.length - 1; i >= 0; i--) {
            let thisRecord = table[i];
            if (query(thisRecord)) {
                let keys = Object.keys(newRecord)
                keys.forEach(key => {
                    if (key === 'id') return; // Temp fix until ids are added as primary keys

                    // Update indexed keys
                    if (uniqueKeys.includes(key)) {
                        delete this.indexed[key][thisRecord[key]];
                        this.indexed[key][newRecord[key]] = true;
                    }
                    this.table[thisRecord.__id][key] = newRecord[key]
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
                // console.log('Deleting: ' + thisRecord.__id, thisRecord);
                keys.forEach(key => {                    
                    if (this.indexed[key]) delete this.indexed[key][thisRecord[key]] // Remove indexed keys on delete
                })
                delete this.table[thisRecord.__id]
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
        if (!isValid) return this.db.error(`        Failed validation for record on INSERT into TABLE[${this.name}].`, record);

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
            if (this.indexed[key] === undefined) this.indexed[key] = {}
            
            if (this.indexed[key].hasOwnProperty(record[key])) {
                this.db.error(`Duplicate value for UNIQUE KEY [${key}]`);
                return true;
            }
            
            this.indexed[key][record[key]] = true;
        })
        return false;
    }

    UUID() {
        var dt = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (dt + Math.random()*16)%16 | 0;
            dt = Math.floor(dt/16);
            return (c=='x' ? r :(r&0x3|0x8)).toString(16);
        });
        return uuid;
    }

    dropColumn(name) {
        delete this[name];
    }
}