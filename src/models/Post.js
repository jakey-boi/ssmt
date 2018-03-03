const mongoose = require('mongoose');

let postSchema = mongoose.Schema({
    text: String,
    poster: String,
    createdAt: { type: Date, default: Date.now() }
});

module.exports = mongoose.model('Post', postSchema);