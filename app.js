const config = require('./config.json');

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const passwordless = require('passwordless');
const pwlStore = require('passwordless-mongostore');
const email = require('@sendgrid/mail');
const session = require('express-session');
const sessionStore = require('connect-mongo')(session);
const helmet = require('helmet');
const User = require('./src/models/User');
const Post = require('./src/models/Post');
const snek = require('snekfetch');
const RSS = require('rss');

const app = express();

/* SETUP PASSWORDLESS */
passwordless.init(new pwlStore(`mongodb://localhost/passwordless`));
passwordless.addDelivery((token, uid, recipient, cb, req) => {
    let host = config.host;
    let msg = {
        to: recipient,
        from: `no-reply@${host}`,
        subject: 'SSMT Login Token',
        html: `Here's your login URL: <a href="http://${host}/?token=${token}&uid=${encodeURIComponent(uid)}">http://${host}/?token=${token}&uid=${encodeURIComponent(uid)}</a>`
    };
    if(config.dev){
        console.log(`http://${host}/?token=${token}&uid=${encodeURIComponent(uid)}`);
        cb(null);
    } else {
        email.send(msg)
            .catch(e => {
                console.log(`Error sending email! ${e}`);
                cb(e);
            })
            .then(() => {
                cb(null);
            });
    }

    User.findOne({ email: uid }, (err, doc) => {
        if(err) throw err;
        if(doc){

        } else {
            let newUser = new User({ username: uid, email: uid });
            newUser.save((err, newDoc) => {
                if(err) throw err;
            });
        }
    });
});

/* HELMET */
if(config.dev) app.use(require('morgan')('dev'));
app.use(helmet());

/* OTHER MIDDLEWARE */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ store: new sessionStore({ url: `mongodb://localhost/e-sessions` }), secret: config.secret, saveUninitialized: false, resave: false, cookie: { maxAge: 60000*60*24*7 } }));
app.use(passwordless.sessionSupport());
app.use(passwordless.acceptToken({ successRedirect: '/' }));

/* ADD MORE INFO ABOUT THE USER, IF AUTHENTICATED */
app.use((req, res, next) => {
    if(req.user){
        User.findOne({ email: req.user }, (err, doc) => {
            if(err) throw err;
            res.locals.user = doc;
            next();
        });
    } else {
        next();
    }
});

/* STATIC FILES */
app.use(express.static('src/public'));

/* ROUTES */
const indexRoute = require('./src/routes/index.js');
const postsRoute = require('./src/routes/posts.js');
const userRoute = require('./src/routes/user.js');
const adminRoute = require('./src/routes/admin.js');
const themeRoute = require('./src/routes/theme.js');

app.use('/', indexRoute);
app.use('/posts', postsRoute);
app.use('/user', userRoute);
app.use('/admin', adminRoute);
app.use('/css', themeRoute);

/* VIEW ENGINE AND FOLDER */
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/src/views`);

/* LOAD THE CONFIG */
app.locals.config = require('./config.json');

/* SETUP SENDGRID */
email.setApiKey(config.sendgrid.apikey);

/* 404 */
app.get('*', (req, res) => {
    res.status(404).render('error/404', { user: req.user });
});

/* LISTEN */
app.listen(config.port, () => {
    console.log(`[INFO] Server listening on port ${config.port}...`);
    mongoose.connect('mongodb://localhost/ssmt');
    app.locals.db = mongoose.connection;
    app.locals.db.once('open', () => {
        console.log(`[DATABASE] Connection to database established!`);
        app.locals.stats = {};
        User.count((err, count) => {
            if(err) throw err;
            app.locals.stats.users = count;
        });
        Post.count((err, count) => {
            if(err) throw err;
            app.locals.stats.posts = count;
        });
        Post.find({}).lean().exec((err, posts) => {
            posts.forEach(p => {
                app.locals.rss.item({
                    title: p.title,
                    description: p.text,
                    author: p.poster,
                    date: p.createdAt,
                    url: `http://${config.host}/posts/${p._id}`
                });
                app.locals.rssCache = app.locals.rss.xml();
            });
        });
        setInterval(() => {
            //Update RSS feed every 30m
            Post.find({}).lean().exec((err, posts) => {
                posts.forEach(p => {
                    app.locals.rss.item({
                        title: p.text,
                        description: p.text,
                        author: p.poster,
                        date: p.createdAt,
                        url: `http://${config.host}/posts/${p._id}`
                    });
                    app.locals.rssCache = app.locals.rss.xml();
                });
            });
        }, 1800000);
    });
    app.locals.db.on('error', (err) => {
        console.log(`[DB ERR] ${err}`);
    });
    app.locals.rss = new RSS({
        title: 'SSMT RSS Feed',
        feed_url: `http://${config.host}/rss`,
        site_url: `http://${config.host}`,
        copyright: '(c) 2018 MikeModder'
    });
});