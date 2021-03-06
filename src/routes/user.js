const router = require('express').Router();
const passwordless = require('passwordless');
const ObjectId = require('mongodb').ObjectId;
const eachOf = require('async').eachOf;
const isHexColor = require('validator').isHexColor;
const marked = require('marked');
const User = require('../models/User');
const Post = require('../models/Post');
marked.setOptions({
    sanitize: true
});

router.get('/me', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    User.findOne({ email: req.user }).exec((err, doc) => {
        if(err) throw err;
        if(doc === null) return res.status(404).render('error/404', { user: res.locals.user });
        Post.find({ poster: new ObjectId(res.locals.user._id) }).lean().exec((err, docs) => {
            res.render('user/me', { user: res.locals.user, posts: docs });
        });
    });
});

router.post('/update', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    let username = req.body.username;
    let bio = req.body.bio;
    let color = req.body.color || '#1300FF';
    let themeId = parseInt(req.body.theme);
    if(!isHexColor(color)) color = '#1300FF';
    if(!color.startsWith('#')) color = '#' + color;
    if(typeof themeId === NaN) themeId = 1;
    if(themeId !== 0 && themeId !== 1) themeId = 1;

    User.findOneAndUpdate({ email: req.user }, { $set: { username: username, bio: bio, profile: { color: color }, theme: { id: themeId } } }, (err, result) => {
        if(err) throw err;
        res.redirect('/user/me');
    });
});

router.get('/:identifier', (req, res) => {
    let id = req.params.identifier;
    if(!ObjectId.isValid(id)) return res.render('error/404', { user: res.locals.user });
    User.findById(id).exec((err, doc) => {
        if(err) throw err;
        if(doc === null) return res.render('error/404', { user: res.locals.user });
        //That was a valid user ID, return the profile page
        Post.find({ poster: new ObjectId(id) }).limit(4).sort({ createdAt: -1 }).lean().exec((err, docs) => {
            let prettyDocs = [];
            eachOf(docs, (doc, key, cb) => {
                //let id = new ObjectId(doc.poster);
                User.findById(doc.poster, (err, poster) => {
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
        });
    });
});

module.exports = router;