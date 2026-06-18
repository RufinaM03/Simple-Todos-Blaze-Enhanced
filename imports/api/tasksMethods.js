import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { TasksCollection } from "../db/TasksCollection";
import { CategoriesCollection } from "../db/CategoriesCollection";

// ─── Task Methods ─────────────────────────────────────────────────────────────
Meteor.methods({
  async "tasks.insert"({ text, category }) {
    check(text, String);
    check(category, String);

    if (!this.userId) throw new Meteor.Error("Not authorized.");

    await TasksCollection.insertAsync({
      text,
      category,
      userId: this.userId,
      isChecked: false,
      createdAt: new Date(),
      order: Date.now(),
    });
  },

  async "tasks.reorder"(taskId, newOrder) {
    check(taskId, String);
    check(newOrder, Number);

    await TasksCollection.updateAsync(taskId, { $set: { order: newOrder } });
  },

  async "tasks.remove"(taskId) {
    check(taskId, String);
    if (!this.userId) throw new Meteor.Error("Not authorized.");

    const task = await TasksCollection.findOneAsync({
      _id: taskId,
      userId: this.userId,
    });
    if (!task) throw new Meteor.Error("Access denied.");

    await TasksCollection.removeAsync(taskId);
  },

  async "tasks.setIsChecked"(taskId, isChecked) {
    check(taskId, String);
    check(isChecked, Boolean);
    if (!this.userId) throw new Meteor.Error("Not authorized.");

    const task = await TasksCollection.findOneAsync({
      _id: taskId,
      userId: this.userId,
    });
    if (!task) throw new Meteor.Error("Access denied.");

    await TasksCollection.updateAsync(taskId, { $set: { isChecked } });
  },

  async "tasks.moveCategoryToUncategorized"(oldName) {
    check(oldName, String);
    if (!this.userId) throw new Meteor.Error("Not authorized.");
    await TasksCollection.updateAsync(
      { userId: this.userId, category: oldName },
      { $set: { category: "Uncategorized" } },
      { multi: true },
    );
  },
});

// ─── Category Methods ─────────────────────────────────────────────────────────
Meteor.methods({
  async "categories.insert"({ name, color }) {
    check(name, String);
    check(color, String);
    if (!this.userId) throw new Meteor.Error("Not authorized.");

    const exists = await CategoriesCollection.findOneAsync({
      name,
      userId: this.userId,
    });
    if (exists) throw new Meteor.Error("Category already exists.");

    await CategoriesCollection.insertAsync({
      name,
      color,
      userId: this.userId,
      isBuiltIn: false,
      order: Date.now(),
      createdAt: new Date(),
    });
  },

  async "categories.update"(categoryId, { name, color }) {
    check(categoryId, String);
    check(name, String);
    check(color, String);
    if (!this.userId) throw new Meteor.Error("Not authorized.");

    const cat = await CategoriesCollection.findOneAsync({
      _id: categoryId,
      userId: this.userId,
    });
    if (!cat) throw new Meteor.Error("Not found.");
    if (cat.isBuiltIn) throw new Meteor.Error("Cannot edit built-in category.");

    const oldName = cat.name;
    await CategoriesCollection.updateAsync(categoryId, {
      $set: { name, color },
    });

    // Rename tasks that used old category name
    if (oldName !== name) {
      await TasksCollection.updateAsync(
        { userId: this.userId, category: oldName },
        { $set: { category: name } },
        { multi: true },
      );
    }
  },

  async "categories.remove"(categoryId) {
    check(categoryId, String);
    if (!this.userId) throw new Meteor.Error("Not authorized.");

    const cat = await CategoriesCollection.findOneAsync({
      _id: categoryId,
      userId: this.userId,
    });
    if (!cat) throw new Meteor.Error("Not found.");
    if (cat.isBuiltIn)
      throw new Meteor.Error("Cannot delete built-in category.");

    // Move tasks to Uncategorized
    await TasksCollection.updateAsync(
      { userId: this.userId, category: cat.name },
      { $set: { category: "Uncategorized" } },
      { multi: true },
    );

    await CategoriesCollection.removeAsync(categoryId);
  },
});
