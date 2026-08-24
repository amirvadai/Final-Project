const userModel = require("../models/userModel");

async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const user = await userModel.getUserById(req.session.userId);
    if (!user) {
        req.session.destroy();
        return res.redirect("/login");
    }
    res.locals.currentUser = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

module.exports = requireAuth;