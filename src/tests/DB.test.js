const DB = require('../../dist/bundle');
const WaffleTests = require('./test-init');
const wt = new WaffleTests({ environment: 'NODE' });

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
    table.string('userId').notNullable().references('__id').fromTable('users');
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

wt.test('INSERT | Database rejects undefined', () => {
    let newRecords = db.users.insert();
    wt.expect(newRecords.length).toBe(0);
})

wt.test('INSERT | Database rejects empty array', () => {
    let newRecords = db.users.insert([]);
    wt.expect(newRecords.length).toBe(0)
})

wt.test('INSERT | Database rejects empty object', () => {
    let newRecords = db.users.insert({});
    wt.expect(newRecords.length).toBe(0);
})

wt.test('INSERT | Database inserts successfully', () => {
    db.users.insert({ name: 'Tom', age: 31, email: 'test@email.com' });

    let newRecord = db.users.select()[0];
    wt.expect(newRecord.name).toBe('Tom');
    wt.expect(newRecord.age).toBe(31);
    wt.expect(newRecord.email).toBe('test@email.com');
})

wt.test('SELECT | Database selects fields successfully', () => {
    let newRecord = db.users.select('name', 'email')[0];

    wt.expect(newRecord.name).toBe('Tom');
    wt.expect(newRecord.age).toBe(31);
    wt.expect(newRecord.email).toBe('test@email.com');
    
    newRecord = db.users.where({ age: 31 }).select()[0];

    wt.expect(newRecord.name).toBe('Tom');
    wt.expect(newRecord.age).toBe(31);
    wt.expect(newRecord.email).toBe('test@email.com');
    
    newRecord = db.users.where({ age: 31 }).select('name', 'email')[0];

    wt.expect(newRecord.name).toBe('Tom');
    wt.expect(newRecord.age).toBeUndefined();
    wt.expect(newRecord.email).toBe('test@email.com');

    return true;
})

wt.test('UPDATE | Database updates fields successfully', () => {
    db.users.insert({name: 'Update Me', age: 50, email: 'updateme@email.com'});
    db.users.where({name: 'Update Me'}).update({name: 'Is Updated', age: 60, email: 'isupdated@email.com'});

    let updatedRecord = db.users.where({name: 'Is Updated'}).select()[0];
    wt.expect(updatedRecord).not().toBeUndefined()
    wt.expect(updatedRecord.name).toBe('Is Updated');
    wt.expect(updatedRecord.age).toBe(60);
    wt.expect(updatedRecord.email).toBe('isupdated@email.com');

    return true;
})

wt.test('DELETE | Database deletes a record successfully', () => {
    db.users.insert({name: 'Delete Me', age: 65});
    let users = db.users.where({name: 'Delete Me'}).select();
    wt.expect(users.length).toBe(1);
    
    db.users.where({name: 'Delete Me'}).delete();
    users = db.users.where({name: 'Delete Me'}).select();
    wt.expect(users.length).toBe(0);
})

wt.test('INTEGER | Database allows strings that parse to numbers', () => {
    db.users.insert({name: 'String-Integer', age: '20'});
    let user = db.users.where({name: 'String-Integer'}).select()[0];
    wt.expect(user.age).toBe(20);
})

wt.test('INTEGER | Database restricts non-integer values', () => {
    db.users.insert({name: 'Non-Integer', age: 65.5});
    let user = db.users.where({name: 'Non-Integer'}).select()[0]

    wt.expect(user).toBeUndefined()
})

wt.test('FOREIGN REFERENCE | Database restricts invalid foreign references', () => {
    db.login.insert({ email: 'test2@email.com', password: 'test1234' });
    let user =db.login.where({ email: 'test2@email.com' }).select()[0];
    wt.expect(user).toBeUndefined();
})

wt.test('FOREIGN REFERENCE | Database allows valid foreign references', () => {
    db.login.insert({ email: 'test@email.com', password: 'test1234' });
    let user = db.login.where({ email: 'test@email.com' }).select()[0];
    wt.expect(user).not().toBeUndefined();
    wt.expect(user.email).toBe('test@email.com');
})

wt.test('FOREIGN REFERENCE | Database allows foreign references based on ids', () => {
    let user = db.users.insert({ name: 'Favorite Color User'})[0];
    let favoriteColor = db.colors.insert({ userId: user.__id, color: 1 })[0];
    wt.expect(favoriteColor).not().toBeUndefined();
    wt.expect(favoriteColor.userId).toBe(user.__id)

})

wt.test('UNIQUE | Database does not allow duplicate "unique" values', () => {
    db.users.insert({ name: 'Unique Value', age: 31, email: 'unique@email.com' });
    db.users.insert({ name: 'Unique Value', age: 31, email: 'unique@email.com' });
    let users = db.users.where({ email: 'unique@email.com' }).select();
    wt.expect(users.length).toBe(1);
})

