const router = require('express').Router();
const passwordless = require('passwordless');
const ObjectId = require('mongodb').ObjectId;
const eachOf = require('async').eachOf;
const isHexColor = require('validator').isHexColor;
const marked = require('marked');

router.get('/me', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    req.app.locals.userdb.findOne({ email: req.user }, (err, doc) => {
        if(err) throw err;
        if(doc === null) return res.render('error/404', { user: res.locals.user });
        req.app.locals.db.find({ poster: new ObjectId(res.locals.user._id) }).toArray((err, docs) => {
            res.render('user/me', { user: res.locals.user, posts: docs });
        });
    });
});

router.post('/update', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    let username = req.body.username;
    let bio = req.body.bio;
    let color = req.body.color || '#1300FF';
    if(!isHexColor(color)) color = '#1300FF';
    if(!color.startsWith('#')) color = '#' + color;

    req.app.locals.userdb.findOneAndUpdate({ email: req.user }, { $set: { username: username, bio: bio, profile: { color: color } } }, (err, result) => {
        if(err) throw err;
        res.redirect('/user/me');
    });
});

router.get('/:identifier', (req, res) => {
    let id = req.params.identifier;
    if(!ObjectId.isValid(id)) return res.render('error/404', { user: res.locals.user });
    req.app.locals.userdb.findOne(new ObjectId(id), (err, doc) => {
        if(err) throw err;
        if(doc === null) return res.render('error/404', { user: res.locals.user });
        //That was a valid user ID, return the profile page
        req.app.locals.db.find({ poster: new ObjectId(id) }).limit(4).sort({ createdAt: -1 }).toArray((err, docs) => {
            //
            let prettyDocs = [];
            eachOf(docs, (doc, key, cb) => {
                let id = new ObjectId(doc.poster);
                req.app.locals.userdb.findOne(id, (err, poster) => {
                    if(err) throw err;
                    doc.poster = {
                        username: poster.username,
                        id: poster._id
                    };
                    doc.text = marked(doc.text);
                    doc.createdAt = require('moment')(doc.createdAt).toNow(true);
                    prettyDocs.push(doc);
                    
                    cb();
                });
            }, (err) => {
                if(err) throw err;
                doc.bio = marked(doc.bio);
                res.render('user/user', { user: res.locals.user, puser: doc, posts: docs  });
            });
            //
        });
    });
});

module.exports = router;