const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");

function usersCollection() {
    return getDB().collection("users");
}

function toObjectId(value) {
    if (value instanceof ObjectId) {
        return value;
    }

    return new ObjectId(value);
}

function toObjectIds(values) {
    return (values || [])
        .filter((value) => ObjectId.isValid(value))
        .map((value) => toObjectId(value));
}

async function createUser(userData) {
    const user = {
        username: userData.username,
        passwordHash: userData.passwordHash,
        displayName: userData.displayName,
        city: userData.city,
        interests: userData.interests || [],
        avatarUrl: userData.avatarUrl || "/images/default-avatar.png",

        // Existing users that do not have this field are treated as public.
        isPrivate: userData.isPrivate === true,

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
    if (!ObjectId.isValid(id)) {
        return null;
    }

    return usersCollection().findOne({
        _id: toObjectId(id)
    });
}

async function getUserByUsername(username) {
    return usersCollection().findOne({
        username: username
    });
}

async function getAllUsers() {
    return usersCollection()
        .find({}, { projection: { passwordHash: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
}

async function getUsersByIds(ids) {
    const objectIds = toObjectIds(ids);

    if (objectIds.length === 0) {
        return [];
    }

    return usersCollection()
        .find(
            { _id: { $in: objectIds } },
            { projection: { passwordHash: 0 } }
        )
        .sort({ displayName: 1, username: 1 })
        .toArray();
}

async function updateUser(id, updates) {
    const db = getDB();

    await db.collection("users").updateOne(
        { _id: toObjectId(id) },
        {
            $set: {
                ...updates,
                updatedAt: new Date()
            }
        }
    );

    return getUserById(id);
}

async function setPrivacy(id, isPrivate) {
    return updateUser(id, {
        isPrivate: isPrivate === true
    });
}

async function sendFriendRequest(fromUserId, toUserId) {
    const fromId = toObjectId(fromUserId);
    const toId = toObjectId(toUserId);
    const now = new Date();

    await Promise.all([
        usersCollection().updateOne(
            { _id: fromId },
            {
                $addToSet: { outgoingFriendRequests: toId },
                $set: { updatedAt: now }
            }
        ),
        usersCollection().updateOne(
            { _id: toId },
            {
                $addToSet: { incomingFriendRequests: fromId },
                $set: { updatedAt: now }
            }
        )
    ]);
}

async function addFriend(userId, friendId) {
    const userObjectId = toObjectId(userId);
    const friendObjectId = toObjectId(friendId);
    const now = new Date();

    await Promise.all([
        usersCollection().updateOne(
            { _id: userObjectId },
            {
                $addToSet: { friends: friendObjectId },
                $pull: {
                    incomingFriendRequests: friendObjectId,
                    outgoingFriendRequests: friendObjectId
                },
                $set: { updatedAt: now }
            }
        ),
        usersCollection().updateOne(
            { _id: friendObjectId },
            {
                $addToSet: { friends: userObjectId },
                $pull: {
                    incomingFriendRequests: userObjectId,
                    outgoingFriendRequests: userObjectId
                },
                $set: { updatedAt: now }
            }
        )
    ]);
}

async function acceptFriendRequest(receiverId, senderId) {
    const receiverObjectId = toObjectId(receiverId);
    const senderObjectId = toObjectId(senderId);

    const receiver = await usersCollection().findOne({
        _id: receiverObjectId,
        incomingFriendRequests: senderObjectId
    });

    if (!receiver) {
        return false;
    }

    await addFriend(receiverObjectId, senderObjectId);
    return true;
}

async function declineFriendRequest(receiverId, senderId) {
    const receiverObjectId = toObjectId(receiverId);
    const senderObjectId = toObjectId(senderId);
    const now = new Date();

    await Promise.all([
        usersCollection().updateOne(
            { _id: receiverObjectId },
            {
                $pull: { incomingFriendRequests: senderObjectId },
                $set: { updatedAt: now }
            }
        ),
        usersCollection().updateOne(
            { _id: senderObjectId },
            {
                $pull: { outgoingFriendRequests: receiverObjectId },
                $set: { updatedAt: now }
            }
        )
    ]);
}

async function cancelFriendRequest(senderId, receiverId) {
    return declineFriendRequest(receiverId, senderId);
}

async function removeFriend(userId, friendId) {
    const userObjectId = toObjectId(userId);
    const friendObjectId = toObjectId(friendId);
    const now = new Date();

    await Promise.all([
        usersCollection().updateOne(
            { _id: userObjectId },
            {
                $pull: { friends: friendObjectId },
                $set: { updatedAt: now }
            }
        ),
        usersCollection().updateOne(
            { _id: friendObjectId },
            {
                $pull: { friends: userObjectId },
                $set: { updatedAt: now }
            }
        )
    ]);
}

async function removeUserReferences(id) {
    const userObjectId = toObjectId(id);

    await usersCollection().updateMany(
        { _id: { $ne: userObjectId } },
        {
            $pull: {
                friends: userObjectId,
                incomingFriendRequests: userObjectId,
                outgoingFriendRequests: userObjectId
            }
        }
    );
}

async function deleteUser(id) {
    const userObjectId = toObjectId(id);

    await removeUserReferences(userObjectId);

    return usersCollection().deleteOne({
        _id: userObjectId
    });
}

module.exports = {
    createUser,
    getUserById,
    getUserByUsername,
    getAllUsers,
    getUsersByIds,
    updateUser,
    setPrivacy,
    sendFriendRequest,
    addFriend,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    removeFriend,
    removeUserReferences,
    deleteUser
};
