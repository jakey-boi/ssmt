const router = require('express').Router();
const passwordess = require('passwordless');

router.get('/', passwordess.restricted(), (req, res) => {
    let owner = req.app.locals.config.owner;
    if(req.user !== owner) return res.redirect('/');
    res.render('admin/home', { user: req.user });
});

router.post('/eval', passwordess.restricted(), (req, res) => {
    let owner = req.app.locals.config.owner;
    if(req.user !== owner) return res.redirect('/');
    let code = req.body.code;

    switch(req.body.type){
        case 'js':
            //javascript
            try{
                let result = eval(code);
                res.json({ success: true, out: result });
            } catch (err){
                res.json({ success: false, out: err });
            }
            break;
        case 'sql':
            //sql
            req.app.locals.db.all(code, (err, rows) => {
                if(err) res.json({ success: false, out: err });
                res.json({ success: true, out: JSON.stringify(rows) });
            });
            break;
        default:
            //fail
            res.json({ success: false, out: 'A code type was not specified!' });
            break;
    }
});

module.exports = router;