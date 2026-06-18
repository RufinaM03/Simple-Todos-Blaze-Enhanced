import { Meteor } from "meteor/meteor";
import { TasksCollection } from "/imports/db/TasksCollection";
import { CategoriesCollection } from "/imports/db/CategoriesCollection";

Meteor.publish("tasks", function publishTasks() {
  return TasksCollection.find({ userId: this.userId });
});

Meteor.publish("categories", function publishCategories() {
  if (!this.userId) return this.ready();
  return CategoriesCollection.find({
    $or: [{ userId: this.userId }, { isBuiltIn: true }],
  });
});
