const router = require('express').Router();
const passwordless = require('passwordless');
const ObjectId = require('mongodb').ObjectId;
const eachOf = require('async').eachOf;

router.get('/me', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    req.app.locals.userdb.findOne({ email: req.user.email }, (err, doc) => {
        if(err) throw err;
        if(doc === null) return res.render('error/404', { user: req.user });
        req.app.locals.db.find({ poster: new ObjectId(req.user._id) }).toArray((err, docs) => {
            res.render('user/me', { user: doc, posts: docs });
        });
    });
});

router.post('/update', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    let username = req.body.username;
    let bio = req.body.bio;

    console.log(req.user);
    req.app.locals.userdb.findOneAndUpdate(new ObjectId(req.user._id), { $set: { username: username, bio: bio } }, (err, result) => {
        if(err) throw err;
        res.redirect('/user/me');
    });
});

router.get('/:identifier', (req, res) => {
    let id = req.params.identifier;
    if(!ObjectId.isValid(id)) return res.render('error/404', { user: req.user });
    req.app.locals.userdb.findOne(new ObjectId(id), (err, doc) => {
        if(err) throw err;
        if(doc === null) return res.render('error/404', { user: req.user });
        //That was a valid user ID, return the profile page
        req.app.locals.db.find({ poster: new ObjectId(id) }).toArray((err, docs) => {
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
                    doc.createdAt = require('moment')(doc.createdAt).toNow(true);
                    prettyDocs.push(doc);
                    cb();
                });
            }, (err) => {
                if(err) throw err;
                res.render('user/user', { user: req.user, puser: doc, posts: docs  });
            });
            //
        });
    });
});

module.exports = router;