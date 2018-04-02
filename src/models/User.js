const mongoose = require('mongoose');

let userSchema = mongoose.Schema({
    username: String,
    email: String,
    joinedAt: { type: Date, default: Date.now() },
    bio: { type: String, default: '' },
    profile: {
        color: { type: String, default: '#1300FF' }
    },
    theme: {
        id: { type: Number, default: 0 }
    }
});

module.exports = mongoose.model('User', userSchema);