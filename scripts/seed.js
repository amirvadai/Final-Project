require("dotenv").config();

const postTimes = {
    "Running this Saturday at 08:00!": "2026-08-12T07:42:00+03:00",
    "Great photo from our last walk.": "2026-08-13T18:26:00+03:00",
    "A short video about my latest project.": "2026-08-14T21:13:00+03:00",
    "Anyone playing tonight? Looking for a squad!": "2026-08-16T22:08:00+03:00",
    "My new gaming setup is finally ready!": "2026-08-17T18:37:00+03:00",
    "Working on a new web development project. Excited to share it soon!": "2026-08-18T10:14:00+03:00",
    "What programming language are you learning right now?": "2026-08-19T20:51:00+03:00",
    "Great workout at the park today!": "2026-08-20T07:33:00+03:00",
    "Who is joining us for a morning run this weekend?": "2026-08-21T17:46:00+03:00",
    "Don't forget to stay hydrated during your workout!": "2026-08-22T11:08:00+03:00",
    "One of my favorite views from a recent trip.": "2026-08-23T18:29:00+03:00",
    "What is your favorite place to visit in Israel?": "2026-08-24T21:17:00+03:00",
    "Sunset photography is always worth the wait.": "2026-08-25T19:42:00+03:00",
    "Recommend me a song that everyone should hear at least once.": "2026-08-26T22:03:00+03:00",
    "Had an amazing week! Looking forward to the weekend.": "2026-08-27T08:16:00+03:00",
    "Trying something new with my photography today.": "2026-08-27T12:41:00+03:00",
    "A short clip from today's training session.": "2026-08-27T15:27:00+03:00"
};

async function createSeedPost(post) {
    const createdAt = new Date(postTimes[post.text]);

    return postModel.createPost({
        ...post,
        createdAt,
        updatedAt: createdAt
    });
}

const { connectDB, getDB } = require("../config/database");

const userModel = require("../models/userModel");
const groupModel = require("../models/groupModel");
const postModel = require("../models/postModel");

const bcrypt = require("bcrypt");

