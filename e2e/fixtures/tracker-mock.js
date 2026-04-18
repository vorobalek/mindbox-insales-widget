(() => {
  const calls = window.__mindboxCalls || (window.__mindboxCalls = []);
  const queued =
    typeof window.mindbox === 'function' && Array.isArray(window.mindbox.queue) ? window.mindbox.queue.slice() : [];

  const mindboxMock = (command, payload) => {
    calls.push({ command, payload });
    if (typeof window.__updateE2eDebugBlocks === 'function') {
      const updateDebugBlocks = window.__updateE2eDebugBlocks.bind(window);
      updateDebugBlocks();
    }
  };

  window.mindbox = mindboxMock;
  queued.forEach((args) => {
    mindboxMock(args[0], args[1]);
  });
})();
