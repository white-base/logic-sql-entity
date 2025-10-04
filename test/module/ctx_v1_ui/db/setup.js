import { ctx_v1 as ctx } from '../../ctx_v1/index.js';
import { sql } from 'kysely'
import connect from './connect.js';

async function initDatabase() {

    ctx.connect = connect;

    // 동적 컬럼 추가
    await ctx.addColumn('sto_master', 'add_temp', { dataType: 'varchar(50)' });
    await ctx.addColumn('sto_account', 'add_temp', { dataType: 'varchar(50)' });

    await ctx.init();
    await ctx.dropSchema();
    await ctx.createSchema();

    // 테스트용 데이터 삽입
    // await ctx_v1.tables[0].insert({sto_id: 'S001', sto_name: 'Store 1', status_cd: '01'});
    await ctx.getTable('sto_master').insert({sto_id: 'S001', sto_name: 'Default Store', status_cd: '01'});
    await ctx.getTable('sto_account').insert({sto_id: 'S001', admin_id: 'admin', admin_pw: '1234', admin_name: 'Administrator', use_yn: 'Y' });

    console.log('Database setup completed.');
}

export default initDatabase;
