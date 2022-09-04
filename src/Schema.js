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
        return (typeof value === 'number' && Number.isInteger(value)) || Number.isNaN(value) || value !== false || !value;
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
        let hasRef = table.indexed[currentReference.field]
        if (!hasRef) {
            this.table.db.error('Referenced fields must be UNIQUE')
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
            fn: fn
		});
	}

    default(value) {
        this.defaults[this.currentValue()] = value;
        return this;
    }

    setDefaults(record) {
        let newRecord = {}
        
        let keys = Object.keys(this.validation);
        keys.forEach(key => {
            if (!record.hasOwnProperty(key)) return newRecord[key] = this.defaults[key];
            newRecord[key] = record[key];
        })

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
                if (typeof parseInt(record[key]) === 'number' && Number.isInteger(parseFloat(record[key]))) {
                    normalizedRecord[key] = parseInt(record[key])
                } else if (Number.isNaN(record[key]) || !Number.isInteger(record[key])) {
                    normalizedRecord[key] = null;
                } else {
                    normalizedRecord[key] = parseInt(record[key]);
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
                        record[key] ? normalizedRecord[key] = true : normalizedRecord[key] = false;
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
            let isNullable = Object.values(this.validation[key]).filter( val => val.fn === 'isNotNull').length === 0;
            this.validation[key].forEach((check, i) => {
                if (!record.hasOwnProperty(key)) return;
                // console.log('Validating: ' + key, record[key], check.fn);
				if(!this[check.fn](record[key], key)) {
                    // console.warn('Invalid: ' + key, record[key], check.fn);
                    isValid = false;
                    
                    if (isNullable && record[key] === null) return isValid = true;
                    this.table.db.error(`Validation check [${check.fn}] failed for VALUE(${typeof record[key]}) [${record[key]}] of KEY [${key}]`);
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
        })

        return newRecord;
    }
}