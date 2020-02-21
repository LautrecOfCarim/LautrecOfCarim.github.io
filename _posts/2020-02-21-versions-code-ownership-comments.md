---
layout: post
author: AlexR
title:  "Versions, code ownership and comments (short rant)"
ghcommentid: 3
date:   2020-02-21 13:00:00 +0900
tags:
 - Programming
 - Opinion
excerpt_separator: <!--more-->
comments: true
---

So long time ago we decided to track the version of a tool we're developing<!--more-->, not unlike what many other products do. It's `Major.Minor.Release.Build` and we had a short discussion of what each version indicates and how it affects the software.



I later decided to put comments so we rely less on tribal knowledge and on the guidelines being properly set and visible outside our small team. The biggest struggle was only when to allow and when to disallow breaking changes. We had already settled on the following:

```
#define VERSION_MAJOR "1"     // Should be 1.
#define VERSION_MINOR "5"     // When large features or milestones are merged in. Minor version allows for breaking changes. Existing tests can change.
#define VERSION_RELEASE "3"   // When small features are merged in. They cannot introduce breaking changes. Existing tests shouldn't change.
#define VERSION_BUILD "2"     // For bug fixes and any incremental improvements that are not "features"
```



Minor versions allow for breaking changes. All enumerations should be scoped. If you used `enum class` you're safe, but if you have `enums` in your code the parser will now fail it - go and fix it yourself. Pretty standard.

Releases and versions less minor than that can only add incremental features, improvements and so on. All previous tests are valid and we promise that your existing code still builds.

Build version, well, minor bugfixes, refactoring, improvements. If you want to bump the version for no other reason, use this.



But then I wrote, "Major version - `Should be 1.`"



And I thought, "What if it's not? How do we define when the major version will go to `2.0`, `3.0` or will it never change?"



I thought I should change the comment to communicate my intent better, to explain when the version should change and so on. And then it hit me - the comment was perfect. `Should be 1.`



If you're the code owner, it's up to you to decide, for example, when a product is version `2.0` And other things. All things about your product in fact. You make educated decisions when to change the major version - and the comment with it! `Should be 2.` Or 3. Or link a detailed Confluence page which explains how versioning works in your corporation. The purpose of the comment is simple. It's a rule you never break, straight-forward and imposing. When you feel you should ~~break it~~ change it, you have claimed ownership of that rule, code or feature.
