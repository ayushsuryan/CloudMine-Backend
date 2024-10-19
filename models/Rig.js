const mongoose = require("mongoose");

const rigSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  rigType: { type: String, required: true },
  price: { type: Number, required: true },
  dailyReturn: { type: Number, required: true },
  purchaseDate: { type: Date, default: Date.now },
  miningDays: { type: Number, default: 90 },
  status: { type: String, default: "stopped" },
});

module.exports = mongoose.model("Rig", rigSchema);
