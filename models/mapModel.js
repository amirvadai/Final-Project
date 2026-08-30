const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");

function postsCollection() {
    return getDB().collection("posts");
}

function toObjectId(value) {
    if (value instanceof ObjectId) {
        return value;
    }

    return new ObjectId(value);
}

function coordinateExpression(...fields) {
    return fields.reduceRight(
        (fallback, field) => ({
            $ifNull: [field, fallback]
        }),
        null
    );
}

function accessConditions(currentUserId) {
    return [
        {
            groupId: null
        },
        {
            $and: [
                {
                    groupId: {
                        $ne: null
                    }
                },
                {
                    "groupDetails._id": {
                        $ne: null
                    }
                },
                {
                    "groupDetails.privacy": {
                        $ne: "private"
                    }
                }
            ]
        },
        {
            "groupDetails.manager": currentUserId
        },
        {
            "groupDetails.members": currentUserId
        }
    ];
}

function mapPipeline(currentUserId, initialMatch) {
    return [
        {
            $match: initialMatch
        },
        {
            $addFields: {
                mapLatitude: {
                    $convert: {
                        input: coordinateExpression(
                            "$locationLat",
                            "$location.latitude",
                            "$lat"
                        ),
                        to: "double",
                        onError: null,
                        onNull: null
                    }
                },
                mapLongitude: {
                    $convert: {
                        input: coordinateExpression(
                            "$locationLon",
                            "$locationLng",
                            "$location.longitude",
                            "$lon",
                            "$lng"
                        ),
                        to: "double",
                        onError: null,
                        onNull: null
                    }
                }
            }
        },
        {
            $match: {
                mapLatitude: {
                    $gte: -90,
                    $lte: 90
                },
                mapLongitude: {
                    $gte: -180,
                    $lte: 180
                }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "authorDetails"
            }
        },
        {
            $unwind: {
                path: "$authorDetails",
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $lookup: {
                from: "groups",
                localField: "groupId",
                foreignField: "_id",
                as: "groupDetails"
            }
        },
        {
            $unwind: {
                path: "$groupDetails",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $match: {
                $or: accessConditions(currentUserId)
            }
        },
        {
            $project: {
                _id: 1,
                text: 1,
                type: 1,
                mediaUrl: 1,
                createdAt: 1,
                weather: 1,
                locationName: {
                    $ifNull: ["$locationName", "Post location"]
                },
                latitude: "$mapLatitude",
                longitude: "$mapLongitude",
                author: {
                    _id: "$authorDetails._id",
                    username: "$authorDetails.username",
                    displayName: "$authorDetails.displayName",
                    avatarUrl: "$authorDetails.avatarUrl"
                },
                group: {
                    $cond: [
                        {
                            $ne: ["$groupDetails._id", null]
                        },
                        {
                            _id: "$groupDetails._id",
                            name: "$groupDetails.name",
                            privacy: "$groupDetails.privacy"
                        },
                        null
                    ]
                }
            }
        }
    ];
}

async function getPostsForMap(userId, start, end) {
    const currentUserId = toObjectId(userId);

    return postsCollection()
        .aggregate([
            ...mapPipeline(currentUserId, {
                createdAt: {
                    $gte: start,
                    $lt: end
                }
            }),
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $limit: 500
            }
        ])
        .toArray();
}

async function getMapPostById(userId, postId) {
    if (!ObjectId.isValid(postId)) {
        return null;
    }

    const currentUserId = toObjectId(userId);

    return postsCollection()
        .aggregate(
            mapPipeline(currentUserId, {
                _id: toObjectId(postId)
            })
        )
        .next();
}

module.exports = {
    getPostsForMap,
    getMapPostById
};
