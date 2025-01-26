const User = require("../models/User");
const Rig = require("../models/Rig");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const Bank = require("../models/Bank");
const generateToken = require("../utils/generateToken");
const Referral = require("../models/Referral");
const axios = require("axios");
const qs = require("qs");

// User Signup
exports.registerUser = async (req, res) => {
  const { name, email, password, referralCode } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ msg: "User already exists" });

    let referredByUser = null;
    if (referralCode) {
      referredByUser = await User.findOne({ referralCode });
    }

    const newUser = new User({
      name,
      email,
      password,
      referredBy: referredByUser?._id,
      referralCode: Math.random().toString(36).substring(2, 10),
    });

    if (referredByUser) {
      referredByUser.referredUsers.push(newUser._id);
      await referredByUser.save();
    }

    await newUser.save();
    res.json({ token: generateToken(newUser._id) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// User Login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    res.json({ token: generateToken(user._id) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// User Deposit
exports.createDeposit = async (req, res) => {
  const { chid, amount, order_id, callback, page_url } = req.body;
  const user = req.user; // Access the user from request object

  // Input Validation
  if (!chid || !amount || !callback || !page_url) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  // Prepare payload for MXPay API in URL-encoded format
  const payload = {
    api_key: process.env.API_KEY,
    chid,
    amount: parseFloat(amount),
    order_id: order_id,
    callback,
    page_url,
  };

  console.log("Payload:", payload);

  // Create a new deposit entry in the database (with initated status)
  const newDeposit = new Deposit({
    user: user._id, // Save the user's ID
    chid,
    amount: parseFloat(amount),
    order_id: order_id,
  });

  try {
    // Make POST request to MXPay's /api/web.php endpoint with URL-encoded payload
    const response = await axios.post(
      "https://mxpay.one/api/web.php",
      qs.stringify(payload), // Convert payload to x-www-form-urlencoded format
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded", // Set correct content type
        },
      }
    );

    // Store the response in the deposit entry
    newDeposit.apiResponse = response.data;

    // Check if MXPay responded with success
    if (response.data.status == true) {
      newDeposit.status = "pending";
      await newDeposit.save(); // Save the pending deposit data into the database

      return res.status(200).json({
        message: "Deposit initiated successfully.",
        data: response.data,
        deposit: newDeposit,
      });
    } else {
      newDeposit.status = "initiated";
      await newDeposit.save(); // Save the initiated deposit to the database

      return res.status(400).json({
        error: "Failed to initiate deposit.",
        details: response.data,
        deposit: newDeposit,
      });
    }
  } catch (error) {
    console.error(
      "Deposit API Error:",
      error.response ? error.response.data : error.message
    );

    newDeposit.status = "failed";
    await newDeposit.save(); // Save the failed deposit attempt to the database

    return res.status(500).json({
      error: "An error occurred while processing the deposit.",
      deposit: newDeposit,
    });
  }
};

