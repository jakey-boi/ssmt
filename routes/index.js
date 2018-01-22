const router = require('express').Router();

router.get('/', (req, res) => {
    res.send('all good!');
});

//router.get('/')

module.exports = router;