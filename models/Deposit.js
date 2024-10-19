// models/Deposit.js
const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  chid: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  order_id: {
    type: String,
    required: true,
  },
  apiResponse: {
    type: Object,
    default: {},
  },
  status: {
    type: String,
    enum: ["initiated", "pending", "success", "failed"],
    default: "initiated",
  },
  initiatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Deposit", depositSchema);
