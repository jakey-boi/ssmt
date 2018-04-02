const router = require('express').Router();
const User = require('../models/User');

router.get('/theme.css', (req, res) => {
    if(!res.locals.user){
        // There is no user, so they can't have a theme set
        return res.send('');
    }
    /*
    * Theme IDs:
    * 0 Light (default)
    * 1 Dark
    */
   const id = res.locals.user.theme.id;
    switch (id) {
        case 0:
            res.status(200).send('');
            break;
        case 1:
            res.status(200).sendFile('css/dark.css', { root: `${process.cwd()}/src/public` });
            break;
        default:
            // Somebody was messing around and set and invalid theme, gg.
            // Or they didn't have a theme set.
            // I guess I'll fix it for them...
            User.findOneAndUpdate({ email: req.user }, { $set: { theme: { id: 1 } } }, (err, doc, ures) => {
                if(err) throw err;
                res.sendFile('css/dark.css', { root: `${process.cwd()}/src/public` });
            });
            break;
    }
});

module.exports = router;