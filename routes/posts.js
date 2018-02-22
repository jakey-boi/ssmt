const router = require('express').Router();
const passwordless = require('passwordless');
const snek = require('snekfetch');
const ObjectId = require('mongodb').ObjectId;
const eachOf = require('async').eachOf;
const config = require('../config.json');

router.get('/', (req, res) => {
    req.app.locals.db.find().limit(6).toArray((err, docs) => {
        if(err) throw err;
        let prettyDocs = [];
        eachOf(docs, (doc, key, cb) => {
            let id = new ObjectId(doc.poster);
            req.app.locals.userdb.findOne(id, (err, poster) => {
                if(err) throw err;
                doc.poster = {
                    username: poster.username,
                    id: poster._id
                };
                doc.createdAt = require('moment')(doc.createdAt).toNow(true);
                //console.log(doc);
                prettyDocs.push(doc);
                cb();
            });
        }, (err) => {
            if(err) throw err;
            res.render('posts/recent', { posts: prettyDocs, user: req.user });
        });
        
    });
});

router.get('/new', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    res.render('posts/new', { user: req.user });
});

router.post('/new', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    if(!req.body.text) return res.render('error/generic', { user: req.user, msg: 'Missing post body!' });
    req.app.locals.db.insertOne({ text: req.body.text, poster: req.user._id }, (err, response) => {
        if(err) throw err;
        let postId = response.insertedId;
        res.redirect(`/posts/${postId}`);

        // SEND A MESSAGE VIA THE WEBHOOK, IF ENABLED 
        let isoTime = new Date(Date.now()).toISOString();
        if(config.discord.postlog.enabled){
            let embed = {
                title: `New post ${postId}`,
                description: req.body.text,
                timestamp: isoTime,
                fields: [
                    {
                        name: 'Author',
                        value: `${req.user.username} (${req.user._id})`,
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

/*router.post('/vote', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    let postId = req.body.postId;
    if(!postId || !ObjectId.isValid(id)) return res.render('error/generic', { user: req.user, msg: `If you're going to do this, at least do it right!` });
    
    req.app.locals.db.findOne(new ObjectId(id), (err, doc) => {
        if(err) throw err;
        if(doc === null) return res.render('error/404', { user: req.user });
        //The post exists, so see if the likes array has the user
        req.app.locals.db.findOne({ _id: new ObjectId(id), likes: new ObjectId(id) })
    });
});*/

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
    let id = req.params.id;
    if(!id || !ObjectId.isValid(id)) res.redirect('/posts');
    req.app.locals.db.findOne(new ObjectId(id), (err, doc) => {
        if(err) throw err;
        if(doc === null) return res.render('error/404', { user: req.user });
        req.app.locals.userdb.findOne(new ObjectId(doc.poster), (err, user) => {
            if(err) throw err;
            doc.poster = {
                username: user.username,
                id: user._id
            };
            res.render('posts/post', { post: doc, user: req.user });
        });
    });
});

module.exports = router;