const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  // Add any other user fields you need
});

module.exports = mongoose.model('User', UserSchema);
