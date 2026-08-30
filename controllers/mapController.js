const mapModel = require("../models/mapModel");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 2 * DAY_MS;

function mapsBrowserKey() {
    return (
        process.env.GOOGLE_MAPS_BROWSER_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        ""
    );
}

function parseDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

function showMap(req, res) {
    res.render("map/index", {
        activeFeed: "map",
        googleMapsApiKey: mapsBrowserKey(),
        selectedPostId: String(req.query.post || "")
    });
}

async function listPosts(req, res) {
    try {
        const now = new Date();
        const defaultStart = new Date(now.getTime() - DAY_MS);
        const start = req.query.start
            ? parseDate(req.query.start)
            : defaultStart;
        const end = req.query.end
            ? parseDate(req.query.end)
            : now;

        if (
            !start ||
            !end ||
            end <= start ||
            end.getTime() - start.getTime() > MAX_WINDOW_MS
        ) {
            return res.status(400).json({
                error: "Choose a valid time window of no more than 48 hours."
            });
        }

        const posts = await mapModel.getPostsForMap(
            req.session.userId,
            start,
            end
        );

        res.json({
            start: start.toISOString(),
            end: end.toISOString(),
            posts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Could not load posts for the map."
        });
    }
}

async function getPost(req, res) {
    try {
        const post = await mapModel.getMapPostById(
            req.session.userId,
            req.params.id
        );

        if (!post) {
            return res.status(404).json({
                error: "This post has no accessible map location."
            });
        }

        res.json({
            post
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Could not load the post location."
        });
    }
}

module.exports = {
    showMap,
    listPosts,
    getPost
};
