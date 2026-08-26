const { getDB } = require("../config/database");
const { ObjectId } = require("mongodb");

function postsCollection() {
    return getDB().collection("posts");
}

function usersCollection() {
    return getDB().collection("users");
}

function toObjectId(value) {
    if (value instanceof ObjectId) {
        return value;
    }

    return new ObjectId(value);
}
const GLOBAL_POST_FILTER = {
    groupId: null
};

function postsWithAuthors(match, preserveMissingAuthors = false) {
    return postsCollection().aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
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
                preserveNullAndEmptyArrays: preserveMissingAuthors
            }
        }
    ]);
}

// Global, non-group posts. Kept for compatibility with existing code.
function getPosts() {
    return postsWithAuthors(
        GLOBAL_POST_FILTER,
        false
    ).toArray();
}

// Main community feed:
// - public accounts are visible to everyone who is logged in
// - the current user's own posts are visible
// - private friends' posts are visible
// - private strangers' posts are hidden
async function getVisiblePostsForUser(userId) {
    const currentUserId = toObjectId(userId);

    const currentUser = await usersCollection().findOne(
        { _id: currentUserId },
        { projection: { friends: 1 } }
    );

    const friendIds = Array.isArray(currentUser?.friends)
        ? currentUser.friends.map((id) => toObjectId(id))
        : [];

    const visibilityConditions = [
        { "authorDetails.isPrivate": { $ne: true } },
        { author: currentUserId }
    ];

    if (friendIds.length > 0) {
        visibilityConditions.push({ author: { $in: friendIds } });
    }

    return postsCollection().aggregate([
        { $match: GLOBAL_POST_FILTER },
        { $sort: { createdAt: -1 } },
        {
            $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "authorDetails"
            }
        },
        { $unwind: "$authorDetails" },
        {
            $match: {
                $or: visibilityConditions
            }
        }
    ]).toArray();
}

// Only posts made by confirmed friends.
async function getFriendPostsForUser(userId) {
    const currentUserId = toObjectId(userId);

    const currentUser = await usersCollection().findOne(
        { _id: currentUserId },
        { projection: { friends: 1 } }
    );

    const friendIds = Array.isArray(currentUser?.friends)
        ? currentUser.friends.map((id) => toObjectId(id))
        : [];

    if (friendIds.length === 0) {
        return [];
    }

    return postsWithAuthors(
        {
            ...GLOBAL_POST_FILTER,
            author: { $in: friendIds }
        },
        false
    ).toArray();
}

function getPostsByAuthor(authorId) {
    return postsWithAuthors(
        {
            ...GLOBAL_POST_FILTER,
            author: toObjectId(authorId)
        },
        false
    ).toArray();
}

function getPostsByGroupId(groupId) {
    return postsWithAuthors(
        { groupId: toObjectId(groupId) },
        true
    ).toArray();
}

function getRawPostsByGroupId(groupId) {
    return postsCollection()
        .find({ groupId: toObjectId(groupId) })
        .toArray();
}

async function getPostById(id) {
    return postsCollection().findOne({
        _id: toObjectId(id)
    });
}

async function createPost(post) {
    const result = await postsCollection().insertOne(post);
    return getPostById(result.insertedId);
}

async function updatePost(id, updates) {
    await postsCollection().updateOne(
        { _id: toObjectId(id) },
        {
            $set: {
                ...updates,
                updatedAt: new Date()
            }
        }
    );

    return getPostById(id);
}

async function deletePost(id) {
    return postsCollection().deleteOne({
        _id: toObjectId(id)
    });
}

async function deletePostsByGroupId(groupId) {
    return postsCollection().deleteMany({
        groupId: toObjectId(groupId)
    });
}

module.exports = {
    getPosts,
    getVisiblePostsForUser,
    getFriendPostsForUser,
    getPostsByAuthor,
    getPostsByGroupId,
    getRawPostsByGroupId,
    getPostById,
    createPost,
    updatePost,
    deletePost,
    deletePostsByGroupId
};
