const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');

const app = express();

/* STATIC FILES */
app.use(express.static('public'));

/* OTHER MIDDLEWARE */
app.use(bodyParser.urlencoded({ extended: true }));

/* ROUTES */
const indexRoute = require('./routes/index.js');
const postsRoute = require('./routes/posts.js');

app.use('/', indexRoute);
app.use('/posts', postsRoute);

/* VIEW ENGINE AND FOLDER */
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

/* DATABASE */
app.locals.db = new sqlite3.Database(`${__dirname}/data/ssmt.db`);

/* LISTEN */
app.listen(8080, () => {
    console.log(`[INFO] Server listening on port 8080!`);
});