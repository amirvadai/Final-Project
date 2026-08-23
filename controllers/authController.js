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


async function login(req, res) {
    const { username, password } = req.body;

    const user =
        await userModel.getUserByUsername(username);

    if (!user) {
        return res.status(401).send("Invalid username or password");
    }

    const passwordCorrect =
        await bcrypt.compare(password, user.passwordHash);

    if (!passwordCorrect) {
        return res.status(401).send("Invalid username or password");
    }

    req.session.userId = user._id.toString();

    res.redirect("/");
}


function logout(req, res) {
    req.session.destroy(() => {
        res.redirect("/login");
    });
}


module.exports = {
    register,
    login,
    logout
};