const express = require("express");

const userController = require("../controllers/userController");
const requireAuth = require("../Middleware/requireAuth");

const router = express.Router();

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "avatar-" + uniqueName + path.extname(file.originalname)); 
  }
});

const upload = multer({ storage: storage });

// Users area tabs
router.get("/users", requireAuth, userController.list);
router.get("/users/friends", requireAuth, userController.friends);
router.get("/users/requests", requireAuth, userController.requests);

// Profile editing / account settings
router.get(
    "/profile/edit",
    requireAuth,
    userController.showEditProfileForm
);
router.post(
    "/profile/edit",
    requireAuth,
    upload.single("avatar"),
    userController.updateProfile
);
router.post(
    "/profile/delete",
    requireAuth,
    userController.deleteAccount
);

// Friendship actions
router.post(
    "/users/:id/friend",
    requireAuth,
    userController.addFriendOrRequest
);
router.post(
    "/users/:id/friend/accept",
    requireAuth,
    userController.acceptRequest
);
router.post(
    "/users/:id/friend/decline",
    requireAuth,
    userController.declineRequest
);
router.post(
    "/users/:id/friend/cancel",
    requireAuth,
    userController.cancelRequest
);
router.post(
    "/users/:id/friend/remove",
    requireAuth,
    userController.removeFriend
);

// Keep this after /users/friends and /users/requests, otherwise "friends"
// and "requests" would be interpreted as user IDs.
router.get("/users/:id", requireAuth, userController.profile);


module.exports = router;
