const router = require('express').Router();
const passwordless = require('passwordless');

router.get('/', (req, res) => {
    res.render('home', { user: req.user });
});

router.get('/login', (req, res) => {
    res.render('login/login', { user: req.user });
});

router.post('/sendtoken', 
    passwordless.requestToken((user, delivery, cb) => {
        cb(null, user);
    }), (req, res) => {
        res.render('login/sent');
});

router.get('/logout', passwordless.logout(), (req, res) => {
    res.redirect('/');
})

module.exports = router;