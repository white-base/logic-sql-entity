const table             = require('../../sto-core');  // POINT:

exports.index =  async function(req, res, page = 1, size = 10) {
    table.clear();
    await table.select(page, size);                    // POINT: 페이징 처리

    res.render('sto/list', { title: 'Home', message: 'Welcome!', output: table });
}
