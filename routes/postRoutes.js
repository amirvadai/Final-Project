const express = require("express");

const router = express.Router();

const postController = require("../controllers/postController");
const requireAuth = require("../middleware/requireAuth");

// See posts

router.get(
    "/",
    requireAuth,
    postController.feed
);

// Create posts

router.get(
    "/posts/create",
    requireAuth,
    postController.showCreateForm
);

router.post(
    "/posts",
    requireAuth,
    postController.create
);

// Delete posts

router.post(
    "/posts/:id/delete",
    requireAuth,
    postController.remove
);


module.exports = router;