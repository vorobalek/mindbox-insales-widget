(() => {
  const calls = window.__mindboxCalls || (window.__mindboxCalls = []);
  const queued =
    typeof window.mindbox === 'function' && Array.isArray(window.mindbox.queue) ? window.mindbox.queue.slice() : [];

  const mindboxMock = (command, payload) => {
    calls.push({ command, payload });
  };

  window.mindbox = mindboxMock;
  queued.forEach((args) => {
    mindboxMock(args[0], args[1]);
  });
})();
