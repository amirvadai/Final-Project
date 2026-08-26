const userModel = require("../models/userModel");
const postModel = require("../models/postModel");

const STATUS_MESSAGES = {
    "friend-added": { text: "You are now friends.", type: "success" },
    "request-sent": { text: "Friend request sent.", type: "success" },
    "request-accepted": { text: "Friend request accepted.", type: "success" },
    "request-declined": { text: "Friend request declined.", type: "info" },
    "request-cancelled": { text: "Friend request cancelled.", type: "info" },
    "friend-removed": { text: "Friend removed.", type: "info" },
    "already-friends": { text: "You are already friends.", type: "info" },
    "already-requested": { text: "That friend request is already pending.", type: "info" },
    "privacy-updated": { text: "Account privacy updated.", type: "success" }
};

function idInList(list, id) {
    return (list || []).some((value) => value.toString() === id.toString());
}

function getStatus(code) {
    return STATUS_MESSAGES[code] || null;
}

function safeReturnTo(value, fallback = "/users") {
    if (
        typeof value === "string" &&
        value.startsWith("/") &&
        !value.startsWith("//")
    ) {
        return value;
    }

    return fallback;
}

function redirectWithStatus(res, returnTo, status) {
    const separator = returnTo.includes("?") ? "&" : "?";
    res.redirect(`${returnTo}${separator}status=${encodeURIComponent(status)}`);
}

function relationshipFor(currentUser, targetUser) {
    const currentId = currentUser._id.toString();
    const targetId = targetUser._id.toString();
    const isSelf = currentId === targetId;
    const isFriend = idInList(currentUser.friends, targetId);
    const outgoingPending = idInList(
        currentUser.outgoingFriendRequests,
        targetId
    );
    const incomingPending = idInList(
        currentUser.incomingFriendRequests,
        targetId
    );
    const isPrivate = targetUser.isPrivate === true;

    return {
        isSelf,
        isFriend,
        outgoingPending,
        incomingPending,
        profileVisible: isSelf || isFriend || !isPrivate
    };
}

function decorateUser(currentUser, targetUser) {
    return {
        ...targetUser,
        isPrivate: targetUser.isPrivate === true,
        relationship: relationshipFor(currentUser, targetUser)
    };
}

async function loadCurrentUser(req) {
    return userModel.getUserById(req.session.userId);
}

async function renderUsersPage(req, res, view, data) {
    const currentUser = data.currentUser || await loadCurrentUser(req);

    res.render(view, {
        ...data,
        currentUser,
        incomingRequestCount: (currentUser.incomingFriendRequests || []).length,
        status: getStatus(req.query.status)
    });
}

