const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const messageController = require("../controllers/messageController");
const requireAuth = require("../Middleware/requireAuth");

const router = express.Router();
const uploadDirectory = path.join(__dirname, "..", "public", "uploads", "messages");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename(req, file, cb) {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter(req, file, cb) {
        if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
            return cb(null, true);
        }

        cb(new Error("INVALID_MEDIA_TYPE"));
    }
});

function uploadMessageMedia(req, res, next) {
    upload.single("media")(req, res, (error) => {
        if (!error) {
            return next();
        }

        const status = error.code === "LIMIT_FILE_SIZE" ? "media-too-large" : "invalid-media";

        if (req.params.userId) {
            return res.redirect(`/messages/new/${req.params.userId}?status=${status}`);
        }

        if (req.params.id) {
            return res.redirect(`/messages/${req.params.id}?status=${status}`);
        }

        res.status(400).send("Invalid media upload");
    });
}

router.get("/messages", requireAuth, messageController.inbox);
router.get("/messages/requests", requireAuth, messageController.requests);
router.get("/messages/new", requireAuth, messageController.newMessage);
router.get("/messages/new/:userId", requireAuth, messageController.compose);
router.post("/messages/new/:userId", requireAuth, uploadMessageMedia, messageController.startConversation);
router.post("/messages/:id/approve", requireAuth, messageController.approve);
router.post("/messages/:id/decline", requireAuth, messageController.decline);
router.post("/messages/:id/send", requireAuth, uploadMessageMedia, messageController.sendMessage);
router.get("/messages/:id", requireAuth, messageController.conversation);

module.exports = router;
