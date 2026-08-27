const express = require("express");

const analyticsController = require("../controllers/analyticsController");
const requireAuth = require("../Middleware/requireAuth");

const router = express.Router();

router.get(
    "/analytics",
    requireAuth,
    analyticsController.page
);

router.get(
    "/api/analytics",
    requireAuth,
    analyticsController.data
);

router.get(
    "/api/analytics/weather",
    requireAuth,
    analyticsController.weather
);

module.exports = router;
