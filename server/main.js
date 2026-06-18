import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { TasksCollection } from "/imports/db/TasksCollection";
import { CategoriesCollection } from "/imports/db/CategoriesCollection";
import "/imports/api/tasksMethods";
import "/imports/api/tasksPublications";

const BUILT_IN_CATEGORIES = [
  { name: "Work", color: "#2563eb", order: 0 },
  { name: "Personal", color: "#16a34a", order: 1 },
  { name: "Urgent", color: "#dc2626", order: 2 },
];

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
  // Seed built-in categories (global, not user-specific)
  for (const cat of BUILT_IN_CATEGORIES) {
    const existing = await CategoriesCollection.findOneAsync({
      name: cat.name,
      isBuiltIn: true,
    });
    if (!existing) {
      await CategoriesCollection.insertAsync({
        ...cat,
        isBuiltIn: true,
        createdAt: new Date(),
      });
    }
  }

  // Seed demo user
  const existingUser = await Accounts.findUserByUsername(SEED_USERNAME);
  if (!existingUser) {
    await Accounts.createUser({
      username: SEED_USERNAME,
      password: SEED_PASSWORD,
    });
  }

  const user = await Accounts.findUserByUsername(SEED_USERNAME);

  if ((await TasksCollection.find().countAsync()) === 0) {
    const tasks = [
      { text: "Review project proposal", category: "Work" },
      { text: "Buy groceries", category: "Personal" },
      { text: "Fix production bug", category: "Urgent" },
      { text: "Team standup", category: "Work" },
      { text: "Morning run", category: "Personal" },
    ];
    for (const t of tasks) {
      await TasksCollection.insertAsync({
        ...t,
        userId: user._id,
        isChecked: false,
        order: Date.now(),
        createdAt: new Date(),
      });
    }
  }
});
