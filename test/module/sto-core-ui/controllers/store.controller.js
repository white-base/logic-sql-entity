import { ctx_sto_core } from '../../sto-core/index.js'; // REVIEW: -> '@logicfeel/sto-core'

const table = ctx_sto_core.tables['sto_master'];

export const list = async (req, res, option) => {
    const page = req.body?.page || 1;
    const size = req.body?.size || 10;
    const basePath = req.baseUrl || '';

    table.clear();
    await table.select(page, size);

    res.render('store/list', {
        title: 'Store List',
        message: 'Store List Page',
        output: table,
        layout: option?.layout || 'layout',
        basePath: basePath
    });
};

export const form = (req, res, option) => {
    const basePath = req.baseUrl || '';
    res.render('store/form', {
        title: 'Store Add',
        message: 'Add a new store',
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
    const sto_id = req.params.sto_id;
    const basePath = req.baseUrl || '';

    await table.delete({ sto_id: sto_id });
    res.redirect(basePath + '/');
};

export const update = async (req, res, option) => {
    const basePath = req.baseUrl || '';

    await table.update(req.body);
    res.redirect(basePath + '/');
};