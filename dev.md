# FeedMyOwl Developer Guide

Welcome to the FeedMyOwl developer guide! This document will help you understand the project's structure, architecture, and how to get started with development.

## Introduction

FeedMyOwl is a reading-first RSS/Atom reader. The core functionality allows users to add RSS feeds, organize them into folders, and read articles. It's designed to provide a calm and reliable reading experience with simple navigation.

This project is built as a monorepo, meaning it contains more than one sub-project in a single repository. The main benefit of a monorepo for this project is that it allows for shared code and configurations between the `web` and `blog` applications, and simplifies dependency management.

## Project Structure

The project is organized as a monorepo using `pnpm` workspaces. Here's a high-level overview of the directory structure:

```
/
├── apps/
│   ├── web/      # The main Next.js web application
│   └── blog/     # The Eleventy-based blog
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── ...
```

- **`apps/`**: This directory contains the individual applications.
  - **`web/`**: The main FeedMyOwl application, built with Next.js. This is where most of the development happens.
  - **`blog/`**: The project's blog, built with Eleventy.

## Technology Stack

The `web` application uses a modern technology stack:

- **[Next.js](https://nextjs.org/)**: A React framework that provides a hybrid approach to rendering, allowing for both server-side rendering (SSR) and client-side rendering (CSR). It also includes a file-based router and API routes.
- **[React](https://react.dev/)**: A JavaScript library for building user interfaces.
- **[TypeScript](https://www.typescriptlang.org/)**: A statically typed superset of JavaScript that helps catch errors early in development.
- **[Drizzle ORM](https://orm.drizzle.team/)**: A TypeScript Object-Relational Mapper that allows you to interact with the database using TypeScript code instead of writing raw SQL.
- **[PostgreSQL](https://www.postgresql.org/)**: A powerful, open-source object-relational database system.
- **[Clerk](https://clerk.com/)**: A service for user authentication and management.
- **[Stripe](https://stripe.com/)**: A service for handling payments and subscriptions.
- **[Tailwind CSS](https://tailwindcss.com/)**: A utility-first CSS framework for rapidly building custom user interfaces. _(Note: While not explicitly listed in the package.json, it's a very common choice for Next.js projects and the project structure suggests its use. If not, a different CSS methodology is in place in `globals.css`)_
- **[Vitest](https://vitest.dev/)**: A fast and modern testing framework.

## Application Architecture (The `web` app)

The `web` application follows a typical Next.js architecture, with a few key directories to understand:

- **`src/app/`**: This is the core of the Next.js application, using the App Router model.
  - **`api/`**: This directory contains all the backend API routes. When the frontend needs to communicate with the server (e.g., to fetch data or save something to the database), it sends a request to one of these API routes.
  - **`(auth)/` and other `(...)` folders**: The parentheses denote "route groups", which are used to organize routes without affecting the URL path. The `(auth)` group, for example, contains all the pages that require a user to be logged in.
  - **`layout.tsx`**: A file that defines the shared UI for a set of routes.
  - **`page.tsx`**: A file that defines the unique UI of a route.

- **`src/features/`**: This directory contains the core business logic of the application, organized by feature (e.g., `feeds`, `settings`). This is a great place to look to understand how a specific part of the application works.

- **`src/lib/`**: This directory is for reusable code that is not specific to any single feature. It's further divided into:
  - **`client/`**: Code that can only run in the browser (e.g., code that interacts with the DOM).
  - **`server/`**: Code that can only run on the server (e.g., code that communicates directly with the database or uses secret API keys).
  - **`shared/`**: Code that can run in both the browser and on the server.

- **`src/db/`**: This directory contains the database schema (`schema.ts`) and migrations.
  - **`schema.ts`**: This file defines the database tables, columns, and relationships using Drizzle ORM's syntax.
  - **`migrations/`**: This directory holds the SQL files that represent the history of changes to the database schema.

## Key Files and Configurations

Here's a breakdown of the most important files in the project.

- **`package.json`**:
  - Contains project metadata, scripts, and dependencies.
  - **`dependencies`**: These are the packages required for the application to run in production (e.g., `next`, `react`).
  - **`devDependencies`**: These are packages only needed for development and testing (e.g., `typescript`, `eslint`, `vitest`).

- **`pnpm-lock.yaml`**: Ensures that every developer uses the exact same versions of all dependencies, preventing inconsistencies.

- **`pnpm-workspace.yaml`**: Configures the pnpm monorepo, telling it where to find the sub-projects.

- **`.gitignore`**: Tells Git which files and directories to ignore, such as `node_modules/` and `.env.local`.

- **`apps/web/.env.example` and `.env.local`**:
  - `.env.example` is a template for the required environment variables.
  - `.env.local` is where you store your actual secret keys. You create this file by copying the example file. **It must never be committed to Git.**

- **`.github/workflows/ci.yml`**: Defines the Continuous Integration workflow using GitHub Actions. It automatically builds and tests the application when code is pushed to the repository.

- **`next.config.ts`**: Configuration file for the Next.js application.

- **`drizzle.config.ts`**: Configuration file for Drizzle ORM, specifying the database schema and migration file location.

- **`tsconfig.json`**: The configuration file for TypeScript. It specifies the compiler options and which files to include.

- **`eslint.config.mjs`**: The configuration file for ESLint, a tool that analyzes the code to find and fix problems.

- **`vitest.config.ts`**: The configuration file for Vitest, the testing framework.

## How to Run the App

To run the web application on your local machine, follow these steps:

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```
2.  **Set up environment variables**:
    - Copy `apps/web/.env.example` to `apps/web/.env.local`.
    - Fill in the required values in `.env.local`.
3.  **Run database migrations**:
    ```bash
    pnpm db:migrate
    ```
4.  **Start the development server**:
    ```bash
    pnpm dev:web
    ```

This will start the Next.js development server at [http://localhost:3000](http://localhost:3000).
