const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");
const postModel = require("../models/postModel");

const fallbackCities = [
    "Tel Aviv",
    "Jerusalem",
    "Haifa",
    "Rishon LeZion",
    "Petah Tikva",
    "Ashdod",
    "Netanya",
    "Beer Sheva",
    "Holon",
    "Ramat Gan",
    "Rehovot",
    "Ashkelon",
    "Kfar Saba",
    "Herzliya"
];

const weatherCodeMap = {
    0: ["clear sky", "01d"],
    1: ["mainly clear", "02d"],
    2: ["partly cloudy", "03d"],
    3: ["overcast", "04d"],
    45: ["fog", "50d"],
    48: ["rime fog", "50d"],
    51: ["light drizzle", "09d"],
    53: ["drizzle", "09d"],
    55: ["heavy drizzle", "09d"],
    56: ["freezing drizzle", "09d"],
    57: ["heavy freezing drizzle", "09d"],
    61: ["light rain", "10d"],
    63: ["rain", "10d"],
    65: ["heavy rain", "10d"],
    66: ["freezing rain", "13d"],
    67: ["heavy freezing rain", "13d"],
    71: ["light snow", "13d"],
    73: ["snow", "13d"],
    75: ["heavy snow", "13d"],
    77: ["snow grains", "13d"],
    80: ["light showers", "09d"],
    81: ["showers", "09d"],
    82: ["heavy showers", "09d"],
    85: ["snow showers", "13d"],
    86: ["heavy snow showers", "13d"],
    95: ["thunderstorm", "11d"],
    96: ["thunderstorm with hail", "11d"],
    99: ["severe thunderstorm with hail", "11d"]
};

const geocodeCache = new Map();
const weatherCache = new Map();

const locationOverrides = {
    "beit nehemia": {
        name: "Beit Nehemia",
        latitude: 31.977142,
        longitude: 34.953835
    }
};

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

function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function hashString(value) {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function getFallbackCity(seed) {
    const value = String(seed || "user");
    return fallbackCities[hashString(value) % fallbackCities.length];
}

function parseCoordinate(value, minimum, maximum) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < minimum || number > maximum) {
        return null;
    }

    return number;
}

async function fetchJson(url, extraHeaders = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                ...extraHeaders
            }
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function geocodeLocation(name) {
    const cleaned = cleanText(name);

    if (!cleaned) {
        return null;
    }

    const key = cleaned.toLowerCase();

    if (locationOverrides[key]) {
        return locationOverrides[key];
    }

    if (geocodeCache.has(key)) {
        return geocodeCache.get(key);
    }

    const promise = (async () => {
        const candidates = [
            cleaned,
            `${cleaned}, Israel`
        ];

        if (cleaned.includes(",")) {
            const pieces = cleaned
                .split(",")
                .map((part) => part.trim());

            candidates.push(
                pieces[pieces.length - 1]
            );
        }

        for (const candidate of [...new Set(candidates)]) {
            const parameters = new URLSearchParams({
                name: candidate,
                count: "1",
                language: "en",
                format: "json"
            });

            const data = await fetchJson(
                `https://geocoding-api.open-meteo.com/v1/search?${parameters}`
            );

            const result = data.results?.[0];

            if (result) {
                return {
                    name: result.name,
                    latitude: result.latitude,
                    longitude: result.longitude
                };
            }
        }

        const parameters = new URLSearchParams({
            q: `${cleaned}, Israel`,
            format: "jsonv2",
            limit: "1"
        });

        const results = await fetchJson(
            `https://nominatim.openstreetmap.org/search?${parameters}`,
            {
                "User-Agent": "CityCommunity/1.0"
            }
        );

        const result = results?.[0];

        if (!result) {
            return null;
        }

        return {
            name: cleaned,
            latitude: Number(result.lat),
            longitude: Number(result.lon)
        };
    })();

    geocodeCache.set(key, promise);

    return promise;
}

