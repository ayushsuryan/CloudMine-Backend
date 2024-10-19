const express = require("express");
const {
  getAllUsers,
  getAllRigs,
  getDailyRewards,
} = require("../controllers/adminController");
const { protect, admin } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/users", protect, admin, getAllUsers);
router.get("/rigs", protect, admin, getAllRigs);
router.get("/daily-rewards", protect, admin, getDailyRewards);

module.exports = router;
