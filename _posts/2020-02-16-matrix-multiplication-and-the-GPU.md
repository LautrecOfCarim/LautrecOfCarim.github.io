---
layout: post
author: AlexR
title:  "Matrix multiplication and the GPU"
ghcommentid: 2
date:   2020-02-16 15:00:00 +0900
tags:
 - Graphics
 - Shaders
 - Math
excerpt_separator: <!--more-->
comments: true
---

(TL; DR)

When mapping matrix data to the GPU there are 3 points of control where you can transpose the matrix for free, resulting in 8 ways you can multiply the vector by it. Four of them are correctly defined as transformations and are valid, four are not.
<!--more-->




## How is the matrix laid out in memory

First let's look at how matrices are laid out in memory. A matrix is a rectangular array of numbers, arranged in *rows* and *columns*. For example a matrix with *m rows* and *n columns* is read as a *m by n matrix* and is denoted as **A <sub>mn</sub>**. A single element **a<sub>ij</sub>** represents the number on the **i<sup>th</sup> row** and **j<sup>th</sup> column** in the matrix.

In computer science, it is convenient to store matrices in tight continuous memory layout like a flat array. There are two established methods of doing that, storing them in *row major* or *column major* format.

Two matrices (which happen to be *transform* matrices) are given below, one is stored in *row major* and the other in *column major* in memory. Note that the two matrices don't have any special relation - they're not identical to each other nor transposed.

![Matrix in memory]({{ site.baseurl }}/assets/images/matrix-in-memory.png)

In *row major* **every row** of the matrix is laid out in memory before the next row is packed after it, and so on.

In *column major* **every column** of the matrix is laid out in memory before the next column is packed after it, and so on.

Notices that this doesn't change the element indexing in a matrix itself. **a<sub>12</sub>** for example is the element on the first row and the second column, so in a *row major* packing it's the second element in the flat array (first row, second element), but in a *column major* packing it's the fifth element in the flat array (second column, first element).

In the example above we have two transform matrices. The color codes (RGB) correspond to the *rotation-scale* transform of the matrix, each color code defining its base unit vector **u<sub>x</sub>**, **u<sub>y</sub>** and **u<sub>z</sub>**. The yellow band is the transpose vector. These vectors end up similarly laid out in memory, the difference comes from the fact that they assume different positions (rows vs columns) back in the matrix.



There is an interesting behavior we can observe when we take two identical matrices and store them in *row major* and *column major* respectively. Notice how we swizzle the elements in the *column major* memory layout.

![Identical matrices]({{ site.baseurl }}/assets/images/matrix-identical.png)



Similarly, if we start from identical flat memory layouts, we get a transposed matrix when switching between row and column major.

![Identical matrices]({{ site.baseurl }}/assets/images/matrix-transposed.png)

*(I'll notice that I've switched to using u<sub>x</sub> notation rather than listing elements as a<sub>11</sub> etc in the second diagram.. The cell elements simply index the matrix, but the vectors in the second diagram are the logical representation of what the matrix is - three base vectors u, v, w that represent scale/rotation and a vector o which is translation of the origin.)*

This means we can transpose **A** to **A<sup>T</sup>** and vice versa by swizzling the memory layout (for example, when mapping the data structure to the GPU) or by casting the memory as a matrix of the the opposite *majorness*. 



This will be our first point of control when passing matrices to the GPU. Two more to go.



## How is the matrix packed in the constant registers

We'll examine how the matrices are packed in uniform parameters when loaded in the shader program. We'll use DirectX12 as an example. Note that for OpenGL the majorness is flipped (the matrices are transposed) - these differences are handled by cross-platform compilers like dxc, as discussed later in the article.

