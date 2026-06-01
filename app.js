const STORAGE_KEY = "claw-machine-tasker-state";

const screens = [...document.querySelectorAll("[data-screen]")];
const taskForm = document.getElementById("task-form");
const taskNameInput = document.getElementById("task-name");
const formMessage = document.getElementById("form-message");
const taskList = document.getElementById("task-list");
const deleteToolbar = document.getElementById("delete-toolbar");
const machineFloor = document.getElementById("machine-floor");
const prizeText = document.getElementById("prize-text");
const taskCount = document.getElementById("task-count");
const emptyState = document.getElementById("empty-state");
const machineWrap = document.getElementById("machine-wrap");
const clawCable = document.getElementById("claw-cable");
const claw = document.getElementById("claw");
const prizeModal = document.getElementById("prize-modal");
const prizeModalTask = document.getElementById("prize-modal-task");

const state = loadState();

const clawState = {
  x: 0.5,
  y: 0.2,
  grabbing: false,
};

const uiState = {
  deleteMode: false,
  selectedForDelete: [],
  modalOpen: false,
};

function loadState() {
  const fallback = { tasks: [] };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return fallback;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.tasks)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createTask(name) {
  return {
    id: crypto.randomUUID(),
    name,
    completed: false,
    claimed: false,
    color: randomBallColor(),
    position: randomBallPosition(),
  };
}

function randomBallColor() {
  const palette = [
    "linear-gradient(180deg, #ffea9a, #ff9a61)",
    "linear-gradient(180deg, #9fe6ff, #4bb8ff)",
    "linear-gradient(180deg, #ffc1d6, #ff87a8)",
    "linear-gradient(180deg, #d0f7a6, #8ed96c)",
    "linear-gradient(180deg, #e2c0ff, #b78cff)",
  ];

  return palette[Math.floor(Math.random() * palette.length)];
}

function randomBallPosition() {
  return {
    x: 8 + Math.random() * 78,
    y: 12 + Math.random() * 44,
  };
}

function getAvailableTasks() {
  return state.tasks.filter((task) => !task.completed && !task.claimed);
}

function setScreen(screenName) {
  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === screenName);
  });

  if (screenName === "play") {
    renderMachine();
  }

  if (screenName === "create") {
    renderTaskList();
    taskNameInput.focus();
  }
}

function renderTaskList() {
  if (!state.tasks.length) {
    uiState.deleteMode = false;
    uiState.selectedForDelete = [];
    deleteToolbar.classList.add("hidden");
    taskList.innerHTML = "<li class=\"task-item\"><span>No tasks yet. Add one to get started.</span></li>";
    return;
  }

  deleteToolbar.classList.toggle("hidden", !uiState.deleteMode);
  taskList.innerHTML = "";

  state.tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " done" : ""}`;

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const toggle = document.createElement("input");
    toggle.className = "task-toggle";
    toggle.type = "checkbox";
    toggle.checked = task.completed;
    toggle.setAttribute("aria-label", `Mark ${task.name} complete`);
    toggle.addEventListener("change", () => {
      task.completed = toggle.checked;
      saveState();
      renderTaskList();
      renderMachine();
    });

    if (uiState.deleteMode) {
      const deleteCheck = document.createElement("input");
      deleteCheck.className = "delete-check";
      deleteCheck.type = "checkbox";
      deleteCheck.checked = uiState.selectedForDelete.includes(task.id);
      deleteCheck.setAttribute("aria-label", `Select ${task.name} for deletion`);
      deleteCheck.addEventListener("change", () => {
        if (deleteCheck.checked) {
          uiState.selectedForDelete = [...new Set([...uiState.selectedForDelete, task.id])];
        } else {
          uiState.selectedForDelete = uiState.selectedForDelete.filter((id) => id !== task.id);
        }
      });
      meta.append(deleteCheck);
    }

    const copy = document.createElement("div");
    copy.className = "task-copy";

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = task.name;

    const status = document.createElement("span");
    status.className = "task-status";
    status.textContent = task.completed
      ? "Completed"
      : task.claimed
        ? "Picked from machine"
        : "Waiting in machine";

    copy.append(name, status);
    meta.append(toggle, copy);

    if (uiState.deleteMode) {
      item.append(meta);
    } else {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "ghost-button";
      removeButton.textContent = "Delete";
      removeButton.addEventListener("click", () => {
        state.tasks = state.tasks.filter((entry) => entry.id !== task.id);
        saveState();
        renderTaskList();
        renderMachine();
      });
      item.append(meta, removeButton);
    }
    taskList.append(item);
  });
}

function renderMachine() {
  const availableTasks = getAvailableTasks();
  taskCount.textContent = String(availableTasks.length);
  emptyState.classList.toggle("hidden", availableTasks.length > 0);
  machineWrap.classList.toggle("hidden", availableTasks.length === 0);

  prizeText.textContent = availableTasks.length
    ? "Grab a ball to reveal a task."
    : "No task balls left. Finish a picked task or add a new one to refill the machine.";

  [...machineFloor.querySelectorAll(".task-ball")].forEach((ball) => ball.remove());

  availableTasks.forEach((task) => {
    const ball = document.createElement("button");
    ball.type = "button";
    ball.className = "task-ball";
    ball.dataset.taskId = task.id;
    ball.style.background = task.color;
    ball.style.left = `${task.position.x}%`;
    ball.style.top = `${task.position.y}%`;
    ball.setAttribute("aria-label", `Task ball for ${task.name}`);
    machineFloor.append(ball);
  });

  updateClawPosition();
}

function updateClawPosition() {
  const xPercent = clawState.x * 100;
  const stageHeight = machineFloor.parentElement?.getBoundingClientRect().height ?? 360;
  const minOffset = 14;
  const maxOffset = Math.max(minOffset, stageHeight - 135);
  const yOffset = minOffset + clawState.y * (maxOffset - minOffset);

  clawCable.style.left = `${xPercent}%`;
  claw.style.left = `${xPercent}%`;
  claw.style.top = `${yOffset}px`;
  clawCable.style.height = `${Math.max(48, yOffset)}px`;
}

function moveClaw(dx, dy) {
  clawState.x = clamp(clawState.x + dx, 0.1, 0.9);
  clawState.y = clamp(clawState.y + dy, 0, 1);
  updateClawPosition();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function openPrizeModal(taskName) {
  uiState.modalOpen = true;
  prizeModalTask.textContent = taskName;
  prizeModal.classList.remove("hidden");
}

function closePrizeModal() {
  uiState.modalOpen = false;
  prizeModal.classList.add("hidden");
}

function grabTask() {
  if (clawState.grabbing || uiState.modalOpen) return;

  const availableTasks = getAvailableTasks();
  if (!availableTasks.length) {
    prizeText.textContent = "No tasks left. Create a new one to keep playing.";
    return;
  }

  clawState.grabbing = true;
  claw.classList.add("grabbing");

  const clawRect = claw.getBoundingClientRect();
  const floorRect = machineFloor.getBoundingClientRect();
  const clawX = ((clawRect.left + clawRect.width / 2 - floorRect.left) / floorRect.width) * 100;
  const clawY = ((clawRect.top + clawRect.height - floorRect.top) / floorRect.height) * 100;

  const winner = availableTasks.reduce((best, task) => {
    const dx = task.position.x - clawX;
    const dy = task.position.y - clawY;
    const distance = Math.hypot(dx, dy);

    if (!best || distance < best.distance) {
      return { task, distance };
    }

    return best;
  }, null);

  window.setTimeout(() => {
    if (winner && winner.distance < 24) {
      const task = state.tasks.find((entry) => entry.id === winner.task.id);
      if (task) {
        task.claimed = true;
        saveState();

        const pickedBall = machineFloor.querySelector(`[data-task-id="${task.id}"]`);
        pickedBall?.classList.add("picked");

        prizeText.textContent = `Today's task: ${task.name}`;
        openPrizeModal(task.name);
      }
    } else {
      prizeText.textContent = "Missed it. Move closer to a ball and try again.";
    }

    clawState.grabbing = false;
    claw.classList.remove("grabbing");

    window.setTimeout(() => {
      renderMachine();
      renderTaskList();
    }, 180);
  }, 260);
}