async function reverseGeocode(latitude, longitude, fallbackName) {
    try {
        const parameters = new URLSearchParams({
            format: "jsonv2",
            lat: String(latitude),
            lon: String(longitude),
            zoom: "10",
            addressdetails: "1",
            "accept-language": "en"
        });

        const data = await fetchJson(
            `https://nominatim.openstreetmap.org/reverse?${parameters}`,
            {
                "User-Agent": "CityCommunity/1.0"
            }
        );

        const address = data.address || {};

        return cleanText(
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.county ||
            fallbackName
        );
    } catch (error) {
        return cleanText(fallbackName);
    }
}

function buildWeather(temperature, weatherCode, observedAt) {
    const mapped = weatherCodeMap[weatherCode] || ["current weather", "02d"];

    return {
        temp: Math.round(Number(temperature)),
        description: mapped[0],
        icon: mapped[1],
        code: weatherCode,
        observedAt: new Date(observedAt)
    };
}

async function getCurrentWeather(latitude, longitude, at) {
    const parameters = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: "temperature_2m,weather_code",
        timezone: "UTC",
        temperature_unit: "celsius"
    });

    const data = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?${parameters}`
    );

    if (
        data.current?.temperature_2m == null ||
        data.current?.weather_code == null
    ) {
        throw new Error("Current weather is unavailable");
    }

    return buildWeather(
        data.current.temperature_2m,
        data.current.weather_code,
        at
    );
}

function nearestHourlyWeather(data, targetDate) {
    const times = data.hourly?.time || [];
    const temperatures = data.hourly?.temperature_2m || [];
    const codes = data.hourly?.weather_code || [];

    if (times.length === 0) {
        return null;
    }

    const targetTime = targetDate.getTime();
    let bestIndex = 0;
    let bestDifference = Number.POSITIVE_INFINITY;

    for (let index = 0; index < times.length; index += 1) {
        const timestamp = Date.parse(`${times[index]}Z`);

        if (!Number.isFinite(timestamp)) {
            continue;
        }

        const difference = Math.abs(timestamp - targetTime);

        if (difference < bestDifference) {
            bestDifference = difference;
            bestIndex = index;
        }
    }

    if (
        temperatures[bestIndex] == null ||
        codes[bestIndex] == null
    ) {
        return null;
    }

    return buildWeather(
        temperatures[bestIndex],
        codes[bestIndex],
        new Date(`${times[bestIndex]}Z`)
    );
}

async function getHistoricalWeather(latitude, longitude, at) {
    const targetDate = new Date(at);
    const ageMilliseconds = Date.now() - targetDate.getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const roundedLat = Number(latitude).toFixed(3);
    const roundedLon = Number(longitude).toFixed(3);
    let url;
    let cacheKey;

    if (ageMilliseconds >= 0 && ageMilliseconds <= sevenDays) {
        const parameters = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            hourly: "temperature_2m,weather_code",
            past_days: "7",
            forecast_days: "1",
            timezone: "UTC",
            temperature_unit: "celsius"
        });

        url = `https://api.open-meteo.com/v1/forecast?${parameters}`;
        cacheKey = `recent:${roundedLat}:${roundedLon}`;
    } else {
        const date = targetDate.toISOString().slice(0, 10);
        const parameters = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            start_date: date,
            end_date: date,
            hourly: "temperature_2m,weather_code",
            timezone: "UTC",
            temperature_unit: "celsius"
        });

        url = `https://archive-api.open-meteo.com/v1/archive?${parameters}`;
        cacheKey = `archive:${roundedLat}:${roundedLon}:${date}`;
    }

    if (!weatherCache.has(cacheKey)) {
        weatherCache.set(cacheKey, fetchJson(url));
    }

    const data = await weatherCache.get(cacheKey);
    const weather = nearestHourlyWeather(data, targetDate);

    if (!weather) {
        throw new Error("Historical weather is unavailable");
    }

    return weather;
}

