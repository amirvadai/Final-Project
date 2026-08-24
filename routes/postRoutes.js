const express = require("express");

const router = express.Router();

const postController = require("../controllers/postController");
const requireAuth = require("../middleware/requireAuth");

const multer = require("multer");
const path = require("path");
//Upload files

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../public/uploads"));
    },

    filename: function (req, file, cb) {
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1E9);

        cb(
            null,
            uniqueName + path.extname(file.originalname)
        );
    }
});

const upload = multer({
    storage: storage
});

//See posts

router.get(
    "/",
    requireAuth,
    postController.feed
);

//Create posts

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

//Delete posts

router.post(
    "/posts/:id/delete",
    requireAuth,
    postController.remove
);

//Update posts
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

//
module.exports = router;