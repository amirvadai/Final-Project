const { getDB } = require("../config/database");
const { ObjectId } = require("mongodb");

// Get all posts

function getPosts() {
    const db = getDB();

    return db.collection("posts")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
}

// Get one post

async function getPostById(id) {
    const db = getDB();

    return db.collection("posts").findOne({
        _id: new ObjectId(id)
    });
}

// Create posts

async function createPost(post) {
    const db = getDB();

    const result = await db.collection("posts").insertOne(post);

    return getPostById(result.insertedId.toString());
}

// Update posts

async function updatePost(id, updates) {
    const db = getDB();

    await db.collection("posts").updateOne(
        {
            _id: new ObjectId(id)
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

// Delete posts

async function deletePost(id) {
    const db = getDB();

    return db.collection("posts").deleteOne({
        _id: new ObjectId(id)
    });
}


module.exports = {
    getPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost
};