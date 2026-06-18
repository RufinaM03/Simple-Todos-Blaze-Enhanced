import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { CategoriesCollection } from "../db/CategoriesCollection";

import "./Task.html";

const S_SHOW_TUTORIAL = "showTutorial";
const S_TUTORIAL_STEP = "tutorialStep";

function getMainInstance(inst) {
  let view = inst?.view;
  while (view) {
    const templateInst =
      typeof view.templateInstance === "function"
        ? view.templateInstance()
        : null;
    if (templateInst && templateInst.state) return templateInst;
    view = view.parentView;
  }

  return null;
}

function getReadableTextColor(hexColor) {
  const hex = (hexColor || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 155 ? "#0f172a" : "#ffffff";
}

function getCategoryColor(category) {
  const cat = CategoriesCollection.findOne({ name: category });
  return cat ? cat.color : "#94a3b8";
}

Template.task.helpers({
  isTutorialStep(n) {
    const main = getMainInstance(Template.instance());
    if (!main || !main.state) return false;
    return (
      main.state.get(S_SHOW_TUTORIAL) && main.state.get(S_TUTORIAL_STEP) === n
    );
  },

  categoryColor() {
    return getCategoryColor(this.category);
  },

  categoryTextColor() {
    return getReadableTextColor(getCategoryColor(this.category));
  },

  isCustomCategory() {
    const cat = CategoriesCollection.findOne({ name: this.category });
    return cat && !cat.isBuiltIn;
  },
});

Template.task.events({
  "click .toggle-checked"() {
    Meteor.call("tasks.setIsChecked", this._id, !this.isChecked);
  },
  "click .delete"() {
    Meteor.call("tasks.remove", this._id);
  },
});
