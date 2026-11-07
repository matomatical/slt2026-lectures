// Shared scalar-input/scalar-output example: two tanh hidden layers and a
// linear output. Vectors store all layer matrices (row-major), then all biases.
export const LAYER_SIZES = [1, 4, 4, 1];
export const WEIGHT_COUNT = 24;
export const PARAMETER_COUNT = 33;

export function parametersAt({x, y}) {
  return Array.from({length:PARAMETER_COUNT}, (_, index) => {
    const phase = (index + 1) * 2.399963;
    return Math.sin(phase + x * (5 + 8 * Math.sin(phase)) +
      y * (5 + 8 * Math.cos(phase * 1.7)));
  });
}

export function evaluateNetwork(parameters, input) {
  let activations = [input];
  let weightIndex = 0;
  let biasIndex = WEIGHT_COUNT;
  for (let layer = 1; layer < LAYER_SIZES.length; layer++) {
    activations = Array.from({length:LAYER_SIZES[layer]}, () => {
      let value = parameters[biasIndex++];
      for (const activation of activations) value += parameters[weightIndex++] * activation;
      return layer === LAYER_SIZES.length - 1 ? value : Math.tanh(value);
    });
  }
  return activations[0];
}

export function weightColor(value) {
  const zero = [140, 140, 140];
  const end = value > 0 ? [255, 77, 255] : [255, 153, 51];
  return `rgb(${zero.map((channel, index) => Math.round(channel + Math.min(1, Math.abs(value)) * (end[index] - channel))).join(", ")})`;
}
