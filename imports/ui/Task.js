import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { CategoriesCollection } from "../db/CategoriesCollection";

import "./Task.html";

const S_SHOW_TUTORIAL = "showTutorial";
const S_TUTORIAL_STEP = "tutorialStep";

function getMainInstance(inst) {
  try {
    return inst.view.parentView.templateInstance();
  } catch (e) {
    return null;
  }
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
    const cat = CategoriesCollection.findOne({ name: this.category });
    return cat ? cat.color : "#94a3b8";
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
