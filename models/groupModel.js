const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");

function groupsCollection() {
    return getDB().collection("groups");
}

function toObjectId(value) {
    if (value instanceof ObjectId) {
        return value;
    }

    return new ObjectId(value);
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createGroup(groupData) {
    const managerId = toObjectId(groupData.manager);

    const group = {
        name: groupData.name,
        description: groupData.description,
        category: groupData.category,
        privacy: groupData.privacy === "private" ? "private" : "public",
        coverImageUrl:
            groupData.coverImageUrl || "/images/default-group-cover.svg",

        manager: managerId,
        members: [managerId],
        joinRequests: [],

        rules: Array.isArray(groupData.rules) ? groupData.rules : [],

        location: {
            address: groupData.location?.address || "",
            city: groupData.location?.city || "",
            latitude: groupData.location?.latitude ?? null,
            longitude: groupData.location?.longitude ?? null
        },

        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await groupsCollection().insertOne(group);

    return {
        ...group,
        _id: result.insertedId
    };
}

async function getGroupById(id) {
    return groupsCollection().findOne({
        _id: toObjectId(id)
    });
}

async function getGroupWithDetails(id) {
    return groupsCollection()
        .aggregate([
            {
                $match: {
                    _id: toObjectId(id)
                }
            },
            {
                $addFields: {
                    members: {
                        $ifNull: ["$members", []]
                    },
                    joinRequests: {
                        $ifNull: ["$joinRequests", []]
                    },
                    rules: {
                        $ifNull: ["$rules", []]
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "manager",
                    foreignField: "_id",
                    as: "managerDetails"
                }
            },
            {
                $unwind: {
                    path: "$managerDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "members",
                    foreignField: "_id",
                    as: "memberDetails"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "joinRequests",
                    foreignField: "_id",
                    as: "requestDetails"
                }
            },
            {
                $addFields: {
                    memberCount: {
                        $size: "$members"
                    }
                }
            }
        ])
        .next();
}

async function searchGroups(filters = {}) {
    const conditions = [];

    const queryText = String(filters.q || "").trim();

    if (queryText) {
        const searchExpression = new RegExp(escapeRegex(queryText), "i");

        conditions.push({
            $or: [
                { name: searchExpression },
                { description: searchExpression },
                { category: searchExpression },
                { "location.city": searchExpression }
            ]
        });
    }

    if (filters.category) {
        conditions.push({
            category: filters.category
        });
    }

    if (filters.city) {
        conditions.push({
            "location.city": new RegExp(
                escapeRegex(String(filters.city).trim()),
                "i"
            )
        });
    }

    if (filters.memberId) {
        conditions.push({
            members: toObjectId(filters.memberId)
        });
    }

    if (filters.managerId) {
        conditions.push({
            manager: toObjectId(filters.managerId)
        });
    }

    const match =
        conditions.length > 0
            ? {
                  $and: conditions
              }
            : {};

    return groupsCollection()
        .aggregate([
            {
                $match: match
            },
            {
                $addFields: {
                    members: {
                        $ifNull: ["$members", []]
                    },
                    joinRequests: {
                        $ifNull: ["$joinRequests", []]
                    },
                    rules: {
                        $ifNull: ["$rules", []]
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "manager",
                    foreignField: "_id",
                    as: "managerDetails"
                }
            },
            {
                $unwind: {
                    path: "$managerDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    memberCount: {
                        $size: "$members"
                    }
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ])
        .toArray();
}

async function getAllGroups() {
    return searchGroups();
}

async function getGroupsForUser(userId) {
    return searchGroups({
        memberId: userId
    });
}

async function getManagedGroups(userId) {
    return searchGroups({
        managerId: userId
    });
}

async function updateGroup(id, updates) {
    await groupsCollection().updateOne(
        {
            _id: toObjectId(id)
        },
        {
            $set: {
                ...updates,
                updatedAt: new Date()
            }
        }
    );

    return getGroupById(id);
}

async function addMember(groupId, userId) {
    const memberId = toObjectId(userId);

    return groupsCollection().updateOne(
        {
            _id: toObjectId(groupId)
        },
        {
            $addToSet: {
                members: memberId
            },
            $pull: {
                joinRequests: memberId
            },
            $set: {
                updatedAt: new Date()
            }
        }
    );
}

async function removeMember(groupId, userId) {
    const memberId = toObjectId(userId);

    return groupsCollection().updateOne(
        {
            _id: toObjectId(groupId)
        },
        {
            $pull: {
                members: memberId
            },
            $set: {
                updatedAt: new Date()
            }
        }
    );
}

async function addJoinRequest(groupId, userId) {
    const requesterId = toObjectId(userId);

    return groupsCollection().updateOne(
        {
            _id: toObjectId(groupId),
            manager: {
                $ne: requesterId
            },
            members: {
                $ne: requesterId
            }
        },
        {
            $addToSet: {
                joinRequests: requesterId
            },
            $set: {
                updatedAt: new Date()
            }
        }
    );
}

async function removeJoinRequest(groupId, userId) {
    const requesterId = toObjectId(userId);

    return groupsCollection().updateOne(
        {
            _id: toObjectId(groupId)
        },
        {
            $pull: {
                joinRequests: requesterId
            },
            $set: {
                updatedAt: new Date()
            }
        }
    );
}

async function deleteGroup(id) {
    return groupsCollection().deleteOne({
        _id: toObjectId(id)
    });
}

module.exports = {
    createGroup,
    getGroupById,
    getGroupWithDetails,
    getAllGroups,
    searchGroups,
    getGroupsForUser,
    getManagedGroups,
    updateGroup,
    addMember,
    removeMember,
    addJoinRequest,
    removeJoinRequest,
    deleteGroup
};
