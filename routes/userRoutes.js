const express = require("express");
const {
  registerUser,
  loginUser,
  getBalance,
  orderRig,
  startMining,
  getAvailableRigs,
  stopMining,
} = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/signup", registerUser);
router.post("/login", loginUser);
router.get("/balance", protect, getBalance);
router.get("/available-rigs", protect, getAvailableRigs);
router.post("/order-rig", protect, orderRig);
router.post("/start-mining", protect, startMining);
router.post("/stop-mining", protect, stopMining);

module.exports = router;