exports.handleCallback = async (req, res) => {
  const { order_id, status, amount } = req.body;

  // Input Validation
  if (!order_id || typeof status === "undefined" || !amount) {
    return res.status(400).json({ error: "Invalid callback data." });
  }

  try {
    // Find the deposit using the order_id
    const deposit = await Deposit.findOne({ order_id }).populate("user"); // Populate the user reference

    if (!deposit) {
      return res.status(404).json({ error: "Deposit not found." });
    }

    // Verify the payment status received from MXPay
    if (status === "success") {
      // Update the deposit status to completed if payment was successful
      deposit.status = "success";

      // Find the associated user and update their balance
      const user = deposit.user;
      if (user) {
        user.balance = (user.balance || 0) + parseFloat(amount); // Add the deposit amount to the user's balance
        await user.save(); // Save the updated user
      }
    } else {
      // Update the deposit status to failed if payment was not successful
      deposit.status = "failed";
    }

    // Save the updated deposit
    await deposit.save();

    console.log("Payment Callback Processed:", req.body);

    // Respond to the callback
    res
      .status(200)
      .json({ message: "Callback received and processed successfully." });
  } catch (error) {
    console.error("Error processing callback:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// Fetch Balance
exports.getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

//Defining Available Rigs

// Fetch all rigs purchased by the user
exports.getAvailableRigs = async (req, res) => {
  try {
    // Fetch the rigs that belong to the logged-in user
    const rigs = await Rig.find({ user: req.user._id }); // Assuming `user` is the field that references the User model

    // Check if rigs exist
    if (!rigs.length) {
      return res.status(404).json({ message: "No rigs found for this user" });
    }

    res.status(200).json(rigs);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching rigs", error: error.message });
  }
};

// Place Rig Order
exports.orderRig = async (req, res) => {
  const { rigType, price } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user || user.balance < price) {
      return res.status(400).json({ msg: "Insufficient balance" });
    }

    const rig = new Rig({
      user: user._id,
      rigType,
      price,
      dailyReturn: price * 0.02,
    });

    // Use findOneAndUpdate to atomically update the user's balance
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $inc: { balance: -price }, $push: { rigs: rig._id } }, // Deduct balance and push the rig
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(400)
        .json({ msg: "User not found or insufficient balance." });
    }

    await rig.save(); // Save the new rig after updating the user's balance
    res.json({ msg: "Rig ordered successfully", rig });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Start Mining
let globalMiningInterval = null;

exports.startMining = async (req, res) => {
  const { rigId } = req.body;

  try {
    // Find the specific rig
    let rig = await Rig.findById(rigId);
    if (!rig) return res.status(404).json({ msg: "Invalid rig" });

    // Check if the user owns the rig
    if (rig.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ msg: "Unauthorized access to this rig" });
    }

    // Check if mining is already completed
    if (rig.status === "completed") {
      return res.status(400).json({
        msg: "Mining period is completed for this rig and cannot be resumed.",
      });
    }

    // Set rig status to active
    if (rig.status === "stopped" || rig.status === "active") {
      rig.status = "active";
      await rig.save();
    }

    // Set up global mining interval if not already running
    if (!globalMiningInterval) {
      globalMiningInterval = setInterval(async () => {
        try {
          // Find all active rigs
          const activeRigs = await Rig.find({ status: "active" });

          // Group rigs by user
          const userRigsMap = {};
          activeRigs.forEach((rig) => {
            if (!userRigsMap[rig.user]) {
              userRigsMap[rig.user] = [];
            }
            userRigsMap[rig.user].push(rig);
          });

          // Process rigs for each user
          for (const userId of Object.keys(userRigsMap)) {
            let totalBalanceAddition = 0;
            let userTotalEarnings = 0;

            // Calculate earnings for each rig
            for (const rig of userRigsMap[userId]) {
              const currentDate = new Date();
              const purchaseDate = new Date(rig.purchaseDate);

              // Calculate days passed since rig purchase
              const timeDifference = currentDate - purchaseDate;
              const daysPassed = Math.floor(
                timeDifference / (1000 * 60 * 60 * 24)
              );

              // Calculate balance addition (micro-earnings)
              const balanceAddition = (
                rig.dailyReturn /
                (24 * 60 * 20)
              ).toFixed(2);

              totalBalanceAddition += parseFloat(balanceAddition);
              userTotalEarnings += parseFloat(balanceAddition);

              // Mark rig as completed if mining period is over
              if (daysPassed >= rig.miningDays) {
                rig.status = "completed";
              }

              await rig.save();
            }

            // Find the user and check referral status
            const user = await User.findById(userId).populate("referredBy");

            // Update user's balance
            await User.findOneAndUpdate(
              { _id: userId },
              { $inc: { balance: totalBalanceAddition } }
            );

            // Referral Reward System
            if (user.referredBy) {
              // First Layer Referral (5%)
              const firstLayerReferralAmount = userTotalEarnings * 0.05;
              await User.findOneAndUpdate(
                { _id: user.referredBy._id },
                { $inc: { balance: firstLayerReferralAmount } }
              );

              // Create first layer referral record
              await Referral.create({
                user: user.referredBy._id,
                referrer: user._id,
                layer: 1,
                amount: firstLayerReferralAmount,
              });

              // Second Layer Referral (2.5%)
              if (user.referredBy.referredBy) {
                const secondLayerReferralAmount = userTotalEarnings * 0.025;
                await User.findOneAndUpdate(
                  { _id: user.referredBy.referredBy },
                  { $inc: { balance: secondLayerReferralAmount } }
                );

                // Create second layer referral record
                await Referral.create({
                  user: user.referredBy.referredBy,
                  referrer: user._id,
                  layer: 2,
                  amount: secondLayerReferralAmount,
                });
              }
            }
          }
        } catch (err) {
          console.error(err.message);

          // Clear the interval if an error occurs
          clearInterval(globalMiningInterval);
          globalMiningInterval = null;
        }
      }, 3000); // Runs every 3 seconds
    }

    res.json({ msg: "Mining started or resumed successfully." });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Stop Mining
exports.stopMining = async (req, res) => {
  const { rigId } = req.body;

  try {
    // Find the rig by its ID
    const rig = await Rig.findById(rigId);
    if (!rig) return res.status(404).json({ msg: "Invalid rig" });

    // Check if the rig belongs to the user
    if (rig.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ msg: "Unauthorized access to this rig" });
    }

    // If rig is already completed, it cannot be stopped again
    if (rig.status === "completed") {
      return res
        .status(400)
        .json({ msg: "Mining already completed for this rig" });
    }

    // Stop the mining process if it is still active

    if (rig.status === "active") {
      rig.status = "stopped"; // Set the rig status to stopped
    }

    await rig.save(); // Save the updated rig status

    res.json({ msg: "Mining stopped successfully" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

//Create Bank details
exports.createBankDetails = async (req, res) => {
  try {
    const user = req.user; // Access the user from req.user

    const { accountHolderName, accountNumber, bankName, ifscCode } = req.body;

    // Check if the user already has bank details
    const existingBankDetails = await Bank.findOne({ user: user._id });

    if (existingBankDetails) {
      return res.status(400).json({
        error:
          "User already has bank details. You can update the existing details instead.",
      });
    }

    // If no bank details exist, create new ones
    const newBankDetails = new Bank({
      user: user._id,
      accountHolderName,
      accountNumber,
      bankName,
      ifscCode,
    });

    await newBankDetails.save();

    res.status(201).json({
      message: "Bank details created successfully",
      data: newBankDetails,
    });
  } catch (error) {
    res.status(500).json({
      error: "An error occurred while creating bank details",
    });
  }
};

//Fetch Bank Details
exports.getBankDetails = async (req, res) => {
  try {
    const user = req.user; // Access the user from req.user

    // Fetch bank details for the user
    const bankDetails = await Bank.findOne({ user: user._id });

    if (!bankDetails) {
      return res.status(404).json({
        error: "Bank details not found for the user.",
      });
    }

    res.status(200).json({
      message: "Bank details retrieved successfully",
      data: bankDetails,
    });
  } catch (error) {
    res.status(500).json({
      error: "An error occurred while fetching bank details",
    });
  }
};

// Create Withdrawals
exports.createWithdrawal = async (req, res) => {
  const { amount } = req.body;
  const user = req.user;

  if (amount <= 0) {
    return res
      .status(400)
      .json({ message: "Withdrawal amount must be positive" });
  }

  if (user.balance < amount) {
    return res.status(400).json({ message: "Insufficient balance" });
  }

  try {
    // Deduct the amount from user's balance
    user.balance -= amount;
    await user.save();

    const withdrawal = new Withdrawal({
      user: user._id,
      amount,
    });
    await withdrawal.save();

    res.status(201).json({ message: "Withdrawal request created" });
  } catch (err) {
    res.status(500).json({
      message: "Error creating withdrawal request",
      error: err.message,
    });
  }
};

// Get Withdrawals
exports.getWithdrawals = async (req, res) => {
  const user = req.user; // Assuming `req.user` contains the authenticated user's information

  try {
    // Find withdrawals associated with the current user
    const withdrawals = await Withdrawal.find({ user: user._id });

    if (!withdrawals || withdrawals.length === 0) {
      return res
        .status(404)
        .json({ message: "No withdrawals found for this user" });
    }

    res.status(200).json(withdrawals);
  } catch (err) {
    res.status(500).json({
      message: "Error retrieving withdrawals",
      error: err.message,
    });
  }
};

exports.getReferredUsers = async (req, res) => {
  try {
    // Fetch the current user by ID
    const user = await User.findById(req.user._id).populate({
      path: "referredUsers", // Populate the referredUsers array
      select: "name balance", // Select only the name and balance fields
    });

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Return the list of referred users with their name and balance
    res.json({
      referredUsers: user.referredUsers, // This will contain the array of users with name and balance
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.getReferralEarnings = async (req, res) => {
  try {
    const referrals = await Referral.find({ user: req.user._id })
      .populate("referrer", "name")
      .sort({ createdAt: -1 });

    const summary = {
      totalFirstLayerEarnings: referrals
        .filter((r) => r.layer === 1)
        .reduce((sum, r) => sum + r.amount, 0),
      totalSecondLayerEarnings: referrals
        .filter((r) => r.layer === 2)
        .reduce((sum, r) => sum + r.amount, 0),
      referrals,
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
