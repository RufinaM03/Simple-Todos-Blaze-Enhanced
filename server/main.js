import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { TasksCollection } from "/imports/db/TasksCollection";
import "/imports/api/tasksMethods";
import "/imports/api/tasksPublications";

const insertTask = async (taskText, user) =>
  await TasksCollection.insertAsync({
    text: taskText,

    category: "Work",

    userId: user._id,

    isChecked: false,

    order: Date.now(),

    createdAt: new Date(),
  });

const SEED_USERNAME = "meteorite";
const SEED_PASSWORD = "password";

Meteor.startup(async () => {
  console.log("SERVER STARTED");

  const existingUser = await Accounts.findUserByUsername(SEED_USERNAME);

  console.log("Existing User:", existingUser);

  if (!existingUser) {
    console.log("Creating seed user...");

    await Accounts.createUser({
      username: SEED_USERNAME,
      password: SEED_PASSWORD,
    });

    console.log("User created");
  }

  const user = await Accounts.findUserByUsername(SEED_USERNAME);

  console.log("Final User:", user);

  if ((await TasksCollection.find().countAsync()) === 0) {
    [
      "First Task",
      "Second Task",
      "Third Task",
      "Fourth Task",
      "Fifth Task",
      "Sixth Task",
      "Seventh Task",
    ].forEach((taskText) => insertTask(taskText, user));
  }
});
