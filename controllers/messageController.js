const fs = require("fs");
const path = require("path");
const messageModel = require("../models/messageModel");
const userModel = require("../models/userModel");

const STATUS_MESSAGES = {
    "request-sent": { text: "Message request sent.", type: "success" },
    "request-approved": { text: "Message request approved. You can now chat.", type: "success" },
    "request-declined": { text: "Message request declined.", type: "info" },
    "request-pending": { text: "This message request is still waiting for approval.", type: "info" },
    "message-sent": { text: "Message sent.", type: "success" },
    "empty-message": { text: "Write a message or choose a photo or video.", type: "info" },
    "invalid-media": { text: "Only image and video files can be sent.", type: "info" },
    "media-too-large": { text: "Media must be 50 MB or smaller.", type: "info" }
};

const mediaDirectory = path.join(__dirname, "..", "public", "uploads", "messages");

function getStatus(code) {
    return STATUS_MESSAGES[code] || null;
}

function sameId(a, b) {
    return a && b && a.toString() === b.toString();
}

function isParticipant(conversation, userId) {
    return (conversation.participants || []).some((id) => sameId(id, userId));
}

function otherParticipantId(conversation, currentUserId) {
    return (conversation.participants || []).find((id) => !sameId(id, currentUserId));
}

async function attachOtherUsers(conversations, currentUserId) {
    const ids = conversations
        .map((conversation) => otherParticipantId(conversation, currentUserId))
        .filter(Boolean);
    const users = await userModel.getUsersByIds(ids);
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    return conversations.map((conversation) => {
        const otherId = otherParticipantId(conversation, currentUserId);
        const otherUser = otherId ? usersById.get(otherId.toString()) : null;

        return {
            ...conversation,
            otherUser: otherUser || {
                _id: otherId,
                displayName: "Deleted user",
                username: "deleted",
                avatarUrl: "/images/default-avatar.png",
                isPrivate: false
            }
        };
    });
}

function cleanMessage(value) {
    return String(value || "").trim().slice(0, 2000);
}

function getMedia(file) {
    if (!file) {
        return {
            mediaUrl: null,
            mediaType: null
        };
    }

    return {
        mediaUrl: `/uploads/messages/${file.filename}`,
        mediaType: file.mimetype.startsWith("image/") ? "image" : "video"
    };
}

function removeUploadedFile(file) {
    if (!file?.path) {
        return;
    }

    try {
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
    } catch (error) {
        console.error(error);
    }
}

function removeMediaByUrl(mediaUrl) {
    if (!mediaUrl || !mediaUrl.startsWith("/uploads/messages/")) {
        return;
    }

    const filePath = path.join(mediaDirectory, path.basename(mediaUrl));

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error(error);
    }
}

