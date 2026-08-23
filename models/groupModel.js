const { ObjectId } = require("mongodb");
const { getDB } = require("../config/database");

function groupsCollection() {
    return getDB().collection("groups");
}

async function createGroup(groupData) {
    const group = {
        name: groupData.name,
        description: groupData.description,
        category: groupData.category,

        manager: new ObjectId(groupData.manager),

        members: [
            new ObjectId(groupData.manager)
        ],

        location: {
            address: groupData.location.address,
            city: groupData.location.city,
            latitude: groupData.location.latitude,
            longitude: groupData.location.longitude
        },

        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await groupsCollection().insertOne(group);

    return {
        ...group,
        _id: result.insertedId
    };
}

async function getGroupById(id) {
    return groupsCollection().findOne({
        _id: new ObjectId(id)
    });
}

async function getAllGroups() {
    return groupsCollection()
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
}

module.exports = {
    createGroup,
    getGroupById,
    getAllGroups
};