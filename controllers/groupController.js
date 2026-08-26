const fs = require("fs");
const path = require("path");
const { ObjectId } = require("mongodb");

const groupModel = require("../models/groupModel");
const postModel = require("../models/postModel");

const GROUP_CATEGORIES = [
    "Neighborhood",
    "Events",
    "Parents & Family",
    "Buy & Sell",
    "Hobbies",
    "Sports & Fitness",
    "Volunteering",
    "Safety & Alerts",
    "Local Business",
    "Other"
];

const DEFAULT_GROUP_COVER = "/images/default-group-cover.svg";
const PUBLIC_DIRECTORY = path.join(__dirname, "..", "public");

const STATUS_MESSAGES = {
    "group-created": {
        text: "The group was created successfully.",
        type: "success"
    },
    "group-updated": {
        text: "The group settings were updated.",
        type: "success"
    },
    joined: {
        text: "You joined the group.",
        type: "success"
    },
    requested: {
        text: "Your request was sent to the group manager.",
        type: "success"
    },
    left: {
        text: "You left the group.",
        type: "success"
    },
    approved: {
        text: "The membership request was approved.",
        type: "success"
    },
    rejected: {
        text: "The membership request was rejected.",
        type: "success"
    },
    "member-removed": {
        text: "The member was removed from the group.",
        type: "success"
    },
    "post-created": {
        text: "Your post was published in the group.",
        type: "success"
    },
    "post-deleted": {
        text: "The group post was deleted.",
        type: "success"
    },
    "already-member": {
        text: "You are already a member of this group.",
        type: "info"
    },
    "already-requested": {
        text: "Your membership request is already pending.",
        type: "info"
    },
    "owner-cannot-leave": {
        text: "The group manager cannot leave. Delete the group instead.",
        type: "warning"
    },
    "group-deleted": {
        text: "The group and its posts were deleted.",
        type: "success"
    }
};

function isValidId(id) {
    return ObjectId.isValid(id);
}

function cleanText(value) {
    return String(value || "").trim();
}

