import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { TasksCollection } from "../db/TasksCollection";
import { CategoriesCollection } from "../db/CategoriesCollection";

// ─── Task Methods ─────────────────────────────────────────────────────────────
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

const assertHexColor = (color) => {
  if (!HEX_COLOR_REGEX.test(color)) {
    throw new Meteor.Error("Invalid category color.");
  }
};

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
    if (!this.userId) throw new Meteor.Error("Not authorized.");

    const updated = await TasksCollection.updateAsync(
      { _id: taskId, userId: this.userId },
      { $set: { order: newOrder } },
    );
    if (!updated) throw new Meteor.Error("Access denied.");
  },

  async "tasks.reorderMany"(orderedTaskIds) {
    check(orderedTaskIds, [String]);
    if (!this.userId) throw new Meteor.Error("Not authorized.");

    const uniqueTaskIds = [...new Set(orderedTaskIds)];
    if (uniqueTaskIds.length !== orderedTaskIds.length) {
      throw new Meteor.Error("Invalid task order.");
    }

    const ownedTasks = await TasksCollection.find(
      { _id: { $in: orderedTaskIds }, userId: this.userId },
      { fields: { _id: 1, order: 1 } },
    ).fetchAsync();

    if (ownedTasks.length !== orderedTaskIds.length) {
      throw new Meteor.Error("Access denied.");
    }

    const existingOrders = ownedTasks
      .map((task) => task.order)
      .filter((order) => typeof order === "number")
      .sort((a, b) => a - b);
    const firstOrder = existingOrders.length ? existingOrders[0] : 0;

    await Promise.all(
      orderedTaskIds.map((taskId, index) =>
        TasksCollection.updateAsync(
          { _id: taskId, userId: this.userId },
          { $set: { order: firstOrder + index * 1000 } },
        ),
      ),
    );
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
    assertHexColor(color);

    const cleanName = name.trim();
    if (!cleanName) throw new Meteor.Error("Category name is required.");

    const exists = await CategoriesCollection.findOneAsync({
      name: cleanName,
      $or: [{ userId: this.userId }, { isBuiltIn: true }],
    });
    if (exists) throw new Meteor.Error("Category already exists.");

    return await CategoriesCollection.insertAsync({
      name: cleanName,
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
    assertHexColor(color);

    const cleanName = name.trim();
    if (!cleanName) throw new Meteor.Error("Category name is required.");

    const cat = await CategoriesCollection.findOneAsync({
      _id: categoryId,
      userId: this.userId,
    });
    if (!cat) throw new Meteor.Error("Not found.");
    if (cat.isBuiltIn) throw new Meteor.Error("Cannot edit built-in category.");

    const duplicate = await CategoriesCollection.findOneAsync({
      _id: { $ne: categoryId },
      name: cleanName,
      $or: [{ userId: this.userId }, { isBuiltIn: true }],
    });
    if (duplicate) throw new Meteor.Error("Category already exists.");

    const oldName = cat.name;
    await CategoriesCollection.updateAsync(categoryId, {
      $set: { name: cleanName, color },
    });

    // Rename tasks that used old category name
    if (oldName !== cleanName) {
      await TasksCollection.updateAsync(
        { userId: this.userId, category: oldName },
        { $set: { category: cleanName } },
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
