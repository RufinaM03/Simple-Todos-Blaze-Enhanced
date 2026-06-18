import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";

import "./Task.html";

Template.task.helpers({
  isTutorialStep(stepNumber) {
    const mainInstance = Template.instance().view.parentView.templateInstance();

    if (!mainInstance || !mainInstance.state) {
      return false;
    }

    return (
      mainInstance.state.get("showTutorial") &&
      mainInstance.state.get("tutorialStep") === stepNumber
    );
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
