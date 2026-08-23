const bcrypt = require("bcrypt");

const userModel = require("../models/userModel");

async function register(req, res) {
    const {
        username,
        password,
        displayName,
        city
    } = req.body;

    const existingUser =
        await userModel.getUserByUsername(username);

    if (existingUser) {
        return res.status(400).send("Username already exists");
    }

    const passwordHash =
        await bcrypt.hash(password, 10);

    const user = await userModel.createUser({
        username,
        passwordHash,
        displayName,
        city
    });

    req.session.userId = user._id.toString();

    res.redirect("/");
}

module.exports = {
    register
};