import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { ReactiveVar } from "meteor/reactive-var";
import { Accounts } from "meteor/accounts-base";

import "./Login.html";

const DARK_MODE_KEY = "darkMode";
const DARK_MODE_STORAGE_KEY = "taskflowDarkMode";

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

Template.login.onCreated(function () {
  this.isSignup = new ReactiveVar(false);
  this.errorMessage = new ReactiveVar("");
});

Template.login.helpers({
  isSignup() {
    return Template.instance().isSignup.get();
  },

  pageTitle() {
    return Template.instance().isSignup.get() ? "Create Account" : "TaskFlow";
  },

  pageSubtitle() {
    return Template.instance().isSignup.get()
      ? "Create your workspace and start organizing."
      : "Organize Your Work, Your Way!";
  },

  buttonText() {
    return Template.instance().isSignup.get() ? "Create Account" : "Log In";
  },

  switchText() {
    return Template.instance().isSignup.get()
      ? "Already have an account?"
      : "Don't have an account?";
  },

  switchActionText() {
    return Template.instance().isSignup.get() ? "Log In" : "Create One";
  },

  errorMessage() {
    return Template.instance().errorMessage.get();
  },

  isDarkMode() {
    const main = getMainInstance(Template.instance());
    return main
      ? main.state.get(DARK_MODE_KEY)
      : localStorage.getItem(DARK_MODE_STORAGE_KEY) === "true";
  },
});

Template.login.events({
  "submit .login-form"(event, instance) {
    event.preventDefault();

    instance.errorMessage.set("");

    const { target } = event;

    const username = target.username.value.trim();
    const password = target.password.value;

    if (!username || !password) {
      instance.errorMessage.set("Please enter both username and password.");
      return;
    }

    if (instance.isSignup.get()) {
      const confirmPassword = target.confirmPassword.value;

      if (password.length < 6) {
        instance.errorMessage.set("Password must be at least 6 characters.");
        return;
      }

      if (password !== confirmPassword) {
        instance.errorMessage.set("Passwords do not match.");
        return;
      }

      Accounts.createUser(
        {
          username,
          password,
        },
        (err) => {
          if (err) {
            instance.errorMessage.set(err.reason);
            return;
          }

          target.reset();
        },
      );

      return;
    }

    Meteor.loginWithPassword(username, password, (err) => {
      if (err) {
        instance.errorMessage.set("Invalid username or password.");
        return;
      }

      target.reset();
    });
  },

  "click .switch-mode span"(event, instance) {
    instance.errorMessage.set("");
    instance.isSignup.set(!instance.isSignup.get());
  },

  "click .login-theme-toggle"(event, instance) {
    event.preventDefault();

    const main = getMainInstance(instance);
    const isDark = main
      ? main.state.get(DARK_MODE_KEY)
      : document.body.classList.contains("dark");
    const nextDark = !isDark;

    if (main) {
      main.state.set(DARK_MODE_KEY, nextDark);
    } else {
      document.body.classList.toggle("dark", nextDark);
    }

    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(nextDark));
  },
});
