import { ctxStore as ctx } from '../../sto-core/index.js';
import connect from './connect.js';

export default async function initDatabase() {

    ctx.connect = connect;

    // 동적 컬럼 추가
    await ctx.addColumn('sto_master', 'add_temp', { dataType: 'varchar(50)' });

    await ctx.init();
    await ctx.dropSchema();
    await ctx.createSchema();

    // 테스트용 데이터 삽입
    await ctx.getTable('sto_master').insert({sto_id: 'S001', sto_name: 'Default Store', status_cd: '01'});

    console.log('Database setup completed.');
}