async function inbox(req, res) {
    try {
        const [conversations, incomingRequests] = await Promise.all([
            messageModel.getActiveConversationsForUser(req.session.userId),
            messageModel.getIncomingRequests(req.session.userId)
        ]);
        const decorated = await attachOtherUsers(conversations, req.session.userId);

        res.render("messages/inbox", {
            conversations: decorated,
            activeTab: "chats",
            incomingRequestCount: incomingRequests.length,
            status: getStatus(req.query.status)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function requests(req, res) {
    try {
        const [incoming, outgoing] = await Promise.all([
            messageModel.getIncomingRequests(req.session.userId),
            messageModel.getOutgoingRequests(req.session.userId)
        ]);
        const [incomingRequests, outgoingRequests] = await Promise.all([
            attachOtherUsers(incoming, req.session.userId),
            attachOtherUsers(outgoing, req.session.userId)
        ]);

        res.render("messages/requests", {
            incomingRequests,
            outgoingRequests,
            activeTab: "requests",
            incomingRequestCount: incomingRequests.length,
            status: getStatus(req.query.status)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function newMessage(req, res) {
    try {
        const users = await userModel.getAllUsers();
        const filteredUsers = users.filter(
            (user) => user._id.toString() !== req.session.userId.toString()
        );

        res.render("messages/new", {
            users: filteredUsers,
            activeTab: "new",
            incomingRequestCount: (await messageModel.getIncomingRequests(req.session.userId)).length,
            status: getStatus(req.query.status)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function compose(req, res) {
    try {
        const targetUser = await userModel.getUserById(req.params.userId);

        if (!targetUser) {
            return res.status(404).send("User not found");
        }

        if (targetUser._id.toString() === req.session.userId.toString()) {
            return res.redirect("/messages");
        }

        const existing = await messageModel.getConversationBetween(
            req.session.userId,
            targetUser._id
        );

        if (existing) {
            return res.redirect(`/messages/${existing._id}`);
        }

        res.render("messages/compose", {
            targetUser,
            activeTab: "new",
            incomingRequestCount: (await messageModel.getIncomingRequests(req.session.userId)).length,
            status: getStatus(req.query.status)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function startConversation(req, res) {
    try {
        const text = cleanMessage(req.body.text);
        const media = getMedia(req.file);
        const targetUser = await userModel.getUserById(req.params.userId);

        if (!targetUser) {
            removeUploadedFile(req.file);
            return res.status(404).send("User not found");
        }

        if (targetUser._id.toString() === req.session.userId.toString()) {
            removeUploadedFile(req.file);
            return res.redirect("/messages");
        }

        if (!text && !media.mediaUrl) {
            return res.redirect(`/messages/new/${targetUser._id}?status=empty-message`);
        }

        const existing = await messageModel.getConversationBetween(
            req.session.userId,
            targetUser._id
        );

        if (existing) {
            if (existing.status === "active") {
                await messageModel.addMessage(existing._id, req.session.userId, {
                    text,
                    ...media
                });
                return res.redirect(`/messages/${existing._id}`);
            }

            removeUploadedFile(req.file);
            return res.redirect(`/messages/${existing._id}?status=request-pending`);
        }

        const status = targetUser.isPrivate === true ? "pending" : "active";
        const conversation = await messageModel.createConversation(
            req.session.userId,
            targetUser._id,
            status
        );

        await messageModel.addMessage(conversation._id, req.session.userId, {
            text,
            ...media
        });

        if (status === "pending") {
            return res.redirect(`/messages/${conversation._id}?status=request-sent`);
        }

        res.redirect(`/messages/${conversation._id}`);
    } catch (error) {
        removeUploadedFile(req.file);
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function conversation(req, res) {
    try {
        const conversation = await messageModel.getConversationById(req.params.id);

        if (!conversation || !isParticipant(conversation, req.session.userId)) {
            return res.status(404).send("Conversation not found");
        }

        const otherId = otherParticipantId(conversation, req.session.userId);
        const [otherUser, messages, incomingRequests] = await Promise.all([
            otherId ? userModel.getUserById(otherId) : null,
            messageModel.getMessages(conversation._id),
            messageModel.getIncomingRequests(req.session.userId)
        ]);

        const isRequester = sameId(conversation.requesterId, req.session.userId);
        const isRecipient = sameId(conversation.recipientId, req.session.userId);

        res.render("messages/conversation", {
            conversation,
            messages,
            otherUser: otherUser || {
                _id: otherId,
                displayName: "Deleted user",
                username: "deleted",
                avatarUrl: "/images/default-avatar.png"
            },
            currentUserId: req.session.userId,
            isRequester,
            isRecipient,
            activeTab: "chats",
            incomingRequestCount: incomingRequests.length,
            status: getStatus(req.query.status)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function sendMessage(req, res) {
    try {
        const text = cleanMessage(req.body.text);
        const media = getMedia(req.file);
        const conversation = await messageModel.getConversationById(req.params.id);

        if (!conversation || !isParticipant(conversation, req.session.userId)) {
            removeUploadedFile(req.file);
            return res.status(404).send("Conversation not found");
        }

        if (conversation.status !== "active") {
            removeUploadedFile(req.file);
            return res.redirect(`/messages/${conversation._id}?status=request-pending`);
        }

        if (!text && !media.mediaUrl) {
            return res.redirect(`/messages/${conversation._id}?status=empty-message`);
        }

        await messageModel.addMessage(conversation._id, req.session.userId, {
            text,
            ...media
        });
        res.redirect(`/messages/${conversation._id}`);
    } catch (error) {
        removeUploadedFile(req.file);
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function approve(req, res) {
    try {
        const approved = await messageModel.approveConversation(
            req.params.id,
            req.session.userId
        );

        if (!approved) {
            return res.status(404).send("Message request not found");
        }

        res.redirect(`/messages/${req.params.id}?status=request-approved`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function decline(req, res) {
    try {
        const conversation = await messageModel.getConversationById(req.params.id);

        if (!conversation || !sameId(conversation.recipientId, req.session.userId) || conversation.status !== "pending") {
            return res.status(404).send("Message request not found");
        }

        const messages = await messageModel.getMessages(conversation._id);
        const declined = await messageModel.declineConversation(
            req.params.id,
            req.session.userId
        );

        if (!declined) {
            return res.status(404).send("Message request not found");
        }

        messages.forEach((message) => removeMediaByUrl(message.mediaUrl));

        res.redirect("/messages/requests?status=request-declined");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

module.exports = {
    inbox,
    requests,
    newMessage,
    compose,
    startConversation,
    conversation,
    sendMessage,
    approve,
    decline
};
