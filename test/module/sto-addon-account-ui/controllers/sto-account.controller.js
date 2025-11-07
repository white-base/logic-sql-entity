import { ctxStoAccount } from '../../sto-addon-account/index.js'; // REVIEW: -> '@logicfeel/sto-core'

const table = ctxStoAccount.getTable('sto_account');
const store = ctxStoAccount.getTable('sto_master');

export const list = async (req, res, option) => {
    const page = req.body?.page || 1;
    const size = req.body?.size || 10;
    const basePath = req.baseUrl || '';

    await table.select({ page, size });

    res.render('sto-account/list', {
        title: 'Account List',
        message: 'Account List Page',
        output: table,
        basePath: basePath
    });
};

export const form = async (req, res, option) => {
    const basePath = req.baseUrl || '';

    await store.select({ where: { use_yn: 'Y' } });

    res.render('sto-account/form', {
        title: 'Account Add',
        message: 'Add a new account',
        store: store,
        output: table,
        basePath: req.baseUrl
    });
};

export const detail = async (req, res, option) => {
    const basePath = req.baseUrl || '';
    const acc_idx = req.params.id;

    await table.select({ where: acc_idx });

    res.render('sto-account/detail', {
        title: 'Account View',
        message: 'View account details',
        output: table,
        row: table.rows[0],
        basePath: req.baseUrl
    });
};

export const add = async (req, res, option) => {
    const basePath = req.baseUrl || '';

    if (typeof req.body.use_yn === 'undefined') req.body.use_yn = '';
    await table.insert(req.body);
    res.redirect(basePath + '/list');
};

export const del = async (req, res, option) => {
    const basePath = req.baseUrl || '';
    const acc_idx = req.params.id;

    await table.delete({ acc_idx: acc_idx });
    res.redirect(basePath + '/list');
};

export const update = async (req, res, option) => {
    const basePath = req.baseUrl || '';
    const acc_idx = req.params.id;

    req.body.acc_idx = acc_idx; // Ensure the primary key is set for the update
    req.body.use_yn = req.body.use_yn || 'N';

    await table.update(req.body);
    res.redirect(basePath + '/list');
};