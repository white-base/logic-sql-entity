import { ctx_sto_account } from '../../sto-addon-account/index.js'; // REVIEW: -> '@logicfeel/sto-core'

const table = ctx_sto_account.tables['sto_account'];
const store = ctx_sto_account.getTable('sto_master');

export const list = async (req, res, option) => {
    const page = req.body?.page || 1;
    const size = req.body?.size || 10;
    const basePath = req.baseUrl || '';

    table.clear();
    await table.select(page, size);

    res.render('sto-account/list', {
        title: 'Account List',
        message: 'Account List Page',
        output: table,
        layout: option?.layout || 'layout',
        basePath: basePath
    });
};

export const form = async (req, res, option) => {
    const basePath = req.baseUrl || '';

    store.clear();
    await store.select(1, 100); // Assuming there won't be more than 100 stores for simplicity

    res.render('sto-account/form', {
        title: 'Account Add',
        message: 'Add a new account',
        store: store,
        output: table,
        layout: option?.layout || 'layout',
        basePath: req.baseUrl
    });
};

export const add = async (req, res, option) => {
    const basePath = req.baseUrl || '';

    await table.insert(req.body);
    res.redirect(basePath + '/');
};

export const del = async (req, res, option) => {
    const acc_idx = req.params.id;
    const basePath = req.baseUrl || '';

    await table.delete({ acc_idx: acc_idx });
    res.redirect(basePath + '/');
};

export const update = async (req, res, option) => {
    const basePath = req.baseUrl || '';

    await table.update(req.body);
    res.redirect(basePath + '/');
};