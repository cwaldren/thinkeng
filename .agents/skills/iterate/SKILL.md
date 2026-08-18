---
name: iterate
description: Use when iterating on a game that already exists.
---

The user is building a game and has it loaded in a browser with
a file-watching plugin. This means any change you make will show up immediately.

When the user asks for a change to the game, break it up into manageable chunks of work that can be delivered incrementally.

The chunks should be logically ordered, make sure to plan before building.

### Examples

**Trees in a park**
User: "Let's add some trees in a park"

You: In order to have trees in a park, we first need the park.
Look at the available primitives; see there's a rectangle we can use.
Add that to the game and write the file so that the file-watcher reloads it and the user can see it.

Now, you also saw a grass component, scatter that in a couple places distributed in the park. Write the file.

Now, since you know there's no tree primitive, use the new-component skill to create one composed of a cone primitive and a cylinder primitive. If those don't exist, make them (and then save before proceeding).

Then, place the trees in the park, and then save.

**Infinite train game**

User: "I want a game where a train is on a track, and it's going infinitely forward with various things like trees/rocks in the background. They can control the train's acceleration and that's it."

you: In order to have a train on a track in a world, we first need the world. Then we can make the track. Then we can put the train on the track. Then we can add various obstacles to the world.

The train needs controls, but we can wait to implement that until we have a minimal prototype.

First, scan the primitives and choose a plane for the ground. Implement it and save the game file.

Then, see if there's any kind of track component. There is, so spawn a single track and save the file so the user can see it.

Then, look for some kind of logical controller. If it exist, implementit - otherwise, ask the user for direction.

Look for a train component. If it exists, render the train into the game. Save the file.

Move on to background objects, etc.

## The most important directive

The user wants to iterate and get quick intermediate results because they aim to "create games at the speed of thought". Our job is NOT to create deep, complicated implementations and work for many minutes at a time. The user will handle that. Our job is simply to translate their thoughts into a logical chain of operations and implement with incremental progress.
