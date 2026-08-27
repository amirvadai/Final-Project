require("dotenv").config();

const { connectDB, getDB } = require("../config/database");

const postTimes = [
    ["Running this Saturday at 08:00!", "2026-08-12T07:42:00+03:00"],
    ["Great photo from our last walk.", "2026-08-13T18:26:00+03:00"],
    ["A short video about my latest project.", "2026-08-14T21:13:00+03:00"],
    ["Anyone playing tonight? Looking for a squad!", "2026-08-16T22:08:00+03:00"],
    ["My new gaming setup is finally ready!", "2026-08-17T18:37:00+03:00"],
    ["Working on a new web development project. Excited to share it soon!", "2026-08-18T10:14:00+03:00"],
    ["What programming language are you learning right now?", "2026-08-19T20:51:00+03:00"],
    ["Great workout at the park today!", "2026-08-20T07:33:00+03:00"],
    ["Who is joining us for a morning run this weekend?", "2026-08-21T17:46:00+03:00"],
    ["Don't forget to stay hydrated during your workout!", "2026-08-22T11:08:00+03:00"],
    ["One of my favorite views from a recent trip.", "2026-08-23T18:29:00+03:00"],
    ["What is your favorite place to visit in Israel?", "2026-08-24T21:17:00+03:00"],
    ["Sunset photography is always worth the wait.", "2026-08-25T19:42:00+03:00"],
    ["Recommend me a song that everyone should hear at least once.", "2026-08-26T22:03:00+03:00"],
    ["Had an amazing week! Looking forward to the weekend.", "2026-08-27T08:16:00+03:00"],
    ["Trying something new with my photography today.", "2026-08-27T12:41:00+03:00"],
    ["A short clip from today's training session.", "2026-08-27T15:27:00+03:00"]
];

async function run() {
    await connectDB();

    const db = getDB();

    const operations = postTimes.map(([text, timestamp]) => {
        const date = new Date(timestamp);

        return {
            updateOne: {
                filter: { text },
                update: {
                    $set: {
                        createdAt: date,
                        updatedAt: date
                    }
                }
            }
        };
    });

    const result = await db.collection("posts").bulkWrite(operations);

    console.log(`Matched ${result.matchedCount} default posts.`);
    console.log(`Updated ${result.modifiedCount} default posts.`);

    process.exit(0);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
