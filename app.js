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

const app = express();

/* SETUP PASSWORDLESS */
passwordless.init(new pwlStore(`mongodb://localhost/passwordless`));
passwordless.addDelivery((token, uid, recipient, cb, req) => {
    let host = config.host;
    let msg = {
        to: recipient,
        from: 'no-reply@vps.unsafe.men',
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
app.use(require('morgan')('dev'));
app.use(helmet());

/* OTHER MIDDLEWARE */
if(config.datadog) app.use(dd);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ store: new sessionStore({ url: `mongodb://localhost/e-sessions` }), secret: 'aaaa', saveUninitialized: false, resave: false }));
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

app.use('/', indexRoute);
app.use('/posts', postsRoute);
app.use('/user', userRoute);
app.use('/admin', adminRoute);

/* VIEW ENGINE AND FOLDER */
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/src/views`);

/* LOAD THE CONFIG */
app.locals.config = require('./config.json');

/* SETUP SENDGRID */
email.setApiKey(config.sendgrid.apikey);

/* 404 */
app.get('*', (req, res) => {
    res.render('error/404', { user: req.user });
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
    });
    app.locals.db.on('error', (err) => {
        console.log(`[DB ERR] ${err}`);
    });
});