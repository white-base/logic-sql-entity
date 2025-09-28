exports.index =  function(req, res) {
    res.render('sto/list', { title: 'Home', message: 'Welcome!' });
}
