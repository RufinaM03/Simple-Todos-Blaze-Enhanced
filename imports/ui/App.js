import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { TasksCollection } from "../db/TasksCollection";
import { Tracker } from "meteor/tracker";
import { ReactiveDict } from "meteor/reactive-dict";
import Sortable from "sortablejs";

import "./App.html";
import "./Task.js";
import "./Login.js";

const HIDE_COMPLETED_STRING = "hideCompleted";
const IS_LOADING_STRING = "isLoading";
const TUTORIAL_STEP_STRING = "tutorialStep";
const SHOW_TUTORIAL_STRING = "showTutorial";

const getUser = () => Meteor.user();
const isUserLogged = () => !!getUser();

const tutorialSteps = [
  {
    title: "Create your tasks",
    text: "Type a task, choose a category, and click Add Task to create it.",
  },
  {
    title: "Organize by category",
    text: "Use Work, Personal, and Urgent categories to keep your list structured.",
  },
  {
    title: "Reorder like a playlist",
    text: "Drag the handle on each task to reorder your list smoothly.",
  },
  {
    title: "Mark tasks complete",
    text: "Use the completion button to mark finished tasks and keep track of progress.",
  },
];

const getTasksFilter = () => {
  const user = getUser();

  const hideCompletedFilter = { isChecked: { $ne: true } };
  const userFilter = user ? { userId: user._id } : {};
  const pendingOnlyFilter = { ...hideCompletedFilter, ...userFilter };

  return { userFilter, pendingOnlyFilter };
};

Template.mainContainer.onCreated(function mainContainerOnCreated() {
  this.state = new ReactiveDict();

  this.state.set(HIDE_COMPLETED_STRING, false);
  this.state.set(IS_LOADING_STRING, true);
  this.state.set(TUTORIAL_STEP_STRING, 0);

  const hasSeenTutorial = localStorage.getItem("taskflowTutorialSeen");

  this.state.set(SHOW_TUTORIAL_STRING, !hasSeenTutorial);

  const handler = Meteor.subscribe("tasks");

  Tracker.autorun(() => {
    this.state.set(IS_LOADING_STRING, !handler.ready());
  });
});

Template.mainContainer.events({
  "click #hide-completed-button"(event, instance) {
    const currentHideCompleted = instance.state.get(HIDE_COMPLETED_STRING);
    instance.state.set(HIDE_COMPLETED_STRING, !currentHideCompleted);
  },

  "click .user"() {
    Meteor.logout();
  },

  "click .next-tutorial"(event, instance) {
    const currentStep = instance.state.get(TUTORIAL_STEP_STRING);

    if (currentStep >= tutorialSteps.length - 1) {
      instance.state.set(SHOW_TUTORIAL_STRING, false);
      localStorage.setItem("taskflowTutorialSeen", "true");
      return;
    }

    instance.state.set(TUTORIAL_STEP_STRING, currentStep + 1);
  },

  "click .skip-tutorial"(event, instance) {
    instance.state.set(SHOW_TUTORIAL_STRING, false);
    localStorage.setItem("taskflowTutorialSeen", "true");
  },
});

Template.mainContainer.helpers({
  tasks() {
    const instance = Template.instance();
    const hideCompleted = instance.state.get(HIDE_COMPLETED_STRING);

    const { pendingOnlyFilter, userFilter } = getTasksFilter();

    if (!isUserLogged()) {
      return [];
    }

    return TasksCollection.find(
      hideCompleted ? pendingOnlyFilter : userFilter,
      {
        sort: {
          order: 1,
        },
      },
    ).fetch();
  },

  hideCompleted() {
    return Template.instance().state.get(HIDE_COMPLETED_STRING);
  },

  remainingTasksText() {
    if (!isUserLogged()) {
      return "Plan, organize, and complete your tasks.";
    }

    const { pendingOnlyFilter } = getTasksFilter();
    const count = TasksCollection.find(pendingOnlyFilter).count();

    if (count === 0) {
      return "All tasks completed. Great work!";
    }

    if (count === 1) {
      return "1 active task remaining";
    }

    return `${count} active tasks remaining`;
  },

  isUserLogged() {
    return isUserLogged();
  },

  getUser() {
    return getUser();
  },

  isLoading() {
    return Template.instance().state.get(IS_LOADING_STRING);
  },

  showTutorial() {
    return Template.instance().state.get(SHOW_TUTORIAL_STRING);
  },

  tutorialStep() {
    return Template.instance().state.get(TUTORIAL_STEP_STRING);
  },

  tutorialTitle() {
    const step = Template.instance().state.get(TUTORIAL_STEP_STRING);
    return tutorialSteps[step].title;
  },

  tutorialText() {
    const step = Template.instance().state.get(TUTORIAL_STEP_STRING);
    return tutorialSteps[step].text;
  },

  isLastTutorialStep() {
    const step = Template.instance().state.get(TUTORIAL_STEP_STRING);
    return step === tutorialSteps.length - 1;
  },

  isTutorialStep(stepNumber) {
    const instance = Template.instance();
    return (
      instance.state.get(SHOW_TUTORIAL_STRING) &&
      instance.state.get(TUTORIAL_STEP_STRING) === stepNumber
    );
  },
});

Template.form.events({
  "submit .task-form"(event) {
    event.preventDefault();

    const { target } = event;
    const text = target.text.value.trim();
    const category = target.category.value;

    if (!text) {
      return;
    }

    Meteor.call("tasks.insert", {
      text,
      category,
    });

    target.text.value = "";
    target.category.value = "Work";
  },
});

Template.mainContainer.onRendered(function () {
  this.autorun(() => {
    if (!Meteor.user()) return;

    Meteor.defer(() => {
      const list = document.querySelector(".tasks");

      if (!list || list.sortableInitialized) {
        return;
      }

      Sortable.create(list, {
        animation: 250,
        handle: ".drag-handle",
        forceFallback: true,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
      });

      list.sortableInitialized = true;
    });
  });
});
