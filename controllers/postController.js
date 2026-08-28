const { ObjectId } = require("mongodb");
const postModel = require("../models/postModel");

function safeReturnTo(value, fallback = "/") {
    if (
        typeof value === "string" &&
        value.startsWith("/") &&
        !value.startsWith("//")
    ) {
        return value;
    }

    return fallback;
}

async function feed(req, res) {
    try {
        const posts = await postModel.getPosts();

                console.log(
                    "COMMUNITY FEED:",
                    posts.map(post => post.text)
                );

        res.render("feed/index", {
            posts,
            userId: req.session.userId,
            activeFeed: "community"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function friendsFeed(req, res) {
    try {
        const posts = await postModel.getFriendPostsForUser(
            req.session.userId
        );

        res.render("feed/friends", {
            posts,
            userId: req.session.userId,
            activeFeed: "friends"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

function showCreateForm(req, res) {
    res.render("posts/create");
}

async function create(req, res) {
    try {
        const { text, locationName, lat, lon } = req.body;
        const file = req.file;

        if (!text || text.trim() === "") {
            return res.status(400).send("Post cannot be empty");
        }

        let type = "text";
        let mediaUrl = null;

        if (file) {
            mediaUrl = "/uploads/" + file.filename;

            if (file.mimetype.startsWith("image/")) {
                type = "image";
            } else if (file.mimetype.startsWith("video/")) {
                type = "video";
            }
        }

        let weather = null;

        if (lat && lon) {
            try {
                const apiKey = process.env.OPENWEATHER_API_KEY;
                const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
                
                if (weatherRes.ok) {
                    const weatherData = await weatherRes.json();
                    weather = {
                        temp: Math.round(weatherData.main.temp),
                        description: weatherData.weather[0].description,
                        icon: weatherData.weather[0].icon
                    };
                } else {
                    console.error("Weather API Error:", weatherRes.statusText);
                }
            } catch (weatherErr) {
                console.error("Failed to fetch weather:", weatherErr);
            }
        }

        await postModel.createPost({
            author: new ObjectId(req.session.userId),
            type,
            text: text.trim(),
            mediaUrl,
            locationName: locationName || null,
            weather: weather,                   
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function remove(req, res) {
    try {
        const post = await postModel.getPostById(req.params.id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        if (post.author.toString() !== req.session.userId) {
            return res.status(403).send("Not allowed");
        }

        await postModel.deletePost(req.params.id);

        res.redirect(safeReturnTo(req.body.returnTo, "/"));
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function showEditForm(req, res) {
    try {
        const post = await postModel.getPostById(req.params.id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        if (post.author.toString() !== req.session.userId) {
            return res.status(403).send("Not allowed to edit this post");
        }

        res.render("posts/edit", { post: post });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function update(req, res) {
    try {
        const post = await postModel.getPostById(req.params.id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        if (post.author.toString() !== req.session.userId) {
            return res.status(403).send("Not allowed to edit this post");
        }

        const { text, locationName, lat, lon, removeLocation } = req.body;

        if (!text || text.trim() === "") {
            return res.status(400).send("Post cannot be empty");
        }

        let updateData = {
            text: text.trim(),
            updatedAt: new Date()
        };

        if (removeLocation === "true") {
            updateData.locationName = null;
            updateData.weather = null;
        } else if (lat && lon && locationName !== post.locationName) {
            updateData.locationName = locationName;
            
            try {
                const apiKey = process.env.OPENWEATHER_API_KEY;
                const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
                
                if (weatherRes.ok) {
                    const weatherData = await weatherRes.json();
                    updateData.weather = {
                        temp: Math.round(weatherData.main.temp),
                        description: weatherData.weather[0].description,
                        icon: weatherData.weather[0].icon
                    };
                } else {
                    console.error("Weather API Error during update:", weatherRes.statusText);
                    updateData.weather = null;
                }
            } catch (weatherErr) {
                console.error("Failed to fetch weather during update:", weatherErr);
                updateData.weather = null;
            }
        }
        await postModel.updatePost(req.params.id, updateData);

        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

module.exports = {
    feed,
    friendsFeed,
    showCreateForm,
    create,
    remove,
    showEditForm,
    update
};