wt.test('UNIQUE | Database allows "unique" value to be removed and then added again', () => {
    db.users.insert({ name: 'Unique ReAdded Value', age: 31, email: 'uniqueReAdded@email.com' });

    db.users.where({ email: 'uniqueReAdded@email.com' }).delete();
    let users = db.users.where({ email: 'uniqueReAdded@email.com' }).select()
    wt.expect(users.length).toBe(0)
    
    db.users.insert({ name: 'Unique ReAdded Value', age: 31, email: 'uniqueReAdded@email.com' });
    users = db.users.where({ email: 'uniqueReAdded@email.com' }).select();
    wt.expect(users.length).toBe(1)
})

wt.test('NOT NULLABLE | Database allows a null value to be passed into a normal field', () => {
    db.users.insert({ name: 'I can be null', age: null });
    let users = db.users.where({name: 'I can be null'}).select();
    wt.expect(users.length).toBe(1);
})

wt.test('NOT NULLABLE | Database does not allow a NULL value to be passed into NOT NULLABLE fields', () => {
    db.users.insert({ name: null, age: 99 });
    let users = db.users.where({age: 99}).select();
    wt.expect(users.length).toBe(0);
})

wt.test('CREATED AT | Database correctly adds initial "created_at" field', () => {
    db.users.insert({ name: 'Created At', age: 99 });
    let user = db.users.where({ name: 'Created At' }).select()[0];
    wt.expect(user).not().toBeUndefined()

    let parsedDate = Date.parse(user.created_at.toISOString())
    wt.expect(parsedDate).not().toBeUndefined()
})

wt.test('UPDATED AT | Database correctly modifies initial "updated_at" field', () => {
    db.users.insert({ name: 'Updated At', age: 99 });
    let user = db.users.where({ name: 'Updated At' }).select()[0]
    wt.expect(user.updated_at).not().toBeUndefined()

    let parsedDate = Date.parse(user.updated_at.toISOString())
    wt.expect(parsedDate).not().toBeUndefined()
})

wt.test('ID | Database ignores assigned ids', () => {
    let id = '7c851809-d630-437f-898f-a4f349b53fed';

    let returnedValues = db.users.insert({ name: 'Update ID', age: 99, __id: id });
    wt.expect(returnedValues[0].__id).not().toBe(id)
    
    let user = db.users.where({ name: 'Update ID' }).select()[0];
    wt.expect(user.__id).not().toBe(id);
    
    returnedValues = db.users.where({ name: 'Update ID' }).update([{ name: 'Update ID', age: 99, __id: id }]);
    wt.expect(returnedValues[0].__id).not().toBe(id)

    user = db.users.where({ name: 'Update ID' }).select()[0];
    wt.expect(user.__id).not().toBe(id);
})

setTimeout(() => {
    wt.test('UPDATED AT | Database correctly modifies "updated_at" field', () => {
        let currentUpdatedAt = db.users.where({ name: 'Updated At'}).select()[0].updated_at;
        let updatedRecord = db.users.where({ name: 'Updated At' }).update({ age: 36 })[0];

        wt.expect(updatedRecord.updated_at).not().toBeUndefined();
        wt.expect(updatedRecord.created_at).not().toBeUndefined();
        wt.expect(Date.parse(updatedRecord.created_at.toISOString())).not().toBeUndefined();
        wt.expect(Date.parse(updatedRecord.created_at.toISOString())).not().toBeNull();

        let diff = Math.round(currentUpdatedAt - updatedRecord.updated_at / 1000)
        wt.expect(diff).toBe(-2);
    });
}, 2000);

wt.test('LOAD | Database retains references on load', () => {
    if (wt.environment === 'NODE') return;

    db.save();
    db.loadFromLocalStorage();

    let user = db.users.where({ name: 'Favorite Color User'}).select();
    let favoriteColor = db.colors.where({ color: 1 }).select();
    wt.expect(favoriteColor.userId).not().toBe(user.__id);
})

wt.test('ONSAVE | Database runs onsave function on insert', () => {
    if (wt.environment === 'NODE') return;

    db.onsave.insert({ name: 'Wooooo'});
    let record = db.onsave.select()[0];

    wt.expect(record.name).toBe('OnSave Ran');
})

wt.test('ONSAVE | Database runs onsave function on update', () => {
    if (wt.environment === 'NODE') return;
    
    db.onsave.update({ name: 'Wooooo'});
    let record = db.onsave.select()[0];
    
    wt.expect(record.name).toBe('OnSave Ran');
})