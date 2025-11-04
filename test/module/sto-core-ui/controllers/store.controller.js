import { ctxStore } from '../../sto-core/index.js'; // REVIEW: -> '@logicfeel/sto-core'

const table = ctxStore.getTable('sto_master');

export const list = async (req, res, option) => {
    const page = req.body?.page || 1;
    const size = req.body?.size || 10;
    const basePath = req.baseUrl || '';

    table.clear();
    // await table.select(page, size);
    await table.select({ page, size });

    res.render('store/list', {
        title: 'Store List',
        message: 'Store List Page',
        output: table,
        basePath: basePath
    });
};

export const form = (req, res, option) => {
    const basePath = req.baseUrl || '';
    res.render('store/form', {
        title: 'Store Add',
        message: 'Add a new store',
        output: table,
        basePath: req.baseUrl
    });
};

export const detail = async (req, res, option) => {
    const basePath = req.baseUrl || '';
    const sto_id = req.params.id;

    table.clear();
    await table.select({ where: sto_id });

    res.render('store/detail', {
        title: 'Store View',
        message: 'View store details',
        output: table,
        row: table.rows[0],
        basePath: req.baseUrl
    });
};


export const add = async (req, res, option) => {
    const basePath = req.baseUrl || '';

    await table.insert(req.body);
    res.redirect(basePath + '/list');
};

export const del = async (req, res, option) => {
    const sto_id = req.params.id;
    const basePath = req.baseUrl || '';

    await table.delete({ sto_id });
    res.redirect(basePath + '/list');
};

export const update = async (req, res, option) => {
    const basePath = req.baseUrl || '';
    const sto_id = req.params.id;

    req.body.sto_id = sto_id; // Ensure the ID is set for the update operation
    await table.update(req.body);
    res.redirect(basePath + '/list');
};