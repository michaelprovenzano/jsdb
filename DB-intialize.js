/*
====================================
DATABASE
====================================
*/
let db = new DB('brick-order-app', {verbose: true})

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
    table.boolean('isQ').notNullable().default(false);
    table.integer('studCoverage');
    
    return table;
})

/*
====================================
Models
====================================
*/
.migration('models', table => {   
    table.string('name');
    table.integer('order').notNullable().default(0);
    table.integer('quantity').notNullable().default(1);
    table.float('inflationPercent').notNullable().default(0);

    return table;
})

/*
====================================
Model Sections
====================================
*/
.migration('modelSections', table => {
    table.string('name').notNullable().default('New Model Section');
    table.integer('order').notNullable().default(0);
    table.integer('quantity').notNullable().default(1);
    table.string('type').default('1x1s');
    table.string('modelId').references('id').fromTable('models').notNullable();
    table.float('inflationPercent').notNullable().default(0);

    return table;
})

/*
====================================
Parts - Model Sections (Specialty)
====================================
*/
.migration('parts_modelSections', table => {
    table.string('partId').references('id').fromTable('parts').notNullable();
    table.string('modelSectionId').references('id').fromTable('modelSections').notNullable();
    table.integer('quantity').notNullable().default(0);

    return table;
})

/*
====================================
BB1x1s
====================================
*/
.migration('bb1x1s', table => {
    table.integer('colorId').notNullable();
    table.integer('quantity').notNullable().default(1);
    table.string('type').default('1x1s');
    table.string('modelSectionId').references('id').fromTable('modelSections').notNullable();

    return table;
})

/*
====================================
Parts - BB1x1s
====================================
*/
.migration('parts_bb1x1s', table => {
    table.string('partId').references('id').fromTable('parts').notNullable();
    table.string('bb1x1sId').references('id').fromTable('bb1x1s').notNullable();
    table.integer('studCount').notNullable().default(1);
    table.float('percent').notNullable().default(0);

    return table;
})

/*
====================================
Project Details
====================================
*/
.migration('projectDetails', table => {
    table.string('name').default('');
    table.string('projectNumber').default('');
    table.string('designerName').default('');
    table.string('projectManagerName').default('');
    table.float('inflationPercent').notNullable().default(0);

    return table;
})

/*
====================================
App State
====================================
*/
.migration('appState', table => {
    table.string('activeModelId').references('id').fromTable('models').default(null);
    table.string('activeModelSectionId').references('id').fromTable('modelSections').default(null);
    table.string('activePartId').references('id').fromTable('parts').default(null);
    table.boolean('ignoreQElements').notNullable().default(true);
    table.boolean('orderEnoughNonQElements').notNullable().default(true);
    table.boolean('roundQuantities').notNullable().default(true);

    return table;
})

/*
====================================
Settings
====================================
*/
// .migration('settings', table => {
//     table.string('name').notNullable();
//     table.string('type').notNullable();

//     table.string('string_value');
//     table.integer('int_value');
//     table.float('float_value');
//     table.boolean('bool_value');

//     return table;
// })

// Load from localStorage
if (db.exists(db.name)) db.loadFromLocalStorage();

// Initialize app state
if (db.appState.select().length === 0) db.appState.insert({activeModelId: null, activeModelSectionId: null})
if (db.projectDetails.select().length === 0) db.projectDetails.insert({ name: '' })
db.save();

console.log(db);