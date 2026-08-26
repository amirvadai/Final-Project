const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const postController = require("../controllers/postController");
const requireAuth = require("../Middleware/requireAuth");

const router = express.Router();

const uploadDir = path.join(__dirname, "../public/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1e9);

        cb(null, uniqueName + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Feeds
router.get("/", requireAuth, postController.feed);
router.get(
    "/feed/friends",
    requireAuth,
    postController.friendsFeed
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
    upload.single("media"),
    postController.create
);

// Delete posts
router.post(
    "/posts/:id/delete",
    requireAuth,
    postController.remove
);

// Update posts
router.get(
    "/posts/:id/edit",
    requireAuth,
    postController.showEditForm
);
router.post(
    "/posts/:id",
    requireAuth,
    postController.update
);

module.exports = router;
