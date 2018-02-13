const config = require('./config.json');

const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const passwordless = require('passwordless');
const pwlStore = require('passwordless-sqlite3store');
const email = require('@sendgrid/mail');
const session = require('express-session');
const sessionStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const dd = config.datadog ? require('connect-datadog')({ response_code: true, tags: ['app:ssmt'] }) : null;
const StatD = config.datadog ? require('node-dogstatsd') : null;
let dogStats = config.datadog ? new StatD() : null;

const app = express();

/* SETUP PASSWORDLESS */
passwordless.init(new pwlStore(`${__dirname}/data/pwl.db`));
passwordless.addDelivery((token, uid, recipient, cb, req) => {
    let host = config.host;
    let msg = {
        to: recipient,
        from: 'no-reply@vps.unsafe.men',
        subject: 'SSMT Login Token',
        html: `Here's your login URL: <a href="http://${host}/?token=${token}&uid=${encodeURIComponent(uid)}">http://${host}/?token=${token}&uid=${encodeURIComponent(uid)}</a>`
    }
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

    app.locals.db.get('SELECT * FROM users WHERE email = ?', uid, (err, row) => {
        if(err) throw err;
        if(row){
            //do nothing
        } else {
            app.locals.db.run('INSERT INTO users (username, email, joinedAt) VALUES (?, ?, ?)', uid, uid,  Date.now(), (err) => {
                if(err) throw err;
            });
        }
    });

});

/* HELMET */
app.use(helmet());

/* STATIC FILES */
app.use(express.static('public'));

/* OTHER MIDDLEWARE */
if(config.datadog) app.use(dd);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ store: new sessionStore({ dir: `${__dirname}/data` }), secret: 'aaaa', saveUninitialized: false, resave: false }));
app.use(passwordless.sessionSupport());
app.use(passwordless.acceptToken({ successRedirect: '/' }));

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
app.locals.db = new sqlite3.Database(`${__dirname}/data/ssmt.db`);
app.locals.config = require('./config.json');

/* SETUP SENDGRID */
email.setApiKey(config.sendgrid.apikey);

/* 404 */
app.get('*', (req, res) => {
    res.render('error/404', { user: req.user });
});

/* SEND CURRENT STATS TO DOTADOG */
if(config.datadog){
    app.locals.db.get('SELECT * FROM users', (err, rows) => {
        dogStats.set('ssmt.usercount', rows.length);
    });
    app.locals.db.get('SELECT * FROM posts', (err, rows) => {
        dogStats.set('ssmt.postcount', rows.length);
    });
}

/* LISTEN */
app.listen(config.port, () => {
    console.log(`[INFO] Server listening on port 8080!`);
});