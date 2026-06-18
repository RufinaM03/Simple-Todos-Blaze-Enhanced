# 📝 TaskFlow

A modern task management application built with **Meteor.js**, **Blaze**, and **MongoDB**, featuring authentication, task categories, drag-and-drop reordering, and a polished user experience.

## ✨ Features

- User Authentication (Login / Logout)
- Task Creation and Deletion
- Task Categories
  - Work
  - Personal
  - Urgent
- Mark Tasks as Completed
- Hide Completed Tasks
- Drag-and-Drop Reordering
- Interactive User Onboarding
- Responsive Modern UI

## 🛠 Tech Stack

- Meteor 3
- Blaze
- MongoDB
- SortableJS
- ReactiveDict
- Tracker
- HTML5
- CSS3

## 🚀 Run Locally

```bash
git clone <repo-url>
cd taskflow-meteor-blaze
meteor npm install
meteor run
```

## 📁 Project Structure

```text
imports/
├── api/
│   ├── tasksMethods.js
│   └── tasksPublications.js
├── db/
│   └── TasksCollection.js
├── ui/
│   ├── App.html
│   ├── App.js
│   ├── Task.html
│   ├── Task.js
│   ├── Login.html
│   └── Login.js

client/
└── main.css

server/
└── main.js
```

## 📌 Assignment Enhancements

### Task Categories

Implemented category-based organization:

- Work
- Personal
- Urgent

with visually distinct badges.

### Drag and Drop Reordering

Implemented using **SortableJS** for smooth playlist-like task organization.

## 👩‍💻 Author

**Rufina M**  
Integrated M.Tech CSE  
VIT Vellore
