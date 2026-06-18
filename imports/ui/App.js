import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { TasksCollection } from "../db/TasksCollection";
import { CategoriesCollection } from "../db/CategoriesCollection";
import { Tracker } from "meteor/tracker";
import { ReactiveDict } from "meteor/reactive-dict";
import { ReactiveVar } from "meteor/reactive-var";
import Sortable from "sortablejs";

import "./App.html";
import "./Task.js";
import "./Login.js";

// ─── State keys ───────────────────────────────────────────────────────────────
const S = {
  HIDE_COMPLETED: "hideCompleted",
  IS_LOADING: "isLoading",
  TUTORIAL_STEP: "tutorialStep",
  SHOW_TUTORIAL: "showTutorial",
  ACTIVE_CATEGORY: "activeCategory",
  VIEW_MODE: "viewMode", // "list" | "grid"
  SEARCH: "search",
  SHOW_CAT_MODAL: "showCategoryModal",
  EDITING_CAT_ID: "editingCategoryId",
  SELECTED_COLOR: "selectedColor",
  DARK_MODE: "darkMode",
};

const DEFAULT_COLORS = [
  { label: "Purple", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Pink", value: "#db2777" },
  { label: "Teal", value: "#0d9488" },
  { label: "Yellow", value: "#ca8a04" },
];

const BUILT_IN_CATEGORIES = [
  { name: "Work", color: "#2563eb" },
  { name: "Personal", color: "#16a34a" },
  { name: "Urgent", color: "#dc2626" },
];

const tutorialSteps = [
  {
    title: "Add a task",
    text: "Type a task in the input field, pick a category, and click Add Task.",
    target: "step-0",
  },
  {
    title: "Pick a category",
    text: "Choose Work, Personal, Urgent — or any custom category you create.",
    target: "step-1",
  },
  {
    title: "Create new categories",
    text: "Click '＋ Category' to open the category builder and add your own.",
    target: "step-2",
  },
  {
    title: "Filter by category",
    text: "Use the category bar to filter tasks by type. Combine with Hide Done.",
    target: "step-3",
  },
  {
    title: "Drag to reorder",
    text: "Grab the dot handle on the left of any task and drag it to reorder.",
    target: "step-4",
  },
  {
    title: "Mark tasks done",
    text: "Click the Done button on a task to mark it complete. Click ✓ to undo.",
    target: "step-5",
  },
  {
    title: "List or Grid view",
    text: "Switch between a compact list and a card grid using the icons top-right.",
    target: "step-6",
  },
  {
    title: "Dark mode",
    text: "Click the moon icon in the header to switch between light and dark themes.",
    target: "step-7",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getUser = () => Meteor.user();
const isUserLogged = () => !!getUser();

const getTasksFilter = () => {
  const user = getUser();
  const hideFilter = { isChecked: { $ne: true } };
  const userFilter = user ? { userId: user._id } : {};
  const pendingOnly = { ...hideFilter, ...userFilter };
  return { userFilter, pendingOnly };
};

// ─── Template: mainContainer ──────────────────────────────────────────────────
Template.mainContainer.onCreated(function () {
  this.state = new ReactiveDict();

  // Restore persisted settings
  const savedView = localStorage.getItem("taskflowViewMode") || "list";
  const savedDark = localStorage.getItem("taskflowDarkMode") === "true";
  const seenTutorial = localStorage.getItem("taskflowTutorialSeen");

  this.state.set(S.HIDE_COMPLETED, false);
  this.state.set(S.IS_LOADING, true);
  this.state.set(S.TUTORIAL_STEP, 0);
  this.state.set(S.SHOW_TUTORIAL, !seenTutorial);
  this.state.set(S.ACTIVE_CATEGORY, "all");
  this.state.set(S.VIEW_MODE, savedView);
  this.state.set(S.SEARCH, "");
  this.state.set(S.SHOW_CAT_MODAL, false);
  this.state.set(S.EDITING_CAT_ID, null);
  this.state.set(S.SELECTED_COLOR, DEFAULT_COLORS[0].value);
  this.state.set(S.DARK_MODE, savedDark);

  // Subscribe
  const tasksHandler = Meteor.subscribe("tasks");
  Meteor.subscribe("categories");

  Tracker.autorun(() => {
    this.state.set(S.IS_LOADING, !tasksHandler.ready());
  });

  // Apply dark mode class to <body>
  Tracker.autorun(() => {
    if (this.state.get(S.DARK_MODE)) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  });
});

Template.mainContainer.onRendered(function () {
  this._sortable = null;

  this.autorun(() => {
    if (!Meteor.user()) return;
    const viewMode = this.state.get(S.VIEW_MODE);

    Meteor.defer(() => {
      const list = document.querySelector(".tasks");
      if (!list) return;

      if (this._sortable) {
        this._sortable.destroy();
        this._sortable = null;
      }

      this._sortable = Sortable.create(list, {
        animation: 250,
        handle: ".drag-handle",
        forceFallback: true,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        onEnd(evt) {
          const items = list.querySelectorAll(".task-item");
          items.forEach((el, idx) => {
            const id = el.dataset.id;
            if (id) Meteor.call("tasks.reorder", id, idx * 10);
          });
        },
      });
    });
  });
});

Template.mainContainer.onDestroyed(function () {
  if (this._sortable) this._sortable.destroy();
});

// ─── Events ───────────────────────────────────────────────────────────────────
Template.mainContainer.events({
  "click #hide-completed-button"(e, inst) {
    inst.state.set(S.HIDE_COMPLETED, !inst.state.get(S.HIDE_COMPLETED));
  },

  "click .user"() {
    Meteor.logout();
  },

  // Tutorial
  "click .next-tutorial"(e, inst) {
    const step = inst.state.get(S.TUTORIAL_STEP);
    if (step >= tutorialSteps.length - 1) {
      inst.state.set(S.SHOW_TUTORIAL, false);
      localStorage.setItem("taskflowTutorialSeen", "true");
    } else {
      inst.state.set(S.TUTORIAL_STEP, step + 1);
    }
  },
  "click .skip-tutorial"(e, inst) {
    inst.state.set(S.SHOW_TUTORIAL, false);
    localStorage.setItem("taskflowTutorialSeen", "true");
  },

  // Category filter
  "click .filter-btn"(e, inst) {
    inst.state.set(S.ACTIVE_CATEGORY, e.currentTarget.dataset.category);
  },

  // View toggle
  "click #list-view-btn"(e, inst) {
    inst.state.set(S.VIEW_MODE, "list");
    localStorage.setItem("taskflowViewMode", "list");
  },
  "click #grid-view-btn"(e, inst) {
    inst.state.set(S.VIEW_MODE, "grid");
    localStorage.setItem("taskflowViewMode", "grid");
  },

  // Search
  "input #task-search"(e, inst) {
    inst.state.set(S.SEARCH, e.target.value);
  },
  "click .search-clear"(e, inst) {
    inst.state.set(S.SEARCH, "");
    document.getElementById("task-search").value = "";
  },

  // Category modal open
  "click #open-category-modal"(e, inst) {
    inst.state.set(S.EDITING_CAT_ID, null);
    inst.state.set(S.SELECTED_COLOR, DEFAULT_COLORS[0].value);
    inst.state.set(S.SHOW_CAT_MODAL, true);
  },
  "click .modal-close, click .modal-cancel"(e, inst) {
    inst.state.set(S.SHOW_CAT_MODAL, false);
    inst.state.set(S.EDITING_CAT_ID, null);
  },
  "click .modal-backdrop"(e, inst) {
    if (e.target === e.currentTarget) {
      inst.state.set(S.SHOW_CAT_MODAL, false);
      inst.state.set(S.EDITING_CAT_ID, null);
    }
  },

  // Color swatch
  "click .swatch"(e, inst) {
    inst.state.set(S.SELECTED_COLOR, e.currentTarget.dataset.color);
  },

  // Create category
  "click .create-category-btn"(e, inst) {
    const name = document.getElementById("category-name-input").value.trim();
    const color = inst.state.get(S.SELECTED_COLOR);
    if (!name) return;
    Meteor.call("categories.insert", { name, color }, (err) => {
      if (!err) inst.state.set(S.SHOW_CAT_MODAL, false);
    });
  },

  // Save (edit) category
  "click .save-category-btn"(e, inst) {
    const id = inst.state.get(S.EDITING_CAT_ID);
    const name = document.getElementById("category-name-input").value.trim();
    const color = inst.state.get(S.SELECTED_COLOR);
    if (!name || !id) return;
    Meteor.call("categories.update", id, { name, color }, (err) => {
      if (!err) inst.state.set(S.SHOW_CAT_MODAL, false);
    });
  },

  // Delete category
  "click .delete-category-btn"(e, inst) {
    const id = inst.state.get(S.EDITING_CAT_ID);
    if (!id) return;
    if (confirm("Delete this category? Tasks will move to Uncategorized.")) {
      Meteor.call("categories.remove", id, () => {
        inst.state.set(S.SHOW_CAT_MODAL, false);
        inst.state.set(S.ACTIVE_CATEGORY, "all");
      });
    }
  },

  // Edit category via badge click (delegated from tasks area)
  "click .edit-category-badge"(e, inst) {
    const catName = e.currentTarget.dataset.category;
    const cat = CategoriesCollection.findOne({
      name: catName,
      isBuiltIn: { $ne: true },
    });
    if (!cat) return;
    inst.state.set(S.EDITING_CAT_ID, cat._id);
    inst.state.set(S.SELECTED_COLOR, cat.color);
    inst.state.set(S.SHOW_CAT_MODAL, true);
  },

  // Dark mode
  "click .theme-toggle"(e, inst) {
    const dark = !inst.state.get(S.DARK_MODE);
    inst.state.set(S.DARK_MODE, dark);
    localStorage.setItem("taskflowDarkMode", String(dark));
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
Template.mainContainer.helpers({
  tasks() {
    const inst = Template.instance();
    const hideComp = inst.state.get(S.HIDE_COMPLETED);
    const activeCat = inst.state.get(S.ACTIVE_CATEGORY);
    const search = (inst.state.get(S.SEARCH) || "").toLowerCase();
    const { pendingOnly, userFilter } = getTasksFilter();

    if (!isUserLogged()) return [];

    let filter = hideComp ? pendingOnly : userFilter;
    if (activeCat && activeCat !== "all") {
      filter = { ...filter, category: activeCat };
    }

    let tasks = TasksCollection.find(filter, { sort: { order: 1 } }).fetch();

    if (search) {
      tasks = tasks.filter((t) => t.text.toLowerCase().includes(search));
    }

    return tasks;
  },

  hasNoTasks() {
    const inst = Template.instance();
    const hideComp = inst.state.get(S.HIDE_COMPLETED);
    const activeCat = inst.state.get(S.ACTIVE_CATEGORY);
    const search = (inst.state.get(S.SEARCH) || "").toLowerCase();
    const { pendingOnly, userFilter } = getTasksFilter();
    if (!isUserLogged()) return false;
    let filter = hideComp ? pendingOnly : userFilter;
    if (activeCat && activeCat !== "all")
      filter = { ...filter, category: activeCat };
    let tasks = TasksCollection.find(filter).fetch();
    if (search)
      tasks = tasks.filter((t) => t.text.toLowerCase().includes(search));
    return tasks.length === 0;
  },

  emptyStateTitle() {
    const inst = Template.instance();
    if (inst.state.get(S.SEARCH)) return "No matching tasks";
    if (inst.state.get(S.ACTIVE_CATEGORY) !== "all")
      return "No tasks in this category";
    if (inst.state.get(S.HIDE_COMPLETED)) return "All caught up!";
    return "Your task list is empty";
  },

  emptyStateText() {
    const inst = Template.instance();
    if (inst.state.get(S.SEARCH)) return "Try a different search term.";
    if (inst.state.get(S.HIDE_COMPLETED))
      return "No pending tasks. Great work! 🎉";
    return "Add your first task above to get started.";
  },

  allCategories() {
    return CategoriesCollection.find({}, { sort: { order: 1 } }).fetch();
  },

  isActiveCategory(name) {
    return Template.instance().state.get(S.ACTIVE_CATEGORY) === name;
  },

  hideCompleted() {
    return Template.instance().state.get(S.HIDE_COMPLETED);
  },
  isLoading() {
    return Template.instance().state.get(S.IS_LOADING);
  },
  showTutorial() {
    return Template.instance().state.get(S.SHOW_TUTORIAL);
  },
  showCategoryModal() {
    return Template.instance().state.get(S.SHOW_CAT_MODAL);
  },
  isUserLogged() {
    return isUserLogged();
  },
  getUser() {
    return getUser();
  },
  isDarkMode() {
    return Template.instance().state.get(S.DARK_MODE);
  },

  theme() {
    return Template.instance().state.get(S.DARK_MODE) ? "dark" : "light";
  },

  viewClass() {
    return Template.instance().state.get(S.VIEW_MODE) === "grid"
      ? "tasks-grid"
      : "tasks-list";
  },
  isListView() {
    return Template.instance().state.get(S.VIEW_MODE) === "list";
  },
  isGridView() {
    return Template.instance().state.get(S.VIEW_MODE) === "grid";
  },

  searchQuery() {
    return Template.instance().state.get(S.SEARCH);
  },

  remainingTasksText() {
    if (!isUserLogged()) return "Plan, organize, and complete your tasks.";
    const { pendingOnly } = getTasksFilter();
    const count = TasksCollection.find(pendingOnly).count();
    if (count === 0) return "All tasks completed. Great work!";
    return count === 1
      ? "1 active task remaining"
      : `${count} active tasks remaining`;
  },

  tutorialStep() {
    return Template.instance().state.get(S.TUTORIAL_STEP);
  },
  tutorialStepNum() {
    return Template.instance().state.get(S.TUTORIAL_STEP) + 1;
  },
  tutorialTotalSteps() {
    return tutorialSteps.length;
  },

  tutorialTitle() {
    const s = Template.instance().state.get(S.TUTORIAL_STEP);
    return tutorialSteps[s].title;
  },
  tutorialText() {
    const s = Template.instance().state.get(S.TUTORIAL_STEP);
    return tutorialSteps[s].text;
  },
  isLastTutorialStep() {
    return (
      Template.instance().state.get(S.TUTORIAL_STEP) ===
      tutorialSteps.length - 1
    );
  },

  isTutorialStep(n) {
    const inst = Template.instance();
    return (
      inst.state.get(S.SHOW_TUTORIAL) && inst.state.get(S.TUTORIAL_STEP) === n
    );
  },

  // Modal helpers
  editingCategory() {
    const id = Template.instance().state.get(S.EDITING_CAT_ID);
    return id ? CategoriesCollection.findOne(id) : null;
  },
  editingCategoryName() {
    const id = Template.instance().state.get(S.EDITING_CAT_ID);
    if (!id) return "";
    const cat = CategoriesCollection.findOne(id);
    return cat ? cat.name : "";
  },
  colorOptions() {
    return DEFAULT_COLORS;
  },
  isSelectedColor(val) {
    return Template.instance().state.get(S.SELECTED_COLOR) === val;
  },
});

// ─── Template: form ───────────────────────────────────────────────────────────
Template.form.helpers({
  allCategories() {
    return CategoriesCollection.find({}, { sort: { order: 1 } }).fetch();
  },
  isTutorialStep(n) {
    const main = Template.instance().view.parentView.templateInstance();
    if (!main || !main.state) return false;
    return (
      main.state.get(S.SHOW_TUTORIAL) && main.state.get(S.TUTORIAL_STEP) === n
    );
  },
});

Template.form.events({
  "submit .task-form"(event) {
    event.preventDefault();
    const { target } = event;
    const text = target.text.value.trim();
    const category = target.category.value || "Uncategorized";
    if (!text) return;
    Meteor.call("tasks.insert", { text, category });
    target.text.value = "";
  },

  "keydown input[name=text]"(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target
        .closest("form")
        .dispatchEvent(new Event("submit", { bubbles: true }));
    }
  },
});
