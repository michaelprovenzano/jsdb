function migration(db) {
  /*
  ====================================
  User
  ====================================
  */

  db.migration('users', table => {
    table.uuid('id').notNullable().unique();
    table.string('name').notNullable();
    table.integer('age');
    table.boolean('isOnMailingList').notNullable().default(true);
    table.string('gender').default('male');
    table.string('email').notNullable().unique();

    return table;
  })

    /*
  ====================================
  Login
  ====================================
  */

    .migration('login', table => {
      table.uuid('id').notNullable().unique();
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
      table.uuid('id').notNullable().unique();
      table.string('userId').notNullable().references('id').fromTable('users');
      table.integer('color').notNullable();

      return table;
    })

    /*
  ====================================
  Parts
  ====================================
  */
    .migration('parts', table => {
      table.uuid('id').notNullable().unique();
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
  TESTING - ONSAVE
  ====================================
  */
    .migration('onsave', table => {
      table.uuid('id').notNullable().unique();
      table.string('name');

      table.onSave = record => {
        record.name = 'OnSave Ran';

        return record;
      };

      return table;
    })

    /*
  ====================================
  TESTING - INCREMENTS
  ====================================
  */
    .migration('increments', table => {
      table.increment('id');
      table.uuid('uuid');
      table.string('name');

      return table;
    });
}

module.exports = migration;
