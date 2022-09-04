/*
====================================
DATABASE
====================================
*/
let db = new DB('brick-order-app', {verbose: false})

/*
====================================
User
====================================
*/

.migration('users', (table) => {    
    table.string('name').notNullable();
    table.integer('age');
    table.boolean('isOnMailingList').notNullable().default(true);
    table.string('gender').default('male');
    table.string('email').notNullable().unique();
    
    return table;
})

/*
====================================
User
====================================
*/

.migration('login', (table) => {    
    table.string('email').notNullable().unique().references('email').fromTable('users');
    table.string('password').notNullable();
    
    return table;
})

/*
====================================
Favorite Colors
====================================
*/

.migration('colors', table => {
    table.string('userId').notNullable().references('id').fromTable('users');
    table.integer('color').notNullable();

    return table;
})

/*
====================================
Parts
====================================
*/
.migration('parts', (table) => {    
    // table.uuid('id').primaryKey();
    table.string('description');
    table.integer('designId');
    table.integer('materialId').unique();
    table.integer('colorId').notNullable();
    table.string('type').notNullable().default('OTHER');
    table.boolean('basicElement').notNullable().default(false);
    
    return table;
})

/*
====================================
TESTING - QUERIES
====================================
*/
.migration('onsave', table => {
    table.string('name');

    table.onSave = record => {
        record.name = 'OnSave Ran'

        return record;
    }

    return table;
})

/*
====================================
TESTING - QUERIES
====================================
*/

function testLog(msg) {
    console.log('   ',...msg);
}

test('INSERT | Database rejects undefined', () => {
    let newRecords = db.users.insert();
    if (newRecords.length !== 0) return false;
    return true;
})

test('INSERT | Database rejects empty array', () => {
    let newRecords = db.users.insert([]);
    if (newRecords.length !== 0) return false;
    return true;
})

test('INSERT | Database rejects empty object', () => {
    let newRecords = db.users.insert({});
    if (newRecords.length !== 0) return false;
    return true;
})

test('INSERT | Database inserts successfully', () => {
    db.users.insert({ name: 'Tom', age: 31, email: 'test@email.com' });

    let newRecord = db.users.select()[0];
    if (newRecord.name !== 'Tom') return false;
    if (newRecord.age !== 31) return false;
    if (newRecord.email !== 'test@email.com') return false;

    return true;
})

test('SELECT | Database selects fields successfully', () => {
    let newRecord = db.users.select('name', 'email')[0];
    if (newRecord.name !== 'Tom') return false;
    if (newRecord.age) return false;
    if (newRecord.email !== 'test@email.com') return false;

    newRecord = db.users.where({ age: 31 }).select()[0];
    if (newRecord.name !== 'Tom') return false;
    if (newRecord.age !== 31) return false;
    if (newRecord.email !== 'test@email.com') return false;
    
    newRecord = db.users.where({ age: 31 }).select('name', 'email')[0];
    if (newRecord.name !== 'Tom') return false;
    if (newRecord.hasOwnProperty('age')) return false;
    if (newRecord.email !== 'test@email.com') return false;

    return true;
})

test('UPDATE | Database updates fields successfully', () => {
    db.users.insert({name: 'Update Me', age: 50, email: 'updateme@email.com'});
    db.users.where({name: 'Update Me'}).update({name: 'Is Updated', age: 60, email: 'isupdated@email.com'});

    let updatedRecord = db.users.where({name: 'Is Updated'}).select()[0];
    if (!updatedRecord) return false;
    if (updatedRecord.name !== 'Is Updated') return false;
    if (updatedRecord.age !== 60) return false;
    if (updatedRecord.email !== 'isupdated@email.com') return false;

    return true;
})

test('DELETE | Database deletes a record successfully', () => {
    db.users.insert({name: 'Delete Me', age: 65});
    if (db.users.where({name: 'Delete Me'}).select().length === 0) return false;
    
    db.users.where({name: 'Delete Me'}).delete();
    
    if (db.users.where({name: 'Delete Me'}).select().length === 0) return true;
    return false;
})

test('INTEGER | Database allows strings that parse to numbers', () => {
    db.users.insert({name: 'String-Integer', age: '20'});
    if (db.users.where({name: 'String-Integer'}).select()[0].age === 20) return true;
    return false;
})

test('INTEGER | Database restricts non-integer values', () => {
    db.users.insert({name: 'Non-Integer', age: 65.5});
    if (db.users.where({name: 'Non-Integer'}).select()[0].age === null) return true;
    return false;
})

test('FOREIGN REFERENCE | Database restricts invalid foreign references', () => {
    db.login.insert({ email: 'test2@email.com', password: 'test1234' });
    if (db.login.where({ email: 'test2@email.com' }).select().length === 0) return true;
    return false;
})

