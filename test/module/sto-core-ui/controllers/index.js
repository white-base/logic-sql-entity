// const ctx             = import('../../sto-core');
import {ctx_sto_core} from '../../sto-core/index.js';

const table = ctx_sto_core.tables['sto_master'];

export const list = async (req, res) => {
    const page = req.
    body?.page || 1;
    const size = req.body?.size || 10;

    table.clear();
    await table.select(page, size);
    // const table = sto_master;
    // const table = {
    //     rows: [
    //         { sto_id: 'S001', sto_name: '스토어 1', status_cd: 'A', create_dt: '2023-01-01 10:00:00', update_dt: '2023-01-01 10:00:00', del_yn: 'N' },
    //         { sto_id: 'S002', sto_name: '스토어 2', status_cd: 'A', create_dt: '2023-01-02 11:00:00', update_dt: '2023-01-02 11:00:00', del_yn: 'N' },
    //         { sto_id: 'S003', sto_name: '스토어 3', status_cd: 'I', create_dt: '2023-01-03 12:00:00', update_dt: '2023-01-03 12:00:00', del_yn: 'N' },]
    // };

    res.render('sto/list', { title: 'Home', message: 'Welcome!', output: table });
};


export const add = async (req, res) => {
    // res.render('sto/add', { title: 'Add Store', message: 'Add a new store', output: {} });

    await table.insert(req.body);
    res.redirect('/');
    // TODO: 저장후
    // list(req, res);
};

export const del = async (req, res) => {
    const sto_id = req.params.sto_id;
    await table.delete({ sto_id: sto_id });
    res.redirect('/');
};

export const update = async (req, res) => {
    // const sto_id = req.params.sto_id;
    await table.update(req.body);
    res.redirect('/');
};

// app.post('/delete/:id', async (req, res) => {
//   const userId = req.params.id;
//   await table.delete({ id: userId });           // POINT: req.params.id를 바로 사용
//   res.redirect('/');
// });
