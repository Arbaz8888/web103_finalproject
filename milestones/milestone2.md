# Milestone 2

This document should be completed and submitted during **Unit 6** of this course. You **must** check off all completed tasks in this document in order to receive credit for your work.

## Checklist

This unit, be sure to complete all tasks listed below. To complete a task, place an `x` between the brackets.

- [x] In `planning/wireframes.md`: add wireframes for at least three pages in your web app.
  - [x] Include a list of pages in your app
- [x] In `planning/entity_relationship_diagram.md`: add the entity relationship diagram you developed for your database.
  - [x] Your entity relationship diagram should include the tables in your database.
- [x] Prepare your three-minute pitch presentation, to be presented during Unit 7 (the next unit).
  - [x] You do **not** need to submit any materials in advance of your pitch.
- [x] In this document, complete all three questions in the **Reflection** section below

## Reflection

### 1. What went well during this unit?

We split up responsibilities well and everyone got to have an equal role in planning the data and app design by splitting up the delivarables.

### 2. What were some challenges your group faced in this unit?

It was a bit challenging deciding how we would incorporate a JOIN table, but we decided by storing the available hold options in one table table and then having a table for holds that are actually on a route we could do a many-to-many join there. Also deciding whether to use enums or not. For now, for our demo and the fixed set of holds and types of climbs we are making we are using enums, but we acknowledge the trade-off of having to refactor the API if we decide to expand our app later.

### 3. What additional support will you need in upcoming units as you continue to work on your final project?

The hardest part where we expect to need the most support is setting up the holds on the climbing wall and getting a 2D/3D toggle feature that we would like on a route's detail page. Our MVP involves just getting the 2D wall displayed with the holds on it on the frontend but to really make our app interactive and showcase routes well, we would like to have a way to toggle a 3D view of the wall. This will most likely require research and AI assistance on our end since none of us have worked with any 3D React libraries. For now, we plan to use React Three Fiber but we may have to rethink implementation depending on how much time we have for completing this feature.