async function seed() {
    try {
        await connectDB();

        const db = getDB();

        //Deleting exsisting
        await db.collection("users").deleteMany({});
        await db.collection("groups").deleteMany({});
        await db.collection("posts").deleteMany({});
        console.log("Old data deleted");
        
        const defaultPassword = "12345";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        //Users

        const daniel = await userModel.createUser({
            username: "daniel",
            passwordHash: passwordHash,
            displayName: "Daniel Cohen",
            city: "Tel Aviv",
            interests: ["Running", "Music", "Travel"],
            avatarUrl: "/images/demo/daniel-avatar.jpg"
        });

        const maya = await userModel.createUser({
            username: "maya",
            passwordHash: passwordHash,
            displayName: "Maya Levi",
            city: "Jerusalem",
            interests: ["Photography", "Art", "Travel"],
            avatarUrl: "/images/demo/maya-avatar.jpg"
        });

        const noam = await userModel.createUser({
            username: "noam",
            passwordHash: passwordHash,
            displayName: "Noam David",
            city: "Haifa",
            interests: ["Gaming", "Technology"],
            avatarUrl: "/images/demo/noam-avatar.jpg"
        });

        const yael = await userModel.createUser({
        username: "yael",
        passwordHash: passwordHash,
        displayName: "Yael Israeli",
        city: "Netanya",
        interests: ["Fitness", "Travel", "Food"],
        avatarUrl: "/images/demo/yael-avatar.jpg"
    });

    const tom = await userModel.createUser({
        username: "tom",
        passwordHash: passwordHash,
        displayName: "Tom Bar",
        city: "Tel Aviv",
        interests: ["Gaming", "Music", "Technology"],
        avatarUrl: "/images/demo/tom-avatar.png"
    });

    const shira = await userModel.createUser({
        username: "shira",
        passwordHash: passwordHash,
        displayName: "Shira Cohen",
        city: "Jerusalem",
        interests: ["Art", "Photography", "Fashion"],
        avatarUrl: "/images/demo/shira-avatar.jpg"
    });

    const adam = await userModel.createUser({
        username: "adam",
        passwordHash: passwordHash,
        displayName: "Adam Levi",
        city: "Haifa",
        interests: ["Sports", "Technology", "Gaming"],
        avatarUrl: "/images/demo/adam-avatar.jpg"
    });

    const noa = await userModel.createUser({
        username: "noa",
        passwordHash: passwordHash,
        displayName: "Noa Mizrahi",
        city: "Netanya",
        interests: ["Music", "Travel", "Photography"],
        avatarUrl: "/images/demo/noa-avatar.jpg"
    });

    const idan = await userModel.createUser({
        username: "idan",
        passwordHash: passwordHash,
        displayName: "Idan Shalom",
        city: "Beer Sheva",
        interests: ["Programming", "Gaming", "Technology"],
        avatarUrl: "/images/demo/idan-avatar.jpg"
    });

    const lior = await userModel.createUser({
        username: "lior",
        passwordHash: passwordHash,
        displayName: "Lior Ben David",
        city: "Rishon LeZion",
        interests: ["Running", "Fitness", "Sports"],
        avatarUrl: "/images/demo/lior-avatar.jpg"
    });

    const dana = await userModel.createUser({
        username: "dana",
        passwordHash: passwordHash,
        displayName: "Dana Katz",
        city: "Tel Aviv",
        interests: ["Food", "Travel", "Art"],
        avatarUrl: "/images/demo/dana-avatar.jpg"
    });

    const omer = await userModel.createUser({
        username: "omer",
        passwordHash: passwordHash,
        displayName: "Omer Azulay",
        city: "Herzliya",
        interests: ["Surfing", "Sports", "Travel"],
    avatarUrl: "/images/demo/omer-avatar.jpg"
    });

    const roni = await userModel.createUser({
        username: "roni",
        passwordHash: passwordHash,
        displayName: "Roni Driks",
        city: "Beit Nehemia",
        interests: ["Books", "Music", "Photography"],
        avatarUrl: "/images/demo/roni-avatar.png"
    });

            console.log("Users created");

        //friendships

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

        await db.collection("users").updateOne(
        { _id: daniel._id },
        {
            $addToSet: {
                friends: {
                    $each: [maya._id, lior._id, omer._id, tom._id]
                }
            }
        }
    );

    await db.collection("users").updateOne(
        { _id: maya._id },
        {
            $addToSet: {
                friends: {
                    $each: [daniel._id, shira._id, noa._id, dana._id]
                }
            }
        }
    );

    await db.collection("users").updateOne(
        { _id: noam._id },
        {
            $addToSet: {
                friends: {
                    $each: [tom._id, adam._id, idan._id]
                }
            }
        }
    );

    await db.collection("users").updateOne(
        { _id: tom._id },
        {
            $addToSet: {
                friends: {
                    $each: [noam._id, adam._id, idan._id, daniel._id]
                }
            }
        }
    );

    await db.collection("users").updateOne(
        { _id: shira._id },
        {
            $addToSet: {
                friends: {
                    $each: [maya._id, noa._id, roni._id]
                }
            }
        }
    );

    await db.collection("users").updateOne(
        { _id: lior._id },
        {
            $addToSet: {
                friends: {
                    $each: [daniel._id, yael._id, omer._id]
                }
            }
        }
    );

    await db.collection("users").updateOne(
        { _id: yael._id },
        {
            $addToSet: {
                friends: {
                    $each: [lior._id, dana._id, noa._id]
                }
            }
        }
    );

        //groups

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

        const gamingGroup = await groupModel.createGroup({
        name: "Israel Gaming Hub",
        description:
            "A community for gamers to meet, play and talk about their favorite games.",
        category: "Gaming",
        manager: tom._id,
        location: {
            address: "Dizengoff Center",
            city: "Tel Aviv",
            latitude: 32.0756,
            longitude: 34.7743
        }
    });

    const techGroup = await groupModel.createGroup({
        name: "Tech & Programming",
        description:
            "For people interested in programming, technology and building projects.",
        category: "Technology",
        manager: idan._id,
        location: {
            address: "HaShalom Road",
            city: "Tel Aviv",
            latitude: 32.0747,
            longitude: 34.7933
        }
    });

    const fitnessGroup = await groupModel.createGroup({
        name: "Fitness Together",
        description:
            "Train together, share fitness tips and stay motivated.",
        category: "Sports",
        manager: yael._id,
        location: {
            address: "Independence Park",
            city: "Netanya",
            latitude: 32.3215,
            longitude: 34.8532
        }
    });

    const travelGroup = await groupModel.createGroup({
        name: "Israel Travel Community",
        description:
            "Discover new places, plan trips and meet people who love traveling.",
        category: "Travel",
        manager: dana._id,
        location: {
            address: "Rothschild Boulevard",
            city: "Tel Aviv",
            latitude: 32.0645,
            longitude: 34.7745
        }
    });

    const musicGroup = await groupModel.createGroup({
        name: "Music Lovers Israel",
        description:
            "Share music, discover new artists and organize music events.",
        category: "Music",
        manager: roni._id,
        location: {
            address: "Habima Square",
            city: "Tel Aviv",
            latitude: 32.0730,
            longitude: 34.7816
        }
    });

        console.log("Groups created");

        //add members

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

        await db.collection("groups").updateOne(
        { _id: gamingGroup._id },
        {
            $addToSet: {
                members: {
                    $each: [noam._id, adam._id, idan._id]
                }
            }
        }
    );

    await db.collection("groups").updateOne(
        { _id: techGroup._id },
        {
            $addToSet: {
                members: {
                    $each: [noam._id, tom._id, adam._id]
                }
            }
        }
    );

    await db.collection("groups").updateOne(
        { _id: fitnessGroup._id },
        {
            $addToSet: {
                members: {
                    $each: [daniel._id, lior._id, omer._id]
                }
            }
        }
    );

    await db.collection("groups").updateOne(
        { _id: travelGroup._id },
        {
            $addToSet: {
                members: {
                    $each: [maya._id, yael._id, noa._id, omer._id]
                }
            }
        }
    );

    await db.collection("groups").updateOne(
        { _id: musicGroup._id },
        {
            $addToSet: {
                members: {
                    $each: [daniel._id, noa._id, tom._id, roni._id]
                }
            }
        }
    );

        //posts

        await createSeedPost({
            author: daniel._id,
            group: runnersGroup._id,
            type: "text",
            text: "Running this Saturday at 08:00!",
            tags: ["running", "telaviv"],
            locationName: "Tel Aviv-Yafo",
            weather: { temp: 22, description: "clear sky", icon: "01d" }
        });

        await createSeedPost({
            author: maya._id,
            group: photographyGroup._id,
            type: "image",
            text: "Great photo from our last walk.",
            mediaUrl: "/images/demo/maya-post.jpg",
            tags: ["photography"],
            locationName: "Jerusalem",
            weather: { temp: 18, description: "scattered clouds", icon: "03d" }
        });

        await createSeedPost({
            author: noam._id,
            group: null,
            type: "video",
            text: "A short video about my latest project.",
            mediaUrl: "/videos/demo/noam-video.mp4",
            tags: ["technology"]
        });

        await createSeedPost({
            author: tom._id,
            group: gamingGroup._id,
            type: "text",
            text: "Anyone playing tonight? Looking for a squad!",
            tags: ["gaming", "multiplayer"]
        });

        await createSeedPost({
            author: noam._id,
            group: gamingGroup._id,
            type: "image",
            text: "My new gaming setup is finally ready!",
            mediaUrl: "/images/demo/gaming-setup.jpg",
            tags: ["gaming", "setup"],
            locationName: "Dizengoff Center, Tel Aviv",
            weather: { temp: 25, description: "broken clouds", icon: "04n" }
        });

        await createSeedPost({
            author: idan._id,
            group: techGroup._id,
            type: "text",
            text: "Working on a new web development project. Excited to share it soon!",
            tags: ["programming", "webdevelopment"]
        });

        await createSeedPost({
            author: adam._id,
            group: techGroup._id,
            type: "text",
            text: "What programming language are you learning right now?",
            tags: ["programming", "technology"]
        });

        await createSeedPost({
            author: yael._id,
            group: fitnessGroup._id,
            type: "image",
            text: "Great workout at the park today!",
            mediaUrl: "/images/demo/fitness-workout.jpg",
            tags: ["fitness", "workout"],
            locationName: "Independence Park, Netanya",
            weather: { temp: 27, description: "few clouds", icon: "02d" }
        });

        await createSeedPost({
            author: lior._id,
            group: runnersGroup._id,
            type: "text",
            text: "Who is joining us for a morning run this weekend?",
            tags: ["running", "sports"]
        });

        await createSeedPost({
            author: omer._id,
            group: fitnessGroup._id,
            type: "text",
            text: "Don't forget to stay hydrated during your workout!",
            tags: ["fitness", "health"]
        });

        await createSeedPost({
            author: dana._id,
            group: travelGroup._id,
            type: "image",
            text: "One of my favorite views from a recent trip.",
            mediaUrl: "/images/demo/travel-view.jpg",
            tags: ["travel", "nature"],
            locationName: "Haifa",
            weather: { temp: 24, description: "clear sky", icon: "01d" }
        });

        await createSeedPost({
            author: maya._id,
            group: travelGroup._id,
            type: "text",
            text: "What is your favorite place to visit in Israel?",
            tags: ["travel", "israel"]
        });

        await createSeedPost({
            author: noa._id,
            group: photographyGroup._id,
            type: "image",
            text: "Sunset photography is always worth the wait.",
            mediaUrl: "/images/demo/sunset-photo.jpg",
            tags: ["photography", "sunset"],
            locationName: "Rishon LeZion",
            weather: { temp: 23, description: "shower rain", icon: "09n" }
        });

        await createSeedPost({
            author: roni._id,
            group: musicGroup._id,
            type: "text",
            text: "Recommend me a song that everyone should hear at least once.",
            tags: ["music", "recommendations"]
        });

        await createSeedPost({
            author: daniel._id,
            group: null,
            type: "text",
            text: "Had an amazing week! Looking forward to the weekend.",
            tags: ["life", "weekend"],
            locationName: "Tel Aviv-Yafo"
        });

        await createSeedPost({
            author: shira._id,
            group: null,
            type: "image",
            text: "Trying something new with my photography today.",
            mediaUrl: "/images/demo/shira-photo.jpg",
            tags: ["photography", "art"]
        });

        await createSeedPost({
            author: adam._id,
            group: null,
            type: "video",
            text: "A short clip from today's training session.",
            mediaUrl: "/videos/demo/adam-training.mp4",
            tags: ["sports", "training"],
            locationName: "Beer Sheva",
            weather: { temp: 32, description: "clear sky", icon: "01d" }
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