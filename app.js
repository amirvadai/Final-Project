require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");

const { connectDB } = require("./config/database");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = 3000;


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


// Session
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false
    })
);


// Routes
app.use("/", authRoutes);


const requireAuth = require("./middleware/requireAuth");

app.get("/", requireAuth, (req, res) => {
    res.render("feed/index");
});


// Start server
async function startServer() {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();