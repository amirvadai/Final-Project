const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");

function toObjectId(value) {
    if (value instanceof ObjectId) {
        return value;
    }

    return new ObjectId(value);
}

function startOfUtcDay(value) {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}

function addUtcDays(value, amount) {
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() + amount);
    return date;
}

function dateKey(value) {
    return new Date(value).toISOString().slice(0, 10);
}

function average(values) {
    if (!values.length) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function fillDailySeries(rows, startDate, endDate) {
    const rowMap = new Map(
        rows.map((row) => [
            row._id,
            {
                total: row.total || 0,
                community: row.community || 0,
                group: row.group || 0
            }
        ])
    );

    const series = [];

    for (
        let cursor = startOfUtcDay(startDate);
        cursor <= endDate;
        cursor = addUtcDays(cursor, 1)
    ) {
        const key = dateKey(cursor);
        const values = rowMap.get(key) || {
            total: 0,
            community: 0,
            group: 0
        };

        series.push({
            date: key,
            total: values.total,
            community: values.community,
            group: values.group
        });
    }

    return series;
}

function buildForecast(history, length = 7) {
    const recent = history.slice(-28);
    const recentSeven = recent.slice(-7).map((item) => item.total);
    const previousSeven = recent.slice(-14, -7).map((item) => item.total);
    const recentAverage = average(recentSeven);
    const previousAverage = average(previousSeven);
    const trend = (recentAverage - previousAverage) / 7;
    const lastDate = history.length
        ? new Date(`${history[history.length - 1].date}T00:00:00Z`)
        : startOfUtcDay(new Date());

    const byWeekday = new Map();

    for (const item of recent) {
        const weekday = new Date(`${item.date}T00:00:00Z`).getUTCDay();
        const values = byWeekday.get(weekday) || [];
        values.push(item.total);
        byWeekday.set(weekday, values);
    }

    const forecast = [];

    for (let index = 1; index <= length; index += 1) {
        const futureDate = addUtcDays(lastDate, index);
        const weekdayValues = byWeekday.get(futureDate.getUTCDay()) || [];
        const weekdayAverage = weekdayValues.length
            ? average(weekdayValues)
            : recentAverage;
        const predicted = Math.max(
            0,
            Math.round(
                weekdayAverage * 0.65 +
                recentAverage * 0.35 +
                trend * index * 0.4
            )
        );

        forecast.push({
            date: dateKey(futureDate),
            total: predicted
        });
    }

    return forecast;
}

function mergeCityData(userRows, postRows, groupRows) {
    const cities = new Map();

    function ensureCity(row) {
        if (!cities.has(row._id)) {
            cities.set(row._id, {
                city: row.label,
                users: 0,
                posts: 0,
                groups: 0
            });
        }

        return cities.get(row._id);
    }

    for (const row of userRows) {
        ensureCity(row).users = row.users;
    }

    for (const row of postRows) {
        ensureCity(row).posts = row.posts;
    }

    for (const row of groupRows) {
        ensureCity(row).groups = row.groups;
    }

    return [...cities.values()]
        .sort(
            (left, right) =>
                right.users +
                right.posts +
                right.groups -
                (left.users + left.posts + left.groups)
        )
        .slice(0, 12);
}

async function getDashboardData(userId, days) {
    const db = getDB();
    const posts = db.collection("posts");
    const users = db.collection("users");
    const groups = db.collection("groups");
    const now = new Date();
    const endDate = startOfUtcDay(now);
    const startDate = addUtcDays(endDate, -(days - 1));
    const forecastStartDate = addUtcDays(endDate, -55);
    const timezone = process.env.ANALYTICS_TIMEZONE || "Asia/Jerusalem";
    const userObjectId = toObjectId(userId);

    const dateStage = {
        $set: {
            analyticsCreatedAt: {
                $ifNull: ["$createdAt", { $toDate: "$_id" }]
            }
        }
    };

    const groupPostExpression = {
        $or: [
            {
                $ne: [
                    { $ifNull: ["$groupId", null] },
                    null
                ]
            },
            {
                $ne: [
                    { $ifNull: ["$group", null] },
                    null
                ]
            }
        ]
    };

    const [
        totalUsers,
        totalPosts,
        totalGroups,
        dailyRows,
        forecastRows,
        typeRows,
        topAuthors,
        userCityRows,
        postCityRows,
        groupCityRows,
        hourRows,
        groupLocations
    ] = await Promise.all([
        users.countDocuments({}),
        posts.countDocuments({}),
        groups.countDocuments({}),
        posts
            .aggregate([
                dateStage,
                {
                    $match: {
                        analyticsCreatedAt: {
                            $gte: startDate,
                            $lt: addUtcDays(endDate, 1)
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                date: "$analyticsCreatedAt",
                                format: "%Y-%m-%d",
                                timezone
                            }
                        },
                        total: { $sum: 1 },
                        group: {
                            $sum: {
                                $cond: [groupPostExpression, 1, 0]
                            }
                        },
                        community: {
                            $sum: {
                                $cond: [groupPostExpression, 0, 1]
                            }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ])
            .toArray(),
        posts
            .aggregate([
                dateStage,
                {
                    $match: {
                        analyticsCreatedAt: {
                            $gte: forecastStartDate,
                            $lt: addUtcDays(endDate, 1)
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                date: "$analyticsCreatedAt",
                                format: "%Y-%m-%d",
                                timezone
                            }
                        },
                        total: { $sum: 1 },
                        group: {
                            $sum: {
                                $cond: [groupPostExpression, 1, 0]
                            }
                        },
                        community: {
                            $sum: {
                                $cond: [groupPostExpression, 0, 1]
                            }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ])
            .toArray(),
        posts
            .aggregate([
                dateStage,
                {
                    $match: {
                        analyticsCreatedAt: {
                            $gte: startDate,
                            $lt: addUtcDays(endDate, 1)
                        }
                    }
                },
                {
                    $group: {
                        _id: { $ifNull: ["$type", "text"] },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ])
            .toArray(),
        posts
            .aggregate([
                dateStage,
                {
                    $match: {
                        analyticsCreatedAt: {
                            $gte: startDate,
                            $lt: addUtcDays(endDate, 1)
                        }
                    }
                },
                {
                    $group: {
                        _id: "$author",
                        posts: { $sum: 1 },
                        mediaPosts: {
                            $sum: {
                                $cond: [
                                    { $in: ["$type", ["image", "video"]] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                },
                { $sort: { posts: -1, mediaPosts: -1 } },
                { $limit: 8 },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                {
                    $unwind: {
                        path: "$user",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        _id: 0,
                        userId: {
                            $convert: {
                                input: "$_id",
                                to: "string",
                                onError: "",
                                onNull: ""
                            }
                        },
                        username: {
                            $ifNull: ["$user.username", "former-user"]
                        },
                        displayName: {
                            $ifNull: [
                                "$user.displayName",
                                {
                                    $ifNull: [
                                        "$user.username",
                                        "Former user"
                                    ]
                                }
                            ]
                        },
                        avatarUrl: {
                            $ifNull: [
                                "$user.avatarUrl",
                                "/images/default-avatar.png"
                            ]
                        },
                        posts: 1,
                        mediaPosts: 1
                    }
                }
            ])
            .toArray(),
        users
            .aggregate([
                {
                    $project: {
                        city: {
                            $trim: {
                                input: { $ifNull: ["$city", ""] }
                            }
                        }
                    }
                },
                { $match: { city: { $ne: "" } } },
                {
                    $group: {
                        _id: { $toLower: "$city" },
                        label: { $first: "$city" },
                        users: { $sum: 1 }
                    }
                }
            ])
            .toArray(),
        posts
            .aggregate([
                dateStage,
                {
                    $match: {
                        analyticsCreatedAt: {
                            $gte: startDate,
                            $lt: addUtcDays(endDate, 1)
                        }
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "author",
                        foreignField: "_id",
                        as: "author"
                    }
                },
                { $unwind: "$author" },
                {
                    $project: {
                        city: {
                            $trim: {
                                input: { $ifNull: ["$author.city", ""] }
                            }
                        }
                    }
                },
                { $match: { city: { $ne: "" } } },
                {
                    $group: {
                        _id: { $toLower: "$city" },
                        label: { $first: "$city" },
                        posts: { $sum: 1 }
                    }
                }
            ])
            .toArray(),
        groups
            .aggregate([
                {
                    $project: {
                        city: {
                            $trim: {
                                input: {
                                    $ifNull: ["$location.city", ""]
                                }
                            }
                        }
                    }
                },
                { $match: { city: { $ne: "" } } },
                {
                    $group: {
                        _id: { $toLower: "$city" },
                        label: { $first: "$city" },
                        groups: { $sum: 1 }
                    }
                }
            ])
            .toArray(),
        posts
            .aggregate([
                dateStage,
                {
                    $match: {
                        analyticsCreatedAt: {
                            $gte: startDate,
                            $lt: addUtcDays(endDate, 1)
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $hour: {
                                date: "$analyticsCreatedAt",
                                timezone
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
            .toArray(),
        groups
            .find(
                {
                    "location.latitude": { $type: "number" },
                    "location.longitude": { $type: "number" },
                    $or: [
                        { privacy: { $ne: "private" } },
                        { members: userObjectId },
                        { manager: userObjectId }
                    ]
                },
                {
                    projection: {
                        name: 1,
                        category: 1,
                        privacy: 1,
                        location: 1,
                        members: 1
                    }
                }
            )
            .toArray()
    ]);

    const dailyPosts = fillDailySeries(dailyRows, startDate, endDate);
    const forecastHistory = fillDailySeries(
        forecastRows,
        forecastStartDate,
        endDate
    );
    const forecast = buildForecast(forecastHistory);
    const postsInRange = dailyPosts.reduce(
        (sum, item) => sum + item.total,
        0
    );
    const groupPostsInRange = dailyPosts.reduce(
        (sum, item) => sum + item.group,
        0
    );
    const mediaPostsInRange = typeRows
        .filter((item) => ["image", "video"].includes(item._id))
        .reduce((sum, item) => sum + item.count, 0);
    const cities = mergeCityData(
        userCityRows,
        postCityRows,
        groupCityRows
    );
    const postingHours = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count:
            hourRows.find((row) => row._id === hour)?.count || 0
    }));

    return {
        generatedAt: new Date().toISOString(),
        timezone,
        period: {
            days,
            start: dateKey(startDate),
            end: dateKey(endDate)
        },
        summary: {
            totalUsers,
            totalPosts,
            totalGroups,
            postsInRange,
            communityPostsInRange: postsInRange - groupPostsInRange,
            groupPostsInRange,
            mediaPostsInRange,
            mediaShare: postsInRange
                ? round((mediaPostsInRange / postsInRange) * 100)
                : 0,
            activeCities: cities.length,
            forecastPosts: forecast.reduce(
                (sum, item) => sum + item.total,
                0
            )
        },
        dailyPosts,
        forecast,
        postTypes: typeRows.map((item) => ({
            type: item._id,
            count: item.count
        })),
        topAuthors,
        cities,
        postingHours,
        groupLocations: groupLocations.map((group) => ({
            id: group._id.toString(),
            name: group.name,
            category: group.category || "Community",
            privacy:
                group.privacy === "private" ? "private" : "public",
            city: group.location?.city || "",
            address: group.location?.address || "",
            latitude: group.location.latitude,
            longitude: group.location.longitude,
            memberCount: Array.isArray(group.members)
                ? group.members.length
                : 0
        }))
    };
}

module.exports = {
    getDashboardData
};
