const mongoose = require('mongoose');

let userSchema = mongoose.Schema({
    username: String,
    email: String,
    joinedAt: { type: Date, default: Date.now() },
    bio: { type: String, default: '' },
    profile: {
        color: { type: String, default: '#1300FF' }
    }
});

module.exports = mongoose.model('User', userSchema);