async function list(req, res) {
    try {
        const [currentUser, allUsers] = await Promise.all([
            loadCurrentUser(req),
            userModel.getAllUsers()
        ]);

        if (!currentUser) {
            return res.redirect("/login");
        }

        const users = allUsers
            .filter((user) => user._id.toString() !== currentUser._id.toString())
            .map((user) => decorateUser(currentUser, user));

        await renderUsersPage(req, res, "users/list", {
            currentUser,
            users,
            activeTab: "discover"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function friends(req, res) {
    try {
        const currentUser = await loadCurrentUser(req);

        if (!currentUser) {
            return res.redirect("/login");
        }

        const friendUsers = await userModel.getUsersByIds(currentUser.friends || []);

        await renderUsersPage(req, res, "users/friends", {
            currentUser,
            friends: friendUsers.map((user) => decorateUser(currentUser, user)),
            activeTab: "friends"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function requests(req, res) {
    try {
        const currentUser = await loadCurrentUser(req);

        if (!currentUser) {
            return res.redirect("/login");
        }

        const [incomingUsers, outgoingUsers] = await Promise.all([
            userModel.getUsersByIds(currentUser.incomingFriendRequests || []),
            userModel.getUsersByIds(currentUser.outgoingFriendRequests || [])
        ]);

        await renderUsersPage(req, res, "users/requests", {
            currentUser,
            incomingRequests: incomingUsers.map((user) =>
                decorateUser(currentUser, user)
            ),
            outgoingRequests: outgoingUsers.map((user) =>
                decorateUser(currentUser, user)
            ),
            activeTab: "requests"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function profile(req, res) {
    try {
        const [currentUser, user] = await Promise.all([
            loadCurrentUser(req),
            userModel.getUserById(req.params.id)
        ]);

        if (!currentUser) {
            return res.redirect("/login");
        }

        if (!user) {
            return res.status(404).send("User not found");
        }

        const decoratedUser = decorateUser(currentUser, user);
        const posts = decoratedUser.relationship.profileVisible
            ? await postModel.getPostsByAuthor(user._id)
            : [];

        res.render("users/profile", {
            user: decoratedUser,
            currentUser,
            currentUserId: req.session.userId,
            posts,
            status: getStatus(req.query.status)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function showEditProfileForm(req, res) {
    try {
        const user = await loadCurrentUser(req);

        if (!user) {
            return res.redirect("/login");
        }

        res.render("users/edit", { user });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function updateProfile(req, res) {
    try {
        const { displayName, city, interests, accountPrivacy, removeAvatar } = req.body;
        const file = req.file; 
        
        const currentUser = await loadCurrentUser(req);

        if (!currentUser) {
            return res.redirect("/login");
        }

        let interestsArray = [];

        if (interests) {
            interestsArray = interests
                .split(",")
                .map((interest) => interest.trim())
                .filter(Boolean);
        }

        const updates = {
            displayName: String(displayName || "").trim(),
            city: String(city || "").trim(),
            interests: interestsArray
        };

        if (accountPrivacy === "public" || accountPrivacy === "private") {
            updates.isPrivate = accountPrivacy === "private";
        }

        if (file) {
            updates.avatarUrl = "/uploads/" + file.filename;
        } else if (removeAvatar === "true") {
            updates.avatarUrl = "/images/default-avatar.png";
        }

        await userModel.updateUser(req.session.userId, updates);

        res.redirect(`/users/${req.session.userId}?status=privacy-updated`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function addFriendOrRequest(req, res) {
    try {
        const returnTo = safeReturnTo(
            req.body.returnTo,
            `/users/${req.params.id}`
        );

        if (req.params.id === req.session.userId) {
            return res.redirect(returnTo);
        }

        const [currentUser, targetUser] = await Promise.all([
            loadCurrentUser(req),
            userModel.getUserById(req.params.id)
        ]);

        if (!currentUser || !targetUser) {
            return res.status(404).send("User not found");
        }

        const relationship = relationshipFor(currentUser, targetUser);

        if (relationship.isFriend) {
            return redirectWithStatus(res, returnTo, "already-friends");
        }

        if (relationship.incomingPending) {
            await userModel.acceptFriendRequest(
                currentUser._id,
                targetUser._id
            );

            return redirectWithStatus(res, returnTo, "request-accepted");
        }

        if (relationship.outgoingPending) {
            return redirectWithStatus(res, returnTo, "already-requested");
        }

        if (targetUser.isPrivate === true) {
            await userModel.sendFriendRequest(
                currentUser._id,
                targetUser._id
            );

            return redirectWithStatus(res, returnTo, "request-sent");
        }

        // Public accounts can be added immediately, as requested.
        await userModel.addFriend(currentUser._id, targetUser._id);
        return redirectWithStatus(res, returnTo, "friend-added");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function acceptRequest(req, res) {
    try {
        const returnTo = safeReturnTo(req.body.returnTo, "/users/requests");
        const accepted = await userModel.acceptFriendRequest(
            req.session.userId,
            req.params.id
        );

        redirectWithStatus(
            res,
            returnTo,
            accepted ? "request-accepted" : "request-declined"
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function declineRequest(req, res) {
    try {
        const returnTo = safeReturnTo(req.body.returnTo, "/users/requests");

        await userModel.declineFriendRequest(
            req.session.userId,
            req.params.id
        );

        redirectWithStatus(res, returnTo, "request-declined");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function cancelRequest(req, res) {
    try {
        const returnTo = safeReturnTo(req.body.returnTo, "/users/requests");

        await userModel.cancelFriendRequest(
            req.session.userId,
            req.params.id
        );

        redirectWithStatus(res, returnTo, "request-cancelled");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function removeFriend(req, res) {
    try {
        const returnTo = safeReturnTo(req.body.returnTo, "/users/friends");

        await userModel.removeFriend(
            req.session.userId,
            req.params.id
        );

        redirectWithStatus(res, returnTo, "friend-removed");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function deleteAccount(req, res) {
    try {
        await userModel.deleteUser(req.session.userId);

        req.session.destroy(() => {
            res.redirect("/register");
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}


module.exports = {
    list,
    friends,
    requests,
    profile,
    showEditProfileForm,
    updateProfile,
    addFriendOrRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    deleteAccount
};
