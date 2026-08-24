const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");

function usersCollection() {
    return getDB().collection("users");
}

async function createUser(userData) {
    const user = {
        username: userData.username,
        passwordHash: userData.passwordHash,
        displayName: userData.displayName,
        city: userData.city,
        interests: userData.interests || [],
        avatarUrl: userData.avatarUrl || "/images/default-avatar.png",

        friends: [],
        incomingFriendRequests: [],
        outgoingFriendRequests: [],

        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await usersCollection().insertOne(user);

    return {
        ...user,
        _id: result.insertedId
    };
}

async function getUserById(id) {
    return usersCollection().findOne({
        _id: new ObjectId(id)
    });
}

async function getUserByUsername(username) {
    return usersCollection().findOne({
        username: username
    });
}

async function getAllUsers() {
    return usersCollection()
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
}

module.exports = {
    createUser,
    getUserById,
    getUserByUsername,
    getAllUsers
};