As [Matrix Order](https://docs.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-per-component-math#matrix-ordering) explains, *The data in a matrix is loaded into shader constant registers before a shader runs. There are two choices for how the matrix data is read: in row-major order or in column-major order. Column-major order means that each matrix column will be stored in a single constant register, and row-major order means that each row of the matrix will be stored in a single constant register. This is an important consideration for how many constant registers are used for a matrix.*

More importantly, *Once the data is written into constant registers, matrix order has no effect on how the data is used or accessed from within shader code. Also, matrices declared in a shader body do not get packed into constant registers. Row-major and column-major packing order has no influence on the packing order of constructors (which always follows row-major ordering).*

The second point is something people often miss when working with shader code. A matrix is defined as a rows by columns array and never the other way around. It's important to keep in mind what the matrix represents - a transform matrix that was read as a row major can be transposed and will result in an identical matrix as if it was read as a column major. But if we want to construct it in the shader code, we have to transpose (swizzle) it ourselves.

Let's visualize this.

![Identical matrices]({{ site.baseurl }}/assets/images/matrix-mapping.png)

As you can see a *row major* matrix read as a `row_major` results in the same matrix that we had constructed on the CPU side. The same is true for a *column major* matrix read as a `column_major` (which is effectively **A<sup>T</sup>** compared to the *row major*). We can effectively **transpose** the matrix at this point by reading it as the opposite *majorness* of what we have declared on the CPU side.

Similarly if we had swizzled the matrix in the memory beforehand we can effectively **transpose** it by using the same *majorness*. You can use SIMD shuffle math to swizzle the values *physically* or you can easily achieve this by populating a matrix as the opposite major in the first place, for example by using *SetRow()* in place of *SetColumn()*.

Do note that how we store the matrix in memory and what the matrix rows or columns *actually* represent mathematically are two independent concepts. That's why we can have transform matrices laid out in memory in the order of their base unit vectors or swizzled. 

By controlling the storage flag we can transpose the matrix when reading it from the constant registers, which is our second point of control when passing matrices to the GPU.



## How is the matrix used in the shader code

Finally, there is the matrix-vector multiplication form in the shader code. It's commonly performed by the overloaded function [`mul(x,y)`](https://docs.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-mul). `mul` is a matrix multiplication function and as such it follows the mathematical matrix multiplication definition - every element **b<sub>ij</sub>** in the resulting matrix **B** is the dot product of the **i<sup>th</sup> row** and the **j<sup>th</sup> column** of **x** and **y** respectively.  For the dot product to be defined the x-columns and y-rows must match.

Let's check the description in depth, particularly the matrix by a vector multiplication:

*If x is a vector, it's treated as a row vector. If y is a vector, it's treated as a column vector.*

Because the matrix multiplication rule is *row-by-column* if we take the product of **a <sub>x</sub> A** we need a matrix with a number of rows equal to the number of columns in the row-vector **a**. The columns in **a** are its individual elements. If **A** is a transformation matrix and each of its rows represents the transformed *unit vectors* comprising **a** then the following diagram illustrates the transformation of **a**:

![Matrix transform]({{ site.baseurl }}/assets/images/matrix-transform.png)

In computer graphics it's common to represent vectors and points with their *homogeneous coordinates*. Points are usually normalized by having their last element (*w*) equal 1 and vectors are represented by their infinity point (direction), having their last element equal 0. By adding an extra *translation* row to the transformation matrix and extending the columns to identify if the transformed unit is a vector or a point, we can easily combine rotation, scale and translation (and sometimes shear) in a single 4x4 matrix. Notice that the three vectors and the origin point remain respectively vectors and a point post-transformation.



Finally, let's examine the row-major and column-major math of the `mul(x, y)` function. Vectors in the shader program are stored linearly regardless of their major - they are treated as row- or column-major depending on which side of the equation they sit on, but the input vector and the resulting transformed vector are stored exactly the same way in the memory. What this means for us is that the `mul(x, y)` function preserves the mathematical rule that if **a <sub>x</sub> A = b** then **A<sup>T</sup> <sub>x</sub> a<sup>T</sup> = b<sup>T</sup>** . However **a<sup>T</sup>** and **b<sup>T</sup>** are the column-vectors (transposed) of their row-vector counterparts, but are in fact stored in memory the exact same way. Therefore in the shader program if  **a <sub>x</sub> A = b** then **A<sup>T</sup> <sub>x</sub> a = b** holds.


**Note!** This is true when you use a float4 or a similar one-dimentional array type to store your vector. If you use a float1x4 or a float4x1 you're likely to get a compile error or even worse, have the shader compiler cast the result for you in a potentially undefined (from your perspective) way. 


Final diagram to illustrate this statement:

![Matrix transform]({{ site.baseurl }}/assets/images/matrix-transform-t.png)



By controlling the order of multiplication `mul(a, A)` or `mul(A, a)` we can work with either **A** or **A<sup>T</sup>**, the math and the resulting vectors are exactly the same. On the other hand using the opposite order will result in an undefined garbage.

By the time we have to multiply the vector by the transformation matrix in the shader it looks like there is only one choice, but in fact this is our third point of control and a third opportunity to transpose the matrix.



## Multiplication table (reference)

In computer graphics we often work with multiple math, physics and rendering libraries, different shader code and various authoring tools. The matrix multiplication math hinges on using the correct multiplication order of the vector-matrix, but as we showed there are three places in the code where we are in control of transposing the transformation matrix. The choice is binary and on every step we either work with **A** or **A<sup>T</sup>**, which results in 8 possible ways we can supply the data to the shader program. Four of those ways are defined as a vector transformation and are **all** *perfectly* <u>valid</u>. The other four make no sense and result in undefined garbage. Depending on the engine you're working on and the restrictions, it can make sense to hijack one or more control points and implement custom behavior that changes with libraries, graphics API or shader compile-time preprocessing macros.

Here is the cheatsheet table:

| Matrix | Map as ...                                   | Read as ...                        | Multiply order        | Result   |
| ------ | -------------------------------------------- | ---------------------------------- | --------------------- | -------- |
| A      | As is (still A)                              | `row_major` (still A)              | mul(a, A)             | &#x2611; |
| A      | A<sup>T</sup> or swizzle (now A<sup>T</sup>) | `row_major` (still A<sup>T</sup>)  | mul(a, A<sup>T</sup>) | garbage  |
| A      | As is (still A)                              | `column_major` (now A<sup>T</sup>) | mul(a, A<sup>T</sup>) | garbage  |
| A      | A<sup>T</sup> or swizzle (now A<sup>T</sup>) | `column_major` (now A)             | mul(a, A)             | &#x2611; |
| A      | As is (still A)                              | `row_major` (still A)              | mul(A, a)             | garbage  |
| A      | A<sup>T</sup> or swizzle (now A<sup>T</sup>) | `row_major` (still A<sup>T</sup>)  | mul(A<sup>T</sup>, a) | &#x2611; |
| A      | As is (still A)                              | `column_major` (now A<sup>T</sup>) | mul(A<sup>T</sup>, a) | &#x2611; |
| A      | A<sup>T</sup> or swizzle (now A<sup>T</sup>) | `column_major` (now A)             | mul(A<sup>T</sup>, a) | garbage  |

Double check the math - each column in the cheat sheet is covered by one of the earlier chapters in detail.

Finally, in the next chapter I'll discuss how you can verify the math using a simple viewer application.




## Data captures
I forked DirectX 12's Graphics Samples and used the ModelViewer as a base to illustrate the matrix math. You can find the repository [here]([https://github.com/LautrecOfCarim/RenderingExamples](https://github.com/LautrecOfCarim/RenderingExamples)). Most of the major changes are at `716cb610ea1eac69af5764c4b301ba694e6ba80f`

If you run the code you'll see `#define MATRIX_MATH_RRR` in the `ModelViewer.cpp`. There are a total of 8 defines for the each possible 8 combinations (see the cheat sheet). The first letter (R or C) indicates if the matrix is laid out in Row major or Column major in the memory. I haven't modified the underlying math library, so this change is only captured when mapping the data to the GPU - a column major matrix is manually swizzled when mapped. The second letter indicates how the matrix is stored and copied to the GPU, which is represented by the `row_major` or `column_major` storage qualifier in the constant buffer. The third letter indicates if the multiplication order treats the matrix and vector as row major (using `mul(a, M)`) or column major (using `mul(M, a)`). Using these eight combinations we can run the application and capture the GPU frame to analyze it.

### modelToProjection matrix

#### Case RRR
This is the first case in our cheat sheet. In this combination the game representation of the `viewProjection` matrix is a `row major` matrix. Each row is laid out in memory fully before the next row starts tightly packed behind it. The PIX capture shows the data buffer in the state in which it was mapped. Note that it matches the CPU representation exactly. The `row_major` or `column_major` storage 

|              |           |              |           |
| ------------ | --------- | ------------ | --------- |
| -0.047791    | -1.13123  | 8.82812e-05  | -0.882724 |
| -4.04714e-08 | 2.13241   | 4.6891e-05   | -0.468863 |
| -1.35715     | 0.0398353 | -3.10875e-06 | 0.0310844 |
| 0            | -144.797  | 0.872434     | 1276.53   |

#### Case RCC
This is the seventh row (one to last) in our cheat sheet. This combination is identical to the RRR case on the CPU. The `viewProjection` is again a `row major` matrix. Capturing the data in PIX gives us:

|              |           |              |           |
| ------------ | --------- | ------------ | --------- |
| -0.047791    | -1.13123  | 8.82812e-05  | -0.882724 |
| -4.04714e-08 | 2.13241   | 4.6891e-05   | -0.468863 |
| -1.35715     | 0.0398353 | -3.10875e-06 | 0.0310844 |
| 0            | -144.797  | 0.872434     | 1276.53   |

Note that this is the raw data capture. It shows the buffer the same way we have originally mapped it to the GPU memory. How is this data copied to the shader matrix depends on the storage qualifier.

#### Case CCR
This is the fourth example in our cheat sheet. This combination indicates that the `viewProjection` matrix is swizzled when mapped (by casting it as a `column major` matrix on the CPU or, in our case, manually swizzling it). The PIX capture shows us that it's transposed compared to the previous two cases:

|             |              |              |          |
| ----------- | ------------ | ------------ | -------- |
| -0.047791   | -4.04714e-08 | -1.35715     | 0        |
| -1.13123    | 2.13241      | 0.0398353    | -144.797 |
| 8.82812e-05 | 4.6891e-05   | -3.10875e-06 | 0.872434 |
| -0.882724   | -0.468863    | 0.0310844    | 1276.53  |

This is the expected behavior. Note that in our sample we transpose the matrix when the storage is specified as `column major`:

```
    for (int r = 0; r < 4; r++)
    {
        for (int c = 0; c < 4; c++)
        {
#if defined(MATRIX_MATH_CCC) || defined(MATRIX_MATH_CCR) || defined(MATRIX_MATH_CRC) || defined(MATRIX_MATH_CRR)
            memcpy(dst + c * 4 + r, src + r * 4 + c, sizeof(float));
#else
            memcpy(dst + r * 4 + c, src + r * 4 + c, sizeof(float));
#endif
        }
    }
```

#### Case CRC
This is the sixth example in our cheat sheet. Its also the second valid case where the matrix is swizzled when mapped. Again, the matrix is transposed in the capture, just as we expect it to be:

|             |              |              |          |
| ----------- | ------------ | ------------ | -------- |
| -0.047791   | -4.04714e-08 | -1.35715     | 0        |
| -1.13123    | 2.13241      | 0.0398353    | -144.797 |
| 8.82812e-05 | 4.6891e-05   | -3.10875e-06 | 0.872434 |
| -0.882724   | -0.468863    | 0.0310844    | 1276.53  |



### Debugging the shader program

Again in PIX you can debug the shader program. Select the Graphics Queue 0 and navigate to `Scene Render` - `Main Render` - `Render Color` - `DrawIndexedInstanced`. Then open the Debug tab and you should see the vertex and pixel shaders associated with the draw call. If you step through the vertex shader you can see the contents of the transformation matrix *after* it has been mapped and read from the registers and where the original register data comes from. For a `row_major` matrix the capture should look like this:

| Name                   | Value           | Type  | Location      |
| ---------------------- | --------------- | ----- | ------------- |
| modelToProjection[0].x | -0.0502335355   | float | `cb0[0][0].x` |
| modelToProjection[0].y | -1.13115978     | float | `cb0[0][0].y` |
| modelToProjection[0].z | 8.82754903e-05  | float | `cb0[0][0].z` |
| modelToProjection[0].w | -0.882666588    | float | `cb0[0][0].w` |
| modelToProjection[1].x | -2.02357029e-08 | float | `cb0[1][0].x` |
| modelToProjection[1].y | 2.13240504      | float | `cb0[1][0].y` |
| modelToProjection[1].z | 4.68909566e-05  | float | `cb0[1][0].z` |
| modelToProjection[1].w | -0.468862653    | float | `cb0[1][0].w` |
| modelToProjection[2].x | -1.35706568     | float | `cb0[2][0].x` |
| modelToProjection[2].y | 0.0418712869    | float | `cb0[2][0].y` |
| modelToProjection[2].z | -3.26763279e-06 | float | `cb0[2][0].z` |
| modelToProjection[2].w | 0.0326730609    | float | `cb0[2][0].w` |
| modelToProjection[3].x | 2.68714595      | float | `cb0[3][0].x` |
| modelToProjection[3].y | -144.799240     | float | `cb0[3][0].y` |
| modelToProjection[3].z | 0.872433901     | float | `cb0[3][0].z` |
| modelToProjection[3].w | 1276.53320      | float | `cb0[3][0].w` |


For a `column_major` matrix the data is similarly transposed with the `modelTpProjection[0]` for example mapping to the first column of the 4 constant buffers - `cb[0][0].x`, `cb[1][0].x`, `cb[2][0].x` and  `cb[3][0].x`, respectively.

