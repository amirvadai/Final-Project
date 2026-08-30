const express = require("express");

const mapController = require("../controllers/mapController");
const requireAuth = require("../Middleware/requireAuth");

const router = express.Router();

router.get("/map", requireAuth, mapController.showMap);
router.get("/api/map/posts", requireAuth, mapController.listPosts);
router.get(
    "/api/map/posts/:id",
    requireAuth,
    mapController.getPost
);

module.exports = router;
