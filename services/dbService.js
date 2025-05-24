const User = require('../models/User');
const { ADMIN_IDS } = require('../config/env');

const getUser = async (userId) => {
  let user = await User.findOne({ userId });
  
  if (!user) {
    user = new User({
      userId,
      isAdmin: ADMIN_IDS.includes(userId),
    });
    await user.save();
  }
  
  return user;
};

module.exports = {
  getUser,
};