async function resolvePostEnvironment({
    latitude,
    longitude,
    locationName,
    fallbackCity,
    fallbackSeed,
    at = new Date()
}) {
    const requestedLatitude = parseCoordinate(latitude, -90, 90);
    const requestedLongitude = parseCoordinate(longitude, -180, 180);
    const storedName = cleanText(locationName);
    const accountCity = cleanText(fallbackCity);
    const deterministicCity = getFallbackCity(fallbackSeed);

    let resolvedLatitude = requestedLatitude;
    let resolvedLongitude = requestedLongitude;
    let resolvedName = storedName;

    if (resolvedLatitude != null && resolvedLongitude != null) {
        if (!resolvedName) {
            resolvedName = await reverseGeocode(
                resolvedLatitude,
                resolvedLongitude,
                accountCity || deterministicCity
            );
        }
    } else {
        const query =
            storedName ||
            accountCity ||
            deterministicCity;

        let geocoded = await geocodeLocation(query);

        if (!geocoded && accountCity && query !== accountCity) {
            geocoded = await geocodeLocation(accountCity);
        }

        if (!geocoded) {
            geocoded = await geocodeLocation(deterministicCity);
        }

        if (!geocoded) {
            throw new Error("Could not resolve a post location");
        }

        resolvedLatitude = geocoded.latitude;
        resolvedLongitude = geocoded.longitude;
        resolvedName = storedName || geocoded.name || query;
    }

    if (!resolvedName) {
        resolvedName =
            accountCity ||
            deterministicCity ||
            `${resolvedLatitude.toFixed(4)}, ${resolvedLongitude.toFixed(4)}`;
    }

    const targetDate = new Date(at);
    const isCurrent =
        Math.abs(Date.now() - targetDate.getTime()) <
        2 * 60 * 60 * 1000;

    const weather = isCurrent
        ? await getCurrentWeather(
            resolvedLatitude,
            resolvedLongitude,
            targetDate
        )
        : await getHistoricalWeather(
            resolvedLatitude,
            resolvedLongitude,
            targetDate
        );

    return {
        locationName: resolvedName,
        locationLat: resolvedLatitude,
        locationLon: resolvedLongitude,
        weather,
        environmentVersion: 1
    };
}

async function backfillPostEnvironments() {
    const db = getDB();
    const posts = await db.collection("posts")
        .find({
            environmentVersion: { $ne: 1 }
        })
        .toArray();

    if (posts.length === 0) {
        return 0;
    }

    const authorIds = [
        ...new Map(
            posts
                .filter((post) => post.author)
                .map((post) => [post.author.toString(), post.author])
        ).values()
    ];

    const users = authorIds.length > 0
        ? await db.collection("users")
            .find(
                { _id: { $in: authorIds } },
                { projection: { city: 1, username: 1 } }
            )
            .toArray()
        : [];

    const userMap = new Map(
        users.map((user) => [user._id.toString(), user])
    );

    let updated = 0;

    await Promise.all(
        posts.map(async (post) => {
            try {
                const author = post.author
                    ? userMap.get(post.author.toString())
                    : null;

                const environment = await resolvePostEnvironment({
                    locationName: post.locationName,
                    fallbackCity: author?.city,
                    fallbackSeed:
                        author?.username ||
                        post.author?.toString() ||
                        post._id.toString(),
                    at: post.createdAt || new Date()
                });

                await db.collection("posts").updateOne(
                    { _id: post._id },
                    { $set: environment }
                );

                updated += 1;
            } catch (error) {
                console.error(
                    `Could not enrich post ${post._id}:`,
                    error.message
                );
            }
        })
    );

    return updated;
}

async function feed(req, res) {
    try {
        const posts = await postModel.getPosts();

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
        const { text, lat, lon, postToX } = req.body;
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

        const createdAt = new Date();
        const environment = await resolvePostEnvironment({
            latitude: lat,
            longitude: lon,
            fallbackCity: res.locals.currentUser?.city,
            fallbackSeed:
                res.locals.currentUser?.username ||
                req.session.userId,
            at: createdAt
        });

        await postModel.createPost({
            author: new ObjectId(req.session.userId),
            type,
            text: text.trim(),
            mediaUrl,
            ...environment,
            createdAt,
            updatedAt: createdAt
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

        res.render("posts/edit", { post });
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

        const { text } = req.body;

        if (!text || text.trim() === "") {
            return res.status(400).send("Post cannot be empty");
        }

        await postModel.updatePost(req.params.id, {
            text: text.trim(),
            updatedAt: new Date()
        });

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
    update,
    resolvePostEnvironment,
    backfillPostEnvironments
};
