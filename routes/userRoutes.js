const express = require("express");

const userController = require("../controllers/userController");
const requireAuth = require("../Middleware/requireAuth");

const router = express.Router();

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
