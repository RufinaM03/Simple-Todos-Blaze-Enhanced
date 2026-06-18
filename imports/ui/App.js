import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { TasksCollection } from "../db/TasksCollection";
import { CategoriesCollection } from "../db/CategoriesCollection";
import { Tracker } from "meteor/tracker";
import { ReactiveDict } from "meteor/reactive-dict";
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
  TUTORIAL_CARD_STYLE: "tutorialCardStyle",
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
    selector: '[data-tour="task-form"]',
  },
  {
    title: "Pick a category",
    text: "Choose Work, Personal, Urgent — or any custom category you create.",
    selector: '[data-tour="category-select"]',
  },
  {
    title: "Create new categories",
    text: "Click '＋ Category' to open the category builder and add your own.",
    selector: '[data-tour="add-category"]',
  },
  {
    title: "Filter by category",
    text: "Use the category bar to filter tasks by type. Combine with Hide Done.",
    selector: '[data-tour="category-filters"]',
  },
  {
    title: "Drag to reorder",
    text: "Grab the dot handle on the left of any task and drag it to reorder.",
    selector: '[data-tour="drag-handle"], [data-tour="task-list"]',
  },
  {
    title: "Mark tasks done",
    text: "Click the Done button on a task to mark it complete. Click ✓ to undo.",
    selector: '[data-tour="task-complete"], [data-tour="task-list"]',
  },
  {
    title: "List or Grid view",
    text: "Switch between a compact list and a card grid using the icons top-right.",
    selector: '[data-tour="view-toggle"]',
  },
  {
    title: "Dark mode",
    text: "Click the moon icon in the header to switch between light and dark themes.",
    selector: '[data-tour="theme-toggle"]',
  },
];

const TUTORIAL_CARD_MARGIN = 16;
const TUTORIAL_CARD_FALLBACK_STYLE = "top: 96px; left: 24px;";