function clearCompletedTasks() {
  state.tasks = state.tasks.filter((task) => !task.completed);
  saveState();
  renderTaskList();
  renderMachine();
}

function toggleDeleteMode(enabled) {
  uiState.deleteMode = enabled;
  if (!enabled) {
    uiState.selectedForDelete = [];
    formMessage.textContent = "";
  }
  renderTaskList();
}

function deleteSelectedTasks() {
  if (!uiState.selectedForDelete.length) {
    formMessage.textContent = "Pick at least one task to delete first.";
    return;
  }

  state.tasks = state.tasks.filter((task) => !uiState.selectedForDelete.includes(task.id));
  saveState();
  formMessage.textContent = "Selected tasks deleted.";
  toggleDeleteMode(false);
  renderMachine();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;

  if (action === "go-home") setScreen("home");
  if (action === "go-create") setScreen("create");
  if (action === "go-play") setScreen("play");
  if (action === "clear-completed") clearCompletedTasks();
  if (action === "toggle-delete-mode") toggleDeleteMode(true);
  if (action === "cancel-delete") toggleDeleteMode(false);
  if (action === "confirm-delete") deleteSelectedTasks();
  if (action === "close-prize-modal") closePrizeModal();
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const rawName = taskNameInput.value.trim();
  if (!rawName) {
    formMessage.textContent = "Please enter a task name first.";
    return;
  }

  state.tasks.unshift(createTask(rawName));
  saveState();
  renderTaskList();
  renderMachine();

  formMessage.textContent = `Saved "${rawName}" to your machine.`;
  taskForm.reset();
  taskNameInput.focus();
});

document.addEventListener("keydown", (event) => {
  if (uiState.modalOpen && (event.key === "Escape" || event.code === "Space")) {
    event.preventDefault();
    closePrizeModal();
    return;
  }

  const activeScreen = document.querySelector(".panel.active")?.dataset.screen;
  if (activeScreen !== "play") return;

  const key = event.key.toLowerCase();
  const movementStep = 0.04;

  if (["w", "a", "s", "d", " ", "spacebar"].includes(key) || event.code === "Space") {
    event.preventDefault();
  }

  if (key === "w") moveClaw(0, -movementStep);
  if (key === "a") moveClaw(-movementStep, 0);
  if (key === "s") moveClaw(0, movementStep);
  if (key === "d") moveClaw(movementStep, 0);
  if (key === " " || key === "spacebar" || event.code === "Space") grabTask();
});

renderTaskList();
renderMachine();
setScreen("home");
