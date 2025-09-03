import { Kysely } from 'kysely';

export async function viewTable(ctx, title = '테이블 목록') {
    // const dbNoPlugin = new Kysely({ dialect: ctx.connect.dialect });
    // const dbNoPlugin = new Kysely(ctx.connect);
    const dbNoPlugin = ctx instanceof Kysely ? ctx : new Kysely(ctx.connect);
    const tables = await dbNoPlugin.selectFrom('sqlite_master')
        .select(['name', 'type'])
        .where('type', '=', 'table')
        .execute();
    // console.log('Tables:', tables);

    var tableNames = tables.map(table => table.name);
    console.log(`${title}:`, JSON.stringify(tableNames, null, 2));

    const indexes = await dbNoPlugin.selectFrom('sqlite_master')
        .select(['name', 'type'])
        .where('type', '=', 'index')
        .execute();
    var indexNames = indexes.map(index => index.name);
    console.log(`${title} 인덱스:`, JSON.stringify(indexNames, null, 2));
}