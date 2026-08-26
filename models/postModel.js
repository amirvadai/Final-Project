const { getDB } = require("../config/database");
const { ObjectId } = require("mongodb");

function postsCollection() {
    return getDB().collection("posts");
}

function toObjectId(value) {
    if (value instanceof ObjectId) {
        return value;
    }

    return new ObjectId(value);
}

function postsWithAuthors(match, preserveMissingAuthors = false) {
    return postsCollection().aggregate([
        {
            $match: match
        },
        {
            $sort: {
                createdAt: -1
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
                preserveNullAndEmptyArrays: preserveMissingAuthors
            }
        }
    ]);
}

// Global feed posts only. MongoDB matches both missing and null groupId
// values with { groupId: null }.
function getPosts() {
    // The existing global-feed EJS expects authorDetails to exist, so
    // deleted-author posts are omitted here, matching the original behavior.
    return postsWithAuthors(
        {
            groupId: null
        },
        false
    ).toArray();
}

function getPostsByGroupId(groupId) {
    // Group templates can display "Former member", so retain posts even
    // if their author account was deleted.
    return postsWithAuthors(
        {
            groupId: toObjectId(groupId)
        },
        true
    ).toArray();
}

function getRawPostsByGroupId(groupId) {
    return postsCollection()
        .find({
            groupId: toObjectId(groupId)
        })
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
    getPostsByGroupId,
    getRawPostsByGroupId,
    getPostById,
    createPost,
    updatePost,
    deletePost,
    deletePostsByGroupId
};
