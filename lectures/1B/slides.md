---
title: Degeneracies in Deep Learning
subtitle: SLT Lecture 1B
title-landscape: network
progress-color: magenta
author: Matthew Farrugia-Roberts
date: 3 November 2026
---

# Neural networks {data-ornament="network-short-3"}

## Networks of neurons

<slt-neuron-network></slt-neuron-network>

## Parameter space {.sidebar}

Collect all weights and biases into a vector $w \in \R^d$. Each vector
specifies one configuration of the network.

The **parameter space** is some subset $\mathcal W \subseteq \R^d$.

Terminological notes:

* We sometimes organise $w$ into matrices and vectors corresponding to the
  weights/biases of each layer. To a training algorithm, it's normally a flat
  vector.
* "Parameter" can refer to either a parameter *vector* (like $w$) or to an
  individual weight or bias (as in "number of parameters").
* "Model" sometimes (esp. in deep learning) refers to a parameter vector,
  sometimes (esp. in statistics) to a parameter space.

---

<slt-parameter-space></slt-parameter-space>

## Parameter--function map {.sidebar}

A network of neurons with fixed weights and biases (parameter $w$) defines a
**function**
  $f_w : \R^m \to \R^{m'}$.
Consider a **function space** $\mathcal F$ that contains all functions this
architecture can represent (plus maybe some others for mathematical
convenience).

The **parameter--function map** is the map from these parameters to their
functions:
$$\Phi:\mathcal W\longrightarrow\mathcal F,\qquad w\longmapsto f_w.$$

The parameter--function map is the formal object representing a particular
neural network architecture.

---

<slt-parameter-space view="map" layout="sidebar"></slt-parameter-space>

## Example 1: Shallow linear network

Simplest example network: one layer, $m$ inputs and outputs, no activation
function, no biases.

A parameter $w\in\mathcal W=\R^{m^2}$ encodes a matrix $W\in\R^{m\times m}$:
$$f_W(x)=Wx.$$

For $m=1$, this is just $f_w(x)=wx$: the parameter is the slope.

## Example 2: Deep linear network

Simplest example ***deep*** network: two linear layers, with $m$ inputs and
outputs and $h$ hidden neurons, no activation functions, and no biases.

A parameter is $w=(A,B)\in\mathcal W=\R^{h\times m}\times\R^{m\times h}$,
where $A\in\R^{h\times m}$ and $B\in\R^{m\times h}$.
There are $2mh$ scalar parameters.

The corresponding function is
$$f_w(x)=BAx,\qquad x\in\R^m.$$

For $m=h=1$, write $w=(a,b)\in\R^2$. Then $f_w(x)=bax$: the product determines
the slope.

## Loss landscape

In deep learning, we find a parameter by local search in the parameter space,
guided by a **loss function** measuring how well the parameter's function fits
our data.

Given a data point $(x, y) \in \R^m \times \R^{m'}$, a **per-example loss**
measures prediction error. For example, squared error:
  $$L_{x,y}(w) = \|f_w(x)-y\|^2.$$

Given a data distribution $q$ and $n$ independent samples from it:

* **Empirical loss**: how well network fits training examples.
  $L_n(w) = \frac1n\sum_{i=1}^n L_{x^{(i)},y^{(i)}}(w).$

* **Population loss**: how well network fits on average.
  $L(w) = \E_{(x,y)\sim q}[L_{x,y}(w)].$

## Let's train a neural network

<slt-train-network></slt-train-network>

# Degenerate networks {data-ornament="network-short-2"}

## First definition of degeneracy

For $v \in \R^d$, $v\ne0$, define the **normalised directional derivative**
$$
  D_v\Phi(w)(x)=\frac1{\|v\|}
  \sum_{i=1}^d v_i\frac{\partial f_w(x)}{\partial w_i}.
$$

The parameter--function map is **degenerate at $w$** if there is a nonzero
direction $v\in\R^d$ such that
  $$D_v\Phi(w)=0.$$

The directional derivative is a function. Moving the parameter in this
direction does not change the neural network's function (to first order).

<!--
Notes:

* We say the architecture is **degenerate in direction $v$.**
* If you include $0$, the degenerate directions form a subspace.
* A neural network architecture can be **somewhere degenerate** or **everywhere
  degenerate**.
-->

## Shallow linear network architecture is nowhere degenerate

For the shallow linear network $f_W(x)=Wx$, the parameter--function map
is **nowhere degenerate**, for any input/output dimension $m$.

::: {.notes}

**Scalar worked example: $m=1$.**

1. Write $f_w(x)=wx$, with $w\in\R$.
2. Perturb $w$ in a nonzero direction $v\in\R$:
   $$f_{w+tv}(x)-f_w(x)=tvx.$$
3. The normalised directional derivative is
   $$D_v\Phi(w)(x)=\frac{v}{|v|}x.$$
   This is not the zero function: evaluate it at $x=1$.

There is no nonzero degenerate direction, at any $w$.
This concerns the function on all inputs, independently of a data distribution.

:::

## Deep linear network architecture is everywhere degenerate

For the two-layer linear network $f_{A,B}(x)=BAx$, the parameter--function
map is **everywhere degenerate**, for any $m,h\geq1$.

::: {.notes}

**Scalar worked example: $m=h=1$.**

1. Write $f_{a,b}(x)=abx$, with $(a,b)\in\R^2$.
2. For $v=(v_a,v_b)$, expand
   $$\begin{aligned}
   f_{a+tv_a,b+tv_b}(x)
   &=abx+t(bv_a+av_b)x+t^2v_av_bx.
   \end{aligned}$$
   A nonzero direction is degenerate exactly when $bv_a+av_b=0$.
3. At $(a,b)\ne(0,0)$, take $v=(a,-b)$: the first-order term vanishes.
4. At the origin, the first-order term vanishes for every $v$.

Thus the architecture is everywhere degenerate. Away from the origin,
there is one independent degenerate direction; at the origin, there are two.

:::

## Degeneracy and symmetries {.split}

Sources of degenerate directions:

* **Global symmetry:** a smooth family of transformations preserves the function
  at every parameter.

* **Localised symmetry:** a smooth family preserves the function only on a
  subset of parameter space.

* **First-order degeneracy only:** $D_v\Phi(w)=0$, but no constant-function
  curve through $w$ has tangent $v$.

---

Single-hidden-unit DLN $f_{a,b}(x) = b a x$:

<slt-dln-degeneracy></slt-dln-degeneracy>

# Degenerate learning problems {data-ornament="network-short-1"}

## Second definition of degeneracy

Let $w_\ast$ be a local minimum of a twice-differentiable loss $L$.
Its **Hessian** $H(w_\ast)\in\R^{d\times d}$ is
$$H(w_\ast)_ {jk}=\frac{\partial^2L}{\partial w_j\partial w_k}(w_\ast).$$

At a minimum, $H(w_\ast)$ is positive semidefinite.

* **Non-degenerate minimum:** $H(w_\ast)$ is positive definite.
* **Degenerate minimum:** $H(w_\ast)$ is singular; some nonzero $v$ satisfies
  $H(w_\ast)v=0$.

Intuitively: A non-degenerate minimum can be locally approximated by some
quadratic bowl. A degenerate minimum cannot.

## Shallow linear networks are usually not degenerate {.split}

Consider $f_W(x)=Wx$, with population loss
$$L(W)=\E_{(x,y)\sim q}\|Wx-y\|^2.$$

Assume finite second moments and that $\E_q[xx^\top]$ is positive definite.

**Any minimum $W_\ast$ is non-degenerate.**

---

<slt-linear-loss></slt-linear-loss>

::: {.notes}

**Worked example: a two-input, one-output linear neuron (about two minutes).**

The general statement on the slide also covers rectangular weight matrices.
For the plot, take $m=2$ inputs and a scalar output: $W$ is the row vector
$w^\top=(w_1,w_2)$, so the entire two-dimensional parameter space can be shown.
A square $2\times2$ matrix would have four weights and require a slice.

1. Write the neuron and choose a simple data distribution:
   $$f_w(x)=w_1x_1+w_2x_2,\qquad y=0,\qquad\E[xx^\top]=I_2.$$
   For example, the input coordinates can be independent, mean-zero,
   unit-variance random variables.

2. Expand the population squared-error loss:
   $$\begin{aligned}
   L(w)&=\E(w_1x_1+w_2x_2)^2\\
   &=w_1^2\E[x_1^2]+2w_1w_2\E[x_1x_2]+w_2^2\E[x_2^2]\\
   &=w_1^2+w_2^2.
   \end{aligned}$$

3. Differentiate:
   $$\nabla L(w)=\begin{pmatrix}2w_1\\2w_2\end{pmatrix},\qquad
   H(w)=\begin{pmatrix}2&0\\0&2\end{pmatrix}.$$
   Both eigenvalues are positive. The unique minimum is $w_\ast=0$,
   and it is non-degenerate.

Rotate the plot to show positive curvature in every direction through the
minimum. This example is exactly a quadratic bowl; a general non-degenerate
minimum has a positive definite quadratic bowl as its leading local shape.
The next slide contrasts this with flat valleys and a quartic crossing.

The plot omits heights above 3 and uses a linear vertical scale, matching
the deep-network plots. Drag to rotate.

:::

## Deep linear networks are always degenerate

For $f_{A,B}(x)=BAx$ with squared-error loss and finite second moments,
**every local minimum is degenerate.**

<slt-dln-loss></slt-dln-loss>

## More examples of loss degeneracy

<slt-loss-examples></slt-loss-examples>

# *fin* {data-ornament="network-short-0"}

## Bonus example: Simple hyperbolic tangent network

Take scalar inputs and outputs, $h$ hidden units, and biases:
$$f_w(x)=d+\sum_{i=1}^h a_i\tanh(b_i x+c_i).$$

The parameter space is $\mathcal W=\R^{3h+1}$, with
$$w=(a_1,b_1,c_1,\ldots,a_h,b_h,c_h,d).$$

* $b_i,c_i$: incoming weight and bias of hidden unit $i$.
* $a_i$: outgoing weight of hidden unit $i$.
* $d$: output bias.

## Non-linear network degeneracies

$$f_w(x)=d+\sum_{i=1}^h a_i\tanh(b_i x+c_i).$$

This network has **no global symmetries**, but several **localised**
symmetries. Can you find them?

1. &nbsp; <br>

2. &nbsp; <br>

3. &nbsp;

<!--

1. **Zero outgoing weight:** if $a_i=0$, changing $b_i,c_i$ has no effect.
2. **Constant hidden unit:** if $b_i=0$, its contribution is $a_i\tanh(c_i)$.
   Changing $a_i$ can be offset by changing $d$.
3. **Duplicate hidden units:** if $(b_i,c_i)=(b_j,c_j)$, only $a_i+a_j$
   matters. Transfer outgoing weight between them without changing $f_w$.

-->
