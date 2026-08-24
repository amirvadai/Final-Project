const { ObjectId } = require("mongodb");
const postModel = require("../models/postModel");


//see posts

async function feed(req, res) {
    try {
        const posts = await postModel.getPosts();

        res.render("feed/index", {
            posts,
            userId: req.session.userId
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

//create posts

function showCreateForm(req, res) {
    res.render("posts/create");
}


async function create(req, res) {
    try {
        const { text } = req.body;
        const file = req.file;

        if (!text || text.trim() === "") {
            return res.status(400).send("Post cannot be empty");
        }

        let type = "text";
        let mediaUrl = null;

        if (file) {
            mediaUrl = "/uploads/" + file.filename;

            if (file.mimetype.startsWith("image/")) {
                type = "image";
            } else if (file.mimetype.startsWith("video/")) {
                type = "video";
            }
        }

        await postModel.createPost({
            author: new ObjectId(req.session.userId),
            type,
            text: text.trim(),
            mediaUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.redirect("/");

    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}


//Delete posts

async function remove(req, res) {
    try {
        const post = await postModel.getPostById(req.params.id);
        if (!post) {
            return res.status(404).send("Post not found");
        }
        if (post.author.toString() !== req.session.userId) {
            return res.status(403).send("Not allowed");
        }

        await postModel.deletePost(req.params.id);
        res.redirect("/");

    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
}

//Update posts

async function showEditForm(req, res) {
  try {
    const post = await postModel.getPostById(req.params.id);
    
    if (!post) {
      return res.status(404).send("Post not found");
    }
    
    if (post.author.toString() !== req.session.userId) {
      return res.status(403).send("Not allowed to edit this post");
    }
    
    res.render("posts/edit", { post: post });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}


async function update(req, res) {
  try {
    const post = await postModel.getPostById(req.params.id);
    
    if (!post) {
      return res.status(404).send("Post not found");
    }
    
    if (post.author.toString() !== req.session.userId) {
      return res.status(403).send("Not allowed to edit this post");
    }

    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).send("Post cannot be empty");
    }

    await postModel.updatePost(req.params.id, {
      text: text.trim()
    });

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}
//

module.exports = {
    feed,
    showCreateForm,
    create,
    remove,
    showEditForm,
    update
};