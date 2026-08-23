require("dotenv").config();

const { connectDB, getDB } = require("../config/database");

const userModel = require("../models/userModel");
const groupModel = require("../models/groupModel");
const postModel = require("../models/postModel");

async function seed() {
    try {
        await connectDB();

        const db = getDB();

        // ניקוי הנתונים הקיימים
        await db.collection("users").deleteMany({});
        await db.collection("groups").deleteMany({});
        await db.collection("posts").deleteMany({});

        console.log("Old data deleted");

        // =========================
        // USERS
        // =========================

        const daniel = await userModel.createUser({
            username: "daniel",
            passwordHash: "TEMP_HASH",
            displayName: "Daniel Cohen",
            city: "Tel Aviv",
            interests: ["Running", "Music", "Travel"]
        });

        const maya = await userModel.createUser({
            username: "maya",
            passwordHash: "TEMP_HASH",
            displayName: "Maya Levi",
            city: "Jerusalem",
            interests: ["Photography", "Art", "Travel"]
        });

        const noam = await userModel.createUser({
            username: "noam",
            passwordHash: "TEMP_HASH",
            displayName: "Noam David",
            city: "Haifa",
            interests: ["Gaming", "Technology"]
        });

        console.log("Users created");

        // =========================
        // FRIENDSHIP
        // =========================

        await db.collection("users").updateOne(
            { _id: daniel._id },
            {
                $addToSet: {
                    friends: maya._id
                }
            }
        );

        await db.collection("users").updateOne(
            { _id: maya._id },
            {
                $addToSet: {
                    friends: daniel._id
                }
            }
        );

        // =========================
        // GROUPS
        // =========================

        const runnersGroup = await groupModel.createGroup({
            name: "Tel Aviv Runners",

            description:
                "A group for people who enjoy running together.",

            category: "Sports",

            manager: daniel._id,

            location: {
                address: "Rothschild Boulevard",
                city: "Tel Aviv",
                latitude: 32.0636,
                longitude: 34.7740
            }
        });

        const photographyGroup = await groupModel.createGroup({
            name: "Photography Lovers",

            description:
                "Share photography ideas and organize photo walks.",

            category: "Art",

            manager: maya._id,

            location: {
                address: "Jaffa Old City",
                city: "Tel Aviv",
                latitude: 32.0522,
                longitude: 34.7540
            }
        });

        console.log("Groups created");

        // =========================
        // ADD MEMBERS
        // =========================

        await db.collection("groups").updateOne(
            { _id: runnersGroup._id },
            {
                $addToSet: {
                    members: maya._id
                }
            }
        );

        await db.collection("groups").updateOne(
            { _id: photographyGroup._id },
            {
                $addToSet: {
                    members: noam._id
                }
            }
        );

        // =========================
        // POSTS
        // =========================

        await postModel.createPost({
            author: daniel._id,
            group: runnersGroup._id,
            type: "text",
            text: "Running this Saturday at 08:00!",
            tags: ["running", "telaviv"]
        });

        await postModel.createPost({
            author: maya._id,
            group: photographyGroup._id,
            type: "image",
            text: "Great photo from our last walk.",
            mediaUrl: "/images/demo/photo1.jpg",
            tags: ["photography"]
        });

        await postModel.createPost({
            author: noam._id,
            group: null,
            type: "video",
            text: "A short video about my latest project.",
            mediaUrl: "/videos/demo/video1.mp4",
            tags: ["technology"]
        });

        console.log("Posts created");

        console.log("Seed completed successfully");

        process.exit(0);

    } catch (error) {
        console.error("Seed failed:");
        console.error(error);

        process.exit(1);
    }
}

seed();