const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const requireAuth = require("../middleware/requireAuth");

router.get("/users", requireAuth, userController.list);

router.get("/users/:id", requireAuth, userController.profile);

//user updates
router.get("/profile/edit", requireAuth, userController.showEditProfileForm);
router.post("/profile/edit", requireAuth, userController.updateProfile);

//delete user
router.post("/profile/delete", requireAuth, userController.deleteAccount);

module.exports = router;