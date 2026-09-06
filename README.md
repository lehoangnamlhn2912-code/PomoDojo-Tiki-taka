# PomoDojo

> A desktop productivity application designed to help users stay focused, manage study sessions, and maintain healthy working habits.

PomoDojo is a desktop application built with **Electron**, **React**, and **Vite**.  
It combines productivity tools with focus and eye-care features to provide a more adaptive study/work experience.

---

## Features

- Pomodoro-based focus sessions
- Adaptive study and break sessions
- Eye-distance monitoring
- Screen protection when the user is too close to the screen
- Break activities and focus recovery
- Desktop application powered by Electron
- Modern React-based user interface

---

## Tech Stack

- **Frontend:** React
- **Build Tool:** Vite
- **Desktop Framework:** Electron
- **Language:** JavaScript / JSX
- **Package Manager:** npm
- **Version Control:** Git / GitHub

---

# Getting Started

Follow the steps below to download and run PomoDojo on your computer.

## 1. Requirements

Make sure the following software is installed:

- Node.js
- npm
- Git

Node.js includes npm, so installing Node.js is normally enough for both.

Check your installation:

```bash
node --version
npm --version
git --version
```

If these commands return version numbers, your environment is ready.

---

## 2. Clone the Repository

Clone the project from GitHub:

```bash
git clone https://github.com/lehoangnamlhn2912-code/PomoDojo-Tiki-taka.git
```

Enter the project directory:

```bash
cd PomoDojo-Tiki-taka
```

---

## 3. Install Dependencies

Install all required project dependencies:

```bash
npm install
```

This will read `package.json` and install the packages required by PomoDojo.

> You only need to run `npm install` again when dependencies change or when setting up the project on a new machine.

---

## 4. Environment Variables

If the project uses environment variables, create the required environment file in the project root.

For example:

```env
GEMINI_API_KEY=your_api_key_here
```

Replace the value with your own API key if required by the current version of the project.

### Important

Do **not** commit private API keys or other secrets to GitHub.

Environment files such as:

```text
.env
.env.local
.env.*.local
```

should remain local to your machine.

---

# Running PomoDojo

## Development Mode

To start the Vite development server:

```bash
npm run dev
```

This mode is mainly intended for developing and testing the frontend.

---

## Electron Development Mode

To run PomoDojo as a desktop Electron application:

```bash
npm run electron-dev
```

This starts the development environment and launches the Electron application.

For normal development, this is the recommended command.

---

# Building PomoDojo

## Build the Frontend

Create a production build with:

```bash
npm run build
```

The generated files are placed in the project's build directory.

---

## Build the Desktop Application

If the project contains an Electron distribution script, run:

```bash
npm run dist
```

The packaged application will be generated in the configured release/output directory.

Generated build files are not required in the source repository because they can be recreated from the source code.

---

# Project Structure

The main project is organized approximately as follows:

```text
PomoDojo-Tiki-taka/
│
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── ipc/
│
├── public/
│
├── src/
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   ├── assets/
│   ├── App.jsx
│   └── main.jsx
│
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

The structure may change as development continues.

---

# Development Workflow

After making changes to the project, check which files have been modified:

```bash
git status
```

Add the changes:

```bash
git add .
```

Create a commit:

```bash
git commit -m "Update PomoDojo"
```

Push the changes to GitHub:

```bash
git push
```

To download the latest changes from GitHub:

```bash
git pull
```

---

# Files Excluded from Git

PomoDojo should only store source code and necessary project configuration in the Git repository.

Generated or machine-specific files should not be committed.

Typical ignored files include:

```text
node_modules/
dist/
dist-electron/
release/

.env
.env.local
.env.*.local

*.log
```

These files can either be regenerated automatically or contain local/private information.

---

# Troubleshooting

## `npm` is not recognized

If the terminal reports that `npm` is not recognized, make sure Node.js is installed correctly.

Check:

```bash
node --version
npm --version
```

If neither command works, reinstall Node.js and restart your terminal.

---

## Dependencies are missing

If the application reports missing packages, run:

```bash
npm install
```

Then start the application again:

```bash
npm run electron-dev
```

---

## The application does not start

Try reinstalling the dependencies:

```bash
npm install
```

Then run:

```bash
npm run electron-dev
```

If the problem persists, check the error message printed in the terminal.

---

## Changes are not appearing

If changes do not appear after modifying the project:

1. Save all files.
2. Stop the development process.
3. Start it again:

```bash
npm run electron-dev
```

---

# Quick Start

For a fresh installation, the complete process is:

```bash
git clone https://github.com/lehoangnamlhn2912-code/PomoDojo-Tiki-taka.git
cd PomoDojo-Tiki-taka
npm install
npm run electron-dev
```

That's it.

PomoDojo should now be running locally in Electron.

---

# Updating an Existing Installation

If you already have the project on your computer and want to get the latest version:

```bash
git pull
```

If dependencies were changed, run:

```bash
npm install
```

Then start the application:

```bash
npm run electron-dev
```

---

# Contributing

If you want to contribute to the project:

1. Clone the repository.
2. Create a new branch.
3. Make your changes.
4. Test the application.
5. Commit your changes.
6. Push the branch to GitHub.
7. Open a Pull Request.

Example:

```bash
git checkout -b feature/my-feature
```

After making changes:

```bash
git add .
git commit -m "Add my feature"
git push -u origin feature/my-feature
```

---

# Notes

- Do not commit `node_modules`.
- Do not commit generated release/build files.
- Do not commit API keys or other secrets.
- Run `npm install` after cloning the repository.
- Use `npm run electron-dev` for normal Electron development.
- Build and release files can be generated locally when needed.

---

# License

This project is currently intended for development and educational purposes.