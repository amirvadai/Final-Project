const { ObjectId } = require("mongodb");
const userModel = require("../models/userModel");

async function list(req, res) {
  try {
    const users = await userModel.getAllUsers();
    res.render("users/list", { users });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

async function profile(req, res) {
  try {
    const user = await userModel.getUserById(req.params.id);
    
    if (!user) {
      return res.status(404).send("User not found");
    }

    res.render("users/profile", { 
        user: user,
        currentUserId: req.session.userId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

//user updates
async function showEditProfileForm(req, res) {
  try {
    const user = await userModel.getUserById(req.session.userId);
    res.render("users/edit", { user });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

async function updateProfile(req, res) {
  try {
    const { displayName, city, interests } = req.body;
    let interestsArray = [];
    if (interests) {
      interestsArray = interests.split(",").map(i => i.trim()).filter(i => i !== "");
    }

    await userModel.updateUser(req.session.userId, {
      displayName: displayName.trim(),
      city: city.trim(),
      interests: interestsArray
    });

    res.redirect(`/users/${req.session.userId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

//Delete user
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
  profile,
  showEditProfileForm,
  updateProfile,
  deleteAccount
};