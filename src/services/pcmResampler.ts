/**
 * Convert Web Audio frames to the 16 kHz signed PCM stream required by the
 * realtime ASR gateway. `AudioContext({ sampleRate: 16000 })` is only a
 * request: some macOS devices keep the hardware rate (commonly 48 kHz).
 * Sending that audio as if it were 16 kHz makes speech sound stretched and
 * produces the short/garbled transcriptions seen in browser capture.
 */
export class PcmResampler {
  private readonly sourceRate: number;
  private readonly targetRate: number;
  private position = 0;
  private carry = new Float32Array(0);

  constructor(sourceRate: number, targetRate = 16_000) {
    this.sourceRate = sourceRate;
    this.targetRate = targetRate;
  }

  toPcm(input: Float32Array): Int16Array {
    if (this.sourceRate === this.targetRate) return floatToPcm(input);

    const samples = new Float32Array(this.carry.length + input.length);
    samples.set(this.carry);
    samples.set(input, this.carry.length);
    const ratio = this.sourceRate / this.targetRate;
    const output: number[] = [];

    while (this.position + 1 < samples.length) {
      const left = Math.floor(this.position);
      const right = left + 1;
      const fraction = this.position - left;
      const value = samples[left] + (samples[right] - samples[left]) * fraction;
      output.push(floatToInt16(value));
      this.position += ratio;
    }

    const consumed = Math.floor(this.position);
    this.carry = samples.slice(consumed);
    this.position -= consumed;
    return Int16Array.from(output);
  }
}

export function floatToPcm(input: Float32Array): Int16Array {
  const pcm = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    pcm[index] = floatToInt16(input[index]);
  }
  return pcm;
}

function floatToInt16(value: number): number {
  const sample = Math.max(-1, Math.min(1, value));
  return sample < 0 ? sample * 0x8000 : sample * 0x7fff;
}
