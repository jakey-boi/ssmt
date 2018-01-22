const router = require('express').Router();

router.get('/', (req, res) => {
    req.app.locals.db.all('SELECT * FROM posts ORDER BY id DESC LIMIT 5;', (err, rows) => {
        if(err) throw err;
        res.render('posts/recent', { posts: rows });
    });
});

router.get('/new', (req, res) => {
    res.render('posts/new');
});

router.post('/new', (req, res) => {
    if(!req.body.text) res.send('Missing text!');
    req.app.locals.db.run('INSERT INTO posts (text) VALUES (?)', req.body.text, (err, ok) => {
        if(err) throw err;
        req.app.locals.db.get('SELECT last_insert_rowid()', (err, row) => {
            if(err) throw err;
            if(!row) res.send('Error getting post ID!');
            let postId = row['last_insert_rowid()'];
            res.redirect(`/posts/${postId}`);
        });
    })
});

router.post('/vote', (req, res) => {
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
                console.log(`[VOTE] Post [${postId}] points ${row.points} -> ${score}`);
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
                console.log(`[VOTE] Post [${postId}] points ${row.points} -> ${score}`);
                res.json({ points: score });
            });
        });
    } else {
        //invalid

    }
});

router.get('/:id', (req, res) => {
    if(!req.params.id) res.redirect('/');
    req.app.locals.db.get('SELECT * FROM posts WHERE id = ?', req.params.id, (err, row) => {
        if(err) throw err;
        if(!row) res.send('Post not found!');
        res.render('posts/post', row);
    });
});

module.exports = router;