test('FOREIGN REFERENCE | Database allows valid foreign references', () => {
    db.login.insert({ email: 'test@email.com', password: 'test1234' });
    if (db.login.where({ email: 'test@email.com' }).select()[0]) return true;
    return false;
})

test('FOREIGN REFERENCE | Database allows foreign references based on ids', () => {
    let user = db.users.insert({ name: 'Favorite Color User'})[0];
    let favoriteColor = db.colors.insert({ userId: user.id, color: 1 })[0];
    if (favoriteColor.userId !== user.id) return false;
    return true;
})

test('UNIQUE | Database does not allow duplicate "unique" values', () => {
    db.users.insert({ name: 'Unique Value', age: 31, email: 'unique@email.com' });
    db.users.insert({ name: 'Unique Value', age: 31, email: 'unique@email.com' });
    if (db.users.where({ email: 'unique@email.com' }).select().length === 1) return true;
    return false;
})

test('UNIQUE | Database allows "unique" value to be removed and then added again', () => {
    db.users.insert({ name: 'Unique ReAdded Value', age: 31, email: 'uniqueReAdded@email.com' });

    db.users.where({ email: 'uniqueReAdded@email.com' }).delete();
    if (db.users.where({ email: 'uniqueReAdded@email.com' }).select().length === 0) return true;

    db.users.insert({ name: 'Unique ReAdded Value', age: 31, email: 'uniqueReAdded@email.com' });
    if (db.users.where({ email: 'uniqueReAdded@email.com' }).select().length === 1) return true;

    return false;
})

test('NOT NULLABLE | Database allows a null value to be passed into a normal field', () => {
    db.users.insert({ name: 'I can be null', age: null });
    if (db.users.where({name: 'I can be null'}).select().length === 1) return true;
    return false;
})

test('NOT NULLABLE | Database does not allow a NULL value to be passed into NOT NULLABLE fields', () => {
    db.users.insert({ name: null, age: 99 });
    if (db.users.where({age: 99}).select().length === 0) return true;
    return false;
})

test('CREATED AT | Database correctly modifies initial "created_at" field', () => {
    db.users.insert({ name: 'Created At', age: 99 });
    if (!db.users.where({ name: 'Created At' }).select()[0].created_at) return true;
    if (Date.parse(db.users.where({ name: 'Created At' }).select()[0].created_at.toISOString())) return true;
    return false;
})

test('UPDATED AT | Database correctly modifies initial "updated_at" field', () => {
    db.users.insert({ name: 'Updated At', age: 99 });

    if (!db.users.where({ name: 'Updated At' }).select()[0].updated_at) return true;
    if (Date.parse(db.users.where({ name: 'Updated At' }).select()[0].updated_at.toISOString())) return true;
    return false;
})

test('ID | Database ignores assigned ids', () => {
    let id = '7c851809-d630-437f-898f-a4f349b53fed';

    let returnedValues = db.users.insert({ name: 'Update ID', age: 99, id });
    if (returnedValues[0].id !== id) return true;
    if (db.users.where({ name: 'Update ID' }).select()[0].id !== id) return true;
    
    returnedValues = db.users.insert([{ name: 'Update ID', age: 99, id }]);
    if (returnedValues[0].id !== id) return true;
    if (db.users.where({ name: 'Update ID' }).select()[0].id !== id) return true;
    return false;
})

// setTimeout(() => {
//     test('UPDATED AT | Database correctly modifies "updated_at" field', () => {
//         let currentUpdatedAt = db.users.where({ name: 'Updated At'}).select()[0].updated_at;
//         let updatedRecord = db.users.where({ name: 'Updated At' }).update({ age: 36 })[0];

//         if (!updatedRecord.created_at) return false;
//         if (!Date.parse(updatedRecord.created_at.toISOString())) return false;
//         if (Math.round(currentUpdatedAt - updatedRecord.updated_at / 1000) === -2) return false;
//         return true;
//     })
// }, 2000);

test('LOAD | Database retains references on load', () => {
    db.save();
    db.loadFromLocalStorage();

    let user = db.users.where({ name: 'Favorite Color User'}).select();
    let favoriteColor = db.colors.where({ color: 1 }).select();
    if (favoriteColor.userId !== user.id) return false;
    return true;
})

test('ONSAVE | Database runs onsave function on insert', () => {
    db.onsave.insert({ name: 'Wooooo'});
    let record = db.onsave.select()[0];

    if (record.name === 'OnSave Ran') return true;
    return false;
})

test('ONSAVE | Database runs onsave function on update', () => {
    db.onsave.update({ name: 'Wooooo'});
    let record = db.onsave.select()[0];

    if (record.name === 'OnSave Ran') return true;
    return false;
})