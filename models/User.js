const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  referralCode: { type: String },
  referredUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  rigs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rig" }],
});

module.exports = mongoose.model("User", userSchema);