const getReadableTextColor = (hexColor) => {
  const hex = (hexColor || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 155 ? "#0f172a" : "#ffffff";
};

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

const getMainInstance = (inst) => {
  if (!inst) return null;
  if (inst.state) return inst;

  let view = inst.view;
  while (view) {
    const templateInst =
      typeof view.templateInstance === "function"
        ? view.templateInstance()
        : null;
    if (templateInst && templateInst.state) return templateInst;
    view = view.parentView;
  }

  return null;
};

const getVisibleTasks = (inst) => {
  if (!isUserLogged()) return [];

  const hideComp = inst.state.get(S.HIDE_COMPLETED);
  const activeCat = inst.state.get(S.ACTIVE_CATEGORY);
  const search = (inst.state.get(S.SEARCH) || "").toLowerCase();
  const { pendingOnly, userFilter } = getTasksFilter();

  let filter = hideComp ? pendingOnly : userFilter;
  if (activeCat && activeCat !== "all") {
    filter = { ...filter, category: activeCat };
  }

  let tasks = TasksCollection.find(filter, { sort: { order: 1 } }).fetch();

  if (search) {
    tasks = tasks.filter((t) => t.text.toLowerCase().includes(search));
  }

  return tasks;
};

const openNewCategoryModal = (inst) => {
  const main = getMainInstance(inst);
  if (!main) return;

  main.state.set(S.EDITING_CAT_ID, null);
  main.state.set(S.SELECTED_COLOR, DEFAULT_COLORS[0].value);
  main.state.set(S.SHOW_CAT_MODAL, true);
  Meteor.defer(() => document.getElementById("category-name-input")?.focus());
};

const closeCategoryModal = (inst) => {
  const main = getMainInstance(inst);
  if (!main) return;

  main.state.set(S.SHOW_CAT_MODAL, false);
  main.state.set(S.EDITING_CAT_ID, null);
};

const selectTaskFormCategory = (name, attempts = 0) => {
  Meteor.defer(() => {
    const select = document.querySelector('.task-form select[name="category"]');
    if (!select) return;

    const hasOption = Array.from(select.options).some(
      (option) => option.value === name,
    );

    if (hasOption) {
      select.value = name;
    } else if (attempts < 5) {
      Meteor.setTimeout(() => selectTaskFormCategory(name, attempts + 1), 50);
    }
  });
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getTutorialStep = (step) => tutorialSteps[step] || tutorialSteps[0];

const getTutorialTarget = (step) => {
  const selector = getTutorialStep(step)?.selector;
  return selector ? document.querySelector(selector) : null;
};

const positionTutorialCard = (inst) => {
  if (!inst.state.get(S.SHOW_TUTORIAL)) return;

  const card = inst.find(".tutorial-card");
  const target = getTutorialTarget(inst.state.get(S.TUTORIAL_STEP));

  if (!card || !target) {
    inst.state.set(S.TUTORIAL_CARD_STYLE, TUTORIAL_CARD_FALLBACK_STYLE);
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const maxLeft = Math.max(
    TUTORIAL_CARD_MARGIN,
    window.innerWidth - cardRect.width - TUTORIAL_CARD_MARGIN,
  );
  const maxTop = Math.max(
    TUTORIAL_CARD_MARGIN,
    window.innerHeight - cardRect.height - TUTORIAL_CARD_MARGIN,
  );

  let left = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
  let top = targetRect.bottom + TUTORIAL_CARD_MARGIN;

  if (top + cardRect.height + TUTORIAL_CARD_MARGIN > window.innerHeight) {
    top = targetRect.top - cardRect.height - TUTORIAL_CARD_MARGIN;
  }

  left = clamp(left, TUTORIAL_CARD_MARGIN, maxLeft);
  top = clamp(top, TUTORIAL_CARD_MARGIN, maxTop);

  inst.state.set(
    S.TUTORIAL_CARD_STYLE,
    `top: ${Math.round(top)}px; left: ${Math.round(left)}px;`,
  );
};

const revealTutorialStep = (inst) => {
  const target = getTutorialTarget(inst.state.get(S.TUTORIAL_STEP));

  if (target) {
    target.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  }

  Meteor.setTimeout(() => positionTutorialCard(inst), target ? 260 : 0);
};

const startTutorial = (inst) => {
  const main = getMainInstance(inst);
  if (!main) return;

  closeCategoryModal(main);
  main.state.set(S.ACTIVE_CATEGORY, "all");
  main.state.set(S.HIDE_COMPLETED, false);
  main.state.set(S.SEARCH, "");
  main.state.set(S.TUTORIAL_STEP, 0);
  main.state.set(S.SHOW_TUTORIAL, true);
  main.state.set(S.TUTORIAL_CARD_STYLE, TUTORIAL_CARD_FALLBACK_STYLE);
  localStorage.removeItem("taskflowTutorialSeen");
  Meteor.defer(() => revealTutorialStep(main));
};

const finishTutorial = (inst) => {
  inst.state.set(S.SHOW_TUTORIAL, false);
  localStorage.setItem("taskflowTutorialSeen", "true");
};

const destroySortable = (inst) => {
  if (!inst._sortable) return;
  inst._sortable.destroy();
  inst._sortable = null;
};

const syncSortable = (inst) => {
  const list = inst.find(".tasks");
  if (!list) {
    destroySortable(inst);
    return;
  }

  if (inst._sortable && inst._sortable.el === list) return;

  destroySortable(inst);
  inst._sortable = Sortable.create(list, {
    animation: 180,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
    handle: ".drag-handle",
    draggable: ".task-item",
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 4,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    swapThreshold: 0.65,
    invertSwap: true,
    direction: () =>
      inst.state.get(S.VIEW_MODE) === "grid" ? "horizontal" : "vertical",
    onStart() {
      list.classList.add("is-sorting");
    },
    onEnd(evt) {
      list.classList.remove("is-sorting");
      if (evt.oldIndex === evt.newIndex) return;

      const orderedTaskIds = Array.from(list.querySelectorAll(".task-item"))
        .map((el) => el.dataset.id)
        .filter(Boolean);

      if (orderedTaskIds.length > 1) {
        Meteor.call("tasks.reorderMany", orderedTaskIds);
      }
    },
  });
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
  this.state.set(S.TUTORIAL_CARD_STYLE, TUTORIAL_CARD_FALLBACK_STYLE);

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
  this._positionTutorial = () => positionTutorialCard(this);
  window.addEventListener("resize", this._positionTutorial);

  this.autorun(() => {
    const user = Meteor.user();
    const isLoading = this.state.get(S.IS_LOADING);
    this.state.get(S.VIEW_MODE);
    const visibleTaskIds = getVisibleTasks(this).map((task) => task._id);

    Meteor.defer(() => {
      if (!user || isLoading || visibleTaskIds.length < 2) {
        destroySortable(this);
        return;
      }

      syncSortable(this);
    });
  });

  this.autorun(() => {
    const showTutorial = this.state.get(S.SHOW_TUTORIAL);
    this.state.get(S.TUTORIAL_STEP);
    this.state.get(S.VIEW_MODE);
    getVisibleTasks(this).map((task) => task._id).join(",");

    if (showTutorial) {
      Meteor.defer(() => revealTutorialStep(this));
    }
  });
});

Template.mainContainer.onDestroyed(function () {
  destroySortable(this);
  if (this._positionTutorial) {
    window.removeEventListener("resize", this._positionTutorial);
  }
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
      finishTutorial(inst);
    } else {
      inst.state.set(S.TUTORIAL_STEP, step + 1);
    }
  },
  "click .skip-tutorial"(e, inst) {
    finishTutorial(inst);
  },
  "click .start-tutorial"(e, inst) {
    e.preventDefault();
    startTutorial(inst);
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
    e.preventDefault();
    openNewCategoryModal(inst);
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
    return getVisibleTasks(Template.instance());
  },

  hasNoTasks() {
    if (!isUserLogged()) return false;
    return getVisibleTasks(Template.instance()).length === 0;
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
    return CategoriesCollection.find({}, { sort: { order: 1 } })
      .fetch()
      .map((category) => ({
        ...category,
        textColor: getReadableTextColor(category.color),
      }));
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
  tutorialCardStyle() {
    return (
      Template.instance().state.get(S.TUTORIAL_CARD_STYLE) ||
      TUTORIAL_CARD_FALLBACK_STYLE
    );
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

});

// ─── Template: categoryModal ──────────────────────────────────────────────────
Template.categoryModal.helpers({
  showCategoryModal() {
    const main = getMainInstance(Template.instance());
    return main ? main.state.get(S.SHOW_CAT_MODAL) : false;
  },
  editingCategory() {
    const main = getMainInstance(Template.instance());
    const id = main && main.state.get(S.EDITING_CAT_ID);
    return id ? CategoriesCollection.findOne(id) : null;
  },
  editingCategoryName() {
    const main = getMainInstance(Template.instance());
    const id = main && main.state.get(S.EDITING_CAT_ID);
    if (!id) return "";
    const cat = CategoriesCollection.findOne(id);
    return cat ? cat.name : "";
  },
  selectedColor() {
    const main = getMainInstance(Template.instance());
    return main ? main.state.get(S.SELECTED_COLOR) : DEFAULT_COLORS[0].value;
  },
  selectedColorText() {
    const main = getMainInstance(Template.instance());
    const color = main ? main.state.get(S.SELECTED_COLOR) : DEFAULT_COLORS[0].value;
    return getReadableTextColor(color);
  },
});

Template.categoryModal.events({
  "click .modal-close, click .modal-cancel"(e, inst) {
    e.preventDefault();
    closeCategoryModal(inst);
  },

  "click .modal-backdrop"(e, inst) {
    if (e.target === e.currentTarget) {
      closeCategoryModal(inst);
    }
  },

  "input .category-color-input"(e, inst) {
    const main = getMainInstance(inst);
    if (main) main.state.set(S.SELECTED_COLOR, e.currentTarget.value);
  },

  "change .category-color-input"(e, inst) {
    const main = getMainInstance(inst);
    if (main) main.state.set(S.SELECTED_COLOR, e.currentTarget.value);
  },

  "submit .category-modal-form"(e, inst) {
    e.preventDefault();
    const main = getMainInstance(inst);
    if (!main) return;

    const input = inst.find("#category-name-input");
    const name = input ? input.value.trim() : "";
    const color = main.state.get(S.SELECTED_COLOR);
    const id = main.state.get(S.EDITING_CAT_ID);
    if (!name) return;

    if (id) {
      Meteor.call("categories.update", id, { name, color }, (err) => {
        if (err) {
          alert(err.reason || err.message);
          return;
        }
        closeCategoryModal(main);
        selectTaskFormCategory(name);
      });
      return;
    }

    Meteor.call("categories.insert", { name, color }, (err) => {
      if (err) {
        alert(err.reason || err.message);
        return;
      }
      closeCategoryModal(main);
      selectTaskFormCategory(name);
    });
  },

  "click .delete-category-btn"(e, inst) {
    e.preventDefault();
    const main = getMainInstance(inst);
    const id = main && main.state.get(S.EDITING_CAT_ID);
    if (!id) return;

    if (confirm("Delete this category? Tasks will move to Uncategorized.")) {
      Meteor.call("categories.remove", id, (err) => {
        if (err) {
          alert(err.reason || err.message);
          return;
        }
        closeCategoryModal(main);
        main.state.set(S.ACTIVE_CATEGORY, "all");
      });
    }
  },
});

// ─── Template: form ───────────────────────────────────────────────────────────
Template.form.helpers({
  allCategories() {
    return CategoriesCollection.find({}, { sort: { order: 1 } }).fetch();
  },
  isTutorialStep(n) {
    const main = getMainInstance(Template.instance());
    if (!main || !main.state) return false;
    return (
      main.state.get(S.SHOW_TUTORIAL) && main.state.get(S.TUTORIAL_STEP) === n
    );
  },
});

Template.form.events({
  "click #open-category-modal"(event, inst) {
    event.preventDefault();
    event.stopPropagation();
    openNewCategoryModal(inst);
  },

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
