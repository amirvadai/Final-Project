const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const groupController = require("../controllers/groupController");
const requireAuth = require("../Middleware/requireAuth");

const router = express.Router();

const groupCoverDirectory = path.join(
    __dirname,
    "..",
    "public",
    "uploads",
    "groups",
    "covers"
);

const groupPostDirectory = path.join(
    __dirname,
    "..",
    "public",
    "uploads",
    "groups",
    "posts"
);

fs.mkdirSync(groupCoverDirectory, { recursive: true });
fs.mkdirSync(groupPostDirectory, { recursive: true });

const EXTENSION_BY_MIME_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov"
};

const GROUP_COVER_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
]);

const GROUP_POST_MIME_TYPES = new Set(
    Object.keys(EXTENSION_BY_MIME_TYPE)
);

function extensionFor(file) {
    return EXTENSION_BY_MIME_TYPE[file.mimetype] || "";
}

function createStorage(destination) {
    return multer.diskStorage({
        destination(req, file, callback) {
            callback(null, destination);
        },

        filename(req, file, callback) {
            const uniqueName =
                Date.now() + "-" + Math.round(Math.random() * 1e9);

            callback(null, uniqueName + extensionFor(file));
        }
    });
}

const coverUpload = multer({
    storage: createStorage(groupCoverDirectory),

    limits: {
        fileSize: 8 * 1024 * 1024,
        files: 1
    },

    fileFilter(req, file, callback) {
        if (!GROUP_COVER_MIME_TYPES.has(file.mimetype)) {
            return callback(
                new Error(
                    "A group cover must be JPG, PNG, WebP, or GIF."
                )
            );
        }

        callback(null, true);
    }
});

const groupPostUpload = multer({
    storage: createStorage(groupPostDirectory),

    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1
    },

    fileFilter(req, file, callback) {
        if (!GROUP_POST_MIME_TYPES.has(file.mimetype)) {
            return callback(
                new Error(
                    "Group posts accept JPG, PNG, WebP, GIF, MP4, WebM, or MOV files."
                )
            );
        }

        callback(null, true);
    }
});

function singleUpload(upload, fieldName) {
    return function uploadMiddleware(req, res, next) {
        upload.single(fieldName)(req, res, (error) => {
            if (!error) {
                return next();
            }

            console.error("Upload failed:", error);

            const message =
                error instanceof multer.MulterError
                    ? `Upload failed: ${error.message}`
                    : error.message || "Upload failed.";

            return res.status(400).send(message);
        });
    };
}

// Browse and create groups
router.get("/groups", requireAuth, groupController.list);
router.get("/groups/create", requireAuth, groupController.showCreateForm);

router.post(
    "/groups",
    requireAuth,
    singleUpload(coverUpload, "coverImage"),
    groupController.create
);

// Group settings
router.get(
    "/groups/:id/edit",
    requireAuth,
    groupController.showEditForm
);

router.post(
    "/groups/:id/edit",
    requireAuth,
    singleUpload(coverUpload, "coverImage"),
    groupController.update
);

router.post(
    "/groups/:id/delete",
    requireAuth,
    groupController.remove
);

// Membership
router.post(
    "/groups/:id/join",
    requireAuth,
    groupController.join
);

router.post(
    "/groups/:id/leave",
    requireAuth,
    groupController.leave
);

router.post(
    "/groups/:id/requests/:userId/approve",
    requireAuth,
    groupController.approveRequest
);

router.post(
    "/groups/:id/requests/:userId/reject",
    requireAuth,
    groupController.rejectRequest
);

router.post(
    "/groups/:id/members/:userId/remove",
    requireAuth,
    groupController.removeMember
);

// Group posts
router.post(
    "/groups/:id/posts",
    requireAuth,
    singleUpload(groupPostUpload, "media"),
    groupController.createPost
);

router.post(
    "/groups/:id/posts/:postId/delete",
    requireAuth,
    groupController.deletePost
);

// Keep this last so "/groups/create" and "/groups/:id/edit" are not
// interpreted as group IDs.
router.get("/groups/:id", requireAuth, groupController.details);

module.exports = router;
