const router = require('express').Router();
const passwordless = require('passwordless');

router.get('/', (req, res) => {
    res.render('home', { user: res.locals.user, stats: req.app.locals.stats });
});

router.get('/login', (req, res) => {
    res.render('login/login', { user: res.locals.user });
});

router.post('/sendtoken', 
    passwordless.requestToken((user, delivery, cb) => {
        cb(null, user);
    }), (req, res) => {
        res.render('login/sent');
});

router.get('/logout', passwordless.logout(), (req, res) => {
    res.redirect('/');
});

router.get('/unauthorized', (req, res) => {
    res.status(401).render('error/401', { user: res.locals.user });
});

router.get('/rss', (req, res) => {
    res.send(req.app.locals.rssCache);
});

router.get('/health-check', (req, res) => {
    res.status(200).json({ msg: 'The server is running!', ip: req.ip });
});

module.exports = router;