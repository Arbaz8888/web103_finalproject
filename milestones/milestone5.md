# Milestone 5

This document should be completed and submitted during **Unit 9** of this course. You **must** check off all completed tasks in this document in order to receive credit for your work.

## Checklist

This unit, be sure to complete all tasks listed below. To complete a task, place an `x` between the brackets.

- [x] Deploy your project on Render
  - [x] In `readme.md`, add the link to your deployed project
- [x] Update the status of issues in your project board as you complete them
- [x] In `readme.md`, check off the features you have completed in this unit by adding a ✅ emoji in front of their title
  - [x] Under each feature you have completed, **include a GIF** showing feature functionality
- [x] In this document, complete the **Reflection** section below
- [x] 🚩🚩🚩**Complete the Final Project Feature Checklist section below**, detailing each feature you completed in the project (ONLY include features you implemented, not features you planned)
- [x] 🚩🚩🚩**Record a GIF showing a complete run-through of your app** that displays all the components included in the **Final Project Feature Checklist** below
  - [x] Include this GIF in the **Final Demo GIF** section below

## Final Project Feature Checklist

Complete the checklist below detailing each baseline, custom, and stretch feature you completed in your project. This checklist will help graders look for each feature in the GIF you submit.

### Baseline Features

👉🏾👉🏾👉🏾 Check off each completed feature below.

- [x] The project includes an Express backend app and a React frontend app
- [x] The project includes these backend-specific features:
  - [x] At least one of each of the following database relationships in Postgres
    - [x] one-to-many
    - [x] many-to-many with a join table
  - [x] A well-designed RESTful API that:
    - [x] supports all four main request types for a single entity (ex. tasks in a to-do list app): GET, POST, PATCH, and DELETE (our update uses `PUT` with a full replace)
      - [x] the user can **view** items, such as tasks
      - [x] the user can **create** a new item, such as a task
      - [x] the user can **update** an existing item by changing some or all of its values, such as changing the title of task
      - [x] the user can **delete** an existing item, such as a task
    - [x] Routes follow proper naming conventions
  - [x] The web app includes the ability to reset the database to its default state
- [x] The project includes these frontend-specific features:
  - [x] At least one redirection, where users are able to navigate to a new page with a new URL within the app
  - [x] At least one interaction that the user can initiate and complete on the same page without navigating to a new page
  - [x] Dynamic frontend routes created with React Router
  - [x] Hierarchically designed React components
    - [x] Components broken down into categories, including Page and Component types
    - [x] Corresponding container components and presenter components as appropriate
- [x] The project includes dynamic routes for both frontend and backend apps
- [x] The project is deployed on Render with all pages and features that are visible to the user are working as intended

### Custom Features

👉🏾👉🏾👉🏾 Check off each completed feature below.

- [x] The project gracefully handles errors
- [ ] The project includes a one-to-one database relationship
- [x] The project includes a slide-out pane or modal as appropriate for your use case that pops up and covers the page content without navigating away from the current page
- [x] The project includes a unique field within the join table
- [x] The project includes a custom non-RESTful route with corresponding controller actions
- [x] The user can filter or sort items based on particular criteria as appropriate for your use case
- [ ] Data is automatically generated in response to a certain event or user action. Examples include generating a default inventory for a new user starting a game or creating a starter set of tasks for a user creating a new task app account
- [x] Data submitted via a POST or PATCH request is validated before the database is updated (e.g. validating that an event is in the future before allowing a new event to be created)
  - [x] _To receive full credit, please be sure to demonstrate in your walkthrough that for certain inputs, the item will NOT be successfully created or updated._

### Stretch Features

👉🏾👉🏾👉🏾 Check off each completed feature below.

- [ ] A subset of pages require the user to log in before accessing the content
  - [ ] Users can log in and log out via GitHub OAuth with Passport.js
- [x] Restrict available user options dynamically, such as restricting available purchases based on a user's currency
- [ ] Show a spinner while a page or page element is loading
- [x] Disable buttons and inputs during the form submission process
- [ ] Disable buttons after they have been clicked
  - _At least 75% of buttons in your app must exhibit this behavior to receive full credit_
- [ ] Users can upload images to the app and have them be stored on a cloud service
  - _A user profile picture does **NOT** count for this rubric item **only if** the app also includes "Login via GitHub" functionality._
  - _Adding a photo via a URL does **NOT** count for this rubric item (for example, if the user provides a URL with an image to attach it to the post)._
  - _Selecting a photo from a list of provided photos does **NOT** count for this rubric item._
- [x] 🍞 [Toast messages](https://www.patternfly.org/v3/pattern-library/communication/toast-notifications/index.html) deliver simple feedback in response to user events

## Final Demo GIF

🔗 [Here's a GIF walkthrough of the final project](https://drive.google.com/file/d/11SLaYUCN8l42qXVLUhimwbx3eeWOiL3V/view?usp=sharing)

## Reflection

### 1. What went well during this unit?

We were able to succesfully complete our project including implementing the 3D toggle for the wall.

### 2. What were some challenges your group faced in this unit?

Aligning implementations and coding styles for different components was a bit of a challenge as well as finalizing a style for the app to make it look more appealing. Also, creating the 3D wall component required a decent bit of AI help as none of us had worked with react three fiber before.

### 3. What were some of the highlights or achievements that you are most proud of in this project?

We got to work with a new technology for us in react three fiber and three.js which was a cool new experience. We were also able to even include a stretch feature in our final submission which was nice considering the difficulty of that feature with the 3D wall.

### 4. Reflecting on your web development journey so far, how have you grown since the beginning of the course?

We now have more experience working in a group planning and dividing up work to reach a common goal. We also now know how to deploy our web apps on Render and properly set up backends for our React frontends, all skills we have learned throughout this course.

### 5. Looking ahead, what are your goals related to web development, and what steps do you plan to take to achieve them?

We would like to work more with authentication as that is a big part of web development, and we did not add that feature in our app since we prioritized the 3D aspect. We could look into implementing authentication in the future for our web app to practice deploying and running an app with proper authentication and permissions depending on user roles.
