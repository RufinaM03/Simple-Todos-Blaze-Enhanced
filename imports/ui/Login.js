import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { ReactiveVar } from "meteor/reactive-var";

import { Accounts } from "meteor/accounts-base";

import "./Login.html";

Template.login.onCreated(function () {
  this.isSignup = new ReactiveVar(false);
});

Template.login.helpers({
  buttonText() {
    return Template.instance().isSignup.get() ? "Create Account" : "Log In";
  },

  switchText() {
    return Template.instance().isSignup.get()
      ? "Already have an account? Log In"
      : "Don't have an account? Create One";
  },
});

Template.login.events({
  "submit .login-form"(event, instance) {
    event.preventDefault();

    const { target } = event;

    const username = target.username.value;

    const password = target.password.value;

    if (instance.isSignup.get()) {
      Accounts.createUser(
        {
          username,

          password,
        },
        (err) => {
          if (err) {
            alert(err.reason);
          }
        },
      );
    } else {
      Meteor.loginWithPassword(
        username,

        password,

        (err) => {
          if (err) {
            alert(err.reason);
          }
        },
      );
    }
  },

  "click .switch-mode"(event, instance) {
    instance.isSignup.set(!instance.isSignup.get());
  },
});
