const bcrypt = require("bcrypt");

const userModel = require("../models/userModel");

async function login(req, res) {
    const { username, password } = req.body;

    const user = await userModel.getUserByUsername(username);

    if (!user) {
        return res.status(401).send("Invalid username or password");
    }

    const passwordCorrect = await bcrypt.compare(
        password,
        user.passwordHash
    );

    if (!passwordCorrect) {
        return res.status(401).send("Invalid username or password");
    }

    req.session.userId = user._id.toString();

    res.redirect("/");
}

module.exports = {
    login
};