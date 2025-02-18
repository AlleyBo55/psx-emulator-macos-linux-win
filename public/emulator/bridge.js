(function () {
  const opener = document.getElementById("iso_opener");
  const statusNode = document.getElementById("status");
  const queuedFiles = [];
  let readySent = false;

  // --- Persist save data ---
  // The worker now mounts IDBFS on /home/web_user/.pcsx and syncs every 5s.
  // From the main thread we can also trigger a sync via the "sync-saves" command
  // and sync the main-thread /cfg/ (pad config) via FS.syncfs.

  function syncWorkerSaves() {
    if (window.pcsx_worker) {
      window.pcsx_worker.postMessage({ cmd: "sync-saves" });
      console.log("[bridge] save data synced to IndexedDB");
    }
  }

  function syncMainThreadFS() {
    if (typeof FS !== "undefined" && FS.syncfs) {
      FS.syncfs(false, function (err) {
        if (err) console.warn("[bridge] cfg sync failed:", err);
      });
    }
  }

  function persistAll() {
    syncWorkerSaves();
    syncMainThreadFS();
    sendToParent({ type: "emulator-status", status: "Save data synced." });
  }

  window.addEventListener("beforeunload", persistAll);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      persistAll();
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
      updateStatus("Queued " + file.name + " for launch...");
      return;
    }

    opener.disabled = true;
    window.pcsx_worker.postMessage({ cmd: "loadfile", file: file });
    updateStatus("Loading " + (file.name || "game image") + "...");

    if (typeof check_controller === "function") {
      try { check_controller(); } catch (e) {}
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
    var data = event.data;

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

      var key = String(event.key || "").toLowerCase();
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
