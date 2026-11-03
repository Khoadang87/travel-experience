import {boundedTime} from './navigation-w66.mjs';

// The old decoded panorama remains selected until the replacement is ready.
// Adapter injection lets failure/cancellation be checked without pretending a
// fake video element is Safari or rendered evidence.
export class SourceSession {
  constructor(createAdapter, onCommit = () => {}) {
    this.createAdapter = createAdapter; this.onCommit = onCommit;
    this.active = null; this.pending = null; this.generation = 0;
  }
  async open(routeId, path, requestedTime) {
    const time = boundedTime(path, requestedTime);
    const generation = ++this.generation;
    this.active?.adapter.pause();
    this.pending?.dispose(); this.pending = null;
    let adapter;
    try {
      adapter = this.createAdapter(path);
      this.pending = adapter;
      const evidence = await adapter.prepare(time);
      if (generation !== this.generation) return {ok:false, cancelled:true};
      if (!evidence?.decoded || !Number.isFinite(evidence.time) || Math.abs(evidence.time - time) > 0.6 || evidence.time < path.start - 0.05 || evidence.time >= path.end) {
        throw new Error('The requested recorded point did not decode.');
      }
      const previous = this.active;
      const next = {routeId, path, adapter};
      this.onCommit(next, previous);
      this.active = next; this.pending = null;
      previous?.adapter.dispose();
      return {ok:true, time:evidence.time};
    } catch (error) {
      if (generation !== this.generation) return {ok:false, cancelled:true};
      return {ok:false, error:error.message || 'Could not load this route.'};
    } finally {
      if (adapter && this.active?.adapter !== adapter) adapter.dispose();
      if (this.pending === adapter) this.pending = null;
    }
  }
  cancel() { this.generation++; this.pending?.dispose(); this.pending = null; this.active?.adapter.pause(); }
}