function parseRules(value) {
    return String(value || "")
        .split(/\r?\n/)
        .map((rule) => rule.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((rule) => rule.slice(0, 200));
}

function userIsInList(list, userId) {
    return (list || []).some((value) => value.toString() === userId);
}

function normalizeGroup(group) {
    return {
        ...group,
        privacy: group.privacy === "private" ? "private" : "public",
        coverImageUrl: group.coverImageUrl || DEFAULT_GROUP_COVER,
        members: Array.isArray(group.members) ? group.members : [],
        joinRequests: Array.isArray(group.joinRequests)
            ? group.joinRequests
            : [],
        rules: Array.isArray(group.rules) ? group.rules : [],
        memberDetails: Array.isArray(group.memberDetails)
            ? group.memberDetails
            : [],
        requestDetails: Array.isArray(group.requestDetails)
            ? group.requestDetails
            : [],
        location: {
            address: group.location?.address || "",
            city: group.location?.city || "",
            latitude: group.location?.latitude ?? null,
            longitude: group.location?.longitude ?? null
        },
        memberCount:
            typeof group.memberCount === "number"
                ? group.memberCount
                : Array.isArray(group.members)
                  ? group.members.length
                  : 0
    };
}

function decorateGroup(group, currentUserId) {
    const normalizedGroup = normalizeGroup(group);

    const isManager =
        normalizedGroup.manager?.toString() === currentUserId;

    const isMember =
        isManager ||
        userIsInList(normalizedGroup.members, currentUserId);

    const hasRequested = userIsInList(
        normalizedGroup.joinRequests,
        currentUserId
    );

    return {
        ...normalizedGroup,
        viewerIsManager: isManager,
        viewerIsMember: isMember,
        viewerHasRequested: hasRequested
    };
}

function getStatus(statusCode) {
    return STATUS_MESSAGES[statusCode] || null;
}

function validationError(formData) {
    if (formData.name.length < 3 || formData.name.length > 80) {
        return "The group name must contain between 3 and 80 characters.";
    }

    if (
        formData.description.length < 10 ||
        formData.description.length > 2000
    ) {
        return "The description must contain between 10 and 2,000 characters.";
    }

    if (!GROUP_CATEGORIES.includes(formData.category)) {
        return "Choose a valid group category.";
    }

    if (!formData.city || formData.city.length > 100) {
        return "Enter the city in which the group is based.";
    }

    if (!["public", "private"].includes(formData.privacy)) {
        return "Choose whether the group is public or private.";
    }

    return null;
}

function formDataFromRequest(req) {
    return {
        name: cleanText(req.body.name),
        description: cleanText(req.body.description),
        category: cleanText(req.body.category),
        privacy:
            req.body.privacy === "private" ? "private" : "public",
        city: cleanText(req.body.city),
        address: cleanText(req.body.address),
        rules: cleanText(req.body.rules)
    };
}

function deleteRequestFile(file) {
    if (!file?.path) {
        return;
    }

    fs.unlink(file.path, (error) => {
        if (error && error.code !== "ENOENT") {
            console.error("Could not delete uploaded file:", error);
        }
    });
}

function deletePublicUpload(publicUrl) {
    if (
        !publicUrl ||
        !publicUrl.startsWith("/uploads/groups/")
    ) {
        return;
    }

    const relativePath = publicUrl.replace(/^\/+/, "");
    const absolutePath = path.resolve(PUBLIC_DIRECTORY, relativePath);
    const safeRoot = path.resolve(
        PUBLIC_DIRECTORY,
        "uploads",
        "groups"
    );

    if (
        absolutePath !== safeRoot &&
        !absolutePath.startsWith(safeRoot + path.sep)
    ) {
        return;
    }

    fs.unlink(absolutePath, (error) => {
        if (error && error.code !== "ENOENT") {
            console.error("Could not delete group upload:", error);
        }
    });
}

async function loadGroupOrSend404(req, res) {
    if (!isValidId(req.params.id)) {
        res.status(404).send("Group not found");
        return null;
    }

    const group = await groupModel.getGroupById(req.params.id);

    if (!group) {
        res.status(404).send("Group not found");
        return null;
    }

    return normalizeGroup(group);
}

function managerOwnsGroup(group, currentUserId) {
    return group.manager?.toString() === currentUserId;
}

async function list(req, res) {
    try {
        const filters = {
            q: cleanText(req.query.q),
            category: cleanText(req.query.category),
            city: cleanText(req.query.city),
            mine: req.query.mine === "1"
        };

        const searchFilters = {
            q: filters.q,
            category: filters.category,
            city: filters.city
        };

        if (filters.mine) {
            searchFilters.memberId = req.session.userId;
        }

        const [groups, myGroups] = await Promise.all([
            groupModel.searchGroups(searchFilters),
            groupModel.getGroupsForUser(req.session.userId)
        ]);

        res.render("groups/search", {
            groups: groups.map((group) =>
                decorateGroup(group, req.session.userId)
            ),
            myGroups: myGroups.map((group) =>
                decorateGroup(group, req.session.userId)
            ),
            categories: GROUP_CATEGORIES,
            filters,
            status: getStatus(req.query.status)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

function showCreateForm(req, res) {
    res.render("groups/create", {
        categories: GROUP_CATEGORIES,
        error: null,
        formData: {
            name: "",
            description: "",
            category: "Neighborhood",
            privacy: "public",
            city: res.locals.currentUser?.city || "",
            address: "",
            rules: ""
        }
    });
}

async function create(req, res) {
    const formData = formDataFromRequest(req);
    const errorMessage = validationError(formData);

    if (errorMessage) {
        deleteRequestFile(req.file);

        return res.status(400).render("groups/create", {
            categories: GROUP_CATEGORIES,
            error: errorMessage,
            formData
        });
    }

    try {
        const coverImageUrl = req.file
            ? `/uploads/groups/covers/${req.file.filename}`
            : DEFAULT_GROUP_COVER;

        const group = await groupModel.createGroup({
            name: formData.name,
            description: formData.description,
            category: formData.category,
            privacy: formData.privacy,
            coverImageUrl,
            manager: req.session.userId,
            rules: parseRules(formData.rules),
            location: {
                address: formData.address,
                city: formData.city,
                latitude: null,
                longitude: null
            }
        });

        res.redirect(`/groups/${group._id}?status=group-created`);
    } catch (error) {
        deleteRequestFile(req.file);
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function details(req, res) {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(404).send("Group not found");
        }

        const groupDocument = await groupModel.getGroupWithDetails(
            req.params.id
        );

        if (!groupDocument) {
            return res.status(404).send("Group not found");
        }

        const group = decorateGroup(
            groupDocument,
            req.session.userId
        );

        const canViewPosts =
            group.privacy === "public" || group.viewerIsMember;

        let posts = [];

        if (canViewPosts) {
            posts = await postModel.getPostsByGroupId(group._id);

            posts = posts.map((post) => ({
                ...post,
                viewerCanDelete:
                    group.viewerIsManager ||
                    post.author?.toString() === req.session.userId
            }));
        }

        res.render("groups/details", {
            group,
            posts,
            canViewPosts,
            currentUserId: req.session.userId,
            status: getStatus(req.query.status)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function showEditForm(req, res) {
    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            return;
        }

        if (!managerOwnsGroup(group, req.session.userId)) {
            return res.status(403).send(
                "Only the group manager can edit this group."
            );
        }

        res.render("groups/edit", {
            group,
            categories: GROUP_CATEGORIES,
            error: null,
            formData: {
                name: group.name,
                description: group.description,
                category: group.category,
                privacy: group.privacy,
                city: group.location.city,
                address: group.location.address,
                rules: group.rules.join("\n")
            }
        });
    } catch (error) {
        deleteRequestFile(req.file);
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function update(req, res) {
    const formData = formDataFromRequest(req);

    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            deleteRequestFile(req.file);
            return;
        }

        if (!managerOwnsGroup(group, req.session.userId)) {
            deleteRequestFile(req.file);

            return res.status(403).send(
                "Only the group manager can edit this group."
            );
        }

        const errorMessage = validationError(formData);

        if (errorMessage) {
            deleteRequestFile(req.file);

            return res.status(400).render("groups/edit", {
                group,
                categories: GROUP_CATEGORIES,
                error: errorMessage,
                formData
            });
        }

        const updates = {
            name: formData.name,
            description: formData.description,
            category: formData.category,
            privacy: formData.privacy,
            rules: parseRules(formData.rules),
            location: {
                address: formData.address,
                city: formData.city,
                latitude: group.location.latitude,
                longitude: group.location.longitude
            }
        };

        if (formData.privacy === "public") {
            updates.joinRequests = [];
        }

        if (req.file) {
            updates.coverImageUrl =
                `/uploads/groups/covers/${req.file.filename}`;
        }

        await groupModel.updateGroup(req.params.id, updates);

        if (req.file) {
            deletePublicUpload(group.coverImageUrl);
        }

        res.redirect(`/groups/${req.params.id}?status=group-updated`);
    } catch (error) {
        deleteRequestFile(req.file);
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function remove(req, res) {
    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            return;
        }

        if (!managerOwnsGroup(group, req.session.userId)) {
            return res.status(403).send(
                "Only the group manager can delete this group."
            );
        }

        const posts = await postModel.getRawPostsByGroupId(
            req.params.id
        );

        for (const post of posts) {
            deletePublicUpload(post.mediaUrl);
        }

        deletePublicUpload(group.coverImageUrl);

        await Promise.all([
            postModel.deletePostsByGroupId(req.params.id),
            groupModel.deleteGroup(req.params.id)
        ]);

        res.redirect("/groups?status=group-deleted");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function join(req, res) {
    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            return;
        }

        const userId = req.session.userId;

        if (
            managerOwnsGroup(group, userId) ||
            userIsInList(group.members, userId)
        ) {
            return res.redirect(
                `/groups/${group._id}?status=already-member`
            );
        }

        if (userIsInList(group.joinRequests, userId)) {
            return res.redirect(
                `/groups/${group._id}?status=already-requested`
            );
        }

        if (group.privacy === "private") {
            await groupModel.addJoinRequest(group._id, userId);

            return res.redirect(
                `/groups/${group._id}?status=requested`
            );
        }

        await groupModel.addMember(group._id, userId);

        res.redirect(`/groups/${group._id}?status=joined`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function leave(req, res) {
    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            return;
        }

        if (managerOwnsGroup(group, req.session.userId)) {
            return res.redirect(
                `/groups/${group._id}?status=owner-cannot-leave`
            );
        }

        await groupModel.removeMember(
            group._id,
            req.session.userId
        );

        res.redirect(`/groups/${group._id}?status=left`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function approveRequest(req, res) {
    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            return;
        }

        if (!managerOwnsGroup(group, req.session.userId)) {
            return res.status(403).send(
                "Only the group manager can approve requests."
            );
        }

        if (!isValidId(req.params.userId)) {
            return res.status(400).send("Invalid user");
        }

        if (!userIsInList(group.joinRequests, req.params.userId)) {
            return res.status(400).send(
                "This user does not have a pending join request."
            );
        }

        await groupModel.addMember(group._id, req.params.userId);

        res.redirect(`/groups/${group._id}?status=approved`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function rejectRequest(req, res) {
    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            return;
        }

        if (!managerOwnsGroup(group, req.session.userId)) {
            return res.status(403).send(
                "Only the group manager can reject requests."
            );
        }

        if (!isValidId(req.params.userId)) {
            return res.status(400).send("Invalid user");
        }

        await groupModel.removeJoinRequest(
            group._id,
            req.params.userId
        );

        res.redirect(`/groups/${group._id}?status=rejected`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function removeMember(req, res) {
    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            return;
        }

        if (!managerOwnsGroup(group, req.session.userId)) {
            return res.status(403).send(
                "Only the group manager can remove members."
            );
        }

        if (!isValidId(req.params.userId)) {
            return res.status(400).send("Invalid user");
        }

        if (
            group.manager.toString() === req.params.userId
        ) {
            return res.status(400).send(
                "The group manager cannot be removed."
            );
        }

        await groupModel.removeMember(
            group._id,
            req.params.userId
        );

        res.redirect(
            `/groups/${group._id}?status=member-removed`
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function createPost(req, res) {
    try {
        const group = await loadGroupOrSend404(req, res);

        if (!group) {
            deleteRequestFile(req.file);
            return;
        }

        const isMember =
            managerOwnsGroup(group, req.session.userId) ||
            userIsInList(group.members, req.session.userId);

        if (!isMember) {
            deleteRequestFile(req.file);

            return res.status(403).send(
                "Join the group before publishing a post."
            );
        }

        const text = cleanText(req.body.text);
        const file = req.file;

        if (!text && !file) {
            return res.status(400).send(
                "Write something or attach an image/video."
            );
        }

        if (text.length > 3000) {
            deleteRequestFile(file);

            return res.status(400).send(
                "A group post cannot exceed 3,000 characters."
            );
        }

        let type = "text";
        let mediaUrl = null;

        if (file) {
            mediaUrl =
                `/uploads/groups/posts/${file.filename}`;

            if (file.mimetype.startsWith("image/")) {
                type = "image";
            } else if (file.mimetype.startsWith("video/")) {
                type = "video";
            }
        }

        await postModel.createPost({
            author: new ObjectId(req.session.userId),
            groupId:
                group._id instanceof ObjectId
                    ? group._id
                    : new ObjectId(group._id),
            type,
            text,
            mediaUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.redirect(
            `/groups/${group._id}?status=post-created`
        );
    } catch (error) {
        deleteRequestFile(req.file);
        console.error(error);
        res.status(500).send("Server error");
    }
}

async function deletePost(req, res) {
    try {
        if (
            !isValidId(req.params.id) ||
            !isValidId(req.params.postId)
        ) {
            return res.status(404).send("Post not found");
        }

        const [group, post] = await Promise.all([
            groupModel.getGroupById(req.params.id),
            postModel.getPostById(req.params.postId)
        ]);

        if (!group || !post || !post.groupId) {
            return res.status(404).send("Post not found");
        }

        if (
            post.groupId.toString() !== req.params.id
        ) {
            return res.status(400).send(
                "This post does not belong to the selected group."
            );
        }

        const isManager =
            group.manager.toString() === req.session.userId;

        const isAuthor =
            post.author.toString() === req.session.userId;

        if (!isManager && !isAuthor) {
            return res.status(403).send(
                "You are not allowed to delete this post."
            );
        }

        deletePublicUpload(post.mediaUrl);
        await postModel.deletePost(post._id);

        res.redirect(
            `/groups/${req.params.id}?status=post-deleted`
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

module.exports = {
    list,
    showCreateForm,
    create,
    details,
    showEditForm,
    update,
    remove,
    join,
    leave,
    approveRequest,
    rejectRequest,
    removeMember,
    createPost,
    deletePost
};
