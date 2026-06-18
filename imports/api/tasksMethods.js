import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { TasksCollection } from "../db/TasksCollection";

Meteor.methods({
  async "tasks.insert"({ text, category }) {
    check(text, String);
    check(category, String);

    if (!this.userId) {
      throw new Meteor.Error("Not authorized.");
    }

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

    await TasksCollection.updateAsync(taskId, {
      $set: {
        order: newOrder,
      },
    });
    const updatedTask = await TasksCollection.findOneAsync(taskId);

    console.log("UPDATED TASK:", updatedTask);
  },

  async "tasks.remove"(taskId) {
    check(taskId, String);

    if (!this.userId) {
      throw new Meteor.Error("Not authorized.");
    }

    const task = await TasksCollection.findOneAsync({
      _id: taskId,
      userId: this.userId,
    });

    if (!task) {
      throw new Meteor.Error("Access denied.");
    }

    await TasksCollection.removeAsync(taskId);
  },

  async "tasks.setIsChecked"(taskId, isChecked) {
    check(taskId, String);
    check(isChecked, Boolean);

    if (!this.userId) {
      throw new Meteor.Error("Not authorized.");
    }

    const task = await TasksCollection.findOneAsync({
      _id: taskId,
      userId: this.userId,
    });

    if (!task) {
      throw new Meteor.Error("Access denied.");
    }

    await TasksCollection.updateAsync(taskId, {
      $set: {
        isChecked,
      },
    });
  },
});
