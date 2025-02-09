(function () {
  const opener = document.getElementById("iso_opener");
  const statusNode = document.getElementById("status");
  const queuedFiles = [];
  let readySent = false;

  // --- Persist save data (memory cards) back to IndexedDB ---
  var syncTimer = null;

  function persistSaveData() {
    if (typeof FS !== "undefined" && FS.syncfs) {
      FS.syncfs(false, function (err) {
        if (err) {
          console.warn("[bridge] save-data sync failed:", err);
        }
      });
    }
  }

  function schedulePersist() {
    if (syncTimer) return;
    syncTimer = setInterval(persistSaveData, 5000);
  }

  // Also sync when the tab is about to close or go hidden
  window.addEventListener("beforeunload", persistSaveData);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      persistSaveData();
    }
  });

  function sendToParent(message) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        Object.assign({ source: "aetherstation-emulator" }, message),
        "*",
      );
    }
  }

  function updateStatus(text) {
    if (statusNode && typeof text === "string") {
      statusNode.textContent = text;
    }
    sendToParent({ type: "emulator-status", status: text });

    const bootPanel = document.getElementById("boot-panel");
    if (bootPanel) {
      const lower = (text || "").toLowerCase();
      const isRunning = lower.includes("running") || lower === "";
      bootPanel.style.display = isRunning ? "none" : "";
    }
  }

  const originalSetStatus = Module.setStatus;
  Module.setStatus = function patchedSetStatus(text) {
    originalSetStatus(text);
    updateStatus(text);
  };

  function loadFile(file) {
    if (!(file instanceof File) && !(file instanceof Blob)) {
      sendToParent({
        type: "emulator-error",
        message: "The selected game file could not be passed into the emulator core.",
      });
      return;
    }

    if (!window.pcsx_worker || !opener || opener.disabled) {
      queuedFiles.push(file);
      updateStatus(`Queued ${file.name} for launch...`);
      return;
    }

    opener.disabled = true;
    window.pcsx_worker.postMessage({ cmd: "loadfile", file: file });
    updateStatus(`Loading ${file.name || "game image"}...`);
    schedulePersist();

    if (typeof check_controller === "function") {
      try { check_controller(); } catch {}
    }
  }

  function flushQueue() {
    if (!window.pcsx_worker || !opener || opener.disabled || queuedFiles.length === 0) {
      return;
    }

    loadFile(queuedFiles.shift());
  }

  function publishReady() {
    if (readySent || !window.pcsx_worker || !opener || opener.disabled) {
      return;
    }

    readySent = true;
    sendToParent({ type: "emulator-ready" });
  }

  window.addEventListener("message", function (event) {
    const data = event.data;

    if (!data || typeof data !== "object") {
      return;
    }

    if (data.type === "load-rom") {
      loadFile(data.file);
      return;
    }

    if (data.type === "forward-key") {
      if (typeof SDL !== "undefined" && SDL.receiveEvent) {
        var synth = {
          type: data.eventType,
          keyCode: data.keyCode,
          preventDefault: function () {},
          stopPropagation: function () {},
        };
        SDL.receiveEvent(synth);
      } else {
        var evt = new KeyboardEvent(data.eventType, {
          key: data.key,
          code: data.code,
          keyCode: data.keyCode,
          which: data.keyCode,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(evt);
      }
      return;
    }

    if (data.type === "fullscreen" && window.Module && typeof window.Module.goFullscreen === "function") {
      window.Module.goFullscreen();
    }
  });

  window.addEventListener(
    "keydown",
    function (event) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = String(event.key || "").toLowerCase();
      if (key !== "p" && key !== "o") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      sendToParent({ type: "toggle-controls-overlay" });
    },
    true,
  );

  window.addEventListener("error", function (event) {
    sendToParent({
      type: "emulator-error",
      message: event.message || "Unexpected emulator error.",
    });
  });

  window.setInterval(function () {
    publishReady();
    flushQueue();
  }, 250);
})();
