const User = require("../models/User");
const Rig = require("../models/Rig");

// Fetch all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Fetch all rigs
exports.getAllRigs = async (req, res) => {
  try {
    const rigs = await Rig.find();
    res.json(rigs);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Fetch daily rewards
exports.getDailyRewards = async (req, res) => {
  try {
    const users = await User.find();
    const rewards = users.map((user) => {
      let totalReward = 0;
      user.rigs.forEach((rig) => {
        totalReward += rig.dailyReturn;
      });
      return { userId: user._id, reward: totalReward };
    });
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
