---
layout: post
author: AlexR
title:  "Interface Block (GLSL)"
ghcommentid: 10001
date:   2001-01-01 00:00:00 +0900
tags:
 - Programming
 - Shading Languages
excerpt_separator: <!--more-->
comments: true
---

[Interface Block (GLSL)](https://www.khronos.org/opengl/wiki/Interface_Block_(GLSL))

Interface blocks have different meaning in their various uses. Their declaration *looks like a struct definition, but it's not*.
```
storage_qualifier block_name
{
  <define members here>
} optional_instance_name;
```

`storage_qualifier`: Can be one of the `uniform`, `in`, `out` or `buffer`.

