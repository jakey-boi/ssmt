const router = require('express').Router();
const passwordless = require('passwordless');
const snek = require('snekfetch');
const config = require('../config.json');

router.get('/', (req, res) => {
    req.app.locals.db.all('SELECT * FROM posts ORDER BY id DESC LIMIT 6;', (err, rows) => {
        if(err) throw err;
        res.render('posts/recent', { posts: rows, user: req.user });
    });
});

router.get('/new', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    res.render('posts/new', { user: req.user });
});

router.post('/new', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    if(!req.body.text) res.send('Missing text!');
    req.app.locals.db.run('INSERT INTO posts (text, poster) VALUES (?, ?)', req.body.text, req.user, (err, ok) => {
        if(err) throw err;
        req.app.locals.db.get('SELECT last_insert_rowid()', (err, row) => {
            if(err) throw err;
            if(!row) res.send('Error getting post ID!');
            let postId = row['last_insert_rowid()'];
            if(config.datadog) req.app.locals.dogStats.increment('ssmt.postcount');
            res.redirect(`/posts/${postId}`);

            /* SEND A MESSAGE VIA THE WEBHOOK, IF ENABLED */
            let isoTime = new Date(Date.now()).toISOString();
            if(config.discord.postlog.enabled){
                let embed = {
                    title: `New post ${postId}`,
                    description: req.body.text,
                    timestamp: isoTime,
                    fields: [
                        {
                            name: 'Author',
                            value: req.user,
                            inline: true
                        },
                        {
                            name: 'Post timestamp',
                            value: isoTime,
                            inline: true
                        }
                    ]
                };
                snek.post(config.discord.postlog.url)
                    .send({ embeds: [embed] })
                    .catch(e => { 
                        console.log(`[ERROR] Error sending webhook! Error was: ${e}`);
                        config.discord.postlog.enabled = false;
                    });
            }
        });
    });
});

router.post('/vote', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    let postId = req.body.postId;
    let type = req.body.type;
    if(!postId || !type) res.send('Missing info to vote!');
    if(type === 'up'){
        //upvote
        req.app.locals.db.get('SELECT points FROM posts WHERE id = ?', postId, (err, row) => {
            if(err) throw err;
            if(!row) res.send('Cannot vote on non-existent post!');
            let score = row.points + 1;
            req.app.locals.db.run('UPDATE posts SET points = ? WHERE id = ?', score, postId, (err) => {
                if(err) throw err;
                res.json({ points: score });
            });
        })
    } else if(type === 'down'){
        //downvote
        req.app.locals.db.get('SELECT points FROM posts WHERE id = ?', postId, (err, row) => {
            if(err) throw err;
            if(!row) res.send('Cannot vote on non-existent post!');
            let score = row.points - 1;
            req.app.locals.db.run('UPDATE posts SET points = ? WHERE id = ?', score, postId, (err) => {
                if(err) throw err;
                res.json({ points: score });
            });
        });
    } else {
        //invalid

    }
});

/*router.post('/posts/delete', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    let pageId = req.body.pageId;
    if(pageId) res.json({ ok: false });
    req.app.locals.db.get('SELECT * FROM posts WHERE id = ?', pageId, (err, row) => {
        if(err){
            res.json({ ok: false });
            throw err;
        }
        if(!row) res.json({ ok: false });
        if(!req.user === row.poster) res.json({ ok: false });
        req.app.locals.db.run('DELETE FROM posts WHERE id = ?', postId, (err) => {
            if(err) throw err;
            res.redirect('/posts');
        });
    });
});*/

router.get('/:id', (req, res) => {
    if(!req.params.id) res.redirect('/');
    req.app.locals.db.get('SELECT * FROM posts WHERE id = ?', req.params.id, (err, row) => {
        if(err) throw err;
        if(!row) res.render('error/404', { user: req.user });
        let canDelete;
        if(req.user === row.poster) canDelete = true;
        res.render('posts/post', { post: row, user: req.user, canDelete });
    });
});

module.exports = router;