const router = require('express').Router();
const passwordless = require('passwordless');
const snek = require('snekfetch');
const ObjectId = require('mongodb').ObjectId;
const eachOf = require('async').eachOf;
const marked = require('marked');
const User = require('../models/User');
const Post = require('../models/Post');
marked.setOptions({
    sanitize: true
});
const config = require('../../config.json');

router.get('/', (req, res) => {
    Post.find().sort({ createdAt: -1 }).lean().exec((err, docs) => {
        if(err) throw err;
        let prettyDocs = [];
        eachOf(docs, (doc, key, cb) => {
            let id = new ObjectId(doc.poster);
            User.findById(id, (err, poster) => {
                if(err) throw err;
                doc.poster = {
                    username: poster.username,
                    id: poster._id,
                    color: poster.profile.color
                };
                doc.createdAt = require('moment')(doc.createdAt).toNow(true);
                doc.text = marked(doc.text);
                prettyDocs.push(doc);
                cb();
            });
        }, (err) => {
            if(err) throw err;
            res.render('posts/recent', { posts: prettyDocs, user: res.locals.user });
        });
        
    });
});

router.get('/new', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    res.render('posts/new', { user: res.locals.user });
});

router.post('/new', passwordless.restricted({ failureRedirect: '/login' }), (req, res) => {
    if(!req.body.text) return res.render('error/generic', { user: res.locals.user, msg: 'Missing post body!' });
    if(req.body.text.length > 300) return res.render('error/generic', { user: res.locals.user, msg: 'Post content can not be over 300 characters!' });
    if(req.body.text.length < 4) return res.render('error/generic', { user: res.locals.user, msg: 'Post content must be at least 4 characters!!' });
    let post = new Post({ text: req.body.text, poster: res.locals.user._id });
    post.save((err, newDoc) => {
        if(err) throw err;
        let postId = newDoc._id;
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
                        value: `${res.locals.user.username} (${res.locals.user._id})`,
                        inline: false
                    },
                    {
                        name: 'Post timestamp',
                        value: isoTime,
                        inline: false
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

router.get('/:id', (req, res) => {
    let id = req.params.id;
    if(!id || !ObjectId.isValid(id)) return res.redirect('/posts');
    Post.findOne(new ObjectId(id)).exec((err, post) => {
        if(err) throw err;
        if(post === null) return res.status(404).render('error/404', { user: res.locals.user });
        User.findById(new ObjectId(post.poster)).exec((err, user) => {
            if(err) throw err;
            post.poster = { username: 'Error', id: 'ERR_INVALID_USER', color: '#FF0000' };
            console.log(user.username, user._id, user.profile.color);
            let text = marked(post.text);
            let poster = {
                username: user.username,
                id: user._id,
                color: user.profile.color
            };
            res.render('posts/post', { post: { text: text, poster: poster }, user: res.locals.user });
        });
    });
});

module.exports = router;