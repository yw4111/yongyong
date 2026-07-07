const enabledSwitch = document.getElementById("enabledSwitch");
const toggleSwitch  = document.getElementById("toggleSwitch");
const statusText    = document.getElementById("statusText");

function applyEnabledUI(enabled) {
  statusText.textContent = enabled ? "On" : "Off";
  document.body.classList.toggle("disabled", !enabled);
}

// Load saved state
chrome.storage.sync.get(["enabled", "toggleMode"], ({ enabled, toggleMode }) => {
  const isEnabled = enabled !== false; // default on
  enabledSwitch.checked = isEnabled;
  toggleSwitch.checked  = !!toggleMode;
  applyEnabledUI(isEnabled);
});

function messageTab(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) chrome.tabs.sendMessage(tab.id, msg);
  });
}

enabledSwitch.addEventListener("change", () => {
  const value = enabledSwitch.checked;
  chrome.storage.sync.set({ enabled: value });
  applyEnabledUI(value);
  messageTab({ type: "SET_ENABLED", value });
});

toggleSwitch.addEventListener("change", () => {
  const value = toggleSwitch.checked;
  chrome.storage.sync.set({ toggleMode: value });
  messageTab({ type: "SET_TOGGLE", value });
});
