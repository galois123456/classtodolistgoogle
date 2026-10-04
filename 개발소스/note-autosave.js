// One writer per note: an older request cannot overwrite a newer edit.
export function createAutoSaver({ snapshot, persist, status, remember = () => {}, forget = () => {}, delay = 650 }) {
  let revision = 0, saved = 0, timer, flight, disposed = false;
  function changed() {
    if (disposed) return;
    revision++; remember(snapshot()); status('pending');
    clearTimeout(timer); timer = setTimeout(flush, delay);
  }
  function flush() {
    clearTimeout(timer);
    if (disposed || saved === revision) return Promise.resolve();
    if (flight) return flight;
    flight = (async () => {
      while (!disposed && saved < revision) {
        const current = revision, values = snapshot(); status('saving');
        try { await persist(values); }
        catch (error) { if (!disposed) status('error', error); return; }
        saved = current;
        if (!disposed && saved === revision) { forget(); status('saved'); }
      }
    })().finally(() => { flight = null; });
    return flight;
  }
  return { changed, flush, dispose() { disposed = true; clearTimeout(timer); } };
}
