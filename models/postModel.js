const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");

function postsCollection() {
    return getDB().collection("posts");
}

async function createPost(postData) {
    const post = {
        author: new ObjectId(postData.author),

        group: postData.group
            ? new ObjectId(postData.group)
            : null,

        type: postData.type,

        text: postData.text || "",

        mediaUrl: postData.mediaUrl || "",

        tags: postData.tags || [],

        likes: [],

        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await postsCollection().insertOne(post);

    return {
        ...post,
        _id: result.insertedId
    };
}

async function getPostById(id) {
    return postsCollection().findOne({
        _id: new ObjectId(id)
    });
}

async function getAllPosts() {
    return postsCollection()
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
}

module.exports = {
    createPost,
    getPostById,
    getAllPosts
};