const mongoose = require("mongoose");

const bankSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  accountHolderName: {
    type: String,
    required: true,
  },
  accountNumber: {
    type: String,
    required: true,
  },
  bankName: {
    type: String,
    required: true,
  },
  ifscCode: {
    type: String,
    required: true,
  },
});

const Bank = mongoose.model("Bank", bankSchema);

module.exports = Bank;
