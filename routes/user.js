const router = require('express').Router();
const passwordless = require('passwordless');

router.get('/me', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    req.app.locals.db.get('SELECT * FROM users WHERE email = ?', req.user, (err, row) => {
        if(err) throw err;
        res.render('user', { username: row.username, user: row, me: true });
    });
});

router.post('/update', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    let username = req.body.username;
    let bio = req.body.bio;
    //UPDATE posts SET points = ? WHERE id = ?'
    req.app.locals.db.run('UPDATE users SET username = ?, bio = ? WHERE email = ?', username, bio, req.user, (err) => {
        if(err) throw err;
        res.redirect(`/user/me`);
    });
});

router.get('/:username', (req, res) => {
    if(!req.params.username) res.redirect('/');
    req.app.locals.db.get('SELECT * FROM users WHERE username = ?', req.params.username, (err, row) => {
        if(err) throw err;
        if(!row) res.send('User not found!');
        res.render('user', { username: row.username, user: row, me: false });
    });
});

module.exports = router;