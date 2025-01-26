const express = require("express");
const {
  registerUser,
  loginUser,
  getBalance,
  orderRig,
  startMining,
  getAvailableRigs,
  stopMining,
  createDeposit,
  handleCallback,
  getWithdrawals,
  createWithdrawal,
  createBankDetails,
  getBankDetails,
  getReferredUsers,
  getReferralEarnings,
} = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/signup", registerUser);
router.post("/login", loginUser);
router.post("/deposit", protect, createDeposit);
router.get("/balance", protect, getBalance);
router.post("/callback", handleCallback);
router.get("/available-rigs", protect, getAvailableRigs);
router.post("/order-rig", protect, orderRig);
router.post("/start-mining", protect, startMining);
router.post("/stop-mining", protect, stopMining);
router.post("/create-bank", protect, createBankDetails);
router.get("/get-bank", protect, getBankDetails);
router.get("/get-withdrawals", protect, getWithdrawals);
router.post("/create-withdrawals", protect, createWithdrawal);
router.get("/referred-users", protect, getReferredUsers);
router.get("/referral-earnings", protect, getReferralEarnings);

module.exports = router;
