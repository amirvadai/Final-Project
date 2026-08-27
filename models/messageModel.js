const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");

function conversationsCollection() {
    return getDB().collection("conversations");
}

function messagesCollection() {
    return getDB().collection("messages");
}

function toObjectId(value) {
    if (value instanceof ObjectId) {
        return value;
    }

    return new ObjectId(value);
}

function participantKey(userA, userB) {
    return [userA.toString(), userB.toString()].sort().join(":");
}

async function getConversationBetween(userA, userB) {
    if (!ObjectId.isValid(userA) || !ObjectId.isValid(userB)) {
        return null;
    }

    return conversationsCollection().findOne({
        participantKey: participantKey(userA, userB)
    });
}

async function createConversation(requesterId, recipientId, status) {
    const requesterObjectId = toObjectId(requesterId);
    const recipientObjectId = toObjectId(recipientId);
    const existing = await getConversationBetween(requesterObjectId, recipientObjectId);

    if (existing) {
        return existing;
    }

    const now = new Date();
    const conversation = {
        participantKey: participantKey(requesterObjectId, recipientObjectId),
        participants: [requesterObjectId, recipientObjectId],
        requesterId: requesterObjectId,
        recipientId: recipientObjectId,
        status,
        lastMessageText: "",
        lastMessageSenderId: null,
        lastMessageAt: null,
        createdAt: now,
        updatedAt: now
    };

    const result = await conversationsCollection().insertOne(conversation);

    return {
        ...conversation,
        _id: result.insertedId
    };
}

async function getConversationById(id) {
    if (!ObjectId.isValid(id)) {
        return null;
    }

    return conversationsCollection().findOne({
        _id: toObjectId(id)
    });
}

async function getActiveConversationsForUser(userId) {
    if (!ObjectId.isValid(userId)) {
        return [];
    }

    return conversationsCollection()
        .find({
            participants: toObjectId(userId),
            status: "active"
        })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .toArray();
}

async function getIncomingRequests(userId) {
    if (!ObjectId.isValid(userId)) {
        return [];
    }

    return conversationsCollection()
        .find({
            recipientId: toObjectId(userId),
            status: "pending"
        })
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .toArray();
}

async function getOutgoingRequests(userId) {
    if (!ObjectId.isValid(userId)) {
        return [];
    }

    return conversationsCollection()
        .find({
            requesterId: toObjectId(userId),
            status: "pending"
        })
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .toArray();
}

async function addMessage(conversationId, senderId, content) {
    const conversationObjectId = toObjectId(conversationId);
    const senderObjectId = toObjectId(senderId);
    const text = typeof content === "string" ? content : String(content?.text || "");
    const mediaUrl = typeof content === "object" ? content?.mediaUrl || null : null;
    const mediaType = typeof content === "object" ? content?.mediaType || null : null;
    const now = new Date();
    const message = {
        conversationId: conversationObjectId,
        senderId: senderObjectId,
        text,
        mediaUrl,
        mediaType,
        createdAt: now
    };

    const result = await messagesCollection().insertOne(message);
    const previewText = text || (mediaType === "image" ? "Photo" : mediaType === "video" ? "Video" : "Message");

    await conversationsCollection().updateOne(
        { _id: conversationObjectId },
        {
            $set: {
                lastMessageText: previewText,
                lastMessageSenderId: senderObjectId,
                lastMessageAt: now,
                updatedAt: now
            }
        }
    );

    return {
        ...message,
        _id: result.insertedId
    };
}

async function getMessages(conversationId) {
    if (!ObjectId.isValid(conversationId)) {
        return [];
    }

    return messagesCollection()
        .find({
            conversationId: toObjectId(conversationId)
        })
        .sort({ createdAt: 1 })
        .toArray();
}

async function approveConversation(conversationId, recipientId) {
    if (!ObjectId.isValid(conversationId) || !ObjectId.isValid(recipientId)) {
        return false;
    }

    const result = await conversationsCollection().updateOne(
        {
            _id: toObjectId(conversationId),
            recipientId: toObjectId(recipientId),
            status: "pending"
        },
        {
            $set: {
                status: "active",
                approvedAt: new Date(),
                updatedAt: new Date()
            }
        }
    );

    return result.modifiedCount === 1;
}

async function declineConversation(conversationId, recipientId) {
    if (!ObjectId.isValid(conversationId) || !ObjectId.isValid(recipientId)) {
        return false;
    }

    const conversation = await conversationsCollection().findOne({
        _id: toObjectId(conversationId),
        recipientId: toObjectId(recipientId),
        status: "pending"
    });

    if (!conversation) {
        return false;
    }

    await messagesCollection().deleteMany({
        conversationId: conversation._id
    });

    await conversationsCollection().deleteOne({
        _id: conversation._id
    });

    return true;
}

module.exports = {
    getConversationBetween,
    createConversation,
    getConversationById,
    getActiveConversationsForUser,
    getIncomingRequests,
    getOutgoingRequests,
    addMessage,
    getMessages,
    approveConversation,
    declineConversation
};
