import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const activity = sqliteTable('activity', {
  id: text('id').primaryKey(),
  document: text('document').notNull(),
  revision: integer('revision').notNull(),
  updatedAt: text('updated_at').notNull(),
});
