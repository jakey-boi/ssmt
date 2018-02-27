const config = require('./config.json');

const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const passwordless = require('passwordless');
const pwlStore = require('passwordless-mongostore');
const email = require('@sendgrid/mail');
const session = require('express-session');
const sessionStore = require('connect-mongo')(session);
const helmet = require('helmet');
const dd = config.datadog ? require('connect-datadog')({ response_code: true, tags: ['app:ssmt'] }) : null;
const StatD = config.datadog ? require('node-dogstatsd').StatsD : null;
let dogStats = config.datadog ? new StatD() : null;
const snek = require('snekfetch');
const isURL = require('validator').isURL;

const app = express();

/* SETUP PASSWORDLESS */
passwordless.init(new pwlStore(`mongodb://localhost/passwordless`));
passwordless.addDelivery((token, uid, recipient, cb, req) => {
    let host = config.host;
    let msg = {
        to: recipient,
        from: isURL(host) ? `no-reply@${config.host}` : 'no-reply@ssmt-default-domain.com',
        subject: 'SSMT Login Token',
        html: `Here's your login URL: <a href="http://${host}/?token=${token}&uid=${encodeURIComponent(uid)}">http://${host}/?token=${token}&uid=${encodeURIComponent(uid)}</a>`
    };
    console.log(msg)
    if(config.dev){
        console.log(`http://${host}/?token=${token}&uid=${encodeURIComponent(uid)}`);
        cb(null);
    } else {
        if(config.customEmail.enabled && recipient.endsWith(config.customEmail.for)){
            msg.from = `${config.customEmail.user}${config.customEmail.for}`;
        }
        email.send(msg)
            .catch(e => {
                console.log(`Error sending email! ${e}`);
                cb(e);
            })
            .then(() => {
                cb(null);
            });
    }

    app.locals.userdb.findOne({ email: uid }, (err, doc) => {
        if(err) throw err;
        if(doc){

        } else {
            app.locals.userdb.insertOne({ username: uid, email: uid, joinedAt: Date.now(), bio: '', profile: { color: '#1300FF' } }, (err, res) => {
                if(err) throw err;
            });
        }
    });
});

/* HELMET */
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
        app.locals.userdb.findOne({ email: req.user }, (err, doc) => {
            if(err) throw err;
            res.locals.user = doc;
            next();
        });
    } else {
        next();
    }
});

/* STATIC FILES */
app.use(express.static('public'));

/* ROUTES */
const indexRoute = require('./routes/index.js');
const postsRoute = require('./routes/posts.js');
const userRoute = require('./routes/user.js');
const adminRoute = require('./routes/admin.js');

app.use('/', indexRoute);
app.use('/posts', postsRoute);
app.use('/user', userRoute);
app.use('/admin', adminRoute);

/* VIEW ENGINE AND FOLDER */
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

/* DATABASE & CONFIG */
MongoClient.connect('mongodb://localhost', (err, client) => {
    if(err) throw err;
    console.log(`[DB] Connection OK`);
    let db = client.db('ssmt');
    app.locals.db = db.collection('posts');
    app.locals.userdb = db.collection('users');
    
    app.locals.stats = {};
    app.locals.db.find().count((err, res) => {
        if(err) throw err;
        app.locals.stats.posts = res;
    });
    app.locals.userdb.find().count((err, res) => {
        if(err) throw err;
        app.locals.stats.users = res;
    });

    /* SEND CURRENT STATS TO DATADOG */
    if(config.datadog){
        app.locals.db.find().count((err, res) => {
            if(err) throw err;
            app.locals.dogStats.set('ssmt.postcount', res);
        });
        app.locals.userdb.find().count((err, res) => {
            if(err) throw err;
            app.locals.dogStats.set('ssmt.usercount', res);
        });
    }
});
if(config.datadog) app.locals.dogStats = dogStats;
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
});